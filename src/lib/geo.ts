import type { Stop } from '../types'

export const DAY_COLORS = ['#8c8478', '#b5462f', '#2f6b72', '#6f5fa3', '#c39a4a', '#3d5a80', '#9b3d4b', '#4a6b3d', '#d2691e', '#5b8c85']
/** day 0(미정)은 회색, 그 뒤는 날마다 다른 색 */
export const dayColor = (day: number) => (day <= 0 ? DAY_COLORS[0] : DAY_COLORS[((day - 1) % (DAY_COLORS.length - 1)) + 1])

export interface Place {
  name: string
  address: string
  lat: number
  lng: number
}

/**
 * 오픈스트리트맵(Nominatim) 장소 검색 — 무료, 키 없음.
 * 이용 규칙상 1초에 1번 이하로만, 그리고 입력할 때마다가 아니라 '찾기'를 눌렀을 때만 호출합니다.
 */
let lastCall = 0
export async function searchPlaces(q: string, near?: { lat: number; lng: number }): Promise<Place[]> {
  const wait = 1100 - (Date.now() - lastCall)
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastCall = Date.now()
  const params = new URLSearchParams({ q, format: 'jsonv2', limit: '8', 'accept-language': 'ko,en', addressdetails: '0' })
  if (near) {
    const d = 0.6 // 대략 반경 50km 정도를 우선 (밖의 결과도 나옴)
    params.set('viewbox', [near.lng - d, near.lat + d, near.lng + d, near.lat - d].join(','))
  }
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error('search failed')
  const rows = (await res.json()) as { name?: string; display_name: string; lat: string; lon: string }[]
  return rows.map((r) => {
    const parts = r.display_name.split(',').map((s) => s.trim())
    const name = r.name || parts[0]
    return { name, address: parts.filter((p) => p !== name).slice(0, 4).join(', '), lat: Number(r.lat), lng: Number(r.lon) }
  })
}

/** 두 지점 사이 직선거리 (km) */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371
  const toRad = (x: number) => (x * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function formatKm(km: number) {
  if (km < 1) return `${Math.round(km * 1000 / 10) * 10}m`
  if (km < 10) return `${km.toFixed(1)}km`
  return `${Math.round(km)}km`
}

export type TravelMode = 'walking' | 'transit' | 'driving'
export const TRAVEL_LABEL: Record<TravelMode, string> = { walking: '걷기', transit: '대중교통', driving: '자동차' }

const ll = (s: { lat: number; lng: number }) => `${s.lat.toFixed(6)},${s.lng.toFixed(6)}`

/** 구글 지도 앱/웹에서 그날 경로 길찾기 (키·비용 없음). 경유지는 최대 9곳까지 */
export function googleDirectionsUrl(stops: Stop[], mode: TravelMode) {
  if (stops.length === 1) return googlePlaceUrl(stops[0])
  const origin = stops[0]
  const dest = stops[stops.length - 1]
  const mids = stops.slice(1, -1).slice(0, 9)
  const p = new URLSearchParams({ api: '1', origin: ll(origin), destination: ll(dest), travelmode: mode })
  if (mids.length) p.set('waypoints', mids.map(ll).join('|'))
  return `https://www.google.com/maps/dir/?${p}`
}

export function googlePlaceUrl(s: { lat: number; lng: number }) {
  return `https://www.google.com/maps/search/?api=1&query=${ll(s)}`
}

export function sortStops(stops: Stop[]) {
  return [...stops].sort((a, b) => a.day - b.day || a.order - b.order || a.createdAt - b.createdAt)
}
