// Match PDF.js font ascent/descent and transform all four corners, including rotated text.
export function textBounds(transform, advance, style, pageWidth, pageHeight) {
  const [a, b, c, d, x, y] = transform;
  const size = Math.hypot(a, b) || 1;
  const ascent = Number.isFinite(style?.ascent) ? style.ascent : Number.isFinite(style?.descent) ? 1 + style.descent : .8;
  const points = [0, advance].flatMap(offset => [ascent, ascent - 1].map(vertical => [x + a / size * offset + c * vertical, y + b / size * offset + d * vertical]));
  const left = Math.max(0, Math.min(pageWidth, Math.min(...points.map(p => p[0]))));
  const top = Math.max(0, Math.min(pageHeight, Math.min(...points.map(p => p[1]))));
  const right = Math.max(left, Math.min(pageWidth, Math.max(...points.map(p => p[0]))));
  const bottom = Math.max(top, Math.min(pageHeight, Math.max(...points.map(p => p[1]))));
  return { x: left / pageWidth, y: top / pageHeight, w: (right - left) / pageWidth, h: (bottom - top) / pageHeight };
}
