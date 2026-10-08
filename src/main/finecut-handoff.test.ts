import assert from 'node:assert/strict'
import { validateFineCutHandoff } from '../shared/finecut-handoff.js'
import { createIllustratorCutScript } from './illustrator-cut-script.js'
import { runInNewContext } from 'node:vm'
const svg = '<svg><g id="Artwork"/><g id="CutContour"/><g id="RegistrationMarks"/></svg>'
assert.equal(validateFineCutHandoff({ svg, widthMm: 120, heightMm: 105 }), true)
for (const request of [
  { svg, widthMm: NaN, heightMm: 105 },
  { svg, widthMm: 1000, heightMm: 105 },
  { svg: svg + '<script/>', widthMm: 120, heightMm: 105 },
  { svg: svg + '<image href="file:///secret"/>', widthMm: 120, heightMm: 105 },
  { svg: svg + '<!DOCTYPE svg>', widthMm: 120, heightMm: 105 }
])
  assert.equal(validateFineCutHandoff(request), false)
const oldLayer = {
  pageItems: [] as unknown[],
  removed: false,
  remove() {
    this.removed = true
  }
}
const layers: any[] = [oldLayer]
Object.assign(layers, {
  add() {
    const layer: any = { pageItems: [], printable: true, visible: true }
    layers.push(layer)
    return layer
  }
})
const path = (name: string) => ({ name, typename: 'PathItem', parent: null as unknown })
const groups: any[] = ['Artwork', 'CutContour', 'RegistrationMarks'].map((name) => {
  const group: any = {
    name,
    pageItems: [],
    move(layer: any) {
      group.parent = layer
      layer.pageItems.push(group)
    }
  }
  if (name !== 'Artwork') {
    group.pageItems =
      name === 'CutContour' ? [path('knife')] : [path('MimakiFCRMDir'), path('MimakiFCRM-top-left')]
    group.pageItems.forEach((p: any) => (p.parent = group))
  }
  return group
})
const saves: any[] = []
const copies: any[] = []
const spots: any[] = []
Object.assign(spots, {
  getByName(name: string) {
    const spot = spots.find((s) => s.name === name)
    if (!spot) throw Error('absent')
    return spot
  },
  add() {
    const spot = {}
    spots.push(spot)
    return spot
  }
})
const doc = {
  artboards: [{ artboardRect: [0, (105 * 72) / 25.4, (120 * 72) / 25.4, 0] }],
  groupItems: groups,
  layers,
  spots,
  saveAs(file: any, options: any) {
    saves.push({ file, options, cutVisible: layers[2].visible, cutPrintable: layers[2].printable })
  }
}
const app = {
  userInteractionLevel: 'normal',
  open() {
    return doc
  },
  redraw() {}
}
const result = runInNewContext(
  createIllustratorCutScript('input.svg', 'output.ai', 'output.pdf', 120, 105),
  {
    app,
    File: function (this: any, path: string) {
      this.path = path
      this.copy = (destination: string) => {
        copies.push({ source: path, destination })
        return true
      }
      this.remove = () => true
    },
    ElementPlacement: { PLACEATEND: 1 },
    ColorModel: { SPOT: 1 },
    CMYKColor: function () {},
    SpotColor: function () {},
    IllustratorSaveOptions: function () {},
    PDFSaveOptions: function () {},
    PDFCompatibility: { ACROBAT6: 6 },
    Compatibility: { ILLUSTRATOR16: 16 },
    UserInteractionLevel: { DONTDISPLAYALERTS: 0 }
  }
)
assert.match(result, /No device job was sent/)
assert.equal(oldLayer.removed, true)
assert.deepEqual(
  layers.slice(1).map((layer) => layer.name),
  ['Artwork', 'CutContour', 'FC RegisterMark Layer1']
)
assert.deepEqual(
  spots.map((s) => s.name),
  ['CutContour', 'MimakiFCRM', 'MimakiFCRMDir']
)
assert.equal(saves.length, 2)
assert.ok(saves.every((save) => !save.cutVisible && !save.cutPrintable))
assert.equal(saves[0].options.preserveEditability, true)
assert.equal(saves[0].options.acrobatLayers, true)
assert.equal(saves[1].options.compatibility, 16)
assert.equal(saves[1].options.pdfCompatible, true)
assert.deepEqual(copies, [{ source: 'output.ai', destination: 'output.pdf' }])
assert.equal(groups[1].pageItems[0].strokeWidth, 0.25)
assert.equal(groups[2].pageItems[0].filled, true)
assert.equal(app.userInteractionLevel, 'normal')
console.log('FineCut handoff validation and native-document script tests passed.')
