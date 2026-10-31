import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { db } from '../db'
import { Cover } from '../components/Cover'
import { Icon } from '../components/Icon'
import { StatusStamp } from '../components/StatusStamp'
import { EditDestinationSheet } from './EditDestinationSheet'
import { WishList } from './WishList'
import { SavingsPanel } from './SavingsPanel'
import { formatDate, formatKRW, formatMonths } from '../lib/format'

export function DestinationPage() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'savings' ? 'savings' : 'wishes'
  const d = useLiveQuery(() => db.destinations.get(id).then((x) => x ?? null), [id])
  const [editing, setEditing] = useState(false)

  // "오랫동안 안 본 여행지"를 위해 열어본 시간 기록 (3단계에서 사용)
  useEffect(() => {
    if (!id) return
    db.destinations
      .where('id')
      .equals(id)
      .modify((x) => {
        x.lastViewedAt = Date.now()
        x.viewCount = (x.viewCount ?? 0) + 1
      })
  }, [id])

  if (d === undefined) return <div className="page" />
  if (d === null) return <Navigate to="/" replace />

  const goBack = () => (window.history.state?.idx > 0 ? nav(-1) : nav('/', { replace: true }))
  const when = formatMonths(d.months)
  const info = [
    when && { icon: 'calendar' as const, label: '시기', value: when },
    d.durationDays && { icon: 'clock' as const, label: '기간', value: `${d.durationDays}일` },
    d.budget && { icon: 'wallet' as const, label: '예산', value: formatKRW(d.budget) },
    d.companions.length > 0 && { icon: 'users' as const, label: '함께', value: d.companions.join(', ') },
  ].filter(Boolean) as { icon: 'calendar' | 'clock' | 'wallet' | 'users'; label: string; value: string }[]

  return (
    <div className="detail">
      <div className="hero">
        <Cover d={d} className="hero-cover" />
        <div className="hero-shade" />
        <div className="hero-bar">
          <button className="icon-btn glass" onClick={goBack} aria-label="뒤로">
            <Icon name="back" />
          </button>
          <button className="icon-btn glass" onClick={() => setEditing(true)} aria-label="고치기">
            <Icon name="edit" size={20} />
          </button>
        </div>
        <div className="hero-text">
          <StatusStamp status={d.status} />
          {d.country && <p className="hero-country">{d.country}</p>}
          <h1 className="hero-city">{d.city || d.country}</h1>
          {d.tagline && <p className="hero-tagline">{d.tagline}</p>}
        </div>
        {d.coverUrl && !d.coverImageId && d.coverCredit?.name && (
          <p className="hero-credit">
            Photo · {d.coverCredit.name}
            {d.coverCredit.source ? ` / ${d.coverCredit.source}` : ''}
          </p>
        )}
      </div>

      <div className="detail-body">
        {(d.tripStart || info.length > 0 || d.tags.length > 0) && (
          <div className="info">
            {d.tripStart && (
              <p className="trip-dates">
                <Icon name="calendar" size={16} /> {formatDate(d.tripStart)}
                {d.tripEnd ? ` – ${formatDate(d.tripEnd)}` : ''}
              </p>
            )}
            {info.length > 0 && (
              <dl className="info-grid">
                {info.map((x) => (
                  <div key={x.label}>
                    <dt>
                      <Icon name={x.icon} size={14} /> {x.label}
                    </dt>
                    <dd>{x.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {d.tags.length > 0 && (
              <div className="chips">
                {d.tags.map((t) => (
                  <span key={t} className="tag">
                    #{t}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'wishes'} className={tab === 'wishes' ? 'on' : ''} onClick={() => setParams({}, { replace: true })}>
            하고 싶은 일
          </button>
          <button
            role="tab"
            aria-selected={tab === 'savings'}
            className={tab === 'savings' ? 'on' : ''}
            onClick={() => setParams({ tab: 'savings' }, { replace: true })}
          >
            저축
          </button>
        </div>

        {tab === 'wishes' ? <WishList d={d} /> : <SavingsPanel d={d} />}
      </div>

      {editing && (
        <EditDestinationSheet
          existing={d}
          onClose={() => setEditing(false)}
          onSaved={() => setEditing(false)}
          onDeleted={() => nav('/', { replace: true })}
        />
      )}
    </div>
  )
}
