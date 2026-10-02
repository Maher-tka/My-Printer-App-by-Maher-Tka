export interface FastPrintPreset {
  printer: string
  paper: 'A4' | 'A3'
  color: boolean
  pagesPerSheet: 1 | 2 | 4
  profileId?: string
  profileName?: string
  landscape?: boolean
  duplex?: boolean
}

export interface FastPrintBatchSource {
  name: string
  files: Array<{ name: string; extension: string }>
  preset: FastPrintPreset
}

export interface FastPrintSource {
  name: string
  extension: string
  bytes: Uint8Array
  preset: FastPrintPreset
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
    ![1, 2, 4].includes(p.pagesPerSheet ?? 0) ||
    (p.profileId !== undefined &&
      (typeof p.profileId !== 'string' || !/^[a-f0-9]{32}$/.test(p.profileId))) ||
    (p.landscape !== undefined && typeof p.landscape !== 'boolean')
  ) {
    throw new Error('Invalid Fast Print preset. Refresh the Explorer menu and try again.')
  }
  return {
    printer: p.printer,
    paper: p.paper!,
    color: p.color,
    pagesPerSheet: p.pagesPerSheet!,
    ...(p.profileId ? { profileId: p.profileId } : {}),
    ...(p.landscape !== undefined ? { landscape: p.landscape } : {})
  }
}

/** Two-up uses landscape paper; four-up reads left to right, top to bottom. */
export function fastPrintLayout(preset: FastPrintPreset, dpi = 200) {
  const paper = preset.paper === 'A3' ? [297, 420] : [210, 297]
  const landscape = preset.pagesPerSheet === 2 || preset.landscape === true
  const width = Math.round(((landscape ? paper[1] : paper[0]) / 25.4) * dpi)
  const height = Math.round(((landscape ? paper[0] : paper[1]) / 25.4) * dpi)
  const columns = preset.pagesPerSheet === 1 ? 1 : 2
  const rows = preset.pagesPerSheet === 4 ? 2 : 1
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
