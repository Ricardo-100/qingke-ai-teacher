import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { completeBeats, pendingSpeech, validateClassBeat, streamClassroom } from '../server/classroom.mjs';

const beat = { speech: '从例子里学习规律。', blocks: [{ type: 'table', headers: ['规则', '学习'], rows: [['人编写', '模型学习']] }, { type: 'flow', nodes: ['数据', '模型', '预测'] }] };
test('live Step teaching requests low reasoning without sending provider options to other services', async t => {
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return Response.json({ choices: [{ message: { content: JSON.stringify({ beats: [beat] }) } }] });
  });
  for (const [baseUrl, model, expected] of [
    ['https://api.stepfun.com/step_plan/v1', 'step-3.7-flash', 'low'],
    ['https://api.stepfun.ai/v1', 'step-3.7-flash', 'low'],
    ['https://api.example.com/v1', 'step-3.7-flash', undefined],
    ['https://api.stepfun.com/v1', 'other-model', undefined],
  ]) {
    await streamClassroom({}, { baseUrl, model, apiKey: 'test' }, new AbortController().signal, () => {});
    assert.equal(requests.at(-1).reasoning_effort, expected);
  }
});
test('stream parser handles nested blocks, escaped quotes and incomplete Unicode content', () => {
  const source = JSON.stringify({ beats: [{ speech: '这里的 "} ]" 不是结束', blocks: [{ type: 'text', text: '中文\\字符' }] }, beat] });
  for (let i = 0; i < source.length; i++) assert.ok(completeBeats(source.slice(0, i)).length <= 2);
  assert.deepEqual(completeBeats(source), JSON.parse(source).beats);
  assert.deepEqual(completeBeats(''), []);
});
test('board protocol rejects invalid tables and unknown commands', () => {
  assert.equal(validateClassBeat(beat).blocks.length, 2);
  assert.throws(() => validateClassBeat({ speech: 'x', blocks: [{ type: 'script', text: 'bad' }] }));
  assert.throws(() => validateClassBeat({ speech: 'x', blocks: [{ type: 'table', headers: ['a', 'b'], rows: [['c']] }] }));
  assert.throws(() => validateClassBeat({ blocks: [] }));
});

test('speech preparation waits for a complete string and ignores nested board fields', () => {
  const speech = '先回答 "为什么"，再看 \\ 和公式。';
  const prefix = '{"beats":[{"speech":' + JSON.stringify(speech);
  for (let i = 0; i < prefix.length; i++) assert.equal(pendingSpeech(prefix.slice(0, i)), null);
  assert.deepEqual(pendingSpeech(prefix), { index: 0, speech });
  assert.deepEqual(pendingSpeech(prefix + ',"blocks":[{"text":"未完成'), { index: 0, speech });
  assert.equal(pendingSpeech(JSON.stringify({ beats: [beat] })), null);
  assert.deepEqual(pendingSpeech('{"beats":[' + JSON.stringify(beat) + ',{"speech":"下一段"'), { index: 1, speech: '下一段' });
  assert.equal(pendingSpeech('{"beats":[{"blocks":[{"speech":"不是讲稿"}]}'), null);
});

test('speech is delivered before board generation and prepared only once', { timeout: 5000 }, async () => {
  let release, early;
  const gate = new Promise(r => { release = r; });
  const ready = new Promise(r => { early = r; });
  const upstream = http.createServer(async (req, res) => {
    req.resume(); res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    const write = content => res.write('data: ' + JSON.stringify({ choices: [{ delta: { content } }] }) + '\n\n');
    write('{"beats":[{"speech":"先说核心答案。"');
    write(',"blocks":[');
    await gate;
    write('{"type":"text","text":"核心重点"}]}]}'); res.end('data: [DONE]\n\n');
  });
  await new Promise(r => upstream.listen(0, '127.0.0.1', r));
  const controller = new AbortController(), events = [];
  const pending = streamClassroom({}, { apiKey: 'test', model: 'test', baseUrl: `http://127.0.0.1:${upstream.address().port}` }, controller.signal,
    event => { events.push(event); if (event.type === 'speech') early(); });
  try {
    await ready;
    assert.deepEqual(events, [{ type: 'speech', index: 0, speech: '先说核心答案。' }]);
    release(); await pending;
    assert.deepEqual(events.map(e => e.type), ['speech', 'beat', 'done']);
  } finally { release(); controller.abort(); await pending.catch(() => {}); upstream.closeAllConnections(); await new Promise(r => upstream.close(r)); }
});
test('first usable beat arrives before upstream completes and carries interruption context', async () => {
  let release, received;
  const gate = new Promise(r => { release = r; });
  const upstream = http.createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    received = JSON.parse(body);
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    const content = '{"beats":[' + JSON.stringify(beat);
    // Split SSE framing and content across arbitrary transport chunks.
    const event = 'data: ' + JSON.stringify({ choices: [{ delta: { content } }] }) + '\n\n';
    res.write(event.slice(0, 29)); res.write(event.slice(29));
    await gate;
    res.end('data: ' + JSON.stringify({ choices: [{ delta: { content: ']}' } }] }) + '\n\ndata: [DONE]\n\n');
  });
  await new Promise(r => upstream.listen(0, '127.0.0.1', r));
  const controller = new AbortController();
  let first;
  const firstBeat = new Promise(r => { first = r; }); const events = [];
  const pending = streamClassroom({ topic: '机器学习', question: '为什么？', coursePosition: 2, history: [{ role: 'user', text: '为什么？' }], board: [{ type: 'text', text: '已写的内容' }] }, { apiKey: 'local-test', model: 'fixture', baseUrl: `http://127.0.0.1:${upstream.address().port}` }, controller.signal, e => { events.push(e); if (e.type === 'beat') first(); });
  try {
    await firstBeat;
    assert.equal(events.length, 1); assert.equal(events[0].type, 'beat');
    assert.equal(received.stream, true);
    const context = JSON.parse(received.messages[1].content);
    assert.equal(context.coursePosition, 2); assert.equal(context.board[0].text, '已写的内容');
    release(); await pending; assert.equal(events.at(-1).type, 'done');
  } finally { release(); controller.abort(); await pending.catch(() => {}); await new Promise(r => upstream.close(r)); }
});
test('cancelling the classroom propagates to the upstream request', async () => {
  const upstream = http.createServer((req, res) => {
    req.resume(); res.writeHead(200, { 'Content-Type': 'text/event-stream' }); res.write(': waiting\n\n');
  });
  await new Promise(r => upstream.listen(0, '127.0.0.1', r));
  const controller = new AbortController();
  const pending = streamClassroom({}, { apiKey: 'test', model: 'test', baseUrl: `http://127.0.0.1:${upstream.address().port}` }, controller.signal, () => {});
  setTimeout(() => controller.abort(), 50);
  try { await assert.rejects(pending, e => e.name === 'AbortError'); }
  finally { upstream.closeAllConnections(); await new Promise(r => upstream.close(r)); }
});
