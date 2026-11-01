import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/gowun-batang/400.css'
import '@fontsource/gowun-batang/700.css'
import './styles.css'
import App from './App'

// 새 버전이 설치되면 한 번 새로고침해서 예전 화면 코드가 남지 않게 함
if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
  let reloaded = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return
    reloaded = true
    location.reload()
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
