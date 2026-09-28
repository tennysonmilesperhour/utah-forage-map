// Photo suggestions for Suggest an ID. The server compares one resized photo with the
// catalogue using Claude; the result is ranked with field marks, local records and season.

export const PHOTO_MAX_SIDE = 1024
export const PHOTO_WEIGHT = { strong: 6, possible: 3.5, weak: 1.5 }
export const PHOTO_LABELS = { strong: 'Photo: close likeness', possible: 'Photo: possible likeness', weak: 'Photo: slight likeness' }

export function photoSignals(result) {
  const signals = new Map()
  result?.suggestions?.forEach((item, order) => {
    if (PHOTO_WEIGHT[item.likeness] && !signals.has(item.slug)) signals.set(item.slug, { likeness: item.likeness, features: item.features, order })
  })
  return signals
}

export function photoScore(signal) {
  return signal ? PHOTO_WEIGHT[signal.likeness] - 0.25 * signal.order : 0
}

export function fitWithin(width, height, maxSide = PHOTO_MAX_SIDE) {
  const scale = Math.min(1, maxSide / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

// Redrawing on a canvas drops EXIF data, so the camera's GPS position never leaves the device.
export async function preparePhoto(file, maxSide = PHOTO_MAX_SIDE) {
  if (!file?.type?.startsWith('image/')) throw new Error('Choose a photo file.')
  let bitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Error('That photo could not be opened here. Try a JPEG or PNG.')
  }
  const size = fitWithin(bitmap.width, bitmap.height, maxSide)
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  canvas.getContext('2d').drawImage(bitmap, 0, 0, size.width, size.height)
  bitmap.close?.()
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
  return { dataUrl, image: dataUrl.slice(dataUrl.indexOf(',') + 1), mediaType: 'image/jpeg' }
}
