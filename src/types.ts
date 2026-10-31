export type Status = 'dreaming' | 'planning' | 'booked' | 'visited'
export type WishCategory = 'eat' | 'see' | 'do' | 'buy' | 'stay'
export type Priority = 'must' | 'nice'

export interface Credit {
  name: string
  url?: string
  source?: string
}

export interface Destination {
  id: string
  city: string
  country: string
  tagline: string
  coverImageId?: string
  coverUrl?: string
  coverCredit?: Credit
  status: Status
  months: number[]
  durationDays?: number
  /** 예상 예산 = 저축 목표 (원) */
  budget?: number
  budgetNote?: string
  companions: string[]
  tags: string[]
  tripStart?: string // YYYY-MM-DD
  tripEnd?: string
  createdAt: number
  updatedAt: number
  lastViewedAt?: number
  viewCount: number
  /** 지도 중심 (도시 위치) */
  lat?: number
  lng?: number
  /** 일정 탭의 날 수 (직접 늘린 경우) */
  planDays?: number
}

export interface Wish {
  id: string
  destinationId: string
  category: WishCategory
  title: string
  memo?: string
  links: string[]
  priority: Priority
  done: boolean
  doneAt?: number
  review?: string
  order: number
  createdAt: number
  updatedAt: number
}

export interface SavingsEntry {
  id: string
  destinationId: string
  /** 양수 = 모으기, 음수 = 꺼내 쓰기 (원) */
  amount: number
  date: string // YYYY-MM-DD
  memo?: string
  createdAt: number
}

/** 일정의 한 장소. day 0 = 아직 날을 안 정한 곳 */
export interface Stop {
  id: string
  destinationId: string
  day: number
  order: number
  name: string
  address?: string
  lat: number
  lng: number
  time?: string // HH:MM
  memo?: string
  wishId?: string
  createdAt: number
  updatedAt: number
}

/** 3단계(무드보드)에서 사용 — 미리 자리만 만들어 둠 */
export interface MoodItem {
  id: string
  destinationId: string
  type: 'video' | 'music' | 'photo' | 'quote' | 'work'
  url?: string
  provider?: string
  embedId?: string
  imageId?: string
  credit?: Credit
  text?: string
  title?: string
  order: number
  createdAt: number
}

export interface StoredImage {
  id: string
  blob: Blob
  thumb: Blob
  width: number
  height: number
  createdAt: number
}

export interface MetaRow {
  key: string
  value: unknown
}
