import type { Status, WishCategory } from '../types'

export const STATUS_LABEL: Record<Status, string> = {
  dreaming: '꿈꾸는 중',
  planning: '계획 중',
  booked: '예약 완료',
  visited: '다녀옴',
}
export const STATUS_ORDER: Status[] = ['dreaming', 'planning', 'booked', 'visited']

export const CATEGORY_LABEL: Record<WishCategory, string> = {
  eat: '먹기',
  see: '보기',
  do: '하기',
  buy: '사기',
  stay: '머물기',
}
export const CATEGORY_ORDER: WishCategory[] = ['eat', 'see', 'do', 'buy', 'stay']

export const PRESET_TAGS = ['바다', '도시', '미식', '자연', '축제', '산', '휴양', '역사', '예술', '야경', '온천', '쇼핑']

export const SEASONS: { label: string; months: number[] }[] = [
  { label: '봄', months: [3, 4, 5] },
  { label: '여름', months: [6, 7, 8] },
  { label: '가을', months: [9, 10, 11] },
  { label: '겨울', months: [12, 1, 2] },
]

export function formatMonths(months: number[]): string {
  if (!months.length) return ''
  const set = new Set(months)
  const seasons = SEASONS.filter((s) => s.months.every((m) => set.has(m)))
  const covered = new Set(seasons.flatMap((s) => s.months))
  const rest = [...set].filter((m) => !covered.has(m)).sort((a, b) => a - b)
  if (months.length === 12) return '언제든'
  const parts = [...seasons.map((s) => s.label)]
  if (rest.length) parts.push(rest.join('·') + '월')
  return parts.join(', ')
}

/** 1500000 → "150만 원", 12345 → "12,345원" */
export function formatKRW(n: number | undefined): string {
  if (n === undefined || n === null || Number.isNaN(n)) return ''
  const sign = n < 0 ? '−' : ''
  const a = Math.abs(n)
  if (a >= 10000 && a % 10000 === 0) return `${sign}${(a / 10000).toLocaleString('ko-KR')}만 원`
  if (a >= 100000) {
    const man = Math.floor(a / 10000)
    const rest = a % 10000
    return `${sign}${man.toLocaleString('ko-KR')}만 ${rest.toLocaleString('ko-KR')}원`
  }
  return `${sign}${a.toLocaleString('ko-KR')}원`
}

export function parseAmount(s: string): number | undefined {
  const digits = s.replace(/[^\d]/g, '')
  if (!digits) return undefined
  return Number(digits)
}

export function todayStr(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatDate(s?: string): string {
  if (!s) return ''
  const [y, m, d] = s.split('-').map(Number)
  const now = new Date()
  return y === now.getFullYear() ? `${m}월 ${d}일` : `${y}. ${m}. ${d}.`
}

export function daysSince(ts?: number): number | undefined {
  if (!ts) return undefined
  return Math.floor((Date.now() - ts) / 86400000)
}

/** 도시 이름으로 항상 같은 엽서 색을 고름 (사진이 없을 때) */
const PALETTES = [
  ['#c96f4a', '#e8b07a'],
  ['#2f5d62', '#88b5ad'],
  ['#5b4b8a', '#c3a6d8'],
  ['#8a6d3b', '#e3c98f'],
  ['#3d5a80', '#98c1d9'],
  ['#9b3d4b', '#e8a0a0'],
  ['#4a6b3d', '#b5cf8f'],
  ['#2c3e50', '#c9a26b'],
]
export function paletteFor(name: string): [string, string] {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return PALETTES[h % PALETTES.length] as [string, string]
}

export function normalizeUrl(s: string): string {
  const t = s.trim()
  if (!t) return t
  return /^https?:\/\//i.test(t) ? t : `https://${t}`
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
