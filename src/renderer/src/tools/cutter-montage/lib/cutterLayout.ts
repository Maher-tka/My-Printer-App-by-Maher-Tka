import type {
  CutterProductionLabelSettings,
  CutterRegistrationSettings,
  CutterSheetSettings
} from '../types'
import {
  MAX_PRODUCTION_SHEET_HEIGHT_CM,
  MAX_VINYL_ROLL_WIDTH_CM,
  MIN_PRODUCTION_SHEET_HEIGHT_CM,
  PREFERRED_PRODUCTION_SHEET_HEIGHT_CM,
  PRODUCTION_SHEET_WIDTH_CM
} from './productionSheets'
import { roundToStep } from './units'

export const DEFAULT_REGISTRATION_MARKS: CutterRegistrationSettings = {
  profileVersion: 1,
  enabled: true,
  type: 'mimaki',
  sizeMm: 10,
  marginMm: 0,
  color: '#000000',
  includeIn: 'artwork'
}

export const DEFAULT_PRODUCTION_LABEL: CutterProductionLabelSettings = {
  enabled: false,
  position: 'bottom-left',
  size: 'small',
  placement: 'margin'
}

export const DEFAULT_CUTTER_SHEET: CutterSheetSettings = {
  widthCm: PRODUCTION_SHEET_WIDTH_CM,
  heightCm: PREFERRED_PRODUCTION_SHEET_HEIGHT_CM,
  rollWidthCm: MAX_VINYL_ROLL_WIDTH_CM,
  unit: 'cm',
  safeMarginCm: 1.5,
  spacingMm: 3,
  snapToGrid: true,
  gridStepCm: 0.5,
  allowRotation: true,
  preserveManualPositions: false,
  showGrid: true,
  showSafeArea: true,
  showRollGuides: true,
  registrationMarks: DEFAULT_REGISTRATION_MARKS,
  productionLabel: DEFAULT_PRODUCTION_LABEL,
  preferSameDesignGrouping: true,
  fillDirection: 'left-to-right',
  sortStrategy: 'largest-first',
  lengthMode: 'auto-trim-last'
}

export function normalizeCutterSheetSettings(settings: CutterSheetSettings): CutterSheetSettings {
  const requestedHeightCm = Number.isFinite(settings.heightCm)
    ? settings.heightCm
    : PREFERRED_PRODUCTION_SHEET_HEIGHT_CM
  const migratedHeightCm =
    requestedHeightCm < MIN_PRODUCTION_SHEET_HEIGHT_CM
      ? PREFERRED_PRODUCTION_SHEET_HEIGHT_CM
      : requestedHeightCm
  const suppliedMarks = settings.registrationMarks
  const usesOldDisabledFineCutDefaults = Boolean(
    suppliedMarks &&
    !suppliedMarks.enabled &&
    suppliedMarks.type === 'mimaki' &&
    suppliedMarks.sizeMm === 8 &&
    suppliedMarks.marginMm === 8 &&
    suppliedMarks.includeIn === 'registration'
  )

  return {
    ...DEFAULT_CUTTER_SHEET,
    ...settings,
    widthCm: PRODUCTION_SHEET_WIDTH_CM,
    heightCm: clampSheetHeight(migratedHeightCm),
    rollWidthCm: MAX_VINYL_ROLL_WIDTH_CM,
    registrationMarks: {
      ...DEFAULT_REGISTRATION_MARKS,
      ...(usesOldDisabledFineCutDefaults ? {} : suppliedMarks)
    },
    productionLabel: {
      ...DEFAULT_PRODUCTION_LABEL,
      ...settings.productionLabel
    }
  }
}

export function getSheetWarnings(settings: CutterSheetSettings): string[] {
  const warnings: string[] = []

  if (settings.widthCm !== PRODUCTION_SHEET_WIDTH_CM) {
    warnings.push('Artwork nesting width is capped at 96 cm.')
  }
  if (settings.heightCm > MAX_PRODUCTION_SHEET_HEIGHT_CM) {
    warnings.push('Production sheet length cannot exceed 140 cm.')
  } else if (settings.heightCm > PREFERRED_PRODUCTION_SHEET_HEIGHT_CM) {
    warnings.push(
      `Long production sheet: ${settings.heightCm} cm. 100 cm is preferred for easier feeding and handling.`
    )
  }

  return warnings
}

export function clampSheetHeight(heightCm: number): number {
  if (!Number.isFinite(heightCm)) return PREFERRED_PRODUCTION_SHEET_HEIGHT_CM
  return Math.max(
    MIN_PRODUCTION_SHEET_HEIGHT_CM,
    Math.min(heightCm, MAX_PRODUCTION_SHEET_HEIGHT_CM)
  )
}

export function calculateDraggedSheetHeight(
  startHeightCm: number,
  pointerDeltaPx: number,
  pixelsPerCm: number,
  snapStepCm: number
): number {
  const safeScale = Number.isFinite(pixelsPerCm) && pixelsPerCm > 0 ? pixelsPerCm : 1
  const safeStep = Number.isFinite(snapStepCm) && snapStepCm > 0 ? snapStepCm : 0.5
  const nextHeightCm = startHeightCm + pointerDeltaPx / safeScale

  return clampSheetHeight(roundToStep(nextHeightCm, safeStep))
}

export function clampSheetWidth(_widthCm: number): number {
  return PRODUCTION_SHEET_WIDTH_CM
}

export function getSafeArea(settings: CutterSheetSettings): {
  xCm: number
  yCm: number
  widthCm: number
  heightCm: number
} {
  const verticalMargin = Math.max(settings.safeMarginCm, 0)
  const horizontalMargin = Math.max(settings.safeMarginCm, 0)

  return {
    xCm: horizontalMargin,
    yCm: verticalMargin,
    widthCm: Math.max(settings.widthCm - horizontalMargin * 2, 1),
    heightCm: Math.max(settings.heightCm - verticalMargin * 2, 1)
  }
}
