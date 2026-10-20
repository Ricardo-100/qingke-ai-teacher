export type CourseOutline = { title: string; goal: string; lessons: { title: string; objectives: string; sections: string[] }[] };
export type CoursePlan = { id: string; lessonCount: number; minutesPerLesson: number; outline: CourseOutline; messages: { role: 'user' | 'assistant'; text: string }[]; updatedAt: string };

export function mountCoursePlanner(options: { pause(): void; home(): void; connected(): boolean; settings(): void; toast(message: string): void; launch(plan: CoursePlan, index: number): void }) {
  const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
  const root = document.querySelector<HTMLElement>('#home-page')!;
  const dialog = document.createElement('section'); dialog.id = 'planner-dialog';
  dialog.innerHTML = `<div class="dialog-heading"><h2>和 AI，一起规划课程</h2><button id="planner-close" aria-label="收起课程规划">收起 −</button></div>
    <p>说说你的基础和学习目标。大纲可以反复讨论，满意之后，再存进自己的课程库。</p>
    <button id="planner-new" class="planner-secondary">规划另一门课程</button>
    <form id="planner-form"><div class="schedule-row"><label>课程节数<input id="plan-count" type="number" min="1" max="40" value="8" required></label><label>每节分钟数<input id="plan-minutes" type="number" min="5" max="120" value="30" required></label></div><p id="plan-total"></p>
    <div id="plan-discussion" role="log" aria-live="polite"></div><label>与 AI 讨论<textarea id="plan-message" rows="3" maxlength="4000" placeholder="例如：我零基础，想系统学 Python，重点讲实际应用。先帮我看看课程该怎么安排。" required></textarea></label><button class="primary" id="plan-discuss" type="submit">讨论并生成大纲</button></form>
    <p id="plan-error" role="alert"></p><div id="plan-preview"></div><div class="planner-actions"><button id="plan-save" class="primary" disabled>保存大纲到本地</button><span id="plan-saved" role="status"></span></div>
    <p class="planner-footnote">课时为预计学习时间，会随语速、提问和练习变化。</p>`;
  root.querySelector('#home-planner')!.append(dialog);
  root.querySelector('#home-library-content')!.innerHTML = '<div id="plan-library" aria-live="polite"><p>正在读取本地课程…</p></div>';
  const $ = <T extends HTMLElement = HTMLElement>(s: string) => root.querySelector<T>(s)!;
  let draft: Partial<CoursePlan> = {}, plans: CoursePlan[] = [], busy = false;
  try { draft = JSON.parse(localStorage.getItem('qingke-plan-draft') || '{}'); } catch { /* Start a new draft. */ }
  const count = $<HTMLInputElement>('#plan-count'), minutes = $<HTMLInputElement>('#plan-minutes'), message = $<HTMLTextAreaElement>('#plan-message');
  count.value = String(draft.lessonCount || 8); minutes.value = String(draft.minutesPerLesson || 30);
  const persist = () => { try { localStorage.setItem('qingke-plan-draft', JSON.stringify(draft)); } catch { options.toast('规划草稿暂时无法保存到浏览器，请及时保存大纲到本地'); } };
  async function api(path: string, value?: unknown) {
    const response = await fetch(path, value === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || '课程服务连接失败'); return data;
  }
  function render() {
    $('#plan-total').textContent = `共 ${count.value} 节 × ${minutes.value} 分钟 = ${Number(count.value) * Number(minutes.value)} 分钟`;
    $('#plan-discussion').innerHTML = (draft.messages || []).map(m => `<article class="message ${m.role}"><span>${m.role === 'user' ? '你' : '课程规划老师'}</span><p>${esc(m.text).replace(/\n/g, '<br>')}</p></article>`).join('');
    $('#plan-preview').innerHTML = draft.outline ? `<h3>${esc(draft.outline.title)}</h3><p>${esc(draft.outline.goal)}</p><ol>${draft.outline.lessons.map(l => `<li><strong>${esc(l.title)}</strong><p>${esc(l.objectives)}</p><ul>${l.sections.map(s => `<li>${esc(s)}</li>`).join('')}</ul></li>`).join('')}</ol>` : '';
    $<HTMLButtonElement>('#plan-save').disabled = busy || !draft.outline || draft.lessonCount !== Number(count.value) || draft.minutesPerLesson !== Number(minutes.value);
    $<HTMLButtonElement>('#plan-discuss').disabled = busy;
    $('#plan-discuss').textContent = busy ? '正在整理课程…' : draft.outline ? '继续讨论并更新大纲' : '讨论并生成大纲';
    for (const input of [count, minutes, message]) input.disabled = busy;
    $<HTMLButtonElement>('#planner-new').disabled = busy;
    for (const button of root.querySelectorAll<HTMLButtonElement>('#plan-library button')) button.disabled = busy;
  }
  function library() {
    $('#plan-library').innerHTML = plans.length ? plans.map(p => `<article class="saved-plan"><strong>${esc(p.outline.title)}</strong><p>${p.lessonCount} 节 · 每节 ${p.minutesPerLesson} 分钟 · 共 ${p.lessonCount * p.minutesPerLesson} 分钟</p><button class="planner-secondary" data-edit="${p.id}">查看 / 继续讨论</button><button class="planner-secondary" data-export="${p.id}">导出大纲</button><ol>${p.outline.lessons.map((l, i) => `<li><span>${esc(l.title)}</span><button class="planner-secondary" data-plan="${p.id}" data-lesson="${i}">进入第 ${i + 1} 节</button></li>`).join('')}</ol></article>`).join('') : '<p>还没有保存的大纲。和 AI 讨论完成后，点击“保存大纲到本地”。</p>';
  }
  function reset(seed = '') { draft = {}; count.value = '8'; minutes.value = '30'; message.value = seed; $('#plan-saved').textContent = ''; $('#plan-error').textContent = ''; persist(); render(); }
  $('#planner-new').onclick = () => reset();
  $('#planner-close').onclick = () => { dialog.hidden = true; };
  count.oninput = minutes.oninput = () => { $('#plan-saved').textContent = '课时已修改，请让 AI 更新大纲后再保存'; render(); };
  $('#planner-form').onsubmit = async e => {
    e.preventDefault(); if (busy) return;
    if (!options.connected()) { options.settings(); options.toast('连接模型后，即可继续讨论大纲'); return; }
    const text = message.value.trim(); if (!text) return;
    busy = true; $('#plan-error').textContent = ''; $('#plan-saved').textContent = '';
    const messages = [...(draft.messages || []), { role: 'user' as const, text }]; render();
    try {
      const result = await api('/api/course-plans/discuss', { messages, outline: draft.outline, lessonCount: Number(count.value), minutesPerLesson: Number(minutes.value) });
      draft = { ...draft, ...result, messages: [...messages, { role: 'assistant', text: result.reply }] };
      message.value = ''; persist();
    } catch (error) { $('#plan-error').textContent = error instanceof Error ? error.message : '讨论失败，请重试'; }
    finally { busy = false; render(); $('#plan-discussion').scrollTop = $('#plan-discussion').scrollHeight; }
  };
  $('#plan-save').onclick = async () => {
    if (busy || !draft.outline) return;
    busy = true; render(); $('#plan-error').textContent = '';
    try {
      const saved: CoursePlan = await api('/api/course-plans', draft); draft = saved; persist();
      plans = [saved, ...plans.filter(p => p.id !== saved.id)]; library(); $('#plan-saved').textContent = '已保存到本地，随时可以选课上课';
    } catch (error) { $('#plan-error').textContent = error instanceof Error ? error.message : '保存失败'; }
    finally { busy = false; render(); }
  };
  $('#plan-library').onclick = e => {
    if (busy) return;
    const button = (e.target as HTMLElement).closest<HTMLButtonElement>('button'); if (!button) return;
    const plan = plans.find(p => p.id === (button.dataset.plan || button.dataset.edit || button.dataset.export)); if (!plan) return;
    if (button.dataset.edit) {
      draft = structuredClone(plan); count.value = String(plan.lessonCount); minutes.value = String(plan.minutesPerLesson); message.value = ''; $('#plan-saved').textContent = '已读取本地大纲'; persist(); render(); dialog.hidden = false; dialog.scrollIntoView({ block: 'start', behavior: 'smooth' });
    } else if (button.dataset.export) {
      const url = URL.createObjectURL(new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = `${plan.outline.title.replace(/[<>:"/\\|?*]/g, '_')}.json`; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } else { options.launch(structuredClone(plan), Number(button.dataset.lesson)); }
  };
  render();
  const refresh = async () => {
    try { plans = await api('/api/course-plans'); library(); render(); } catch { $('#plan-library').textContent = '本地课程库读取失败，请确认服务已启动后重新打开。'; }
  };
  return Object.assign(async (seed = '') => {
    options.pause(); options.home(); if (seed && !busy) reset(seed);
    dialog.hidden = false; dialog.scrollIntoView({ block: 'start', behavior: 'smooth' });
    await refresh();
  }, { refresh });
}
