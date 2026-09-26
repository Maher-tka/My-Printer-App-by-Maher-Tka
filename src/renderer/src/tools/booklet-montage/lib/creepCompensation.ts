import type { BookletSide, CreepPaperPreset, CreepSettings, CreepCompensationMode } from '../types'

export const MAX_CREEP_MM = 25
export const UNUSUALLY_HIGH_CREEP_MM = 5
export const MAX_PAPER_CALIPER_MM = 5
export const MAX_CALIBRATION_MULTIPLIER = 100
export const SIMPLE_CREEP_TOTAL_MM = 1.2

export const DEFAULT_CREEP_SETTINGS: CreepSettings = {
  enabled: false,
  mode: 'measured',
  measuredTotalCreepMm: 0,
  paperCaliperMm: 0,
  calibrationMultiplier: 1,
  manualTotalCreepMm: 0,
  distribution: 'linear',
  showOverlay: false,
  paperPresets: []
}

export type ImposedPageSide = 'left' | 'right'
export type SpinePosition = 'between-pages'

export interface CreepTranslationInput {
  pageSide: ImposedPageSide
  spinePosition: SpinePosition
  creepAmountMm: number
  enabled?: boolean
}

/**
 * Returns the number of nested physical sheets after booklet padding.
 * Passing an unpadded count is also safe because the final group is rounded up.
 */
export function calculateSheetCount(pageCount: number): number {
  const safePageCount = finiteNonNegative(pageCount)
  return Math.ceil(safePageCount / 4)
}

export function calculateBaseCreep(sheetCount: number, paperCaliperMm: number): number {
  const safeSheetCount = Math.max(0, Math.floor(finiteNonNegative(sheetCount)))
  const safeCaliper = finiteNonNegative(paperCaliperMm)

  if (safeSheetCount <= 1 || safeCaliper === 0) {
    return 0
  }

  return safeNumber((safeSheetCount - 1) * safeCaliper)
}

export function calculateEstimatedTotalCreep(
  sheetCount: number,
  paperCaliperMm: number,
  calibrationMultiplier: number
): number {
  const safeMultiplier = finitePositive(calibrationMultiplier, 1)
  return clampCreep(calculateBaseCreep(sheetCount, paperCaliperMm) * safeMultiplier)
}

export function calculateTotalCreep(settings: CreepSettings, sheetCount: number): number {
  if (!settings.enabled) {
    return 0
  }

  if (settings.mode === 'automatic') {
    return calculateEstimatedTotalCreep(
      sheetCount,
      settings.paperCaliperMm,
      settings.calibrationMultiplier
    )
  }

  return clampCreep(
    settings.mode === 'manual' ? settings.manualTotalCreepMm : settings.measuredTotalCreepMm
  )
}

export function getSimpleCreepToggleSettings(
  settings: CreepSettings,
  enabled: boolean,
  sheetCount: number
): CreepSettings {
  if (!enabled) {
    return { ...settings, enabled: false, showOverlay: false }
  }

  const enabledSettings = { ...settings, enabled: true }
  const configuredTotalCreepMm = calculateTotalCreep(enabledSettings, sheetCount)

  return configuredTotalCreepMm > 0
    ? { ...enabledSettings, showOverlay: true }
    : {
        ...enabledSettings,
        mode: 'measured',
        measuredTotalCreepMm: SIMPLE_CREEP_TOTAL_MM,
        showOverlay: true
      }
}

export function calculateCreepProgress(sheetIndex: number, sheetCount: number): number {
  const safeSheetCount = Math.max(0, Math.floor(finiteNonNegative(sheetCount)))

  if (safeSheetCount <= 1) {
    return 0
  }

  const safeIndex = Math.min(
    Math.max(0, Math.floor(finiteNonNegative(sheetIndex))),
    safeSheetCount - 1
  )
  return safeIndex / (safeSheetCount - 1)
}

export function calculateSheetCreep(
  sheetIndex: number,
  sheetCount: number,
  totalCreepMm: number
): number {
  return clampCreep(clampCreep(totalCreepMm) * calculateCreepProgress(sheetIndex, sheetCount))
}

/**
 * The imposed slot decides direction. Reading order is intentionally irrelevant:
 * left-slot artwork moves right and right-slot artwork moves left, toward the fold.
 */
export function getCreepTranslation({
  pageSide,
  spinePosition,
  creepAmountMm,
  enabled = true
}: CreepTranslationInput): number {
  if (!enabled || spinePosition !== 'between-pages') {
    return 0
  }

  const magnitude = clampCreep(creepAmountMm)
  return pageSide === 'left' ? magnitude : -magnitude
}

export function getSheetCreepMm(
  side: Pick<BookletSide, 'physicalSheetIndex' | 'physicalSheetCount'>,
  settings: CreepSettings
): number {
  return calculateSheetCreep(
    side.physicalSheetIndex,
    side.physicalSheetCount,
    calculateTotalCreep(settings, side.physicalSheetCount)
  )
}

export function getSlotCreepTranslationMm(
  side: Pick<BookletSide, 'physicalSheetIndex' | 'physicalSheetCount'>,
  pageSide: ImposedPageSide,
  settings: CreepSettings
): number {
  return getCreepTranslation({
    pageSide,
    spinePosition: 'between-pages',
    creepAmountMm: getSheetCreepMm(side, settings),
    enabled: settings.enabled
  })
}

export function normalizeCreepSettings(value?: Partial<CreepSettings> | null): CreepSettings {
  return {
    enabled: value?.enabled === true,
    mode: isCreepMode(value?.mode) ? value.mode : DEFAULT_CREEP_SETTINGS.mode,
    measuredTotalCreepMm: finiteNonNegativeOrDefault(
      value?.measuredTotalCreepMm,
      DEFAULT_CREEP_SETTINGS.measuredTotalCreepMm
    ),
    paperCaliperMm: finiteNonNegativeOrDefault(
      value?.paperCaliperMm,
      DEFAULT_CREEP_SETTINGS.paperCaliperMm
    ),
    calibrationMultiplier: finitePositive(
      value?.calibrationMultiplier,
      DEFAULT_CREEP_SETTINGS.calibrationMultiplier
    ),
    manualTotalCreepMm: finiteNonNegativeOrDefault(
      value?.manualTotalCreepMm,
      DEFAULT_CREEP_SETTINGS.manualTotalCreepMm
    ),
    distribution: 'linear',
    showOverlay: value?.showOverlay === true,
    ...(typeof value?.selectedPaperPresetId === 'string' && value.selectedPaperPresetId
      ? { selectedPaperPresetId: value.selectedPaperPresetId }
      : {}),
    paperPresets: normalizePaperPresets(value?.paperPresets)
  }
}

export function validateCreepSettings(settings: CreepSettings, sheetCount?: number): string[] {
  if (!settings.enabled) {
    return []
  }

  const errors: string[] = []

  if (settings.mode === 'measured') {
    validateTotalCreep(settings.measuredTotalCreepMm, 'Measured total creep', errors)
  } else if (settings.mode === 'manual') {
    validateTotalCreep(settings.manualTotalCreepMm, 'Manual maximum creep', errors)
  } else {
    if (!Number.isFinite(settings.paperCaliperMm) || settings.paperCaliperMm <= 0) {
      errors.push('Paper caliper must be greater than 0 mm in Automatic mode.')
    } else if (settings.paperCaliperMm > MAX_PAPER_CALIPER_MM) {
      errors.push(`Paper caliper must be ${MAX_PAPER_CALIPER_MM} mm or less.`)
    }

    if (!Number.isFinite(settings.calibrationMultiplier) || settings.calibrationMultiplier <= 0) {
      errors.push('Calibration multiplier must be greater than 0.')
    } else if (settings.calibrationMultiplier > MAX_CALIBRATION_MULTIPLIER) {
      errors.push(`Calibration multiplier must be ${MAX_CALIBRATION_MULTIPLIER} or less.`)
    }

    if (sheetCount !== undefined) {
      const rawEstimate =
        calculateBaseCreep(sheetCount, settings.paperCaliperMm) * settings.calibrationMultiplier
      if (Number.isFinite(rawEstimate) && rawEstimate > MAX_CREEP_MM) {
        errors.push(`Estimated total creep must be ${MAX_CREEP_MM} mm or less.`)
      }
    }
  }

  return errors
}

export function getCreepWarnings(settings: CreepSettings, sheetCount: number): string[] {
  if (!settings.enabled) {
    return []
  }

  const totalCreepMm = calculateTotalCreep(settings, sheetCount)
  return totalCreepMm >= UNUSUALLY_HIGH_CREEP_MM
    ? [
        `${totalCreepMm.toFixed(2)} mm creep is unusually high for this booklet. Please verify the measurement or calibration.`
      ]
    : []
}

function validateTotalCreep(value: number, label: string, errors: string[]): void {
  if (!Number.isFinite(value) || value < 0) {
    errors.push(`${label} must be 0 mm or greater.`)
  } else if (value > MAX_CREEP_MM) {
    errors.push(`${label} must be ${MAX_CREEP_MM} mm or less.`)
  }
}

function normalizePaperPresets(value: unknown): CreepPaperPreset[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== 'object') {
      return []
    }

    const preset = candidate as Partial<CreepPaperPreset>
    if (typeof preset.id !== 'string' || !preset.id || typeof preset.name !== 'string') {
      return []
    }

    const paperCaliperMm = finiteNonNegativeOrDefault(preset.paperCaliperMm, 0)
    const calibrationMultiplier = finitePositive(preset.calibrationMultiplier, 1)

    return [
      {
        id: preset.id,
        name: preset.name.trim() || 'Paper preset',
        paperCaliperMm,
        calibrationMultiplier,
        ...(typeof preset.machineName === 'string' && preset.machineName.trim()
          ? { machineName: preset.machineName.trim() }
          : {})
      }
    ]
  })
}

function isCreepMode(value: unknown): value is CreepCompensationMode {
  return value === 'measured' || value === 'automatic' || value === 'manual'
}

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

function finiteNonNegativeOrDefault(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback
}

function finitePositive(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback
}

function safeNumber(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

function clampCreep(value: number): number {
  return Math.min(MAX_CREEP_MM, finiteNonNegative(value))
}
