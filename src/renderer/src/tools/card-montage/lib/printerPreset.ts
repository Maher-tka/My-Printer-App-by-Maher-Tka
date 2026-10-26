import {
  preferredPrinter,
  preferredProfile,
  type PrinterSettingsSnapshot,
  type PrinterPreferences
} from '../../../../../shared/printer-preferences'

export const CARD_PRINT_OPTION = 'tool:card-montage'
export const INHERIT_CARD_PRINTER = 'inherit'

export function getCardPrinterPresetId(snapshot: PrinterSettingsSnapshot): string {
  const printer =
    preferredPrinter(snapshot.preferences, CARD_PRINT_OPTION) ??
    snapshot.devices.find((device) => device.isDefault)?.name
  return printer
    ? (preferredProfile(snapshot.preferences, printer, CARD_PRINT_OPTION) ?? INHERIT_CARD_PRINTER)
    : INHERIT_CARD_PRINTER
}

export function getCardPrinterPresetError(
  snapshot: PrinterSettingsSnapshot,
  id: string
): string | null {
  if (id === INHERIT_CARD_PRINTER) return null
  const preset = snapshot.presets.find((item) => item.id === id)
  if (!preset) return 'The saved printer preset is unavailable. Choose another preset.'
  if (!preset.usable)
    return 'The assigned driver preset needs attention. Recapture it or choose another preset.'
  const device = snapshot.devices.find((item) => item.name === preset.printer)
  if (!device) return 'This printer is unavailable. Install its driver, then refresh.'
  if (preset.paper !== 'A4' || !device.papers.includes('A4'))
    return 'Card Montage requires an A4 printer preset.'
  if (preset.color && !device.color) return 'This printer does not support color.'
  return null
}

export function assignCardPrinterPreset(
  snapshot: PrinterSettingsSnapshot,
  id: string
): PrinterPreferences {
  const error = getCardPrinterPresetError(snapshot, id)
  if (error) throw new Error(error)
  const preferences = structuredClone(snapshot.preferences)
  if (id === INHERIT_CARD_PRINTER) {
    delete preferences.optionPrinters[CARD_PRINT_OPTION]
    for (const [printer, assignments] of Object.entries(preferences.profiles)) {
      delete assignments[CARD_PRINT_OPTION]
      if (!Object.keys(assignments).length) delete preferences.profiles[printer]
    }
  } else {
    const preset = snapshot.presets.find((item) => item.id === id)!
    preferences.optionPrinters[CARD_PRINT_OPTION] = preset.printer
    preferences.profiles[preset.printer] = {
      ...preferences.profiles[preset.printer],
      [CARD_PRINT_OPTION]: preset.id
    }
  }
  return preferences
}

export function cardUsesDriverPreset(snapshot: PrinterSettingsSnapshot): boolean {
  const printer =
    preferredPrinter(snapshot.preferences, CARD_PRINT_OPTION) ??
    snapshot.devices.find((device) => device.isDefault)?.name
  return Boolean(
    printer &&
    (preferredProfile(snapshot.preferences, printer, CARD_PRINT_OPTION) ??
      preferredProfile(snapshot.preferences, printer, 'app-print'))
  )
}
