import { AppError, fail, ready, needConfig, session, requireSession, setSession, clearSession, checkOrigin, equal, ipId, object, text } from '../server/security.js';
import { settings, updateSettings, listMeetings, saveMeeting, deleteMeeting, rateLimit } from '../server/store.js';
import { uploadStart, uploadChunk, uploadCancel, uploadDiagnostic, uploadComplete } from '../server/gemini.js';
import { analyze, transcribeOpenAIChunk } from '../server/workflow.js';
import { providerModels, providerTest } from '../server/providers.js';

export const maxDuration = 300;
export const config = { maxDuration: 300 };
const MAX_BODY=3*1024*1024;
async function readBody(req) {
  const type=String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  if(type!=='application/json') fail(415,'JSON 형식으로 요청해 주세요.');
  const declared=Number(req.headers['content-length']);
  if(Number.isFinite(declared) && declared>MAX_BODY) fail(413,'요청 크기가 너무 큽니다. 파일을 2MB 단위로 업로드해 주세요.');
  let body=req.body;
  if(body===undefined) {
    const chunks=[]; let size=0;
    for await(const chunk of req) { const b=Buffer.from(chunk); size+=b.length; if(size>MAX_BODY) fail(413,'요청 크기가 너무 큽니다.'); chunks.push(b); }
    body=Buffer.concat(chunks).toString('utf8');
  }
  if(Buffer.isBuffer(body)) body=body.toString('utf8');
  if(typeof body==='string') {
    if(Buffer.byteLength(body)>MAX_BODY) fail(413,'요청 크기가 너무 큽니다.');
    try { body=JSON.parse(body); } catch { fail(400,'요청 JSON 형식이 올바르지 않습니다.'); }
  } else if(body && Buffer.byteLength(JSON.stringify(body))>MAX_BODY) fail(413,'요청 크기가 너무 큽니다.');
  return object(body);
}
function send(res,status,body) { res.statusCode=status; res.setHeader('Content-Type','application/json; charset=utf-8'); res.end(JSON.stringify(body)); }
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.setHeader('X-App-Version','2026-10-24-multi-v2');
  res.setHeader('Pragma','no-cache');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Vary','Cookie');
  try {
    const action=new URL(req.url,'https://local.invalid').searchParams.get('action') || 'session';
    const method=req.method || 'GET';
    if(!['GET','POST','DELETE'].includes(method)) { res.setHeader('Allow','GET, POST, DELETE'); fail(405,'지원하지 않는 요청 방식입니다.'); }
    if(method!=='GET') checkOrigin(req);
    if(action==='session' && method==='GET') {
      const s=session(req);
      return send(res,200,{authenticated:Boolean(s),admin:s?.role==='admin',configured:ready(),version:'2026-10-24-multi-v2'});
    }
    needConfig();
    if(action==='login' && method==='POST') {
      const body=await readBody(req);
      const key=text(body.key,1000,'접근키');
      if(body.admin!==undefined && typeof body.admin!=='boolean') fail(400,'인증 요청 형식을 확인해 주세요.');
      const previous=body.admin===true ? requireSession(req) : null;
      const scope=body.admin===true ? 'admin-login-' : 'login-';
      await rateLimit([scope+ipId(req)],8,15*60*1000,'인증 시도가 너무 많습니다. 15분 후 다시 시도해 주세요.');
      if(!key || !equal(key,body.admin===true ? process.env.ADMIN_KEY : process.env.ACCESS_KEY)) fail(401,'키가 올바르지 않습니다.');
      setSession(res,{...(previous || {}),role:body.admin===true?'admin':'user'});
      return send(res,200,{authenticated:true,admin:body.admin===true,configured:true});
    }
    if(action==='logout' && method==='POST') { clearSession(res); return send(res,200,{authenticated:false,admin:false,configured:true}); }
    const s=requireSession(req);
    let result;
    if(action==='settings' && method==='GET') result=await settings();
    else if(action==='settings' && method==='POST') { requireSession(req,true); result=await updateSettings(await readBody(req)); }
    else if(action==='meetings' && method==='GET') result=await listMeetings();
    else if(action==='meetings' && method==='POST') result=await saveMeeting(await readBody(req));
    else if(action==='meetings' && method==='DELETE') result=await deleteMeeting(await readBody(req));
    else if(action==='upload-diagnostic' && method==='POST') { requireSession(req,true); result=await uploadDiagnostic(await readBody(req),s,ipId(req)); }
    else if(action==='provider-models' && method==='POST') { requireSession(req,true); result=await providerModels(await readBody(req)); }
    else if(action==='provider-test' && method==='POST') { requireSession(req,true); result=await providerTest(await readBody(req)); }
    else if(action==='transcribe-chunk' && method==='POST') result=await transcribeOpenAIChunk(await readBody(req),s,ipId(req));
    else if(action==='upload-complete' && method==='POST') result=await uploadComplete(await readBody(req),s);
    else if(action==='analyze' && method==='POST') result=await analyze(await readBody(req),s,ipId(req));
    else if(action==='upload-start' && method==='POST') result=await uploadStart(await readBody(req),s,ipId(req));
    else if(action==='upload-chunk' && method==='POST') result=await uploadChunk(await readBody(req),s);
    else if(action==='upload-cancel' && method==='POST') result=await uploadCancel(await readBody(req),s);
    else fail(404,'지원하지 않는 API 요청입니다.');
    return send(res,200,result);
  } catch(e) {
    // Do not log user input, credentials, provider errors, or upload URLs.
    const known=e instanceof AppError;
    if(known && e.status===429) res.setHeader('Retry-After','60');
    const detail={}; if(known) for(const k of ['code','stage','provider','upstreamStatus']) if(typeof e[k]==='string' && /^[a-zA-Z0-9_-]{0,50}$/.test(e[k])) detail[k]=e[k];
    return send(res,known?e.status:500,{...detail,error:known?e.message:'서버에서 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요. 반복되면 관리자가 Firebase와 서버 환경변수를 확인해 주세요.'});
  }
}
