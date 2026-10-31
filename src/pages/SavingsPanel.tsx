import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db, newId, requestPersist } from '../db'
import { AmountInput } from '../components/AmountInput'
import { Icon } from '../components/Icon'
import { JarMeter } from '../components/JarMeter'
import { Sheet } from '../components/Sheet'
import { formatDate, formatKRW, todayStr } from '../lib/format'
import type { Destination } from '../types'

const QUICK = [10000, 30000, 50000, 100000]

export function SavingsPanel({ d }: { d: Destination }) {
  const entries = useLiveQuery(
    () => db.savings.where('destinationId').equals(d.id).toArray().then((a) => a.sort((x, y) => y.date.localeCompare(x.date) || y.createdAt - x.createdAt)),
    [d.id],
  )
  const [amount, setAmount] = useState<number>()
  const [memo, setMemo] = useState('')
  const [date, setDate] = useState(todayStr())
  const [goalOpen, setGoalOpen] = useState(false)
  const [justAdded, setJustAdded] = useState(false)

  if (!entries) return null
  const saved = entries.reduce((s, e) => s + e.amount, 0)
  const goal = d.budget ?? 0
  const ratio = goal ? saved / goal : 0
  const pct = Math.round(ratio * 100)

  const add = async (sign: 1 | -1) => {
    if (!amount) return
    await db.savings.add({ id: newId(), destinationId: d.id, amount: sign * amount, date, memo: memo.trim() || undefined, createdAt: Date.now() })
    requestPersist()
    setAmount(undefined)
    setMemo('')
    setDate(todayStr())
    if (sign === 1) {
      setJustAdded(true)
      setTimeout(() => setJustAdded(false), 1200)
    }
  }
  const remove = async (id: string, label: string) => {
    if (!confirm(`${label} 기록을 지울까요?`)) return
    await db.savings.delete(id)
  }

  return (
    <div className="savings">
      <div className={`savings-hero${justAdded ? ' pop' : ''}`}>
        <JarMeter ratio={goal ? ratio : saved > 0 ? 0.15 : 0} size={110} />
        <div className="savings-numbers">
          <p className="eyebrow">지금까지 모은 돈</p>
          <p className="big-number">{formatKRW(saved) || '0원'}</p>
          {goal ? (
            <>
              <p className="muted">
                목표 {formatKRW(goal)} · <strong>{pct}%</strong>
              </p>
              <p className="savings-left">{saved >= goal ? '목표 달성! 이제 떠나기만 하면 돼요 ✈' : `${formatKRW(goal - saved)} 남았어요`}</p>
            </>
          ) : (
            <button className="link-btn" onClick={() => setGoalOpen(true)}>
              목표 금액 정하기 →
            </button>
          )}
          {goal ? (
            <button className="link-btn small" onClick={() => setGoalOpen(true)}>
              목표 바꾸기
            </button>
          ) : null}
        </div>
      </div>

      <div className="card save-form">
        <AmountInput value={amount} onChange={setAmount} placeholder="얼마를?" />
        <div className="chips">
          {QUICK.map((q) => (
            <button key={q} type="button" className="chip" onClick={() => setAmount((amount ?? 0) + q)}>
              +{formatKRW(q).replace(' ', '')}
            </button>
          ))}
        </div>
        <div className="row-2">
          <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="메모 (예: 커피 안 마신 돈)" />
          <input type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value || todayStr())} />
        </div>
        <div className="row-2">
          <button className="btn btn-ghost" disabled={!amount} onClick={() => add(-1)}>
            <Icon name="minus" size={18} /> 꺼내 쓰기
          </button>
          <button className="btn btn-primary" disabled={!amount} onClick={() => add(1)}>
            <Icon name="plus" size={18} /> 모으기
          </button>
        </div>
      </div>

      {entries.length > 0 && (
        <section>
          <h3 className="group-title">기록</h3>
          <ul className="ledger">
            {entries.map((e) => (
              <li key={e.id}>
                <span className="ledger-date">{formatDate(e.date)}</span>
                <span className="ledger-memo">{e.memo ?? (e.amount > 0 ? '모으기' : '꺼내 쓰기')}</span>
                <span className={`ledger-amt ${e.amount < 0 ? 'neg' : 'pos'}`}>
                  {e.amount > 0 ? '+' : ''}
                  {formatKRW(e.amount)}
                </span>
                <button className="icon-btn sm" aria-label="기록 지우기" onClick={() => remove(e.id, `${formatDate(e.date)} ${formatKRW(e.amount)}`)}>
                  <Icon name="close" size={16} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {goalOpen && <GoalSheet d={d} onClose={() => setGoalOpen(false)} />}
    </div>
  )
}

function GoalSheet({ d, onClose }: { d: Destination; onClose: () => void }) {
  const [v, setV] = useState(d.budget)
  const save = async () => {
    await db.destinations.update(d.id, { budget: v, updatedAt: Date.now() })
    onClose()
  }
  return (
    <Sheet
      title="저축 목표"
      onClose={onClose}
      footer={
        <button className="btn btn-primary btn-block" onClick={save}>
          저장
        </button>
      }
    >
      <p className="muted">이 여행에 필요한 예산이에요. 여행지 정보의 ‘예산’과 같은 값이에요.</p>
      <AmountInput value={v} onChange={setV} autoFocus placeholder="1,500,000" />
    </Sheet>
  )
}
