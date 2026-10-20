import './classroom.css';
import { createIcons, X, Minus, Plus, Settings2, MessageCircle, Volume2, VolumeX, Mic, ArrowUp, Play, Pause, ChevronRight, RotateCcw, PanelRightClose } from 'lucide';
import { LessonPlayer } from './player';
import { mountSpeechSettings } from './tts-settings';
import { demoCourse, demoReply } from './classroom-demo';
import { mountCoursePlanner, type CoursePlan } from './course-planner';
import { mountHome } from './home';
import type { BoardBlock, ClassBeat, Track, Turn, BoardEntry } from './classroom-types';

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s)!;
const esc = (v: string) => v.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const ico = (s: string) => `<i data-lucide="${s}"></i>`;
const icons = () => createIcons({ icons: { X, Minus, Plus, Settings2, MessageCircle, Volume2, VolumeX, Mic, ArrowUp, Play, Pause, ChevronRight, RotateCcw, PanelRightClose } });
const track = (): Track => ({ id: crypto.randomUUID(), beats: [], cursor: 0, done: false });
let course = track(), answer: Track | null = null, topic = '什么是机器学习？', demo = true;
let entries: BoardEntry[] = [], history: Turn[] = [];
let selectedPlan: CoursePlan | null = null, lessonIndex = 0;
let state: 'idle' | 'playing' | 'paused' | 'thinking' | 'question' | 'answer-done' | 'complete' = 'idle';
let config = { configured: false, model: '', baseUrl: 'https://api.openai.com/v1' };
let epoch = 0, controller: AbortController | null = null, zoom = 100, caption = '', running = false;
const player = new LessonPlayer();
try {
  const saved = JSON.parse(localStorage.getItem('qingke-whiteboard-v2') || 'null');
  if (saved && typeof saved.topic === 'string' && Array.isArray(saved.entries) && Array.isArray(saved.history) && Array.isArray(saved.course?.beats)) {
    topic = saved.topic; demo = saved.demo === true; course = saved.course; answer = saved.answer || null; entries = saved.entries; history = saved.history;
    selectedPlan = saved.selectedPlan || null; lessonIndex = saved.lessonIndex || 0;
    state = 'paused';
  }
} catch { /* Start a fresh board if local data is unavailable. */ }

$('#app').innerHTML = `
  <main class="classroom">
    <header class="course-pill"><button id="new-course" class="round" title="开始新课程" aria-label="开始新课程">${ico('x')}</button><button id="topic-open" class="topic-pill"><span id="topic-name"></span><span class="equalizer"><b></b><b></b><b></b></span></button><span id="mode" class="mode"></span></header>
    <nav class="board-nav" aria-label="白板控制"><button id="zoom-out" title="缩小白板" aria-label="缩小白板">${ico('minus')}</button><button id="zoom-reset">100%</button><button id="zoom-in" title="放大白板" aria-label="放大白板">${ico('plus')}</button><span class="divider"></span><span class="page-number">1 / 1</span><span class="divider"></span><button id="settings-open" title="连接 AI 模型" aria-label="连接 AI 模型">${ico('settings-2')}</button><button id="chat-open" title="显示对话历史" aria-label="显示对话历史">${ico('message-circle')}</button></nav>
    <section id="board-viewport" aria-label="课堂大白板"><div id="whiteboard"><div id="board-content"></div><div id="board-welcome"><span class="welcome-overline">一块白板，一起想明白。</span><h1>你想学点什么？</h1><p>我来讲，也把重点写下来。<br>不明白时，随时打断我。</p><form id="topic-form"><input id="topic-input" aria-label="课程主题" maxlength="300" placeholder="例如：什么是机器学习？"/><button type="submit" title="开始这节课" aria-label="开始这节课">${ico('arrow-up')}</button></form><button id="demo-start" class="demo-link">先体验「什么是机器学习」 ${ico('chevron-right')}</button><small id="welcome-hint">内置演示无需密钥 · 自选主题需连接模型</small></div></div></section>
    <div class="bottom-controls"><div class="voice-controls"><button id="voice" class="round" title="关闭讲解语音" aria-label="关闭讲解语音">${ico('volume-2')}</button></div><button id="play" class="play-control">${ico('play')}开始讲解</button><span id="state-label" role="status"></span></div>
    <div id="caption" class="caption" aria-live="off"></div><button id="reopen-chat" class="round" title="打开对话历史" aria-label="打开对话历史">${ico('message-circle')}</button>
  </main>
  <aside class="conversation" aria-label="对话历史"><header><h2>${ico('message-circle')}对话历史</h2><button id="chat-close" class="icon-button" title="收起对话" aria-label="收起对话">${ico('x')}</button></header><div id="messages" role="log" aria-live="polite"></div><div class="composer-area"><div class="context-tip" id="context-tip">讲解时可以随时插话，已有板书会保留</div><button id="resume" class="resume-button" hidden>${ico('play')}继续原课</button><div id="recognition-preview" aria-live="polite"></div><form id="ask-form"><textarea id="question" rows="1" aria-label="向老师提问" placeholder="输入问题，随时打断…" maxlength="2000"></textarea><div class="composer-actions"><button type="button" id="mic" title="开启语音插话" aria-label="开启语音插话">${ico('mic')}</button><button type="button" id="interrupt" title="暂停讲解，提问" aria-label="暂停讲解，提问">${ico('pause')}</button><button id="send" type="submit" title="发送问题" aria-label="发送问题">${ico('arrow-up')}</button></div></form><span id="mic-hint">语音插话默认关闭</span></div></aside>
  <dialog id="settings-dialog"><form id="settings-form"><div class="dialog-heading"><h2>连接 AI 老师</h2><button type="button" id="settings-close" aria-label="关闭设置">✕</button></div><p>兼容 Chat Completions 的模型服务。密钥保存在本地 .env，重启后自动恢复。讲解主题、对话和板书会发送至此服务。</p><label>服务地址<input id="base-url" type="url" required/></label><label>模型名称<input id="model-name" required/></label><label>API 密钥<input id="api-key" type="password" autocomplete="off" placeholder="留空保留已有密钥"/></label><p id="settings-error" role="alert"></p><button type="submit" class="primary">保存连接</button></form></dialog>
  <div id="toast" role="status"></div>`;
const plannerButton = document.createElement('button'); plannerButton.id = 'curriculum-open'; plannerButton.textContent = '课程大纲'; plannerButton.title = '讨论大纲与读取本地课程'; $('#board-welcome').append(plannerButton);
const nextButton = document.createElement('button'); nextButton.id = 'next-lesson'; nextButton.className = 'play-control'; nextButton.textContent = '进入下一节'; nextButton.hidden = true; $('.bottom-controls').append(nextButton);
$('#new-course').title = '返回首页'; $('#new-course').setAttribute('aria-label', '返回首页'); $('#new-course').classList.add('home-return'); $('#new-course').innerHTML = '⌂';
$('#topic-open').title = '打开课程大纲与本地课程库';
$('#board-welcome p').innerHTML = '先聊学习目标，一起安排课程大纲。<br>保存到本地，准备好时再来上课。';
$('#topic-form button').title = '开始讨论课程大纲'; $('#topic-form button').setAttribute('aria-label', '开始讨论课程大纲');
plannerButton.textContent = '课程大纲 · 本地课程库';
mountHome();

function showClassroom() {
  document.body.classList.remove('home-mode');
  if (location.hash !== '#classroom') historyURL('classroom');
}
function historyURL(page: string) { window.history.pushState(null, '', `#${page}`); }
function showHome() {
  // Returning home ends listening as well as playback; the saved lesson stays paused.
  pause(); micOn = false; window.clearTimeout(restartTimer); recognition?.abort(); micUI();
  document.body.classList.add('home-mode');
  if (location.hash !== '#home') historyURL('home');
  renderHome();
}
function renderHome() {
  const hasLesson = Boolean(selectedPlan) || course.beats.length > 0;
  $('#home-continue').hidden = !hasLesson;
  $('#home-current-title').textContent = topic;
  $('#home-current-progress').textContent = `${selectedPlan ? `第 ${lessonIndex + 1} / ${selectedPlan.lessonCount} 节 · ` : demo ? '内置演示 · ' : 'AI 课堂 · '}已学习 ${course.cursor} 段讲解，白板与对话已保留`;
  $('#home-model-status').textContent = config.configured ? 'AI 老师已连接，可以开始规划课程' : '连接 AI 模型后可规划课程 · 演示课无需连接';
  $('#home-model-status').classList.toggle('connected', config.configured);
}

function toast(message: string) { $('#toast').textContent = message; $('#toast').classList.add('visible'); window.setTimeout(() => $('#toast').classList.remove('visible'), 6000); }
let warned = false;
function save() {
  try {
    const snapshot = { topic, demo, course, answer, entries, history, selectedPlan, lessonIndex };
    localStorage.setItem('qingke-whiteboard-v2', JSON.stringify(snapshot));
    if (selectedPlan) localStorage.setItem(`qingke-lesson-${selectedPlan.id}-${lessonIndex}`, JSON.stringify(snapshot));
  }
  catch { if (!warned) { warned = true; toast('浏览器存储空间不足，课堂进度暂时无法保存'); } }
}
function blockHTML(b: BoardBlock) {
  const title = b.title ? `<h3>${esc(b.title)}</h3>` : '';
  if (b.type === 'table') return `${title}<div class="table-scroll"><table><thead><tr>${b.headers!.map(v => `<th>${esc(v)}</th>`).join('')}</tr></thead><tbody>${b.rows!.map(row => `<tr>${row.map(v => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  if (b.type === 'flow') return `${title}<div class="flow">${b.nodes!.map((v, i) => `${i ? '<span class="flow-arrow" aria-hidden="true">⟶</span>' : ''}<span class="flow-node">${esc(v)}</span>`).join('')}</div>`;
  if (b.type === 'heading') return `<h2><span>${esc(b.text || b.title || '')}</span></h2>`;
  return `${title}<p class="${b.type === 'formula' ? 'formula' : 'board-text'}">${esc(b.text || '').replace(/\n/g, '<br>')}</p>`;
}
function renderBoard() {
  $('#board-content').innerHTML = entries.map(e => `<section class="board-entry ${e.answer ? 'answer-entry' : ''}" data-entry="${esc(e.id)}">${e.blocks.map(b => `<div class="board-block">${blockHTML(b)}</div>`).join('')}</section>`).join('');
  $('#board-welcome').hidden = Boolean(selectedPlan) || entries.length > 0 || course.beats.length > 0;
}
function renderHistory() {
  $('#messages').innerHTML = history.length ? history.map(m => `<article class="message ${m.role}"><span>${m.role === 'user' ? '你' : '老师讲解'}</span><p>${esc(m.text).replace(/\n/g, '<br>')}</p></article>`).join('') : '<div class="chat-welcome"><span class="chat-dot"></span><p>老师已经准备好了。<br>从一个好奇的问题开始吧。</p><small>讲解、板书、提问，都在这里接起来。</small></div>';
  $('#messages').scrollTop = $('#messages').scrollHeight;
}
function update() {
  renderHome();
  $('#topic-name').textContent = topic;
  nextButton.hidden = !selectedPlan || lessonIndex >= selectedPlan.outline.lessons.length - 1 || state !== 'complete';
  $('.page-number').textContent = selectedPlan ? `${lessonIndex + 1} / ${selectedPlan.lessonCount}` : '1 / 1';
  $('#mode').textContent = demo ? '内置演示' : config.configured ? 'AI 课堂' : '待连接模型';
  $('#context-tip').textContent = demo ? '内置演示：预写讲解与示例补讲 · 可随时打断' : '讲解时可以随时插话，已有板书会保留';
  $('#play').innerHTML = `${ico(running ? 'pause' : 'play')}${running ? state === 'thinking' ? '暂停等待' : '暂停讲解' : state === 'answer-done' ? '继续原课' : state === 'complete' ? '课程已讲完' : state === 'idle' ? '开始讲解' : '继续讲解'}`;
  $('#play').toggleAttribute('disabled', state === 'complete');
  $('#state-label').textContent = ({ idle: '随时可以打断', playing: answer ? '正在回答你的问题' : '老师正在讲解', paused: '已暂停 · 板书已保留', thinking: '正在思考，板书会逐步展开', question: '我在听，请说', 'answer-done': '问题讲完了，回到刚才的课程吧', complete: '本节课讲解完成，欢迎继续提问' })[state];
  $('#resume').hidden = !answer && state !== 'answer-done';
  document.body.classList.toggle('speaking', running && state === 'playing');
  $('#caption').textContent = caption;
  $('#voice').innerHTML = ico(player.voiceEnabled ? 'volume-2' : 'volume-x');
  $('#voice').setAttribute('aria-label', player.voiceEnabled ? '关闭讲解语音' : '开启讲解语音');
  icons();
}
function stop() {
  epoch++; controller?.abort(); controller = null; player.cancel(); running = false;
}
function pause(forQuestion = false) { stop(); state = forQuestion ? 'question' : 'paused'; update(); save(); }
function record(beat: ClassBeat, active: Track, index = active.cursor) {
  const id = `${active.id}-${index}`;
  if (!entries.some(e => e.id === id)) {
    entries.push({ id, blocks: beat.blocks, answer: active !== course });
    history.push({ id, role: 'assistant', text: beat.speech });
    const section = document.createElement('section'); section.className = `board-entry fresh ${active !== course ? 'answer-entry' : ''}`; section.dataset.entry = id;
    section.innerHTML = beat.blocks.map(b => `<div class="board-block">${blockHTML(b)}</div>`).join('');
    $('#board-content').append(section); $('#board-welcome').hidden = true;
    // Follow only when the student is already near the bottom; manual review stays undisturbed.
    const view = $('#board-viewport');
    if (view.scrollHeight - view.scrollTop - view.clientHeight < section.offsetHeight + 220) section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    renderHistory(); save();
  }
}
function prepareContinuation() {
  const active = answer || course;
  if (!running || demo || controller || active.done || active.failed) return;
  // Start the next batch with up to 90 seconds of queued speech still available.
  // Exclude the playing beat: its remaining duration is unknown. Only one request
  // may run at a time, and the queue budget bounds speculative generation.
  const queued = active.beats.slice(active.cursor + (player.active ? 1 : 0));
  const bufferedMs = queued.reduce((sum, beat) => sum + Math.max(3000, beat.speech.length * 130 / player.rate), 0);
  if (bufferedMs <= 90000) void generate(active, answer ? history.filter(m => m.role === 'user').at(-1)?.text : '');
}
function pump() {
  if (!running) return;
  prepareContinuation();
  if (player.active) return;
  const active = answer || course;
  if (active.cursor >= active.beats.length) {
    if (!active.done) {
      state = 'thinking'; update();
      if (!demo && !controller && !active.failed) void generate(active, answer ? history.filter(m => m.role === 'user').at(-1)?.text : '');
      return;
    }
    running = false; state = answer ? 'answer-done' : 'complete'; caption = ''; update(); save(); return;
  }
  const token = epoch, beat = active.beats[active.cursor]; state = 'playing'; caption = beat.speech; update();
  player.play({ speech: beat.speech, actions: [], board: '' }, () => {
    if (token !== epoch) return; record(beat, active);
  }, () => {
    if (token !== epoch) return; active.cursor++; save(); pump();
  });
  if (active.beats[active.cursor + 1]) player.prepare(active.beats[active.cursor + 1].speech);
}
async function generate(active: Track, question = '') {
  const token = epoch, request = new AbortController(); controller = request;
  const batchStart = active.beats.length;
  let early: { index: number; started: boolean; ended: boolean } | null = null;
  const timeout = window.setTimeout(() => request.abort(new Error('模型响应超时，请重试')), 95000);
  try {
    const response = await fetch('/api/classroom', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: request.signal,
      body: JSON.stringify({ topic, question, coursePosition: course.cursor, history: history.slice(-16), board: entries.slice(-24).flatMap(e => e.blocks), preparedSegments: active.beats.slice(-12).map(b => b.speech), continuing: active.beats.length > 0,
        lessonPlan: selectedPlan ? { courseTitle: selectedPlan.outline.title, goal: selectedPlan.outline.goal, lessonIndex, lessonCount: selectedPlan.lessonCount, minutes: selectedPlan.minutesPerLesson, lesson: selectedPlan.outline.lessons[lessonIndex], generatedCharacters: course.beats.reduce((sum, b) => sum + b.speech.length, 0) } : undefined }) });
    if (!response.ok || !response.body) throw new Error('课堂连接失败，请检查本机服务');
    const reader = response.body.getReader(), decoder = new TextDecoder(); let buffer = '', done = false;
    const consume = (line: string) => {
      if (!line.trim() || token !== epoch) return;
      const event = JSON.parse(line);
      if (event.type === 'error') throw new Error(event.error);
      if (event.type === 'speech' && batchStart + event.index === active.beats.length && batchStart + event.index <= active.cursor + 1) {
        player.prepare(event.speech);
        if (!player.active && active.cursor === active.beats.length) {
          // Speak as soon as the text is ready; board generation can finish in parallel.
          const preview = { index: active.cursor, started: false, ended: false }; early = preview;
          caption = event.speech; state = 'playing'; update();
          player.play({ speech: event.speech, actions: [], board: '' }, () => {
            if (token !== epoch) return;
            preview.started = true;
            if (active.beats[preview.index]) record(active.beats[preview.index], active, preview.index);
          }, () => {
            if (token !== epoch) return;
            preview.ended = true;
            if (active.beats[preview.index]) { active.cursor++; early = null; save(); pump(); }
            else { state = 'thinking'; update(); }
          });
        }
      }
      if (event.type === 'beat') {
        const index = active.beats.length;
        active.beats.push(event.beat as ClassBeat);
        if (early?.index === index) {
          if (early.started) record(active.beats[index], active, index);
          if (early.ended) { active.cursor++; early = null; }
        }
        pump();
        if (active.beats[active.cursor + 1]) player.prepare(active.beats[active.cursor + 1].speech);
        save();
      }
      if (event.type === 'done') { done = true; active.done = event.lessonComplete !== false; active.failed = false; pump(); save(); }
    };
    while (true) { const chunk = await reader.read(); if (chunk.done) break; buffer += decoder.decode(chunk.value, { stream: true }); let n; while ((n = buffer.indexOf('\n')) >= 0) { consume(buffer.slice(0, n)); buffer = buffer.slice(n + 1); } }
    buffer += decoder.decode(); if (buffer.trim()) consume(buffer);
    if (!done && token === epoch) throw new Error('讲解连接中断，点击继续可重试');
  } catch (error) {
    if (token !== epoch) return;
    stop(); active.failed = true; state = 'paused'; update(); save(); toast(error instanceof Error ? error.message : '生成失败，请重试');
  } finally {
    window.clearTimeout(timeout); if (controller === request) controller = null;
    // A finished batch can require another request while its audio is playing.
    // Waiting until the queue runs dry turns model latency into classroom silence.
    if (token === epoch && running && !active.done && !active.failed) pump();
  }
}
function start() {
  if (running) { pause(); return; }
  if (state === 'answer-done') { resume(); return; }
  if (!demo && !config.configured) { openSettings(); return; }
  if (state === 'complete') return;
  (answer || course).failed = false;
  running = true;
  const active = answer || course;
  if (demo && !active.beats.length) { active.beats = structuredClone(answer ? demoReply(history.filter(m => m.role === 'user').at(-1)?.text || '') : demoCourse); active.done = true; }
  pump();
  if (!demo && !active.done && !controller) void generate(active, answer ? history.filter(m => m.role === 'user').at(-1)?.text : '');
}
function resume() { stop(); answer = null; state = 'paused'; start(); save(); }
function ask(question: string) {
  const text = question.trim(); if (!text) return;
  if (!demo && !config.configured) { openSettings(); return; }
  stop(); answer = track(); history.push({ id: crypto.randomUUID(), role: 'user', text });
  $('#question').textContent = ''; ($<HTMLTextAreaElement>('#question')).value = ''; caption = ''; state = 'thinking'; running = true;
  renderHistory(); update(); save();
  if (demo) { answer.beats = structuredClone(demoReply(text)); answer.done = true; pump(); }
  else void generate(answer, text);
}
function newCourse(value: string, isDemo: boolean) {
  if (!isDemo && !config.configured) { openSettings(); toast('请先连接模型，再开始自选主题'); return; }
  save(); stop(); selectedPlan = null; lessonIndex = 0; topic = value.trim() || '什么是机器学习？'; demo = isDemo; course = track(); answer = null; entries = []; history = []; caption = ''; state = 'idle';
  showClassroom(); $('#board-viewport').scrollTop = 0; renderBoard(); renderHistory(); update(); save(); start();
}
function openSettings() {
  pause(); $<HTMLInputElement>('#base-url').value = config.baseUrl; $<HTMLInputElement>('#model-name').value = config.model; $<HTMLDialogElement>('#settings-dialog').showModal();
}
function launchLesson(plan: CoursePlan, index: number) {
  save(); stop(); selectedPlan = plan; lessonIndex = index;
  demo = false; topic = `${plan.outline.title} · 第 ${index + 1} 节 ${plan.outline.lessons[index].title}`;
  course = track(); answer = null; entries = []; history = []; caption = ''; state = 'idle';
  try {
    const previous = JSON.parse(localStorage.getItem(`qingke-lesson-${plan.id}-${index}`) || 'null');
    if (previous?.selectedPlan?.updatedAt === plan.updatedAt && Array.isArray(previous.course?.beats) && Array.isArray(previous.entries) && Array.isArray(previous.history)) {
      course = previous.course; answer = previous.answer || null; entries = previous.entries; history = previous.history; state = 'paused';
    }
  } catch { /* The saved outline remains usable without a browser snapshot. */ }
  showClassroom(); $('#board-viewport').scrollTop = 0; renderBoard(); $('#board-welcome').hidden = true; renderHistory(); update(); save();
  toast(`已载入第 ${index + 1} 节，预计 ${plan.minutesPerLesson} 分钟，点击开始或继续讲解`);
}
const openPlanner = mountCoursePlanner({ pause, home: showHome, connected: () => config.configured, settings: openSettings, toast, launch: launchLesson });
$('#home-plan').onclick = () => void openPlanner();
$('#home-settings').onclick = openSettings;
$('#home-demo').onclick = () => newCourse('什么是机器学习？', true);
$('#home-resume').onclick = () => { showClassroom(); update(); };
$('#home-refresh').onclick = () => void openPlanner.refresh();
$('#home-library-link').onclick = () => $('#home-library').scrollIntoView({ behavior: 'smooth' });
plannerButton.onclick = () => void openPlanner();
nextButton.onclick = () => { if (selectedPlan && lessonIndex + 1 < selectedPlan.lessonCount) launchLesson(selectedPlan, lessonIndex + 1); };
$('#play').onclick = start;
$('#resume').onclick = resume;
$('#interrupt').onclick = () => { pause(true); $('#question').focus(); };
$('#ask-form').onsubmit = e => { e.preventDefault(); ask($<HTMLTextAreaElement>('#question').value); };
$('#question').onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); ask($<HTMLTextAreaElement>('#question').value); } };
$('#topic-form').onsubmit = e => { e.preventDefault(); void openPlanner($<HTMLInputElement>('#topic-input').value); };
$('#demo-start').onclick = () => newCourse('什么是机器学习？', true);
$('#new-course').onclick = () => { showHome(); void openPlanner.refresh(); };
$('#topic-open').onclick = () => void openPlanner();
$('#voice').onclick = () => { const wasRunning = running; pause(); player.voiceEnabled = !player.voiceEnabled; update(); if (wasRunning) start(); };
for (const id of ['chat-open', 'reopen-chat']) $('#' + id).onclick = () => document.body.classList.toggle('chat-collapsed');
$('#chat-close').onclick = () => document.body.classList.add('chat-collapsed');
function setZoom(value: number) { zoom = Math.max(50, Math.min(160, value)); $('#whiteboard').style.zoom = String(zoom / 100); $('#zoom-reset').textContent = `${zoom}%`; }
$('#zoom-in').onclick = () => setZoom(zoom + 10); $('#zoom-out').onclick = () => setZoom(zoom - 10); $('#zoom-reset').onclick = () => setZoom(100);
$('#settings-open').onclick = openSettings;
$('#settings-close').onclick = () => $<HTMLDialogElement>('#settings-dialog').close();
$('#settings-dialog').addEventListener('close', () => { $<HTMLInputElement>('#api-key').value = ''; });
$('#settings-form').onsubmit = async e => {
  e.preventDefault(); const submit = $<HTMLButtonElement>('#settings-form button[type=submit]'); submit.disabled = true;
  try {
    const response = await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ baseUrl: $<HTMLInputElement>('#base-url').value, model: $<HTMLInputElement>('#model-name').value, apiKey: $<HTMLInputElement>('#api-key').value, vision: false }) });
    const data = await response.json(); if (!response.ok || !data.configured) throw new Error(data.error || '请填写密钥以完成连接');
    config = data; update(); $<HTMLDialogElement>('#settings-dialog').close(); toast('连接设置已保存，可以开始规划课程');
  } catch (error) { $('#settings-error').textContent = error instanceof Error ? error.message : '保存失败'; }
  finally { submit.disabled = false; }
};
mountSpeechSettings(player, pause, toast);
player.onVoiceUnavailable = () => toast('语音暂不可用，已按阅读节奏展示字幕与板书；可在语音设置中更换音色');
player.onPreparing = preparing => { if (preparing && running) $('#state-label').textContent = '正在准备语音…'; else if (running) $('#state-label').textContent = answer ? '正在回答你的问题' : '老师正在讲解'; };

// Speech recognition stays on while teaching. Only recognized student speech interrupts playback.
// Browser echo cancellation varies; headphones give the most reliable barge-in experience.
type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type RecognitionEvent = { resultIndex: number; results: RecognitionResult[] };
type Recognition = { lang: string; continuous: boolean; interimResults: boolean; onspeechstart: (() => void) | null; onresult: ((e: RecognitionEvent) => void) | null; onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null; start(): void; stop(): void; abort(): void };
const SpeechRecognition = (window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: new () => Recognition }).webkitSpeechRecognition;
let recognition: Recognition | null = null, micOn = false, restartTimer = 0;
function micUI() { $('#mic').classList.toggle('active', micOn); $('#mic').setAttribute('aria-pressed', String(micOn)); $('#mic-hint').textContent = micOn ? '正在聆听 · 建议戴耳机，避免老师声音回录' : SpeechRecognition ? '语音插话默认关闭' : '当前浏览器不支持语音识别，可输入问题'; }
if (SpeechRecognition) {
  recognition = new SpeechRecognition(); recognition.lang = 'zh-CN'; recognition.continuous = true; recognition.interimResults = true;
  recognition.onspeechstart = () => { if (micOn && running) pause(true); };
  recognition.onresult = e => {
    let final = '', interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) { const result = e.results[i]; if (result.isFinal) final += result[0].transcript; else interim += result[0].transcript; }
    const heard = (final || interim).trim();
    if (heard) { if (running) pause(true); $('#recognition-preview').textContent = heard; }
    if (final.trim()) { $('#recognition-preview').textContent = ''; ask(final); }
  };
  recognition.onerror = e => {
    if (e.error === 'no-speech' || e.error === 'aborted') return;
    micOn = false; window.clearTimeout(restartTimer); micUI();
    toast(e.error === 'not-allowed' ? '麦克风权限未开启，请允许浏览器使用麦克风；也可以输入问题' : `语音识别暂不可用（${e.error}），请用文字提问`);
  };
  recognition.onend = () => { if (micOn) restartTimer = window.setTimeout(() => { try { recognition?.start(); } catch { micOn = false; micUI(); } }, 300); };
}
$('#mic').onclick = () => {
  if (!recognition) { toast('当前浏览器不支持语音识别，请使用支持此功能的浏览器或输入问题'); return; }
  micOn = !micOn; window.clearTimeout(restartTimer);
  if (micOn) { try { recognition.start(); } catch { micOn = false; toast('无法启动麦克风，请检查浏览器权限'); } }
  else { recognition.abort(); $('#recognition-preview').textContent = ''; }
  micUI();
};
document.addEventListener('keydown', e => {
  if (document.body.classList.contains('home-mode')) return;
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || document.querySelector('dialog[open]')) return;
  if (e.code === 'Space') { e.preventDefault(); start(); }
});
window.addEventListener('beforeunload', () => { save(); stop(); micOn = false; recognition?.abort(); });
renderBoard(); renderHistory(); update(); micUI();
if (location.hash === '#classroom' && (selectedPlan || course.beats.length)) showClassroom(); else showHome();
window.addEventListener('popstate', () => { if (location.hash === '#classroom') showClassroom(); else showHome(); });
void openPlanner.refresh();
void fetch('/api/config').then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(data => { config = data; update(); }).catch(() => toast('本机服务未连接，内置演示仍可体验'));
