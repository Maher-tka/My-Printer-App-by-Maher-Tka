import assert from 'node:assert/strict'
import {
  appPrintingOption,
  emptyPrinterPreferences,
  preferredPrinter,
  preferredProfile,
  validatePrinterPreferences,
  type PrinterSettingsSnapshot
} from '../../../../../shared/printer-preferences'
import {
  assignCardPrinterPreset,
  cardUsesDriverPreset,
  CARD_PRINT_OPTION,
  getCardPrinterPresetError,
  getCardPrinterPresetId,
  INHERIT_CARD_PRINTER
} from './printerPreset'

const cardId = 'a'.repeat(32),
  otherId = 'b'.repeat(32)
const snapshot: PrinterSettingsSnapshot = {
  preferences: {
    ...emptyPrinterPreferences(),
    defaultPrinter: 'Office',
    optionPrinters: { 'tool:booklet-montage': 'Office' },
    profiles: { Cards: { 'fast:A4:color:1': otherId }, Office: { 'app-print': otherId } }
  },
  devices: [
    { name: 'Cards', papers: ['A4', 'A3'], color: true },
    { name: 'Office', papers: ['A4'], color: false, isDefault: true }
  ],
  presets: [
    {
      id: cardId,
      name: 'Card stock / bypass',
      printer: 'Cards',
      paper: 'A4',
      color: true,
      landscape: false,
      tray: 'Bypass',
      duplex: 'Simplex',
      paperWidthMm: 210,
      paperHeightMm: 297,
      copies: 1,
      savedAt: '',
      usable: true
    },
    {
      id: otherId,
      name: 'Other work',
      printer: 'Office',
      paper: 'A4',
      color: false,
      landscape: false,
      tray: 'Auto',
      duplex: 'Simplex',
      paperWidthMm: 210,
      paperHeightMm: 297,
      copies: 1,
      savedAt: '',
      usable: true
    }
  ]
}
assert.equal(CARD_PRINT_OPTION, appPrintingOption('card-montage'))
assert.equal(getCardPrinterPresetId(snapshot), INHERIT_CARD_PRINTER)
assert.equal(
  cardUsesDriverPreset(snapshot),
  true,
  'the app-wide preset still applies before a card default is chosen'
)
const original = structuredClone(snapshot)
const preferences = assignCardPrinterPreset(snapshot, cardId)
assert.deepEqual(
  snapshot,
  original,
  'choosing a default does not mutate a loaded settings snapshot'
)
assert.equal(preferredPrinter(preferences, CARD_PRINT_OPTION), 'Cards')
assert.equal(preferredProfile(preferences, 'Cards', CARD_PRINT_OPTION), cardId)
assert.equal(preferences.profiles.Cards['fast:A4:color:1'], otherId)
assert.equal(preferences.profiles.Office['app-print'], otherId)
assert.equal(preferences.optionPrinters['tool:booklet-montage'], 'Office')
const restarted = {
  ...snapshot,
  preferences: validatePrinterPreferences(JSON.parse(JSON.stringify(preferences)))
}
restarted.preferences.defaultPrinter = 'Another printer'
assert.equal(
  getCardPrinterPresetId(restarted),
  cardId,
  'the card preset survives restart and app-default changes'
)
assert.equal(cardUsesDriverPreset(restarted), true)
assert.equal(getCardPrinterPresetError(restarted, cardId), null)

for (const patch of [
  { presets: [] },
  { presets: [{ ...snapshot.presets[0], usable: false }] },
  { presets: [{ ...snapshot.presets[0], paper: 'A3' }] },
  { devices: [] },
  { devices: [{ ...snapshot.devices[0], color: false }] }
]) {
  const invalid = { ...restarted, ...patch }
  assert.ok(getCardPrinterPresetError(invalid, cardId))
  assert.throws(() => assignCardPrinterPreset(invalid, cardId))
}
assert.equal(
  getCardPrinterPresetId({ ...restarted, presets: [] }),
  cardId,
  'missing presets remain selected for an actionable error'
)
const reset = assignCardPrinterPreset(restarted, INHERIT_CARD_PRINTER)
assert.equal(reset.optionPrinters[CARD_PRINT_OPTION], undefined)
assert.equal(preferredProfile(reset, 'Cards', CARD_PRINT_OPTION), undefined)
assert.equal(reset.profiles.Cards['fast:A4:color:1'], otherId)
assert.equal(reset.profiles.Office['app-print'], otherId)
assert.equal(reset.defaultPrinter, 'Another printer')
console.log(
  'Card default preset: persistent routing, app-default independence, safe reset and invalid-preset guards passed.'
)
