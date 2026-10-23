import { useState } from 'react'
import { DEMO_ACCESS_KEY } from '../lib/config'

type Props = {
  onUnlock: () => void
}

export default function LockScreen({ onUnlock }: Props) {
  const [key, setKey] = useState('')
  const [error, setError] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (key.trim() === DEMO_ACCESS_KEY) {
      setError('')
      onUnlock()
    } else {
      setError('열쇠가 맞지 않습니다. 관리자에게 받은 단어를 확인해 주세요.')
    }
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
          {error && <p className="form-error">{error}</p>}
          <button className="btn btn-primary btn-block" type="submit">
            들어가기
          </button>
        </form>

        <p className="lock-note">
          이 앱은 정해진 사람만 들어올 수 있습니다. 열쇠는 입구 비밀번호처럼 팀 안에서만
          공유해 주세요.
        </p>
      </div>

      <p className="lock-foot">회의 내용은 저장되며, 이름·연락처는 받지 않습니다.</p>
    </div>
  )
}
