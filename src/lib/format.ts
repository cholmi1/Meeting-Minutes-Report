const WEEK = ['일', '월', '화', '수', '목', '금', '토']

export function formatDateTime(iso: string): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}. ${pad(d.getMonth() + 1)}. ${pad(d.getDate())}. (${WEEK[d.getDay()]}) ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatDateShort(iso: string): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`
}

export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '-'
  const mb = bytes / (1024 * 1024)
  if (mb >= 1) return `${mb.toFixed(1)}MB`
  return `${Math.max(1, Math.round(bytes / 1024))}KB`
}

export function parseAttendees(input: string): string[] {
  return input
    .split(/[,、·\/]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function todayLocalInput(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
