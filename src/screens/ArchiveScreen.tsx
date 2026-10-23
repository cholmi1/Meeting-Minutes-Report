import type { Meeting } from '../types'
import MeetingRow from '../components/MeetingRow'

type Props = {
  meetings: Meeting[]
  onOpen: (id: string) => void
  onUpload: () => void
}

export default function ArchiveScreen({ meetings, onOpen, onUpload }: Props) {
  const confirmed = meetings.filter((m) => m.status === 'confirmed').length

  return (
    <div className="page">
      <div className="page-head split">
        <div>
          <p className="eyebrow">지난 회의록</p>
          <h1 className="h1">저장된 회의록 {meetings.length}건</h1>
          <p className="muted">
            확정 {confirmed}건 · 검토 중 {meetings.length - confirmed}건
          </p>
        </div>
        <div className="head-actions">
          <button className="btn btn-primary btn-sm" onClick={onUpload}>
            자료 등록
          </button>
        </div>
      </div>

      <div className="rows">
        {meetings.map((m, i) => (
          <MeetingRow key={m.id} meeting={m} onOpen={onOpen} index={i} />
        ))}
        {meetings.length === 0 && (
          <div className="empty">아직 저장된 회의록이 없습니다.</div>
        )}
      </div>

      <p className="note">
        1단계에서는 화면 확인을 위해 가상 데이터가 들어 있습니다. 새로고침하면 초기 상태로
        돌아갑니다.
      </p>
    </div>
  )
}
