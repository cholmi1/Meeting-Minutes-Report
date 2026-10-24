import {processingLabel} from '../lib/processing'
import {errorMessage} from '../lib/api'
import type { Meeting } from '../types'
import { formatDateTime } from '../lib/format'
import { buildHtmlDocument, downloadFile, safeFileName } from '../lib/exportHtml'
import { useState } from 'react'

type Props = {
  meeting: Meeting
  onBack: () => void
  onOpenList: () => void
}

export default function ExportScreen({ meeting, onBack, onOpenList }: Props) {
  const [toast, setToast] = useState('')
  const [pending,setPending]=useState(false)
  const [error,setError]=useState('')
  async function word(){if(pending)return;setPending(true);setError('');try{const {downloadDocx}=await import('../lib/exportDocx');await downloadDocx(meeting);showToast('Word 다운로드를 요청했습니다. 브라우저 다운로드 목록을 확인하세요.')}catch(e){setError(errorMessage(e))}finally{setPending(false)}}

  function showToast(msg: string) {
    setToast(msg)
    window.setTimeout(() => setToast(''), 3200)
  }

  function downloadHtml() {
    const html = buildHtmlDocument(meeting)
    downloadFile(`${safeFileName(meeting)}.html`, html, 'text/html;charset=utf-8')
    showToast('HTML 다운로드를 요청했습니다. 브라우저 다운로드 목록을 확인하세요.')
  }

  return (
    <div className="page">
      <div className="page-head split">
        <div>
          <p className="eyebrow">확정 · 출력</p>
          <h1 className="h1">회의록을 파일로 내려받습니다</h1>
          <p className="muted">
            확정된 회의록입니다. 아래 미리보기와 실제 파일 내용은 같습니다.
          </p>
        </div>
        <div className="head-actions">
          <button className="btn btn-ghost btn-sm" onClick={onBack}>
            분석 결과로
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onOpenList}>
            지난 회의록
          </button>
        </div>
      </div>

      <div className="export-grid">
        <div className="paper-wrap">
          <article className="paper">
            <header className="paper-head">
              <p className="paper-kicker">회의록 보고서</p>
              <h2 className="paper-title">{meeting.title}</h2>
              <table className="paper-meta">
                <tbody>
                  <tr>
                    <th>일시</th>
                    <td>{formatDateTime(meeting.heldAt)}</td>
                    <th>참석</th>
                    <td>{meeting.attendees.join(', ')}</td>
                  </tr>
                  <tr>
                    <th>자료</th>
                    <td>{meeting.fileName ?? '없음'}</td>
                    <th>길이</th>
                    <td>{meeting.durationLabel ?? '-'}</td>
                  </tr>
                  <tr><th>처리 AI</th><td colSpan={3}>{processingLabel(meeting)}</td></tr>
                  {meeting.link && <tr><th>참고 링크</th><td colSpan={3}>{meeting.link}</td></tr>}
                </tbody>
              </table>
            </header>

            <section className="paper-section">
              <h3>1. 핵심 요약</h3>
              <p>{meeting.summary}</p>
            </section>

            <section className="paper-section">
              <h3>2. 결정사항</h3>
              <ol>
                {meeting.decisions.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ol>
            </section>

            <section className="paper-section">
              <h3>3. 할 일</h3>
              <table className="paper-table">
                <thead>
                  <tr>
                    <th>할 일</th>
                    <th>담당</th>
                    <th>기한</th>
                  </tr>
                </thead>
                <tbody>
                  {meeting.todos.map((t, i) => (
                    <tr key={i}>
                      <td>{t.task}</td>
                      <td>{t.owner}</td>
                      <td>{t.due}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {meeting.memo && (
              <section className="paper-section">
                <h3>4. 메모</h3>
                <p className="paper-memo">{meeting.memo}</p>
              </section>
            )}

            <footer className="paper-foot">
              <span>회의록 보고서 · {meeting.title}</span>
              <span>생성 {formatDateTime(meeting.createdAt)}</span>
            </footer>
          </article>
        </div>

        <aside className="export-side">
          <div className="panel">
            <p className="panel-title">내려받기</p>
            <button className="btn btn-primary btn-block" onClick={downloadHtml}>
              HTML로 내려받기
            </button>
            <button
              className="btn btn-line btn-block"
              onClick={() => window.print()}
            >
              PDF 저장 · 인쇄
            </button>
            <button
              className="btn btn-line btn-block"
              onClick={() => void word()} disabled={pending}
            >
              {pending ? 'Word 생성 중…' : 'Word(.docx) 내려받기'}
            </button>
            <p className="panel-note">
              PDF 버튼은 브라우저·운영체제 인쇄 창을 엽니다. 대상에서 «PDF로 저장»을 선택하세요. HTML과 Word는 파일로 내려받습니다.
            </p>
          </div>

          <div className="panel">
            <p className="panel-title">확정 정보</p><p className="panel-note">실제 처리: {processingLabel(meeting)}</p>
            <dl className="kv">
              <dt>상태</dt>
              <dd>확정됨</dd>
              <dt>일시</dt>
              <dd>{formatDateTime(meeting.heldAt)}</dd>
              <dt>참석</dt>
              <dd>{meeting.attendees.join(', ')}</dd>
              <dt>원본 파일</dt>
              <dd>{meeting.fileName ?? '없음'}</dd>
            </dl>
          </div>

          <p className="note">
            확정한 회의록은 지난 회의록 목록에서 다시 열 수 있습니다.
          </p>
        </aside>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      {toast && <div role="status" className="toast">{toast}</div>}
    </div>
  )
}
