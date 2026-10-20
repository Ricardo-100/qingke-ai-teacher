import { existsSync, readFileSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { parseEnv } from 'node:util';

export function loadEnv(file, target = process.env) {
  if (!existsSync(file)) return;
  for (const [key, value] of Object.entries(parseEnv(readFileSync(file, 'utf8')))) {
    if (target[key] === undefined) target[key] = value;
  }
}

export function saveEnv(file, values) {
  const lines = (existsSync(file) ? readFileSync(file, 'utf8') : '').split(/\r?\n/);
  const pending = new Map(Object.entries(values).map(([key, value]) => {
    const text = String(value);
    const quote = ['"', "'", '`'].find(q => !text.includes(q));
    if (!quote || /[\r\n\0]/.test(text)) throw new Error('配置不能包含换行或混合引号');
    const line = `${key}=${quote}${text}${quote}`;
    if (parseEnv(line)[key] !== text) throw new Error('配置格式无法保存');
    return [key, line];
  }));
  const seen = new Set();
  const output = lines.flatMap(line => {
    const key = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/)?.[1];
    if (!pending.has(key)) return [line];
    if (seen.has(key)) return [];
    seen.add(key); return [pending.get(key)];
  });
  for (const [key, line] of pending) if (!seen.has(key)) output.push(line);
  const temp = `${file}.${process.pid}.tmp`;
  try {
    writeFileSync(temp, output.join('\n').replace(/\n*$/, '\n'), { mode: 0o600 });
    renameSync(temp, file);
  } catch {
    throw new Error('无法保存本地 .env，请检查项目目录的写入权限');
  } finally { rmSync(temp, { force: true }); }
}
