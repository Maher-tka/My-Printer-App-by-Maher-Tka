import assert from 'node:assert/strict'
import { createFastPrintChoices, type FastPrintChoice } from './fast-print-menu.js'
function leaves(items: FastPrintChoice[]): FastPrintChoice[] {
  return items.flatMap((item) => (item.children ? leaves(item.children) : [item]))
}
const devices = [
  { name: 'Konica test', papers: ['A4', 'A3'], color: true },
  { name: 'Epson test', papers: ['A4'], color: true, isDefault: true },
  { name: 'Mono', papers: ['A4'], color: false }
]
const stocks = [
  {
    id: '1234567890abcdef1234567890abcdef',
    name: 'A3 & tray 2',
    printer: 'Konica test',
    paper: 'A3' as const
  }
]
const menu = createFastPrintChoices(devices, stocks)
assert.equal(menu[0].label, 'Epson test (default)')
const print = leaves(menu).filter((item) => item.preset)
assert.equal(print.length, 27)
assert.equal(print.filter((item) => item.preset?.profileId).length, 6)
assert.ok(
  print
    .filter((item) => item.preset?.printer === 'Mono')
    .every((item) => item.preset?.color === false)
)
assert.ok(
  print
    .filter((item) => item.preset?.printer === 'Epson test')
    .every((item) => item.preset?.paper === 'A4' && !item.preset?.profileId)
)
assert.ok(leaves(createFastPrintChoices([], [])).some((item) => item.action === 'manage'))
assert.equal(devices[0].name, 'Konica test', 'Menu sorting must not mutate the device source')
console.log('Fast Print cascading menu tests passed.')
