import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadEnv, saveEnv } from '../server/env.mjs';

test('saved credentials survive reload, preserve unrelated settings, and reject injected lines', () => {
  const directory = mkdtempSync(join(tmpdir(), 'qingke-env-'));
  const file = join(directory, '.env');
  try {
    writeFileSync(file, '# Local settings\nPORT=8787\nAI_API_KEY=old\nAI_API_KEY=duplicate\n');
    saveEnv(file, { AI_API_KEY: 'key#with spaces', AI_MODEL: '中文模型', TTS_API_KEY: 'tts-secret' });
    const restored = {}; loadEnv(file, restored);
    assert.deepEqual(restored, { PORT: '8787', AI_API_KEY: 'key#with spaces', AI_MODEL: '中文模型', TTS_API_KEY: 'tts-secret' });
    assert.ok(readFileSync(file, 'utf8').startsWith('# Local settings\n'));
    const overridden = { AI_MODEL: 'external' }; loadEnv(file, overridden);
    assert.equal(overridden.AI_MODEL, 'external');
    const previous = readFileSync(file, 'utf8');
    assert.throws(() => saveEnv(file, { AI_API_KEY: 'key\nPORT=9999' }), /换行/);
    assert.equal(readFileSync(file, 'utf8'), previous);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
