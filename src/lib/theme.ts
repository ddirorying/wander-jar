export type ThemePref = 'system' | 'light' | 'dark'

export function getThemePref(): ThemePref {
  try {
    const t = localStorage.getItem('wj-theme')
    if (t === 'light' || t === 'dark') return t
  } catch {
    /* 저장소를 못 쓰는 환경 */
  }
  return 'system'
}

export function applyTheme(pref: ThemePref) {
  const root = document.documentElement
  if (pref === 'system') delete root.dataset.theme
  else root.dataset.theme = pref
  try {
    if (pref === 'system') localStorage.removeItem('wj-theme')
    else localStorage.setItem('wj-theme', pref)
  } catch {
    /* 무시 */
  }
  const dark = pref === 'dark' || (pref === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', dark ? '#121110' : '#f3eee4'))
}
