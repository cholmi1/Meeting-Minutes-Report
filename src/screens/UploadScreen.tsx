import {uploadGemini} from '../lib/geminiUpload'
import { useRef, useState } from 'react'
import { blobBase64, prepareAudio, type PreparedAudio } from '../lib/audioChunks'
import type { Meeting, UploadForm } from '../types'
import { api, errorMessage } from '../lib/api'
import { formatFileSize, todayLocalInput } from '../lib/format'
import { providerById, type ApiSettings } from '../lib/providers'

type Props = {
  settings: ApiSettings
  onAnalyzed: (meeting: Meeting) => void
  onBack: () => void
  onAdmin: () => void
}



export default function UploadScreen({ settings, onAnalyzed, onBack, onAdmin }: Props) {
  const transcribe = providerById(settings.transcribe)
  const summarizer = providerById(settings.summarize)
const [form, setForm] = useState<UploadForm>({
    file: null,
    link: '',
    memo: '',
    attendees: '',
    heldAt: todayLocalInput(),
  })
  const keysReady = settings.keys[settings.summarize].registered && (!form.file || settings.keys[settings.transcribe].registered)
  const recipients = [...new Set([...(form.file ? [transcribe.name] : []),summarizer.name])].join(' 및 ')
  const STEPS = ['자료 확인', form.file ? (settings.transcribe==='openai'?'로컬 음성 변환·OpenAI 받아쓰기':'Google 파일 업로드') : '파일 없음 · 메모 사용', summarizer.name+' 요약 응답 대기', '초안 검토']
  const [chunks,setChunks]=useState({done:0,total:0})
  const [localStatus,setLocalStatus]=useState('')
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [phase, setPhase] = useState<'form' | 'analyzing'>('form')
  const [step, setStep] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)
  const busy = useRef(false)
  const [consent,setConsent] = useState(false)
  const [uploaded,setUploaded] = useState(0)
  function pickFile(file: File | null) {
    if (!file) return
    if(file.size>100*1024*1024){setError('파일은 최대 100MB까지 올릴 수 있습니다.');return}
    setForm((f) => ({ ...f, file }));setConsent(false)
    setError('')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if(busy.current)return
    if(!keysReady){setError('사용할 제공사의 API 열쇠가 없습니다. 관리자에서 등록해 주세요.');return}
    if(!form.file&&!form.memo.trim()){setError('녹음 파일 또는 메모 중 하나를 입력해 주세요.');return}
    if(!form.heldAt){setError('회의 일시를 넣어 주세요.');return}
    if(!consent){setError(recipients+' 외부 처리 동의가 필요합니다.');return}
    busy.current=true;setError('');setUploaded(0);setChunks({done:0,total:0});setStep(0);setPhase('analyzing')
    let prepared:PreparedAudio|undefined
    try {
      const transcriptionProofs:string[]=[]
      let file:unknown,transcript:Meeting['transcript']|undefined,audioMeta:{name:string;size:number;durationLabel:string}|undefined
      if(form.file){
        setStep(1)
        if(settings.transcribe==='openai'){
          setLocalStatus('브라우저에서 음성 길이·메모리를 확인하고 변환 중입니다. 아직 음성을 전송하지 않았습니다.')
          prepared=await prepareAudio(form.file)
          setChunks({done:0,total:prepared.count});transcript=[]
          audioMeta={name:form.file.name,size:form.file.size,durationLabel:Math.floor(prepared.duration/60)+'분 '+Math.round(prepared.duration%60)+'초'}
          for(let chunkIndex=0;chunkIndex<prepared.count;chunkIndex++){
            setLocalStatus('OpenAI에 '+(chunkIndex+1)+' / '+prepared.count+' 조각 전송·받아쓰기 중')
            const wav=prepared.chunk(chunkIndex)
            const data=await blobBase64(new Blob([wav],{type:'audio/wav'}))
            const result=await api<{transcript:Meeting['transcript'];proof?:string;processing?:{provider:string;model:string}}>('transcribe-chunk',{data,chunkIndex,offsetSeconds:chunkIndex*60,consent:true})
            if(!Array.isArray(result.transcript))throw new Error('OpenAI 받아쓰기 응답을 확인하지 못했습니다. 입력 자료는 유지됩니다.')
            if(result.proof)transcriptionProofs.push(result.proof)
            if(result.processing)setLocalStatus('실제 받아쓰기: '+result.processing.provider+' / '+result.processing.model)
            transcript.push(...result.transcript);setChunks({done:chunkIndex+1,total:prepared.count})
          }
          prepared.dispose();prepared=undefined
        }else{
          file=await uploadGemini(form.file,setUploaded)
        }
      }
      setStep(2)
      const result=await api<{meeting:Meeting}>('analyze',{memo:form.memo,attendees:form.attendees,heldAt:form.heldAt,link:form.link,file,transcript,transcriptionProofs:audioMeta?transcriptionProofs:undefined,audioMeta,consent:true})
      setStep(3);onAnalyzed(result.meeting)
    } catch(e){setError(errorMessage(e));setPhase('form')}
    finally {prepared?.dispose();busy.current=false}
  }

  if (phase === 'analyzing') {
    return (
      <div className="page narrow">
        <div className="analyzing">
          <p className="eyebrow">ANALYZING</p>
          <h1 className="h2">회의 내용을 정리하고 있습니다</h1>
          <p className="muted">{form.file?.name}</p>
          <p className="engine-line">
            {form.file ? '받아쓰기 '+transcribe.name+' ('+(settings.transcribeModel||'자동')+') · ' : ''}요약 {summarizer.name} ({settings.summarizeModel||'자동'})
          </p>

          <div className="progress">
            <div
              className="progress-bar"
              style={{ width: step === 1 && form.file ? (settings.transcribe==='openai' ? (chunks.total ? chunks.done/chunks.total*100 : 0) : uploaded/form.file.size*100) + '%' : '0%' }}
            />
          </div>

          <ul className="proc-list">
            {STEPS.map((label, i) => (
              <li key={label} className={i < step ? 'done' : i === step ? 'active' : ''}>
                <span className="proc-dot" aria-hidden="true" />
                <span className="proc-label">{label}</span>
                <span className="proc-state">
                  {i < step ? '완료' : i === step ? '진행 중' : '대기'}
                </span>
              </li>
            ))}
          </ul>
          <p className="note">
            {step === 1 && settings.transcribe==='openai' ? localStatus+' · 완료 '+chunks.done+' / '+chunks.total : step === 1 ? formatFileSize(uploaded) + ' / ' + formatFileSize(form.file?.size ?? 0) + ' 전송됨' : '서버 응답을 기다리고 있습니다. 분석 중 새로고침하지 마세요.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-head">
        <p className="eyebrow">자료 등록</p>
        <h1 className="h1">회의 자료를 올려 주세요</h1>
        <p className="muted">
          녹음·녹화 파일 또는 메모로 회의록 초안을 만듭니다. Gemini 원본 최대 100MiB. OpenAI는 원본 100MiB·60분 이내라도 브라우저 메모리 예상 256MiB를 넘으면 처리하지 않습니다.
        </p>
      </div>

      <form className="upload-grid" onSubmit={submit}>
        <div className="upload-main">
          <div
            className={`dropzone ${dragging ? 'dragging' : ''} ${form.file ? 'has-file' : ''}`}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              pickFile(e.dataTransfer.files?.[0] ?? null)
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click()
            }}
          >
            <input
              ref={fileRef}
              type="file"
              accept="audio/*,video/*"
              hidden
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
            {form.file ? (
              <>
                <span className="dz-icon">▣</span>
                <span className="dz-file">{form.file.name}</span>
                <span className="dz-meta">{formatFileSize(form.file.size)} · 클릭하면 다시 선택</span>
              </>
            ) : (
              <>
                <span className="dz-icon">↑</span>
                <span className="dz-title">녹음·녹화 파일을 여기로 끌어다 놓으세요</span>
                <span className="dz-meta">또는 클릭해서 선택 (mp3, m4a, wav, mp4, mov)</span>
              </>
            )}
          </div>

          <label className="field">
            <span className="field-label">회의 링크 (선택)</span>
            <input
              className="input"
              type="url"
              placeholder="https://..."
              value={form.link}
              onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))}
            />
            <span className="field-hint">
              링크는 주소만 기록하는 참고 정보입니다. 링크 내용은 가져오거나 분석하지 않습니다.
            </span>
          </label>

          <label className="field">
            <span className="field-label">메모 (파일이 없으면 필수)</span>
            <textarea
              className="input textarea"
              rows={5}
              placeholder="안건, 배경, 따로 강조하고 싶은 내용을 적어 주세요."
              value={form.memo}
              onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))}
            />
            <span className="field-hint">메모 첫 줄은 회의록 제목 후보로 쓰입니다.</span>
          </label>
        </div>

        <aside className="upload-side">
          <label className="field">
            <span className="field-label">참석자</span>
            <input
              className="input"
              type="text"
              placeholder="기획 담당, 개발 담당, 운영 담당"
              value={form.attendees}
              onChange={(e) => setForm((f) => ({ ...f, attendees: e.target.value }))}
            />
            <span className="field-hint">
              이름 대신 담당 역할을 쉼표로 구분해 넣는 것을 권장합니다.
            </span>
          </label>

          <label className="field">
            <span className="field-label">회의 일시</span>
            <input
              className="input"
              type="datetime-local"
              value={form.heldAt}
              onChange={(e) => setForm((f) => ({ ...f, heldAt: e.target.value }))}
            />
          </label>

          <div className="panel">
            <p className="panel-title">이렇게 처리됩니다</p>
            <ul className="tiny-list">
              <li>올린 파일은 분석에만 쓰이고 원본은 바뀌지 않습니다.</li>
              <li>확정 전에는 저장되지 않으며, 마음에 안 들면 버릴 수 있습니다.</li>
              <li>분석은 자동, 확정은 직접 누르는 버튼으로 결정합니다.</li>
            </ul>
          </div>

          <div className="panel">
            <p className="panel-title">사용할 AI</p>
            <dl className="kv">
              <dt>받아쓰기</dt>
              <dd>
                {form.file ? transcribe.name+' · '+(settings.keys[settings.transcribe].registered?'열쇠 있음':'열쇠 없음')+' · '+(settings.transcribeModel||'자동 모델') : '사용 안 함 (메모만 요약)'}
              </dd>
              <dt>요약</dt>
              <dd>
                {summarizer.name} {settings.keys[settings.summarize].registered ? '· 열쇠 있음' : '· 열쇠 없음'} · {settings.summarizeModel||'자동 모델'}
              </dd>
            </dl>
            {!keysReady && (
              <p className="panel-note warn-inline">
                선택한 제공사의 API 열쇠가 없습니다. 메모만 쓰면 요약 열쇠만, 파일이 있으면 받아쓰기와 요약 열쇠가 필요합니다.
              </p>
            )}
          </div>

          <label className="consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/> 입력 자료(음성·메모·참석자)를 외부 {recipients}로 전송·처리하는 데 동의합니다. {form.file && settings.transcribe!==settings.summarize ? transcribe.name+'에서 받아쓴 원문을 '+summarizer.name+'에도 전송합니다. ' : ''} 개인정보 처리 조건·보관 정책을 확인하기 전 기밀·개인정보를 입력하지 마세요.</label>
          {!keysReady && <button type="button" className="btn btn-line btn-block" onClick={onAdmin}>관리자에서 AI 연결</button>}
          {error && <p role="alert" className="form-error">{error}</p>}

          <button className="btn btn-primary btn-block" type="submit" disabled={!keysReady || !consent}>
            분석 시작
          </button>
          <button className="btn btn-ghost btn-block" type="button" onClick={onBack}>
            취소
          </button>
        </aside>
      </form>
    </div>
  )
}
