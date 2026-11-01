import { useEffect, useState } from 'react'

type Toast = { id: number; text: string; error?: boolean }
const listeners = new Set<(t: Toast) => void>()
let seq = 0

/** 화면 아래에 잠깐 뜨는 알림 */
export function toast(text: string, error = false) {
  const t = { id: ++seq, text, error }
  listeners.forEach((l) => l(t))
}

/** 알림 표시 + 예상 못 한 오류가 나면 내용을 보여줌 (문제 알려줄 때 캡처용) */
export function Toaster() {
  const [items, setItems] = useState<Toast[]>([])
  useEffect(() => {
    const add = (t: Toast) => {
      setItems((xs) => [...xs.slice(-2), t])
      if (!t.error) setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== t.id)), 2600)
    }
    listeners.add(add)
    const onErr = (e: ErrorEvent) => {
      // 지도 타일 같은 외부 리소스 오류는 무시
      if (!e.message) return
      add({ id: ++seq, text: e.message, error: true })
    }
    const onRej = (e: PromiseRejectionEvent) => {
      const r = e.reason as { name?: string; message?: string } | undefined
      if (r?.name === 'AbortError') return
      add({ id: ++seq, text: `${r?.name ?? '오류'}: ${r?.message ?? String(e.reason)}`, error: true })
    }
    window.addEventListener('error', onErr)
    window.addEventListener('unhandledrejection', onRej)
    return () => {
      listeners.delete(add)
      window.removeEventListener('error', onErr)
      window.removeEventListener('unhandledrejection', onRej)
    }
  }, [])
  if (!items.length) return null
  return (
    <div className="toasts" role="status">
      {items.map((t) =>
        t.error ? (
          <div key={t.id} className="toast toast-error">
            <strong>문제가 생겼어요. 이 화면을 캡처해서 알려 주세요.</strong>
            <span>{t.text}</span>
            <button onClick={() => setItems((xs) => xs.filter((x) => x.id !== t.id))}>닫기</button>
          </div>
        ) : (
          <p key={t.id} className="toast">
            {t.text}
          </p>
        ),
      )}
    </div>
  )
}
