export type TodoItem = {
  task: string
  owner: string
  due: string
}

export type TranscriptLine = {
  time: string
  speaker: string
  text: string
}

export type Meeting = {
  id: string
  title: string
  heldAt: string
  attendees: string[]
  link?: string
  memo?: string
  fileName?: string
  fileSize?: number
  durationLabel?: string
  status: 'draft' | 'confirmed'
  summary: string
  decisions: string[]
  todos: TodoItem[]
  transcript: TranscriptLine[]
  createdAt: string
}

export type UploadForm = {
  file: File | null
  link: string
  memo: string
  attendees: string
  heldAt: string
}
