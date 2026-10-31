import { Link } from 'react-router-dom'
import type { Destination } from '../types'
import { Cover } from './Cover'
import { StatusStamp } from './StatusStamp'
import { ProgressLine } from './JarMeter'
import { formatMonths } from '../lib/format'

export function DestinationCard({ d, saved, compact }: { d: Destination; saved: number; compact?: boolean }) {
  const ratio = d.budget ? saved / d.budget : 0
  const when = formatMonths(d.months)
  return (
    <Link to={`/d/${d.id}`} className={`postcard${compact ? ' postcard-compact' : ''}`}>
      <Cover d={d} variant="thumb" className="postcard-cover" />
      <div className="postcard-shade" />
      <div className="postcard-top">
        <StatusStamp status={d.status} small />
      </div>
      <div className="postcard-text">
        {d.country && <p className="postcard-country">{d.country}</p>}
        <h3 className="postcard-city">{d.city || d.country}</h3>
        {!compact && d.tagline && <p className="postcard-tagline">{d.tagline}</p>}
        {!compact && when && <p className="postcard-meta">{when}</p>}
      </div>
      {d.budget ? (
        <div className="postcard-progress">
          <ProgressLine ratio={ratio} />
        </div>
      ) : null}
    </Link>
  )
}
