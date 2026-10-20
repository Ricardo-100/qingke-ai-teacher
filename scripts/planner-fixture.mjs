// Planning UI fixture shared by the classroom/latency regressions. No disk or paid calls.
export async function startPlannedLesson(page, topic) {
  let saved;
  await page.route('**/api/course-plans**', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: saved ? [saved] : [] });
    const input = route.request().postDataJSON();
    if (route.request().url().endsWith('/discuss')) return route.fulfill({ json: { reply: '已准备课程大纲。', lessonCount: 1, minutesPerLesson: 5, outline: { title: topic, goal: '课堂回归验证', lessons: [{ title: '概念与例子', objectives: '理解核心概念', sections: ['概念', '例子', '练习', '总结'] }] } } });
    saved = { ...input, id: '00000000-0000-4000-8000-000000000001', updatedAt: '2026-10-20T00:00:00.000Z' };
    return route.fulfill({ json: saved });
  });
  if (await page.locator('#new-course').isVisible()) await page.locator('#new-course').click();
  await page.locator('#home-plan').click();
  await page.locator('#plan-count').fill('1'); await page.locator('#plan-minutes').fill('5');
  await page.locator('#plan-message').fill(topic); await page.locator('#plan-discuss').click();
  await page.locator('#plan-preview h3').waitFor(); await page.locator('#plan-save').click();
  await page.locator('[data-lesson="0"]').click(); await page.locator('#play').click();
}
