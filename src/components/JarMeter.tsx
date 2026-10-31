import { useId } from 'react'

/** 저금통(Jar)이 차오르는 그림 */
export function JarMeter({ ratio, size = 120 }: { ratio: number; size?: number }) {
  const r = Math.max(0, Math.min(1, ratio))
  // 병 몸통 영역: y 30 ~ 112
  const top = 30
  const bottom = 112
  const level = bottom - (bottom - top) * r
  const clipId = 'jar' + useId().replace(/:/g, '')
  return (
    <svg width={size} height={size * 1.1} viewBox="0 0 100 120" className="jar-meter" role="img" aria-label={`목표의 ${Math.round(r * 100)}%`}>
      <defs>
        <clipPath id={clipId}>
          <path d="M30 22 C 30 28, 16 32, 16 50 L 16 104 C 16 110, 20 114, 26 114 L 74 114 C 80 114, 84 110, 84 104 L 84 50 C 84 32, 70 28, 70 22 Z" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {r > 0 && r < 1 && (
          <path
            className="jar-wave"
            d={`M0 ${level} Q 12.5 ${level - 3}, 25 ${level} T 50 ${level} T 75 ${level} T 100 ${level} V 120 H 0 Z`}
          />
        )}
        <rect x="0" y={r > 0 && r < 1 ? level + 3 : level} width="100" height={120 - level} className="jar-fill" />
      </g>
      <path
        className="jar-glass"
        d="M30 22 C 30 28, 16 32, 16 50 L 16 104 C 16 110, 20 114, 26 114 L 74 114 C 80 114, 84 110, 84 104 L 84 50 C 84 32, 70 28, 70 22 Z"
      />
      <rect className="jar-lid" x="27" y="8" width="46" height="14" rx="3" />
      <path className="jar-shine" d="M24 54 L 24 96" />
    </svg>
  )
}

export function ProgressLine({ ratio }: { ratio: number }) {
  const r = Math.max(0, Math.min(1, ratio))
  return (
    <div className="progress-line" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(r * 100)}>
      <span style={{ width: `${r * 100}%` }} />
    </div>
  )
}
