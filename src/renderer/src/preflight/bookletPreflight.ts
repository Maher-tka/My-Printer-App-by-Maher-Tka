import { createPreflightReport, type PreflightIssue, type PreflightReport } from './preflightTypes'

export interface BookletPreflightInput {
  pageCount: number
  blankPageCount: number
  paperWidthMm: number
  paperHeightMm: number
  readingDirection?: 'ltr' | 'rtl'
  exportPath?: string | null
  estimatedSourceBytes?: number
}

export function runBookletPreflight(input: BookletPreflightInput): PreflightReport {
  const issues: PreflightIssue[] = []
  if (input.pageCount <= 0) issues.push(error('pages-missing', 'Add pages before exporting.'))
  if (input.pageCount > 0 && input.pageCount % 4 !== 0) {
    issues.push(error('page-count', 'Booklet page count must be divisible by 4.'))
  }
  if (input.blankPageCount > 0) {
    issues.push(warning('blank-pages', `${input.blankPageCount} blank page(s) will be exported.`))
  }
  if (input.paperWidthMm <= 0 || input.paperHeightMm <= 0) {
    issues.push(error('paper-size', 'Paper width and height must be greater than zero.'))
  }
  if (!input.readingDirection) issues.push(error('reading-direction', 'Choose LTR or RTL.'))
  if (input.exportPath === '') issues.push(error('export-path', 'Choose a valid export path.'))
  if ((input.estimatedSourceBytes ?? 0) > 250 * 1024 * 1024) {
    issues.push(warning('large-pdf', 'Large source PDF: use Low-end PC mode and allow extra time.'))
  }
  return createPreflightReport('booklet', issues)
}

const error = (id: string, message: string): PreflightIssue => ({ id, message, severity: 'error' })
const warning = (id: string, message: string): PreflightIssue => ({
  id,
  message,
  severity: 'warning'
})
