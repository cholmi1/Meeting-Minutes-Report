import { useState } from 'react'
import { api, errorMessage } from '../lib/api'

type Props = {
  onUnlock: () => void
}

export default function LockScreen({ onUnlock }: Props) {
  const [key, setKey] = useState('')
  const [error, setError] = useState('')

  const [pending, setPending] = useState(false)
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (pending) return
    setPending(true);setError('')
    try { await api('login', {key});setKey('');onUnlock() }
    catch(e) { setError(errorMessage(e)) }
    finally { setPending(false) }
  }

  return (
    <div className="lock-wrap">
      <div className="lock-card">
        <div className="lock-brand">
          <span className="brand-mark lg" aria-hidden="true">
            회
          </span>
          <h1 className="lock-title">회의록 보고서</h1>
          <p className="lock-sub">회의내용을 간결하고 핵심정리를 하는 앱</p>
        </div>

        <form onSubmit={submit} className="lock-form">
          <label className="field-label" htmlFor="access-key">
            접속 열쇠
          </label>
          <input
            id="access-key"
            className={`input ${error ? 'input-error' : ''}`}
            type="password"
            value={key}
            autoFocus
            placeholder="관리자에게 받은 단어"
            onChange={(e) => {
              setKey(e.target.value)
              setError('')
            }}
          />
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="btn btn-primary btn-block" type="submit" disabled={pending || !key.trim()}>
            {pending ? '확인 중…' : '들어가기'}
          </button>
        </form>

        <p className="lock-note">
          이 앱은 정해진 사람만 들어올 수 있습니다. 열쇠는 입구 비밀번호처럼 팀 안에서만
          공유해 주세요.
        </p>
      </div>

      <p className="lock-foot">참석자와 회의 내용에 개인정보가 포함될 수 있습니다. 민감정보는 입력하지 마세요.</p>
    </div>
  )
}
