import { createPreflightReport, type PreflightIssue, type PreflightReport } from './preflightTypes'

export interface SharedCutterPreflightInput {
  sheetWidth: number
  sheetHeight: number
  placedCount: number
  outOfBoundsCount: number
  overlapCount: number
  missingArtworkCount: number
  missingCutlineCount: number
  hiddenCutlineCount: number
  missingSourceCount: number
  exportMode: 'print-cut' | 'print-only' | 'cut-only'
}

export function runSharedCutterPreflight(input: SharedCutterPreflightInput): PreflightReport {
  const issues: PreflightIssue[] = []
  if (input.sheetWidth <= 0 || input.sheetHeight <= 0)
    issues.push(error('sheet-size', 'Sheet size must be greater than zero.'))
  if (input.placedCount <= 0)
    issues.push(error('pieces-missing', 'Place at least one piece on the sheet.'))
  if (input.outOfBoundsCount)
    issues.push(
      error('outside-artboard', `${input.outOfBoundsCount} piece(s) are outside the artboard.`)
    )
  if (input.overlapCount)
    issues.push(error('overlap', `${input.overlapCount} overlap(s) detected.`))
  if (input.missingArtworkCount)
    issues.push(error('artwork', `${input.missingArtworkCount} piece(s) have no artwork.`))
  if (input.exportMode === 'print-cut' && input.missingCutlineCount)
    issues.push(
      error('cutline', `${input.missingCutlineCount} piece(s) have no vector CutContour.`)
    )
  if (input.hiddenCutlineCount)
    issues.push(warning('hidden-cutline', 'One or more CutContour objects are hidden.'))
  if (input.missingSourceCount)
    issues.push(error('source-file', 'One or more source artwork files are missing.'))
  return createPreflightReport('cutter', issues)
}

const error = (id: string, message: string): PreflightIssue => ({ id, message, severity: 'error' })
const warning = (id: string, message: string): PreflightIssue => ({
  id,
  message,
  severity: 'warning'
})
