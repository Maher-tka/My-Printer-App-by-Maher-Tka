import assert from 'node:assert/strict'
import {
  createFastPrintChoices,
  defaultFastPrintStock,
  type FastPrintChoice
} from './fast-print-menu.js'
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
const print = leaves(menu).filter((item) => item.preset && !item.preset.mode)
assert.equal(print.length, 90)
assert.equal(print.filter((item) => item.preset?.profileId).length, 20)
assert.ok(print.some((item) => item.preset?.pagesPerSheet === 5))
assert.ok(print.some((item) => item.preset?.pagesPerSheet === 7))
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

function checkColorChoices(items: FastPrintChoice[]): void {
  for (const item of items) {
    if (!item.children) continue
    if (item.children.some((child) => child.label === 'Color')) {
      assert.deepEqual(
        item.children.map((child) => child.label),
        ['Color', 'Black && white']
      )
      assert.ok(leaves(item.children[0].children!).every((child) => child.preset?.color === true))
    }
    checkColorChoices(item.children)
  }
}
checkColorChoices(menu)
const polaroids = leaves(menu).filter((item) => item.preset?.mode?.startsWith('polaroid-'))
assert.equal(polaroids.length, 4)
assert.ok(polaroids.every((item) => item.preset?.paper === 'A4' && item.preset.color))
assert.equal(menu[0].children![0].label, 'Polaroid')
assert.deepEqual(
  menu[0].children![0].children!.map((item) => item.label),
  ['8 PIC', '9 PIC']
)
for (const printer of menu.filter((item) => item.children)) {
  for (const child of printer.children!) {
    if (child.label !== 'Polaroid')
      assert.ok(
        leaves(child.children ?? []).every((item) => !item.preset?.mode?.startsWith('polaroid-')),
        'Polaroid commands have one home directly under the printer'
      )
  }
}
assert.ok(
  !menu.find((item) => item.label === 'Mono')!.children!.some((item) => item.label === 'Polaroid')
)
assert.ok(
  !createFastPrintChoices([{ name: 'A3 only', papers: ['A3'], color: true }], [])[0].children!.some(
    (item) => item.label === 'Polaroid'
  )
)
const bypass = {
  id: 'abcdef1234567890abcdef1234567890',
  name: 'Bypass face up',
  printer: 'Epson test',
  paper: 'A4' as const,
  defaultBypassFaceUp: true,
  savedAt: '2026-10-17'
}
const oldBypass = { ...bypass, id: 'abcdef1234567890abcdef1234567891', savedAt: '2026-10-16' }
assert.equal(defaultFastPrintStock([oldBypass, bypass], 'Epson test', 'A4')?.id, bypass.id)
assert.equal(defaultFastPrintStock([bypass], 'Konica test', 'A4'), undefined)
assert.equal(defaultFastPrintStock([bypass], 'Epson test', 'A3'), undefined)
const defaultMenu = createFastPrintChoices(devices, [oldBypass, bypass])
const a4 = defaultMenu[0].children!.find((item) => item.label === 'A4')!
assert.ok(leaves(a4.children!).every((item) => item.preset?.profileId === bypass.id))
const directPolaroid = defaultMenu[0].children!.find((item) => item.label === 'Polaroid')!
assert.ok(
  directPolaroid.children!.every(
    (item) =>
      item.preset?.profileId === bypass.id &&
      item.preset?.color === true &&
      item.preset.paper === 'A4'
  )
)
console.log('Fast Print cascading menu tests passed.')
