import {api,ApiError} from './api'
import {blobBase64} from './audioChunks'
/** Sequential uploads only. A failed chunk is never blindly retried. */
export async function uploadGemini(file:File,onProgress:(bytes:number)=>void):Promise<unknown>{
 const extension=file.name.split('.').pop()?.toLowerCase()||''
 const mimeType=file.type||({'mp3':'audio/mpeg','m4a':'audio/mp4','wav':'audio/wav','mp4':'video/mp4','mov':'video/quicktime','webm':'audio/webm','ogg':'audio/ogg','flac':'audio/flac'}[extension]||'application/octet-stream')
 const start=await api<{transport?:string;uploadUrl?:string;uploadToken:string;chunkSize:number}>('upload-start',{name:file.name,size:file.size,mimeType})
 let completed:unknown
 try{
  if(start.transport==='direct'){
   let destination:URL
   try{destination=new URL(start.uploadUrl||'')}catch{throw new ApiError('업로드 주소를 검증하지 못했습니다.',{code:'UPLOAD_URL_INVALID',stage:'upload-start',provider:'gemini'})}
   if(destination.protocol!=='https:'||destination.hostname!=='generativelanguage.googleapis.com'||destination.port||destination.username||destination.password||[...destination.searchParams.keys()].some(key=>/^(key|api_key|x-goog-api-key)$/i.test(key)))throw new ApiError('안전한 Google 업로드 주소가 아닙니다. 관리자에게 문의해 주세요.',{code:'UPLOAD_URL_INVALID',stage:'upload-start',provider:'gemini'})
   const chunkSize=start.chunkSize
   if(!Number.isSafeInteger(chunkSize)||chunkSize<1||chunkSize>16*1024*1024)throw new ApiError('Google 업로드 조각 크기를 확인하지 못했습니다.',{code:'UPLOAD_CHUNK_INVALID',stage:'upload-start',provider:'gemini'})
   for(let offset=0;offset<file.size;offset+=chunkSize){
    const blob=file.slice(offset,offset+chunkSize),final=offset+blob.size===file.size
    let response:Response
    try{response=await fetch(destination.href,{method:'POST',credentials:'omit',referrerPolicy:'no-referrer',headers:{'Content-Type':'application/octet-stream','X-Goog-Upload-Offset':String(offset),'X-Goog-Upload-Command':final?'upload, finalize':'upload'},body:blob})}catch{if(final){const recovered=await api<{file:unknown}>('upload-complete',{uploadToken:start.uploadToken});completed=recovered.file;onProgress(file.size);break}throw new ApiError('Google 파일 전송에 연결하지 못했습니다. 인터넷 연결 또는 브라우저의 외부 전송 차단을 확인해 주세요. 파일·메모는 유지됩니다.',{code:'DIRECT_UPLOAD_NETWORK',stage:'upload-chunk',provider:'gemini'})}
    if(!response.ok)throw new ApiError('Google에서 파일 조각을 받지 못했습니다. 입력 자료는 유지됩니다. 관리자에게 아래 단계·상태를 알려 주세요.',{code:'DIRECT_UPLOAD_FAILED',stage:'upload-chunk',provider:'gemini',upstreamStatus:response.status})
    onProgress(offset+blob.size)
    if(final){const payload=await response.json().catch(()=>null);const fileName=payload?.file?.name;if(typeof fileName!=='string'||!/^files\/[a-zA-Z0-9_-]+$/.test(fileName))throw new ApiError('Google 파일 전송 완료 응답을 확인하지 못했습니다.',{code:'UPLOAD_FINAL_INVALID',stage:'upload-complete',provider:'gemini'});const receipt=await api<{file:unknown}>('upload-complete',{uploadToken:start.uploadToken,fileName});completed=receipt.file}
   }
  }else{
   const chunkSize=Math.min(Math.max(1,start.chunkSize||2097152),2097152)
   for(let offset=0;offset<file.size;offset+=chunkSize){const blob=file.slice(offset,offset+chunkSize),data=await blobBase64(blob);const result=await api<{file?:unknown}>('upload-chunk',{uploadToken:start.uploadToken,offset,data,final:offset+blob.size===file.size});onProgress(offset+blob.size);if(result.file)completed=result.file}
  }
  if(!completed)throw new ApiError('파일 업로드 완료를 확인하지 못했습니다. 파일·메모는 유지됩니다.',{code:'UPLOAD_INCOMPLETE',stage:'upload-complete',provider:'gemini'})
  return completed
 }catch(error){await api('upload-cancel',{uploadToken:start.uploadToken}).catch(()=>{});throw error}
}
