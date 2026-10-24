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
export const PROVIDERS=['gemini','openai','claude','deepseek'];
const settingsRef = () => db().collection('_mmSettings').doc('ai');
export function checkedModel(provider,value) {
  if (typeof value !== 'string' || value.length>120 || (value && !({gemini:/^(?:models\/)?gemini-[a-zA-Z0-9][a-zA-Z0-9._-]*$/,openai:/^(?:gpt-|o[1-9]|chatgpt-|whisper-)[a-zA-Z0-9._-]*$/,claude:/^claude-[a-zA-Z0-9][a-zA-Z0-9._-]*$/,deepseek:/^deepseek-[a-zA-Z0-9][a-zA-Z0-9._-]*$/}[provider]?.test(value)))) fail(400,'모델 ID 형식을 확인해 주세요.');
  return value;
}
export function publicSettings(s={}) {
  const keys={}; for(const p of PROVIDERS) keys[p]={registered:Boolean(s.keys?.[p]?.encrypted),tail:typeof s.keys?.[p]?.tail==='string'?s.keys[p].tail.slice(-4):''};
  const transcribe=['gemini','openai'].includes(s.transcribe)?s.transcribe:'gemini';
  const summarize=PROVIDERS.includes(s.summarize)?s.summarize:'gemini';
  return {keys,transcribe,summarize,transcribeModel:typeof s.transcribeModel==='string'?s.transcribeModel:'',summarizeModel:typeof s.summarizeModel==='string'?s.summarizeModel:''};
}
export async function settings() { return publicSettings((await settingsRef().get()).data() || {}); }
export function settingsPatch(body,old={}) {
  exactKeys(body,['provider','key','remove','transcribe','summarize','transcribeModel','summarizeModel']);
  if(body.provider!==undefined) {
    if(!PROVIDERS.includes(body.provider)) fail(400,'지원하는 AI 제공자를 선택해 주세요.');
    if(['transcribe','summarize','transcribeModel','summarizeModel'].some(k=>body[k]!==undefined) || (body.remove!==undefined && body.remove!==true)) fail(400,'키와 엔진 설정은 각각 저장해 주세요.');
    if(body.remove===true && body.key!==undefined) fail(400,'삭제와 등록을 동시에 요청할 수 없습니다.');
    const value=body.remove===true?null:text(body.key,1000,'API 키');
    // Prefixes change over time. Syntax alone is not authentication proof; explicit model-list test verifies access.
    if(value!==null && (value.length<12 || !/^[A-Za-z0-9_.:-]+$/.test(value))) fail(400,'API 키 형식을 확인해 주세요. 공백 없이 원본 키를 입력해 주세요.');
    const keys={...(old.keys || {})}; if(value===null) delete keys[body.provider]; else keys[body.provider]={encrypted:encrypt(value),tail:value.slice(-4)};
    return {keys};
  }
  if(body.key!==undefined || body.remove!==undefined || !['transcribe','summarize','transcribeModel','summarizeModel'].some(k=>body[k]!==undefined)) fail(400,'변경할 설정을 확인해 주세요.');
  const next=publicSettings(old),patch={};
  for(const purpose of ['transcribe','summarize']) {
    if(body[purpose]!==undefined) { if(!(purpose==='transcribe'?['gemini','openai']:PROVIDERS).includes(body[purpose])) fail(400,'지원하는 전사·요약 제공자를 선택해 주세요.'); patch[purpose]=body[purpose]; if(body[purpose]!==next[purpose] && body[purpose+'Model']===undefined) patch[purpose+'Model']=''; }
    if(body[purpose+'Model']!==undefined) patch[purpose+'Model']=checkedModel(body[purpose] || next[purpose],body[purpose+'Model']);
  }
  return patch;
}
export async function updateSettings(body) {
  await db().runTransaction(async tx=>{const ref=settingsRef(),old=(await tx.get(ref)).data() || {}; tx.set(ref,{...old,...settingsPatch(body,old),updatedAt:FieldValue.serverTimestamp()});});
  return settings();
}
export async function providerKey(provider) {
  if(!PROVIDERS.includes(provider)) fail(400,'지원하지 않는 AI 제공자입니다.');
  const value=(await settingsRef().get()).data()?.keys?.[provider]?.encrypted;
  if(!value) fail(409,'관리자가 설정에서 '+provider+' API 키를 먼저 등록해 주세요.');
  try{return decrypt(value);}catch{fail(503,'저장된 API 키를 읽을 수 없습니다. 관리자가 키를 다시 등록해 주세요.');}
}
export const geminiKey=()=>providerKey('gemini');
export async function audioRateLimit(entries,seconds) {
  const refs=entries.map(e=>db().collection('_mmRateLimits').doc(e));
  await db().runTransaction(async tx=>{const docs=await tx.getAll(...refs),now=Date.now(); const values=docs.map(d=>{const v=d.data();return v && v.resetAt>now?v:{count:0,seconds:0,resetAt:now+3600000};});
    if(values.some(v=>v.count>=120 || (v.seconds || 0)+seconds>7200)) fail(429,'음성 전사는 시간당 120조각·총 120분까지 가능합니다. 잠시 후 다시 시도해 주세요.');
    refs.forEach((ref,i)=>tx.set(ref,{count:values[i].count+1,seconds:(values[i].seconds || 0)+seconds,resetAt:values[i].resetAt,expiresAt:Timestamp.fromMillis(values[i].resetAt)}));});
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
