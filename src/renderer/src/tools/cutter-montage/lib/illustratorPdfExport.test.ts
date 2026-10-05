import assert from 'node:assert/strict'
import fixture from './orderLayout.fixture.json'
import {
  validateIllustratorPdfExport,
  validateIllustratorPdfBatch,
  getCutterSheetPdfFileName
} from '../../../../../shared/illustrator-pdf-export'
import type { CutterProject, CutterSheetSettings, PiecePreset, PieceSourceFile } from '../types'
import { synchronizePieceEditorModel } from './editorObjects'
import { createPlacedPieceFromPreset } from './piecePresets'
import { createIllustratorPdfExport, createIllustratorPdfBatch } from './illustratorPdfExport'
import { getDefaultCutterExportSettings } from './exportPresets'
import { getSingleProductionSheetProject } from './productionSheets'
import { exportCutterPdf } from './pdfCutExport'
import { PDFDocument } from 'pdf-lib'

const piece = synchronizePieceEditorModel({
  ...(fixture.pieces[0] as unknown as PiecePreset),
  quantity: 3
})
const source: PieceSourceFile = {
  id: piece.sourceId,
  sourceKind: 'image',
  fileName: 'sticker.png',
  displayName: 'Sticker',
  mimeType: 'image/png',
  bytes: new Uint8Array([137, 80, 78, 71]),
  previewUrl: '',
  naturalWidthPx: 10,
  naturalHeightPx: 10
}
const placements = [0, 1, 2].map((sheetIndex) => ({
  ...createPlacedPieceFromPreset(piece, 0, 0),
  sheetIndex
}))
const project: CutterProject = {
  sources: [source],
  pieces: [piece],
  placedPieces: placements,
  sheet: { ...(fixture.sheet as CutterSheetSettings), autoExpandHeight: false },
  layers: { artwork: false, cutlines: false },
  exportSettings: getDefaultCutterExportSettings()
}
const request = await createIllustratorPdfExport(project)
assert.equal(request.layouts.length, 1, 'identical sheets export once')
assert.equal(request.layouts[0].repeatCount, 3, 'physical repeat count is retained')
assert.equal(validateIllustratorPdfExport(request), true)
assert.match(request.layouts[0].svg, /<g id="Artwork"/)
assert.match(request.layouts[0].svg, /<g id="CutContour"/)
assert.match(request.layouts[0].svg, /<g id="RegistrationMarks"/)
assert.equal(
  (request.layouts[0].svg.match(/data:image\/png;base64/g) ?? []).length,
  1,
  'artwork is embedded once per source'
)
assert.match(request.layouts[0].svg, /<use xlink:href="#source-/)
assert.match(request.layouts[0].svg, /data-production="true"/)
assert.equal((request.layouts[0].svg.match(/data-mimaki-mark="type-1"/g) ?? []).length, 4)
assert.equal((request.layouts[0].svg.match(/data-mimaki-mark="direction"/g) ?? []).length, 1)
const different = { ...createPlacedPieceFromPreset(piece, 5, 0), sheetIndex: 1 }
const laterProject = { ...project, placedPieces: [placements[0], different, placements[2]] }
const selected = await createIllustratorPdfExport(laterProject, 1)
assert.equal(selected.layouts.length, 1, 'only the displayed layout is exported')
assert.equal(selected.layoutNumber, 2)
assert.match(selected.layouts[0].svg, new RegExp(different.id))
assert.ok(!selected.layouts[0].svg.includes(placements[0].id))
const separate = await createIllustratorPdfBatch(laterProject)
assert.equal(separate.sheets.length, 2, 'one PDF per unique sheet')
assert.equal(separate.sheets[0].layouts[0].repeatCount, 2, 'identical sheets share one file')
assert.equal(separate.sheets[1].layouts[0].repeatCount, 1)
assert.equal(validateIllustratorPdfBatch(separate), true)
assert.equal(
  validateIllustratorPdfBatch({ sheets: [separate.sheets[0], separate.sheets[0]] }),
  false,
  'duplicate sheet numbers are rejected'
)
assert.equal(getCutterSheetPdfFileName(1, 6), 'sheet_01_x6.pdf')
assert.equal(getCutterSheetPdfFileName(2, 3), 'sheet_02_x3.pdf')
const oneSheet = getSingleProductionSheetProject(laterProject, 1)
assert.ok(
  oneSheet.placedPieces.every((placed) => placed.sheetIndex === 0),
  'later sheet is reindexed to page zero'
)
const onePdf = await exportCutterPdf({
  ...oneSheet,
  exportSettings: {
    ...oneSheet.exportSettings,
    mode: 'print-only',
    includeArtwork: false,
    includeCutlines: false
  }
})
assert.equal(
  (await PDFDocument.load(await onePdf.blob.arrayBuffer())).getPageCount(),
  1,
  'print-only selected-sheet export has no blank extra page'
)
await assert.rejects(createIllustratorPdfExport(project, 99), /Select a production sheet/)

const labeled = await createIllustratorPdfExport({
  ...project,
  sheet: {
    ...project.sheet,
    productionLabel: { enabled: true, position: 'bottom-left', size: 'small', placement: 'margin' }
  },
  exportSettings: { ...project.exportSettings, includeProductionLabel: true }
})
const svg = labeled.layouts[0].svg
assert.ok(svg.indexOf('id="ProductionInfo"') > svg.indexOf('id="Artwork"'))
assert.ok(
  svg.indexOf('id="ProductionInfo"') < svg.indexOf('id="RegistrationMarks"'),
  'production label belongs to Artwork'
)
await assert.rejects(
  createIllustratorPdfExport({
    ...project,
    pieces: [{ ...piece, objects: piece.objects.filter((object) => object.role !== 'cutline') }]
  }),
  /vector cut path/
)
await assert.rejects(
  createIllustratorPdfExport({
    ...project,
    sheet: {
      ...project.sheet,
      registrationMarks: { ...project.sheet.registrationMarks!, enabled: false }
    }
  }),
  /registration marks/
)
await assert.rejects(
  createIllustratorPdfExport({
    ...project,
    sources: [{ ...source, bytes: { length: 200 * 1024 * 1024 } as Uint8Array }]
  }),
  /too large/,
  'oversized bitmap jobs are rejected before encoding'
)

for (const invalid of [
  null,
  { layouts: [] },
  { layouts: [request.layouts[0], request.layouts[0]] },
  { layouts: Array(17).fill(request.layouts[0]) },
  { layouts: [{ ...request.layouts[0], repeatCount: 0 }] },
  { layouts: [{ ...request.layouts[0], widthMm: NaN }] },
  { layouts: [{ ...request.layouts[0], svg: request.layouts[0].svg + '<script/>' }] },
  {
    layouts: [
      { ...request.layouts[0], svg: request.layouts[0].svg + '<image href="file:///private"/>' }
    ]
  }
])
  assert.equal(validateIllustratorPdfExport(invalid), false)
console.log(
  'Illustrator PDF job layers, repeat counts, input validation and size-limit tests passed.'
)
