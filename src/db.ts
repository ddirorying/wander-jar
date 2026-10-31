import Dexie, { type EntityTable } from 'dexie'
import type { Destination, MetaRow, MoodItem, SavingsEntry, Stop, StoredImage, Wish } from './types'

export const db = new Dexie('wander-jar') as Dexie & {
  destinations: EntityTable<Destination, 'id'>
  wishes: EntityTable<Wish, 'id'>
  savings: EntityTable<SavingsEntry, 'id'>
  stops: EntityTable<Stop, 'id'>
  moods: EntityTable<MoodItem, 'id'>
  images: EntityTable<StoredImage, 'id'>
  meta: EntityTable<MetaRow, 'key'>
}

db.version(1).stores({
  destinations: 'id, status, createdAt, updatedAt',
  wishes: 'id, destinationId',
  savings: 'id, destinationId, date',
  moods: 'id, destinationId',
  images: 'id',
  meta: 'key',
})

// 2단계: 지도 일정
db.version(2).stores({
  stops: 'id, destinationId',
})

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const row = await db.meta.get(key)
  return row?.value as T | undefined
}

export async function setMeta(key: string, value: unknown) {
  await db.meta.put({ key, value })
}

/** 브라우저가 저장 공간이 부족할 때 이 앱 데이터를 임의로 지우지 않도록 요청 */
export async function requestPersist() {
  try {
    if (navigator.storage?.persisted && !(await navigator.storage.persisted())) {
      await navigator.storage.persist?.()
    }
  } catch {
    /* 지원 안 하는 브라우저는 무시 */
  }
}

export async function deleteDestination(id: string) {
  await db.transaction('rw', [db.destinations, db.wishes, db.savings, db.moods, db.images, db.stops], async () => {
    const d = await db.destinations.get(id)
    const moods = await db.moods.where('destinationId').equals(id).toArray()
    const imageIds = [d?.coverImageId, ...moods.map((m) => m.imageId)].filter(Boolean) as string[]
    await db.images.bulkDelete(imageIds)
    await db.wishes.where('destinationId').equals(id).delete()
    await db.savings.where('destinationId').equals(id).delete()
    await db.moods.where('destinationId').equals(id).delete()
    await db.stops.where('destinationId').equals(id).delete()
    await db.destinations.delete(id)
  })
}
