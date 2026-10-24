import type { Meeting } from '../types'
import { formatDateTime } from '../lib/format'

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function safeFileName(m: Meeting): string {
  const base = `${m.heldAt.slice(0, 10).replace(/-/g, '')}_${m.title}`.replace(
    /[\\/:*?"<>|]/g,
    '',
  )
  return base.slice(0, 80)
}

export function buildHtmlDocument(m: Meeting): string {
  const todos = m.todos
    .map(
      (t) =>
        `        <tr><td>${esc(t.task)}</td><td>${esc(t.owner)}</td><td>${esc(t.due)}</td></tr>`,
    )
    .join('\n')
  const decisions = m.decisions.map((d) => `        <li>${esc(d)}</li>`).join('\n')
  const memo = m.memo
    ? `\n      <h2>4. 메모</h2>\n      <p class="memo">${esc(m.memo).replace(/\n/g, '<br />')}</p>`
    : ''

  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <title>${esc(m.title)} — 회의록 보고서</title>
    <style>
      body{max-width:760px;margin:48px auto;padding:0 28px;color:#111;
        font-family:"Malgun Gothic","Apple SD Gothic Neo",sans-serif;line-height:1.7}
      .kicker{font-size:12px;letter-spacing:.18em;color:#666}
      h1{font-size:24px;margin:6px 0 18px}
      table{border-collapse:collapse;width:100%;font-size:14px;margin:14px 0 26px}
      th,td{border:1px solid #d5d5d5;padding:7px 10px;text-align:left;vertical-align:top}
      th{background:#f3f3f3;width:72px;font-weight:600;white-space:nowrap}
      h2{font-size:15px;margin:26px 0 8px;padding-bottom:6px;border-bottom:1px solid #e2e2e2}
      ol{padding-left:20px;margin:8px 0 0}
      li{margin:5px 0}
      .memo{white-space:pre-wrap}
      footer{margin-top:40px;padding-top:12px;border-top:1px solid #e2e2e2;
        font-size:12px;color:#777;display:flex;justify-content:space-between}
      @media print{body{margin:0}}
    </style>
  </head>
  <body>
    <p class="kicker">회의록 보고서</p>
    <h1>${esc(m.title)}</h1>
    <table>
      <tr><th>일시</th><td>${esc(formatDateTime(m.heldAt))}</td></tr>
      <tr><th>참석</th><td>${esc(m.attendees.join(', '))}</td></tr>
      <tr><th>자료</th><td>${esc(m.fileName ?? '없음')}</td></tr>
      <tr><th>길이</th><td>${esc(m.durationLabel ?? '-')}</td></tr>
      ${m.link ? `<tr><th>참고 링크</th><td>${esc(m.link)}</td></tr>` : ''}
    </table>

    <h2>1. 핵심 요약</h2>
    <p>${esc(m.summary)}</p>

    <h2>2. 결정사항</h2>
    <ol>
${decisions}
    </ol>

    <h2>3. 할 일</h2>
    <table>
      <tr><th style="width:auto">할 일</th><th style="width:auto">담당</th><th style="width:auto">기한</th></tr>
${todos}
    </table>${memo}

    <footer>
      <span>회의록 보고서</span>
      <span>생성 ${esc(formatDateTime(m.createdAt))}</span>
    </footer>
  </body>
</html>`
}

export function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 10000)
}
