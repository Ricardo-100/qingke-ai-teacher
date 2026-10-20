import type { Slide, Lesson, Action } from './types';
const ink = '#263c35', muted = '#7d847c', green = '#8960db';
const line = (x1: number, y1: number, x2: number, y2: number, stroke = '#c6cdc0', sw = 2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${sw}"/>`;
const text = (x: number, y: number, value: string, size = 24, color = ink, extra = '') => `<text x="${x}" y="${y}" fill="${color}" font-size="${size}" ${extra}>${value}</text>`;
function slideArt(n: number, title: string, sub: string, content: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="750" viewBox="0 0 1200 750"><rect width="1200" height="750" fill="#ffffff"/><g font-family="'Microsoft YaHei','PingFang SC',sans-serif">${text(72, 70, 'MATH / 微积分入门', 16, green, 'letter-spacing="3"')}${text(72, 140, title, 42, ink, 'font-weight="600"')}${text(72, 187, sub, 21, muted)}${content}${line(72, 689, 1128, 689, '#e7e9df', 1)}${text(72, 723, '青课 · 从理解开始', 14, muted)}${text(1080, 723, `0${n} / 03`, 14, muted)}</g></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
const a = (type: Action['type'], x: number, y: number, w: number, h: number, content?: string): Action => ({ type, x, y, w, h, text: content });
const lesson1: Lesson = {
  source: 'demo',
  beats: [
    { speech: '我们先看这条曲线。今天要解决的问题是：在曲线上的某一个点，变化到底有多快？', actions: [a('circle', .665, .595, .05, .08)], board: '今天的问题\n怎样描述“某一瞬间”的变化速度？' },
    { speech: '连接曲线上两个点，得到一条割线。横着走了多少，就是横坐标的变化量，记作 delta x。', actions: [a('underline', .741, .755, .045, .035)], board: '割线：连接曲线上的两个点。\nΔx = 横向变化量\nΔy = 纵向变化量' },
    { speech: '纵向变化量除以横向变化量，就是这段区间的平均变化率。请注意这个比值，它就是割线的斜率。', actions: [a('highlight', .083, .382, .31, .095)], board: '平均变化率 = Δy / Δx\n补充：开车时，一段路程除以耗时，得到的是平均速度。' },
    { speech: '如果让第二个点慢慢靠近第一个点，割线就逐渐接近切线。导数描述的，就是这里的瞬时变化率。', actions: [a('underline', .083, .676, .28, .055)], board: '两个点越来越近\n割线 → 切线\n平均变化率 → 瞬时变化率' },
  ],
  quiz: { question: '割线的斜率，描述的是什么？', options: ['某一区间的平均变化率', '函数在这一点的高度', '横坐标本身的大小'], answer: 0, explanation: '割线连接两个点，斜率是 Δy / Δx，描述该区间的平均变化率。两点趋近时，才进一步讨论瞬时变化率。' },
};
export const demoSlides: Slide[] = [
  {
    title: '从斜率到变化率', subtitle: '先看见变化，再理解公式', width: 1200, height: 750,
    text: '平均变化率 = Δy / Δx。连接曲线上两点的直线叫割线。两点趋近，割线趋向切线，平均变化率趋向瞬时变化率。',
    image: slideArt(1, '变化，到底有多快？', '从一条曲线出发，理解导数的直觉。',
      `<rect x="72" y="257" width="442" height="154" rx="8" fill="#f0f2e9"/>${text(103, 294, '一个熟悉的比值', 18, muted)}${text(103, 343, '平均变化率 = Δy / Δx', 31, ink, 'font-family="Georgia,serif"')}${text(103, 384, '纵向的变化 ÷ 横向的变化', 19, muted)}${text(101, 472, '两个点之间 → 平均变化率', 25)}${text(101, 545, '某一个瞬间 → 瞬时变化率', 25)}${line(646, 589, 646, 255)}${line(646, 589, 1100, 589)}<path d="M 674 558 Q 840 514 1055 265" fill="none" stroke="${green}" stroke-width="4"/><path d="M 733 543 L 1026 331" fill="none" stroke="#b7bc8e" stroke-width="2.5" stroke-dasharray="8 6"/><circle cx="827" cy="475" r="6" fill="${green}"/><circle cx="991" cy="356" r="6" fill="${green}"/>${line(827, 475, 991, 475, '#b7bc8e')}${line(991, 475, 991, 356, '#b7bc8e')}${text(895, 593, 'Δx', 24, green)}${text(1007, 424, 'Δy', 24, green)}${text(800, 455, 'A', 20, green)}${text(1001, 339, 'B', 20, green)}${text(1072, 281, 'f(x)', 22, green)}`),
    targets: [{ id: 'rate', text: '平均变化率 = Δy / Δx', x: .083, y: .382, w: .31, h: .095 }, { id: 'instant', text: '某一个瞬间 → 瞬时变化率', x: .083, y: .676, w: .28, h: .055 }], demoLesson: lesson1,
  },
  {
    title: '让两个点无限靠近', subtitle: '从直觉走到导数的定义', width: 1200, height: 750,
    text: "导数定义：f′(x) = lim(h→0) [f(x+h) − f(x)] / h。h 不等于零，通过极限研究 h 趋近于零时，比值趋近的值。导数存在要求该极限存在。",
    image: slideArt(2, '把“靠近”写成一个公式', '导数，是平均变化率在区间无限缩小时的极限。',
      `<rect x="72" y="251" width="1056" height="178" rx="8" fill="#f0f2e9"/>${text(135, 350, 'f′(x) = lim', 44, ink, 'font-family="Georgia,serif"')}${text(322, 386, 'h → 0', 23, green, 'font-family="Georgia,serif"')}${text(541, 321, 'f(x + h) − f(x)', 38, ink, 'font-family="Georgia,serif"')}${line(505, 341, 942, 341, ink)}${text(710, 391, 'h', 38, ink, 'font-family="Georgia,serif"')}${text(95, 499, '01', 20, green)}${text(153, 499, 'h：横向迈出的一小步', 26)}${text(95, 562, '02', 20, green)}${text(153, 562, '分子：函数值随之发生的变化', 26)}${text(95, 625, '03', 20, green)}${text(153, 625, '取极限，而不是直接除以零', 26)}`),
    targets: [{ id: 'h', text: 'h', x: .575, y: .475, w: .055, h: .06 }, { id: 'numerator', text: 'f(x + h) − f(x)', x: .445, y: .373, w: .3, h: .067 }, { id: 'limit', text: 'h → 0', x: .263, y: .477, w: .11, h: .048 }],
    demoLesson: { source: 'demo', beats: [
      { speech: '看分母里的 h，它是横向迈出的一小步。我们始终先让 h 不等于零，再研究它趋近于零的过程。', actions: [a('circle', .575, .475, .055, .06)], board: 'h ≠ 0\n“趋近于零”不等于“直接代入零”。' },
      { speech: '分子是走出这一步后，函数值发生的变化。分子除以 h，仍然是两个点之间的平均变化率。', actions: [a('underline', .445, .373, .3, .067)], board: 'Δy = f(x + h) − f(x)\n平均变化率 = [f(x + h) − f(x)] / h' },
      { speech: '最后让 h 趋近于零。如果这个比值趋向一个确定的值，我们就把它叫作该点的导数。', actions: [a('circle', .263, .477, .11, .048)], board: '补充：不是每个函数在每个点都有导数。\n例如 |x| 在 x = 0 的左右斜率不同。' },
    ], quiz: { question: '公式中的 h → 0，表示什么？', options: ['直接把 h 取为零再相除', '研究 h 趋近于零时比值的极限', '函数值一定等于零'], answer: 1, explanation: '先计算 h ≠ 0 时的比值，再研究趋近过程；不能直接除以零。' } },
  },
  {
    title: '亲手求一次导数', subtitle: '用定义验证 f(x) = x²', width: 1200, height: 750,
    text: "f(x)=x²。差商 [(x+h)²−x²]/h = [2xh+h²]/h = 2x+h（h≠0）。h→0 时得到 f′(x)=2x。在 x=3 时，导数为6。",
    image: slideArt(3, '用一个例子，把它算出来', '如果 f(x) = x²，在 x = 3 处，变化有多快？',
      `${text(100, 294, '①  写出差商', 23, green)}${text(365, 294, '[(x + h)² − x²] / h', 34, ink, 'font-family="Georgia,serif"')}${line(99, 330, 1095, 330, '#e7e9df', 1)}${text(100, 393, '②  展开并约去 h', 23, green)}${text(365, 393, '(2xh + h²) / h = 2x + h', 34, ink, 'font-family="Georgia,serif"')}${line(99, 429, 1095, 429, '#e7e9df', 1)}${text(100, 492, '③  令 h 趋近于 0', 23, green)}${text(365, 492, 'f′(x) = 2x', 38, ink, 'font-family="Georgia,serif"')}<rect x="100" y="549" width="994" height="83" rx="8" fill="#f0f2e9"/>${text(133, 601, '所以，在 x = 3 处，瞬时变化率是 6。', 27)}`),
    targets: [{ id: 'expand', text: '(2xh + h²) / h = 2x + h', x: .3, y: .48, w: .42, h: .055 }, { id: 'result', text: 'f′(x) = 2x', x: .3, y: .6, w: .19, h: .067 }],
    demoLesson: { source: 'demo', beats: [
      { speech: '我们来求 x 平方的导数。先把 x 加 h 代进去，再减去原来的 x 平方，最后除以 h。', actions: [a('underline', .3, .346, .36, .06)], board: '(x + h)² = x² + 2xh + h²' },
      { speech: '展开后，分子含有公因子 h。因为此时 h 不等于零，所以可以约去，得到二 x 加 h。', actions: [a('circle', .3, .48, .42, .055)], board: '关键条件：h ≠ 0\n(2xh + h²) / h = 2x + h' },
      { speech: '现在再取极限，h 趋近于零，剩下二 x。在 x 等于三时，导数就是六。注意，函数值是九，导数是六，含义不同。', actions: [a('circle', .3, .6, .19, .067)], board: 'f(3) = 9 → 曲线的高度\nf′(3) = 6 → 此处的变化率' },
    ], quiz: { question: 'f(x) = x²，在 x = 2 处的导数是多少？', options: ['2', '4', '8'], answer: 1, explanation: 'f′(x) = 2x，代入 x = 2，得到 4。' } },
  },
];
export function demoAnswer(question: string, page: number): Lesson | null {
  if (/约|除以零|h.*0|零/.test(question)) return { source: 'demo', beats: [{ speech: '这里约去 h 的前提是 h 不等于零。我们先把非零 h 对应的比值化简，再讨论它趋近于零的极限。', actions: page === 1 ? [a('circle', .575, .475, .055, .06)] : [], board: '补充：先化简，再取极限。\nh ≠ 0 时才可约去 h。' }] };
  if (/斜率|变化|导数|例子|不懂|再讲|慢/.test(question)) return { source: 'demo', beats: [{ speech: '补充一个速度的例子。一小时开了六十公里，描述的是这一小时的平均速度；而速度表显示的是当前瞬间的速度。平均变化率和导数之间，就有类似的关系。', actions: page === 0 ? [a('underline', .083, .676, .28, .055)] : [], board: '补充例子\n全程路程 ÷ 全程时间 → 平均速度\n速度表的当前读数 → 瞬时速度\n导数关注“此刻变化多快”。' }] };
  return null;
}

