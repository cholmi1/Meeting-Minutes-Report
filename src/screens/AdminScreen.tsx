import { useState } from 'react'
import {
  PROVIDERS,
  providerById,
  type ApiSettings,
  type ProviderId,
} from '../lib/providers'
import { DEMO_ADMIN_KEY } from '../lib/config'

type Props = {
  settings: ApiSettings
  onChange: (next: ApiSettings) => void
  onBack: () => void
}

export default function AdminScreen({ settings, onChange, onBack }: Props) {
  const [unlocked, setUnlocked] = useState(false)
  const [adminKey, setAdminKey] = useState('')
  const [gateError, setGateError] = useState('')
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [toast, setToast] = useState('')

  function showToast(msg: string) {
    setToast(msg)
    window.setTimeout(() => setToast(''), 3000)
  }

  function unlock(e: React.FormEvent) {
    e.preventDefault()
    if (adminKey.trim() === DEMO_ADMIN_KEY) {
      setUnlocked(true)
      setGateError('')
    } else {
      setGateError('관리자 열쇠가 맞지 않습니다.')
    }
  }

  function saveKey(id: ProviderId) {
    const raw = (draft[id] ?? '').trim()
    if (raw.length < 8) {
      showToast('열쇠가 너무 짧습니다. 발급받은 값 전체를 붙여 넣어 주세요.')
      return
    }
    const tail = raw.slice(-4)
    onChange({
      ...settings,
      keys: { ...settings.keys, [id]: { registered: true, tail } },
    })
    setDraft((d) => ({ ...d, [id]: '' }))
    showToast(`${providerById(id).name} 열쇠를 등록했습니다. (끝 4자리만 보관)`)
  }

  function clearKey(id: ProviderId) {
    onChange({
      ...settings,
      keys: { ...settings.keys, [id]: { registered: false, tail: '' } },
    })
    showToast(`${providerById(id).name} 열쇠를 지웠습니다.`)
  }

  if (!unlocked) {
    return (
      <div className="page narrow">
        <div className="gate">
          <p className="eyebrow">관리자 전용</p>
          <h1 className="h2">관리자 열쇠가 필요합니다</h1>
          <p className="muted small">
            AI 열쇠를 넣고 바꾸는 화면입니다. 쓰는 사람에게는 열어 주지 않습니다.
          </p>
          <form onSubmit={unlock} className="gate-form">
            <input
              className={`input ${gateError ? 'input-error' : ''}`}
              type="password"
              placeholder="관리자 열쇠"
              value={adminKey}
              autoFocus
              onChange={(e) => {
                setAdminKey(e.target.value)
                setGateError('')
              }}
            />
            {gateError && <p className="form-error">{gateError}</p>}
            <button className="btn btn-primary btn-block" type="submit">
              관리자로 들어가기
            </button>
            <button className="btn btn-ghost btn-block" type="button" onClick={onBack}>
              돌아가기
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-head split">
        <div>
          <p className="eyebrow">관리자 · AI 연결</p>
          <h1 className="h1">AI 열쇠와 사용할 엔진</h1>
          <p className="muted">
            여기서 넣은 열쇠는 쓰는 사람 화면에 보이지 않습니다. 쓰는 사람은 등록된 AI를 그대로
            씁니다.
          </p>
        </div>
        <div className="head-actions">
          <button className="btn btn-ghost btn-sm" onClick={onBack}>
            첫 화면으로
          </button>
        </div>
      </div>

      <div className="warn">
        <p className="warn-title">먼저 확인해 주세요 — 무료 범위</p>
        <p className="warn-body">
          네 가지 중 <b>결제 카드 없이 무료로 쓸 수 있는 것은 Gemini 하나</b>입니다.
          ChatGPT·Claude·DeepSeek 열쇠는 결제 등록이 필요해서 «무료로만» 조건과 어긋납니다.
          음성 파일을 글로 옮길 수 있는 것도 Gemini와 ChatGPT 두 가지이고, Claude와 DeepSeek는
          글자 정리(요약)만 할 수 있습니다.
        </p>
      </div>

      <div className="provider-grid">
        {PROVIDERS.map((p) => {
          const key = settings.keys[p.id]
          return (
            <div className="provider" key={p.id}>
              <div className="provider-head">
                <div>
                  <p className="provider-name">{p.name}</p>
                  <p className="provider-maker">{p.maker}</p>
                </div>
                <span className={`chip ${key.registered ? 'chip-done' : 'chip-draft'}`}>
                  {key.registered ? '등록됨' : '미등록'}
                </span>
              </div>

              <div className="tag-row">
                <span className={`tag ${p.audio ? 'tag-on' : ''}`}>
                  {p.audio ? '음성 받아쓰기 가능' : '음성 불가 · 요약만'}
                </span>
                <span className={`tag ${p.freeTier ? 'tag-on' : ''}`}>
                  {p.freeTier ? '무료 한도 있음' : '유료 전용'}
                </span>
              </div>

              <p className="provider-note">{p.audioNote}</p>
              <p className="provider-cost">{p.costNote}</p>

              <label className="field tight">
                <span className="field-label">API 열쇠</span>
                <input
                  className="input"
                  type="password"
                  placeholder={p.keyPlaceholder}
                  value={draft[p.id] ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, [p.id]: e.target.value }))}
                />
              </label>

              <div className="provider-actions">
                <button className="btn btn-line btn-sm" onClick={() => saveKey(p.id)}>
                  열쇠 저장
                </button>
                {key.registered && (
                  <button className="btn btn-ghost btn-sm" onClick={() => clearKey(p.id)}>
                    지우기
                  </button>
                )}
                <a className="link-out" href={p.issueUrl} target="_blank" rel="noreferrer">
                  발급처 열기 ↗
                </a>
              </div>

              {key.registered && (
                <p className="key-state">
                  저장됨 · 끝 4자리 <span className="mono">{key.tail}</span>
                </p>
              )}
              <p className="provider-issue">{p.issueWhere}</p>
            </div>
          )
        })}
      </div>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">사용할 엔진</h2>
        </div>
        <div className="engine-grid">
          <label className="field">
            <span className="field-label">받아쓰기 (음성 → 글)</span>
            <select
              className="input select"
              value={settings.transcribe}
              onChange={(e) =>
                onChange({ ...settings, transcribe: e.target.value as ProviderId })
              }
            >
              {PROVIDERS.filter((p) => p.audio).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {settings.keys[p.id].registered ? '(열쇠 등록됨)' : '(열쇠 없음)'}
                </option>
              ))}
            </select>
            <span className="field-hint">
              Claude와 DeepSeek는 소리 파일을 받지 못해 목록에 없습니다.
            </span>
          </label>

          <label className="field">
            <span className="field-label">요약·정리 (글 → 회의록)</span>
            <select
              className="input select"
              value={settings.summarize}
              onChange={(e) => onChange({ ...settings, summarize: e.target.value as ProviderId })}
            >
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {settings.keys[p.id].registered ? '(열쇠 등록됨)' : '(열쇠 없음)'}
                </option>
              ))}
            </select>
            <span className="field-hint">
              회의록 요약은 네 가지 모두 가능합니다. 비용은 DeepSeek가 가장 낮고, 품질은
              ChatGPT·Claude가 앞서는 편입니다.
            </span>
          </label>
        </div>

        <div className="panel">
          <p className="panel-title">지금 설정</p>
          <dl className="kv">
            <dt>받아쓰기</dt>
            <dd>
              {providerById(settings.transcribe).name}
              {settings.keys[settings.transcribe].registered ? ' · 열쇠 있음' : ' · 열쇠 없음'}
            </dd>
            <dt>요약</dt>
            <dd>
              {providerById(settings.summarize).name}
              {settings.keys[settings.summarize].registered ? ' · 열쇠 있음' : ' · 열쇠 없음'}
            </dd>
          </dl>
          <p className="panel-note">
            지금은 1단계(화면 확인)라 열쇠는 이 브라우저에만 남고 끝 4자리만 보관합니다. 실제
            저장은 다음 단계에서 서버가 암호화해 처리하고, 화면에는 다시 표시하지 않습니다.
          </p>
        </div>

        <div className="panel">
          <p className="panel-title">안전 규칙</p>
          <ul className="tiny-list">
            <li>열쇠는 화면 코드에 넣지 않고 서버에서만 씁니다.</li>
            <li>저장한 열쇠는 다시 보여 주지 않고, 끝 4자리만 표시합니다.</li>
            <li>쓰는 사람 화면에는 열쇠 입력칸도, 열쇠 값도 나타나지 않습니다.</li>
            <li>열쇠를 채팅으로 보내지 마세요. 이 화면이나 서버 설정에만 넣습니다.</li>
          </ul>
        </div>
      </section>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
