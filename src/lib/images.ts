import { db, newId } from '../db'

async function loadBitmap(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions)
    } catch {
      /* 아래 방식으로 재시도 */
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

function resize(src: ImageBitmap | HTMLImageElement, max: number, quality: number): Promise<{ blob: Blob; w: number; h: number }> {
  const sw = 'naturalWidth' in src ? src.naturalWidth : src.width
  const sh = 'naturalHeight' in src ? src.naturalHeight : src.height
  const scale = Math.min(1, max / Math.max(sw, sh))
  const w = Math.round(sw * scale)
  const h = Math.round(sh * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src, 0, 0, w, h)
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve({ blob: b, w, h }) : reject(new Error('이미지 변환 실패'))), 'image/jpeg', quality),
  )
}

/** 사진을 긴 변 1600px(본문) / 640px(목록용)로 줄여 기기에 저장하고 id를 돌려줌 */
export async function saveImage(file: Blob): Promise<string> {
  const src = await loadBitmap(file)
  const full = await resize(src, 1600, 0.82)
  const thumb = await resize(src, 640, 0.78)
  if ('close' in src) src.close()
  const id = newId()
  await db.images.add({ id, blob: full.blob, thumb: thumb.blob, width: full.w, height: full.h, createdAt: Date.now() })
  return id
}
