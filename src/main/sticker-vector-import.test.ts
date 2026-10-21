import assert from 'node:assert/strict'
import { runInNewContext } from 'node:vm'
import { createStickerVectorImportScript } from './sticker-vector-import.js'
import { assertStickerVectorImportRequest } from '../shared/sticker-vector-import.js'

assert.throws(() => assertStickerVectorImportRequest({ fileName: 'x.ai', bytes: new Uint8Array() }))
assert.throws(() =>
  assertStickerVectorImportRequest({ fileName: 'x.ai', bytes: new Uint8Array([1, 2, 3]) })
)
assert.doesNotThrow(() =>
  assertStickerVectorImportRequest({
    fileName: 'x.ai',
    bytes: new TextEncoder().encode('%PDF-1.7')
  })
)

function exercise(failExport = false) {
  const saved: Array<{ path: string; options: unknown }> = [],
    closed: unknown[] = [],
    artboards: number[][] = []
  let restored = false
  const layer = { typename: 'Layer', visible: true, locked: false }
  const groups = Array.from({ length: 10 }, () => ({
    typename: 'GroupItem',
    parent: layer,
    visibleBounds: [100, 200, 140, 150],
    clipped: false,
    // Internal groups belong to the sticker and must never become separate exports.
    pageItems: [{ typename: 'GroupItem' }, { typename: 'GroupItem' }],
    duplicate() {
      return { visibleBounds: [230, 410, 270, 360] }
    }
  }))
  const source = {
    pageItems: [...groups, { typename: 'PathItem', parent: layer, locked: true }],
    documentColorSpace: 'CMYK',
    activate() {},
    close(value: unknown) {
      closed.push(value)
    }
  }
  const app = {
    userInteractionLevel: 'original',
    documents: [] as unknown[] & { add?: unknown },
    activeDocument: null as unknown,
    open() {
      return source
    }
  }
  const previous = {
    activate() {
      restored = true
    }
  }
  app.documents.push(previous)
  app.activeDocument = previous
  app.documents.add = () => {
    const board = { artboardRect: [] as number[] }
    return {
      layers: [{}],
      artboards: [board],
      exportFile(file: { path: string }, _: unknown, options: unknown) {
        if (failExport) throw Error('export failed')
        saved.push({ path: file.path, options })
        artboards.push(board.artboardRect)
      },
      saveAs(file: { path: string }, options: unknown) {
        saved.push({ path: file.path, options })
      },
      close(value: unknown) {
        closed.push(value)
      }
    }
  }
  const Empty = function () {}
  const context = {
    app,
    File: function (this: { path: string }, path: string) {
      this.path = path
    },
    ExportOptionsSVG: Empty,
    PDFSaveOptions: Empty,
    UserInteractionLevel: { DONTDISPLAYALERTS: 'quiet' },
    ElementPlacement: { PLACEATEND: 'end' },
    ExportType: { SVG: 'SVG' },
    SVGFontType: { OUTLINEFONT: 'outline' },
    SVGDocumentEncoding: { UTF8: 'UTF8' },
    SVGCSSPropertyLocation: { PRESENTATIONATTRIBUTES: 'attrs' },
    PDFCompatibility: { ACROBAT7: '7' },
    SaveOptions: { DONOTSAVECHANGES: 'discard' }
  }
  const script = createStickerVectorImportScript('C:/private/source.ai', 'C:/private/output')
  if (failExport) assert.throws(() => runInNewContext(script, context), /export failed/)
  else {
    assert.equal(runInNewContext(script, context), '0,1,2,3,4,5,6,7,8,9')
    assert.equal(saved.length, 20, 'Ten complete sticker groups, locked background excluded')
    assert.ok(saved[0].path.endsWith('/sticker-0'), 'Illustrator adds the SVG extension itself')
    assert.deepEqual(
      Array.from(artboards[0]),
      [230, 410, 270, 360],
      'Fit duplicated bounds, which may shift between documents'
    )
    assert.equal((saved[0].options as { fontType: string }).fontType, 'outline')
    assert.equal((saved[1].options as { preserveEditability: boolean }).preserveEditability, true)
  }
  assert.equal(app.userInteractionLevel, 'original')
  assert.equal(restored, true)
  assert.ok(
    closed.every((value) => value === 'discard'),
    'Source copy and output documents close without saving changes'
  )
}
exercise()
exercise(true)
console.log(
  'Native AI import validation, complete groups, locked backgrounds, copied bounds, vector options and failure cleanup passed.'
)
