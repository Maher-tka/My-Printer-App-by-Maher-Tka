// Independent raster measurements in millimetres, shared by hidden proof checks.
export function measureIdProof(
  data,
  width,
  height,
  centers,
  cardHeightMm,
  dpi = 300,
  channels = 4,
  cardWidthMm = 90
) {
  const factor = dpi / 25.4
  let inkPixels = 0,
    chromaticPixels = 0
  for (let index = 0; index < data.length; index += channels) {
    const r = data[index],
      g = data[index + 1],
      b = data[index + 2]
    if (Math.min(r, g, b) < 240) inkPixels++
    if (Math.max(r, g, b) - Math.min(r, g, b) > 1) chromaticPixels++
  }
  const cells = centers.map((center) => {
    let left = width,
      right = -1,
      top = height,
      bottom = -1,
      ink = 0
    const x1 = Math.max(0, Math.floor((center.x - cardWidthMm / 2 - 1) * factor)),
      x2 = Math.min(width, Math.ceil((center.x + cardWidthMm / 2 + 1) * factor))
    const y1 = Math.max(0, Math.floor((center.y - cardHeightMm / 2 - 1) * factor)),
      y2 = Math.min(height, Math.ceil((center.y + cardHeightMm / 2 + 1) * factor))
    for (let y = y1; y < y2; y++)
      for (let x = x1; x < x2; x++) {
        const index = (y * width + x) * channels
        if (Math.min(data[index], data[index + 1], data[index + 2]) < 240) {
          ink++
          left = Math.min(left, x)
          right = Math.max(right, x)
          top = Math.min(top, y)
          bottom = Math.max(bottom, y)
        }
      }
    return {
      inkPixels: ink,
      inkWidthMm: ink ? (right - left + 1) / factor : 0,
      inkHeightMm: ink ? (bottom - top + 1) / factor : 0,
      centerOffsetMm: {
        x: (left + right + 1) / 2 / factor - center.x,
        y: (top + bottom + 1) / 2 / factor - center.y
      }
    }
  })
  return {
    cells,
    chromaticPixels,
    outsideInkPixels: inkPixels - cells.reduce((sum, cell) => sum + cell.inkPixels, 0)
  }
}
