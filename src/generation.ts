const stages = ['准备课件', '定位重点', '生成讲解', '校验教案', '准备播放'];
export class GenerationProgress {
  private element: HTMLElement;
  private started = 0;
  private timer = 0;
  constructor(parent: HTMLElement) {
    this.element = document.createElement('section'); this.element.className = 'generation-progress'; this.element.hidden = true;
    this.element.setAttribute('aria-label', '教案生成进度'); parent.prepend(this.element);
  }
  start() {
    this.stop(); this.element.classList.remove('settled'); this.started = Date.now(); this.element.hidden = false;
    this.element.innerHTML = `<div class="generation-heading"><strong>正在准备你的课堂</strong><span class="generation-time"></span></div><ol>${stages.map(s => `<li>${s}</li>`).join('')}</ol><div class="generation-activity"></div><p role="status" aria-live="polite"></p><small>显示实际处理阶段；模型内部生成进度无法精确计量。</small>`;
    this.timer = window.setInterval(() => { this.element.querySelector('.generation-time')!.textContent = `已用时 ${Math.floor((Date.now() - this.started) / 1000)} 秒`; }, 1000);
    this.update('preparing', '正在整理当前页内容');
  }
  update(stage: string, message: string) {
    const current = ({ preparing: 0, locating: 1, generating: 2, validating: 3, ready: 4 } as Record<string, number>)[stage] ?? 0;
    this.element.querySelectorAll('li').forEach((el, i) => { el.className = i < current ? 'done' : i === current ? 'current' : ''; });
    const p = this.element.querySelector('p'); if (p) p.textContent = message;
  }
  stop(message?: string) {
    window.clearInterval(this.timer); this.element.hidden = !message; this.element.classList.toggle('settled', Boolean(message));
    if (message) {
      const p = this.element.querySelector('p'); if (p) p.textContent = message;
      const heading = this.element.querySelector('strong'); if (heading) heading.textContent = message.startsWith('教案已就绪') ? '本页教案已就绪' : '本次生成已停止';
    }
  }
}

export async function readLessonResponse(response: Response, signal: AbortSignal, onProgress: (stage: string, message: string) => void) {
  if (!response.ok || !response.headers.get('content-type')?.includes('application/x-ndjson')) {
    const data = await response.json(); if (!response.ok) throw new Error(data.error || '模型请求失败'); return data;
  }
  if (!response.body) throw new Error('生成连接已中断');
  const reader = response.body.getReader(), decoder = new TextDecoder(); let buffer = '', result;
  const line = (value: string) => {
    if (!value.trim()) return;
    const event = JSON.parse(value);
    if (event.type === 'error') throw new Error(event.error);
    if (event.type === 'progress') onProgress(event.stage, event.message);
    if (event.type === 'result') result = event.lesson;
  };
  try {
    while (true) {
      const { done, value } = await reader.read(); if (signal.aborted) throw signal.reason;
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split('\n'); buffer = lines.pop()!; lines.forEach(line);
      if (done) break;
    }
    line(buffer); if (!result) throw new Error('生成连接中断，未收到完整教案'); return result;
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
