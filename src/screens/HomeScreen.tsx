import type { Meeting } from '../types'
import MeetingRow from '../components/MeetingRow'

type Props = {
  meetings: Meeting[]
  onUpload: () => void
  onOpen: (id: string) => void
  onArchive: () => void
}

export default function HomeScreen({ meetings, onUpload, onOpen, onArchive }: Props) {
  const confirmed = meetings.filter((m) => m.status === 'confirmed').length
  const draft = meetings.length - confirmed
  const recent = meetings.slice(0, 4)

  return (
    <div className="page">
      <section className="hero">
        <div className="hero-main">
          <p className="eyebrow">MEETING REPORT</p>
          <h1 className="hero-title">
            회의가 끝나면,
            <br />
            정리는 자동으로.
          </h1>
          <p className="hero-desc">
            녹음·녹화 파일 하나를 올리면 회의 내용을 받아 적고, 핵심 요약·결정사항·할 일로
            정리해 회의록을 만들어 드립니다. 확정은 사람이 직접 누릅니다.
          </p>
          <div className="hero-actions">
            <button className="btn btn-primary" onClick={onUpload}>
              자료 등록
            </button>
            <button className="btn btn-ghost" onClick={onArchive}>
              지난 회의록 보기
            </button>
          </div>
        </div>

        <aside className="hero-side">
          <p className="side-label">현황</p>
          <div className="stat-row">
            <span className="stat-k">저장된 회의록</span>
            <span className="stat-v">
              {meetings.length}
              <em>건</em>
            </span>
          </div>
          <div className="stat-row">
            <span className="stat-k">확정됨</span>
            <span className="stat-v">
              {confirmed}
              <em>건</em>
            </span>
          </div>
          <div className="stat-row">
            <span className="stat-k">검토 중</span>
            <span className="stat-v">
              {draft}
              <em>건</em>
            </span>
          </div>
          <p className="side-note">확정한 회의록만 저장됩니다. 개인정보·기밀정보 입력 전 처리 조건을 확인하세요.</p>
        </aside>
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">최근 회의록</h2>
          <button className="link-btn" onClick={onArchive}>
            전체 보기 →
          </button>
        </div>
        <div className="rows">
          {recent.map((m, i) => (
            <MeetingRow key={m.id} meeting={m} onOpen={onOpen} index={i} />
          ))}
          {recent.length === 0 && (
            <div className="empty">
              아직 저장된 회의록이 없습니다. «자료 등록»으로 첫 회의록을 만들어 보세요.
            </div>
          )}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">쓰는 순서</h2>
        </div>
        <ol className="steps">
          <li>
            <span className="step-n">01</span>
            <span className="step-t">자료 등록</span>
            <span className="step-d">녹음·녹화 파일, 링크, 메모, 참석자, 일시를 넣습니다.</span>
          </li>
          <li>
            <span className="step-n">02</span>
            <span className="step-t">자동 정리</span>
            <span className="step-d">음성을 글로 옮기고 핵심 요약·결정사항·할 일을 뽑습니다.</span>
          </li>
          <li>
            <span className="step-n">03</span>
            <span className="step-t">확정과 출력</span>
            <span className="step-d">확인 후 «확정»을 누르면 WORD·PDF·HTML로 내려받습니다.</span>
          </li>
        </ol>
      </section>
    </div>
  )
}
