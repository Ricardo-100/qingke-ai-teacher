// End-to-end streaming with local model/TTS fixtures; no external or paid requests.
import http from 'node:http';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { createServer } from '../server/index.mjs';
import { startPlannedLesson } from './planner-fixture.mjs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let releaseBoard, boardGate;
function holdBoard() { boardGate = new Promise(resolve => { releaseBoard = resolve; }); }
holdBoard();
const synthesized = [];
const first = '先给你核心答案。', second = '下面用例子展开讲解。';
const upstream = http.createServer(async (req, res) => {
  let body = ''; for await (const chunk of req) body += chunk;
  if (req.url === '/v1/audio/speech') {
    synthesized.push(JSON.parse(body).input);
    res.writeHead(200, { 'Content-Type': 'audio/mpeg' }); res.end('fixture-audio'); return;
  }
  assert.equal(req.url, '/v1/chat/completions');
  res.writeHead(200, { 'Content-Type': 'text/event-stream' });
  const write = content => res.write('data: ' + JSON.stringify({ choices: [{ delta: { content } }] }) + '\n\n');
  write('{"beats":[{"speech":' + JSON.stringify(first));
  await boardGate;
  write(',"blocks":[{"type":"text","text":"首段重点"}]},' + JSON.stringify({ speech: second, blocks: [{ type: 'text', text: '后续例子' }] }) + ']}');
  res.end('data: [DONE]\n\n');
});
const fixtureDirectory = await mkdtemp(join(tmpdir(), 'qingke-latency-'));
const server = createServer({ envFile: join(fixtureDirectory, '.env') }); let browser;
// The fixture listens on an ephemeral port; emulate the supported development UI origin.
server.prependListener('request', req => { if (req.headers.origin) req.headers.origin = 'http://127.0.0.1:5173'; });
try {
  await new Promise(r => upstream.listen(0, '127.0.0.1', r));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const baseUrl = `http://127.0.0.1:${upstream.address().port}/v1`;
  for (const [path, body] of [
    ['/api/config', { baseUrl, model: 'fixture', apiKey: 'local-test' }],
    ['/api/tts/config', { baseUrl, model: 'fixture', voice: 'fixture', apiKey: 'local-test' }],
  ]) {
    const response = await fetch(origin + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal(response.ok, true, await response.text());
  }
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    localStorage.setItem('qingke-speech-v1', JSON.stringify({ provider: 'api' }));
    window.__audio = [];
    window.Audio = class {
      constructor(src) { this.src = src; window.__audio.push(this); }
      play() { return Promise.resolve(); }
      pause() { this.paused = true; }
      removeAttribute() { this.src = ''; }
    };
  });
  const configured = page.waitForResponse(r => r.url().endsWith('/api/config'));
  await page.goto(origin);
  // Wait for configuration to load before opening a new live course.
  await configured;
  await startPlannedLesson(page, '快速响应测试');
  await page.waitForFunction(text => document.querySelector('#caption').textContent === text, first, { timeout: 5000 }).catch(async error => {
    console.error(await page.locator('#state-label').innerText(), await page.locator('#toast').innerText(), errors); throw error;
  });
  assert.equal(await page.locator('.board-entry').count(), 0, 'subtitle appears before any board data arrives');
  // The TTS request must finish while the model is still held at the board gate.
  await new Promise((resolve, reject) => {
    const end = Date.now() + 5000;
    const poll = () => synthesized.includes(first) ? resolve() : Date.now() > end ? reject(new Error('TTS did not overlap board generation')) : setTimeout(poll, 10);
    poll();
  });
  await page.waitForFunction(() => window.__audio.length === 1);
  assert.equal(await page.locator('.board-entry').count(), 0, 'speech starts while board generation is still blocked');
  releaseBoard();
  await page.locator('.board-entry').waitFor();
  await page.waitForFunction(() => window.__audio.length === 1);
  await new Promise((resolve, reject) => {
    const end = Date.now() + 5000;
    const poll = () => synthesized.includes(second) ? resolve() : Date.now() > end ? reject(new Error('Next beat did not prefetch')) : setTimeout(poll, 10);
    poll();
  });
  assert.deepEqual(synthesized, [first, second], 'each beat is synthesized once, before it needs to play');
  await page.evaluate(() => window.__audio[0].onended());
  await page.waitForFunction(() => window.__audio.length === 2);
  await page.waitForFunction(() => document.querySelectorAll('.board-entry').length === 2);
  holdBoard();
  await page.locator('#question').fill('   ');
  await page.locator('#send').click();
  assert.notEqual(await page.evaluate(() => window.__audio[1].paused), true, 'empty submissions preserve playback');
  await page.locator('#question').fill('为什么？');
  assert.match(await page.locator('#state-label').innerText(), /老师正在讲解/);
  assert.notEqual(await page.evaluate(() => window.__audio[1].paused), true, 'focus and typing preserve playback');
  await page.locator('#question').press('Shift+Enter');
  assert.notEqual(await page.evaluate(() => window.__audio[1].paused), true, 'newlines preserve playback');
  await page.locator('#question').press('Enter');
  assert.equal(await page.evaluate(() => window.__audio[1].paused), true, 'sending stops the old audio immediately');
  await page.waitForFunction(() => window.__audio.length === 3);
  assert.equal(await page.locator('.answer-entry').count(), 0, 'answer speech starts before answer board generation');
  await page.evaluate(() => window.__audio[2].onended());
  releaseBoard();
  await page.locator('.answer-entry').waitFor();
  await page.waitForFunction(() => window.__audio.length === 4);
  assert.equal(await page.locator('.answer-entry').count(), 2, 'late board is recorded once after early speech ends');
  assert.deepEqual(synthesized, [first, second], 'repeat text uses the audio cache without duplicate synthesis');
  holdBoard();
  await page.locator('#question').fill('再解释一下');
  await page.locator('#send').click();
  assert.equal(await page.evaluate(() => window.__audio[3].paused), true, 'send button also interrupts immediately');
  await page.waitForFunction(() => window.__audio.length === 5);
  await page.locator('#interrupt').click();
  assert.equal(await page.evaluate(() => window.__audio[4].paused), true, 'pause cancels early speech before its board arrives');
  releaseBoard();
  assert.deepEqual(errors, []);
  console.log('Latency checks passed: focus/typing do not pause, sending interrupts immediately, speech starts before board generation, late boards attach once, no duplicate synthesis, pause stops audio.');
} finally {
  releaseBoard(); await browser?.close();
  server.closeAllConnections(); upstream.closeAllConnections();
  await Promise.all([new Promise(r => server.close(r)), new Promise(r => upstream.close(r))]);
  await rm(fixtureDirectory, { recursive: true, force: true });
}
