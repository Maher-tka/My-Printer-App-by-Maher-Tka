import layoutDefinitions from './fast-print-layouts.json' with { type: 'json' }

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
  duplex?: boolean
  mode?: 'id-card' | 'polaroid-8' | 'polaroid-9' | 'document'
  paperWidthMm?: number
  paperHeightMm?: number
  fitToFrame?: boolean
  combineImages?: boolean
}

export interface FastPrintBatchSource {
  previewOnly?: boolean
  name: string
  files: Array<{ name: string; extension: string }>
  preset: FastPrintPreset
  canDuplex?: boolean
  canColor?: boolean
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
    (p.duplex !== undefined && typeof p.duplex !== 'boolean') ||
    (p.fitToFrame !== undefined && typeof p.fitToFrame !== 'boolean') ||
    (p.combineImages !== undefined && typeof p.combineImages !== 'boolean') ||
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
    ...(p.duplex !== undefined ? { duplex: p.duplex } : {}),
    ...(p.fitToFrame !== undefined ? { fitToFrame: p.fitToFrame } : {}),
    ...(p.combineImages !== undefined ? { combineImages: p.combineImages } : {}),
    ...(p.mode ? { mode: p.mode } : {})
  }
}

/** A shared grid definition is also compiled into the native preview. */
export function fastPrintLayout(preset: FastPrintPreset, dpi = 200) {
  const paper = preset.paper === 'A3' ? [297, 420] : [210, 297]
  const grid = FAST_PRINT_LAYOUTS.find((layout) => layout.count === preset.pagesPerSheet)!
  const landscape = grid.landscape || preset.landscape === true
  const width = Math.round(((landscape ? paper[1] : paper[0]) / 25.4) * dpi)
  const height = Math.round(((landscape ? paper[0] : paper[1]) / 25.4) * dpi)
  const { columns, rows } = grid
  const gap = Math.round((3 / 25.4) * dpi)
  return {
    width,
    height,
    columns,
    rows,
    gap,
    cellWidth: (width - gap * (columns - 1)) / columns,
    cellHeight: (height - gap * (rows - 1)) / rows
  }
}
