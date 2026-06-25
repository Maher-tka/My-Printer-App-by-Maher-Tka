import { createPreflightReport, type PreflightIssue, type PreflightReport } from './preflightTypes'

export interface HardcoverPreflightInput {
  bookWidthMm: number
  bookHeightMm: number
  spineWidthMm: number
  wrapMarginsMm: number[]
  fullWidthMm: number
  fullHeightMm: number
  title: string
  studentName: string
  studentNameRequired?: boolean
  spineTextFits: boolean
  textInsideSafeZones: boolean
  exportMode?: string
}

export function runHardcoverPreflight(input: HardcoverPreflightInput): PreflightReport {
  const issues: PreflightIssue[] = []
  if (input.bookWidthMm <= 0 || input.bookHeightMm <= 0)
    issues.push(error('book-size', 'Book width and height must be greater than zero.'))
  if (input.spineWidthMm <= 0)
    issues.push(error('spine-size', 'Spine thickness must be greater than zero.'))
  if (input.wrapMarginsMm.some((value) => value < 0))
    issues.push(error('wrap-margin', 'Wrap margins cannot be negative.'))
  if (input.fullWidthMm <= 0 || input.fullHeightMm <= 0)
    issues.push(error('full-cover-size', 'Full cover dimensions are invalid.'))
  if (!input.title.trim()) issues.push(error('title', 'Project title is required.'))
  if (input.studentNameRequired && !input.studentName.trim())
    issues.push(error('student-name', 'Student name is required.'))
  if (!input.spineTextFits)
    issues.push(warning('spine-fit', 'Spine text may not fit at the selected size.'))
  if (!input.textInsideSafeZones)
    issues.push(warning('safe-zone', 'Some text may be outside the safe zones.'))
  if (!input.exportMode) issues.push(error('export-mode', 'Choose a final export mode.'))
  return createPreflightReport('hardcover', issues)
}

const error = (id: string, message: string): PreflightIssue => ({ id, message, severity: 'error' })
const warning = (id: string, message: string): PreflightIssue => ({
  id,
  message,
  severity: 'warning'
})
