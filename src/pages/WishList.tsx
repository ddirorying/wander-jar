import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { db, newId } from '../db'
import { Icon } from '../components/Icon'
import { Sheet } from '../components/Sheet'
import { CATEGORY_LABEL, CATEGORY_ORDER, hostOf, normalizeUrl } from '../lib/format'
import type { Destination, Wish, WishCategory } from '../types'

export function WishList({ d }: { d: Destination }) {
  const wishes = useLiveQuery(() => db.wishes.where('destinationId').equals(d.id).toArray(), [d.id])
  const [filter, setFilter] = useState<WishCategory | 'all'>('all')
  const [editing, setEditing] = useState<Wish | null>(null)
  const [reviewing, setReviewing] = useState<Wish | null>(null)

  const sorted = useMemo(
    () =>
      [...(wishes ?? [])].sort(
        (a, b) =>
          Number(a.done) - Number(b.done) ||
          (a.priority === 'must' ? 0 : 1) - (b.priority === 'must' ? 0 : 1) ||
          a.order - b.order,
      ),
    [wishes],
  )
  if (!wishes) return null

  const must = wishes.filter((w) => w.priority === 'must')
  const groups = (filter === 'all' ? CATEGORY_ORDER : [filter])
    .map((c) => ({ c, items: sorted.filter((w) => w.category === c) }))
    .filter((g) => g.items.length)

  const toggle = async (w: Wish) => {
    const done = !w.done
    await db.wishes.update(w.id, { done, doneAt: done ? Date.now() : undefined, updatedAt: Date.now() })
    if (done && d.status === 'visited' && !w.review) setReviewing({ ...w, done })
  }

  return (
    <div className="wishes">
      {wishes.length > 0 ? (
        <>
          <div className="wish-summary">
            {must.length > 0 && (
              <span>
                <Icon name="star" size={14} filled /> 꼭 {must.filter((w) => w.done).length}/{must.length}
              </span>
            )}
            <span>
              전체 {wishes.filter((w) => w.done).length}/{wishes.length}
            </span>
          </div>
          <div className="chips chips-scroll">
            <button className={`chip${filter === 'all' ? ' chip-on' : ''}`} onClick={() => setFilter('all')}>
              전체
            </button>
            {CATEGORY_ORDER.map((c) => {
              const n = wishes.filter((w) => w.category === c).length
              if (!n) return null
              return (
                <button key={c} className={`chip${filter === c ? ' chip-on' : ''}`} onClick={() => setFilter(c)}>
                  {CATEGORY_LABEL[c]} {n}
                </button>
              )
            })}
          </div>
          {groups.map(({ c, items }) => (
            <section key={c} className="wish-group">
              <h3 className="group-title">{CATEGORY_LABEL[c]}</h3>
              <ul>
                {items.map((w) => (
                  <li key={w.id} className={`wish${w.done ? ' done' : ''}`}>
                    <button className="check" onClick={() => toggle(w)} aria-label={w.done ? '체크 해제' : '체크'} aria-pressed={w.done}>
                      {w.done && <Icon name="check" size={16} />}
                    </button>
                    <button className="wish-body" onClick={() => setEditing(w)}>
                      <span className="wish-title">
                        {w.priority === 'must' && <Icon name="star" size={13} filled className="must" />}
                        {w.title}
                      </span>
                      {w.review ? (
                        <span className="wish-review">“{w.review}”</span>
                      ) : w.memo ? (
                        <span className="wish-memo">{w.memo}</span>
                      ) : null}
                      {w.links.length > 0 && (
                        <span className="wish-links">
                          <Icon name="link" size={12} /> {hostOf(w.links[0])}
                          {w.links.length > 1 ? ` 외 ${w.links.length - 1}` : ''}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      ) : (
        <div className="empty-inline">
          <p className="display-sm">거기서 뭘 하고 싶어요?</p>
          <p className="muted">먹고 싶은 것, 보고 싶은 것, 해보고 싶은 것을 아래에 적어 보세요.</p>
        </div>
      )}

      <Composer destinationId={d.id} nextOrder={wishes.length} defaultCategory={filter === 'all' ? 'eat' : filter} />

      {editing && <WishSheet wish={editing} onClose={() => setEditing(null)} />}
      {reviewing && <ReviewSheet wish={reviewing} onClose={() => setReviewing(null)} />}
    </div>
  )
}

function Composer({ destinationId, nextOrder, defaultCategory }: { destinationId: string; nextOrder: number; defaultCategory: WishCategory }) {
  const [title, setTitle] = useState('')
  const [cat, setCat] = useState<WishCategory>(defaultCategory)
  const [must, setMust] = useState(false)
  const [lastDefault, setLastDefault] = useState(defaultCategory)
  if (defaultCategory !== lastDefault) {
    setLastDefault(defaultCategory)
    setCat(defaultCategory)
  }

  const add = async () => {
    const t = title.trim()
    if (!t) return
    const now = Date.now()
    await db.wishes.add({
      id: newId(),
      destinationId,
      category: cat,
      title: t,
      links: [],
      priority: must ? 'must' : 'nice',
      done: false,
      order: nextOrder,
      createdAt: now,
      updatedAt: now,
    })
    setTitle('')
    setMust(false)
  }

  return (
    <div className="composer">
      <div className="composer-cats">
        {CATEGORY_ORDER.map((c) => (
          <button key={c} className={`mini-chip${cat === c ? ' on' : ''}`} onClick={() => setCat(c)}>
            {CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>
      <form
        className="composer-row"
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <button type="button" className={`must-toggle${must ? ' on' : ''}`} onClick={() => setMust(!must)} aria-pressed={must} aria-label="꼭 하기">
          <Icon name="star" size={18} filled={must} />
        </button>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`${CATEGORY_LABEL[cat]} — 하고 싶은 일 추가`} enterKeyHint="send" />
        <button type="submit" className="send" disabled={!title.trim()} aria-label="추가">
          <Icon name="plus" size={20} />
        </button>
      </form>
    </div>
  )
}

function WishSheet({ wish, onClose }: { wish: Wish; onClose: () => void }) {
  const [w, setW] = useState(wish)
  const [links, setLinks] = useState(wish.links.join('\n'))
  const save = async () => {
    await db.wishes.put({
      ...w,
      title: w.title.trim() || wish.title,
      memo: w.memo?.trim() || undefined,
      review: w.review?.trim() || undefined,
      links: links
        .split(/\s+/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map(normalizeUrl),
      doneAt: w.done ? (w.doneAt ?? Date.now()) : undefined,
      updatedAt: Date.now(),
    })
    onClose()
  }
  const remove = async () => {
    if (!confirm(`'${wish.title}'을(를) 지울까요?`)) return
    await db.wishes.delete(wish.id)
    onClose()
  }
  return (
    <Sheet
      title="하고 싶은 일"
      onClose={onClose}
      footer={
        <button className="btn btn-primary btn-block" onClick={save}>
          저장
        </button>
      }
    >
      <label className="field">
        <span className="label">무엇을</span>
        <input value={w.title} onChange={(e) => setW({ ...w, title: e.target.value })} />
      </label>
      <section className="field">
        <span className="label">종류</span>
        <div className="chips">
          {CATEGORY_ORDER.map((c) => (
            <button key={c} type="button" className={`chip${w.category === c ? ' chip-on' : ''}`} onClick={() => setW({ ...w, category: c })}>
              {CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
      </section>
      <section className="field">
        <span className="label">우선순위</span>
        <div className="seg">
          <button type="button" className={w.priority === 'must' ? 'on' : ''} onClick={() => setW({ ...w, priority: 'must' })}>
            ★ 꼭
          </button>
          <button type="button" className={w.priority === 'nice' ? 'on' : ''} onClick={() => setW({ ...w, priority: 'nice' })}>
            하면 좋음
          </button>
        </div>
      </section>
      <label className="field">
        <span className="label">메모</span>
        <textarea rows={3} value={w.memo ?? ''} onChange={(e) => setW({ ...w, memo: e.target.value })} placeholder="영업시간, 가는 법, 추천 메뉴…" />
      </label>
      <label className="field">
        <span className="label">링크 (한 줄에 하나)</span>
        <textarea rows={2} value={links} onChange={(e) => setLinks(e.target.value)} placeholder="https://…" inputMode="url" />
      </label>
      {w.links.length > 0 && (
        <div className="link-list">
          {w.links.map((l) => (
            <a key={l} href={l} target="_blank" rel="noreferrer noopener">
              <Icon name="link" size={14} /> {hostOf(l)}
            </a>
          ))}
        </div>
      )}
      <label className="field check-field">
        <input type="checkbox" checked={w.done} onChange={(e) => setW({ ...w, done: e.target.checked })} />
        <span>했어요</span>
      </label>
      {w.done && (
        <label className="field">
          <span className="label">한 줄 후기</span>
          <input value={w.review ?? ''} onChange={(e) => setW({ ...w, review: e.target.value })} placeholder="생각보다 훨씬 좋았던 것" maxLength={120} />
        </label>
      )}
      <button type="button" className="btn btn-danger-text btn-block" onClick={remove}>
        <Icon name="trash" size={18} /> 지우기
      </button>
    </Sheet>
  )
}

function ReviewSheet({ wish, onClose }: { wish: Wish; onClose: () => void }) {
  const [review, setReview] = useState('')
  const save = async () => {
    if (review.trim()) await db.wishes.update(wish.id, { review: review.trim(), updatedAt: Date.now() })
    onClose()
  }
  return (
    <Sheet
      title="어땠어요?"
      onClose={onClose}
      footer={
        <button className="btn btn-primary btn-block" onClick={save}>
          {review.trim() ? '후기 남기기' : '나중에'}
        </button>
      }
    >
      <p className="muted">
        <strong>{wish.title}</strong> — 한 줄로 남겨 두면 나중에 다시 꺼내 보기 좋아요.
      </p>
      <input autoFocus value={review} onChange={(e) => setReview(e.target.value)} placeholder="생각보다 훨씬 좋았던 것" maxLength={120} />
    </Sheet>
  )
}
