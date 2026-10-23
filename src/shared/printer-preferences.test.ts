import assert from 'node:assert/strict'
import {
  emptyPrinterPreferences,
  validatePrinterPreferences,
  preferredProfile,
  preferredPrinter,
  fastPrintOptionId,
  PRINTING_OPTIONS,
  compareDriverPresets
} from './printer-preferences.js'
import { createFastPrintChoices, type FastPrintChoice } from './fast-print-menu.js'
const preferences = emptyPrinterPreferences()
const orderedProfiles = [
  { id: 'c', name: 'Alpha new', printer: 'Epson' },
  { id: 'b', name: 'Alpha', printer: 'Epson', sortOrder: 1 },
  { id: 'a', name: 'Zebra', printer: 'Epson', sortOrder: 0 }
]
assert.deepEqual(
  orderedProfiles.sort(compareDriverPresets).map((p) => p.id),
  ['a', 'b', 'c']
)
assert.deepEqual(
  [...orderedProfiles]
    .map((p) => ({ ...p, sortOrder: undefined }))
    .sort(compareDriverPresets)
    .map((p) => p.id),
  ['b', 'c', 'a']
)
assert.equal(PRINTING_OPTIONS.length, new Set(PRINTING_OPTIONS.map((o) => o.id)).size)
preferences.defaultPrinter = 'Epson'
preferences.optionPrinters['tool:booklet-montage'] = 'Konica'
preferences.profiles.Epson = {
  'polaroid-8': 'a'.repeat(32),
  'polaroid-9': 'b'.repeat(32),
  'fast:A4:color:1': 'c'.repeat(32)
}
assert.deepEqual(validatePrinterPreferences(preferences), preferences)
assert.equal(preferredPrinter(preferences, 'polaroid-8'), 'Epson')
assert.equal(preferredPrinter(preferences, 'tool:booklet-montage'), 'Konica')
assert.equal(preferredProfile(preferences, 'Konica', 'polaroid-8'), undefined)
assert.equal(fastPrintOptionId({ paper: 'A3', color: false, pagesPerSheet: 4 }), 'fast:A3:mono:4')
assert.equal(
  fastPrintOptionId({ paper: 'A4', color: true, pagesPerSheet: 1, mode: 'id-card' }),
  'id:A4:color'
)
for (const value of [
  null,
  { ...preferences, version: 2 },
  { ...preferences, defaultPrinter: '\0bad' },
  { ...preferences, optionPrinters: { unknown: 'Epson' } },
  { ...preferences, profiles: { Epson: { 'polaroid-8': '../other' } } }
])
  assert.throws(() => validatePrinterPreferences(value))
const menu = createFastPrintChoices(
  [
    { name: 'Konica', papers: ['A4', 'A3'], color: true, isDefault: true },
    { name: 'Epson', papers: ['A4'], color: true }
  ],
  [],
  preferences
)
assert.equal(menu[0].label, 'Epson (preferred)')
const leaves = (items: FastPrintChoice[]): FastPrintChoice[] =>
  items.flatMap((item) => (item.children ? leaves(item.children) : [item]))
const prints = leaves(menu[0].children!)
assert.equal(
  prints.find((item) => item.preset?.mode === 'polaroid-8')?.preset?.profileId,
  'a'.repeat(32)
)
assert.equal(
  prints.find((item) => item.preset?.mode === 'polaroid-9')?.preset?.profileId,
  'b'.repeat(32)
)
assert.equal(
  prints.find((item) => !item.preset?.mode && item.preset?.color && item.preset.pagesPerSheet === 1)
    ?.preset?.profileId,
  'c'.repeat(32)
)
assert.ok(
  prints.filter((item) => item.preset?.color === false).every((item) => !item.preset?.profileId)
)
const stock = { id: 'd'.repeat(32), name: 'Explicit stock', printer: 'Epson', paper: 'A4' as const }
const explicit = createFastPrintChoices(
  [{ name: 'Epson', papers: ['A4'], color: true }],
  [stock],
  preferences
)[0].children!.find((item) => item.label === 'Saved paper && tray presets')!
assert.ok(
  leaves(explicit.children!).every((item) => item.preset?.profileId === stock.id),
  'Explicit stock selection must override preferred print-option presets'
)
console.log(
  'Printer preference validation, per-option profiles and explicit stock precedence passed.'
)
