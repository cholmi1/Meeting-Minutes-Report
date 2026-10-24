const RATE = 16000
export const CHUNK_SECONDS = 60
export const MAX_SOURCE_BYTES = 100 * 1024 * 1024
export const MAX_DURATION_SECONDS = 60 * 60
const MAX_MEMORY = 256 * 1024 * 1024
const limitMessage = 'OpenAI 로컬 음성 변환의 메모리·길이 한도를 넘습니다. 파일을 짧게 나누거나 관리자에서 Gemini를 직접 선택해 주세요. 자동 전환하지 않습니다.'

/** Mono box-filter downsampling, linear interpolation only for upsampling. */
export function resampleMono(channels: readonly Float32Array[], sourceRate: number, startSeconds = 0, durationSeconds = CHUNK_SECONDS): Float32Array {
 if (!channels.length || !Number.isFinite(sourceRate) || sourceRate <= 0 || !Number.isFinite(startSeconds) || startSeconds < 0 || !Number.isFinite(durationSeconds) || durationSeconds < 0) throw new Error('음성 샘플 정보가 올바르지 않습니다.')
 const frames = Math.min(...channels.map(c=>c.length)), start = Math.min(frames,Math.round(startSeconds*sourceRate)), end = Math.min(frames,Math.round((startSeconds+durationSeconds)*sourceRate))
 const count = Math.max(0,Math.ceil((end-start)*RATE/sourceRate)), output = new Float32Array(count), ratio = sourceRate/RATE
 const mono=(index:number)=>channels.reduce((sum,c)=>sum+(c[Math.min(frames-1,Math.max(0,index))]||0),0)/channels.length
 for(let i=0;i<count;i++){
  const a=start+i*ratio, b=Math.min(end,a+ratio)
  if(ratio<1){const lo=Math.floor(a),fraction=a-lo;output[i]=mono(lo)*(1-fraction)+mono(Math.min(end-1,lo+1))*fraction}
  else {let sum=0;for(let frame=Math.floor(a);frame<Math.ceil(b);frame++){const weight=Math.max(0,Math.min(b,frame+1)-Math.max(a,frame));sum+=mono(frame)*weight}output[i]=b>a?sum/(b-a):0}
 }
 return output
}

export function encodeWav(samples: Float32Array): Uint8Array<ArrayBuffer> {
 if(samples.length>RATE*CHUNK_SECONDS)throw new Error('음성 조각은 60초를 넘을 수 없습니다.')
 const buffer=new ArrayBuffer(44+samples.length*2),view=new DataView(buffer)
 const text=(offset:number,value:string)=>{for(let i=0;i<value.length;i++)view.setUint8(offset+i,value.charCodeAt(i))}
 text(0,'RIFF');view.setUint32(4,36+samples.length*2,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,RATE,true);view.setUint32(28,RATE*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,samples.length*2,true)
 for(let i=0;i<samples.length;i++){const sample=Math.max(-1,Math.min(1,Number.isFinite(samples[i])?samples[i]:0));view.setInt16(44+i*2,Math.round(sample*(sample<0?32768:32767)),true)}
 return new Uint8Array(buffer)
}

export function blobBase64(blob:Blob):Promise<string>{return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('파일을 읽지 못했습니다. 파일을 다시 선택해 주세요.'));reader.readAsDataURL(blob)})}
async function metadataDuration(file:File):Promise<number>{
 const url=URL.createObjectURL(file),audio=document.createElement('audio');audio.preload='metadata'
 try{return await new Promise<number>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('음성 길이를 확인하지 못했습니다. 로컬에서 음성을 추출하거나 Gemini를 직접 선택해 주세요.')),15000);audio.onloadedmetadata=()=>{clearTimeout(timer);if(Number.isFinite(audio.duration)&&audio.duration>0){resolve(audio.duration)}else{reject(new Error('파일의 음성 길이를 확인할 수 없습니다. 음성을 추출하거나 Gemini를 직접 선택해 주세요.'))}};audio.onerror=()=>{clearTimeout(timer);reject(new Error('이 브라우저가 파일의 음성·영상 형식을 읽지 못합니다. 로컬에서 MP3/WAV로 음성을 추출하거나 Gemini를 직접 선택해 주세요.'))};audio.src=url})}
 finally{audio.onloadedmetadata=null;audio.onerror=null;audio.removeAttribute('src');audio.load();URL.revokeObjectURL(url)}
}
export type PreparedAudio={duration:number;count:number;chunk:(index:number)=>Uint8Array<ArrayBuffer>;dispose:()=>void}
export async function prepareAudio(file:File):Promise<PreparedAudio>{
 if(file.size>MAX_SOURCE_BYTES)throw new Error('원본 파일은 최대 100MiB입니다. 파일을 나눠 주세요.')
 const duration=await metadataDuration(file)
 // Conservative estimate for common 48kHz stereo plus compressed input copies. Actual decoder allocations vary by browser.
 if(duration>MAX_DURATION_SECONDS || duration*48000*2*4+file.size*2>MAX_MEMORY)throw new Error(limitMessage)
 let context:AudioContext|null=null,decoded:AudioBuffer|null=null
 try{context=new AudioContext();const input=await file.arrayBuffer();try{decoded=await context.decodeAudioData(input)}catch{throw new Error('브라우저에서 음성을 해독하지 못했습니다. 특히 영상은 로컬에서 MP3/WAV 음성을 추출하거나 Gemini를 직접 선택해 주세요.')}
  if(decoded.duration>MAX_DURATION_SECONDS || decoded.length*decoded.numberOfChannels*4+file.size*2>MAX_MEMORY)throw new Error(limitMessage)
  const actualDuration=decoded.duration,count=Math.ceil(actualDuration/CHUNK_SECONDS)
  if(!count)throw new Error('음성 데이터가 비어 있습니다.')
  return {duration:actualDuration,count,chunk(index){if(!decoded||!Number.isInteger(index)||index<0||index>=count)throw new Error('음성 조각 상태가 올바르지 않습니다. 다시 분석해 주세요.');const channels=Array.from({length:decoded.numberOfChannels},(_,i)=>decoded!.getChannelData(i));return encodeWav(resampleMono(channels,decoded.sampleRate,index*CHUNK_SECONDS,Math.min(CHUNK_SECONDS,actualDuration-index*CHUNK_SECONDS)))},dispose(){decoded=null}}
 }catch(error){decoded=null;throw error}finally{if(context)await context.close().catch(()=>{});context=null}
}
