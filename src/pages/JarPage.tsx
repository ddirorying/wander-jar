import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { db, getMeta } from '../db'
import { DestinationCard } from '../components/DestinationCard'
import { Icon } from '../components/Icon'
import { useSavingsTotals } from '../lib/hooks'
import { STATUS_LABEL, STATUS_ORDER, daysSince } from '../lib/format'
import type { Status } from '../types'

function readPref<T extends string>(key: string, fallback: T): T {
  try {
    return (localStorage.getItem(key) as T) || fallback
  } catch {
    return fallback
  }
}
function writePref(key: string, v: string) {
  try {
    localStorage.setItem(key, v)
  } catch {
    /* 무시 */
  }
}

export function JarPage({ onAdd }: { onAdd: () => void }) {
  const all = useLiveQuery(() => db.destinations.orderBy('createdAt').reverse().toArray(), [])
  const totals = useSavingsTotals()
  const lastBackupAt = useLiveQuery(() => getMeta<number>('lastBackupAt'), [])
  const [status, setStatus] = useState<Status | 'all'>('all')
  const [tag, setTag] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [view, setView] = useState<'rows' | 'grid'>(() => readPref('wj-view', 'rows'))

  const tags = useMemo(() => [...new Set((all ?? []).flatMap((d) => d.tags))], [all])
  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (all ?? []).filter(
      (d) =>
        (status === 'all' || d.status === status) &&
        (!tag || d.tags.includes(tag)) &&
        (!q || [d.city, d.country, d.tagline, ...d.tags].join(' ').toLowerCase().includes(q)),
    )
  }, [all, status, tag, query])

  if (!all) return <div className="page" />

  const backupAge = daysSince(lastBackupAt)
  const needBackup = all.length > 0 && (backupAge === undefined || backupAge >= 14)

  return (
    <div className="page jar-page">
      <header className="masthead">
        <div>
          <p className="eyebrow">Wander Jar</p>
          <h1 className="display">보관함</h1>
        </div>
        {all.length > 0 && (
          <div className="masthead-actions">
            <button className="icon-btn" aria-label="검색" onClick={() => setSearching((s) => !s)}>
              <Icon name="search" />
            </button>
            <button
              className="icon-btn"
              aria-label={view === 'rows' ? '두 줄로 보기' : '크게 보기'}
              onClick={() => {
                const v = view === 'rows' ? 'grid' : 'rows'
                setView(v)
                writePref('wj-view', v)
              }}
            >
              <Icon name={view === 'rows' ? 'grid' : 'rows'} />
            </button>
          </div>
        )}
      </header>

      {all.length === 0 ? (
        <div className="empty">
          <div className="empty-postcard">
            <span className="stamp stamp-dreaming">첫 번째 엽서</span>
            <p className="display-sm">가고 싶은 곳이 생기면
              <br />
              여기에 담아 두세요
            </p>
          </div>
          <button className="btn btn-primary" onClick={onAdd}>
            <Icon name="plus" size={18} /> 여행지 담기
          </button>
        </div>
      ) : (
        <>
          {searching && (
            <input
              className="search"
              autoFocus
              placeholder="도시, 나라, 태그로 찾기"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          )}
          <div className="chips chips-scroll" role="tablist">
            <button className={`chip${status === 'all' ? ' chip-on' : ''}`} onClick={() => setStatus('all')}>
              전체 {all.length}
            </button>
            {STATUS_ORDER.map((s) => {
              const n = all.filter((d) => d.status === s).length
              if (!n) return null
              return (
                <button key={s} className={`chip${status === s ? ' chip-on' : ''}`} onClick={() => setStatus(s)}>
                  {STATUS_LABEL[s]} {n}
                </button>
              )
            })}
          </div>
          {tags.length > 0 && (
            <div className="chips chips-scroll chips-tags">
              {tags.map((t) => (
                <button key={t} className={`tag${tag === t ? ' tag-on' : ''}`} onClick={() => setTag(tag === t ? null : t)}>
                  #{t}
                </button>
              ))}
            </div>
          )}

          {needBackup && (
            <Link to="/settings" className="notice">
              <Icon name="download" size={18} />
              <span>{backupAge === undefined ? '아직 백업한 적이 없어요' : `마지막 백업이 ${backupAge}일 전이에요`} · 백업하기</span>
            </Link>
          )}

          <div className={`card-list ${view === 'grid' ? 'card-grid' : ''}`}>
            {list.map((d) => (
              <DestinationCard key={d.id} d={d} saved={totals?.get(d.id) ?? 0} compact={view === 'grid'} />
            ))}
          </div>
          {list.length === 0 && <p className="muted center">조건에 맞는 여행지가 없어요</p>}
        </>
      )}
    </div>
  )
}
