import { db, setMeta } from '../db'
import type { Destination, MoodItem, SavingsEntry, Wish } from '../types'
import { todayStr } from './format'

export const BACKUP_APP = 'wander-jar'
export const BACKUP_VERSION = 1

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
  destinations: Destination[]
  wishes: Wish[]
  savings: SavingsEntry[]
  moods: MoodItem[]
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

export async function buildBackup(): Promise<BackupFile> {
  const [destinations, wishes, savings, moods, images] = await Promise.all([
    db.destinations.toArray(),
    db.wishes.toArray(),
    db.savings.toArray(),
    db.moods.toArray(),
    db.images.toArray(),
  ])
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
    destinations,
    wishes,
    savings,
    moods,
    images: imgs,
  }
}

export type ExportResult = 'shared' | 'downloaded' | 'cancelled'

/** 안드로이드에서는 공유 메뉴(MYBOX·구글 드라이브·카톡 등)를 띄우고, 안 되면 파일로 내려받음 */
export async function exportBackup(preferShare: boolean): Promise<ExportResult> {
  const data = await buildBackup()
  const text = JSON.stringify(data)
  const base = `wander-jar-backup-${todayStr().replaceAll('-', '')}`

  if (preferShare && navigator.share && navigator.canShare) {
    // 크롬은 공유할 수 있는 파일 형식이 정해져 있어서 .json 이 안 되면 .txt 로 시도
    const candidates = [
      new File([text], `${base}.json`, { type: 'application/json' }),
      new File([text], `${base}.txt`, { type: 'text/plain' }),
    ]
    for (const file of candidates) {
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'Wander Jar 백업' })
          await setMeta('lastBackupAt', Date.now())
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
  await setMeta('lastBackupAt', Date.now())
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
  data.images ??= []
  return data
}

export interface ImportSummary {
  destinations: number
  wishes: number
  savings: number
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
  await db.transaction('rw', [db.destinations, db.wishes, db.savings, db.moods, db.images], async () => {
    if (mode === 'replace') {
      await Promise.all([db.destinations.clear(), db.wishes.clear(), db.savings.clear(), db.moods.clear(), db.images.clear()])
      await db.destinations.bulkPut(data.destinations)
      await db.wishes.bulkPut(data.wishes)
      await db.savings.bulkPut(data.savings)
      await db.moods.bulkPut(data.moods)
      await db.images.bulkPut(images)
      return
    }
    const keepNewer = <T extends { updatedAt: number }>(rows: T[], existing: (T | undefined)[]) =>
      rows.filter((r, i) => !existing[i] || (r.updatedAt ?? 0) >= (existing[i]!.updatedAt ?? 0))
    const exD = await db.destinations.bulkGet(data.destinations.map((d) => d.id))
    const exW = await db.wishes.bulkGet(data.wishes.map((w) => w.id))
    await db.destinations.bulkPut(keepNewer(data.destinations, exD))
    await db.wishes.bulkPut(keepNewer(data.wishes, exW))
    await db.savings.bulkPut(data.savings)
    await db.moods.bulkPut(data.moods)
    await db.images.bulkPut(images)
  })
  return { destinations: data.destinations.length, wishes: data.wishes.length, savings: data.savings.length }
}

export async function wipeAll() {
  await db.transaction('rw', [db.destinations, db.wishes, db.savings, db.moods, db.images, db.meta], async () => {
    await Promise.all([db.destinations.clear(), db.wishes.clear(), db.savings.clear(), db.moods.clear(), db.images.clear(), db.meta.clear()])
  })
}
