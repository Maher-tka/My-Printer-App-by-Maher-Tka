export interface PhotoFace {
  x: number
  y: number
  width: number
  height: number
  confidence: number
}
export interface PhotoOrientation {
  turns: number
  faces: PhotoFace[]
}
export interface PhotoFrame {
  fit: 'cover' | 'contain'
  crop: { x: number; y: number; width: number; height: number }
}
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

/** Prefer the supplied orientation unless upright faces give a clear alternative. */
export function choosePhotoOrientation(candidates: PhotoOrientation[]): PhotoOrientation {
  const original = candidates.find((c) => c.turns === 0) ?? { turns: 0, faces: [] }
  const score = (candidate: PhotoOrientation) =>
    candidate.faces.reduce((sum, face) => sum + face.confidence ** 2, 0)
  const best = candidates.reduce(
    (current, next) => (score(next) > score(current) ? next : current),
    original
  )
  return best.turns !== 0 &&
    score(best) > score(original) * 1.35 + 0.25 &&
    best.faces.some((f) => f.confidence >= 0.8)
    ? best
    : original
}

/** All coordinates are normalized to the correctly oriented source image. */
export function framePhoto(
  width: number,
  height: number,
  targetWidth: number,
  targetHeight: number,
  faces: PhotoFace[],
  headTurns = 0
): PhotoFrame {
  const contain: PhotoFrame = { fit: 'contain', crop: { x: 0, y: 0, width: 1, height: 1 } }
  const valid = faces.filter(
    (f) =>
      Number.isFinite(f.x + f.y + f.width + f.height + f.confidence) &&
      f.width > 0 &&
      f.height > 0 &&
      f.confidence >= 0.65
  )
  if (!valid.length) return contain
  const ratio = targetWidth / targetHeight / (width / height)
  const cropWidth = Math.min(1, ratio)
  const cropHeight = Math.min(1, 1 / ratio)
  // Keep hair/foreheads and a little breathing room around each face, not just eyes/nose.
  const margins = [
    { left: 0.3, right: 0.3, top: 0.5, bottom: 0.3 },
    { left: 0.3, right: 0.5, top: 0.3, bottom: 0.3 },
    { left: 0.3, right: 0.3, top: 0.3, bottom: 0.5 },
    { left: 0.5, right: 0.3, top: 0.3, bottom: 0.3 }
  ][((headTurns % 4) + 4) % 4]
  const left = Math.min(...valid.map((f) => clamp(f.x - f.width * margins.left, 0, 1)))
  const right = Math.max(...valid.map((f) => clamp(f.x + f.width * (1 + margins.right), 0, 1)))
  const top = Math.min(...valid.map((f) => clamp(f.y - f.height * margins.top, 0, 1)))
  const bottom = Math.max(...valid.map((f) => clamp(f.y + f.height * (1 + margins.bottom), 0, 1)))
  if (right - left > cropWidth || bottom - top > cropHeight) return contain
  return {
    fit: 'cover',
    crop: {
      x: clamp((1 - cropWidth) / 2, Math.max(0, right - cropWidth), Math.min(left, 1 - cropWidth)),
      y: clamp(
        (1 - cropHeight) / 2,
        Math.max(0, bottom - cropHeight),
        Math.min(top, 1 - cropHeight)
      ),
      width: cropWidth,
      height: cropHeight
    }
  }
}

/** A wide group may print sideways if it uses noticeably more of the photo area.
 * Face coordinates and forehead padding rotate together; fitting must stay safe.
 */
export function choosePhotoPrintLayout(
  width: number,
  height: number,
  targetWidth: number,
  targetHeight: number,
  faces: PhotoFace[]
) {
  const original = {
    turns: 0,
    faces,
    ...framePhoto(width, height, targetWidth, targetHeight, faces)
  }
  if (faces.length < 2) return original
  const rotatedFaces = faces.map((face) => ({
    ...face,
    x: 1 - face.y - face.height,
    y: face.x,
    width: face.height,
    height: face.width
  }))
  const rotated = {
    turns: 1,
    faces: rotatedFaces,
    ...framePhoto(height, width, targetWidth, targetHeight, rotatedFaces, 1)
  }
  const coverage = (frame: PhotoFrame, w: number, h: number) =>
    frame.fit === 'cover'
      ? 1
      : Math.min(w / h / (targetWidth / targetHeight), targetWidth / targetHeight / (w / h))
  return coverage(rotated, height, width) > coverage(original, width, height) + 0.1
    ? rotated
    : original
}
