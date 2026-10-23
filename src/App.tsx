import { useCallback, useState } from 'react'
import TopBar from './components/TopBar'
import LockScreen from './screens/LockScreen'
import HomeScreen from './screens/HomeScreen'
import UploadScreen from './screens/UploadScreen'
import ResultScreen from './screens/ResultScreen'
import ExportScreen from './screens/ExportScreen'
import ArchiveScreen from './screens/ArchiveScreen'
import AdminScreen from './screens/AdminScreen'
import { MEETINGS } from './mock/data'
import { DEFAULT_API_SETTINGS, type ApiSettings } from './lib/providers'
import type { Meeting } from './types'
import type { View } from './lib/config'

export default function App() {
  const [unlocked, setUnlocked] = useState(false)
  const [view, setView] = useState<View>('home')
  const [meetings, setMeetings] = useState<Meeting[]>(MEETINGS)
  const [currentId, setCurrentId] = useState<string>(MEETINGS[0]?.id ?? '')
  const [apiSettings, setApiSettings] = useState<ApiSettings>(DEFAULT_API_SETTINGS)

  const current = meetings.find((m) => m.id === currentId) ?? meetings[0] ?? null

  const go = useCallback((next: View, id?: string) => {
    if (id) setCurrentId(id)
    setView(next)
    window.scrollTo({ top: 0 })
  }, [])

  const handleAnalyzed = useCallback((meeting: Meeting) => {
    setMeetings((prev) => [meeting, ...prev])
    setCurrentId(meeting.id)
    setView('result')
    window.scrollTo({ top: 0 })
  }, [])

  const handleConfirm = useCallback((id: string) => {
    setMeetings((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status: 'confirmed' as const } : m)),
    )
    setCurrentId(id)
    setView('export')
    window.scrollTo({ top: 0 })
  }, [])

  if (!unlocked) {
    return <LockScreen onUnlock={() => setUnlocked(true)} />
  }

  return (
    <div className="app">
      <TopBar
        onHome={() => go('home')}
        onArchive={() => go('archive')}
        onAdmin={() => go('admin')}
        onLock={() => {
          setUnlocked(false)
          setView('home')
        }}
      />
      <main className="main">
        {view === 'home' && (
          <HomeScreen
            meetings={meetings}
            onUpload={() => go('upload')}
            onOpen={(id) => go('result', id)}
            onArchive={() => go('archive')}
          />
        )}

        {view === 'upload' && (
          <UploadScreen
            settings={apiSettings}
            onAnalyzed={handleAnalyzed}
            onBack={() => go('home')}
          />
        )}

        {view === 'result' && current && (
          <ResultScreen
            meeting={current}
            onConfirm={handleConfirm}
            onBack={() => go('archive')}
            onOpenExport={(id) => go('export', id)}
          />
        )}

        {view === 'export' && current && (
          <ExportScreen
            meeting={current}
            onBack={() => go('result', current.id)}
            onOpenList={() => go('archive')}
          />
        )}

        {view === 'archive' && (
          <ArchiveScreen
            meetings={meetings}
            onOpen={(id) => go('result', id)}
            onUpload={() => go('upload')}
          />
        )}

        {view === 'admin' && (
          <AdminScreen
            settings={apiSettings}
            onChange={setApiSettings}
            onBack={() => go('home')}
          />
        )}
      </main>
    </div>
  )
}
