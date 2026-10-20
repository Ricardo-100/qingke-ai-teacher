import type { Beat } from './types';
import { speechSegments } from '../shared/speech.mjs';
// Cancellation invalidates every callback from the old utterance, including late onend events.
export class LessonPlayer {
  private generation = 0;
  private timer = 0;
  private heartbeat = 0;
  private controller: AbortController | null = null;
  private audio: HTMLAudioElement | null = null;
  private audioUrl = '';
  private prepared = new Map<string, { controller: AbortController; audio: Promise<Blob | null> }>();
  provider: 'browser' | 'api' = 'browser';
  voiceURI = '';
  englishVoiceURI = '';
  cleanSymbols = true;
  spellVariables = true;
  pitch = 1;
  volume = 1;
  rate = 1;
  voiceEnabled = true;
  active = false;
  onVoiceUnavailable: () => void = () => {};
  onPreparing: (preparing: boolean) => void = () => {};
  private requestAudio(text: string) {
    const controller = new AbortController();
    const audio = fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, speed: this.rate }), signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error('语音合成失败'); return response.blob(); })
      .catch(() => null);
    return { controller, audio };
  }
  private audioKey(text: string) { return JSON.stringify([this.rate, text]); }
  private prepareText(text: string) {
    const key = this.audioKey(text);
    // Bound speculative work to two audio fragments. Pause aborts both immediately.
    if (!this.prepared.has(key) && this.prepared.size < 2) this.prepared.set(key, this.requestAudio(text));
  }
  prepare(speech: string) {
    if (!this.voiceEnabled || this.provider !== 'api') return;
    const first = speechSegments(speech, this.cleanSymbols, this.spellVariables)[0];
    if (first) this.prepareText(first.text);
  }
  cancel() {
    this.stopPlayback();
    for (const request of this.prepared.values()) request.controller.abort();
    this.prepared.clear();
  }
  private stopPlayback() {
    this.generation++; this.active = false;
    window.clearTimeout(this.timer); window.clearInterval(this.heartbeat);
    this.controller?.abort(); this.controller = null;
    if (this.audio) { this.audio.onended = null; this.audio.onerror = null; this.audio.pause(); this.audio.removeAttribute('src'); this.audio = null; }
    if (this.audioUrl) URL.revokeObjectURL(this.audioUrl); this.audioUrl = '';
    this.onPreparing(false);
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  }
  play(beat: Beat, onStart: () => void, onEnd: () => void) {
    this.stopPlayback(); this.active = true; const token = this.generation;
    let started = false, ended = false;
    const start = () => { if (token !== this.generation || started) return; started = true; onStart(); };
    const finish = () => { if (token !== this.generation || ended) return; ended = true; this.active = false; window.clearTimeout(this.timer); window.clearInterval(this.heartbeat); onEnd(); };
    const timed = () => { start(); this.timer = window.setTimeout(finish, Math.max(3000, beat.speech.length * 130 / this.rate)); };
    if (!this.voiceEnabled) { timed(); return; }
    const segments = speechSegments(beat.speech, this.cleanSymbols, this.spellVariables);
    if (!segments.length) { timed(); return; }
    const rate = this.rate, pitch = this.pitch, volume = this.volume;
    const voiceURI = this.voiceURI, englishVoiceURI = this.englishVoiceURI;
    if (this.provider === 'api') {
      this.onPreparing(true);
      const nextAudio = async (index: number): Promise<void> => {
        if (token !== this.generation) return;
        if (index >= segments.length) { finish(); return; }
        this.onPreparing(true);
        try {
          const key = this.audioKey(segments[index].text);
          const request = this.prepared.get(key) || this.requestAudio(segments[index].text);
          this.prepared.delete(key); this.controller = request.controller;
          const blob = await request.audio; if (token !== this.generation) return;
          if (!blob) throw new Error('语音合成失败');
          if (index + 1 < segments.length) this.prepareText(segments[index + 1].text);
          this.audioUrl = URL.createObjectURL(blob); const audio = new Audio(this.audioUrl); this.audio = audio; audio.volume = volume;
          let advanced = false;
          audio.onended = () => { if (token !== this.generation || advanced) return; advanced = true; URL.revokeObjectURL(this.audioUrl); this.audioUrl = ''; this.audio = null; void nextAudio(index + 1); };
          audio.onerror = () => { if (token !== this.generation) return; this.onPreparing(false); this.onVoiceUnavailable(); timed(); };
          await audio.play(); if (token !== this.generation) return; this.onPreparing(false); start();
        } catch { if (token !== this.generation) return; this.onPreparing(false); this.onVoiceUnavailable(); timed(); }
      };
      void nextAudio(0);
      return;
    }
    if (!('speechSynthesis' in window)) { this.onVoiceUnavailable(); timed(); return; }
    const nextVoice = (index: number) => {
      if (token !== this.generation) return;
      if (index >= segments.length) { finish(); return; }
      const segment = segments[index];
      const voice = new SpeechSynthesisUtterance(segment.text);
      voice.lang = segment.lang; voice.rate = rate; voice.pitch = pitch; voice.volume = volume;
      const voices = speechSynthesis.getVoices();
      const english = segment.lang === 'en-US', language = english ? /^en/i : /^zh/i;
      const chosen = voices.find(v => v.voiceURI === (english ? englishVoiceURI : voiceURI) && language.test(v.lang))
        || voices.find(v => v.lang === segment.lang) || voices.find(v => language.test(v.lang));
      if (chosen) voice.voice = chosen;
      let advanced = false;
      voice.onstart = () => { if (token !== this.generation) return; window.clearTimeout(this.timer); start(); };
      voice.onend = () => { if (token !== this.generation || advanced) return; advanced = true; window.clearTimeout(this.timer); start(); nextVoice(index + 1); };
      voice.onerror = () => { if (token !== this.generation || advanced) return; advanced = true; window.clearTimeout(this.timer); this.onVoiceUnavailable(); timed(); };
      this.timer = window.setTimeout(() => {
        if (token !== this.generation || advanced) return;
        advanced = true; voice.onend = null; voice.onerror = null; speechSynthesis.cancel(); this.onVoiceUnavailable(); timed();
      }, 4500);
      speechSynthesis.speak(voice);
    };
    nextVoice(0);
    // Keep some Chromium speech engines from suspending long utterances.
    this.heartbeat = window.setInterval(() => { if (token === this.generation && speechSynthesis.speaking) { speechSynthesis.pause(); speechSynthesis.resume(); } }, 12000);
  }
}
