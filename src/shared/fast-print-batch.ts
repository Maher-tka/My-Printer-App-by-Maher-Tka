export const FAST_PRINT_MAX_FILES = 1000
export const FAST_PRINT_MAX_PAGES = 2000

/** Keep Explorer's order and remove repeated paths without changing their spelling. */
export function normalizeFastPrintSelection(input: unknown): string[] {
  if (!Array.isArray(input) || input.length === 0)
    throw new Error('Select PDF, PNG, or JPEG documents for Fast Print.')
  if (input.length > FAST_PRINT_MAX_FILES)
    throw new Error(`Fast Print supports up to ${FAST_PRINT_MAX_FILES} files in one batch.`)
  const seen = new Set<string>()
  const files: string[] = []
  for (const path of input) {
    if (typeof path !== 'string' || !path || path.includes('\0'))
      throw new Error('The selected file list is invalid.')
    if (!/\.(pdf|png|jpe?g)$/i.test(path))
      throw new Error(
        `Unsupported document: ${path.split(/[\\/]/).pop()}. Choose PDFs, PNGs, or JPEGs.`
      )
    const key = path.replace(/\//g, '\\').toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      files.push(path)
    }
  }
  return files
}

export function parseFastPrintSelectionManifest(text: string): string[] {
  let data: { version?: number; files?: unknown }
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('The Explorer file selection could not be read. Select the files again.')
  }
  if (!data || data.version !== 1) throw new Error('Unsupported Explorer selection format.')
  return normalizeFastPrintSelection(data.files)
}

export function countBatchSheets(pageCounts: number[], pagesPerSheet: 1 | 2 | 4): number {
  return pageCounts.reduce((sum, pages) => sum + Math.ceil(pages / pagesPerSheet), 0)
}

export function needsBatchBlankBack(
  documentSides: number,
  documentIndex: number,
  documentCount: number,
  duplex: boolean
): boolean {
  return duplex && documentIndex < documentCount - 1 && documentSides % 2 === 1
}
