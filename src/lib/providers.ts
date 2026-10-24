export type ProviderId = 'gemini' | 'openai' | 'claude' | 'deepseek'
export type KeyState = { registered: boolean; tail: string }
export type ApiSettings = { keys: Record<ProviderId, KeyState>; transcribe: ProviderId; summarize: ProviderId }
export const DEFAULT_API_SETTINGS: ApiSettings = { keys: { gemini: { registered:false,tail:'' },openai:{registered:false,tail:''},claude:{registered:false,tail:''},deepseek:{registered:false,tail:''} }, transcribe:'gemini', summarize:'gemini' }
export const PROVIDERS = [{ id:'gemini' as const, name:'Gemini', maker:'Google', issueUrl:'https://aistudio.google.com/apikey', issueWhere:'Google AI Studio → API keys' }]
export function providerById(_id: ProviderId) { return PROVIDERS[0] }
