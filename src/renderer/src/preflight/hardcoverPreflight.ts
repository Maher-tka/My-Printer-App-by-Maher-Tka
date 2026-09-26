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
  paperWidthMm?: number
  paperHeightMm?: number
  bleedMm?: number
  hingeMm?: number
  includeCropMarks?: boolean
  sourceGeometryWarnings?: string[]
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
  if (
    (input.paperWidthMm ?? 0) > 0 &&
    (input.paperHeightMm ?? 0) > 0 &&
    (input.fullWidthMm > input.paperWidthMm! || input.fullHeightMm > input.paperHeightMm!)
  ) {
    issues.push(
      error(
        'cover-outside-sheet',
        `The ${input.fullWidthMm.toFixed(1)} × ${input.fullHeightMm.toFixed(1)} mm cover does not fit the ${input.paperWidthMm!.toFixed(1)} × ${input.paperHeightMm!.toFixed(1)} mm printer sheet.`,
        'Choose a larger sheet or reduce the board, spine, bands, bleed, or wrap dimensions.',
        'dimensions'
      )
    )
  }
  if ((input.bleedMm ?? 3) < 3) {
    issues.push(
      warning(
        'low-bleed',
        'Cover bleed is below 3 mm.',
        'Use at least 3 mm bleed for artwork that reaches the trimmed edge.',
        'production'
      )
    )
  }
  if (input.wrapMarginsMm.some((value) => value > 0 && value < 10)) {
    issues.push(
      warning(
        'small-wrap',
        'One or more hardcover wrap margins are below 10 mm.',
        'Confirm there is enough material to wrap and glue around the board.',
        'production'
      )
    )
  }
  if ((input.hingeMm ?? 1) < 1) {
    issues.push(
      warning(
        'small-hinge',
        'The hinge allowance is below 1 mm.',
        'Confirm the binding method and board spacing before printing.',
        'dimensions'
      )
    )
  }
  if (input.includeCropMarks === false && input.exportMode === 'print-final') {
    issues.push(
      warning(
        'cover-crop-marks-disabled',
        'Crop marks are disabled for the final print export.',
        'Enable crop marks when the cover sheet will be manually trimmed.',
        'output'
      )
    )
  }
  for (const [index, sourceWarning] of (input.sourceGeometryWarnings ?? []).entries()) {
    issues.push(
      warning(
        `source-pdf-geometry-${index + 1}`,
        sourceWarning,
        'Inspect the selected PDF page and its MediaBox, CropBox, BleedBox, and rotation.',
        'document'
      )
    )
  }
  return createPreflightReport('hardcover', issues)
}

const error = (
  id: string,
  message: string,
  recommendation?: string,
  category?: PreflightIssue['category']
): PreflightIssue => ({ id, message, severity: 'error', recommendation, category })
const warning = (
  id: string,
  message: string,
  recommendation?: string,
  category?: PreflightIssue['category']
): PreflightIssue => ({
  id,
  message,
  severity: 'warning',
  recommendation,
  category
})
