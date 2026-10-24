import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { fail, needConfig, encrypt, decrypt, text, exactKeys } from './security.js';
import { meeting } from './validation.js';
export function db() {
  needConfig();
  const app = getApps().find(a => a.name === 'meeting-minutes-server') || initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) }, 'meeting-minutes-server');
  return getFirestore(app);
}
// A stable HMAC-derived document per scope/IP/session, never raw IP or authentication keys.
export async function rateLimit(entries, limit, windowMs, message) {
  const refs = entries.map(e => db().collection('_mmRateLimits').doc(e));
  await db().runTransaction(async tx => {
    const docs = await tx.getAll(...refs), now = Date.now();
    const values = docs.map(d => { const v=d.data(); return v && v.resetAt > now ? v : { count:0, resetAt:now+windowMs }; });
    if (values.some(v=>v.count >= limit)) fail(429,message || '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.');
    refs.forEach((ref,i)=>tx.set(ref,{ count: values[i].count+1, resetAt: values[i].resetAt, expiresAt:Timestamp.fromMillis(values[i].resetAt) }));
  });
}
const providers=['gemini','openai','claude','deepseek'];
const settingsRef = () => db().collection('_mmSettings').doc('ai');
export async function settings() {
  const s=(await settingsRef().get()).data() || {}, keys={};
  for (const p of providers) keys[p]={ registered:Boolean(s.keys?.[p]?.encrypted), tail:s.keys?.[p]?.tail || '' };
  return { keys, transcribe:'gemini', summarize:'gemini' };
}
export async function updateSettings(body) {
  exactKeys(body,['provider','key','remove','transcribe','summarize']);
  if (body.provider !== undefined) {
    if (body.provider !== 'gemini') fail(400,'현재 Gemini만 지원합니다. 다른 제공자의 키는 등록할 수 없습니다.');
    if (body.transcribe !== undefined || body.summarize !== undefined || (body.remove !== undefined && body.remove !== true)) fail(400,'설정 요청 형식을 확인해 주세요.');
    if (body.remove === true && body.key !== undefined) fail(400,'삭제와 등록을 동시에 요청할 수 없습니다.');
    const value=body.remove === true ? null : text(body.key,1000,'API 키');
    if (value !== null && (value.length < 12 || /\s/.test(value))) fail(400,'API 키 형식을 확인해 주세요.');
    await db().runTransaction(async tx=>{
      const ref=settingsRef(), old=(await tx.get(ref)).data() || {}, keys={...(old.keys || {})};
      if (value === null) delete keys[body.provider];
      else keys[body.provider]={ encrypted:encrypt(value), tail:value.slice(-4) };
      tx.set(ref,{ keys,transcribe:'gemini',summarize:'gemini',updatedAt:FieldValue.serverTimestamp() });
    });
  } else {
    if (body.key !== undefined || body.remove !== undefined || (!body.transcribe && !body.summarize)) fail(400,'변경할 설정을 확인해 주세요.');
    if ((body.transcribe !== undefined && body.transcribe !== 'gemini') || (body.summarize !== undefined && body.summarize !== 'gemini')) fail(400,'현재 전사와 요약은 Gemini만 지원합니다.');
    await settingsRef().set({ transcribe:'gemini',summarize:'gemini',updatedAt:FieldValue.serverTimestamp() },{merge:true});
  }
  return settings();
}
export async function geminiKey() {
  const value=(await settingsRef().get()).data()?.keys?.gemini?.encrypted;
  if (!value) fail(409,'관리자가 설정에서 Gemini API 키를 먼저 등록해 주세요.');
  try { return decrypt(value); } catch { fail(503,'저장된 API 키를 읽을 수 없습니다. 관리자가 키를 다시 등록해 주세요.'); }
}
const meetingsRef = () => db().collection('meetings');
export async function listMeetings() {
  const snap=await meetingsRef().orderBy('createdAt','desc').limit(200).get();
  return { meetings:snap.docs.map(d=>{ const { _savedAt, ...v }=d.data(); return v; }) };
}
export async function saveMeeting(body) {
  const m=meeting(body.meeting), ref=meetingsRef().doc(m.id);
  await db().runTransaction(async tx=>{
    const old=await tx.get(ref), now=new Date().toISOString();
    // Client-provided creation timestamps never become authoritative.
    m.createdAt=old.exists ? old.data().createdAt : now;
    tx.set(ref,{...m,_savedAt:FieldValue.serverTimestamp()});
  });
  return {meeting:m};
}
export async function deleteMeeting(body) {
  const v=text(body.id,80,'회의 ID');
  if (!/^[0-9a-f-]{36}$/i.test(v)) fail(400,'회의 ID를 확인해 주세요.');
  await meetingsRef().doc(v).delete();
  return {ok:true};
}
