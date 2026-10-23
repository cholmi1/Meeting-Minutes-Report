import type { Meeting } from '../types'
import { formatDateShort } from '../lib/format'

type Props = {
  meeting: Meeting
  onOpen: (id: string) => void
  index?: number
}

export default function MeetingRow({ meeting, onOpen, index }: Props) {
  return (
    <button className="row" onClick={() => onOpen(meeting.id)}>
      {typeof index === 'number' && <span className="row-index">{String(index + 1).padStart(2, '0')}</span>}
      <span className="row-date">{formatDateShort(meeting.heldAt)}</span>
      <span className="row-main">
        <span className="row-title">{meeting.title}</span>
        <span className="row-sub">
          {meeting.attendees.length}명 참석 · 결정사항 {meeting.decisions.length}건 · 할 일{' '}
          {meeting.todos.length}건
        </span>
      </span>
      <span className={`chip ${meeting.status === 'confirmed' ? 'chip-done' : 'chip-draft'}`}>
        {meeting.status === 'confirmed' ? '확정' : '검토 중'}
      </span>
      <span className="row-arrow" aria-hidden="true">
        →
      </span>
    </button>
  )
}
