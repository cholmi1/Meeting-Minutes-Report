import type { Meeting, UploadForm } from '../types'
import { formatDateTime, parseAttendees } from '../lib/format'

export const MEETINGS: Meeting[] = [
  {
    id: 'mock-1',
    title: '3분기 운영 점검 회의',
    heldAt: '2026-10-21T14:00:00',
    attendees: ['기획 담당', '개발 담당', '운영 담당', '디자인 담당'],
    memo: '3분기 지표 점검, 4분기 우선순위 조정',
    fileName: '2026-10-21_운영점검.m4a',
    fileSize: 41_238_000,
    durationLabel: '58분',
    status: 'confirmed',
    summary:
      '3분기 핵심 지표는 목표 대비 92% 수준으로 마감되었고, 신규 유입보다 기존 사용자 유지율 개선이 우선 과제로 정리되었다. 4분기는 신규 기능 확장보다 안정화와 응답 속도 개선에 자원을 배분하기로 했다. 다음 회의는 4분기 중간 점검 시점에 열기로 했다.',
    decisions: [
      '4분기 신규 기능 추가는 보류하고 안정화 작업을 우선한다.',
      '응답 속도 개선 항목은 다음 주까지 목록화해 공유한다.',
      '월간 보고는 문서 형식으로 통일하고 회의 횟수를 줄인다.',
    ],
    todos: [
      { task: '응답 속도 개선 항목 목록 작성 및 공유', owner: '개발 담당', due: '10월 28일' },
      { task: '3분기 지표 요약표 정리', owner: '기획 담당', due: '10월 24일' },
      { task: '월간 보고 문서 양식 확정', owner: '운영 담당', due: '11월 1일' },
    ],
    transcript: [
      { time: '00:02', speaker: '기획 담당', text: '3분기 지표부터 보겠습니다. 전체 목표 대비 92% 수준으로 마감됐습니다.' },
      { time: '00:41', speaker: '개발 담당', text: '신규 유입은 예상보다 낮았고, 기존 사용자 유지율은 조금 올랐습니다.' },
      { time: '12:07', speaker: '운영 담당', text: '문의 건수는 줄었는데 응답 시간이 느리다는 의견이 늘었습니다.' },
      { time: '23:55', speaker: '기획 담당', text: '4분기에 기능을 더 붙일지, 안정화에 집중할지 정해야 합니다.' },
      { time: '31:20', speaker: '개발 담당', text: '안정화를 먼저 하는 편이 낫습니다. 개선 항목을 목록으로 정리해 공유하겠습니다.' },
      { time: '48:10', speaker: '운영 담당', text: '회의 횟수를 줄이고 문서로 공유하는 방식으로 바꾸면 좋겠습니다.' },
    ],
    createdAt: '2026-10-21T16:12:00',
  },
  {
    id: 'mock-2',
    title: '신규 서비스 기획 검토',
    heldAt: '2026-10-14T10:30:00',
    attendees: ['기획 담당', '개발 담당', '디자인 담당'],
    memo: '신규 서비스 초안 검토, 일정 역산',
    fileName: '2026-10-14_기획검토.mp4',
    fileSize: 187_450_000,
    durationLabel: '1시간 12분',
    status: 'confirmed',
    summary:
      '신규 서비스 초안의 범위를 첫 화면과 저장 기능까지로 좁히기로 했다. 전체 기능을 한 번에 만들면 일정이 흔들린다는 판단이 공통된 의견이었다. 11월 첫째 주까지 동작하는 시안을 만들고, 그 결과를 보고 다음 범위를 정한다.',
    decisions: [
      '첫 출시 범위는 화면 3개와 저장 기능으로 제한한다.',
      '디자인은 검정·회색 계열의 진중한 방향으로 확정한다.',
      '11월 첫째 주 시안 확인 후 확장 여부를 다시 논의한다.',
    ],
    todos: [
      { task: '화면 3개 시안 제작', owner: '디자인 담당', due: '10월 30일' },
      { task: '저장 구조 초안 정리', owner: '개발 담당', due: '11월 3일' },
      { task: '사용자 의견 5건 수집', owner: '기획 담당', due: '11월 6일' },
    ],
    transcript: [
      { time: '00:05', speaker: '기획 담당', text: '초안은 기능이 너무 많습니다. 어디까지 줄일지 정해야 합니다.' },
      { time: '08:32', speaker: '디자인 담당', text: '첫 화면과 저장 기능만 있어도 쓸 만한지 확인하는 게 먼저입니다.' },
      { time: '26:14', speaker: '개발 담당', text: '범위를 줄이면 2주 안에 동작하는 시안이 나옵니다.' },
      { time: '44:50', speaker: '기획 담당', text: '색은 밝은 톤보다 진중한 쪽으로 가는 게 좋겠습니다.' },
    ],
    createdAt: '2026-10-14T12:05:00',
  },
  {
    id: 'mock-3',
    title: '월간 진행 상황 공유',
    heldAt: '2026-10-07T16:00:00',
    attendees: ['기획 담당', '운영 담당', '개발 담당'],
    memo: '9월 마감 정리, 10월 일정 공유',
    fileName: '2026-10-07_월간공유.m4a',
    fileSize: 28_910_000,
    durationLabel: '34분',
    status: 'draft',
    summary:
      '9월에 마무리된 작업 6건과 남은 작업 2건을 확인했다. 남은 작업은 10월 둘째 주까지 마무리하고, 이후 일정은 다음 회의에서 정하기로 했다.',
    decisions: ['남은 작업 2건은 10월 둘째 주까지 마무리한다.', '일정 재조정은 다음 회의에서 다룬다.'],
    todos: [
      { task: '남은 작업 2건 마무리', owner: '개발 담당', due: '10월 17일' },
      { task: '10월 일정표 공유', owner: '운영 담당', due: '10월 10일' },
    ],
    transcript: [
      { time: '00:03', speaker: '운영 담당', text: '9월에 마무리된 작업 6건부터 확인하겠습니다.' },
      { time: '11:40', speaker: '개발 담당', text: '남은 2건은 다음 주 안에 끝납니다.' },
      { time: '22:18', speaker: '기획 담당', text: '일정 재조정은 다음 회의에서 이야기합시다.' },
    ],
    createdAt: '2026-10-07T17:02:00',
  },
]

const TEMPLATE_SUMMARY =
  '회의에서 논의된 내용을 시간 순서대로 정리한 결과, 우선 처리할 항목과 다음 회의까지 확인할 항목이 구분되었다. 결론이 난 안건은 바로 실행으로 넘기고, 추가 검토가 필요한 안건은 다음 회의 안건으로 넘겼다.'

export function buildMockMeeting(form: UploadForm): Meeting {
  const memoLine = form.memo.split('\n').map((s) => s.trim()).filter(Boolean)[0]
  const title = memoLine ? memoLine.slice(0, 40) : '회의록'
  const attendees = parseAttendees(form.attendees)
  const file = form.file

  return {
    id: `local-${Date.now()}`,
    title,
    heldAt: form.heldAt || new Date().toISOString().slice(0, 16),
    attendees: attendees.length > 0 ? attendees : ['참석자 미기재'],
    link: form.link || undefined,
    memo: form.memo || undefined,
    fileName: file?.name,
    fileSize: file?.size,
    durationLabel: '약 45분',
    status: 'draft',
    summary: TEMPLATE_SUMMARY,
    decisions: [
      '이번 회의에서 정리된 우선 항목을 다음 주까지 처리한다.',
      '추가 검토가 필요한 안건은 다음 회의 안건으로 넘긴다.',
      '진행 상황은 문서로 공유하고 회의 횟수를 줄인다.',
    ],
    todos: [
      { task: '정리된 우선 항목 처리', owner: attendees[0] ?? '담당자 미정', due: '다음 주' },
      { task: '진행 상황 문서로 공유', owner: attendees[1] ?? '담당자 미정', due: '이번 주' },
      { task: '다음 회의 안건 정리', owner: attendees[2] ?? '담당자 미정', due: '다음 회의' },
    ],
    transcript: [
      { time: '00:04', speaker: attendees[0] ?? '발언자 1', text: '오늘 안건부터 확인하겠습니다.' },
      { time: '06:20', speaker: attendees[1] ?? '발언자 2', text: '우선 처리할 항목을 먼저 정리하는 게 좋겠습니다.' },
      { time: '19:45', speaker: attendees[0] ?? '발언자 1', text: '그럼 남은 안건은 다음 회의로 넘기겠습니다.' },
    ],
    createdAt: new Date().toISOString(),
  }
}

export function meetingMetaLine(m: Meeting): string {
  return `${formatDateTime(m.heldAt)} · ${m.attendees.length}명 참석`
}
