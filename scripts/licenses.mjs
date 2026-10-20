import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
const out = resolve('dist/licenses'); mkdirSync(out, { recursive: true });
for (const pkg of ['konva', 'pdfjs-dist', 'lucide', 'perfect-freehand', 'roughjs', 'hachure-fill', 'path-data-parser', 'points-on-curve', 'points-on-path']) {
  const source = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'license', 'license.md', 'license.txt'].map(name => resolve('node_modules', pkg, name)).find(existsSync);
  if (!source) throw new Error(`License not found for ${pkg}`);
  copyFileSync(source, resolve(out, `${pkg}.txt`));
}
copyFileSync('THIRD_PARTY_NOTICES.md', resolve(out, 'THIRD_PARTY_NOTICES.md'));
