/** Optional fields still need validation before stored or restored jobs reach the UI. */
export function hasValidOptionalJobFields(value: Record<string, unknown>): boolean {
  for (const key of ['customerId', 'deadline', 'localProjectPath', 'thumbnailPreview']) {
    if (value[key] !== undefined && typeof value[key] !== 'string') return false
  }
  const quote = value.quote
  if (!isRecord(quote)) return false
  for (const key of ['cuttingCost', 'bindingCost', 'designFee']) {
    if (quote[key] !== undefined && !isFiniteNumber(quote[key])) return false
  }
  if (value.printHistory === undefined) return true
  return (
    Array.isArray(value.printHistory) &&
    value.printHistory.every(
      (entry) =>
        isRecord(entry) &&
        typeof entry.id === 'string' &&
        typeof entry.module === 'string' &&
        ['booklet', 'cutter', 'hardcover', 'sequential'].includes(entry.module) &&
        typeof entry.jobName === 'string' &&
        (entry.printerName === undefined || typeof entry.printerName === 'string') &&
        typeof entry.printedAt === 'string' &&
        typeof entry.pdfName === 'string' &&
        typeof entry.status === 'string' &&
        ['printed', 'sent-to-printer'].includes(entry.status)
    )
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}
