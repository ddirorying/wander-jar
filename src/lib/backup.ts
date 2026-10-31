import { db, setMeta } from '../db'
import type { Destination, MoodItem, SavingsEntry, Stop, Wish } from '../types'
import { todayStr } from './format'

export const BACKUP_APP = 'wander-jar'
export const BACKUP_VERSION = 2

interface ImageExport {
  id: string
  width: number
  height: number
  createdAt: number
  full: string // data URL
  thumb: string
}

export interface BackupFile {
  app: typeof BACKUP_APP
  schemaVersion: number
  exportedAt: string
  /** 'all' = 전체 백업, 'single' = 여행지 하나 보내기 */
  kind?: 'all' | 'single'
  destinations: Destination[]
  wishes: Wish[]
  savings: SavingsEntry[]
  moods: MoodItem[]
  stops: Stop[]
  images: ImageExport[]
}

function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(b)
  })
}

async function dataUrlToBlob(s: string): Promise<Blob> {
  const res = await fetch(s)
  return res.blob()
}

export async function buildBackup(destinationId?: string): Promise<BackupFile> {
  const one = <T extends { destinationId: string }>(rows: T[]) => (destinationId ? rows.filter((r) => r.destinationId === destinationId) : rows)
  const [allD, wishes, savings, moods, stops] = await Promise.all([
    db.destinations.toArray(),
    db.wishes.toArray().then(one),
    // 여행지 하나를 다른 사람에게 보낼 때는 내 저축 기록은 빼고 보냄
    destinationId ? Promise.resolve([] as SavingsEntry[]) : db.savings.toArray(),
    db.moods.toArray().then(one),
    db.stops.toArray().then(one),
  ])
  const destinations = destinationId ? allD.filter((d) => d.id === destinationId) : allD
  const imageIds = destinationId
    ? new Set([...destinations.map((d) => d.coverImageId), ...moods.map((m) => m.imageId)].filter(Boolean) as string[])
    : undefined
  const images = (await db.images.toArray()).filter((i) => !imageIds || imageIds.has(i.id))
  const imgs: ImageExport[] = []
  for (const i of images) {
    imgs.push({
      id: i.id,
      width: i.width,
      height: i.height,
      createdAt: i.createdAt,
      full: await blobToDataUrl(i.blob),
      thumb: await blobToDataUrl(i.thumb),
    })
  }
  return {
    app: BACKUP_APP,
    schemaVersion: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    kind: destinationId ? 'single' : 'all',
    destinations,
    wishes,
    savings,
    moods,
    stops,
    images: imgs,
  }
}

export type ExportResult = 'shared' | 'downloaded' | 'cancelled'

/** 안드로이드에서는 공유 메뉴(MYBOX·구글 드라이브·카톡 등)를 띄우고, 안 되면 파일로 내려받음 */
export async function exportBackup(preferShare: boolean, destinationId?: string): Promise<ExportResult> {
  const data = await buildBackup(destinationId)
  const text = JSON.stringify(data)
  const single = data.destinations[0]
  const safeName = (single?.city || single?.country || '').replace(/[\\/:*?"<>|\s]+/g, '')
  const base = destinationId
    ? `wander-jar-${safeName || 'trip'}-${todayStr().replaceAll('-', '')}`
    : `wander-jar-backup-${todayStr().replaceAll('-', '')}`
  const shareTitle = destinationId ? `Wander Jar · ${single?.city || single?.country}` : 'Wander Jar 백업'
  const shareText = destinationId
    ? `Wander Jar 여행지 파일이에요. https://ddirorying.github.io/wander-jar/ 에서 설정 → 백업 파일 가져오기로 열어 보세요.`
    : undefined

  if (preferShare && navigator.share && navigator.canShare) {
    // 크롬은 공유할 수 있는 파일 형식이 정해져 있어서 .json 이 안 되면 .txt 로 시도
    const candidates = [
      new File([text], `${base}.json`, { type: 'application/json' }),
      new File([text], `${base}.txt`, { type: 'text/plain' }),
    ]
    for (const file of candidates) {
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: shareTitle, text: shareText })
          if (!destinationId) await setMeta('lastBackupAt', Date.now())
          return 'shared'
        } catch (e) {
          if ((e as DOMException).name === 'AbortError') return 'cancelled'
          break // 다른 오류면 내려받기로
        }
      }
    }
  }

  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${base}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
  if (!destinationId) await setMeta('lastBackupAt', Date.now())
  return 'downloaded'
}

export function parseBackup(text: string): BackupFile {
  let data: BackupFile
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('백업 파일을 읽을 수 없어요. Wander Jar에서 내보낸 파일이 맞는지 확인해 주세요.')
  }
  if (!data || data.app !== BACKUP_APP || !Array.isArray(data.destinations)) {
    throw new Error('Wander Jar 백업 파일이 아니에요.')
  }
  if (data.schemaVersion > BACKUP_VERSION) {
    throw new Error('더 새로운 버전의 앱에서 만든 백업이에요. 앱을 새로고침한 뒤 다시 시도해 주세요.')
  }
  data.wishes ??= []
  data.savings ??= []
  data.moods ??= []
  data.stops ??= []
  data.images ??= []
  return data
}

export interface ImportSummary {
  destinations: number
  wishes: number
  savings: number
  stops: number
}

/**
 * merge: 같은 항목은 더 최근에 수정된 쪽을 남기고, 없는 건 추가
 * replace: 이 기기 데이터를 모두 지우고 백업으로 교체
 */
export async function importBackup(data: BackupFile, mode: 'merge' | 'replace'): Promise<ImportSummary> {
  const images = await Promise.all(
    data.images.map(async (i) => ({
      id: i.id,
      width: i.width,
      height: i.height,
      createdAt: i.createdAt,
      blob: await dataUrlToBlob(i.full),
      thumb: await dataUrlToBlob(i.thumb),
    })),
  )
  await db.transaction('rw', [db.destinations, db.wishes, db.savings, db.moods, db.images, db.stops], async () => {
    if (mode === 'replace') {
      await Promise.all([db.destinations.clear(), db.wishes.clear(), db.savings.clear(), db.moods.clear(), db.images.clear(), db.stops.clear()])
      await db.destinations.bulkPut(data.destinations)
      await db.wishes.bulkPut(data.wishes)
      await db.savings.bulkPut(data.savings)
      await db.moods.bulkPut(data.moods)
      await db.stops.bulkPut(data.stops)
      await db.images.bulkPut(images)
      return
    }
    const keepNewer = <T extends { updatedAt: number }>(rows: T[], existing: (T | undefined)[]) =>
      rows.filter((r, i) => !existing[i] || (r.updatedAt ?? 0) >= (existing[i]!.updatedAt ?? 0))
    const exD = await db.destinations.bulkGet(data.destinations.map((d) => d.id))
    const exW = await db.wishes.bulkGet(data.wishes.map((w) => w.id))
    const exS = await db.stops.bulkGet(data.stops.map((x) => x.id))
    await db.destinations.bulkPut(keepNewer(data.destinations, exD))
    await db.wishes.bulkPut(keepNewer(data.wishes, exW))
    await db.stops.bulkPut(keepNewer(data.stops, exS))
    await db.savings.bulkPut(data.savings)
    await db.moods.bulkPut(data.moods)
    await db.images.bulkPut(images)
  })
  return { destinations: data.destinations.length, wishes: data.wishes.length, savings: data.savings.length, stops: data.stops.length }
}

export async function wipeAll() {
  await db.transaction('rw', [db.destinations, db.wishes, db.savings, db.moods, db.images, db.stops, db.meta], async () => {
    await Promise.all([
      db.destinations.clear(),
      db.wishes.clear(),
      db.savings.clear(),
      db.moods.clear(),
      db.images.clear(),
      db.stops.clear(),
      db.meta.clear(),
    ])
  })
}
