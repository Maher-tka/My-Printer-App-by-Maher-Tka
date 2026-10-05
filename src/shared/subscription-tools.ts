import type { LicenseSnapshot } from './licensing-types.js'

export const SUBSCRIPTION_TOOLS = [
  { id: 'card-montage', label: 'Business Card Montage' },
  { id: 'sequential-number', label: 'Sequential Number' },
  { id: 'booklet-montage', label: 'Booklet Montage' },
  { id: 'hardcover-cover', label: 'Hardcover Cover Sheet' },
  { id: 'cutter-montage', label: 'Cutter Montage' },
  { id: 'fast-print', label: 'Explorer Fast Print' }
] as const

export type SubscriptionToolId = (typeof SUBSCRIPTION_TOOLS)[number]['id']

export function canUseSubscriptionTool(license: LicenseSnapshot | null, toolId: string): boolean {
  if (!license?.canUsePaidTools) return false
  // Offline licenses and explicitly unlocked development builds retain their existing behavior.
  return license.allowedTools === undefined
    ? license.storageMode !== 'supabase'
    : license.allowedTools.includes(toolId as SubscriptionToolId)
}

export function productionAccessError(
  license: LicenseSnapshot,
  feature: 'paid-tools' | 'batch-exports',
  toolId?: string
): string | null {
  if (!license.features.includes(feature))
    return (
      license.integrityWarning ??
      (feature === 'batch-exports' && license.canUsePaidTools
        ? 'Batch exports are not included in your subscription.'
        : license.statusLabel)
    )
  if (toolId && !canUseSubscriptionTool(license, toolId))
    return 'This tool is not included in your subscription. Contact the owner to change access.'
  if (
    !toolId &&
    license.allowedTools &&
    SUBSCRIPTION_TOOLS.some((tool) => !license.allowedTools!.includes(tool.id))
  )
    return 'Choose an included tool before printing or exporting.'
  return null
}
