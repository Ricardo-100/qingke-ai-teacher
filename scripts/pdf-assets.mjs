import { cpSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const output = resolve('public/pdfjs'); mkdirSync(output, { recursive: true });
for (const folder of ['cmaps', 'standard_fonts', 'wasm']) cpSync(resolve('node_modules/pdfjs-dist', folder), resolve(output, folder), { recursive: true });
