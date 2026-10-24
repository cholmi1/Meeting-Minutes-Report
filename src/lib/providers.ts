export type ProviderId = 'gemini' | 'openai' | 'claude' | 'deepseek'
export type TranscribeProvider = 'gemini' | 'openai'
export type KeyState = { registered: boolean; tail: string }
export type ApiSettings = { keys: Record<ProviderId, KeyState>; transcribe: TranscribeProvider; summarize: ProviderId; transcribeModel: string; summarizeModel: string }
export const DEFAULT_API_SETTINGS: ApiSettings = { keys: { gemini: { registered:false,tail:'' },openai:{registered:false,tail:''},claude:{registered:false,tail:''},deepseek:{registered:false,tail:''} }, transcribe:'gemini', summarize:'gemini', transcribeModel:'', summarizeModel:'' }
export const PROVIDERS = [
 {id:'gemini' as const,name:'Gemini',maker:'Google',issueUrl:'https://aistudio.google.com/apikey',issueWhere:'Google AI Studio → API keys'},
 {id:'openai' as const,name:'OpenAI (ChatGPT)',maker:'OpenAI',issueUrl:'https://platform.openai.com/api-keys',issueWhere:'OpenAI Platform → API keys'},
 {id:'claude' as const,name:'Claude',maker:'Anthropic',issueUrl:'https://console.anthropic.com/settings/keys',issueWhere:'Anthropic Console → API keys'},
 {id:'deepseek' as const,name:'DeepSeek',maker:'DeepSeek',issueUrl:'https://platform.deepseek.com/api_keys',issueWhere:'DeepSeek Platform → API keys'},
]
export function providerById(id: ProviderId) { return PROVIDERS.find(p=>p.id===id) ?? PROVIDERS[0] }
export function normalizeSettings(value: Partial<ApiSettings>): ApiSettings { return {...DEFAULT_API_SETTINGS,...value,keys:{...DEFAULT_API_SETTINGS.keys,...value.keys},transcribeModel:value.transcribeModel??'',summarizeModel:value.summarizeModel??''} }
