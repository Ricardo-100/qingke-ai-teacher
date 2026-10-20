import './style.css';
import { createIcons, BookOpen, Upload, Settings2, ChevronLeft, ChevronRight, Play, Pause, ArrowUpRight, ArrowUp, Pencil, MousePointer2, Eraser, Undo2, Trash2, Volume2, VolumeX, Sparkles, X, Check, MessageCircle, Download, RotateCcw, PanelRightClose, CheckCircle2, LoaderCircle, FileText, Mic } from 'lucide';
import { demoSlides, demoAnswer } from './demo';
import { SlideBoard, type Ink } from './board';
import { LessonPlayer } from './player';
import { GenerationProgress, readLessonResponse } from './generation';
import { mountSpeechSettings } from './tts-settings';
import { fileStore } from './storage';
import type { Slide, Lesson, Message } from './types';

const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const icon = (name: string, cls = '') => `<i data-lucide="${name}" class="${cls}"></i>`;
function icons() { createIcons({ icons: { BookOpen, Upload, Settings2, ChevronLeft, ChevronRight, Play, Pause, ArrowUpRight, ArrowUp, Pencil, MousePointer2, Eraser, Undo2, Trash2, Volume2, VolumeX, Sparkles, X, Check, MessageCircle, Download, RotateCcw, PanelRightClose, CheckCircle2, LoaderCircle, FileText, Mic } }); }
type PageState = { ink: Ink[]; notes: string[]; beat: number; lesson?: Lesson; lessonKey?: string; messages: Message[]; quizChoice?: number; quizCorrect?: boolean };
let slides: Slide[] = demoSlides;
let pages: PageState[] = [];
let current = 0, isDemo = true, documentName = '导数：理解变化的语言';
let status: 'idle' | 'playing' | 'paused' | 'loading' | 'question' | 'complete' = 'idle';
let config = { configured: false, model: '', baseUrl: 'https://api.openai.com/v1', vision: false };
let requestController: AbortController | null = null;
let epoch = 0, reply: Lesson | null = null, replyBeat = 0;
let replyKey = '';
let loadingFile = false;
let sessionReady = false;
let learningSeconds = 0;
let saveWarning = false;
const player = new LessonPlayer();
const makePages = () => slides.map((): PageState => ({ ink: [], notes: [], beat: 0, messages: [] }));
pages = makePages();
const ps = () => pages[current];

$('#app').innerHTML = `
  <aside class="sidebar">
    <a class="brand" href="/" aria-label="青课首页"><span class="brand-mark">${icon('book-open')}</span><span>青课<span class="brand-en">QINGKE</span></span></a>
    <div class="workspace-label">我的学习空间</div>
    <button class="nav-item active" id="class-nav">${icon('book-open')}<span>一对一课堂</span><span class="nav-dot"></span></button>
    <div class="sidebar-section"><span>本节课件</span><button class="icon-btn" id="upload-small" title="上传 PDF 课件">${icon('upload')}</button></div>
    <div class="document-card"><div class="document-icon">${icon('file-text')}</div><div><strong id="document-title">微积分 · 导数入门</strong><small id="document-meta">内置演示课 · 3 页</small></div></div>
    <nav id="outline" class="outline" aria-label="课件目录"></nav>
    <button class="upload-zone" id="upload-main">${icon('upload')}<strong>带上你的课件</strong><span>上传 PDF，开启专属课堂</span></button>
    <div class="sidebar-bottom"><div class="local-dot"></div><span>学习记录保存在本机</span><button id="export-notes" class="icon-btn" title="导出学习笔记">${icon('download')}</button></div>
  </aside>
  <main>
    <header class="topbar"><div class="breadcrumb">学习空间 <span>/</span> 一对一课堂</div><div class="top-actions"><button id="upload-top" class="icon-btn" title="上传 PDF 课件">${icon('upload')}</button><span class="mode-badge" id="mode-badge"><b></b>演示课堂</span><button id="settings-open" class="secondary small">${icon('settings-2')}连接模型</button></div></header>
    <section class="heading"><div><div class="eyebrow">YOUR PERSONAL CLASSROOM</div><h1 id="course-title">导数：理解变化的语言</h1><p id="course-subtitle">一位会在课件上圈画、补充，也愿意等你理解的老师。</p></div><button id="demo-reset" class="text-button">${icon('rotate-ccw')}重置演示</button></section>
    <div class="class-layout">
      <section class="lesson-space" aria-label="课件与板书">
        <div class="lesson-toolbar"><div class="live-label"><span class="status-dot"></span><span id="lesson-state">准备好，开始这一课</span></div><span class="page-count" id="page-count">01 / 03</span></div>
        <div class="slide-frame"><div class="slide-holder" id="slide-holder"><img id="slide-image" alt="当前课件"/><div id="annotation-canvas" aria-label="课件批注层"></div></div><div class="slide-tools" aria-label="批注工具">
          <button class="tool selected" data-tool="pointer" title="查看课件">${icon('mouse-pointer-2')}</button><button class="tool" data-tool="pen" title="在课件上书写">${icon('pencil')}</button><button class="tool" data-tool="erase" title="点击笔迹擦除">${icon('eraser')}</button><span></span><button id="undo-ink" class="tool" title="撤销上一次批注">${icon('undo-2')}</button><button id="clear-ink" class="tool" title="清除本页批注">${icon('trash-2')}</button>
        </div></div>
        <div class="playback"><div class="page-nav"><button id="prev-page" class="icon-btn" aria-label="上一页">${icon('chevron-left')}</button><span id="page-position">第 1 页</span><button id="next-page" class="icon-btn" aria-label="下一页">${icon('chevron-right')}</button></div><button id="play" class="primary">${icon('play')}开始讲解</button><div class="voice-controls"><button id="voice" class="icon-btn" title="开关讲解语音">${icon('volume-2')}</button><select id="speed" aria-label="讲解速度"><option value="0.8">0.8×</option><option value="1" selected>1.0×</option><option value="1.2">1.2×</option><option value="1.5">1.5×</option></select></div></div>
        <div class="beat-track" id="beat-track" aria-label="本页讲解进度"></div>
        <section class="board-section"><div class="section-title"><span>${icon('pencil')}老师的补充板书</span><span class="subtle">随讲解逐步展开</span></div><div class="board-content" id="board-notes"><div class="empty-board"><span>“公式之外，也把道理讲清楚。”</span><small>讲解中的例子、推导和补充会留在这里。</small></div></div></section>
        <div class="lesson-footer"><span>${icon('check-circle-2')}课件原稿与课堂笔迹分开保存</span><span id="study-time">本次学习 00:00</span></div>
      </section>
      <aside class="teacher-panel"><div class="teacher-header"><span class="avatar">青<span></span></span><div><h2>青课老师</h2><p id="teacher-status">准备和你一起理解</p></div><span class="teacher-spark">${icon('sparkles')}</span></div>
        <div class="teacher-body" id="teacher-body"><div class="welcome" id="welcome"><span class="tiny-label">LET’S THINK TOGETHER</span><h3>我们从一个问题开始。</h3><p>导数为什么能描述变化？<br>我会一边讲，一边在课件上标出重点。你可以随时叫停。</p><div class="welcome-note">${icon('message-circle')}不懂的地方，正是课堂开始的地方。</div></div><div id="transcript" class="transcript" aria-live="polite"></div><div id="quiz" class="quiz"></div></div>
        <div class="ask-area"><button id="interrupt" class="interrupt-btn">${icon('pause')}暂停一下，我有问题</button><div class="question-chips"><button data-question="能换个例子解释吗？">换个例子</button><button data-question="为什么这里可以约去 h？">为什么能约去 h？</button></div><form id="ask-form"><label class="sr-only" for="question">向老师提问</label><textarea id="question" rows="2" placeholder="哪里没理解？在这里问老师…" maxlength="2000"></textarea><div class="composer-footer"><span>Enter 发送 · Shift + Enter 换行</span><button type="submit" id="send" class="send-button" title="发送问题">${icon('arrow-up')}</button></div></form><p class="model-hint" id="model-hint">内置课程为演示内容 · 语音使用浏览器朗读</p></div>
      </aside>
    </div>
  </main>
  <input id="file-input" type="file" accept="application/pdf,.pdf" hidden/>
  <dialog id="settings-dialog"><form id="settings-form"><div class="dialog-heading"><div><div class="eyebrow">MAKE IT YOURS</div><h2>连接你的 AI 老师</h2></div><button type="button" class="icon-btn" id="settings-close" aria-label="关闭设置">${icon('x')}</button></div><p class="dialog-description">支持兼容 Chat Completions 的服务。密钥只交给本机服务，不会保存在浏览器。</p><label>服务地址<input id="base-url" type="url" required placeholder="https://api.example.com/v1"/></label><label>模型名称<input id="model-name" required placeholder="填写服务商支持的模型名称"/></label><label>API 密钥<input id="api-key" type="password" autocomplete="off" placeholder="输入密钥；留空保留已有密钥"/></label><label class="checkbox-label"><input id="vision-enabled" type="checkbox"/>发送当前页图像给视觉模型</label><p class="field-hint">适合图表、公式和扫描课件；需模型支持图像。关闭时只发送当前页文字与位置。课件内容会发送至你配置的服务商。</p><p class="settings-error" id="settings-error" role="alert"></p><div class="dialog-footer"><span>设置保存在本地 .env，重启后自动恢复</span><button class="primary" type="submit" id="save-settings">保存连接</button></div></form></dialog>
  <div id="toast" class="toast" role="status"></div>`;
icons();
// Keep the source tools reachable in a drawer while giving the page to the whiteboard.
document.body.classList.add('whiteboard-classroom');
$('.topbar').insertAdjacentHTML('afterbegin', `<button id="course-drawer" class="icon-btn" title="课件目录与上传" aria-label="课件目录与上传" aria-expanded="false">${icon('book-open')}</button>`);
$('#course-drawer').onclick = () => {
  const open = document.body.classList.toggle('course-drawer-open');
  $('#course-drawer').setAttribute('aria-expanded', String(open));
};
$('.teacher-header h2').textContent = '对话历史';
$('.teacher-spark').innerHTML = `<button id="chat-toggle" class="icon-btn" title="收起对话" aria-label="收起对话">${icon('panel-right-close')}</button>`;
$('.top-actions').insertAdjacentHTML('beforeend', `<button id="chat-open" class="icon-btn" title="显示对话历史" aria-label="显示对话历史">${icon('message-circle')}</button>`);
$('#chat-toggle').onclick = () => document.body.classList.add('chat-collapsed');
$('#chat-open').onclick = () => document.body.classList.toggle('chat-collapsed');
$('.lesson-toolbar').insertAdjacentHTML('beforeend', '<div class="canvas-navigation"><button id="zoom-out" aria-label="缩小白板">−</button><button id="zoom-reset" title="恢复适合宽度">100%</button><button id="zoom-in" aria-label="放大白板">＋</button></div>');
$('.canvas-navigation').append($('.page-nav'));
let zoom = 100;
function setZoom(value: number) {
  zoom = Math.max(50, Math.min(180, value));
  const slide = slides[current];
  const fit = Math.min($('.slide-frame').clientWidth, Math.max(240, window.innerHeight - 420) * slide.width / slide.height);
  $('#slide-holder').style.width = `${fit * zoom / 100}px`;
  $('#zoom-reset').textContent = `${zoom}%`;
}
$('#zoom-out').onclick = () => setZoom(zoom - 10);
$('#zoom-in').onclick = () => setZoom(zoom + 10);
$('#zoom-reset').onclick = () => setZoom(100);
window.addEventListener('resize', () => setZoom(zoom));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    document.body.classList.remove('course-drawer-open');
    $('#course-drawer').setAttribute('aria-expanded', 'false');
  }
});
icons();
const board = new SlideBoard($('#annotation-canvas'));
const generation = new GenerationProgress($('.lesson-space'));
$('.lesson-toolbar').insertAdjacentHTML('beforeend', '<button class="text-button" id="regenerate">重新生成本页</button>');
$('#regenerate').onclick = () => {
  if (loadingFile) return;
  pause(); reply = null;
  ps().ink = ps().ink.filter(ink => ink.points);
  ps().lesson = undefined; ps().lessonKey = undefined; ps().beat = 0; ps().quizChoice = undefined; ps().quizCorrect = undefined;
  renderPage(); save(); void start();
};
mountSpeechSettings(player, () => { if (status === 'playing' || status === 'loading') pause(); }, toast);
player.onPreparing = preparing => { if (preparing) $('#teacher-status').textContent = '正在合成这一段语音…'; else if (status === 'playing') $('#teacher-status').textContent = '正在讲解，随时可以打断'; };
board.onChange = ink => { ps().ink = structuredClone(ink); save(); };
player.onVoiceUnavailable = () => { toast('当前语音不可用，已按阅读节奏展示字幕；可关闭语音继续体验'); };

function toast(text: string) { $('#toast').textContent = text; $('#toast').classList.add('visible'); window.setTimeout(() => $('#toast').classList.remove('visible'), 5500); }
function save() {
  // Reloading while IndexedDB/PDF restoration is in progress must not overwrite the saved course.
  if (!sessionReady) return;
  try { localStorage.setItem('qingke-session-v1', JSON.stringify({ isDemo, documentName, current, pages, learningSeconds })); }
  catch { if (!saveWarning) { toast('本机存储空间不足，本次进度可能无法保存；请导出笔记'); saveWarning = true; } }
}
function cancelWork() { epoch++; requestController?.abort(); requestController = null; generation.stop(); player.cancel(); board.stopAnimation(); }
function pause() {
  const wasLoading = status === 'loading'; cancelWork();
  status = 'paused'; updateControls(); renderQuiz();
  if (wasLoading) toast('已取消本次生成，可以重新开始');
  save();
}
function updateControls() {
  const busy = status === 'playing';
  $('#play').innerHTML = loadingFile ? `${icon('loader-circle')}读取课件中` : status === 'loading' ? `${icon('x')}取消生成` : busy ? `${icon('pause')}暂停讲解` : status === 'complete' ? `${icon('rotate-ccw')}重听本页` : status === 'paused' || status === 'question' ? `${icon('play')}${reply ? '继续补讲' : '继续讲解'}` : `${icon('play')}开始讲解`;
  $('#teacher-status').textContent = status === 'loading' ? '正在理解课件，准备讲解…' : busy ? reply ? '正在为你补充解释' : '正在讲解，随时可以打断' : status === 'complete' ? '来试试，你理解了吗？' : status === 'question' ? '我在听，你想问什么？' : '按你的节奏，一起理解';
  $('#lesson-state').textContent = status === 'loading' ? '正在准备本页教案…' : busy ? reply ? '补充讲解中' : '老师正在讲解' : status === 'complete' ? '本页讲解完成' : status === 'paused' || status === 'question' ? '已暂停 · 随时继续' : '准备好，开始这一课';
  $('.status-dot').classList.toggle('speaking', busy);
  $('#prev-page').toggleAttribute('disabled', loadingFile || current === 0); $('#next-page').toggleAttribute('disabled', loadingFile || current === slides.length - 1);
  for (const id of ['play', 'upload-top', 'upload-small', 'upload-main', 'demo-reset', 'interrupt', 'settings-open']) $('#' + id).toggleAttribute('disabled', loadingFile);
  $('#mode-badge').innerHTML = `<b></b>${config.configured ? 'AI 已连接' : isDemo ? '演示课堂' : '待连接模型'}`;
  $('#settings-open').innerHTML = `${icon('settings-2')}${config.configured ? '模型设置' : '连接模型'}`;
  $('#model-hint').textContent = config.configured ? `${config.model} · ${player.provider === 'api' ? '自定义 TTS' : '浏览器语音'} · 当前页${config.vision ? '图文' : '文字'}发送至模型` : isDemo ? '内置课程为演示内容 · 可在语音设置中配置朗读' : '课件保存在本机 · 连接模型后开始 AI 讲解';
  const lesson = ps().lesson;
  $('#beat-track').innerHTML = lesson ? lesson.beats.map((_, i) => `<span class="${i < ps().beat || status === 'complete' ? 'done' : i === ps().beat && busy && !reply ? 'current' : ''}"></span>`).join('') : '<span></span><span></span><span></span><span></span>';
  $('#send').toggleAttribute('disabled', status === 'loading' || loadingFile);
  icons();
}
function renderOutline() {
  $('#outline').innerHTML = slides.map((s, i) => `<button class="outline-item ${i === current ? 'current' : ''}" data-page="${i}"><span class="outline-number">${String(i + 1).padStart(2, '0')}</span><span><strong>${escape(s.title)}</strong><small>${escape(s.subtitle)}</small></span>${pages[i]?.quizCorrect ? icon('check') : ''}</button>`).join(''); icons();
}
function renderNotes() {
  $('#board-notes').innerHTML = ps().notes.length ? ps().notes.map((note, i) => `<article class="board-note"><span>${String(i + 1).padStart(2, '0')}</span><p>${escape(note).replace(/\n/g, '<br>')}</p></article>`).join('') : '<div class="empty-board"><span>“公式之外，也把道理讲清楚。”</span><small>讲解中的例子、推导和补充会留在这里。</small></div>';
}
function renderTranscript() {
  $('#welcome').hidden = ps().messages.length > 0;
  $('#transcript').innerHTML = ps().messages.map(m => `<div class="message ${m.role}"><span class="message-label">${m.role === 'user' ? '你的提问' : '老师讲解'}</span><p>${escape(m.text).replace(/\n/g, '<br>')}</p></div>`).join('');
  const body = $('#teacher-body'); body.scrollTop = body.scrollHeight;
}
function renderQuiz() {
  const quiz = ps().lesson?.quiz;
  if (!quiz || status !== 'complete') { $('#quiz').innerHTML = ''; return; }
  const choice = ps().quizChoice;
  $('#quiz').innerHTML = `<div class="quiz-label">${icon('sparkles')}停一下，检查理解</div><h3>${escape(quiz.question)}</h3>${quiz.options.map((o, i) => `<button class="quiz-option ${choice === i ? i === quiz.answer ? 'correct' : 'incorrect' : ''}" data-choice="${i}"><span>${String.fromCharCode(65 + i)}</span>${escape(o)}</button>`).join('')}${choice !== undefined ? `<div class="quiz-feedback ${ps().quizCorrect ? 'success' : ''}">${ps().quizCorrect ? '理解得很好。' : '我们再想一步。'}${escape(quiz.explanation)}</div>${!ps().quizCorrect ? '<button class="text-button" id="quiz-reteach">请老师补讲一下</button>' : ''}` : ''}`;
  icons();
}
function renderPage() {
  const slide = slides[current];
  $('#slide-image').setAttribute('src', slide.image); $('#slide-image').setAttribute('alt', `${documentName} · ${slide.title}`);
  $('#slide-holder').style.aspectRatio = `${slide.width} / ${slide.height}`;
  setZoom(zoom);
  board.setPage(slide.width, slide.height, ps().ink);
  $('#page-count').textContent = `${String(current + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`;
  $('#page-position').textContent = `第 ${current + 1} 页`;
  $('#course-title').textContent = documentName;
  $('#document-title').textContent = isDemo ? '微积分 · 导数入门' : documentName;
  $('#document-meta').textContent = `${isDemo ? '内置演示课' : 'PDF 课件'} · ${slides.length} 页`;
  $('#course-subtitle').textContent = isDemo ? '一位会在课件上圈画、补充，也愿意等你理解的老师。' : '围绕你的课件，讲解、圈画，把每一个问题讲清楚。';
  $('#welcome p').textContent = isDemo ? '导数为什么能描述变化？我会一边讲，一边在课件上标出重点。你可以随时叫停。' : `这页讲的是“${slide.title}”。连接模型后，我会围绕课件讲清概念，在重点处圈画，并补充例子。你可以随时叫停。`;
  const secondChip = document.querySelectorAll<HTMLButtonElement>('[data-question]')[1];
  secondChip.textContent = isDemo ? '为什么能约去 h？' : '解释本页重点'; secondChip.dataset.question = isDemo ? '为什么这里可以约去 h？' : '请解释本页最重要的概念，以及它为什么重要。';
  renderOutline(); renderNotes(); renderTranscript(); renderQuiz(); updateControls();
}
function goPage(index: number) {
  if (loadingFile || index < 0 || index >= slides.length || index === current) return;
  cancelWork(); reply = null; current = index; status = 'idle'; renderPage(); save();
}
async function fetchLesson(question = ''): Promise<Lesson> {
  const controller = new AbortController(); requestController = controller;
  const timeout = window.setTimeout(() => controller.abort(new Error('生成超时，请重试')), 165000);
  const slide = slides[current];
  generation.start();
  try {
    const response = await fetch('/api/lesson', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' }, signal: controller.signal, body: JSON.stringify({ title: slide.title, text: slide.text, targets: slide.targets, page: current + 1, question, history: ps().messages.slice(-6), notes: ps().notes.slice(-8), annotations: ps().ink.slice(-60), ...(config.vision ? { image: rasterSlide() } : {}) }) });
    const data = await readLessonResponse(response, controller.signal, (stage, message) => { if (requestController === controller) generation.update(stage, message); });
    generation.update('ready', `教案已就绪，共 ${data.beats.length} 段讲解`); generation.stop(`教案已就绪，共 ${data.beats.length} 段讲解`); return data;
  } catch (error) {
    if (requestController === controller) generation.stop(controller.signal.aborted ? '生成已取消或超时，可以重新开始' : `生成失败：${error instanceof Error ? error.message : '请重试'}`);
    throw error;
  } finally { window.clearTimeout(timeout); if (requestController === controller) requestController = null; }
}
function rasterSlide() {
  const img = $('#slide-image') as HTMLImageElement;
  if (!img.complete || !img.naturalWidth) throw new Error('页面图像仍在准备，请稍后重试');
  const canvas = document.createElement('canvas'); canvas.width = slides[current].width; canvas.height = slides[current].height;
  const context = canvas.getContext('2d')!;
  context.drawImage(img, 0, 0, canvas.width, canvas.height);
  // Use the original image so previous annotation strokes cannot be mistaken for source content.
  return canvas.toDataURL('image/jpeg', .8);
}
async function start() {
  if (loadingFile) return;
  if (status === 'playing') { pause(); return; }
  if (status === 'loading') { pause(); return; }
  if (reply) { status = 'playing'; updateControls(); playNext(); return; }
  if (status === 'complete') { ps().beat = 0; }
  if (!ps().lesson) {
    if (!config.configured && isDemo) ps().lesson = structuredClone(slides[current].demoLesson!);
    else {
      if (!config.configured) { openSettings(); toast('连接模型后，即可讲解你上传的课件'); return; }
      if (!slides[current].text.trim() && !config.vision) { toast('本页没有可提取文字，请连接视觉模型并开启页面图像'); openSettings(); return; }
      status = 'loading'; updateControls(); const token = epoch;
      try { const lesson = await fetchLesson(); if (token !== epoch) return; ps().lesson = lesson; }
      catch (e) { if (token !== epoch) return; status = 'paused'; toast(e instanceof Error ? e.message : '生成失败'); updateControls(); return; }
    }
  }
  ps().lessonKey ||= crypto.randomUUID();
  status = 'playing'; $('#quiz').innerHTML = ''; updateControls(); playNext();
}
function playNext() {
  if (status !== 'playing') return;
  const lesson = reply || ps().lesson;
  const index = reply ? replyBeat : ps().beat;
  if (!lesson || index >= lesson.beats.length) {
    if (reply) { reply = null; replyBeat = 0; status = ps().lesson && ps().beat >= ps().lesson!.beats.length ? 'complete' : 'paused'; toast('补讲结束，可以继续原来的课堂'); }
    else status = 'complete';
    updateControls(); renderQuiz(); save(); return;
  }
  const beat = lesson.beats[index]; const token = epoch;
  const id = `${reply ? replyKey : ps().lessonKey}-${index}`;
  player.play(beat, () => {
    if (token !== epoch) return;
    board.add(beat.actions, id);
    if (beat.board && !ps().notes.includes(beat.board)) { ps().notes.push(beat.board); renderNotes(); }
    if (ps().messages.at(-1)?.text !== beat.speech) { ps().messages.push({ role: 'assistant', text: beat.speech }); renderTranscript(); }
    updateControls(); save();
  }, () => {
    if (token !== epoch || status !== 'playing') return;
    if (reply) replyBeat++; else ps().beat++;
    save(); updateControls(); playNext();
  });
}
async function ask(question: string) {
  if (loadingFile) return;
  question = question.trim(); if (!question) return;
  pause(); reply = null; replyBeat = 0; replyKey = crypto.randomUUID();
  ps().messages.push({ role: 'user', text: question }); renderTranscript(); $<HTMLTextAreaElement>('#question').value = '';
  const token = epoch;
  if (!config.configured) {
    const answer = isDemo ? demoAnswer(question, current) : null;
    if (!answer) { ps().messages.push({ role: 'assistant', text: '当前未连接 AI 服务。演示课支持“换个例子”和“为什么能约去 h”等示例提问；自由问答需要先连接模型。' }); renderTranscript(); status = 'paused'; updateControls(); save(); return; }
    reply = answer; toast('这是内置的演示补讲；连接模型后可自由提问');
  } else {
    status = 'loading'; updateControls();
    try { reply = await fetchLesson(question); if (token !== epoch) return; }
    catch (e) { if (token !== epoch) return; reply = null; status = 'paused'; toast(e instanceof Error ? e.message : '补讲失败'); updateControls(); save(); return; }
  }
  status = 'playing'; updateControls(); playNext();
}
async function importFile(file: File) {
  if (loadingFile) return;
  if (!/\.pdf$/i.test(file.name)) { toast('请先将 PPT 导出为 PDF，再上传课件'); return; }
  if (file.size > 25 * 1024 * 1024) { toast('首版支持 25 MB 以内的 PDF'); return; }
  pause(); loadingFile = true; status = 'loading'; updateControls(); const token = epoch;
  try {
    const data = await file.arrayBuffer(); const { readPDF } = await import('./pdf');
    const imported = await readPDF(data, (n, total) => { if (token === epoch) $('#lesson-state').textContent = `正在读取课件 ${n} / ${total}`; });
    if (token !== epoch) return;
    // Persist the original before switching documents so a storage failure can't orphan the old session.
    await fileStore({ name: file.name, data }); if (token !== epoch) return;
    slides = imported; documentName = file.name.replace(/\.pdf$/i, ''); isDemo = false; pages = makePages(); current = 0; reply = null; status = 'idle';
    loadingFile = false; renderPage(); save(); toast(config.configured ? '课件已就绪，点击开始讲解' : '课件已保存到本机。连接模型后，老师就能讲解这份课件');
  } catch (e) { if (token !== epoch) return; status = 'paused'; toast(e instanceof Error ? e.message : '读取失败，请检查 PDF 文件'); }
  finally { loadingFile = false; updateControls(); }
}
function openSettings() {
  $<HTMLInputElement>('#base-url').value = config.baseUrl; $<HTMLInputElement>('#model-name').value = config.model; $<HTMLInputElement>('#vision-enabled').checked = config.vision; $<HTMLInputElement>('#api-key').value = ''; $('#settings-error').textContent = ''; $<HTMLDialogElement>('#settings-dialog').showModal();
}
$('#settings-form').addEventListener('submit', async e => {
  e.preventDefault(); $('#save-settings').setAttribute('disabled', '');
  try {
    const response = await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ baseUrl: $<HTMLInputElement>('#base-url').value, model: $<HTMLInputElement>('#model-name').value, apiKey: $<HTMLInputElement>('#api-key').value, vision: $<HTMLInputElement>('#vision-enabled').checked }) });
    const data = await response.json(); if (!response.ok) throw new Error(data.error);
    pause(); reply = null; config = data;
    // A new provider must generate fresh lessons; previous notes and messages remain learning records.
    pages.forEach(p => { p.lesson = undefined; p.lessonKey = undefined; p.beat = 0; p.quizChoice = undefined; p.quizCorrect = undefined; });
    $<HTMLInputElement>('#api-key').value = ''; $<HTMLDialogElement>('#settings-dialog').close(); renderPage(); toast(config.configured ? '连接配置已保存。开始讲解时会实际请求模型' : '尚未填写密钥，当前仍为演示模式'); save();
  } catch (err) { $('#settings-error').textContent = err instanceof Error ? err.message : '连接配置保存失败'; }
  finally { $('#save-settings').removeAttribute('disabled'); }
});
$('#settings-open').onclick = openSettings; $('#settings-close').onclick = () => { $<HTMLInputElement>('#api-key').value = ''; $<HTMLDialogElement>('#settings-dialog').close(); };
$('#play').onclick = () => void start();
$('#interrupt').onclick = () => { pause(); status = 'question'; updateControls(); $<HTMLTextAreaElement>('#question').focus(); };
$('#prev-page').onclick = () => goPage(current - 1); $('#next-page').onclick = () => goPage(current + 1);
$('#outline').onclick = e => { const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-page]'); if (btn) goPage(Number(btn.dataset.page)); };
document.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach(b => b.onclick = () => {
  if (status === 'playing') pause(); board.setTool(b.dataset.tool as typeof board.tool);
  document.querySelectorAll('[data-tool]').forEach(el => el.classList.toggle('selected', el === b));
});
$('#undo-ink').onclick = () => { pause(); board.undo(); }; $('#clear-ink').onclick = () => { pause(); board.clear(); };
$('#voice').onclick = () => { player.voiceEnabled = !player.voiceEnabled; $('#voice').innerHTML = icon(player.voiceEnabled ? 'volume-2' : 'volume-x'); $('#voice').setAttribute('aria-pressed', String(player.voiceEnabled)); icons(); if (status === 'playing') { player.cancel(); playNext(); } };
$<HTMLSelectElement>('#speed').onchange = () => { player.rate = Number($<HTMLSelectElement>('#speed').value); if (status === 'playing') { player.cancel(); playNext(); } };
$('#ask-form').onsubmit = e => { e.preventDefault(); void ask($<HTMLTextAreaElement>('#question').value); };
$<HTMLTextAreaElement>('#question').onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); void ask($<HTMLTextAreaElement>('#question').value); } };
document.querySelectorAll<HTMLButtonElement>('[data-question]').forEach(b => b.onclick = () => void ask(b.dataset.question!));
$('#quiz').onclick = e => {
  const reteach = (e.target as HTMLElement).closest('#quiz-reteach');
  if (reteach) { const q = ps().lesson!.quiz!; void ask(`我没理解这道题：${q.question}。请换个例子补讲。`); return; }
  const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-choice]'); if (!btn) return;
  const q = ps().lesson?.quiz; if (!q) return;
  ps().quizChoice = Number(btn.dataset.choice); ps().quizCorrect = ps().quizChoice === q.answer; save(); renderQuiz(); renderOutline();
};
$('#file-input').onchange = e => { const input = e.target as HTMLInputElement; const file = input.files?.[0]; if (file) void importFile(file); input.value = ''; };
$('#upload-small').onclick = $('#upload-main').onclick = $('#upload-top').onclick = () => $('#file-input').click();
$('#demo-reset').onclick = async () => { cancelWork(); reply = null; slides = demoSlides; isDemo = true; documentName = '导数：理解变化的语言'; current = 0; pages = makePages(); status = 'idle'; renderPage(); save(); try { await fileStore(null); } catch { /* Session is already switched to demo; stale file is unused. */ } toast('已重新打开演示课'); };
$('#export-notes').onclick = () => {
  const content = `# ${documentName}\n\n` + slides.map((slide, i) => `## ${i + 1}. ${slide.title}\n\n${pages[i].notes.join('\n\n')}\n\n${pages[i].messages.map(m => `${m.role === 'user' ? '学生' : '老师'}：${m.text}`).join('\n\n')}\n`).join('\n');
  const url = URL.createObjectURL(new Blob([content], { type: 'text/markdown;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = `${documentName}-学习笔记.md`; a.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$('#class-nav').onclick = () => $('#play').focus();
window.addEventListener('keydown', e => {
  if ((e.target as HTMLElement).matches('input,textarea,select') || document.querySelector('dialog[open]')) return;
  if (e.code === 'Space') { e.preventDefault(); void start(); }
  if (e.code === 'ArrowRight') goPage(current + 1);
  if (e.code === 'ArrowLeft') goPage(current - 1);
});
window.setInterval(() => { if (status === 'playing') { learningSeconds++; if (learningSeconds % 10 === 0) save(); } $('#study-time').textContent = `本次学习 ${String(Math.floor(learningSeconds / 60)).padStart(2, '0')}:${String(learningSeconds % 60).padStart(2, '0')}`; }, 1000);
window.addEventListener('beforeunload', () => { save(); player.cancel(); });

async function boot() {
  renderPage();
  const saved = localStorage.getItem('qingke-session-v1');
  try {
    if (saved) {
      const state = JSON.parse(saved);
      if (Array.isArray(state.pages) && state.pages.length && typeof state.isDemo === 'boolean') {
        if (!state.isDemo) {
          loadingFile = true; status = 'loading'; updateControls(); const cached = await fileStore();
          if (!cached) throw new Error('找不到上次课件，请重新上传');
          const { readPDF } = await import('./pdf'); slides = await readPDF(cached.data, () => {});
        }
        if (state.pages.length === slides.length && state.pages.every((p: PageState) => Array.isArray(p.ink) && Array.isArray(p.messages) && Array.isArray(p.notes) && Number.isInteger(p.beat))) {
          pages = state.pages; isDemo = state.isDemo; documentName = state.documentName; current = Math.max(0, Math.min(slides.length - 1, state.current || 0)); learningSeconds = state.learningSeconds || 0;
          status = ps().lesson && ps().beat >= ps().lesson!.beats.length ? 'complete' : 'idle';
        }
      }
    }
  } catch (e) { slides = demoSlides; pages = makePages(); current = 0; isDemo = true; status = 'idle'; toast(e instanceof Error ? e.message : '恢复失败，已打开演示课'); }
  loadingFile = false;
  try { const response = await fetch('/api/config'); if (response.ok) config = await response.json(); } catch { toast('本机模型服务未启动；仍可体验演示课'); }
  sessionReady = true; renderPage();
}
void boot();

