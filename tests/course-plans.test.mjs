import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { schedule, validateOutline, planStore, discussPlan } from '../server/course-plans.mjs';
import { streamClassroom } from '../server/classroom.mjs';
import { createServer } from '../server/index.mjs';

const outline = { title: '系统学习 Python', goal: '零基础入门', lessons: [{ title: '变量与表达式', objectives: '理解赋值', sections: ['变量的含义', '赋值示例', '练习与自测', '总结'] }, { title: '条件判断', objectives: '理解分支', sections: ['复习变量', '条件表达式', '分支练习', '总结'] }] };
const input = { lessonCount: 2, minutesPerLesson: 30, outline, messages: [{ role: 'user', text: '零基础学习 Python' }] };
async function serve(server) { await new Promise(r => server.listen(0, '127.0.0.1', r)); return `http://127.0.0.1:${server.address().port}`; }
function close(server) { server.closeAllConnections(); return new Promise(r => server.close(r)); }

test('rejects inconsistent schedules and incomplete lesson outlines', () => {
  assert.throws(() => schedule({ lessonCount: 0, minutesPerLesson: 30 }));
  assert.throws(() => schedule({ lessonCount: 2, minutesPerLesson: 2 }));
  assert.throws(() => schedule({ lessonCount: 1.5, minutesPerLesson: 30 }));
  assert.throws(() => validateOutline(outline, 3));
  assert.throws(() => validateOutline({ ...outline, lessons: [{ title: '课', sections: [''] }] }, 1));
});

test('disk plans survive store/server recreation and safe ids cannot escape the directory', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'qingke-plans-'));
  let server;
  try {
    const saved = await planStore(dir).save({ ...input, id: '../../escape' });
    assert.match(saved.id, /^[0-9a-f-]{36}$/);
    assert.deepEqual(await readdir(dir), [`${saved.id}.json`]);
    await planStore(dir).save({ ...saved, outline: { ...outline, goal: '更新目标' } });
    assert.equal((await planStore(dir).list()).length, 1);
    server = createServer({ plansDirectory: dir });
    const url = await serve(server);
    const plans = await (await fetch(`${url}/api/course-plans`)).json();
    assert.equal(plans[0].outline.goal, '更新目标');
    const invalid = await fetch(`${url}/api/course-plans`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...input, lessonCount: 3 }) });
    assert.equal(invalid.status, 400);
    const forbidden = await fetch(`${url}/api/course-plans`, { method: 'POST', headers: { Origin: 'https://example.com', 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    assert.equal(forbidden.status, 403);
  } finally { if (server) await close(server); await rm(dir, { recursive: true, force: true }); }
});

test('AI discussion carries prior turns and revised schedule into a complete outline', async () => {
  let request;
  const mock = http.createServer(async (req, res) => {
    let body = ''; for await (const c of req) body += c; request = JSON.parse(body);
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ reply: '已增加练习。你更偏向哪类应用？', outline }) } }] }));
  });
  try {
    const url = await serve(mock);
    const result = await discussPlan({ ...input, messages: [...input.messages, { role: 'assistant', text: '建议先学变量' }, { role: 'user', text: '增加练习' }] }, { apiKey: 'fixture', model: 'fixture', baseUrl: url }, new AbortController().signal);
    assert.equal(result.outline.lessons.length, 2);
    assert.match(request.messages[0].content, /2 节，每节 30 分钟/);
    assert.equal(request.messages.at(-1).content, '增加练习');
    assert.ok(request.messages.some(m => m.content === '建议先学变量'));
  } finally { await close(mock); }
});

test('planned teaching continues across batches, ends at duration budget and keeps answers separate', async () => {
  let request;
  const mock = http.createServer(async (req, res) => {
    let body = ''; for await (const c of req) body += c; request = JSON.parse(body);
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ beats: [{ speech: '解释变量和赋值。', blocks: [] }] }) } }] }));
  });
  try {
    const url = await serve(mock), config = { baseUrl: url, apiKey: 'fixture', model: 'fixture' };
    const base = { topic: 'Python', lessonPlan: { courseTitle: outline.title, lessonCount: 2, lessonIndex: 0, minutes: 30, lesson: outline.lessons[0], generatedCharacters: 0 } };
    const run = async input => { const events = []; await streamClassroom(input, config, new AbortController().signal, e => events.push(e)); return events.at(-1); };
    assert.equal((await run(base)).lessonComplete, false);
    assert.equal(JSON.parse(request.messages[1].content).lessonPlan.targetCharacters, 6600);
    assert.match(request.messages[0].content, /不要提前讲下一节/);
    assert.match(request.messages[0].content, /后续每段60到90字/);
    assert.doesNotMatch(request.messages[0].content, /180到280字/);
    assert.equal((await run({ ...base, lessonPlan: { ...base.lessonPlan, generatedCharacters: 6599 } })).lessonComplete, true);
    assert.equal((await run({ ...base, question: '什么是变量？' })).lessonComplete, true);
    assert.equal((await run({ topic: '旧版短课' })).lessonComplete, undefined);
  } finally { await close(mock); }
});
