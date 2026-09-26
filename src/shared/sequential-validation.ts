/** Shared structural validation for native project files and renderer recovery. */
export function isSequentialProject(value: unknown): boolean {
  if (
    !record(value) ||
    typeof value.name !== 'string' ||
    value.name.length > 500 ||
    !record(value.settings)
  )
    return false
  const s = value.settings
  if (
    !oneOf(s.sheetPreset, ['a4', 'a3', 'custom']) ||
    !oneOf(s.order, ['sheet', 'stack']) ||
    !oneOf(s.backMode, ['none', 'blank', 'artwork']) ||
    !oneOf(s.duplexFlip, ['long-edge', 'short-edge']) ||
    typeof s.numberBack !== 'boolean' ||
    typeof s.cropMarks !== 'boolean' ||
    (s.gutterCutLines !== undefined && typeof s.gutterCutLines !== 'boolean') ||
    (s.cuttingLineColor !== undefined &&
      (typeof s.cuttingLineColor !== 'string' || !/^#[0-9a-f]{6}$/i.test(s.cuttingLineColor)))
  )
    return false
  for (const key of ['sheetWidthMm', 'sheetHeightMm', 'ticketWidthMm', 'ticketHeightMm']) {
    if (!finite(s[key], 1, 2000)) return false
  }
  if (
    !finite(s.marginMm, 0, 1000) ||
    !finite(s.gapMm, 0, 1000) ||
    !integer(s.startNumber, 0, Number.MAX_SAFE_INTEGER) ||
    !integer(s.quantity, 1, 100000) ||
    !integer(s.increment, 1, Number.MAX_SAFE_INTEGER) ||
    !integer(s.digits, 1, 12)
  )
    return false
  if (!Number.isSafeInteger(Number(s.startNumber) + (Number(s.quantity) - 1) * Number(s.increment)))
    return false
  if (![s.prefix, s.suffix].every((text) => typeof text === 'string' && text.length <= 32))
    return false
  if (!Array.isArray(value.positions) || value.positions.length > 100) return false
  const ids = new Set<string>()
  for (const p of value.positions) {
    if (
      !record(p) ||
      typeof p.id !== 'string' ||
      !p.id ||
      ids.has(p.id) ||
      !finite(p.xMm, 0, 2000) ||
      !finite(p.yMm, 0, 2000) ||
      !finite(p.fontSizePt, 1, 300) ||
      typeof p.color !== 'string' ||
      !/^#[0-9a-fA-F]{6}$/.test(p.color) ||
      !oneOf(p.align, ['left', 'center', 'right']) ||
      (p.kind !== undefined && !oneOf(p.kind, ['number', 'text'])) ||
      (p.text !== undefined && (typeof p.text !== 'string' || p.text.length > 200)) ||
      (p.kind === 'text' && typeof p.text !== 'string')
    )
      return false
    ids.add(p.id)
  }
  return artwork(value.front) && artwork(value.back)
}

function artwork(value: unknown): boolean {
  if (value === null) return true
  if (
    !record(value) ||
    typeof value.name !== 'string' ||
    value.name.length > 1000 ||
    !oneOf(value.kind, ['pdf', 'png', 'jpeg']) ||
    !integer(value.pageCount, 1, 100000) ||
    !integer(value.pageNumber, 1, Number(value.pageCount)) ||
    !finite(value.widthMm, 0.001, 100000) ||
    !finite(value.heightMm, 0.001, 100000) ||
    typeof value.bytesBase64 !== 'string' ||
    !validBase64(value.bytesBase64, 140000000) ||
    typeof value.previewDataUrl !== 'string'
  )
    return false
  const preview = /^data:image\/(?:png|jpeg);base64,(.+)$/.exec(value.previewDataUrl)
  return !!preview && validBase64(preview[1], 20000000)
}

function validBase64(value: string, maxLength: number): boolean {
  return (
    value.length > 0 &&
    value.length <= maxLength &&
    value.length % 4 === 0 &&
    /^[A-Za-z0-9+/]*={0,2}$/.test(value)
  )
}
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
function finite(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
}
function integer(value: unknown, min: number, max: number): boolean {
  return finite(value, min, max) && Number.isSafeInteger(value)
}
function oneOf(value: unknown, options: string[]): boolean {
  return typeof value === 'string' && options.includes(value)
}
