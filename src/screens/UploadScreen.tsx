import { useEffect, useRef, useState } from 'react'
import type { Meeting, UploadForm } from '../types'
import { buildMockMeeting } from '../mock/data'
import { formatFileSize, todayLocalInput } from '../lib/format'
import { providerById, type ApiSettings } from '../lib/providers'

type Props = {
  settings: ApiSettings
  onAnalyzed: (meeting: Meeting) => void
  onBack: () => void
}

const STEPS = ['파일 확인', '음성 → 글 변환', '핵심 정리', '회의록 구성']

export default function UploadScreen({ settings, onAnalyzed, onBack }: Props) {
  const transcribe = providerById(settings.transcribe)
  const summarizer = providerById(settings.summarize)
  const keysReady =
    settings.keys[settings.transcribe].registered && settings.keys[settings.summarize].registered
  const [form, setForm] = useState<UploadForm>({
    file: null,
    link: '',
    memo: '',
    attendees: '',
    heldAt: todayLocalInput(),
  })
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [phase, setPhase] = useState<'form' | 'analyzing'>('form')
  const [step, setStep] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)
  const hold = useRef(form)
  hold.current = form

  useEffect(() => {
    if (phase !== 'analyzing') return
    if (step >= STEPS.length) {
      const t = window.setTimeout(() => onAnalyzed(buildMockMeeting(hold.current)), 500)
      return () => window.clearTimeout(t)
    }
    const t = window.setTimeout(() => setStep((s) => s + 1), step === 0 ? 600 : 900)
    return () => window.clearTimeout(t)
  }, [phase, step, onAnalyzed])

  function pickFile(file: File | null) {
    if (!file) return
    setForm((f) => ({ ...f, file }))
    setError('')
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.file) {
      setError('녹음이나 녹화 파일 하나를 올려 주세요.')
      return
    }
    if (!form.heldAt) {
      setError('회의 일시를 넣어 주세요.')
      return
    }
    setError('')
    if (phase === 'analyzing') return
    setStep(0)
    setPhase('analyzing')
  }

  if (phase === 'analyzing') {
    return (
      <div className="page narrow">
        <div className="analyzing">
          <p className="eyebrow">ANALYZING</p>
          <h1 className="h2">회의 내용을 정리하고 있습니다</h1>
          <p className="muted">{form.file?.name}</p>
          <p className="engine-line">
            받아쓰기 {transcribe.name} · 요약 {summarizer.name}
          </p>

          <div className="progress">
            <div
              className="progress-bar"
              style={{ width: `${Math.min(100, (step / STEPS.length) * 100)}%` }}
            />
          </div>

          <ul className="proc-list">
            {STEPS.map((label, i) => (
              <li key={label} className={i < step ? 'done' : i === step ? 'active' : ''}>
                <span className="proc-dot" aria-hidden="true" />
                <span className="proc-label">{label}</span>
                <span className="proc-state">
                  {i < step ? '완료' : i === step ? '진행 중' : '대기'}
                </span>
              </li>
            ))}
          </ul>
          <p className="note">
            1단계는 화면 확인용으로, 실제 음성 분석은 다음 단계에서 연결됩니다.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-head">
        <p className="eyebrow">자료 등록</p>
        <h1 className="h1">회의 자료를 올려 주세요</h1>
        <p className="muted">
          녹음·녹화 파일 하나와 회의 정보를 넣으면 회의록 초안을 만들어 드립니다.
        </p>
      </div>

      <form className="upload-grid" onSubmit={submit}>
        <div className="upload-main">
          <div
            className={`dropzone ${dragging ? 'dragging' : ''} ${form.file ? 'has-file' : ''}`}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              pickFile(e.dataTransfer.files?.[0] ?? null)
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click()
            }}
          >
            <input
              ref={fileRef}
              type="file"
              accept="audio/*,video/*"
              hidden
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
            {form.file ? (
              <>
                <span className="dz-icon">▣</span>
                <span className="dz-file">{form.file.name}</span>
                <span className="dz-meta">{formatFileSize(form.file.size)} · 클릭하면 다시 선택</span>
              </>
            ) : (
              <>
                <span className="dz-icon">↑</span>
                <span className="dz-title">녹음·녹화 파일을 여기로 끌어다 놓으세요</span>
                <span className="dz-meta">또는 클릭해서 선택 (mp3, m4a, wav, mp4, mov)</span>
              </>
            )}
          </div>

          <label className="field">
            <span className="field-label">회의 링크 (선택)</span>
            <input
              className="input"
              type="url"
              placeholder="https://..."
              value={form.link}
              onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))}
            />
            <span className="field-hint">
              링크로 회의 내용을 가져오는 기능은 첫 판 이후에 검토합니다. 지금은 주소만 함께
              기록합니다.
            </span>
          </label>

          <label className="field">
            <span className="field-label">메모 (선택)</span>
            <textarea
              className="input textarea"
              rows={5}
              placeholder="안건, 배경, 따로 강조하고 싶은 내용을 적어 주세요."
              value={form.memo}
              onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))}
            />
            <span className="field-hint">메모 첫 줄은 회의록 제목 후보로 쓰입니다.</span>
          </label>
        </div>

        <aside className="upload-side">
          <label className="field">
            <span className="field-label">참석자</span>
            <input
              className="input"
              type="text"
              placeholder="기획 담당, 개발 담당, 운영 담당"
              value={form.attendees}
              onChange={(e) => setForm((f) => ({ ...f, attendees: e.target.value }))}
            />
            <span className="field-hint">
              이름이나 담당 역할을 쉼표로 구분해 넣어 주세요. 연락처는 받지 않습니다.
            </span>
          </label>

          <label className="field">
            <span className="field-label">회의 일시</span>
            <input
              className="input"
              type="datetime-local"
              value={form.heldAt}
              onChange={(e) => setForm((f) => ({ ...f, heldAt: e.target.value }))}
            />
          </label>

          <div className="panel">
            <p className="panel-title">이렇게 처리됩니다</p>
            <ul className="tiny-list">
              <li>올린 파일은 분석에만 쓰이고 원본은 바뀌지 않습니다.</li>
              <li>확정 전에는 저장되지 않으며, 마음에 안 들면 버릴 수 있습니다.</li>
              <li>분석은 자동, 확정은 직접 누르는 버튼으로 결정합니다.</li>
            </ul>
          </div>

          <div className="panel">
            <p className="panel-title">사용할 AI</p>
            <dl className="kv">
              <dt>받아쓰기</dt>
              <dd>
                {transcribe.name} {settings.keys[settings.transcribe].registered ? '· 열쇠 있음' : '· 열쇠 없음'}
              </dd>
              <dt>요약</dt>
              <dd>
                {summarizer.name} {settings.keys[settings.summarize].registered ? '· 열쇠 있음' : '· 열쇠 없음'}
              </dd>
            </dl>
            {!keysReady && (
              <p className="panel-note warn-inline">
                관리자가 «관리자» 화면에서 AI 열쇠를 넣어야 실제 분석이 됩니다. 지금은 화면
                확인용으로 흉내만 냅니다.
              </p>
            )}
          </div>

          {error && <p className="form-error">{error}</p>}

          <button className="btn btn-primary btn-block" type="submit">
            분석 시작
          </button>
          <button className="btn btn-ghost btn-block" type="button" onClick={onBack}>
            취소
          </button>
        </aside>
      </form>
    </div>
  )
}
