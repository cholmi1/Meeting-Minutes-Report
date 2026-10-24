type Props = {
  disabled?: boolean
  onHome: () => void
  onArchive: () => void
  onAdmin: () => void
  onLock: () => void
}

export default function TopBar({ onHome, onArchive, onAdmin, onLock, disabled }: Props) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <button className="brand" onClick={onHome} aria-label="첫 화면으로">
          <span className="brand-mark" aria-hidden="true">
            회
          </span>
          <span className="brand-text">
            <span className="brand-name">회의록 보고서</span>
            <span className="brand-sub">회의내용을 간결하고 핵심정리를 하는 앱</span>
          </span>
        </button>

        <div className="topbar-right">
          <button className="btn btn-ghost btn-sm" onClick={onArchive}>
            <span className="only-desk">지난 회의록</span>
            <span className="only-mob">목록</span>
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onAdmin}>
            관리자
          </button>
          <button className="btn btn-line btn-sm" onClick={onLock} disabled={disabled}>
            잠그기
          </button>
        </div>
      </div>
    </header>
  )
}
