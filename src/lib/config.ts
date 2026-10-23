export type View = 'home' | 'upload' | 'result' | 'export' | 'archive' | 'admin'

// 1단계(화면 확인용) 시험 열쇠. 2단계에서 서버 검증으로 바꾸고,
// 실제 값은 코드가 아니라 Vercel 환경변수(ACCESS_KEY / ADMIN_KEY)에 넣습니다.
export const DEMO_ACCESS_KEY = 'meeting2026'
export const DEMO_ADMIN_KEY = 'admin2026'
