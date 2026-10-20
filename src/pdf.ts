import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { Slide, Target } from './types';
import { textBounds } from '../shared/pdf-bounds.mjs';
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
export async function readPDF(data: ArrayBuffer, progress: (n: number, total: number) => void): Promise<Slide[]> {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data.slice(0)), cMapUrl: '/pdfjs/cmaps/', cMapPacked: true, standardFontDataUrl: '/pdfjs/standard_fonts/', wasmUrl: '/pdfjs/wasm/' }).promise;
  try {
    if (doc.numPages > 60) throw new Error('首版支持最多 60 页课件，请先拆分文件');
    const slides: Slide[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      progress(n, doc.numPages);
      const page = await doc.getPage(n); const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: 1200 / base.width });
      const canvas = document.createElement('canvas'); canvas.width = Math.round(viewport.width); canvas.height = Math.round(viewport.height);
      await page.render({ canvas, viewport }).promise;
      const text = await page.getTextContent();
      const targets: Target[] = [];
      for (const item of text.items) {
        if (!('str' in item) || !item.str.trim()) continue;
        const t = pdfjs.Util.transform(viewport.transform, item.transform);
        const bounds = textBounds(t, item.width * viewport.scale, text.styles[item.fontName], viewport.width, viewport.height);
        if (bounds.w <= 0 || bounds.h <= 0) continue;
        let charEdges: number[] | undefined;
        if (Math.abs(t[1]) < .01 && Math.abs(t[2]) < .01 && item.dir !== 'rtl') {
          const context = canvas.getContext('2d')!;
          context.font = `${Math.hypot(t[2], t[3])}px ${text.styles[item.fontName]?.fontFamily || 'sans-serif'}`;
          const full = context.measureText(item.str).width;
          if (full > 0) charEdges = Array.from({ length: item.str.length + 1 }, (_, i) => context.measureText(item.str.slice(0, i)).width / full);
        }
        targets.push({ id: `p${n}-t${targets.length}`, text: item.str, ...bounds, ...(charEdges ? { charEdges } : {}) });
      }
      slides.push({ title: targets.slice(0, 3).map(t => t.text).join(' ').slice(0, 36) || `第 ${n} 页`, subtitle: `课件第 ${n} 页`, text: targets.map(t => t.text).join('\n'), targets, image: canvas.toDataURL('image/jpeg', .82), width: canvas.width, height: canvas.height });
      canvas.width = 0; canvas.height = 0; page.cleanup();
    }
    return slides;
  } finally { await doc.destroy(); }
}
