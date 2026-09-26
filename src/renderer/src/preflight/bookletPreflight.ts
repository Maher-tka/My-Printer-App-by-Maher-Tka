import { createPreflightReport, type PreflightIssue, type PreflightReport } from './preflightTypes'

export interface BookletPreflightInput {
  pageCount: number
  blankPageCount: number
  paperWidthMm: number
  paperHeightMm: number
  readingDirection?: 'ltr' | 'rtl'
  exportPath?: string | null
  estimatedSourceBytes?: number
  pageSizesMm?: Array<{ widthMm: number; heightMm: number; label?: string }>
  outerMarginMm?: number
  pageGapMm?: number
  cropMarks?: boolean
  registrationMarks?: boolean
  scaleMode?: 'fit' | 'original' | 'stretch'
}

export function runBookletPreflight(input: BookletPreflightInput): PreflightReport {
  const issues: PreflightIssue[] = []
  if (input.pageCount <= 0) issues.push(error('pages-missing', 'Add pages before exporting.'))
  if (input.pageCount > 0 && input.pageCount % 4 !== 0) {
    issues.push(error('page-count', 'Booklet page count must be divisible by 4.'))
  }
  if (input.blankPageCount > 0) {
    issues.push(
      warning(
        'blank-pages',
        `${input.blankPageCount} blank page(s) will be exported.`,
        'Confirm each blank page is intentional before production.',
        'document'
      )
    )
  }
  if (input.paperWidthMm <= 0 || input.paperHeightMm <= 0) {
    issues.push(error('paper-size', 'Paper width and height must be greater than zero.'))
  }
  if (!input.readingDirection) issues.push(error('reading-direction', 'Choose LTR or RTL.'))
  if (input.exportPath === '') issues.push(error('export-path', 'Choose a valid export path.'))
  if ((input.estimatedSourceBytes ?? 0) > 250 * 1024 * 1024) {
    issues.push(
      warning(
        'large-pdf',
        'Large source PDF: export may require extra memory and time.',
        'Use Low-end PC mode, close other applications, and verify the output PDF.',
        'quality'
      )
    )
  }
  const physicalPages = (input.pageSizesMm ?? []).filter(
    (page) => page.widthMm > 0 && page.heightMm > 0
  )
  const sizeGroups = new Set(
    physicalPages.map(
      (page) => `${Math.round(page.widthMm * 2) / 2}x${Math.round(page.heightMm * 2) / 2}`
    )
  )
  if (sizeGroups.size > 1) {
    issues.push(
      warning(
        'mixed-page-sizes',
        `The document contains ${sizeGroups.size} different physical page sizes.`,
        'Check the sheet preview for unexpected scaling or cropping.',
        'dimensions',
        physicalPages
          .filter((page) => page.label)
          .slice(0, 8)
          .map((page) => page.label!)
      )
    )
  }
  if ((input.outerMarginMm ?? 3) < 3) {
    issues.push(
      warning(
        'narrow-outer-margin',
        'Outer margin is below 3 mm and may fall outside the printer imageable area.',
        'Use at least 3 mm, or confirm the selected printer supports borderless output.',
        'production'
      )
    )
  }
  if ((input.pageGapMm ?? 2) < 2) {
    issues.push(
      warning(
        'narrow-page-gap',
        'The gap between imposed pages is below 2 mm.',
        'Increase the page gap to leave room for folding and trimming variation.',
        'production'
      )
    )
  }
  if (input.cropMarks === false) {
    issues.push(
      warning(
        'crop-marks-disabled',
        'Crop marks are disabled.',
        'Enable crop marks when the booklet will be trimmed after printing.',
        'output'
      )
    )
  }
  if (input.scaleMode === 'stretch') {
    issues.push(
      warning(
        'stretched-pages',
        'Stretch scaling can distort artwork and text.',
        'Prefer Fit unless intentional distortion is required.',
        'quality'
      )
    )
  }
  return createPreflightReport('booklet', issues)
}

const error = (id: string, message: string): PreflightIssue => ({ id, message, severity: 'error' })
const warning = (
  id: string,
  message: string,
  recommendation?: string,
  category?: PreflightIssue['category'],
  affectedItems?: string[]
): PreflightIssue => ({
  id,
  message,
  severity: 'warning',
  recommendation,
  category,
  affectedItems
})
