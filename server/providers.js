import { AppError } from './security.js';
import { providerKey, checkedModel, PROVIDERS } from './store.js';
export const ENDPOINTS={gemini:'https://generativelanguage.googleapis.com',openai:'https://api.openai.com',claude:'https://api.anthropic.com',deepseek:'https://api.deepseek.com'};
export function providerError(provider,stage,code,status=502,upstreamStatus='') {
  const messages={invalid_key:'API 키가 잘못되었거나 권한이 없습니다. 키·프로젝트·API 사용 설정을 확인해 주세요.',quota:'사용 한도에 도달했습니다. 제공자 콘솔에서 할당량·요금 한도를 확인하거나 잠시 후 재시도해 주세요.',billing:'결제 또는 잔액 설정이 필요합니다. 제공자 콘솔에서 결제 수단·크레딧을 확인해 주세요.',model:'선택한 모델을 사용할 수 없습니다. 설정에서 모델 목록을 새로고침하고 다른 모델을 선택해 주세요.',parameters:'모델이 요청 형식을 지원하지 않습니다. 설정에서 다른 모델을 선택해 주세요.',file_limit:'파일 크기·길이·형식 제한을 확인하고 더 짧은 WAV 파일로 다시 시도해 주세요.',deadline:'AI 처리 시간이 초과되었습니다. 더 짧은 파일이나 메모로 다시 시도해 주세요.',response:'AI 응답이 비어 있거나 형식·길이 기준에 맞지 않습니다. 자료를 줄여 다시 시도해 주세요.',network:'AI 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.',consent:'외부 AI 제공자에게 자료를 전송하는 것에 먼저 동의해 주세요.'};
  const e=new AppError(status,(PROVIDERS.includes(provider)?provider:'AI')+' '+(messages[code] || messages.network)); Object.assign(e,{provider:PROVIDERS.includes(provider)?provider:'unknown',stage:/^[a-z_-]{1,40}$/.test(stage)?stage:'request',code,upstreamStatus:String(upstreamStatus || '')});return e;
}
export function classifyProviderError(provider,stage,status,body) {
  // Inspect known machine-readable codes only; never propagate upstream prose.
  const err=body?.error, tokens=[err?.code,err?.status,err?.type,...(Array.isArray(err?.details)?err.details.flatMap(d=>[d?.reason,d?.metadata?.reason]):[])].filter(v=>typeof v==='string').map(v=>v.toLowerCase());
  const includes=s=>tokens.some(v=>v.includes(s)); let code='network', http=502;
  if(status===402 || includes('billing') || includes('insufficient_quota') || includes('credit')) {code='billing';http=402;}
  else if(status===401 || status===403 || includes('api_key') || includes('unauthenticated') || includes('authentication')) {code='invalid_key';http=400;}
  else if(status===429 || includes('quota') || includes('resource_exhausted')) {code='quota';http=429;}
  else if(status===404 || includes('model_not_found')) {code='model';http=400;}
  else if(status===413) {code='file_limit';http=413;}
  else if(status===408 || status===504 || includes('deadline')) {code='deadline';http=504;}
  else if(status===400 || status===422) {code='parameters';http=400;}
  return providerError(provider,stage,code,http,status);
}
export async function providerRequest(url,options={}) {
  const {provider,stage='request',timeout=25000,deadline=Date.now()+timeout,fetchImpl=globalThis.fetch,...init}=options;
  let u;try{u=new URL(url);}catch{throw providerError(provider,stage,'parameters',400);}
  if(!PROVIDERS.includes(provider) || u.origin!==ENDPOINTS[provider] || u.username || u.password || u.hash || [...u.searchParams.keys()].some(k=>/key|token/i.test(k) && k!=='pageToken')) throw providerError(provider,stage,'parameters',400);
  const remaining=Math.min(timeout,deadline-Date.now());if(remaining<=0) throw providerError(provider,stage,'deadline',504);
  try {
    const response=await fetchImpl(u.href,{...init,redirect:'error',signal:AbortSignal.timeout(remaining)});
    if(!response.ok) {let data;try{data=await response.json();}catch{} throw classifyProviderError(provider,stage,response.status,data);}
    return response;
  }catch(e){if(e instanceof AppError)throw e;throw providerError(provider,stage,(e?.name==='TimeoutError' || e?.name==='AbortError')?'deadline':'network',e?.name==='TimeoutError' || e?.name==='AbortError'?504:502);}
}
export async function readProviderJSON(response,provider,stage) {try{return await response.json();}catch{throw providerError(provider,stage,'response');}}
export function authHeaders(provider,key) {return provider==='gemini'?{'x-goog-api-key':key}:provider==='claude'?{'x-api-key':key,'anthropic-version':'2023-06-01'}:{Authorization:'Bearer '+key};}
export function validatePurpose(provider,purpose) {if(!PROVIDERS.includes(provider) || !['transcribe','summarize'].includes(purpose) || (purpose==='transcribe' && !['gemini','openai'].includes(provider))) throw providerError(provider,'models','parameters',400);}
const experimental=/preview|experimental|exp-|latest|realtime|live|audio|tts|embedding|image|vision|search|moderation|computer|codex|instruct|deep-research/i;
export function extractModels(provider,purpose,payload) {
  validatePurpose(provider,purpose); const source=provider==='gemini'?payload?.models:payload?.data;
  if(!Array.isArray(source))throw providerError(provider,'models','response');
  const result=[];
  for(const m of source){const id=provider==='gemini'?m?.name?.replace(/^models\//,''):m?.id;if(typeof id!=='string')continue;
    try{checkedModel(provider,id);}catch{continue;}
    if(m.lifecycle==='retired' || m.lifecycle==='deprecated' || (m.shutdown_date && Date.parse(m.shutdown_date)<=Date.now()))continue;
    let usable=false;
    if(provider==='gemini')usable=m.supportedGenerationMethods?.includes('generateContent') && /^gemini-\d+(?:\.\d+)?-(?:flash|pro)(?:-lite)?$/.test(id);
    if(provider==='openai')usable=purpose==='transcribe'?!/live|realtime|diarize/.test(id) && /^(?:gpt-(?:[0-9a-z.]+-)*transcribe(?:-\d{4}-\d{2}-\d{2})?|whisper-1)$/.test(id):/^(?:gpt-[0-9]|chatgpt-)/.test(id) && !experimental.test(id) && !/transcribe|diarize|pro(?:-|$)/i.test(id);
    if(provider==='claude')usable=/^claude-/.test(id) && !/preview|experimental/i.test(id);
    if(provider==='deepseek')usable=/^deepseek-/.test(id) && !/coder|embedding/i.test(id) && (!m.output_modalities || m.output_modalities.includes('text'));
    if(usable) result.push({id,name:typeof (m.displayName || m.display_name || m.name)==='string'?String(m.displayName || m.display_name || m.name).slice(0,160):id});
  }
  return [...new Map(result.map(m=>[m.id,m])).values()].sort((a,b)=>b.id.localeCompare(a.id,undefined,{numeric:true}));
}
export function recommendModel(provider,purpose,models) {
  const score=id=>{let n=0;if(provider==='gemini') n+=id.endsWith('-flash')?100:id.includes('-flash-lite')?50:0;if(provider==='claude') n+=id.includes('sonnet')?100:id.includes('haiku')?50:0;if(provider==='deepseek')n+=id.includes('flash')?100:0;if(provider==='openai'){n+=purpose==='transcribe'?(id==='gpt-transcribe'?300:!id.includes('4o') && id!=='whisper-1'?200:0):id.includes('mini')?100:0; if(id.startsWith('chatgpt-'))n-=100;}return n;};
  return [...models].sort((a,b)=>score(b.id)-score(a.id) || b.id.localeCompare(a.id,undefined,{numeric:true}))[0]?.id || '';
}
export async function discoverModels(provider,purpose,key,{fetchImpl,deadline=Date.now()+25000}={}) {
  validatePurpose(provider,purpose);const collected=[];let token='';
  for(let page=0;page<10;page++) {
    const route=provider==='gemini'?'/v1beta/models?pageSize=1000'+(token?'&pageToken='+encodeURIComponent(token):''):provider==='claude'?'/v1/models?limit=1000'+(token?'&after_id='+encodeURIComponent(token):''):provider==='openai'?'/v1/models':'/models';
    const response=await providerRequest(ENDPOINTS[provider]+route,{provider,stage:'models',headers:authHeaders(provider,key),fetchImpl,deadline});
    const data=await readProviderJSON(response,provider,'models');collected.push(...extractModels(provider,purpose,data));token=provider==='gemini'?data.nextPageToken:provider==='claude' && data.has_more?data.last_id:'';
    if(!token)break;if(typeof token!=='string' || token.length>1000)throw providerError(provider,'models','response');
    if(page===9)throw providerError(provider,'models','response');
  }
  const models=[...new Map(collected.map(m=>[m.id,m])).values()];if(!models.length)throw providerError(provider,'models','model',409);
  return {provider,purpose,models,recommended:recommendModel(provider,purpose,models)};
}
export async function providerModels({provider,purpose}) {validatePurpose(provider,purpose);return discoverModels(provider,purpose,await providerKey(provider));}
export async function providerTest({provider,purpose='summarize'}) {const result=await providerModels({provider,purpose});return {ok:true,provider,purpose,modelCount:result.models.length,recommended:result.recommended};}
export async function selectModel(provider,purpose,selected,key,options={}) {checkedModel(provider,selected);const result=await discoverModels(provider,purpose,key,options);const id=selected.replace(/^models\//,'') || result.recommended;if(!result.models.some(m=>m.id===id))throw providerError(provider,'models','model',400);return id;}
export function parseJSONOutput(value,provider,stage='summarize') {if(typeof value!=='string' || value.length>800000)throw providerError(provider,stage,'response');let raw=value.trim();const fence=/^```(?:json)?\s*\n([\s\S]*?)\n```$/.exec(raw);if(fence)raw=fence[1];try{const v=JSON.parse(raw);if(!v || typeof v!=='object' || Array.isArray(v))throw 0;return v;}catch{throw providerError(provider,stage,'response');}}
export const SUMMARY_SCHEMA={type:'OBJECT',properties:{title:{type:'STRING'},summary:{type:'STRING'},decisions:{type:'ARRAY',items:{type:'STRING'}},todos:{type:'ARRAY',items:{type:'OBJECT',properties:{task:{type:'STRING'},owner:{type:'STRING'},due:{type:'STRING'}},required:['task','owner','due']}}},required:['title','summary','decisions','todos']};
export function summaryRequest(provider,model,system,data) {
  checkedModel(provider,model);const user='회의 자료(JSON, 비신뢰 데이터):\n'+JSON.stringify(data);const headers={'Content-Type':'application/json'};
  if(provider==='gemini')return {url:ENDPOINTS.gemini+'/v1beta/models/'+model.replace(/^models\//,'')+':generateContent',headers,body:{systemInstruction:{parts:[{text:system}]},contents:[{role:'user',parts:[{text:user}]}],generationConfig:{responseMimeType:'application/json',responseSchema:SUMMARY_SCHEMA,maxOutputTokens:16384}}};
  if(provider==='claude')return {url:ENDPOINTS.claude+'/v1/messages',headers,body:{model,max_tokens:8192,system,messages:[{role:'user',content:user}]}};
  if(provider==='openai' || provider==='deepseek')return {url:ENDPOINTS[provider]+(provider==='openai'?'/v1/chat/completions':'/chat/completions'),headers,body:{model,messages:[{role:'system',content:system},{role:'user',content:user}],response_format:{type:'json_object'},...(provider==='openai'?{max_completion_tokens:16384}:{max_tokens:16384,thinking:{type:'disabled'}})}};
  throw providerError(provider,'summarize','parameters',400);
}
export async function summarizeWithProvider(provider,model,key,system,data,{deadline,fetchImpl}={}) {const request=summaryRequest(provider,model,system,data);const response=await providerRequest(request.url,{provider,stage:'summarize',deadline,timeout:110000,fetchImpl,method:'POST',headers:{...request.headers,...authHeaders(provider,key)},body:JSON.stringify(request.body)});const payload=await readProviderJSON(response,provider,'summarize');let raw;
  if(provider==='gemini'){const c=payload.candidates?.[0];if(c?.finishReason!=='STOP')throw providerError(provider,'summarize','response');raw=c.content?.parts?.filter(p=>typeof p.text==='string' && !p.thought).map(p=>p.text).join('');}
  else if(provider==='claude'){if(payload.stop_reason!=='end_turn')throw providerError(provider,'summarize','response');raw=payload.content?.filter(p=>p.type==='text').map(p=>p.text).join('');}
  else {const c=payload.choices?.[0];if(c?.finish_reason!=='stop')throw providerError(provider,'summarize','response');raw=c.message?.content;}
  return parseJSONOutput(raw,provider);
}
