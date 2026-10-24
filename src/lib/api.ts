export type Session = { authenticated: boolean; admin: boolean; configured?: boolean }
export async function api<T>(action: string, body?: unknown): Promise<T> {
  let response: Response
  try { response = await fetch('/api/app?action=' + encodeURIComponent(action), { method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }) }
  catch { throw new Error('서버에 연결하지 못했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.') }
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(typeof data?.error === 'string' ? data.error : data?.error?.message || data?.message || '요청을 처리하지 못했습니다. 다시 시도해 주세요. (' + response.status + ')')
  if (!data) throw new Error('서버 응답을 읽지 못했습니다. 다시 시도해 주세요.')
  return data as T
}
export function errorMessage(error: unknown) { return error instanceof Error ? error.message : '처리 중 오류가 발생했습니다. 다시 시도해 주세요.' }
