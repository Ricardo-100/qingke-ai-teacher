import { spawn } from 'node:child_process';
const children = [
  spawn(process.execPath, ['--watch', 'server/index.mjs'], { stdio: 'inherit', env: { ...process.env, NODE_ENV: 'development' } }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js'], { stdio: 'inherit' }),
];
let closing = false;
function close(code = 0) { if (closing) return; closing = true; children.forEach(p => p.kill()); process.exit(code); }
process.on('SIGINT', () => close()); process.on('SIGTERM', () => close());
children.forEach(p => p.on('exit', code => { if (!closing) close(code || 0); }));
