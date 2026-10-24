import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/app.js';
import { seal, unseal, encrypt, decrypt, equal, setSession, session, checkOrigin, AppError } from './security.js';
import { input, meeting, uploadInfo, freshId, CHUNK_SIZE } from './validation.js';
import { uploadChunk, uploadGranularity, checkedUploadURL, checkedUploadedMetadata, validateReceipt } from './gemini.js';
import { analyze } from './workflow.js';
process.env.SESSION_SECRET='test-only-session-secret-with-more-than-32-characters';
process.env.ACCESS_KEY='test-only-access-key'; process.env.ADMIN_KEY='test-only-admin-key';
process.env.FIREBASE_SERVICE_ACCOUNT_JSON='{}';
const baseMeeting=()=>({id:freshId(),title:'테스트 회의',heldAt:'2026-10-24T11:00',attendees:['참석자'],status:'confirmed',summary:'확인된 자료만 작성',decisions:[],todos:[{task:'검토',owner:'미정',due:'미정'}],transcript:[],createdAt:'2026-10-24T01:00:00.000Z'});
function response() { return {headers:{},setHeader(k,v){this.headers[k]=v;},end(v){this.body=JSON.parse(v);}}; }
function req(action,method='GET',body) { return {url:'/api/app?action='+action,method,headers:{host:'example.com',origin:'https://example.com','content-type':'application/json'},body}; }
function cookie(role='user') { const r=response(); setSession(r,{sid:'session-test',role}); return r.headers['Set-Cookie'].split(';')[0]; }
test('encryption and signed opaque token never reveal provider URL',()=>{
  const secret='https://generativelanguage.googleapis.com/upload/private?secret=value';
  const encrypted=encrypt(secret); assert.equal(decrypt(encrypted),secret); assert(!encrypted.includes(secret));
  const token=seal({uploadURL:secret,expires:Date.now()+10000},'upload'); assert.equal(unseal(token,'upload').uploadURL,secret); assert(!token.includes('googleapis'));
  assert.throws(()=>unseal(token.slice(0,-1)+'X','upload'),AppError); assert.throws(()=>unseal(token,'session'),AppError);
  assert.throws(()=>unseal(seal({expires:Date.now()-1000},'upload'),'upload'),AppError);
  assert(equal('same','same')); assert(!equal('a','b')); assert(!equal('a',null));
});
test('cookie security, roles, and expiration',()=>{
  const r=response(); setSession(r,{sid:'session-test',role:'admin'});
  for(const flag of ['HttpOnly','Secure','SameSite=Strict','Path=/','Max-Age=28800']) assert(r.headers['Set-Cookie'].includes(flag));
  assert.equal(session({headers:{cookie:r.headers['Set-Cookie'].split(';')[0]}}).role,'admin');
  assert.equal(session({headers:{cookie:'__Host-mm_session=invalid'}}),null);
});
test('same-origin enforcement fails closed',()=>{
  assert.doesNotThrow(()=>checkOrigin(req('session')));
  assert.throws(()=>checkOrigin({headers:{host:'example.com',origin:'https://evil.com'}}),AppError);
  assert.throws(()=>checkOrigin({headers:{host:'example.com'}}),AppError);
  assert.throws(()=>checkOrigin({headers:{host:'example.com',origin:'http://example.com'}}),AppError);
});
test('meeting input validation and draft rejection',()=>{
  assert.equal(meeting(baseMeeting()).status,'confirmed');
  assert.throws(()=>meeting({...baseMeeting(),status:'draft'}),AppError);
  assert.throws(()=>meeting({...baseMeeting(),unknown:'field'}),AppError);
  assert.throws(()=>meeting({...baseMeeting(),todos:[{task:'x',owner:'미정',due:'미정',extra:true}]}),AppError);
  assert.throws(()=>meeting({...baseMeeting(),link:'javascript:alert(1)'}),AppError);
  assert.throws(()=>meeting({...baseMeeting(),id:'../../outside'}),AppError);
  assert.throws(()=>meeting({...baseMeeting(),heldAt:'2026-02-31'}),AppError);
  assert.throws(()=>meeting({...baseMeeting(),summary:'한'.repeat(100000),memo:'한'.repeat(100000),transcript:[{time:'미상',speaker:'미상',text:'한'.repeat(10000)},{time:'미상',speaker:'미상',text:'한'.repeat(10000)},{time:'미상',speaker:'미상',text:'한'.repeat(10000)},{time:'미상',speaker:'미상',text:'한'.repeat(10000)}]}),AppError);
  const valid=input({memo:'실제 메모',attendees:'가, 나\n다',heldAt:'2026-10-24'}); assert.deepEqual(valid.attendees,['가','나','다']);
  assert.throws(()=>input({memo:'',heldAt:'2026-10-24',link:'https://example.com'}),AppError);
});
test('upload bounds and MIME validation',()=>{
  assert.equal(uploadInfo({name:'voice.mp3',mimeType:'audio/mpeg',size:100*1024*1024}).size,100*1024*1024);
  for(const v of [{name:'x',mimeType:'text/plain',size:10},{name:'x',mimeType:'audio/mpeg',size:100*1024*1024+1},{name:'x',mimeType:'audio/mpeg',size:-1}]) assert.throws(()=>uploadInfo(v),AppError);
});
test('handler session/authentication and mutation errors without DB calls',async()=>{
  let r=response(); await handler(req('session'),r); assert.equal(r.statusCode,200); assert.equal(r.body.authenticated,false); assert.equal(r.headers['Cache-Control'],'no-store, max-age=0');
  const authenticated=req('session'); authenticated.headers.cookie=cookie('admin'); r=response(); await handler(authenticated,r); assert.equal(r.body.admin,true);
  r=response(); await handler(req('settings'),r); assert.equal(r.statusCode,401);
  const admin=req('login','POST',{key:'no',admin:true}); r=response(); await handler(admin,r); assert.equal(r.statusCode,401);
  const cross=req('logout','POST',{}); cross.headers.origin='https://evil.com'; r=response(); await handler(cross,r); assert.equal(r.statusCode,403);
  const settings=req('settings','POST',{}); settings.headers.cookie=cookie(); r=response(); await handler(settings,r); assert.equal(r.statusCode,403);
  const unsupported=req('provider-models','POST',{provider:'unsupported',purpose:'summarize'}); unsupported.headers.cookie=cookie('admin'); r=response(); await handler(unsupported,r); assert.equal(r.statusCode,400);
  const bad=req('login','POST','not json'); r=response(); await handler(bad,r); assert.equal(r.statusCode,400);
  const large=req('login','POST',{}); large.headers['content-length']='4000000'; r=response(); await handler(large,r); assert.equal(r.statusCode,413);
  r=response(); await handler(req('logout','POST',{}),r); assert.equal(r.body.authenticated,false); assert(r.headers['Set-Cookie'].includes('Max-Age=0'));
});
test('analysis refuses unsigned external file receipts before any network calls',async()=>{
  await assert.rejects(analyze({consent:true,memo:'회의',heldAt:'2026-10-24',file:{uri:'https://attacker.example/audio',receipt:'invalid'}},{sid:'test'},'ip'),AppError);
});
test('old upload clients fail safely; token and session remain bound',async()=>{
  const s={sid:'session-test'}, base={name:'x.mp3',mimeType:'audio/mpeg',size:CHUNK_SIZE+1,uploadURL:'https://generativelanguage.googleapis.com/upload/v1beta/files?upload_id=test',sid:s.sid,nonce:'a'.repeat(32),expires:Date.now()+60000};
  const token=seal(base,'upload');
  await assert.rejects(uploadChunk({uploadToken:token,offset:1,data:'YQ==',final:false},s),AppError);
  await assert.rejects(uploadChunk({uploadToken:token,offset:0,data:'###',final:false},s),AppError);
  await assert.rejects(uploadChunk({uploadToken:token,offset:0,data:'YQ==',final:false},s),AppError);
  await assert.rejects(uploadChunk({uploadToken:token,offset:0,data:'YQ==',final:true},{sid:'other'}),AppError);
  await assert.rejects(uploadChunk({uploadToken:seal({...base,uploadURL:'https://evil.example/upload/'},'upload'),offset:0,data:'YQ==',final:true},s),AppError);
});

test('missing, short, or identical authentication keys fail readiness without revealing values',async()=>{
  const original=process.env.ADMIN_KEY;
  try {
    process.env.ADMIN_KEY='short'; let r=response(); await handler(req('session'),r); assert.equal(r.body.configured,false);
    process.env.ADMIN_KEY=process.env.ACCESS_KEY; r=response(); await handler(req('session'),r); assert.equal(r.body.configured,false);
  } finally { process.env.ADMIN_KEY=original; }
});

test('direct Google upload negotiates granularity and never returns an API-key URL',()=>{
 assert.equal(uploadGranularity('8388608'),8388608);assert.equal(uploadGranularity(null),8388608);for(const v of ['0','2097153','999999999'])assert.throws(()=>uploadGranularity(v),AppError);
 assert.doesNotThrow(()=>checkedUploadURL('https://generativelanguage.googleapis.com/upload/v1beta/files?upload_id=scoped-capability'));
 for(const url of ['https://evil.example/upload/x','http://generativelanguage.googleapis.com/upload/x','https://generativelanguage.googleapis.com/v1beta/files','https://generativelanguage.googleapis.com/upload/x?key=secret','https://generativelanguage.googleapis.com/upload/x?access_token=secret'])assert.throws(()=>checkedUploadURL(url),AppError);
 const u={nonce:'n'.repeat(32),size:1234,mimeType:'audio/mpeg',name:'original.mp3'},meta={name:'files/abc',uri:'https://generativelanguage.googleapis.com/v1beta/files/abc',displayName:'mm-'+u.nonce,sizeBytes:'1234',mimeType:'audio/mpeg'};
 const verified=checkedUploadedMetadata(meta,u);assert.equal(verified.name,'original.mp3');assert.equal(verified.nonce,u.nonce);for(const change of [{displayName:'other'},{sizeBytes:'1235'},{mimeType:'text/plain'},{uri:'https://evil.example/f'}])assert.throws(()=>checkedUploadedMetadata({...meta,...change},u),AppError);
 const s={sid:'test'},f={...verified,sid:s.sid,expires:Date.now()+10000},file={...verified,receipt:seal(f,'file-receipt')};assert.equal(validateReceipt(file,s).nonce,u.nonce);assert.throws(()=>validateReceipt({...file,nonce:'other'},s),AppError);assert.throws(()=>validateReceipt(file,{sid:'other'}),AppError);
});
