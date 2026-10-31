import type { Status } from '../types'
import { STATUS_LABEL } from '../lib/format'

export function StatusStamp({ status, small }: { status: Status; small?: boolean }) {
  return <span className={`stamp stamp-${status}${small ? ' stamp-sm' : ''}`}>{STATUS_LABEL[status]}</span>
}
