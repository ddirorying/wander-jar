import { useEffect, useState } from 'react'
import { HashRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { BottomNav } from './components/BottomNav'
import { Toaster, toast } from './components/Toaster'
import { JarPage } from './pages/JarPage'
import { SavingsPage } from './pages/SavingsPage'
import { SettingsPage } from './pages/SettingsPage'
import { DestinationPage } from './pages/DestinationPage'
import { EditDestinationSheet } from './pages/EditDestinationSheet'
import { applyTheme, getThemePref } from './lib/theme'

function Shell() {
  const loc = useLocation()
  const nav = useNavigate()
  const [creating, setCreating] = useState(false)
  const onDetail = loc.pathname.startsWith('/d/')

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [loc.pathname])

  useEffect(() => {
    // 기기 테마가 바뀌면 상단바 색도 맞춤
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const on = () => applyTheme(getThemePref())
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  return (
    <div className={`app${onDetail ? ' app-detail' : ''}`}>
      <main className="main">
        <Routes>
          <Route path="/" element={<JarPage onAdd={() => setCreating(true)} />} />
          <Route path="/savings" element={<SavingsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/d/:id" element={<DestinationPage />} />
          <Route path="*" element={<JarPage onAdd={() => setCreating(true)} />} />
        </Routes>
      </main>
      {!onDetail && <BottomNav onAdd={() => setCreating(true)} />}
      <Toaster />
      {creating && (
        <EditDestinationSheet
          onClose={() => setCreating(false)}
          onSaved={(id) => {
            // 시트가 쓰던 '뒤로가기' 자리를 새 여행지 화면으로 바꿔치기
            nav(`/d/${id}`, { replace: true })
            setCreating(false)
            toast('보관함에 담았어요')
          }}
        />
      )}
    </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  )
}
