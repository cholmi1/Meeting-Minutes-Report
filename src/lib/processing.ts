import type { Meeting } from '../types'
import {providerById} from './providers'
export function processingLabel(meeting:Meeting):string {const p=meeting.processing;if(!p)return '처리 엔진 기록 없음 (기존 회의록)';return (p.transcribe?'받아쓰기 '+providerById(p.transcribe.provider).name+' / '+p.transcribe.model+' · ':'')+'요약 '+providerById(p.summarize.provider).name+' / '+p.summarize.model}
