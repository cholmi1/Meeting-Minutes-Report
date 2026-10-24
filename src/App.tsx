import { useCallback, useEffect, useRef, useState } from 'react'
import TopBar from './components/TopBar'
import LockScreen from './screens/LockScreen'
import HomeScreen from './screens/HomeScreen'
import UploadScreen from './screens/UploadScreen'
import ResultScreen from './screens/ResultScreen'
import ExportScreen from './screens/ExportScreen'
import ArchiveScreen from './screens/ArchiveScreen'
import AdminScreen from './screens/AdminScreen'
import { DEFAULT_API_SETTINGS, normalizeSettings, type ApiSettings } from './lib/providers'
import { api, errorMessage, type Session } from './lib/api'
import type { Meeting } from './types'
import type { View } from './lib/config'
export default function App() {
 const [session,setSession]=useState<Session|null>(null)
 const [loading,setLoading]=useState(true), [error,setError]=useState('')
 const [view,setView]=useState<View>('home')
 const [meetings,setMeetings]=useState<Meeting[]>([]),[draft,setDraft]=useState<Meeting|null>(null)
 const [currentId,setCurrentId]=useState(''),[settings,setSettings]=useState<ApiSettings>(DEFAULT_API_SETTINGS)
 const [saving,setSaving]=useState(false),[saveError,setSaveError]=useState(''),[loggingOut,setLoggingOut]=useState(false)
 const savingRef=useRef(false)
 const load=useCallback(async()=>{setLoading(true);setError('');try{const s=await api<Session>('session');setSession(s);if(s.authenticated){const [a,m]=await Promise.all([api<ApiSettings>('settings'),api<{meetings:Meeting[]}>('meetings')]);setSettings(normalizeSettings(a));setMeetings(m.meetings)}}catch(e){setError(errorMessage(e))}finally{setLoading(false)}},[])
 useEffect(()=>{void load()},[load])
 const go=useCallback((next:View,id?:string)=>{if(id)setCurrentId(id);setView(next);window.scrollTo({top:0})},[])
 async function confirm(meeting:Meeting){if(savingRef.current)return;savingRef.current=true;setSaving(true);setSaveError('');try{const {meeting:saved}=await api<{meeting:Meeting}>('meetings',{meeting:{...meeting,status:'confirmed'}});if(saved.status!=='confirmed')throw new Error('서버에서 확정 저장을 확인하지 못했습니다. 다시 시도해 주세요.');setMeetings(p=>[saved,...p.filter(m=>m.id!==saved.id)]);setDraft(null);go('export',saved.id)}catch(e){setSaveError(errorMessage(e))}finally{setSaving(false);savingRef.current=false}}
 async function logout(){if(loggingOut)return;setLoggingOut(true);try{await api('logout',{});setSession({authenticated:false,admin:false});setMeetings([]);setDraft(null);setSettings(DEFAULT_API_SETTINGS);setView('home');setError('')}catch(e){setError(errorMessage(e))}finally{setLoggingOut(false)}}
 if(loading)return <div className="lock-wrap" role="status">서버 연결과 저장된 회의록을 확인하고 있습니다…</div>
 if(error)return <div className="lock-wrap"><div className="lock-card"><p className="form-error" role="alert">{error}</p><button className="btn btn-primary" onClick={()=>void load()}>다시 연결</button></div></div>
 if(!session?.authenticated)return <LockScreen onUnlock={()=>void load()} />
 const current=draft?.id===currentId?draft:meetings.find(m=>m.id===currentId)
 return <div className="app"><TopBar onHome={()=>go('home')} onArchive={()=>go('archive')} onAdmin={()=>go('admin')} onLock={()=>void logout()} disabled={loggingOut||saving}/><main className="main">
 {view==='home'&&<><HomeScreen meetings={meetings} onUpload={()=>go('upload')} onOpen={id=>go('result',id)} onArchive={()=>go('archive')}/>{draft&&<div className="page panel"><p>저장하지 않은 초안이 있습니다. 새로고침하면 사라집니다.</p><button className="btn btn-line" onClick={()=>go('result',draft.id)}>초안 계속 검토</button></div>}</>}
 {view==='upload'&&<UploadScreen settings={settings} onAnalyzed={m=>{setDraft({...m,status:'draft'});setSaveError('');go('result',m.id)}} onBack={()=>go('home')} onAdmin={()=>go('admin')}/>}
 {view==='result'&&current&&<ResultScreen key={current.id} meeting={current} onConfirm={confirm} onEdit={setDraft} pending={saving} error={saveError} onBack={()=>go('archive')} onOpenExport={id=>go('export',id)}/>}
 {view==='export'&&current?.status==='confirmed'&&<ExportScreen meeting={current} onBack={()=>go('result',current.id)} onOpenList={()=>go('archive')}/>}
 {view==='archive'&&<><ArchiveScreen meetings={meetings} onOpen={id=>go('result',id)} onUpload={()=>go('upload')}/>{draft&&<div className="page panel"><p>아직 저장되지 않은 초안</p><button className="btn btn-line" onClick={()=>go('result',draft.id)}>초안 검토로 돌아가기</button></div>}</>}
 {view==='admin'&&<AdminScreen settings={settings} admin={session.admin} onAdmin={()=>setSession(s=>s?{...s,admin:true}:s)} onChange={next=>setSettings(normalizeSettings(next))} onBack={()=>go('home')}/>}
 </main></div>
}
