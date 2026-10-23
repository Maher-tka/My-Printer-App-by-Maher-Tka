import assert from 'node:assert/strict'
import { selectIdDriverPreset } from './fast-print-id-preset.js'
import type { FastPrintPreset } from './fast-print.js'

const current: FastPrintPreset = {
  printer: 'EPSON WF',
  paper: 'A4',
  color: true,
  pagesPerSheet: 1,
  mode: 'id-card'
}
const device = { name: 'EPSON WF', papers: ['A4', 'A3'], color: true, duplex: true }
const profile = {
  id: 'a'.repeat(32),
  name: 'ID — both sides black and white',
  printer: 'EPSON WF',
  paper: 'A4',
  color: false,
  landscape: false,
  duplex: 'Vertical'
}
const selected = selectIdDriverPreset(current, profile, device)
assert.equal(selected.preset.color, false)
assert.equal(selected.preset.duplex, true)
assert.equal(selected.preset.profileId, profile.id)
assert.equal(selected.preset.profileName, profile.name)
assert.equal(current.color, true)
assert.equal(current.profileId, undefined)
assert.equal(
  selectIdDriverPreset(current, { ...profile, duplex: 'Horizontal' }, device).preset.duplex,
  true
)
assert.equal(
  selectIdDriverPreset(
    current,
    { ...profile, duplex: 'Simplex', paper: 'A3', landscape: true },
    device
  ).preset.duplex,
  false
)
for (const invalid of [
  { ...profile, printer: 'another printer' },
  { ...profile, paper: 'A5' },
  { ...profile, id: '../invalid' }
])
  assert.throws(() => selectIdDriverPreset(current, invalid, device))
assert.throws(
  () => selectIdDriverPreset(current, profile, { ...device, duplex: false }),
  /automatic duplex/
)
assert.throws(
  () => selectIdDriverPreset(current, { ...profile, color: true }, { ...device, color: false }),
  /color/
)
assert.throws(
  () => selectIdDriverPreset(current, { ...profile, paper: 'A3' }, { ...device, papers: ['A4'] }),
  /paper/
)
assert.throws(() => selectIdDriverPreset({ ...current, mode: undefined }, profile, device))
console.log(
  'ID saved driver presets: Epson mono/duplex, paper and printer capability guards passed.'
)
