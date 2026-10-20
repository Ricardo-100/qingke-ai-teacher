// Exercise a 30-second model delay while the preceding audio is still playing.
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { createServer } from '../server/index.mjs';
import { startPlannedLesson } from './planner-fixture.mjs';

const server = createServer();
let browser, release;
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    window.__voices = [];
    window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
    Object.defineProperty(window, 'speechSynthesis', { value: {
      getVoices: () => [], addEventListener() {}, cancel() {}, pause() {}, resume() {},
      speak(voice) { window.__voices.push(voice); voice.onstart?.(); },
    } });
  });
  await page.route('**/api/config', route => route.fulfill({ json: { configured: true, model: 'fixture' } }));
  let requests = 0, secondStarted;
  const requested = new Promise(resolve => { secondStarted = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/api/classroom', async route => {
    const input = route.request().postDataJSON();
    const batch = ++requests;
    if (batch === 2) {
      assert.ok(input.preparedSegments.includes('第一部分正在讲解。'));
      assert.ok(input.lessonPlan.generatedCharacters > 0);
      secondStarted();
      await gate;
    }
    assert.ok(batch <= 2, 'do not request beyond lesson completion');
    await route.fulfill({ contentType: 'application/x-ndjson', body: [
      { type: 'beat', beat: { speech: batch === 1 ? '第一部分正在讲解。' : '第二部分继续讲解。', blocks: [{ type: 'text', text: `第${batch}部分` }] } },
      { type: 'done', lessonComplete: batch === 2 },
    ].map(event => JSON.stringify(event)).join('\n') + '\n' });
  });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await startPlannedLesson(page, '分段缓冲验证');
  await page.waitForFunction(() => window.__voices.length === 1);
  await Promise.race([requested, new Promise((_, reject) => setTimeout(() => reject(new Error('continuation was not requested during playback')), 5000))]);
  assert.equal(await page.locator('.board-entry').count(), 1);
  console.log('Continuation requested while first section is playing; holding model response for 30 seconds.');
  await new Promise(resolve => setTimeout(resolve, 30000));
  assert.match(await page.locator('#state-label').innerText(), /老师正在讲解/);
  release();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('qingke-whiteboard-v2')).course.beats.length === 2);
  const gap = await page.evaluate(async () => {
    const started = performance.now();
    window.__voices[0].onend();
    while (window.__voices.length < 2) await new Promise(resolve => setTimeout(resolve, 10));
    return performance.now() - started;
  });
  assert.ok(gap < 5000, `section transition took ${gap} ms`);
  await page.waitForFunction(() => document.querySelectorAll('.board-entry').length === 2);
  await page.evaluate(() => window.__voices[1].onend());
  await page.waitForFunction(() => document.querySelector('#state-label').textContent.includes('完成'));
  assert.equal(requests, 2);
  assert.deepEqual(errors, []);
  console.log(`Buffer check passed: 30-second generation overlapped playback; transition ${Math.round(gap)} ms (target <5000 ms), no skipped or duplicate sections.`);
} finally {
  release?.();
  await browser?.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
