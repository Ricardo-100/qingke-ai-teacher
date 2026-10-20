import type { LessonPlayer } from './player';
import { speechSegments } from '../shared/speech.mjs';
export function mountSpeechSettings(player: LessonPlayer, restart: () => void, toast: (text: string) => void) {
  const esc = (s: string) => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
  document.querySelector('.voice-controls')!.insertAdjacentHTML('beforeend', '<button id="tts-open" class="text-button" title="配置 TTS 与公式读法">语音设置</button>');
  const dialog = document.createElement('dialog'); dialog.id = 'tts-dialog';
  dialog.innerHTML = `<form id="tts-form"><div class="dialog-heading"><h2>语音与公式读法</h2><button type="button" id="tts-close" aria-label="关闭语音设置">✕</button></div><label>语音来源<select id="tts-provider"><option value="browser">浏览器 / 系统语音（免费）</option><option value="api">自定义 TTS 服务</option></select></label><div id="tts-browser-fields"><label>系统音色<select id="tts-voice"></select></label><label>英文字母 / 英文音色<select id="tts-english-voice"></select></label><label>音调<input id="tts-pitch" type="range" min="0.5" max="2" step="0.1" value="1"/></label></div><div id="tts-api-fields" hidden><p class="field-hint">支持兼容 /audio/speech 的服务。讲解文本将发送给此服务；密钥保存在本地 .env，重启后自动恢复。</p><label>服务地址<input id="tts-url" type="url" placeholder="https://api.example.com/v1"/></label><label>TTS 模型<input id="tts-model" placeholder="服务商的语音模型名称"/></label><label>音色名称 / ID<input id="tts-api-voice" placeholder="填写服务商支持的音色"/></label><label>API 密钥<input id="tts-key" type="password" autocomplete="off" placeholder="留空保留已有密钥"/></label></div><label>音量<input id="tts-volume" type="range" min="0" max="1" step="0.1" value="1"/></label><label class="checkbox-label"><input id="tts-clean" type="checkbox" checked/>将公式转换为口语，忽略格式符号</label><label class="checkbox-label"><input id="tts-spell" type="checkbox" checked/>公式变量逐字母使用英文音色朗读</label><p class="field-hint">例如 R_ij 使用英文音色依次读 R、I、J，中文解释使用中文音色。分式、根号与希腊字母保留中文数学读法。自定义 TTS 分开合成中英文，需所选音色支持英文。</p><label>试听文本 / 公式<textarea id="tts-sample" rows="3" maxlength="2000">这里的 R_{ij} 等于 R_ij。x^2 加上 α。</textarea></label><p id="tts-preview" class="speech-preview"></p><button type="button" class="secondary" id="tts-test">试听当前设置</button><button type="button" class="text-button" id="tts-alphabet">填入 A–Z 试听</button><p class="settings-error" id="tts-error" role="alert"></p><div class="dialog-footer"><span>音色与读法偏好保存在此浏览器</span><button class="primary" type="submit" id="tts-save">保存语音设置</button></div></form>`;
  document.body.append(dialog);
  const input = (id: string) => dialog.querySelector<HTMLInputElement>('#tts-' + id)!;
  const select = (id: string) => dialog.querySelector<HTMLSelectElement>('#tts-' + id)!;
  let ttsConfig = { baseUrl: '', model: '', voice: '', configured: false };
  let testing = false;
  try {
    const p = JSON.parse(localStorage.getItem('qingke-speech-v1') || '{}');
    player.provider = p.provider === 'api' ? 'api' : 'browser'; player.voiceURI = typeof p.voiceURI === 'string' ? p.voiceURI : '';
    player.englishVoiceURI = typeof p.englishVoiceURI === 'string' ? p.englishVoiceURI : '';
    player.cleanSymbols = p.cleanSymbols !== false; player.spellVariables = p.spellVariables !== false;
    if (Number.isFinite(p.pitch)) player.pitch = Math.max(.5, Math.min(2, p.pitch));
    if (Number.isFinite(p.volume)) player.volume = Math.max(0, Math.min(1, p.volume));
  } catch { /* Invalid local preferences use defaults. */ }
  const updateVoices = () => {
    const chosen = select('voice').value || player.voiceURI;
    const voices = window.speechSynthesis?.getVoices() || [];
    select('voice').innerHTML = '<option value="">自动选择中文音色</option>' + voices.map(v => `<option value="${esc(v.voiceURI)}">${esc(v.name)} (${esc(v.lang)})</option>`).join(''); select('voice').value = chosen;
    const en = select('english-voice').value || player.englishVoiceURI;
    select('english-voice').innerHTML = '<option value="">自动选择英文音色</option>' + voices.filter(v => /^en/i.test(v.lang)).map(v => '<option value="' + esc(v.voiceURI) + '">' + esc(v.name) + '</option>').join(''); select('english-voice').value = en;
  };
  window.speechSynthesis?.addEventListener('voiceschanged', updateVoices);
  const update = () => {
    const api = select('provider').value === 'api'; dialog.querySelector<HTMLElement>('#tts-api-fields')!.hidden = !api; dialog.querySelector<HTMLElement>('#tts-browser-fields')!.hidden = api;
    for (const id of ['url','model','api-voice']) input(id).required = api;
    dialog.querySelector('#tts-preview')!.textContent = '朗读预览：' + speechSegments(input('sample').value, input('clean').checked, input('spell').checked).map((part: { text: string; lang: string }) => (part.lang === 'en-US' ? '【英文】' : '【中文】') + part.text).join(' → ');
  };
  select('provider').onchange = update; input('clean').onchange = update; input('spell').onchange = update; input('sample').oninput = update;
  const apply = async () => {
    if (select('provider').value === 'api') {
      const response = await fetch('/api/tts/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ baseUrl: input('url').value, model: input('model').value, voice: input('api-voice').value, apiKey: input('key').value }) });
      const value = await response.json(); if (!response.ok) throw new Error(value.error || 'TTS 配置失败'); ttsConfig = value; input('key').value = '';
    }
    player.provider = select('provider').value === 'api' ? 'api' : 'browser'; player.voiceURI = select('voice').value; player.englishVoiceURI = select('english-voice').value; player.cleanSymbols = input('clean').checked; player.spellVariables = input('spell').checked; player.pitch = Number(input('pitch').value); player.volume = Number(input('volume').value);
  };
  const busy = (value: boolean) => { input('save').disabled = value; input('test').disabled = value; };
  document.querySelector<HTMLButtonElement>('#tts-open')!.onclick = async () => {
    restart(); dialog.querySelector('#tts-error')!.textContent = ''; select('provider').value = player.provider; input('clean').checked = player.cleanSymbols; input('spell').checked = player.spellVariables; input('pitch').value = String(player.pitch); input('volume').value = String(player.volume); updateVoices(); update(); dialog.showModal();
    try { const response = await fetch('/api/tts/config'); if (response.ok) ttsConfig = await response.json(); } catch { /* Browser voices work offline. */ }
    input('url').value = ttsConfig.baseUrl; input('model').value = ttsConfig.model; input('api-voice').value = ttsConfig.voice;
  };
  input('alphabet').onclick = () => { input('sample').value = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').join('，'); update(); };
  input('close').onclick = () => dialog.close();
  dialog.addEventListener('close', () => { input('key').value = ''; if (testing) { player.cancel(); testing = false; } });
  input('test').onclick = async () => {
    busy(true); dialog.querySelector('#tts-error')!.textContent = '';
    const previous = { provider: player.provider, voiceURI: player.voiceURI, englishVoiceURI: player.englishVoiceURI, cleanSymbols: player.cleanSymbols, spellVariables: player.spellVariables, pitch: player.pitch, volume: player.volume };
    try { await apply(); testing = true; const enabled = player.voiceEnabled; player.voiceEnabled = true; player.play({ speech: input('sample').value.trim() || '你好，我是青课老师。', actions: [], board: '' }, () => {}, () => { testing = false; }); player.voiceEnabled = enabled; }
    catch (e) { dialog.querySelector('#tts-error')!.textContent = e instanceof Error ? e.message : '试听失败'; }
    finally { Object.assign(player, previous); busy(false); }
  };
  dialog.querySelector('form')!.onsubmit = async e => {
    e.preventDefault(); busy(true);
    try { player.cancel(); await apply(); localStorage.setItem('qingke-speech-v1', JSON.stringify({ provider: player.provider, voiceURI: player.voiceURI, englishVoiceURI: player.englishVoiceURI, cleanSymbols: player.cleanSymbols, spellVariables: player.spellVariables, pitch: player.pitch, volume: player.volume })); dialog.close(); toast('语音设置已保存'); }
    catch (e) { dialog.querySelector('#tts-error')!.textContent = e instanceof Error ? e.message : '语音设置保存失败'; }
    finally { busy(false); }
  };
}
