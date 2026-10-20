import Konva from 'konva';
import { getStroke } from 'perfect-freehand';
import rough from 'roughjs';
import { gesturePoints } from './gestures';
import type { Action } from './types';
export type Ink = Action & { id: string; color?: string; points?: number[] };
export class SlideBoard {
  stage: Konva.Stage;
  layer: Konva.Layer;
  width = 1200;
  height = 750;
  ink: Ink[] = [];
  tool: 'pointer' | 'pen' | 'erase' = 'pointer';
  onChange: (ink: Ink[]) => void = () => {};
  private animation: Konva.Animation | null = null;
  private drawing: Ink | null = null;
  private rough = rough.generator();
  constructor(container: HTMLDivElement) {
    this.stage = new Konva.Stage({ container, width: 1200, height: 750 });
    this.layer = new Konva.Layer(); this.stage.add(this.layer);
    const holder = container.parentElement!;
    new ResizeObserver(() => {
      const width = holder.clientWidth;
      this.stage.width(width); this.stage.height(width * this.height / this.width);
      this.stage.scale({ x: width / this.width, y: width / this.width });
    }).observe(holder);
    this.stage.on('mousedown touchstart', e => {
      if (this.tool === 'pointer') return;
      e.evt.preventDefault();
      if (this.tool === 'erase') {
        const id = e.target.attrs.inkId; if (id) { this.ink = this.ink.filter(i => i.id !== id); this.redraw(); this.onChange(this.ink); } return;
      }
      const p = this.position(); if (!p) return;
      this.drawing = { id: crypto.randomUUID(), type: 'underline', x: 0, y: 0, w: 0, h: 0, points: [p.x, p.y], color: '#426b58' };
      this.ink.push(this.drawing); this.redraw();
    });
    this.stage.on('mousemove touchmove', e => {
      if (!this.drawing) return; e.evt.preventDefault(); const p = this.position(); if (!p) return;
      this.drawing.points!.push(p.x, p.y); this.redraw();
    });
    const end = () => { if (this.drawing) { this.drawing = null; this.redraw(); this.onChange(this.ink); } };
    this.stage.on('mouseup touchend mouseleave', end);
  }
  private position() {
    const p = this.stage.getPointerPosition(); if (!p) return null;
    return { x: Math.max(0, Math.min(1, p.x / this.stage.scaleX() / this.width)), y: Math.max(0, Math.min(1, p.y / this.stage.scaleY() / this.height)) };
  }
  setPage(width: number, height: number, ink: Ink[]) {
    this.stopAnimation(); this.width = width; this.height = height; this.ink = structuredClone(ink);
    const physical = this.stage.container().parentElement!.clientWidth;
    this.stage.width(physical); this.stage.height(physical * height / width); this.stage.scale({ x: physical / width, y: physical / width }); this.redraw();
  }
  setTool(tool: typeof this.tool) { this.tool = tool; this.stage.container().style.cursor = tool === 'pen' ? 'crosshair' : tool === 'erase' ? 'cell' : 'default'; }
  stopAnimation() { this.animation?.stop(); this.animation = null; this.redraw(); }
  clear() { this.stopAnimation(); this.ink = []; this.redraw(); this.onChange(this.ink); }
  undo() { this.stopAnimation(); this.ink.pop(); this.redraw(); this.onChange(this.ink); }
  private node(ink: Ink) {
    const color = ink.color || (ink.type === 'highlight' ? '#ffe27a' : ink.type === 'underline' || ink.type === 'note' ? '#8960db' : '#bd624b');
    const unit = this.width / 1200;
    const attrs = { inkId: ink.id, stroke: color, strokeWidth: 2.6 * unit, lineCap: 'round' as const, lineJoin: 'round' as const, strokeScaleEnabled: true };
    if (ink.points) {
      const samples = Array.from({ length: ink.points.length / 2 }, (_, i) => [ink.points![i * 2] * this.width, ink.points![i * 2 + 1] * this.height]);
      const outline = getStroke(samples, { size: 4 * unit, thinning: .35, smoothing: .65, streamline: .6, last: this.drawing?.id !== ink.id });
      return new Konva.Line({ inkId: ink.id, points: outline.flat(), closed: true, fill: color, tension: .25, hitStrokeWidth: 14 * unit });
    }
    if (['circle', 'underline', 'highlight'].includes(ink.type)) {
      const x = ink.x * this.width, y = ink.y * this.height, w = ink.w * this.width, h = ink.h * this.height;
      const seed = [...ink.id].reduce((hash, c) => (hash * 31 + c.charCodeAt(0)) >>> 0, 1) % 2147483646 + 1;
      const options = { seed, stroke: color, strokeWidth: 1.7 * unit, roughness: .65, bowing: .7, disableMultiStroke: true };
      const drawing = ink.type === 'circle'
        ? this.rough.ellipse(x + w / 2, y + h / 2, w + 9 * unit, h + 7 * unit, options)
        : ink.type === 'highlight'
          ? this.rough.rectangle(x - unit, y + h * .12, w + 2 * unit, h * .83, { ...options, stroke: 'none', fill: color, fillStyle: 'solid', roughness: .8 })
          : this.rough.line(x, y + h + 2 * unit, x + w, y + h + 2 * unit, options);
      const group = new Konva.Group({ inkId: ink.id });
      for (const path of this.rough.toPaths(drawing)) group.add(new Konva.Path({
        inkId: ink.id, data: path.d, stroke: path.stroke === 'none' ? undefined : path.stroke,
        strokeWidth: path.strokeWidth, fill: path.fill === 'none' ? undefined : path.fill,
        opacity: ink.type === 'highlight' ? .4 : 1, lineCap: 'round', lineJoin: 'round', hitStrokeWidth: 12 * unit,
      }));
      return group;
    }
    if (ink.type === 'note') return new Konva.Text({ inkId: ink.id, x: ink.x * this.width, y: ink.y * this.height, width: Math.max(ink.w * this.width, 100), text: ink.text || '', fontSize: 22, fill: color, fontFamily: 'Microsoft YaHei, sans-serif', lineHeight: 1.5 });
    const points = gesturePoints(ink, this.width, this.height);
    if (ink.type === 'arrow') {
      const x = ink.x * this.width, y = ink.y * this.height, center = y + ink.h * this.height / 2;
      const anchored = x > 40 * unit ? [x - 36 * unit, center, x - 4 * unit, center] : [x + ink.w * this.width / 2, Math.max(2 * unit, y - 36 * unit), x + ink.w * this.width / 2, Math.max(2 * unit, y - 4 * unit)];
      return new Konva.Arrow({ ...attrs, points: ink.targetId ? anchored : points, fill: color, pointerLength: 8 * unit, pointerWidth: 7 * unit, hitStrokeWidth: 18 * unit });
    }
    return new Konva.Line({ ...attrs, points, hitStrokeWidth: 18 * unit });
  }
  redraw() { this.layer.destroyChildren(); this.ink.forEach(ink => this.layer.add(this.node(ink))); this.layer.batchDraw(); }
  add(actions: Action[], prefix: string) {
    this.stopAnimation();
    const added = actions.map((action, i) => ({ ...action, id: `${prefix}-${i}` }));
    for (const ink of added) if (!this.ink.some(i => i.id === ink.id)) this.ink.push(ink);
    this.redraw(); this.onChange(this.ink);
    const nodes = added.map(ink => this.layer.findOne((n: Konva.Node) => n.attrs.inkId === ink.id)).filter(Boolean) as Konva.Node[];
    this.animation = new Konva.Animation(frame => {
      const ratio = Math.min(1, (frame?.time || 0) / 650);
      for (const node of nodes) {
        const ink = this.ink.find(i => i.id === node.getAttr('inkId')); if (!ink) continue;
        if (node instanceof Konva.Group) {
          if (ink.type === 'highlight') { node.clipX(0); node.clipY(0); node.clipWidth((ink.x + ink.w * ratio) * this.width + 3); node.clipHeight(this.height); }
          else for (const path of node.getChildren()) { if (path instanceof Konva.Path) { const length = path.getLength(); path.dash([length, length]); path.dashOffset(length * (1 - ratio)); } }
        }
        else if (node instanceof Konva.Line && ink.type !== 'arrow') { const p = gesturePoints(ink, this.width, this.height); node.points(p.slice(0, Math.max(4, Math.ceil(ratio * p.length / 2) * 2))); }
        else node.opacity(ratio);
      }
      if (ratio === 1) { this.animation?.stop(); this.animation = null; }
    }, this.layer); this.animation.start();
  }
}
