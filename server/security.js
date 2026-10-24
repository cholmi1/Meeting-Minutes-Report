import { createHmac, timingSafeEqual, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

export class AppError extends Error { constructor(status, message) { super(message); this.status = status; } }
export const fail = (status, message) => { throw new AppError(status, message); };
const COOKIE = '__Host-mm_session';
export function ready() {
  return Boolean(process.env.ACCESS_KEY?.length >= 12 && process.env.ADMIN_KEY?.length >= 12 && process.env.ACCESS_KEY !== process.env.ADMIN_KEY && process.env.SESSION_SECRET?.length >= 32 && process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
}
export function needConfig() { if (!ready()) fail(503, '서버 설정이 필요합니다. 관리자가 Firebase 및 접근키 환경변수를 확인해 주세요.'); }
const secret = () => { if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) fail(503, '서버 보안 설정이 필요합니다.'); return process.env.SESSION_SECRET; };
export const hash = (value, scope = 'id') => createHmac('sha256', secret()).update(scope + ':' + value).digest('hex');
export function equal(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aa = createHmac('sha256', secret()).update(a).digest();
  const bb = createHmac('sha256', secret()).update(b).digest();
  return timingSafeEqual(aa, bb);
}
export const id = () => randomBytes(24).toString('base64url');
const keyFor = purpose => createHmac('sha256', secret()).update('encryption:' + purpose).digest();
export function encrypt(text, purpose = 'provider') {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', keyFor(purpose), iv);
  cipher.setAAD(Buffer.from(purpose));
  const data = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map(x => x.toString('base64url')).join('.');
}
export function decrypt(value, purpose = 'provider') {
  const parts = value.split('.');
  if (parts.length !== 3) throw new Error('invalid encrypted value');
  const [iv, tag, data] = parts.map(x => Buffer.from(x, 'base64url'));
  const cipher = createDecipheriv('aes-256-gcm', keyFor(purpose), iv);
  cipher.setAAD(Buffer.from(purpose)); cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(data), cipher.final()]).toString('utf8');
}
export function seal(payload, purpose) {
  // Also encrypted: resumable upload URLs must not be visible to clients.
  const data = encrypt(JSON.stringify(payload), purpose);
  return data + '.' + hash(data, purpose);
}
export function unseal(token, purpose) {
  try {
    if (typeof token !== 'string' || token.length > 12000) throw new Error();
    const at = token.lastIndexOf('.'), data = token.slice(0, at), sig = token.slice(at + 1);
    if (!equal(sig, hash(data, purpose))) throw new Error();
    const value = JSON.parse(decrypt(data, purpose));
    if (!Number.isFinite(value.expires) || value.expires < Date.now()) throw new Error();
    return value;
  } catch { fail(400, '인증 정보가 만료되었거나 올바르지 않습니다. 다시 시도해 주세요.'); }
}
export function session(req) {
  if (!ready()) return null;
  const raw = String(req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
  if (!raw) return null;
  try { const data = unseal(raw, 'session'); return typeof data.sid === 'string' && ['user', 'admin'].includes(data.role) ? data : null; } catch { return null; }
}
export function requireSession(req, admin = false) {
  const s = session(req);
  if (!s) fail(401, '접근키로 먼저 로그인해 주세요.');
  if (admin && s.role !== 'admin') fail(403, '관리자 인증이 필요합니다.');
  return s;
}
export function setSession(res, s) {
  const value = seal({ sid: s.sid || id(), role: s.role, expires: s.expires || Date.now() + 8 * 60 * 60 * 1000 }, 'session');
  res.setHeader('Set-Cookie', COOKIE + '=' + value + '; Path=/; Max-Age=28800; HttpOnly; Secure; SameSite=Strict');
}
export function clearSession(res) { res.setHeader('Set-Cookie', COOKIE + '=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict'); }
export function checkOrigin(req) {
  const origin = req.headers.origin, host = req.headers.host;
  try {
    const url = new URL(origin);
    if (!host || url.host.toLowerCase() !== host.toLowerCase() || !['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error();
    if (url.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error();
    if (req.headers['sec-fetch-site'] === 'cross-site') throw new Error();
  } catch { fail(403, '같은 사이트에서 요청해 주세요. 페이지를 새로고침한 뒤 다시 시도해 주세요.'); }
}
export function ipId(req) {
  const raw = String(req.headers['x-vercel-forwarded-for'] || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  return hash(raw, 'ip');
}
export function object(value, label = '요청') {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) fail(400, label + ' 형식이 올바르지 않습니다.');
  return value;
}
export function text(value, max, label, optional = false) {
  if (optional && (value === undefined || value === null)) return '';
  if (typeof value !== 'string' || value.length > max || value.includes('\u0000')) fail(400, label + ' 형식 또는 길이를 확인해 주세요.');
  return value.trim();
}
export function exactKeys(value, allowed) { if (Object.keys(value).some(k => !allowed.includes(k))) fail(400, '지원하지 않는 항목이 포함되어 있습니다.'); }
