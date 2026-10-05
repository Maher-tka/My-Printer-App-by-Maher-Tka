import { CUT_CONTOUR_COLOR, CUT_CONTOUR_NAME, normalizeSpotName } from './colorSpot'
import type { CutterExportSettings, CutterSheetSettings } from '../types'

export type CutterExportPresetId =
  | 'illustrator-print-cut-svg'
  | 'layered-print-cut-pdf'
  | 'mimaki-cutcontour-svg'
  | 'pdf-print-only'
  | 'svg-eps-cut-only'
  | 'customer-preview'

export type CutterContourRenderKind = 'none' | 'production' | 'preview'

export interface CutterExportSemantics {
  intent: 'print-only' | 'customer-preview' | 'production-vector'
  isPrintOnly: boolean
  isCustomerPreview: boolean
  isProductionVectorHandoff: boolean
  contourRenderKind: CutterContourRenderKind
}

/**
 * Keep the three production surfaces explicit. A user can load older projects
 * with stale preset/mode combinations, so an explicit mode wins over a
 * preset; the preset is used only for projects that predate `mode`.
 */
export function getCutterExportSemantics(settings: CutterExportSettings): CutterExportSemantics {
  const mode = settings.mode
  const preset = settings.preset
  const isPrintOnly = mode === 'print-only' || (!mode && preset === 'pdf-print-only')
  const isCustomerPreview = mode === 'customer-preview' || (!mode && preset === 'customer-preview')
  const isProductionVectorHandoff = !isPrintOnly && !isCustomerPreview
  const contourRenderKind: CutterContourRenderKind =
    !settings.includeCutlines || isPrintOnly ? 'none' : isCustomerPreview ? 'preview' : 'production'

  return {
    intent: isPrintOnly
      ? 'print-only'
      : isCustomerPreview
        ? 'customer-preview'
        : 'production-vector',
    isPrintOnly,
    isCustomerPreview,
    isProductionVectorHandoff,
    contourRenderKind
  }
}

export const CUSTOMER_PREVIEW_CONTOUR_COLOR = '#f97316'
export const CUSTOMER_PREVIEW_CONTOUR_DASH = '6 3'
export const CUSTOMER_PREVIEW_CONTOUR_LABEL = 'Customer preview contour (not for production)'

export interface CutterExportPreset {
  id: CutterExportPresetId
  title: string
  detail: string
  output: 'svg' | 'pdf' | 'eps' | 'pdf-preview'
  settings: CutterExportSettings
}

export const CUTTER_EXPORT_PRESETS: CutterExportPreset[] = [
  {
    id: 'layered-print-cut-pdf',
    title: 'Illustrator Print + Cut PDF',
    detail:
      'Native Illustrator layers: artwork, hidden CutContour and separate registration marks. Requires Illustrator.',
    output: 'pdf',
    settings: {
      strokeName: CUT_CONTOUR_NAME,
      includeArtwork: true,
      includeCutlines: true,
      includeRegistrationMarks: true,
      includeProductionLabel: false,
      mode: 'print-cut',
      preset: 'layered-print-cut-pdf'
    }
  },
  {
    id: 'illustrator-print-cut-svg',
    title: 'Mimaki Marked Print + Cut SVG',
    detail: 'Artwork, app-generated Mimaki Type 1 marks, and vector CutContour',
    output: 'svg',
    settings: {
      strokeName: CUT_CONTOUR_NAME,
      includeArtwork: true,
      includeCutlines: true,
      includeRegistrationMarks: true,
      includeProductionLabel: false,
      mode: 'print-cut',
      preset: 'illustrator-print-cut-svg'
    }
  },
  {
    id: 'mimaki-cutcontour-svg',
    title: 'Mimaki Type 1 + CutContour SVG',
    detail: 'Mimaki-ready marked artwork with magenta vector CutContour',
    output: 'svg',
    settings: {
      strokeName: CUT_CONTOUR_NAME,
      includeArtwork: true,
      includeCutlines: true,
      includeRegistrationMarks: true,
      includeProductionLabel: false,
      mode: 'print-cut',
      preset: 'mimaki-cutcontour-svg'
    }
  },
  {
    id: 'pdf-print-only',
    title: 'Mimaki Marked Print PDF',
    detail: 'Printable artwork with automatic Mimaki Type 1 marks and no CutContour',
    output: 'pdf',
    settings: {
      strokeName: CUT_CONTOUR_NAME,
      includeArtwork: true,
      includeCutlines: false,
      includeRegistrationMarks: true,
      includeProductionLabel: true,
      mode: 'print-only',
      preset: 'pdf-print-only'
    }
  },
  {
    id: 'svg-eps-cut-only',
    title: 'Cut-only SVG/EPS',
    detail: 'Vector CutContour only; no cutter marks',
    output: 'eps',
    settings: {
      strokeName: CUT_CONTOUR_NAME,
      includeArtwork: false,
      includeCutlines: true,
      includeRegistrationMarks: false,
      includeProductionLabel: false,
      mode: 'cut-only',
      preset: 'svg-eps-cut-only'
    }
  },
  {
    id: 'customer-preview',
    title: 'Customer Preview PDF',
    detail: 'Artwork with visible preview cutline and label',
    output: 'pdf-preview',
    settings: {
      strokeName: CUT_CONTOUR_NAME,
      includeArtwork: true,
      includeCutlines: true,
      includeRegistrationMarks: false,
      includeProductionLabel: true,
      mode: 'customer-preview',
      preset: 'customer-preview'
    }
  }
]

export function getDefaultCutterExportSettings(): CutterExportSettings {
  return { ...CUTTER_EXPORT_PRESETS[0].settings }
}

export function normalizeCutterExportSettings(
  settings: Partial<CutterExportSettings> | undefined,
  sheet: CutterSheetSettings
): CutterExportSettings {
  const merged = {
    ...getDefaultCutterExportSettings(),
    ...settings,
    strokeName: normalizeSpotName(settings?.strokeName ?? CUT_CONTOUR_NAME)
  }
  const supportsPrintedMarks =
    merged.mode === 'print-cut' ||
    merged.mode === 'print-only' ||
    merged.preset === 'illustrator-print-cut-svg' ||
    merged.preset === 'mimaki-cutcontour-svg' ||
    merged.preset === 'pdf-print-only'
  const isLegacyFineCutProject = sheet.registrationMarks?.profileVersion !== 1

  return {
    ...merged,
    includeRegistrationMarks:
      supportsPrintedMarks && isLegacyFineCutProject ? true : merged.includeRegistrationMarks
  }
}

export function applyCutterExportPreset(
  presetId: CutterExportPresetId,
  _currentSheet: CutterSheetSettings
): {
  exportSettings: CutterExportSettings
  sheetPatch: Partial<CutterSheetSettings>
} {
  const preset =
    CUTTER_EXPORT_PRESETS.find((item) => item.id === presetId) ?? CUTTER_EXPORT_PRESETS[0]
  return {
    exportSettings: {
      ...preset.settings,
      strokeName: normalizeSpotName(preset.settings.strokeName)
    },
    sheetPatch: {}
  }
}

export function getExportPresetForMode(
  mode: NonNullable<CutterExportSettings['mode']>
): CutterExportPresetId {
  if (mode === 'print-only') return 'pdf-print-only'
  if (mode === 'cut-only' || mode === 'test-cut') return 'svg-eps-cut-only'
  if (mode === 'customer-preview') return 'customer-preview'
  return 'illustrator-print-cut-svg'
}

export function getCutContourPresetPatch(): Partial<CutterExportSettings> {
  return {
    strokeName: CUT_CONTOUR_NAME,
    includeCutlines: true
  }
}

export const MIMAKI_CUTLINE_COLOR = CUT_CONTOUR_COLOR
