import { randomUUID } from 'node:crypto';
import { fail, object, text, exactKeys } from './security.js';
export const MAX_FILE = 100 * 1024 * 1024;
export const CHUNK_SIZE = 2 * 1024 * 1024;
const MIME = new Set(['audio/mpeg','audio/mp3','audio/mp4','audio/m4a','audio/x-m4a','audio/wav','audio/x-wav','audio/aac','audio/flac','audio/ogg','audio/webm','audio/aiff','audio/x-aiff','audio/pcm','video/mp4','video/webm','video/quicktime','video/mpeg','video/x-msvideo']);
export function uploadInfo(body) {
  const name = text(body.name, 250, '파일명');
  const mimeType = text(body.mimeType, 100, '파일 형식').toLowerCase();
  if (!name || !MIME.has(mimeType)) fail(400, '지원되는 음성 또는 동영상 파일을 선택해 주세요.');
  const size = body.size;
  if (!Number.isSafeInteger(size) || size < 1 || size > MAX_FILE) fail(400, '파일은 100MB 이하만 업로드할 수 있습니다.');
  return { name, mimeType, size };
}
export function validDate(value, label) {
  const v = text(value, 60, label);
  if (!/^\d{4}-\d{2}-\d{2}(?:T[0-9:.+Z-]+)?$/.test(v) || !Number.isFinite(Date.parse(v))) fail(400, label + '를 확인해 주세요.');
  if (new Date(v.slice(0,10)+'T00:00:00.000Z').toISOString().slice(0,10)!==v.slice(0,10)) fail(400, label + '의 날짜가 올바르지 않습니다.');
  return v;
}
function strings(value, maxItems, maxLength, label) {
  if (!Array.isArray(value) || value.length > maxItems) fail(400, label + ' 형식을 확인해 주세요.');
  return value.map(v => text(v, maxLength, label));
}
export function validLink(value) {
  const link = text(value, 2000, '참고 링크', true);
  if (link) { try { const u = new URL(link); if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password) throw new Error(); } catch { fail(400, '참고 링크는 http 또는 https 주소여야 합니다.'); } }
  return link;
}
export function input(body) {
  object(body);
  const memo = text(body.memo, 100000, '회의 메모', true);
  const attendees = typeof body.attendees === 'string' ? body.attendees.split(/[,\n]/).map(x=>x.trim()).filter(Boolean) : (body.attendees || []);
  const result = { memo, attendees: strings(attendees, 100, 100, '참석자'), heldAt: validDate(body.heldAt, '회의 일시'), link: validLink(body.link) };
  if (!memo && !body.file && !(Array.isArray(body.transcript) && body.transcript.length)) fail(400, '회의 메모 또는 녹음 파일을 추가해 주세요. 링크만으로는 분석할 수 없습니다.');
  return result;
}
// Firestore stores map/field overhead too, not just JSON bytes. Reserve document
// path and server timestamp overhead so the actual record stays below 700KiB.
function firestoreBytes(value) {
  if (typeof value === 'string') return Buffer.byteLength(value,'utf8') + 1;
  if (typeof value === 'number') return 8;
  if (Array.isArray(value)) return value.reduce((n,v)=>n+firestoreBytes(v),0);
  if (value && typeof value === 'object') return 32 + Object.entries(value).reduce((n,[k,v])=>n+Buffer.byteLength(k,'utf8')+1+firestoreBytes(v),0);
  return 1;
}
export function meeting(value, { confirmed = true } = {}) {
  const v = object(value, '회의록');
  exactKeys(v, ['id','title','heldAt','attendees','link','memo','fileName','fileSize','durationLabel','status','summary','decisions','todos','transcript','createdAt','processing']);
  const result = {
    id: text(v.id, 80, '회의 ID'), title: text(v.title, 300, '제목'), heldAt: validDate(v.heldAt, '회의 일시'),
    attendees: strings(v.attendees, 100, 100, '참석자'), status: v.status,
    summary: text(v.summary, 100000, '요약'), decisions: strings(v.decisions, 200, 3000, '결정 사항'),
    todos: [], transcript: [], createdAt: validDate(v.createdAt, '생성 일시'),
  };
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result.id) || !result.title || !result.summary) fail(400, '회의 ID, 제목, 요약을 확인해 주세요.');
  if (confirmed ? v.status !== 'confirmed' : !['draft','confirmed'].includes(v.status)) fail(400, '검토 후 확정한 회의록만 저장할 수 있습니다.');
  if (!Array.isArray(v.todos) || v.todos.length > 200 || !Array.isArray(v.transcript) || v.transcript.length > 3000) fail(400, '실행 항목 또는 발언 기록이 너무 많습니다.');
  result.todos = v.todos.map(t => { object(t); exactKeys(t, ['task','owner','due']); return { task: text(t.task,3000,'실행 항목'), owner:text(t.owner,200,'담당자'), due:text(t.due,200,'기한') }; });
  result.transcript = v.transcript.map(t => { object(t); exactKeys(t,['time','speaker','text']); return { time:text(t.time,50,'발언 시각'), speaker:text(t.speaker,200,'발언자'), text:text(t.text,10000,'발언') }; });
  if(v.processing!==undefined){const p=object(v.processing,'처리 정보');exactKeys(p,['transcribe','summarize']);const checked=(x,role)=>{object(x,'처리 엔진');exactKeys(x,['provider','model']);if(!['gemini','openai','claude','deepseek'].includes(x.provider)||(role==='transcribe'&&!['gemini','openai'].includes(x.provider)))fail(400,'처리 엔진 정보를 확인해 주세요.');const model=text(x.model,150,'모델');if(!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,149}$/.test(model))fail(400,'모델 정보를 확인해 주세요.');return {provider:x.provider,model};};result.processing={summarize:checked(p.summarize,'summarize'),...(p.transcribe?{transcribe:checked(p.transcribe,'transcribe')}:{})};}
  if (v.link !== undefined) result.link = validLink(v.link);
  for (const [k,max] of [['memo',100000],['fileName',250],['durationLabel',100]]) if (v[k] !== undefined) result[k] = text(v[k],max,k);
  if (v.fileSize !== undefined) { if (!Number.isSafeInteger(v.fileSize) || v.fileSize < 0 || v.fileSize > MAX_FILE) fail(400,'파일 크기를 확인해 주세요.'); result.fileSize = v.fileSize; }
  if (Math.max(Buffer.byteLength(JSON.stringify(result),'utf8'),firestoreBytes(result)) > 700 * 1024 - 2048) fail(413, '회의록은 700KB 이하로 저장해 주세요. 발언 기록을 줄여 주세요.');
  return result;
}
export const freshId = () => randomUUID();
