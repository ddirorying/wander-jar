import type { Destination } from '../types'
import { useImageUrl } from '../lib/hooks'
import { paletteFor } from '../lib/format'

/** 대표 사진 (직접 올린 사진 → 링크 사진 → 사진 없으면 엽서 색) */
export function Cover({ d, variant = 'full', className }: { d: Destination; variant?: 'full' | 'thumb'; className?: string }) {
  const local = useImageUrl(d.coverImageId, variant)
  const src = local ?? d.coverUrl
  const [a, b] = paletteFor(d.city || d.country || '?')
  return (
    <div className={`cover ${className ?? ''}`} style={{ background: `linear-gradient(150deg, ${a}, ${b})` }}>
      {src ? (
        <img src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
      ) : (
        <span className="cover-letter" aria-hidden="true">
          {(d.city || d.country || '?').slice(0, 1)}
        </span>
      )}
    </div>
  )
}
