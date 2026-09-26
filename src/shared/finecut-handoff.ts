export interface FineCutHandoffRequest {
  svg: string
  widthMm: number
  heightMm: number
}
export interface FineCutHandoffResult {
  ok: boolean
  sentToDevice: false
  aiPath?: string
  pdfPath?: string
  folderPath?: string
  error?: string
}
export function validateFineCutHandoff(value: unknown): value is FineCutHandoffRequest {
  if (!value || typeof value !== 'object') return false
  const v = value as FineCutHandoffRequest
  return (
    typeof v.svg === 'string' &&
    v.svg.length < 100 * 1024 * 1024 &&
    v.svg.includes('<svg') &&
    ['Artwork', 'CutContour', 'RegistrationMarks'].every((id) => v.svg.includes(`id="${id}"`)) &&
    !/<(?:script|foreignObject)\b/i.test(v.svg) &&
    !/<!DOCTYPE|<!ENTITY|<style\b/i.test(v.svg) &&
    !/\son[a-z]+\s*=/i.test(v.svg) &&
    !/(?:href|xlink:href)\s*=\s*["'](?!data:image\/|#)/i.test(v.svg) &&
    Number.isFinite(v.widthMm) &&
    v.widthMm > 0 &&
    v.widthMm <= 960 &&
    Number.isFinite(v.heightMm) &&
    v.heightMm > 0 &&
    v.heightMm <= 1400
  )
}
