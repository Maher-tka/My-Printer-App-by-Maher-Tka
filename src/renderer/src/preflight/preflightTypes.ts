export type PreflightSeverity = 'warning' | 'error'

export interface PreflightIssue {
  id: string
  severity: PreflightSeverity
  message: string
}

export interface PreflightReport {
  tool: 'booklet' | 'cutter' | 'hardcover'
  issues: PreflightIssue[]
  errors: PreflightIssue[]
  warnings: PreflightIssue[]
  status: 'passed' | 'warnings' | 'errors'
  canExport: boolean
}

export function createPreflightReport(
  tool: PreflightReport['tool'],
  issues: PreflightIssue[]
): PreflightReport {
  const errors = issues.filter((issue) => issue.severity === 'error')
  const warnings = issues.filter((issue) => issue.severity === 'warning')
  return {
    tool,
    issues,
    errors,
    warnings,
    status: errors.length ? 'errors' : warnings.length ? 'warnings' : 'passed',
    canExport: errors.length === 0
  }
}
