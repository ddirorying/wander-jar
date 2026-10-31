import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db } from '../db'

/** 기기에 저장된 사진을 화면에 띄울 수 있는 주소로 바꿔 줌 */
export function useImageUrl(id: string | undefined, variant: 'full' | 'thumb' = 'full') {
  const img = useLiveQuery(() => (id ? db.images.get(id) : undefined), [id])
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!img) {
      setUrl(undefined)
      return
    }
    const u = URL.createObjectURL(variant === 'thumb' ? img.thumb : img.blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [img, variant])
  return url
}

export function useSavingsTotals() {
  return useLiveQuery(async () => {
    const all = await db.savings.toArray()
    const map = new Map<string, number>()
    for (const s of all) map.set(s.destinationId, (map.get(s.destinationId) ?? 0) + s.amount)
    return map
  }, [])
}
