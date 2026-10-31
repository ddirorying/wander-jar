import { useRef, useState } from 'react'
import { Sheet } from '../components/Sheet'
import { Icon } from '../components/Icon'
import { ChipInput } from '../components/ChipInput'
import { AmountInput } from '../components/AmountInput'
import { Cover } from '../components/Cover'
import { db, deleteDestination, newId, requestPersist } from '../db'
import { saveImage } from '../lib/images'
import { PRESET_TAGS, SEASONS, STATUS_LABEL, STATUS_ORDER, normalizeUrl } from '../lib/format'
import type { Destination } from '../types'

type Draft = Omit<Destination, 'id' | 'createdAt' | 'updatedAt' | 'viewCount'>

const empty: Draft = {
  city: '',
  country: '',
  tagline: '',
  status: 'dreaming',
  months: [],
  companions: [],
  tags: [],
}

export function EditDestinationSheet({
  existing,
  onClose,
  onSaved,
  onDeleted,
}: {
  existing?: Destination
  onClose: () => void
  onSaved: (id: string) => void
  onDeleted?: () => void
}) {
  const [d, setD] = useState<Draft>(() => (existing ? { ...existing } : { ...empty }))
  const [busy, setBusy] = useState(false)
  const [photoMode, setPhotoMode] = useState<'file' | 'url'>(existing?.coverUrl && !existing.coverImageId ? 'url' : 'file')
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }))

  const toggleMonth = (m: number) =>
    set('months', d.months.includes(m) ? d.months.filter((x) => x !== m) : [...d.months, m].sort((a, b) => a - b))
  const toggleSeason = (ms: number[]) => {
    const all = ms.every((m) => d.months.includes(m))
    set('months', all ? d.months.filter((m) => !ms.includes(m)) : [...new Set([...d.months, ...ms])].sort((a, b) => a - b))
  }
  const toggleTag = (t: string) => set('tags', d.tags.includes(t) ? d.tags.filter((x) => x !== t) : [...d.tags, t])

  const onFile = async (f: File | undefined) => {
    if (!f) return
    setBusy(true)
    setError('')
    try {
      const id = await saveImage(f)
      // 이번 편집 중에 올렸다가 바꾼 사진은 바로 정리
      if (d.coverImageId && d.coverImageId !== existing?.coverImageId) await db.images.delete(d.coverImageId)
      setD((p) => ({ ...p, coverImageId: id, coverUrl: undefined, coverCredit: undefined }))
    } catch {
      setError('사진을 불러오지 못했어요. 다른 사진으로 시도해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    if (!d.city.trim() && !d.country.trim()) {
      setError('도시나 나라 이름을 적어 주세요.')
      return
    }
    setBusy(true)
    const now = Date.now()
    const clean: Draft = {
      ...d,
      city: d.city.trim(),
      country: d.country.trim(),
      tagline: d.tagline.trim(),
      coverUrl: d.coverUrl?.trim() ? normalizeUrl(d.coverUrl) : undefined,
      coverCredit: d.coverCredit?.name?.trim() ? { ...d.coverCredit, name: d.coverCredit.name.trim() } : undefined,
    }
    // 이전 사진을 바꿨으면 예전 파일은 지움
    if (existing?.coverImageId && existing.coverImageId !== clean.coverImageId) {
      await db.images.delete(existing.coverImageId)
    }
    let id: string
    if (existing) {
      id = existing.id
      await db.destinations.put({ ...existing, ...clean, updatedAt: now })
    } else {
      id = newId()
      await db.destinations.add({ ...clean, id, createdAt: now, updatedAt: now, viewCount: 0 })
      requestPersist()
    }
    onSaved(id)
  }

  const cancel = () => {
    if (d.coverImageId && d.coverImageId !== existing?.coverImageId) db.images.delete(d.coverImageId)
    onClose()
  }

  const remove = async () => {
    if (!existing) return
    if (!confirm(`'${existing.city || existing.country}'을(를) 보관함에서 지울까요?\n하고 싶은 일과 저축 기록도 함께 지워져요.`)) return
    await deleteDestination(existing.id)
    onDeleted?.()
  }

  const preview: Destination = { ...(existing ?? { id: 'preview', createdAt: 0, updatedAt: 0, viewCount: 0 }), ...d }
  const hasPhoto = !!(d.coverImageId || d.coverUrl)

  return (
    <Sheet
      title={existing ? '여행지 고치기' : '새 여행지 담기'}
      onClose={cancel}
      footer={
        <>
          {error && <p className="form-error">{error}</p>}
          <button className="btn btn-primary btn-block" onClick={save} disabled={busy}>
            {existing ? '저장' : '보관함에 담기'}
          </button>
        </>
      }
    >
      <section className="field">
        <div className={`photo-pick${hasPhoto ? ' has-photo' : ''}`}>
          {hasPhoto ? (
            <Cover d={preview} className="photo-preview" />
          ) : (
            <button type="button" className="photo-empty" onClick={() => (photoMode === 'file' ? fileRef.current?.click() : undefined)}>
              <Icon name="camera" size={28} />
              <span>대표 사진</span>
            </button>
          )}
          {hasPhoto && (
            <button
              type="button"
              className="photo-remove"
              onClick={() => {
                if (d.coverImageId && d.coverImageId !== existing?.coverImageId) db.images.delete(d.coverImageId)
                setD((p) => ({ ...p, coverImageId: undefined, coverUrl: undefined, coverCredit: undefined }))
              }}
            >
              사진 빼기
            </button>
          )}
        </div>
        <div className="seg seg-sm">
          <button type="button" className={photoMode === 'file' ? 'on' : ''} onClick={() => setPhotoMode('file')}>
            내 사진 올리기
          </button>
          <button type="button" className={photoMode === 'url' ? 'on' : ''} onClick={() => setPhotoMode('url')}>
            사진 링크
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        {photoMode === 'file' ? (
          <button type="button" className="btn btn-ghost btn-block" onClick={() => fileRef.current?.click()} disabled={busy}>
            {busy ? '사진 줄이는 중…' : hasPhoto ? '다른 사진 고르기' : '갤러리에서 고르기'}
          </button>
        ) : (
          <div className="stack-sm">
            <input
              type="url"
              inputMode="url"
              placeholder="https://… 이미지 주소"
              value={d.coverUrl ?? ''}
              onChange={(e) => setD((p) => ({ ...p, coverUrl: e.target.value, coverImageId: undefined }))}
            />
            <div className="row-2">
              <input
                placeholder="사진 출처 (작가 이름)"
                value={d.coverCredit?.name ?? ''}
                onChange={(e) => set('coverCredit', { ...(d.coverCredit ?? { name: '' }), name: e.target.value })}
              />
              <input
                placeholder="출처 사이트 (예: Unsplash)"
                value={d.coverCredit?.source ?? ''}
                onChange={(e) => set('coverCredit', { ...(d.coverCredit ?? { name: '' }), source: e.target.value })}
              />
            </div>
          </div>
        )}
      </section>

      <section className="field row-2">
        <label>
          <span className="label">도시</span>
          <input placeholder="리스본" value={d.city} onChange={(e) => set('city', e.target.value)} />
        </label>
        <label>
          <span className="label">나라</span>
          <input placeholder="포르투갈" value={d.country} onChange={(e) => set('country', e.target.value)} />
        </label>
      </section>

      <label className="field">
        <span className="label">왜 가고 싶어요?</span>
        <input
          placeholder="노란 트램 타고 언덕 위 전망대에서 노을 보기"
          value={d.tagline}
          maxLength={80}
          onChange={(e) => set('tagline', e.target.value)}
        />
      </label>

      <section className="field">
        <span className="label">지금 상태</span>
        <div className="stamp-pick">
          {STATUS_ORDER.map((s) => (
            <button type="button" key={s} className={`stamp stamp-${s}${d.status === s ? ' picked' : ''}`} onClick={() => set('status', s)}>
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </section>

      {(d.status === 'booked' || d.status === 'visited' || d.tripStart) && (
        <section className="field row-2">
          <label>
            <span className="label">출발일</span>
            <input type="date" value={d.tripStart ?? ''} onChange={(e) => set('tripStart', e.target.value || undefined)} />
          </label>
          <label>
            <span className="label">돌아오는 날</span>
            <input type="date" value={d.tripEnd ?? ''} min={d.tripStart} onChange={(e) => set('tripEnd', e.target.value || undefined)} />
          </label>
        </section>
      )}

      <section className="field">
        <span className="label">가고 싶은 시기</span>
        <div className="chips">
          {SEASONS.map((s) => (
            <button
              type="button"
              key={s.label}
              className={`chip${s.months.every((m) => d.months.includes(m)) ? ' chip-on' : ''}`}
              onClick={() => toggleSeason(s.months)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="month-grid">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <button type="button" key={m} className={`month${d.months.includes(m) ? ' on' : ''}`} onClick={() => toggleMonth(m)}>
              {m}월
            </button>
          ))}
        </div>
      </section>

      <section className="field row-2">
        <label>
          <span className="label">예상 기간</span>
          <div className="amount-input">
            <input
              inputMode="numeric"
              placeholder="5"
              value={d.durationDays ?? ''}
              onChange={(e) => set('durationDays', e.target.value ? Number(e.target.value.replace(/\D/g, '')) || undefined : undefined)}
            />
            <span className="amount-unit">일</span>
          </div>
        </label>
        <label>
          <span className="label">예산 · 저축 목표</span>
          <AmountInput value={d.budget} onChange={(v) => set('budget', v)} placeholder="1,500,000" />
        </label>
      </section>

      <section className="field">
        <span className="label">같이 가고 싶은 사람</span>
        <ChipInput values={d.companions} onChange={(v) => set('companions', v)} placeholder="이름 입력 후 엔터" />
      </section>

      <section className="field">
        <span className="label">태그</span>
        <div className="chips">
          {[...new Set([...PRESET_TAGS, ...d.tags])].map((t) => (
            <button type="button" key={t} className={`chip${d.tags.includes(t) ? ' chip-on' : ''}`} onClick={() => toggleTag(t)}>
              {t}
            </button>
          ))}
        </div>
        <ChipInput
          values={[]}
          onChange={(v) => set('tags', [...new Set([...d.tags, ...v])])}
          placeholder="직접 추가 (예: 와인)"
        />
      </section>

      {existing && (
        <button type="button" className="btn btn-danger-text btn-block" onClick={remove}>
          <Icon name="trash" size={18} /> 이 여행지 지우기
        </button>
      )}
    </Sheet>
  )
}
