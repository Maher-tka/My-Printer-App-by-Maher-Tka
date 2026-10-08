import assert from 'node:assert/strict'
import { runInNewContext } from 'node:vm'
import { createIllustratorPdfScript } from './illustrator-pdf-script.js'

function exercise(keepOpen = false, copyWorks = true) {
  const saves: any[] = [],
    copies: any[] = [],
    removed: string[] = [],
    width = (925 * 72) / 25.4,
    height = (115 * 72) / 25.4
  const old: any = {
    pageItems: [],
    remove() {
      layers.splice(layers.indexOf(old), 1)
    }
  }
  const layers: any[] = [old]
  Object.assign(layers, {
    add() {
      const l: any = { typename: 'Layer', pageItems: [], visible: true, printable: true }
      layers.push(l)
      return l
    },
    getByName(name: string) {
      const l = layers.find((l) => l.name === name)
      if (!l) throw new Error('Missing layer')
      return l
    }
  })
  const path = (name: string) => ({ name, typename: 'PathItem', parent: null as any })
  const cuts = [path('knife')],
    marks = [...Array.from({ length: 4 }, (_, i) => path('mark-' + i)), path('MimakiFCRMDir')]
  const groups = ['Artwork', 'CutContour', 'RegistrationMarks'].map((name) => {
    const g: any = {
      name,
      typename: 'GroupItem',
      pageItems:
        name === 'Artwork' ? [{ typename: 'RasterItem' }] : name === 'CutContour' ? cuts : marks,
      geometricBounds: [10, height - 10, 100, height - 100],
      move(layer: any) {
        g.parent = layer
        layer.pageItems.push(g)
      }
    }
    g.pageItems.forEach((p: any) => (p.parent = g))
    return g
  })
  const spots: any[] = []
  Object.assign(spots, {
    getByName(name: string) {
      const s = spots.find((s) => s.name === name)
      if (!s) throw new Error('absent')
      return s
    },
    add() {
      const s = {}
      spots.push(s)
      return s
    }
  })
  let closes = 0
  const doc: any = {
    artboards: [{ artboardRect: [0, height, width, 0] }],
    layers,
    groupItems: groups,
    pathItems: [...cuts, ...marks],
    spots,
    saveAs(file: any, options: any) {
      saves.push({
        file: file.fsName,
        options: { ...options },
        cutVisible: (layers as any).getByName('CutContour').visible,
        cutPrintable: (layers as any).getByName('CutContour').printable
      })
    },
    close() {
      closes++
    }
  }
  const app: any = {
    userInteractionLevel: 'normal',
    documents: [],
    open() {
      return doc
    },
    redraw() {}
  }
  const result = runInNewContext(
    createIllustratorPdfScript(
      [{ svgPath: 'C:/jobs/layout.svg', widthMm: 925, heightMm: 115, repeatCount: 2 }],
      'C:/output/job.pdf',
      1,
      keepOpen
    ),
    {
      app,
      File: function (this: any, path: string) {
        this.fsName = path
        this.parent = { fsName: 'C:/jobs' }
        this.copy = (destination: string) => {
          copies.push({ source: path, destination })
          return copyWorks
        }
        this.remove = () => {
          removed.push(path)
          return true
        }
      },
      PDFSaveOptions: function (this: any) {
        this.kind = 'pdf'
      },
      IllustratorSaveOptions: function (this: any) {
        this.kind = 'ai'
      },
      PDFCompatibility: { ACROBAT6: 6 },
      Compatibility: { ILLUSTRATOR16: 16 },
      ColorModel: { SPOT: 1 },
      ElementPlacement: { PLACEATEND: 1 },
      SaveOptions: { DONOTSAVECHANGES: 0 },
      CMYKColor: function () {},
      SpotColor: function (this: any) {
        this.typename = 'SpotColor'
      },
      UserInteractionLevel: { DONTDISPLAYALERTS: 0 }
    }
  )
  return { saves, copies, removed, app, doc, closes, result }
}
const result = exercise()
assert.match(result.result, /Verified CS6/)
assert.equal(result.saves.length, 2)
assert.equal(result.saves[0].options.kind, 'pdf')
assert.equal(result.saves[0].options.acrobatLayers, true)
assert.equal(result.saves[0].options.compatibility, 6)
assert.equal(result.saves[1].options.kind, 'ai')
assert.equal(result.saves[1].options.compatibility, 16)
assert.equal(result.saves[1].options.pdfCompatible, true)
assert.equal(result.saves[1].options.embedLinkedFiles, true)
assert.ok(result.saves.every((save) => !save.cutVisible && !save.cutPrintable))
assert.deepEqual(result.copies, [
  { source: 'C:/jobs/cs6-sheet.ai', destination: 'C:/output/job.pdf' }
])
assert.deepEqual(result.removed, ['C:/jobs/cs6-print-source.pdf', 'C:/jobs/cs6-sheet.ai'])
assert.equal(result.app.userInteractionLevel, 'normal')
assert.equal(result.doc.layers.length, 3)
assert.equal(result.closes, 2)
assert.equal(exercise(true).closes, 1, 'keep the verified PDF open when requested')
assert.throws(
  () => exercise(false, false),
  /Could not save the CS6-compatible PDF/,
  'failed copy cannot report success'
)
console.log(
  'CS6 PDF save sequence, print flags, native layer verification and temporary-file cleanup passed.'
)
