export type ProviderId = 'gemini' | 'openai' | 'claude' | 'deepseek'

export type Provider = {
  id: ProviderId
  name: string
  maker: string
  /** 음성 파일을 직접 받아 글자로 옮길 수 있는지 */
  audio: boolean
  /** 결제 카드 없이 무료 한도로 쓸 수 있는지 */
  freeTier: boolean
  keyPlaceholder: string
  issueUrl: string
  issueWhere: string
  audioNote: string
  costNote: string
}

/**
 * 요금·무료 한도는 2026년 10월에 각 서비스 공식 문서에서 확인한 값입니다.
 * 서비스 쪽 사정으로 바뀔 수 있어, 결제 전에는 공식 가격표를 다시 확인해야 합니다.
 */
export const PROVIDERS: Provider[] = [
  {
    id: 'gemini',
    name: 'Gemini',
    maker: 'Google',
    audio: true,
    freeTier: true,
    keyPlaceholder: 'AIza...',
    issueUrl: 'https://aistudio.google.com/apikey',
    issueWhere: 'Google AI Studio → Get API key',
    audioNote: '음성 파일을 직접 받아 글자로 옮길 수 있습니다(한 번에 최대 1시간).',
    costNote: '무료 한도 있음(카드 등록 없이 발급). 한도를 넘으면 유료: 음성 1분당 약 $0.003.',
  },
  {
    id: 'openai',
    name: 'ChatGPT',
    maker: 'OpenAI',
    audio: true,
    freeTier: false,
    keyPlaceholder: 'sk-...',
    issueUrl: 'https://platform.openai.com/api-keys',
    issueWhere: 'OpenAI Platform → API keys',
    audioNote: '받아쓰기 가능(1분당 약 $0.0045). 한국어 품질이 좋습니다.',
    costNote: '무료 한도 없음 — 결제 카드 등록과 선불 충전이 필요합니다.',
  },
  {
    id: 'claude',
    name: 'Claude',
    maker: 'Anthropic',
    audio: false,
    freeTier: false,
    keyPlaceholder: 'sk-ant-...',
    issueUrl: 'https://console.anthropic.com/settings/keys',
    issueWhere: 'Anthropic Console → API keys',
    audioNote: '음성 파일을 받는 기능이 없습니다. 글자 정리(요약)에만 쓸 수 있습니다.',
    costNote: '무료 한도 없음 — 결제 카드 등록이 필요합니다.',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    maker: 'DeepSeek',
    audio: false,
    freeTier: false,
    keyPlaceholder: 'sk-...',
    issueUrl: 'https://platform.deepseek.com/api_keys',
    issueWhere: 'DeepSeek Platform → API keys',
    audioNote: '음성 파일을 받는 기능이 없습니다. 글자 정리(요약)에만 쓸 수 있습니다.',
    costNote: '무료 한도 없음 — 다만 요금이 매우 쌉니다(입력 100만 토큰당 약 $0.15).',
  },
]

export type KeyState = {
  registered: boolean
  tail: string
}

export type ApiSettings = {
  keys: Record<ProviderId, KeyState>
  transcribe: ProviderId
  summarize: ProviderId
}

export const EMPTY_KEYS: Record<ProviderId, KeyState> = {
  gemini: { registered: false, tail: '' },
  openai: { registered: false, tail: '' },
  claude: { registered: false, tail: '' },
  deepseek: { registered: false, tail: '' },
}

export const DEFAULT_API_SETTINGS: ApiSettings = {
  keys: { ...EMPTY_KEYS },
  transcribe: 'gemini',
  summarize: 'gemini',
}

export function providerById(id: ProviderId): Provider {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0]
}
