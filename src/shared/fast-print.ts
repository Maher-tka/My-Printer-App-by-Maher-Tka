import layoutDefinitions from './fast-print-layouts.json' with { type: 'json' }
import type { IdPrintDraft } from './fast-print-id.js'

export type FastPrintPagesPerSheet = 1 | 2 | 4 | 6 | 8 | 9 | 12 | 16
export const FAST_PRINT_LAYOUTS = layoutDefinitions as Array<{
  count: FastPrintPagesPerSheet
  columns: number
  rows: number
  landscape: boolean
}>
export const FAST_PRINT_COUNTS = FAST_PRINT_LAYOUTS.map((layout) => layout.count)

export interface FastPrintPreset {
  printer: string
  paper: 'A4' | 'A3'
  color: boolean
  pagesPerSheet: FastPrintPagesPerSheet
  profileId?: string
  profileName?: string
  landscape?: boolean
  autoOrientation?: boolean
  matchLayoutOrientation?: boolean
  duplex?: boolean
  mode?: 'id-card' | 'polaroid-8' | 'polaroid-9' | 'document'
  paperWidthMm?: number
  paperHeightMm?: number
  fitToFrame?: boolean
  combineImages?: boolean
  combineFiles?: boolean
  marginMm?: number
  gapMm?: number
  sourceRotations?: number[]
}

export interface FastPrintBatchSource {
  printers?: FastPrintPrinter[]
  canReturnToSettings?: boolean
  idDraft?: IdPrintDraft
  previewOnly?: boolean
  preparedPolaroid?: { photos: number; sheets: number }
  name: string
  files: Array<{ name: string; extension: string }>
  preset: FastPrintPreset
  canDuplex?: boolean
  canColor?: boolean
}

export interface FastPrintPrinter {
  name: string
  papers: string[]
  color: boolean
  duplex?: boolean
}

export interface IdPrinterSelection {
  preset: FastPrintPreset
  canColor: boolean
  canDuplex: boolean
}

export interface FastPrintSource {
  name: string
  extension: string
  bytes: Uint8Array
  preset: FastPrintPreset
}

export interface FastPrintSubmitOptions {
  color: boolean
  duplex: boolean
  idsPerSheet?: number
  manualDuplexPrompt?: { message: string; title: string; rtl: boolean }
}

export function validateFastPrintPreset(value: unknown): FastPrintPreset {
  const p = value as Partial<FastPrintPreset> | null
  if (
    !p ||
    typeof p.printer !== 'string' ||
    !p.printer.trim() ||
    p.printer.length > 512 ||
    !['A4', 'A3'].includes(p.paper ?? '') ||
    typeof p.color !== 'boolean' ||
    !FAST_PRINT_COUNTS.includes(p.pagesPerSheet as FastPrintPagesPerSheet) ||
    (p.profileId !== undefined &&
      (typeof p.profileId !== 'string' || !/^[a-f0-9]{32}$/.test(p.profileId))) ||
    (p.landscape !== undefined && typeof p.landscape !== 'boolean') ||
    (p.autoOrientation !== undefined && typeof p.autoOrientation !== 'boolean') ||
    (p.matchLayoutOrientation !== undefined && typeof p.matchLayoutOrientation !== 'boolean') ||
    (p.duplex !== undefined && typeof p.duplex !== 'boolean') ||
    (p.fitToFrame !== undefined && typeof p.fitToFrame !== 'boolean') ||
    (p.combineImages !== undefined && typeof p.combineImages !== 'boolean') ||
    (p.combineFiles !== undefined && typeof p.combineFiles !== 'boolean') ||
    (p.marginMm !== undefined &&
      (!Number.isInteger(p.marginMm) || p.marginMm < 5 || p.marginMm > 20)) ||
    (p.gapMm !== undefined && (!Number.isInteger(p.gapMm) || p.gapMm < 3 || p.gapMm > 10)) ||
    (p.sourceRotations !== undefined &&
      (!Array.isArray(p.sourceRotations) ||
        p.sourceRotations.length > 1000 ||
        p.sourceRotations.some((turn) => !Number.isInteger(turn) || turn < 0 || turn > 3))) ||
    (p.mode !== undefined &&
      !['id-card', 'polaroid-8', 'polaroid-9', 'document'].includes(p.mode)) ||
    (p.mode === 'document' && (!p.profileId || p.pagesPerSheet !== 1)) ||
    (p.mode?.startsWith('polaroid-') && (p.paper !== 'A4' || p.pagesPerSheet !== 1)) ||
    (p.mode === 'id-card' && p.pagesPerSheet !== 1)
  ) {
    throw new Error('Invalid Fast Print preset. Refresh the Explorer menu and try again.')
  }
  return {
    printer: p.printer,
    paper: p.paper!,
    color: p.color,
    pagesPerSheet: p.pagesPerSheet!,
    ...(p.profileId ? { profileId: p.profileId } : {}),
    ...(p.landscape !== undefined ? { landscape: p.landscape } : {}),
    ...(p.autoOrientation !== undefined ? { autoOrientation: p.autoOrientation } : {}),
    ...(p.matchLayoutOrientation !== undefined
      ? { matchLayoutOrientation: p.matchLayoutOrientation }
      : {}),
    ...(p.duplex !== undefined ? { duplex: p.duplex } : {}),
    ...(p.fitToFrame !== undefined ? { fitToFrame: p.fitToFrame } : {}),
    ...(p.combineImages !== undefined ? { combineImages: p.combineImages } : {}),
    ...(p.combineFiles !== undefined ? { combineFiles: p.combineFiles } : {}),
    ...(p.marginMm !== undefined ? { marginMm: p.marginMm } : {}),
    ...(p.gapMm !== undefined ? { gapMm: p.gapMm } : {}),
    ...(p.sourceRotations !== undefined ? { sourceRotations: [...p.sourceRotations] } : {}),
    ...(p.mode ? { mode: p.mode } : {})
  }
}

/** A shared grid definition is also compiled into the native preview. */
export function fastPrintLayout(preset: FastPrintPreset, dpi = 200) {
  const paper = preset.paper === 'A3' ? [297, 420] : [210, 297]
  const grid = FAST_PRINT_LAYOUTS.find((layout) => layout.count === preset.pagesPerSheet)!
  const landscape = preset.landscape ?? grid.landscape
  const width = Math.round(((landscape ? paper[1] : paper[0]) / 25.4) * dpi)
  const height = Math.round(((landscape ? paper[0] : paper[1]) / 25.4) * dpi)
  const transpose = preset.pagesPerSheet > 1 && landscape !== grid.landscape
  const columns = transpose ? grid.rows : grid.columns
  const rows = transpose ? grid.columns : grid.rows
  const gap = Math.round(((preset.gapMm ?? 3) / 25.4) * dpi)
  const margin = Math.round(((preset.marginMm ?? 5) / 25.4) * dpi)
  return {
    width,
    height,
    columns,
    rows,
    gap,
    margin,
    cellWidth: (width - 2 * margin - gap * (columns - 1)) / columns,
    cellHeight: (height - 2 * margin - gap * (rows - 1)) / rows
  }
}

/** Align to the preset first; manual quarter-turns remain an independent override. */
export function fastPrintContentTurns(
  preset: FastPrintPreset,
  layout: ReturnType<typeof fastPrintLayout>,
  width: number,
  height: number,
  manualTurns: number
) {
  const align =
    preset.matchLayoutOrientation &&
    preset.pagesPerSheet > 1 &&
    !preset.mode &&
    width !== height &&
    width > height !== layout.cellWidth > layout.cellHeight
      ? 1
      : 0
  return (align + manualTurns) % 4
}

/** Full-page original orientation follows the visible PDF/image dimensions. */
export function fastPrintSourceLayout(
  preset: FastPrintPreset,
  width: number,
  height: number,
  dpi = 200
) {
  return fastPrintLayout(
    preset.autoOrientation && preset.pagesPerSheet === 1 && !preset.mode
      ? { ...preset, landscape: width > height }
      : preset,
    dpi
  )
}

/** Keep cell sizes fixed while centering an incomplete final sheet and row. */
export function fastPrintCell(
  layout: ReturnType<typeof fastPrintLayout>,
  slot: number,
  occupied: number
) {
  const row = Math.floor(slot / layout.columns),
    rowCount = Math.min(layout.columns, occupied - row * layout.columns),
    usedRows = Math.ceil(occupied / layout.columns)
  return {
    x:
      layout.margin +
      ((layout.columns - rowCount) * (layout.cellWidth + layout.gap)) / 2 +
      (slot % layout.columns) * (layout.cellWidth + layout.gap),
    y:
      layout.margin +
      ((layout.rows - usedRows) * (layout.cellHeight + layout.gap)) / 2 +
      row * (layout.cellHeight + layout.gap),
    width: layout.cellWidth,
    height: layout.cellHeight
  }
}
