import { useState } from 'react'
import type { Meeting } from '../types'
import { formatDateTime } from '../lib/format'

type Props = {
  meeting: Meeting
  onConfirm: (id: string) => void
  onBack: () => void
  onOpenExport: (id: string) => void
}

export default function ResultScreen({ meeting, onConfirm, onBack, onOpenExport }: Props) {
  const [showTranscript, setShowTranscript] = useState(false)
  const confirmed = meeting.status === 'confirmed'

  return (
    <div className="page">
      <div className="page-head split">
        <div>
          <p className="eyebrow">분석 결과 {confirmed ? '· 확정됨' : '· 검토 중'}</p>
          <h1 className="h1">{meeting.title}</h1>
          <div className="meta-line">
            <span>{formatDateTime(meeting.heldAt)}</span>
            <span className="dot" />
            <span>참석 {meeting.attendees.length}명</span>
            <span className="dot" />
            <span>{meeting.fileName ?? '파일 없음'}</span>
            {meeting.durationLabel && (
              <>
                <span className="dot" />
                <span>{meeting.durationLabel}</span>
              </>
            )}
          </div>
        </div>
        <div className="head-actions">
          <button className="btn btn-ghost btn-sm" onClick={onBack}>
            목록으로
          </button>
        </div>
      </div>

      <div className="result-grid">
        <div className="result-main">
          <section className="card">
            <h2 className="card-title">
              <span className="num">1</span> 핵심 요약
            </h2>
            <p className="summary">{meeting.summary}</p>
          </section>

          <section className="card">
            <h2 className="card-title">
              <span className="num">2</span> 결정사항
            </h2>
            <ol className="decisions">
              {meeting.decisions.map((d, i) => (
                <li key={i}>
                  <span className="mark" aria-hidden="true">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span>{d}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="card">
            <h2 className="card-title">
              <span className="num">3</span> 할 일
            </h2>
            <div className="todo-list">
              {meeting.todos.map((t, i) => (
                <div className="todo" key={i}>
                  <span className="todo-box" aria-hidden="true" />
                  <span className="todo-task">{t.task}</span>
                  <span className="todo-owner">{t.owner}</span>
                  <span className="todo-due">{t.due}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <h2 className="card-title">
                <span className="num">4</span> 원문 보기
              </h2>
              <button className="link-btn" onClick={() => setShowTranscript((v) => !v)}>
                {showTranscript ? '접기' : '펼치기'}
              </button>
            </div>
            {showTranscript ? (
              <ul className="transcript">
                {meeting.transcript.map((line, i) => (
                  <li key={i}>
                    <span className="t-time">{line.time}</span>
                    <span className="t-speaker">{line.speaker}</span>
                    <span className="t-text">{line.text}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small">
                음성을 글로 옮긴 원문입니다. 펼쳐서 내용이 맞는지 확인할 수 있습니다.
              </p>
            )}
          </section>
        </div>

        <aside className="result-side">
          <div className="panel">
            <p className="panel-title">회의 정보</p>
            <dl className="kv">
              <dt>일시</dt>
              <dd>{formatDateTime(meeting.heldAt)}</dd>
              <dt>참석자</dt>
              <dd>{meeting.attendees.join(', ')}</dd>
              <dt>자료</dt>
              <dd>{meeting.fileName ?? '없음'}</dd>
              {meeting.link && (
                <>
                  <dt>링크</dt>
                  <dd className="break">{meeting.link}</dd>
                </>
              )}
              {meeting.memo && (
                <>
                  <dt>메모</dt>
                  <dd className="break">{meeting.memo}</dd>
                </>
              )}
            </dl>
          </div>

          <div className="panel">
            <p className="panel-title">상태</p>
            <p className={`status-big ${confirmed ? 'on' : ''}`}>
              {confirmed ? '확정됨' : '검토 중'}
            </p>
            <p className="panel-note">
              {confirmed
                ? '이미 확정된 회의록입니다. 다시 내려받을 수 있습니다.'
                : '내용을 확인한 뒤 «확정하고 출력»을 누르면 파일로 내려받을 수 있습니다.'}
            </p>
          </div>
        </aside>
      </div>

      <div className="actionbar">
        <div className="actionbar-inner">
          <p className="actionbar-text">
            {confirmed ? '확정된 회의록입니다.' : '확정하면 WORD·PDF·HTML로 내려받을 수 있습니다.'}
          </p>
          <div className="actionbar-btns">
            <button className="btn btn-ghost" onClick={onBack}>
              취소
            </button>
            {confirmed ? (
              <button className="btn btn-primary" onClick={() => onOpenExport(meeting.id)}>
                출력 화면 열기
              </button>
            ) : (
              <button className="btn btn-primary" onClick={() => onConfirm(meeting.id)}>
                확정하고 출력
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
