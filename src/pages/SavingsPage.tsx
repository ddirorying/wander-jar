import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../db'
import { Cover } from '../components/Cover'
import { JarMeter, ProgressLine } from '../components/JarMeter'
import { formatDate, formatKRW, todayStr } from '../lib/format'

export function SavingsPage() {
  const data = useLiveQuery(async () => {
    const [ds, ss] = await Promise.all([db.destinations.toArray(), db.savings.toArray()])
    return { ds, ss }
  }, [])
  if (!data) return <div className="page" />
  const { ds, ss } = data
  const byId = new Map(ds.map((d) => [d.id, d]))
  const savedOf = (id: string) => ss.filter((s) => s.destinationId === id).reduce((a, s) => a + s.amount, 0)

  const active = ds
    .filter((d) => d.status !== 'visited')
    .map((d) => ({ d, saved: savedOf(d.id) }))
    .filter((x) => x.d.budget || x.saved)
    .sort((a, b) => (b.d.budget ? b.saved / b.d.budget : 0) - (a.d.budget ? a.saved / a.d.budget : 0))
  const totalSaved = active.reduce((a, x) => a + x.saved, 0)
  const totalGoal = active.reduce((a, x) => a + (x.d.budget ?? 0), 0)
  const visitedSpent = ds.filter((d) => d.status === 'visited').reduce((a, d) => a + savedOf(d.id), 0)
  const recent = [...ss].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt).slice(0, 8)

  // 이번 달 모은 돈
  const ym = todayStr().slice(0, 7)
  const thisMonth = ss.filter((s) => s.date.startsWith(ym) && s.amount > 0).reduce((a, s) => a + s.amount, 0)

  return (
    <div className="page">
      <header className="masthead">
        <div>
          <p className="eyebrow">Travel Fund</p>
          <h1 className="display">여행 저축</h1>
        </div>
      </header>

      <div className="fund-hero">
        <JarMeter ratio={totalGoal ? totalSaved / totalGoal : totalSaved > 0 ? 0.15 : 0} size={96} />
        <div>
          <p className="eyebrow">떠날 여행을 위해 모은 돈</p>
          <p className="big-number">{formatKRW(totalSaved) || '0원'}</p>
          {totalGoal > 0 && (
            <p className="muted">
              전체 목표 {formatKRW(totalGoal)} · {Math.round((totalSaved / totalGoal) * 100)}%
            </p>
          )}
          {thisMonth > 0 && <p className="savings-left">이번 달 +{formatKRW(thisMonth)}</p>}
        </div>
      </div>

      {active.length === 0 ? (
        <div className="empty-inline">
          <p className="display-sm">아직 모으는 여행이 없어요</p>
          <p className="muted">여행지 상세 화면의 ‘저축’ 탭에서 목표를 정하고 모은 돈을 기록해 보세요.</p>
        </div>
      ) : (
        <ul className="fund-list">
          {active.map(({ d, saved }) => (
            <li key={d.id}>
              <Link to={`/d/${d.id}?tab=savings`} className="fund-row">
                <Cover d={d} variant="thumb" className="fund-thumb" />
                <div className="fund-info">
                  <div className="fund-line">
                    <strong>{d.city || d.country}</strong>
                    <span>{d.budget ? `${Math.round((saved / d.budget) * 100)}%` : ''}</span>
                  </div>
                  <ProgressLine ratio={d.budget ? saved / d.budget : 0} />
                  <p className="muted small">
                    {formatKRW(saved) || '0원'}
                    {d.budget ? ` / ${formatKRW(d.budget)}` : ' · 목표 없음'}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {recent.length > 0 && (
        <section>
          <h3 className="group-title">최근 기록</h3>
          <ul className="ledger">
            {recent.map((e) => (
              <li key={e.id}>
                <span className="ledger-date">{formatDate(e.date)}</span>
                <span className="ledger-memo">
                  {byId.get(e.destinationId)?.city ?? ''}
                  {e.memo ? ` · ${e.memo}` : ''}
                </span>
                <span className={`ledger-amt ${e.amount < 0 ? 'neg' : 'pos'}`}>
                  {e.amount > 0 ? '+' : ''}
                  {formatKRW(e.amount)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {visitedSpent > 0 && <p className="muted center small">다녀온 여행에 모았던 돈 {formatKRW(visitedSpent)}</p>}
    </div>
  )
}
