import { FAST_PRINT_COUNTS, type FastPrintPreset } from './fast-print.js'

export interface PrintingOption {
  id: string
  label: string
  paper?: 'A4' | 'A3'
  color?: boolean
}
export const PRINTING_OPTIONS: PrintingOption[] = [
  { id: 'polaroid-8', label: 'Polaroid — 8 PIC', paper: 'A4', color: true },
  { id: 'polaroid-9', label: 'Polaroid — 9 PIC', paper: 'A4', color: true },
  ...(['A4', 'A3'] as const).flatMap((paper) =>
    [true, false].flatMap((color) => [
      ...FAST_PRINT_COUNTS.map((count) => ({
        id: `fast:${paper}:${color ? 'color' : 'mono'}:${count}`,
        label: `${paper} · ${color ? 'Color' : 'Black & white'} · ${count} per sheet`,
        paper,
        color
      })),
      {
        id: `id:${paper}:${color ? 'color' : 'mono'}`,
        label: `ID card · ${paper} · ${color ? 'Color' : 'Black & white'}`,
        paper,
        color
      }
    ])
  ),
  { id: 'app-print', label: 'Other app printing' },
  { id: 'tool:booklet-montage', label: 'Booklet Montage' },
  { id: 'tool:card-montage', label: 'Business Card Montage' },
  { id: 'tool:sequential-number', label: 'Sequential Number' },
  { id: 'tool:hardcover-cover', label: 'Hardcover Cover Sheet' },
  { id: 'tool:cutter-montage', label: 'Cutter Montage' }
]

export interface PrinterPreferences {
  version: 1
  defaultPrinter: string | null
  optionPrinters: Record<string, string>
  profiles: Record<string, Record<string, string>>
}
export function emptyPrinterPreferences(): PrinterPreferences {
  return { version: 1, defaultPrinter: null, optionPrinters: {}, profiles: {} }
}
const record = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const printerName = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.trim().length > 0 &&
  value.length <= 512 &&
  !/[\x00-\x1f]/.test(value)
export function validatePrinterPreferences(value: unknown): PrinterPreferences {
  if (
    !record(value) ||
    value.version !== 1 ||
    (value.defaultPrinter !== null && !printerName(value.defaultPrinter)) ||
    !record(value.optionPrinters) ||
    !record(value.profiles)
  )
    throw new Error('Invalid printing preferences.')
  const options = new Set(PRINTING_OPTIONS.map((option) => option.id))
  if (
    Object.entries(value.optionPrinters).some(
      ([key, name]) => !options.has(key) || !printerName(name)
    )
  )
    throw new Error('Invalid preferred printer.')
  if (Object.keys(value.profiles).length > 200) throw new Error('Too many printer configurations.')
  for (const [name, assignments] of Object.entries(value.profiles)) {
    if (
      !printerName(name) ||
      !record(assignments) ||
      Object.entries(assignments).some(
        ([option, id]) =>
          !options.has(option) || typeof id !== 'string' || !/^[a-f0-9]{32}$/.test(id)
      )
    )
      throw new Error('Invalid driver preset assignment.')
  }
  return structuredClone(value) as unknown as PrinterPreferences
}
export function fastPrintOptionId(
  preset: Pick<FastPrintPreset, 'mode' | 'paper' | 'color' | 'pagesPerSheet'>
): string {
  if (preset.mode?.startsWith('polaroid-')) return preset.mode
  return preset.mode === 'id-card'
    ? `id:${preset.paper}:${preset.color ? 'color' : 'mono'}`
    : `fast:${preset.paper}:${preset.color ? 'color' : 'mono'}:${preset.pagesPerSheet}`
}
export interface DriverPresetSummary {
  id: string
  name: string
  printer: string
  paper: string
  color: boolean
  landscape: boolean
  tray: string
  duplex: string
  paperWidthMm: number
  paperHeightMm: number
  copies: number
  savedAt: string
  usable: boolean
  error?: string
}
export interface PrinterDevice {
  name: string
  papers: string[]
  color: boolean
  duplex?: boolean
  isDefault?: boolean
}
export interface PrinterSettingsSnapshot {
  preferences: PrinterPreferences
  devices: PrinterDevice[]
  presets: DriverPresetSummary[]
}
export interface CaptureDriverPresetRequest {
  printer: string
  name: string
  id?: string
}
export interface CaptureDriverPresetResult {
  canceled?: boolean
  snapshot?: PrinterSettingsSnapshot
}
export interface PrinterPreferencesApi {
  get(): Promise<PrinterSettingsSnapshot>
  save(preferences: PrinterPreferences): Promise<PrinterSettingsSnapshot>
  capture(request: CaptureDriverPresetRequest): Promise<CaptureDriverPresetResult>
  remove(id: string): Promise<PrinterSettingsSnapshot>
}
export function appPrintingOption(toolId?: string): string {
  const id = `tool:${toolId}`
  return PRINTING_OPTIONS.some((option) => option.id === id) ? id : 'app-print'
}
export function preferredProfile(
  preferences: PrinterPreferences,
  printer: string,
  option: string
): string | undefined {
  return Object.prototype.hasOwnProperty.call(preferences.profiles, printer)
    ? preferences.profiles[printer]?.[option]
    : undefined
}
export function preferredPrinter(
  preferences: PrinterPreferences,
  option: string
): string | undefined {
  return preferences.optionPrinters[option] ?? preferences.defaultPrinter ?? undefined
}
