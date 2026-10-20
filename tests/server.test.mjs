import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseEnv } from 'node:util';

// Never load the developer's real model credentials in a fixture test.
process.env.AI_API_KEY = ''; process.env.AI_MODEL = ''; process.env.TTS_API_KEY = '';
const { createServer } = await import('../server/index.mjs');
test('server hides secrets, rejects foreign origins, and validates the real model roundtrip', async () => {
  let received, speechRequests = 0;
  const upstream = http.createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    received = { path: req.url, auth: req.headers.authorization, body: JSON.parse(body) };
    if (req.url.endsWith('/audio/speech')) { speechRequests++; res.setHeader('Content-Type', 'audio/mpeg'); res.end(Buffer.from('mock-mp3')); return; }
    res.setHeader('Content-Type', 'application/json');
    if (received.body.messages[1].content?.[0]?.type === 'image_url') { res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ targets: [{ text: '扫描公式', x: .42, y: .55, w: .3, h: .06 }] }) } }] })); return; }
    const user = received.body.messages[1].content;
    const source = JSON.parse(typeof user === 'string' ? user : user[0].text);
    res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ beats: [{ speech: '这是测试服务生成的讲解', actions: [{ type: 'underline', targetId: source.targets[0]?.id || 't0' }, { type: 'circle', x: .8, y: .1, w: .1, h: .1 }], board: '补充内容' }] }) } }] }));
  });
  const directory = mkdtempSync(join(tmpdir(), 'qingke-server-'));
  const envFile = join(directory, '.env');
  const server = createServer({ envFile });
  await new Promise(r => upstream.listen(0, '127.0.0.1', r));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, value, origin = 'http://127.0.0.1:5173') => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(value) });
  try {
    const missing = await post('/api/lesson', { text: 'test' }); assert.equal(missing.status, 409);
    const foreign = await post('/api/config', {}, 'https://untrusted.example'); assert.equal(foreign.status, 403);
    const unsafe = await post('/api/config', { baseUrl: 'http://remote.example/v1', model: 'test' }); assert.equal(unsafe.status, 400);
    const response = await post('/api/config', { baseUrl: `http://127.0.0.1:${upstream.address().port}/v1`, model: 'test-model', apiKey: 'test-key-only', vision: true });
    assert.equal(response.status, 200); assert.equal((await response.json()).configured, true);
    const published = await (await fetch(base + '/api/config')).text(); assert.ok(!published.includes('test-key-only'));
    assert.equal(parseEnv(readFileSync(envFile, 'utf8')).AI_API_KEY, 'test-key-only');
    const lesson = await post('/api/lesson', { text: '测试课件', page: 1, targets: [{ id: 't0', x: .1, y: .2, w: .3, h: .1, text: '公式' }], image: 'data:image/png;base64,AAAA' });
    assert.equal(lesson.status, 200); const result = await lesson.json();
    assert.equal(result.source, 'ai'); assert.equal(result.beats[0].actions[0].x, .1);
    assert.equal(received.path, '/v1/chat/completions'); assert.equal(received.auth, 'Bearer test-key-only');
    assert.equal(received.body.messages[1].content[1].type, 'image_url');
    const scan = await fetch(base + '/api/lesson', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' }, body: JSON.stringify({ text: '', targets: [], image: 'data:image/png;base64,AAAA' }) });
    const events = (await scan.text()).trim().split('\n').map(JSON.parse);
    assert.deepEqual(events.filter(e => e.type === 'progress').map(e => e.stage), ['preparing', 'locating', 'generating', 'validating']);
    const grounded = events.find(e => e.type === 'result').lesson.beats[0].actions;
    assert.equal(grounded.length, 1); assert.equal(grounded[0].x, .42); assert.equal(grounded[0].targetId, 'vision-0');
    const tts = await post('/api/tts/config', { baseUrl: `http://127.0.0.1:${upstream.address().port}/v1`, model: 'test-speech', voice: 'test-voice', apiKey: 'tts-secret' });
    assert.equal(tts.status, 200); assert.ok(!(await tts.text()).includes('tts-secret'));
    const audio = await post('/api/tts', { text: 'Rij', speed: 1.2 });
    assert.equal(audio.headers.get('content-type'), 'audio/mpeg'); assert.equal(await audio.text(), 'mock-mp3');
    assert.equal(received.auth, 'Bearer tts-secret'); assert.equal(received.body.input, 'Rij'); assert.equal(received.body.voice, 'test-voice');
    const repeated = await post('/api/tts', { text: 'Rij', speed: 1.2 });
    assert.equal(await repeated.text(), 'mock-mp3'); assert.equal(speechRequests, 1);
    await post('/api/tts/config', { baseUrl: `http://127.0.0.1:${upstream.address().port}/v1`, model: 'test-speech', voice: 'test-voice' });
    await (await post('/api/tts', { text: 'Rij', speed: 1.2 })).arrayBuffer(); assert.equal(speechRequests, 1);
    await (await post('/api/tts', { text: 'Rij', speed: 1.5 })).arrayBuffer(); assert.equal(speechRequests, 2);
    await post('/api/tts/config', { baseUrl: `http://127.0.0.1:${upstream.address().port}/v1`, model: 'test-speech', voice: 'new-voice' });
    const saved = parseEnv(readFileSync(envFile, 'utf8'));
    assert.equal(saved.AI_API_KEY, 'test-key-only');
    assert.equal(saved.TTS_API_KEY, 'tts-secret');
    assert.equal(saved.TTS_VOICE, 'new-voice');
    await (await post('/api/tts', { text: 'Rij', speed: 1.2 })).arrayBuffer(); assert.equal(speechRequests, 3);
    const { existsSync } = await import('node:fs');
    if (existsSync(new URL('../dist/index.html', import.meta.url))) {
      const html = await fetch(base + '/'); assert.equal(html.status, 200);
      const htmlText = await html.text(); assert.ok(htmlText.includes('青课'));
      const { readdir } = await import('node:fs/promises');
      const worker = (await readdir(new URL('../dist/assets/', import.meta.url))).find(f => f.startsWith('pdf.worker') && f.endsWith('.mjs'));
      if (worker) { const asset = await fetch(base + '/assets/' + worker, { method: 'HEAD' }); assert.equal(asset.headers.get('content-type'), 'text/javascript'); }
    }
  } finally { await new Promise(r => server.close(r)); await new Promise(r => upstream.close(r)); rmSync(directory, { recursive: true, force: true }); }
});
