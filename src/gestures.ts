/* Adapted from saintade/trace src/lib/canvas-actions.ts buildGesturePoints.
 * MIT, Copyright (c) 2026 Samuel Adesuyi. Full notice: THIRD_PARTY_NOTICES.md.
 * Changed to target rectangles, normalized coordinates and persistent Konva strokes.
 */
import type { Action } from './types';
export function gesturePoints(action: Action, width: number, height: number): number[] {
  const x = action.x * width, y = action.y * height;
  const w = action.w * width, h = action.h * height;
  if (action.type === 'underline') {
    return Array.from({ length: 28 }, (_, index) => {
      const progress = index / 27;
      return [x + w * progress, Math.min(height - 2 * width / 1200, y + h + 3 * width / 1200)];
    }).flat();
  }
  if (action.type === 'arrow') return [x, y, x + w, y + h];
  return Array.from({ length: 42 }, (_, index) => {
    const angle = (index / 41) * Math.PI * 2;
    return [x + w / 2 + Math.cos(angle) * (w / 2 + 9), y + h / 2 + Math.sin(angle) * (h / 2 + 7)];
  }).flat();
}
