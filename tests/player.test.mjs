import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile(new URL('../src/player.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source.replace('../shared/speech.mjs', new URL('../shared/speech.mjs', import.meta.url).href), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { LessonPlayer } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
let sequence = 0;
const timers = new Map();
let spoken;
globalThis.window = {
  setTimeout(fn) { const id = ++sequence; timers.set(id, fn); return id; },
  clearTimeout(id) { timers.delete(id); },
  setInterval() { return ++sequence; }, clearInterval() {}, speechSynthesis: {},
};
globalThis.speechSynthesis = { cancel() {}, speak(u) { spoken = u; }, getVoices() { return []; } };
globalThis.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
const beat = { speech: '测试讲解', actions: [], board: '' };
test('drawing waits for actual speech start and only starts once', () => {
  const player = new LessonPlayer(); let starts = 0, ends = 0;
  player.play(beat, () => starts++, () => ends++);
  assert.equal(starts, 0); spoken.onstart(); spoken.onstart(); assert.equal(starts, 1);
  spoken.onend(); spoken.onend(); assert.equal(ends, 1); player.cancel();
});
test('late audio callbacks after interruption cannot draw or advance the lesson', () => {
  const player = new LessonPlayer(); let starts = 0, ends = 0;
  player.play(beat, () => starts++, () => ends++); const previous = spoken;
  player.cancel(); previous.onstart(); previous.onend(); previous.onerror();
  assert.equal(starts, 0); assert.equal(ends, 0); assert.equal(player.active, false);
});
test('a new teaching segment invalidates callbacks from the previous segment', () => {
  const player = new LessonPlayer(); let old = 0, current = 0;
  player.play(beat, () => old++, () => old++); const previous = spoken;
  player.play(beat, () => current++, () => current++);
  previous.onend(); previous.onstart(); spoken.onstart();
  assert.equal(old, 0); assert.equal(current, 1); player.cancel();
});
test('no voice mode has cancellable reading-pace playback', () => {
  timers.clear(); const player = new LessonPlayer(); player.voiceEnabled = false; let ends = 0, starts = 0;
  player.play(beat, () => starts++, () => ends++); assert.equal(starts, 1); const old = [...timers.values()][0];
  player.cancel(); old(); assert.equal(ends, 0); assert.equal(timers.size, 0);
});

test('Chinese explanations switch to an English voice for letters and cancel the entire queue', () => {
  const oldVoices = speechSynthesis.getVoices;
  const zh = { voiceURI: 'zh', lang: 'zh-CN' }, en = { voiceURI: 'en', lang: 'en-US' };
  speechSynthesis.getVoices = () => [zh, en];
  const player = new LessonPlayer(); let starts = 0, ends = 0;
  try {
    player.play({ ...beat, speech: '这里 R_{ij} 等于零。' }, () => starts++, () => ends++);
    assert.equal(spoken.voice, zh); spoken.onstart(); spoken.onend();
    for (const text of ['R', 'I']) {
      assert.equal(spoken.lang, 'en-US'); assert.equal(spoken.voice, en); assert.equal(spoken.text, text);
      spoken.onstart(); spoken.onend();
    }
    assert.equal(spoken.text, 'J');
    const letter = spoken; letter.onstart(); assert.equal(starts, 1);
    player.cancel(); letter.onend(); assert.equal(ends, 0); assert.equal(spoken, letter);
  } finally { player.cancel(); speechSynthesis.getVoices = oldVoices; }
});

test('API audio advances safely to the next segment and is cancelled on pause', async () => {
  const originalFetch = globalThis.fetch; const audios = [], requests = [];
  globalThis.Audio = class {
    constructor(url) { this.src = url; audios.push(this); }
    play() { return Promise.resolve(); }
    pause() { this.paused = true; }
    removeAttribute() { this.src = ''; }
  };
  globalThis.fetch = async (_, options) => { requests.push(options); return new Response(new Blob(['audio'], { type: 'audio/mpeg' })); };
  const player = new LessonPlayer(); player.provider = 'api'; let starts = 0, ends = 0;
  try {
    player.play({ ...beat, speech: '这里 R_{ij}' }, () => starts++, () => {
      ends++; player.play(beat, () => starts++, () => ends++);
    });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(starts, 1); assert.equal(JSON.parse(requests[0].body).text, '这里，');
    audios[0].onended();
    await new Promise(resolve => setImmediate(resolve));
    for (let i = 1; i <= 3; i++) {
      assert.equal(JSON.parse(requests[i].body).text, ['R', 'I', 'J'][i - 1]);
      assert.equal(ends, 0);
      audios[i].onended();
      await new Promise(resolve => setImmediate(resolve));
    }
    assert.equal(starts, 2); assert.equal(ends, 1); assert.ok(player.active);
    const late = audios[4].onended;
    player.cancel(); late();
    assert.equal(ends, 1); assert.equal(audios[4].paused, true); assert.equal(requests[4].signal.aborted, true);
  } finally { player.cancel(); globalThis.fetch = originalFetch; delete globalThis.Audio; }
});

test('an interrupted TTS request cannot play late audio', async () => {
  const originalFetch = globalThis.fetch; let resolveRequest, starts = 0;
  globalThis.fetch = () => new Promise(resolve => { resolveRequest = resolve; });
  const player = new LessonPlayer(); player.provider = 'api';
  try {
    player.play(beat, () => starts++, () => {}); player.cancel();
    resolveRequest(new Response(new Blob(['audio'])));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(starts, 0); assert.equal(player.active, false);
  } finally { globalThis.fetch = originalFetch; }
});

test('early TTS preparation overlaps board generation without duplicate synthesis', async () => {
  const originalFetch = globalThis.fetch, requests = [], audios = [];
  globalThis.fetch = async (_, options) => { requests.push(options); return new Response(new Blob(['audio'])); };
  globalThis.Audio = class {
    constructor() { audios.push(this); }
    play() { return Promise.resolve(); } pause() {} removeAttribute() {}
  };
  const player = new LessonPlayer(); player.provider = 'api'; let starts = 0;
  try {
    player.prepare(beat.speech); player.prepare(beat.speech);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(requests.length, 1); assert.equal(audios.length, 0);
    player.play(beat, () => starts++, () => {});
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(requests.length, 1); assert.equal(starts, 1);
  } finally { player.cancel(); globalThis.fetch = originalFetch; delete globalThis.Audio; }
});

test('next language fragment is synthesized during playback and pause aborts prefetch', async () => {
  const originalFetch = globalThis.fetch, requests = [], audios = [];
  globalThis.fetch = async (_, options) => { requests.push(options); return new Response(new Blob(['audio'])); };
  globalThis.Audio = class {
    constructor() { audios.push(this); }
    play() { return Promise.resolve(); } pause() {} removeAttribute() {}
  };
  const player = new LessonPlayer(); player.provider = 'api';
  try {
    player.play({ ...beat, speech: '这里 R_{ij}' }, () => {}, () => {});
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(requests.map(r => JSON.parse(r.body).text), ['这里，', 'R']);
    assert.equal(audios.length, 1, 'prefetch must not play the next fragment');
    player.prepare('下一段讲解'); player.prepare('第三段'); player.prepare('第四段');
    assert.equal(requests.length, 3, 'speculative queue is bounded');
    const late = audios[0].onended; player.cancel(); late();
    assert.ok(requests.every(r => r.signal.aborted));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(audios.length, 1);
  } finally { player.cancel(); globalThis.fetch = originalFetch; delete globalThis.Audio; }
});
