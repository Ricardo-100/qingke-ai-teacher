// Local demo fixture: screenshots and layout checks never call an AI provider.
import { chromium } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
import ts from 'typescript';
import assert from 'node:assert/strict';
const source = await readFile(new URL('../src/demo.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { demoSlides } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const pages = demoSlides.map(slide => ({ ink: [], notes: [], beat: 0, messages: [] }));
const lesson = demoSlides[0].demoLesson;
pages[0] = {
  ink: lesson.beats.flatMap((beat, i) => beat.actions.map((action, j) => ({ ...action, id: `preview-${i}-${j}` }))),
  notes: ['平均变化率 = Δy / Δx\n让两点越来越近，就能从平均变化率走向瞬时变化率。'],
  beat: lesson.beats.length, lesson,
  messages: [
    { role: 'assistant', text: '我们从“变化有多快”开始。连接曲线上的两个点，得到割线；纵向变化量除以横向变化量，就是平均变化率。注意课件里浅黄色标出的比值。' },
    { role: 'user', text: '平均变化率和瞬时变化率有什么区别？' },
    { role: 'assistant', text: '想象开车：一段路程除以耗时，得到的是平均速度；速度表显示的当前读数，则描述某个瞬间。\n让曲线上的第二个点逐渐靠近第一个点，割线就越来越接近切线。切线的斜率，就是我们要理解的瞬时变化率。' },
  ],
};
const { createServer } = await import('../server/index.mjs');
const server = createServer(); let browser;
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(state => localStorage.setItem('qingke-session-v1', JSON.stringify(state)), { isDemo: true, documentName: '导数：理解变化的语言', current: 0, pages, learningSeconds: 135 });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.locator('.message.user').waitFor();
  await page.locator('#slide-image').evaluate(img => img.decode());
  await page.waitForTimeout(150);
  await mkdir('docs', { recursive: true });
  await page.screenshot({ path: 'docs/whiteboard-desktop.png' });
  await page.locator('#course-drawer').click();
  assert.equal(await page.locator('#upload-main').isVisible(), true);
  await page.keyboard.press('Escape');
  await page.locator('#chat-toggle').click();
  assert.equal(await page.locator('.teacher-panel').isVisible(), false);
  await page.locator('#chat-open').click();
  assert.equal(await page.locator('.teacher-panel').isVisible(), true);
  await page.locator('#zoom-in').click();
  await page.waitForTimeout(150);
  const image = await page.locator('#slide-image').boundingBox();
  const canvas = await page.locator('#annotation-canvas canvas').first().boundingBox();
  assert.ok(Math.abs(image.width - canvas.width) < 1 && Math.abs(image.height - canvas.height) < 1);
  await page.locator('#zoom-reset').click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(150);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: 'docs/whiteboard-mobile.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log('Whiteboard checks passed: drawer, chat, zoom alignment, desktop and mobile layout.');
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
