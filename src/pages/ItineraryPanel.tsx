import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId } from '../db'
import { Icon } from '../components/Icon'
import { Sheet } from '../components/Sheet'
import { CATEGORY_LABEL } from '../lib/format'
import {
  TRAVEL_LABEL,
  dayColor,
  distanceKm,
  formatKm,
  googleDirectionsUrl,
  googlePlaceUrl,
  searchPlaces,
  sortStops,
  type Place,
  type TravelMode,
} from '../lib/geo'
import type { Destination, Stop, Wish } from '../types'

const MapView = lazy(() => import('../components/MapView'))

const WEEK = ['일', '월', '화', '수', '목', '금', '토']
function dayDate(start: string | undefined, day: number) {
  if (!start || day < 1) return ''
  const [y, m, d] = start.split('-').map(Number)
  const dt = new Date(y, m - 1, d + day - 1)
  return `${dt.getMonth() + 1}월 ${dt.getDate()}일 (${WEEK[dt.getDay()]})`
}
const dayName = (day: number) => (day === 0 ? '미정' : `${day}일차`)

function readMode(): TravelMode {
  try {
    const v = localStorage.getItem('wj-travel-mode')
    if (v === 'walking' || v === 'transit' || v === 'driving') return v
  } catch {
    /* 무시 */
  }
  return 'transit'
}

export function ItineraryPanel({ d }: { d: Destination }) {
  const raw = useLiveQuery(() => db.stops.where('destinationId').equals(d.id).toArray(), [d.id])
  const stops = useMemo(() => sortStops(raw ?? []), [raw])
  const [activeDay, setActiveDay] = useState<number | 'all'>('all')
  const [picking, setPicking] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [focusId, setFocusId] = useState<string>()
  const [editing, setEditing] = useState<Stop | null>(null)
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<{ places: Place[]; q: string; error?: string } | null>(null)
  const [wishPick, setWishPick] = useState(false)
  const [pendingWish, setPendingWish] = useState<Wish | null>(null)
  const [mode, setMode] = useState<TravelMode>(readMode)
  const mapRef = useRef<HTMLDivElement>(null)

  const maxDay = stops.reduce((m, s) => Math.max(m, s.day), 0)
  const days = Math.max(d.planDays ?? 0, d.durationDays ?? 0, maxDay, 1)
  const targetDay = activeDay === 'all' ? 1 : activeDay
  const center = d.lat !== undefined && d.lng !== undefined ? { lat: d.lat, lng: d.lng } : undefined
  const near = stops.length ? { lat: stops[0].lat, lng: stops[0].lng } : center

  // 도시 위치를 한 번 찾아서 저장 (지도 처음 위치용)
  useEffect(() => {
    if (center || !(d.city || d.country) || !navigator.onLine) return
    let gone = false
    searchPlaces([d.city, d.country].filter(Boolean).join(', '))
      .then((r) => {
        if (!gone && r[0]) db.destinations.update(d.id, { lat: r[0].lat, lng: r[0].lng })
      })
      .catch(() => {})
    return () => {
      gone = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.id])

  const nextOrder = (day: number) => stops.filter((s) => s.day === day).reduce((m, s) => Math.max(m, s.order), -1) + 1

  const addStop = async (p: { name: string; address?: string; lat: number; lng: number }, day: number, wish?: Wish | null) => {
    const now = Date.now()
    const stop: Stop = {
      id: newId(),
      destinationId: d.id,
      day,
      order: nextOrder(day),
      name: p.name,
      address: p.address,
      lat: p.lat,
      lng: p.lng,
      wishId: wish?.id,
      memo: wish?.memo,
      createdAt: now,
      updatedAt: now,
    }
    await db.stops.add(stop)
    setActiveDay(day)
    setFocusId(stop.id)
    return stop
  }

  const runSearch = async (q: string) => {
    const t = q.trim()
    if (!t) return
    if (!navigator.onLine) {
      setResults({ places: [], q: t, error: '장소를 찾으려면 인터넷이 필요해요.' })
      return
    }
    setSearching(true)
    try {
      const places = await searchPlaces(t, near)
      setResults({ places, q: t })
    } catch {
      setResults({ places: [], q: t, error: '검색 중에 문제가 생겼어요. 잠시 뒤 다시 시도해 주세요.' })
    } finally {
      setSearching(false)
    }
  }

  // 시트가 닫히며 뒤로가기 기록을 정리한 다음에 지도로 스크롤
  const showMap = () => setTimeout(() => mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 350)

  const startPicking = () => {
    setResults(null)
    setPicking(true)
    showMap()
  }

  const onPick = async (p: { lat: number; lng: number }) => {
    setPicking(false)
    const s = await addStop({ name: pendingWish?.title ?? '새 장소', ...p }, targetDay, pendingWish)
    setPendingWish(null)
    setEditing(s)
  }

  const move = async (s: Stop, dir: -1 | 1) => {
    const list = stops.filter((x) => x.day === s.day)
    const i = list.findIndex((x) => x.id === s.id)
    const j = i + dir
    if (j < 0 || j >= list.length) return
    const reordered = [...list]
    ;[reordered[i], reordered[j]] = [reordered[j], reordered[i]]
    const now = Date.now()
    await db.stops.bulkPut(reordered.map((x, idx) => ({ ...x, order: idx, updatedAt: now })))
  }

  const addDay = async () => {
    await db.destinations.update(d.id, { planDays: days + 1 })
    setActiveDay(days + 1)
  }
  const removeLastDay = async () => {
    await db.destinations.update(d.id, { planDays: days - 1 })
    setActiveDay(days - 1)
  }

  const shownDays = activeDay === 'all' ? [...Array.from({ length: days }, (_, i) => i + 1), 0] : [activeDay]
  const undecidedCount = stops.filter((s) => s.day === 0).length

  const dayChips = (
    <div className="chips chips-scroll day-chips">
      <button className={`chip${activeDay === 'all' ? ' chip-on' : ''}`} onClick={() => setActiveDay('all')}>
        전체
      </button>
      {Array.from({ length: days }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          className={`chip day-chip${activeDay === n ? ' chip-on' : ''}`}
          style={{ ['--c' as string]: dayColor(n) }}
          onClick={() => setActiveDay(n)}
        >
          <span className="dot" />
          {n}일차
        </button>
      ))}
      <button className={`chip day-chip${activeDay === 0 ? ' chip-on' : ''}`} style={{ ['--c' as string]: dayColor(0) }} onClick={() => setActiveDay(0)}>
        <span className="dot" />
        미정{undecidedCount ? ` ${undecidedCount}` : ''}
      </button>
      <button className="chip" onClick={addDay} aria-label="날 추가">
        <Icon name="plus" size={16} /> 날
      </button>
    </div>
  )

  if (!raw) return null

  return (
    <div className={`itinerary${expanded ? ' map-expanded' : ''}`}>
      <div className="map-wrap" ref={mapRef}>
        <Suspense fallback={<div className="map-box map-loading">지도를 불러오는 중…</div>}>
          <MapView
            stops={stops}
            activeDay={activeDay}
            center={center}
            picking={picking}
            expanded={expanded}
            focusId={focusId}
            onPick={onPick}
            onSelect={(id) => {
              setFocusId(id)
              const s = stops.find((x) => x.id === id)
              if (s && !expanded) setEditing(s)
            }}
          />
        </Suspense>
        <button className="icon-btn glass map-expand" onClick={() => setExpanded(!expanded)} aria-label={expanded ? '지도 작게' : '지도 크게'}>
          <Icon name={expanded ? 'close' : 'expand'} size={20} />
        </button>
        {picking && (
          <div className="pick-hint">
            <span>
              {pendingWish ? `‘${pendingWish.title}’ 위치를` : '추가할 위치를'} 지도에서 눌러 주세요 · {dayName(targetDay)}
            </span>
            <button
              onClick={() => {
                setPicking(false)
                setPendingWish(null)
              }}
            >
              취소
            </button>
          </div>
        )}
        {expanded && <div className="map-float-days">{dayChips}</div>}
      </div>

      {dayChips}

      <form
        className="itin-search"
        onSubmit={(e) => {
          e.preventDefault()
          setPendingWish(null)
          runSearch(query)
        }}
      >
        <Icon name="search" size={18} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="장소 이름으로 찾기 (예: 벨렝 탑)" enterKeyHint="search" />
        <button type="submit" disabled={!query.trim() || searching}>
          {searching ? '찾는 중' : '찾기'}
        </button>
      </form>
      <div className="itin-actions">
        <button className="btn btn-ghost" onClick={() => setWishPick(true)}>
          <Icon name="star" size={16} /> 하고 싶은 일에서
        </button>
        <button className={`btn btn-ghost${picking ? ' on' : ''}`} onClick={startPicking}>
          <Icon name="pin" size={16} /> 지도에서 찍기
        </button>
      </div>

      {stops.length === 0 ? (
        <div className="empty-inline">
          <p className="display-sm">지도 위에 하루를 그려 보세요</p>
          <p className="muted">
            가고 싶은 곳을 찾아 날짜별로 담으면 방문 순서대로 선이 이어져요. ‘하고 싶은 일’에 적어 둔 곳을 불러올 수도 있어요.
          </p>
        </div>
      ) : (
        shownDays.map((day) => {
          const list = stops.filter((s) => s.day === day)
          // '전체' 보기에서는 빈 날은 숨김
          if (activeDay === 'all' && !list.length) return null
          const total = list.slice(1).reduce((sum, s, i) => sum + distanceKm(list[i], s), 0)
          const single = activeDay !== 'all'
          return (
            <section key={day} className="itin-day">
              <header className="itin-day-head" style={{ ['--c' as string]: dayColor(day) }}>
                <div>
                  <h3>
                    <span className="dot" />
                    {dayName(day)}
                    {dayDate(d.tripStart, day) && <small>{dayDate(d.tripStart, day)}</small>}
                  </h3>
                  {list.length > 1 && day > 0 && (
                    <p className="muted small">
                      {list.length}곳 · 직선거리 약 {formatKm(total)}
                    </p>
                  )}
                  {day === 0 && <p className="muted small">가고 싶지만 날짜는 아직 안 정한 곳</p>}
                </div>
                {day > 0 && list.length > 0 && (
                  <a className="btn btn-ghost btn-sm" href={googleDirectionsUrl(list, mode)} target="_blank" rel="noreferrer noopener">
                    <Icon name="route" size={16} /> 구글 지도 길찾기
                  </a>
                )}
              </header>
              {single && day > 0 && list.length > 1 && (
                <div className="seg seg-sm travel-mode">
                  {(Object.keys(TRAVEL_LABEL) as TravelMode[]).map((m) => (
                    <button
                      key={m}
                      className={mode === m ? 'on' : ''}
                      onClick={() => {
                        setMode(m)
                        try {
                          localStorage.setItem('wj-travel-mode', m)
                        } catch {
                          /* 무시 */
                        }
                      }}
                    >
                      {TRAVEL_LABEL[m]}
                    </button>
                  ))}
                </div>
              )}
              {list.length === 0 ? (
                <p className="muted small itin-empty">
                  아직 담은 곳이 없어요. 위에서 찾거나 지도에서 찍어 보세요.
                  {single && day === days && day > (d.durationDays ?? 1) && (
                    <button className="link-btn small" onClick={removeLastDay}>
                      이 날 지우기
                    </button>
                  )}
                </p>
              ) : (
                <ol className="stop-list">
                  {list.map((s, i) => (
                    <li key={s.id}>
                      <div className={`stop${focusId === s.id ? ' focus' : ''}`}>
                        <button
                          className="stop-num"
                          style={{ ['--c' as string]: dayColor(day) }}
                          onClick={() => {
                            setFocusId(s.id)
                            mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                          }}
                          aria-label="지도에서 보기"
                        >
                          {day === 0 ? '·' : i + 1}
                        </button>
                        <button className="stop-body" onClick={() => setEditing(s)}>
                          <span className="stop-name">
                            {s.time && <span className="stop-time">{s.time}</span>}
                            {s.name}
                          </span>
                          {s.memo && <span className="stop-memo">{s.memo}</span>}
                        </button>
                        {single && list.length > 1 && (
                          <span className="stop-move">
                            <button className="icon-btn sm" disabled={i === 0} onClick={() => move(s, -1)} aria-label="앞으로">
                              <Icon name="up" size={16} />
                            </button>
                            <button className="icon-btn sm" disabled={i === list.length - 1} onClick={() => move(s, 1)} aria-label="뒤로">
                              <Icon name="down" size={16} />
                            </button>
                          </span>
                        )}
                      </div>
                      {day > 0 && i < list.length - 1 && <p className="leg">{formatKm(distanceKm(s, list[i + 1]))}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )
        })
      )}

      {results && (
        <SearchSheet
          results={results}
          days={days}
          defaultDay={targetDay}
          wish={pendingWish}
          onClose={() => {
            setResults(null)
            setPendingWish(null)
          }}
          onPickOnMap={startPicking}
          onChoose={async (p, day) => {
            await addStop(p, day, pendingWish)
            setResults(null)
            setPendingWish(null)
            setQuery('')
            showMap()
          }}
        />
      )}
      {wishPick && (
        <WishPickSheet
          destinationId={d.id}
          stops={stops}
          onClose={() => setWishPick(false)}
          onPick={(w) => {
            setWishPick(false)
            setPendingWish(w)
            runSearch(w.title)
          }}
        />
      )}
      {editing && <StopSheet stop={editing} days={days} nextOrder={nextOrder} onClose={() => setEditing(null)} />}
    </div>
  )
}

function DayPicker({ days, value, onChange }: { days: number; value: number; onChange: (d: number) => void }) {
  return (
    <div className="chips">
      {[...Array.from({ length: days }, (_, i) => i + 1), 0].map((n) => (
        <button
          key={n}
          type="button"
          className={`chip day-chip${value === n ? ' chip-on' : ''}`}
          style={{ ['--c' as string]: dayColor(n) }}
          onClick={() => onChange(n)}
        >
          <span className="dot" />
          {dayName(n)}
        </button>
      ))}
    </div>
  )
}

function SearchSheet({
  results,
  days,
  defaultDay,
  wish,
  onClose,
  onChoose,
  onPickOnMap,
}: {
  results: { places: Place[]; q: string; error?: string }
  days: number
  defaultDay: number
  wish: Wish | null
  onClose: () => void
  onChoose: (p: Place, day: number) => void
  onPickOnMap: () => void
}) {
  const [day, setDay] = useState(defaultDay)
  return (
    <Sheet title={wish ? `‘${wish.title}’ 어디예요?` : `‘${results.q}’ 검색 결과`} onClose={onClose}>
      <section className="field">
        <span className="label">어느 날에 담을까요?</span>
        <DayPicker days={days} value={day} onChange={setDay} />
      </section>
      {results.error ? (
        <p className="form-error">{results.error}</p>
      ) : results.places.length === 0 ? (
        <p className="muted">찾는 장소가 없어요. 다른 이름(영어·현지어)으로 찾거나 지도에서 직접 찍어 보세요.</p>
      ) : (
        <ul className="place-list">
          {results.places.map((p, i) => (
            <li key={i}>
              <button onClick={() => onChoose(p, day)}>
                <Icon name="pin" size={18} />
                <span>
                  <strong>{p.name}</strong>
                  {p.address && <small>{p.address}</small>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button className="btn btn-ghost btn-block" onClick={onPickOnMap}>
        <Icon name="pin" size={16} /> 지도에서 직접 찍기
      </button>
      <p className="muted small credit">장소 검색 © OpenStreetMap 기여자</p>
    </Sheet>
  )
}

function WishPickSheet({ destinationId, stops, onClose, onPick }: { destinationId: string; stops: Stop[]; onClose: () => void; onPick: (w: Wish) => void }) {
  const wishes = useLiveQuery(() => db.wishes.where('destinationId').equals(destinationId).toArray(), [destinationId])
  const scheduled = new Set(stops.map((s) => s.wishId).filter(Boolean))
  const list = (wishes ?? [])
    .filter((w) => !w.done)
    .sort((a, b) => Number(scheduled.has(a.id)) - Number(scheduled.has(b.id)) || (a.priority === 'must' ? -1 : 1))
  return (
    <Sheet title="하고 싶은 일에서 불러오기" onClose={onClose}>
      {list.length === 0 ? (
        <p className="muted">불러올 항목이 없어요. ‘하고 싶은 일’ 탭에서 먼저 적어 주세요.</p>
      ) : (
        <ul className="place-list">
          {list.map((w) => (
            <li key={w.id}>
              <button onClick={() => onPick(w)}>
                <span className="mini-tag">{CATEGORY_LABEL[w.category]}</span>
                <span>
                  <strong>
                    {w.priority === 'must' && '★ '}
                    {w.title}
                  </strong>
                  {scheduled.has(w.id) && <small>이미 일정에 있어요</small>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  )
}

function StopSheet({ stop, days, nextOrder, onClose }: { stop: Stop; days: number; nextOrder: (day: number) => number; onClose: () => void }) {
  const [s, setS] = useState(stop)
  const save = async () => {
    const dayChanged = s.day !== stop.day
    await db.stops.put({
      ...s,
      name: s.name.trim() || stop.name,
      memo: s.memo?.trim() || undefined,
      time: s.time || undefined,
      order: dayChanged ? nextOrder(s.day) : s.order,
      updatedAt: Date.now(),
    })
    onClose()
  }
  const remove = async () => {
    if (!confirm(`‘${stop.name}’을(를) 일정에서 뺄까요?`)) return
    await db.stops.delete(stop.id)
    onClose()
  }
  return (
    <Sheet
      title="일정 장소"
      onClose={onClose}
      footer={
        <button className="btn btn-primary btn-block" onClick={save}>
          저장
        </button>
      }
    >
      <label className="field">
        <span className="label">이름</span>
        <input value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} autoFocus={stop.name === '새 장소'} />
      </label>
      {s.address && <p className="muted small">{s.address}</p>}
      <section className="field">
        <span className="label">날</span>
        <DayPicker days={days} value={s.day} onChange={(day) => setS({ ...s, day })} />
      </section>
      <section className="field row-2">
        <label>
          <span className="label">시간 (선택)</span>
          <input type="time" value={s.time ?? ''} onChange={(e) => setS({ ...s, time: e.target.value })} />
        </label>
        <div>
          <span className="label">&nbsp;</span>
          <a className="btn btn-ghost btn-block" href={googlePlaceUrl(s)} target="_blank" rel="noreferrer noopener">
            <Icon name="pin" size={16} /> 구글 지도
          </a>
        </div>
      </section>
      <label className="field">
        <span className="label">메모</span>
        <textarea rows={2} value={s.memo ?? ''} onChange={(e) => setS({ ...s, memo: e.target.value })} placeholder="예약 번호, 입장료, 가는 법…" />
      </label>
      <button type="button" className="btn btn-danger-text btn-block" onClick={remove}>
        <Icon name="trash" size={18} /> 일정에서 빼기
      </button>
    </Sheet>
  )
}
