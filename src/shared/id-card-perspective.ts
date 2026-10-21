import { validIdCrop, type IdCrop } from './fast-print-id.js'

/** Inverse projective map: unit output rectangle to the four selected source corners. */
export function idCardProjection(crop: IdCrop): number[] {
  if (!validIdCrop(crop)) throw new Error('Adjust the crop corners to form a card.')
  const [p0, p1, p2, p3] = crop
  const dx1 = p1.x - p2.x,
    dx2 = p3.x - p2.x,
    dx3 = p0.x - p1.x + p2.x - p3.x
  const dy1 = p1.y - p2.y,
    dy2 = p3.y - p2.y,
    dy3 = p0.y - p1.y + p2.y - p3.y
  let g = 0,
    h = 0
  if (Math.abs(dx3) + Math.abs(dy3) > 1e-10) {
    const denominator = dx1 * dy2 - dx2 * dy1
    if (Math.abs(denominator) < 1e-10) throw new Error('Adjust the crop corners to form a card.')
    g = (dx3 * dy2 - dx2 * dy3) / denominator
    h = (dx1 * dy3 - dx3 * dy1) / denominator
  }
  return [
    p1.x - p0.x + g * p1.x,
    p3.x - p0.x + h * p3.x,
    p0.x,
    p1.y - p0.y + g * p1.y,
    p3.y - p0.y + h * p3.y,
    p0.y,
    g,
    h
  ]
}

/** Bilinear sampling preserves all selected corners; no content-dependent crop or AI edits. */
export function rectifyIdPixels(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  crop: IdCrop,
  outWidth: number,
  outHeight: number
): Uint8ClampedArray {
  if (
    data.length !== width * height * 4 ||
    !Number.isInteger(outWidth) ||
    !Number.isInteger(outHeight) ||
    outWidth < 1 ||
    outHeight < 1 ||
    outWidth * outHeight > 4_000_000
  )
    throw new Error('Invalid ID image size.')
  const [a, b, c, d, e, f, g, h] = idCardProjection(crop),
    output = new Uint8ClampedArray(outWidth * outHeight * 4)
  for (let y = 0; y < outHeight; y++)
    for (let x = 0; x < outWidth; x++) {
      const u = (x + 0.5) / outWidth,
        v = (y + 0.5) / outHeight,
        denominator = g * u + h * v + 1
      const sx = Math.max(
          0,
          Math.min(width - 1, ((a * u + b * v + c) / denominator) * width - 0.5)
        ),
        sy = Math.max(0, Math.min(height - 1, ((d * u + e * v + f) / denominator) * height - 0.5))
      const x0 = Math.floor(sx),
        y0 = Math.floor(sy),
        x1 = Math.min(width - 1, x0 + 1),
        y1 = Math.min(height - 1, y0 + 1),
        tx = sx - x0,
        ty = sy - y0
      const p00 = (y0 * width + x0) * 4,
        p10 = (y0 * width + x1) * 4,
        p01 = (y1 * width + x0) * 4,
        p11 = (y1 * width + x1) * 4
      const w00 = ((1 - tx) * (1 - ty) * data[p00 + 3]) / 255,
        w10 = (tx * (1 - ty) * data[p10 + 3]) / 255,
        w01 = ((1 - tx) * ty * data[p01 + 3]) / 255,
        w11 = (tx * ty * data[p11 + 3]) / 255
      const index = (y * outWidth + x) * 4,
        white = 255 * (1 - w00 - w10 - w01 - w11)
      for (let channel = 0; channel < 3; channel++)
        output[index + channel] =
          data[p00 + channel] * w00 +
          data[p10 + channel] * w10 +
          data[p01 + channel] * w01 +
          data[p11 + channel] * w11 +
          white
      output[index + 3] = 255
    }
  return output
}
