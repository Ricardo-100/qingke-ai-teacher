import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTTSBaseUrl } from '../server/tts.mjs';
test('Step Plan accepts HTTPS base and a copied full synthesis endpoint', () => {
  const base = 'https://api.stepfun.com/step_plan/v1';
  assert.equal(normalizeTTSBaseUrl(base), base);
  assert.equal(normalizeTTSBaseUrl(` ${base}/audio/speech/ `), base);
  assert.equal(normalizeTTSBaseUrl('http://127.0.0.1:8080/v1'), 'http://127.0.0.1:8080/v1');
});
test('TTS address errors distinguish insecure HTTP, WebSocket, credentials and URL fragments', () => {
  assert.throws(() => normalizeTTSBaseUrl('http://api.stepfun.com/step_plan/v1'), /你填写的是 http/);
  assert.throws(() => normalizeTTSBaseUrl('wss://api.stepfun.com/step_plan/v1/realtime/audio'), /WebSocket/);
  assert.throws(() => normalizeTTSBaseUrl('https://api.stepfun.com/step_plan/v1#test'), /片段/);
  assert.throws(() => normalizeTTSBaseUrl('https://api.stepfun.com/step_plan/v1?token=hidden'), /查询参数/);
  assert.throws(() => normalizeTTSBaseUrl('https://name:secret@api.stepfun.com/v1'), /账号或密码/);
  assert.throws(() => normalizeTTSBaseUrl('https://api.stepfun.com/step_plan/v1/audio/voices/preview'), /音色试听/);
});
