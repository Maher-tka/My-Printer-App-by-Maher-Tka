import type { LicenseFeature, LicenseSnapshot } from '../../../shared/licensing-types'
import type { PrinterTool } from '@/types/tools'

export interface ToolAccessState {
  isCheckingLicense: boolean
  isLicenseLocked: boolean
  licenseReason: string | null
}

export function getToolAccessState(
  tool: PrinterTool,
  licenseState: LicenseSnapshot | null,
  isCheckingLicense: boolean
): ToolAccessState {
  if (!tool.requiredFeature) {
    return {
      isCheckingLicense: false,
      isLicenseLocked: false,
      licenseReason: null
    }
  }

  if (isCheckingLicense && !licenseState) {
    return {
      isCheckingLicense: true,
      isLicenseLocked: false,
      licenseReason: 'Checking local license'
    }
  }

  if (canUseFeature(licenseState, tool.requiredFeature)) {
    return {
      isCheckingLicense: false,
      isLicenseLocked: false,
      licenseReason: null
    }
  }

  return {
    isCheckingLicense: false,
    isLicenseLocked: true,
    licenseReason: licenseState?.mode === 'expired' ? 'Trial expired' : 'License required'
  }
}

export function canUseFeature(
  licenseState: LicenseSnapshot | null,
  feature: LicenseFeature
): boolean {
  return licenseState?.features.includes(feature) ?? false
}

export function routeRequiresPaidAccess(route: string, tools: PrinterTool[]): boolean {
  return tools.some((tool) => tool.route === route && tool.requiredFeature === 'paid-tools')
}
