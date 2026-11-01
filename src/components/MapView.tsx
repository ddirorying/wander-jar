import { useEffect, useRef, useState } from 'react'
import maplibregl, { type GeoJSONSource, type StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Stop } from '../types'
import { dayColor } from '../lib/geo'

/**
 * 무료 지도: OpenFreeMap(오픈스트리트맵 데이터) — 가입·키·비용 없음.
 * 인터넷이 안 되면 바탕 지도 없이 핀과 선만이라도 보여줍니다.
 */
const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron'

const FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#ebe5da' } }],
}

let stylePromise: Promise<StyleSpecification> | null = null
function loadStyle(): Promise<StyleSpecification> {
  stylePromise ??= (async () => {
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 15000)
      const res = await fetch(STYLE_URL, { signal: ctrl.signal })
      clearTimeout(t)
      if (!res.ok) throw new Error()
      const style = (await res.json()) as StyleSpecification
      // 지명은 한국어 이름이 있으면 한국어로
      for (const l of style.layers) {
        if (l.type === 'symbol' && l.layout && 'text-field' in l.layout && JSON.stringify(l.layout['text-field']).includes('name')) {
          ;(l.layout as Record<string, unknown>)['text-field'] = ['coalesce', ['get', 'name:ko'], ['get', 'name']]
        }
      }
      return style
    } catch {
      stylePromise = null // 다음에 다시 시도
      return FALLBACK_STYLE
    }
  })()
  return stylePromise
}

export interface MapViewProps {
  stops: Stop[]
  activeDay: number | 'all'
  center?: { lat: number; lng: number }
  picking: boolean
  expanded: boolean
  focusId?: string
  onPick: (p: { lat: number; lng: number }) => void
  onSelect: (id: string) => void
}

export default function MapView({ stops, activeDay, center, picking, expanded, focusId, onPick, onSelect }: MapViewProps) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const markers = useRef<maplibregl.Marker[]>([])
  const [ready, setReady] = useState(false)
  const [offline, setOffline] = useState(false)
  const [failure, setFailure] = useState('')
  const [styleRev, setStyleRev] = useState(0)
  const [retrying, setRetrying] = useState(false)

  // 바탕 지도 다시 불러오기 (인터넷이 돌아왔을 때 자동으로도)
  const retry = async () => {
    const m = map.current
    if (!m || retrying) return
    setRetrying(true)
    const style = await loadStyle()
    setRetrying(false)
    if (style !== FALLBACK_STYLE) {
      setOffline(false)
      m.setStyle(style)
    }
  }
  const retryRef = useRef(retry)
  retryRef.current = retry
  useEffect(() => {
    const on = () => offline && retryRef.current()
    window.addEventListener('online', on)
    return () => window.removeEventListener('online', on)
  }, [offline])
  const cb = useRef({ onPick, onSelect, picking })
  cb.current = { onPick, onSelect, picking }

  // 지도 만들기 (한 번)
  useEffect(() => {
    let cancelled = false
    loadStyle().then((style) => {
      if (cancelled || !el.current) return
      setOffline(style === FALLBACK_STYLE)
      const m = new maplibregl.Map({
        container: el.current,
        style,
        center: center ? [center.lng, center.lat] : [10, 30],
        zoom: center ? 11 : 1.2,
        attributionControl: { compact: true },
        cooperativeGestures: true,
        locale: {
          'CooperativeGesturesHandler.WindowsHelpText': 'Ctrl 키를 누른 채 스크롤하면 확대/축소돼요',
          'CooperativeGesturesHandler.MacHelpText': '⌘ 키를 누른 채 스크롤하면 확대/축소돼요',
          'CooperativeGesturesHandler.MobileHelpText': '두 손가락으로 지도를 움직여 보세요',
        },
      })
      m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
      m.on('error', (e) => {
        const msg = String((e as { error?: Error }).error?.message ?? '')
        if (/webgl/i.test(msg)) setFailure('이 기기 브라우저에서 지도를 그릴 수 없어요 (WebGL).')
      })
      m.on('style.load', () => {
        if (m.getSource('routes')) return
        m.addSource('routes', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
        m.addLayer({
          id: 'routes-casing',
          type: 'line',
          source: 'routes',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#ffffff', 'line-width': 7, 'line-opacity': ['case', ['get', 'active'], 0.9, 0] },
        })
        m.addLayer({
          id: 'routes',
          type: 'line',
          source: 'routes',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': ['get', 'color'],
            'line-width': ['case', ['get', 'active'], 4, 2.5],
            'line-opacity': ['case', ['get', 'active'], 0.95, 0.3],
          },
        })
        setReady(true)
        setStyleRev((r) => r + 1)
      })
      m.on('click', (e) => {
        if (cb.current.picking) cb.current.onPick({ lat: e.lngLat.lat, lng: e.lngLat.lng })
      })
      map.current = m
    })
    return () => {
      cancelled = true
      map.current?.remove()
      map.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 선과 핀 다시 그리기
  useEffect(() => {
    const m = map.current
    if (!m || !ready) return
    const byDay = new Map<number, Stop[]>()
    for (const s of stops) if (s.day > 0) byDay.set(s.day, [...(byDay.get(s.day) ?? []), s])
    const features = [...byDay.entries()]
      .filter(([, list]) => list.length > 1)
      .map(([day, list]) => ({
        type: 'Feature' as const,
        properties: { color: dayColor(day), active: activeDay === 'all' || activeDay === day },
        geometry: { type: 'LineString' as const, coordinates: list.map((s) => [s.lng, s.lat]) },
      }))
    ;(m.getSource('routes') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features })

    markers.current.forEach((mk) => mk.remove())
    markers.current = []
    const counters = new Map<number, number>()
    for (const s of stops) {
      const n = (counters.get(s.day) ?? 0) + 1
      counters.set(s.day, n)
      const active = activeDay === 'all' || activeDay === s.day
      const div = document.createElement('button')
      div.type = 'button'
      div.className = `map-pin${active ? '' : ' dim'}${s.day === 0 ? ' undecided' : ''}${focusId === s.id ? ' focus' : ''}`
      div.style.setProperty('--c', dayColor(s.day))
      const shape = document.createElement('span')
      shape.className = 'map-pin-shape'
      const label = document.createElement('span')
      label.className = 'map-pin-label'
      label.textContent = s.day === 0 ? '?' : String(n)
      shape.appendChild(label)
      div.appendChild(shape)
      div.setAttribute('aria-label', s.name)
      div.title = s.name
      div.addEventListener('click', (ev) => {
        ev.stopPropagation()
        cb.current.onSelect(s.id)
      })
      const mk = new maplibregl.Marker({ element: div, anchor: 'bottom' }).setLngLat([s.lng, s.lat]).addTo(m)
      markers.current.push(mk)
    }
  }, [stops, activeDay, ready, focusId, styleRev])

  // 보여줄 범위 맞추기
  const fit = () => {
    const m = map.current
    if (!m) return
    const visible = stops.filter((s) => activeDay === 'all' || s.day === activeDay)
    if (visible.length >= 2) {
      const b = new maplibregl.LngLatBounds()
      visible.forEach((s) => b.extend([s.lng, s.lat]))
      m.fitBounds(b, { padding: { top: 60, bottom: expanded ? 90 : 40, left: 50, right: 60 }, maxZoom: 15, duration: 600 })
    } else if (visible.length === 1) {
      m.easeTo({ center: [visible[0].lng, visible[0].lat], zoom: Math.max(m.getZoom(), 14), duration: 600 })
    } else if (center) {
      m.easeTo({ center: [center.lng, center.lat], zoom: 11, duration: 600 })
    }
  }
  const fitRef = useRef(fit)
  fitRef.current = fit
  const fitKey = `${activeDay}|${stops.filter((s) => activeDay === 'all' || s.day === activeDay).map((s) => s.id).join(',')}|${center?.lat ?? ''}`
  useEffect(() => {
    if (ready) fitRef.current()
  }, [fitKey, ready])

  // 특정 장소로 이동
  useEffect(() => {
    const s = stops.find((x) => x.id === focusId)
    if (s && map.current && ready) map.current.easeTo({ center: [s.lng, s.lat], zoom: Math.max(map.current.getZoom(), 14), duration: 500 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, ready])

  // 크게 보기 전환 시 크기 다시 계산 + 한 손가락 이동 허용
  useEffect(() => {
    const m = map.current
    if (!m) return
    if (expanded) m.cooperativeGestures.disable()
    else m.cooperativeGestures.enable()
    const t = setTimeout(() => {
      m.resize()
      fitRef.current()
    }, 260)
    return () => clearTimeout(t)
  }, [expanded, ready])

  useEffect(() => {
    map.current?.getCanvas().style.setProperty('cursor', picking ? 'crosshair' : '')
  }, [picking, ready])

  return (
    <div className="map-box">
      <div ref={el} className="map-canvas" />
      {failure ? (
        <p className="map-offline">{failure}</p>
      ) : (
        offline && (
          <div className="map-offline">
            <span>바탕 지도를 불러오지 못했어요</span>
            <button onClick={retry} disabled={retrying}>
              {retrying ? '불러오는 중…' : '다시 시도'}
            </button>
          </div>
        )
      )}
    </div>
  )
}
