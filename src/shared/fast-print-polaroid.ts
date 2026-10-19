export type PolaroidMode = 'polaroid-8' | 'polaroid-9'

/** Measured red placeholder bounds from the user's PDFs at their native 300 DPI.
 * Bounds are half-open. The source PDF artwork is never copied into output.
 */
export function polaroidLayout(mode: PolaroidMode, dpi = 300) {
  const eight = mode === 'polaroid-8'
  const referenceWidth = eight ? 3508 : 2480
  const referenceHeight = eight ? 2480 : 3508
  const widthMm = eight ? 297 : 210
  const heightMm = eight ? 210 : 297
  const width = Math.round((widthMm * dpi) / 25.4)
  const height = Math.round((heightMm * dpi) / 25.4)
  const xs = eight
    ? [
        [40, 835],
        [919, 1712],
        [1797, 2590],
        [2674, 3469]
      ]
    : [
        [64, 753],
        [893, 1581],
        [1723, 2413]
      ]
  const ys = eight
    ? [
        [60, 1035],
        [1303, 2278]
      ]
    : [
        [89, 933],
        [1265, 2107],
        [2436, 3279]
      ]
  const photos = ys.flatMap(([top, bottom]) =>
    xs.map(([left, right]) => ({
      x: (left / referenceWidth) * width,
      y: (top / referenceHeight) * height,
      width: ((right - left) / referenceWidth) * width,
      height: ((bottom - top) / referenceHeight) * height
    }))
  )
  return {
    width,
    height,
    widthMm,
    heightMm,
    photos,
    columns: xs.length,
    rows: ys.length,
    cutXs: (eight ? [876, 1753.5, 2631] : [821.5, 1651]).map((x) => (x / referenceWidth) * width),
    cutYs: (eight ? [1240] : [1165.5, 2338]).map((y) => (y / referenceHeight) * height),
    // A CSS pixel is 1/96 inch; preserve the requested physical stroke at any DPI.
    cutLineWidth: (0.25 * dpi) / 96
  }
}

/** Cover the placeholder without stretching; crop excess from the center. */
export function polaroidCoverCrop(
  sourceWidth: number,
  sourceHeight: number,
  width: number,
  height: number
) {
  const scale = Math.max(width / sourceWidth, height / sourceHeight)
  const cropWidth = width / scale
  const cropHeight = height / scale
  return {
    x: (sourceWidth - cropWidth) / 2,
    y: (sourceHeight - cropHeight) / 2,
    width: cropWidth,
    height: cropHeight
  }
}
