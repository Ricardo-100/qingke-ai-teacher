import './home.css';

export function mountHome() {
  const home = document.createElement('main'); home.id = 'home-page';
  home.innerHTML = `<div class="home-shell">
    <header class="home-header"><a class="home-brand" href="#home"><span class="brand-mark">青</span><span>青课<small>你的 AI 学习空间</small></span></a><nav aria-label="首页导航"><button id="home-library-link">我的课程</button><button id="home-settings">模型设置 <span aria-hidden="true">↗</span></button></nav></header>
    <section class="home-hero"><div><span class="home-eyebrow">让好奇，有一份学习计划。</span><h1>想学的东西，<br>一起慢慢学明白。</h1><p>先和 AI 聊聊你的基础与目标，安排适合自己的课程。<br>把大纲存下来，每次回来，接着上一节。</p><div class="home-hero-actions"><button id="home-plan" class="home-primary">和 AI 规划课程 <span aria-hidden="true">↗</span></button><button id="home-demo">体验一节演示课 <span aria-hidden="true">→</span></button></div><span id="home-model-status" class="home-status" role="status">正在读取模型连接…</span></div>
    <aside class="home-note" aria-label="学习流程"><div class="note-top"><span>一份属于你的学习路线</span><span aria-hidden="true">✦</span></div><ol><li><span>01</span><div><strong>先聊聊，想学什么</strong><p>学习目标、已有基础、感兴趣的方向</p></div></li><li><span>02</span><div><strong>一起安排课程</strong><p>讨论大纲，确定节数和每节时长</p></div></li><li><span>03</span><div><strong>准备好，就来上课</strong><p>本地保存，按节学习，随时继续</p></div></li></ol><div class="note-footer"><span class="note-dot"></span>自己的节奏，也能走很远。</div></aside></section>
    <section id="home-continue" class="home-continue" hidden><div><span class="home-eyebrow">接着上次的好奇</span><h2 id="home-current-title"></h2><p id="home-current-progress"></p></div><button id="home-resume" class="home-primary">返回课堂 <span aria-hidden="true">→</span></button></section>
    <section id="home-planner" aria-label="课程规划"></section>
    <section id="home-library" aria-label="本地课程库"><div class="home-section-heading"><div><span class="home-eyebrow">MY COURSES</span><h2>我的课程</h2><p>保存好的大纲都在这里。选一节，开始今天的学习。</p></div><button id="home-refresh" class="home-text-button">刷新课程 ↻</button></div><div id="home-library-content"></div></section>
    <footer class="home-footer"><span>青课 · 一块白板，一起想明白。</span><span>大纲保存在本机，学习按自己的节奏。</span></footer>
  </div>`;
  document.querySelector('#app')!.prepend(home);
}
