// All model-produced coordinates are normalized to the ORIGINAL slide, never CSS pixels.
export const ACTIONS = ['circle', 'underline', 'highlight', 'arrow', 'note'];
const bound = (v, fallback) => Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fallback;
export function normalizeAction(raw, targets = []) {
  if (!raw || !ACTIONS.includes(raw.type)) throw new Error('批注动作类型无效');
  const target = targets.find(t => t.id === raw.targetId);
  if (raw.targetId && !target) throw new Error('批注引用了不存在的课件元素');
  if (!target && (!Number.isFinite(raw.x) || !Number.isFinite(raw.y))) throw new Error('批注缺少有效位置');
  const a = {
    type: raw.type,
    x: bound(target?.x ?? raw.x, 0.1), y: bound(target?.y ?? raw.y, 0.1),
    w: Math.max(0.015, Math.min(0.9, target?.w ?? bound(raw.w, 0.16))),
    h: Math.max(0.01, Math.min(0.6, target?.h ?? bound(raw.h, 0.07))),
    text: typeof raw.text === 'string' ? raw.text.slice(0, 240) : '',
    ...(target ? { targetId: target.id } : {}),
  };
  if (target && raw.quote && raw.type !== 'note') {
    const quote = String(raw.quote).trim();
    const index = target.text?.indexOf(quote) ?? -1;
    if (!quote || index < 0) throw new Error('批注关键词不在目标文字中');
    const edges = target.charEdges;
    if (Array.isArray(edges) && edges.length === target.text.length + 1 && edges[0] === 0 && edges.at(-1) === 1 && edges.every((v, i) => Number.isFinite(v) && v >= 0 && v <= 1 && (i === 0 || v >= edges[i - 1]))) {
      a.x = target.x + target.w * target.charEdges[index];
      a.w = target.w * (target.charEdges[index + quote.length] - target.charEdges[index]);
    } else if (quote !== target.text) throw new Error('此目标不支持关键词精确定位，请选择完整目标');
    a.quote = quote;
  }
  a.w = Math.min(a.w, 1 - Math.min(a.x, 0.985)); a.h = Math.min(a.h, 1 - Math.min(a.y, 0.99));
  a.x = Math.min(a.x, 0.985); a.y = Math.min(a.y, 0.99);
  return a;
}
export function validateLesson(raw, targets = []) {
  if (!raw || !Array.isArray(raw.beats) || !raw.beats.length || raw.beats.length > 12) throw new Error('模型未返回有效的分段教案');
  const beats = raw.beats.map((beat, i) => {
    if (typeof beat.speech !== 'string' || !beat.speech.trim()) throw new Error(`第 ${i + 1} 段缺少讲解`);
    return {
      speech: beat.speech.slice(0, 1600),
      actions: Array.isArray(beat.actions) ? beat.actions.slice(0, 4).map(a => normalizeAction(a, targets)) : [],
      board: typeof beat.board === 'string' ? beat.board.slice(0, 800) : '',
    };
  });
  let quiz;
  if (raw.quiz && typeof raw.quiz.question === 'string' && Array.isArray(raw.quiz.options) && raw.quiz.options.length >= 2 && raw.quiz.options.length <= 4 && raw.quiz.options.every(x => typeof x === 'string') && Number.isInteger(raw.quiz.answer) && raw.quiz.answer >= 0 && raw.quiz.answer < raw.quiz.options.length) {
    quiz = { question: raw.quiz.question.slice(0, 400), options: raw.quiz.options.map(x => x.slice(0, 250)), answer: raw.quiz.answer, explanation: String(raw.quiz.explanation || '').slice(0, 800) };
  }
  return { beats, ...(quiz ? { quiz } : {}) };
}
export function extractJSON(content) {
  const clean = String(content || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(clean); } catch { throw new Error('模型返回格式不正确，请重新生成或更换支持 JSON 的模型'); }
}
