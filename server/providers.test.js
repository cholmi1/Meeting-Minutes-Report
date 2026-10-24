import test from 'node:test';
import assert from 'node:assert/strict';
import { settingsPatch, publicSettings, checkedModel } from './store.js';
import { decrypt, AppError, seal, hash } from './security.js';
import { extractModels, recommendModel, classifyProviderError, providerRequest, discoverModels, parseJSONOutput, summaryRequest, summarizeWithProvider } from './providers.js';
process.env.SESSION_SECRET='unit-test-only-session-secret-at-least-32-characters';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
test('four provider key updates preserve every other key and engine; public last4 only',()=>{
  const old={keys:{gemini:{encrypted:'old',tail:'abcd'}},transcribe:'openai',summarize:'claude',transcribeModel:'gpt-transcribe',summarizeModel:'claude-sonnet-5'};
  for(const provider of ['openai','claude','deepseek','gemini']) {const patch=settingsPatch({provider,key:'test-only-provider-key-1234'},old);assert.deepEqual(patch.keys[provider==='gemini'?'openai':'gemini'],old.keys[provider==='gemini'?'openai':'gemini']);assert.equal(decrypt(patch.keys[provider].encrypted),'test-only-provider-key-1234');assert.deepEqual(Object.keys(patch),['keys']);const visible=publicSettings({...old,...patch});assert.equal(visible.keys[provider].tail,'1234');assert.equal(visible.transcribe,'openai');assert(!JSON.stringify(visible).includes('encrypted'));}
  assert.deepEqual(settingsPatch({provider:'gemini',remove:true},old),{keys:{}});
  assert.equal(publicSettings(old).summarizeModel,'claude-sonnet-5');assert.equal(publicSettings({}).transcribe,'gemini');
});
test('engine selectors and model IDs are bounded and forbid paths/URLs',()=>{
  const old={transcribe:'gemini',summarize:'gemini'};assert.deepEqual(settingsPatch({summarize:'deepseek',summarizeModel:'deepseek-flash'},old),{summarize:'deepseek',summarizeModel:'deepseek-flash'});
  assert.deepEqual(settingsPatch({summarize:'openai'},old),{summarize:'openai',summarizeModel:''});
  for(const body of [{transcribe:'claude'},{summarize:'external'},{provider:'openai',key:'valid-test-key',summarize:'openai'},{provider:'claude',remove:true,key:'test-only-key'},{summarizeModel:'https://evil.example'}])assert.throws(()=>settingsPatch(body,old),AppError);
  for(const value of ['../x','gemini-a/b','gemini-a?key=x','x'.repeat(121)])assert.throws(()=>checkedModel('gemini',value),AppError);
});
test('live discovery uses official capability lists and never pins retired version',async()=>{
  const payload={models:[{name:'models/gemini-3.8-flash',displayName:'Flash',supportedGenerationMethods:['generateContent']},{name:'models/gemini-3.7-pro',supportedGenerationMethods:['generateContent']},{name:'models/gemini-3.8-flash-preview',supportedGenerationMethods:['generateContent']},{name:'models/gemini-embedding-001',supportedGenerationMethods:['embedContent']}]};
  let count=0;const models=await discoverModels('gemini','summarize','mock-unit-only',{fetchImpl:async(url,options)=>{count++;assert(url.startsWith('https://generativelanguage.googleapis.com/v1beta/models'));assert.equal(options.headers['x-goog-api-key'],'mock-unit-only');return json(payload);}});assert.equal(count,1);assert.equal(models.recommended,'gemini-3.8-flash');assert.equal(models.models.length,2);assert(!JSON.stringify(models).includes('mock-unit-only'));
  assert.deepEqual(extractModels('openai','transcribe',{data:[{id:'gpt-transcribe'},{id:'gpt-live-transcribe'},{id:'gpt-4o-mini-transcribe'},{id:'gpt-realtime'},{id:'gpt-transcribe-diarize'}]}).map(m=>m.id).sort(),['gpt-4o-mini-transcribe','gpt-transcribe']);
  assert.equal(recommendModel('openai','transcribe',[{id:'gpt-4o-mini-transcribe'},{id:'gpt-transcribe'}]),'gpt-transcribe');
  const chat=extractModels('openai','summarize',{data:['gpt-5-mini','gpt-5','gpt-image-1','gpt-5-audio','gpt-5-pro','gpt-5-codex','gpt-5-search','gpt-transcribe'].map(id=>({id}))});assert.deepEqual(chat.map(m=>m.id).sort(),['gpt-5','gpt-5-mini']);
  assert.deepEqual(extractModels('claude','summarize',{data:[{id:'claude-sonnet-5',lifecycle:'active'},{id:'claude-sonnet-4',lifecycle:'retired'}]}).map(m=>m.id),['claude-sonnet-5']);
  assert.equal(extractModels('deepseek','summarize',{data:[{id:'deepseek-flash'},{id:'deepseek-v4-pro'}]}).length,2);
});
test('paginated model list test is GET-only, safe metadata only',async()=>{
  let calls=0;const result=await discoverModels('claude','summarize','mock-only',{fetchImpl:async(url,options)=>{calls++;assert.equal(options.method,undefined);if(calls===1)return json({data:[{id:'claude-sonnet-5',display_name:'Sonnet'}],has_more:true,last_id:'claude-sonnet-5'});assert(url.includes('after_id=claude-sonnet-5'));return json({data:[{id:'claude-haiku-5'}],has_more:false});}});assert.equal(calls,2);assert.equal(result.models.length,2);assert.equal(result.recommended,'claude-sonnet-5');
});
test('upstream errors redact body/keys/URLs and carry structured safe diagnostics',async()=>{
  const raw='secret-key https://private.example confidential user memo';
  const cases=[[400,{error:{status:'INVALID_ARGUMENT',details:[{reason:'API_KEY_INVALID'}]}},'invalid_key'],[429,{error:{code:'insufficient_quota'}},'billing'],[429,{error:{status:'RESOURCE_EXHAUSTED'}},'quota'],[402,{},'billing'],[404,{},'model'],[400,{},'parameters'],[413,{},'file_limit'],[504,{},'deadline']];
  for(const [status,body,code] of cases){body.message=raw;const e=classifyProviderError('gemini','upload_chunk',status,body);assert(e instanceof AppError);assert.equal(e.code,code);assert.equal(e.provider,'gemini');assert.equal(e.stage,'upload_chunk');assert.equal(e.upstreamStatus,String(status));assert(!e.message.includes(raw));}
  await assert.rejects(providerRequest('https://api.openai.com/v1/models',{provider:'openai',stage:'models',fetchImpl:async()=>json({error:{message:raw,type:'authentication_error'}},401)}),e=>e.code==='invalid_key' && !e.message.includes(raw));
  await assert.rejects(providerRequest('https://evil.example/v1/models',{provider:'openai',fetchImpl:()=>{throw new Error('must not call');}}),e=>e.code==='parameters');
  await assert.rejects(providerRequest('https://api.openai.com/v1/models',{provider:'openai',deadline:Date.now()-1}),e=>e.code==='deadline');
});
test('JSON parsing accepts only raw JSON or a complete JSON fence',()=>{
  assert.deepEqual(parseJSONOutput('{"title":"자료"}','claude'),{title:'자료'});assert.deepEqual(parseJSONOutput('```json\n{"title":"자료"}\n```','claude'),{title:'자료'});
  for(const value of ['prefix {"title":"x"}','```json\n{}\n``` after','[]','null','not json'])assert.throws(()=>parseJSONOutput(value,'claude'),AppError);
});
test('summary request adapters use official endpoints, JSON mode and no unsupported temperature',async()=>{
  for(const [provider,model] of [['gemini','gemini-3.8-flash'],['openai','gpt-5-mini'],['deepseek','deepseek-flash'],['claude','claude-sonnet-5']]) {
    const request=summaryRequest(provider,model,'Return JSON only',{memo:'actual data',transcript:[]});assert(!('temperature' in request.body));
    if(provider==='openai' || provider==='deepseek')assert.equal(request.body.response_format.type,'json_object');if(provider==='claude')assert.equal(request.body.max_tokens,8192);if(provider==='gemini')assert.equal(request.body.generationConfig.responseMimeType,'application/json');
    const result=await summarizeWithProvider(provider,model,'mock-only','Return JSON only',{memo:'x'},{fetchImpl:async(url,options)=>{assert.equal(url,request.url);assert.equal(options.method,'POST');const output=JSON.stringify({title:'회의',summary:'자료 부족',decisions:[],todos:[]});return json(provider==='gemini'?{candidates:[{finishReason:'STOP',content:{parts:[{text:output}]}}]}:provider==='claude'?{stop_reason:'end_turn',content:[{type:'text',text:output}]}:{choices:[{finish_reason:'stop',message:{content:output}}]});}});assert.equal(result.title,'회의');
  }
});

test('workflow consent, WAV bounds, exact transcript and offset validation before DB/network',async()=>{
  const {parseWavChunk,checkedTranscript,chunkTranscript,verifyTranscriptionProofs,analyze}=await import('./workflow.js');
  function wav(seconds=1){const n=32000*seconds,b=Buffer.alloc(44+n);b.write('RIFF',0);b.writeUInt32LE(36+n,4);b.write('WAVE',8);b.write('fmt ',12);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(16000,24);b.writeUInt32LE(32000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n,40);return b;}
  const body={consent:true,chunkIndex:1,offsetSeconds:60,data:wav(60).toString('base64')};assert.equal(parseWavChunk(body).seconds,60);assert.equal(parseWavChunk(body).offsetSeconds,60);
  for(const patch of [{consent:false},{chunkIndex:120},{offsetSeconds:61},{data:wav(61).toString('base64')},{data:'abcd'}, {chunkIndex:-1}])assert.throws(()=>parseWavChunk({...body,...patch}),AppError);
  const badRate=wav();badRate.writeUInt32LE(44100,24);assert.throws(()=>parseWavChunk({...body,data:badRate.toString('base64')}),AppError);
  const transcript=[{time:' 00:00 ',speaker:' 발언자 미상 ',text:' 실제 발언 원문 '}];assert.deepEqual(checkedTranscript(transcript),transcript);assert.deepEqual(chunkTranscript(' 음성 ',60),[{time:'01:00',speaker:'발언자 미상',text:'음성'}]);assert.deepEqual(chunkTranscript('',0),[]);
  const lines=[{time:'00:00',speaker:'발언자 미상',text:'검증된 음성'}],session={sid:'proof-test'};const proof=seal({sid:session.sid,index:0,provider:'openai',model:'gpt-transcribe',count:1,transcriptHash:hash(JSON.stringify(lines),'transcript-proof'),expires:Date.now()+60000},'transcript-proof');assert.deepEqual(verifyTranscriptionProofs([proof],lines,session),{provider:'openai',model:'gpt-transcribe'});assert.throws(()=>verifyTranscriptionProofs([proof],[{...lines[0],text:'변경됨'}],session),AppError);assert.throws(()=>verifyTranscriptionProofs([proof],lines,{sid:'other'}),AppError);assert.throws(()=>verifyTranscriptionProofs([],lines,session),AppError);
  await assert.rejects(analyze({consent:false},{sid:'test'},'ip'),e=>e.code==='consent');
  await assert.rejects(analyze({consent:true,memo:'자료',heldAt:'2026-10-24',file:{receipt:'invalid'}},{sid:'test'},'ip'),AppError);
});

test('proof selection keeps Gemini and memo legacy empty proofs separate from OpenAI audio',async()=>{
  const {requiresTranscriptionProof,verifyTranscriptionProofs}=await import('./workflow.js');
  const audioMeta={name:'audio.wav',size:32044,durationLabel:'1초'};
  // Both file-backed Gemini and memo-only analysis have no supplied transcript.
  assert.equal(requiresTranscriptionProof(null,null,[]),false);
  assert.equal(requiresTranscriptionProof(null,null,undefined),false);
  assert.equal(requiresTranscriptionProof(undefined,undefined,[]),false);
  // OpenAI audio, including silence, always requires proof, even if missing/empty.
  assert.equal(requiresTranscriptionProof(audioMeta,[],undefined),true);
  assert.equal(requiresTranscriptionProof(audioMeta,[],[]),true);
  assert.equal(requiresTranscriptionProof(audioMeta,[{time:'00:00',speaker:'발언자 미상',text:'발언'}],['proof']),true);
  assert.throws(()=>verifyTranscriptionProofs([],[],{sid:'test'}),AppError);
  // Explicit proofs with a supplied transcript may never bypass validation.
  assert.equal(requiresTranscriptionProof(null,[],[]),true);
  assert.equal(requiresTranscriptionProof(null,[],undefined),false);
});
