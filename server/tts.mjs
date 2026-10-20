import { explainNetworkError } from './network-error.mjs';
import { createHash } from 'node:crypto';
let settings = { baseUrl: '', model: '', voice: '', apiKey: '' };
const cache = new Map();
let cacheBytes = 0, revision = 0;
const CACHE_LIMIT = 24 * 1024 * 1024;
export function publicTTS() { return { baseUrl: settings.baseUrl, model: settings.model, voice: settings.voice, configured: Boolean(settings.baseUrl && settings.model && settings.voice && settings.apiKey) }; }
export function normalizeTTSBaseUrl(value) {
  let url; try { url = new URL(String(value || '').trim().replace(/\/+$/, '')); } catch { throw new Error('TTS 服务地址格式无效，请填写完整地址，例如 https://api.stepfun.com/step_plan/v1'); }
  if (['ws:', 'wss:'].includes(url.protocol)) throw new Error('当前使用 POST 语音合成，请填写 HTTPS 地址；不能填写 WebSocket（wss://）流式地址');
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('TTS 服务地址必须以 https:// 开头，本机服务也可使用 http://');
  if (url.username || url.password) throw new Error('TTS 服务地址不能包含账号或密码；API 密钥请填写在单独的密钥栏');
  if (url.search || url.hash) throw new Error('TTS 服务地址不能包含 ? 查询参数或 # 片段，请只填写服务基础地址');
  if (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('远程 TTS 服务必须以 https:// 开头，你填写的是 http://，请修改地址前缀');
  // Accept either a service base or the synthesis endpoint copied from provider docs.
  url.pathname = url.pathname.replace(/\/+$/, '').replace(/\/audio\/speech$/, '');
  if (/\/audio\/(?:voices(?:\/preview)?|realtime)$|\/realtime\/audio$/.test(url.pathname)) throw new Error('这里需要语音合成服务的基础地址，不能填写音色试听、复刻或实时流式接口；Step Plan 请填 https://api.stepfun.com/step_plan/v1');
  return url.href.replace(/\/+$/, '');
}
export function configureTTS(value, persist = () => {}) {
  const baseUrl = normalizeTTSBaseUrl(value.baseUrl);
  const model = String(value.model || '').trim(), voice = String(value.voice || '').trim();
  if (!model || !voice || model.length > 200 || voice.length > 200) throw new Error('请填写 TTS 模型和音色');
  const apiKey = String(value.apiKey || '').trim() || settings.apiKey;
  if (!apiKey) throw new Error('请填写 TTS 密钥');
  const next = { baseUrl, model, voice, apiKey };
  persist(next);
  if (Object.keys(next).some(key => settings[key] !== next[key])) { cache.clear(); cacheBytes = 0; revision++; }
  settings = next; return publicTTS();
}
export async function synthesize(value, signal) {
  if (!publicTTS().configured) throw new Error('请先配置 TTS 服务');
  if (typeof value.text !== 'string' || !value.text.trim() || value.text.length > 5000) throw new Error('语音文本无效');
  const active = { ...settings };
  const generation = revision;
  const payload = { model: active.model, voice: active.voice, input: value.text, speed: Math.max(.25, Math.min(4, Number(value.speed) || 1)), response_format: 'mp3' };
  const cacheKey = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  if (cache.has(cacheKey)) { const cached = cache.get(cacheKey); cache.delete(cacheKey); cache.set(cacheKey, cached); return cached; }
  let response;
  try { response = await fetch(`${active.baseUrl}/audio/speech`, { method: 'POST', headers: { Authorization: `Bearer ${active.apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.any([signal, AbortSignal.timeout(60000)]), redirect: 'error' }); }
  catch (error) { throw explainNetworkError(error); }
  if (!response.ok) throw new Error(`TTS 服务返回 ${response.status}，请检查地址、模型、音色和密钥`);
  const mime = response.headers.get('content-type')?.split(';')[0];
  if (!mime?.startsWith('audio/') && mime !== 'application/octet-stream') throw new Error('TTS 服务未返回音频');
  const audio = Buffer.from(await response.arrayBuffer());
  if (!audio.length || audio.length > 20_000_000) throw new Error('TTS 音频为空或过大');
  const result = { audio, mime: mime === 'application/octet-stream' ? 'audio/mpeg' : mime };
  if (generation === revision && !signal.aborted) {
    if (cache.has(cacheKey)) { cacheBytes -= cache.get(cacheKey).audio.length; cache.delete(cacheKey); }
    while (cache.size && (cacheBytes + audio.length > CACHE_LIMIT || cache.size >= 48)) { const key = cache.keys().next().value; cacheBytes -= cache.get(key).audio.length; cache.delete(key); }
    cache.set(cacheKey, result); cacheBytes += audio.length;
  }
  return result;
}
