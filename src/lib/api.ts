export type Session = { authenticated: boolean; admin: boolean; configured?: boolean }
type SafeDetails = { code?: string; stage?: string; provider?: string; upstreamStatus?: number }
const safeToken = (value: unknown) => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(value) ? value : undefined
const PROVIDERS = ['gemini','openai','claude','deepseek']
export class ApiError extends Error {
 code?: string; stage?: string; provider?: string; upstreamStatus?: number; status?: number
 constructor(message: string, details: SafeDetails = {}, status?:number) { super(message); this.name='ApiError'; Object.assign(this,details);this.status=status }
}
export async function api<T>(action: string, body?: unknown): Promise<T> {
 let response:Response
 try { response=await fetch('/api/app?action='+encodeURIComponent(action),{method:body===undefined?'GET':'POST',credentials:'same-origin',headers:body===undefined?undefined:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}) }
 catch { throw new ApiError('서버에 연결하지 못했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.',{code:'NETWORK_ERROR',stage:action}) }
 const data=await response.json().catch(()=>null)
 if(!response.ok){
  const details:SafeDetails={code:safeToken(data?.code),stage:safeToken(data?.stage)||action,provider:PROVIDERS.includes(data?.provider)?data.provider:undefined,upstreamStatus:Number.isInteger(data?.upstreamStatus)&&data.upstreamStatus>=100&&data.upstreamStatus<=599?data.upstreamStatus:undefined}
  const upstream=details.upstreamStatus??response.status
  const message=upstream===401||upstream===403?'인증 또는 사용 권한을 확인해 주세요. 관리자 열쇠와 해당 제공사의 API 열쇠를 확인해 주세요.':upstream===429?'제공사의 사용 한도 또는 요청 제한에 도달했습니다. 계정 한도·결제 상태를 확인한 뒤 다시 시도해 주세요.':upstream===413?'전송 가능한 크기를 초과했습니다. 파일을 나누거나 더 작은 파일을 선택해 주세요.':response.status===400?'입력 자료·모델 선택 또는 업로드 상태를 확인해 주세요. 지원 형식과 설정을 확인한 뒤 다시 시도해 주세요.':'요청을 처리하지 못했습니다. 입력 자료는 유지됩니다. 잠시 후 다시 시도해 주세요.'
  throw new ApiError(message,details,response.status)
 }
 if(!data)throw new ApiError('서버 응답을 읽지 못했습니다. 다시 시도해 주세요.',{code:'INVALID_RESPONSE',stage:action},response.status)
 return data as T
}
export function errorMessage(error:unknown){
 if(error instanceof ApiError){const detail=[error.provider&&'제공사 '+error.provider,error.stage&&'단계 '+error.stage,error.code&&'코드 '+error.code,error.upstreamStatus&&'제공사 HTTP '+error.upstreamStatus,error.status&&'서버 HTTP '+error.status].filter(Boolean).join(' · ');return error.message+(detail?' ('+detail+')':'')}
 return error instanceof Error?error.message:'처리 중 오류가 발생했습니다. 다시 시도해 주세요.'
}
