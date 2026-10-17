import { strict as assert } from 'node:assert'
import { PDFArray, PDFDict, PDFDocument, PDFName } from 'pdf-lib'
import { createStickerCutterAssets, resizeFinishedStickerWidth } from './stickerCutterAdapter'
import { makeOffsetPath, type StickerMakerResult } from './stickerMaker'
import { createPlacedPieceFromPreset } from './piecePresets'
import { autoArrangePieces } from './nesting'
import { DEFAULT_CUTTER_SHEET } from './cutterLayout'
import { getDefaultCutterExportSettings } from './exportPresets'
import { exportCutterPdf } from './pdfCutExport'
import { createCutterProjectFile, deserializeCutterProjectPayload } from '@/projects/projectFiles'
import type { CutterProject } from '../types'
import { getFinishedPieceSize, resizeFinishedPiece } from './pieceSize'
import { getPlacedProductionBounds } from './cutlineGenerator'
import { getPieceEditorViewBounds } from './pieceEditorView'

const mask = new Uint8Array(100)
for (let y = 2; y < 8; y += 1) {
  for (let x = 2; x < 8; x += 1) mask[y * 10 + x] = 255
}
const result: StickerMakerResult = {
  fileName: 'sample.jpg',
  png: new Uint8Array(
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAIAAAD/gAIDAAABBUlEQVR4nO3bMQ3DQBBFwUtkHsaSMlCM0KUxGEKQOBTyKl+kGQSrp9/u4zq3MZ91f435PO8+4J+IFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBUsc/6Mft7HmI9lBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgVijd99AQbZBxrEIxcIAAAAAElFTkSuQmCC',
      'base64'
    )
  ),
  widthPx: 100,
  heightPx: 100,
  widthMm: 80,
  heightMm: 80,
  pathData: makeOffsetPath(mask, 10, 10, {
    widthMm: 80,
    offsetMm: 2,
    threshold: 128,
    smoothing: 1
  }).pathData,
  contourMask: mask,
  contourWidth: 10,
  contourHeight: 10,
  warnings: []
}

const { source, piece } = createStickerCutterAssets(result, 2, [])
assert.equal(piece.objects.find((item) => item.role === 'cutline')?.shapeType, 'path')
assert.equal(piece.objects.find((item) => item.role === 'cutline')?.pathData, result.pathData)
assert.equal(piece.artwork.transform.xCm, 0.2)
assert.equal(piece.cutline.transform.widthCm, 8.4)
assert.equal(piece.objects[0].groupId, piece.objects[1].groupId)
const ordered = createStickerCutterAssets(result, 2, [piece], 7).piece
assert.equal(ordered.quantity, 7, 'maker copy count transfers to Cutter Montage')
const arrangedOrder = autoArrangePieces([ordered], DEFAULT_CUTTER_SHEET, [])
assert.equal(arrangedOrder.placedCount, 7, 'all requested sticker copies are placed')
const resized = resizeFinishedStickerWidth(piece, 100)
const measuredWidth = getFinishedPieceSize(piece).widthCm
assert.ok(
  measuredWidth < piece.widthCm,
  'empty image space does not count as finished contour width'
)
assert.ok(
  Math.abs(getFinishedPieceSize(resized).widthCm - 10) < 1e-9,
  '100 mm means the drawn cut contour is 100 mm wide'
)
assert.ok(
  Math.abs(
    resized.artwork.transform.widthCm / piece.artwork.transform.widthCm - 10 / measuredWidth
  ) < 0.001
)
assert.equal(resized.cutline.transform.widthCm, resized.widthCm)
assert.equal(resized.cutline.customPathData, piece.cutline.customPathData)
assert.ok(Math.abs((resized.stickerMakerOffsetMm ?? 0) - 2 * (10 / measuredWidth)) < 0.001)
assert.equal(piece.clippingMaskEnabled, true, 'the padded source is clipped to the cut contour')
const footprint = getPlacedProductionBounds(createPlacedPieceFromPreset(resized, 0, 0), resized)
assert.ok(
  Math.abs(getPieceEditorViewBounds(resized, true).widthCm - 10) < 1e-9,
  'Fit view also focuses on the cut contour instead of source padding'
)
assert.ok(
  Math.abs(footprint.widthCm - 10) < 1e-9,
  'nesting measures the contour instead of the full PNG'
)
const legacy = {
  ...piece,
  clippingMaskEnabled: false,
  maskObjectId: undefined,
  mask: { ...piece.mask, enabled: false },
  objects: piece.objects.filter((object) => object.role !== 'clipping-mask')
}
const resizedLegacy = resizeFinishedStickerWidth(legacy, 100)
assert.equal(
  resizedLegacy.clippingMaskEnabled,
  true,
  'existing AI stickers gain a non-destructive contour clip when resized'
)
assert.ok(Math.abs(getFinishedPieceSize(resizedLegacy).widthCm - 10) < 1e-9)
const asymmetric = createStickerCutterAssets(
  { ...result, pathData: 'M .2 .1 L .8 .1 L .8 .5 L .2 .5 Z' },
  2,
  []
).piece
const measured = getFinishedPieceSize(asymmetric)
assert.ok(Math.abs(measured.widthCm - 5.04) < 1e-9)
assert.ok(Math.abs(measured.heightCm - 3.36) < 1e-9)
const taller = resizeFinishedPiece(asymmetric, measured.widthCm, 8, 'height')
assert.ok(
  Math.abs(getFinishedPieceSize(taller).heightCm - 8) < 1e-9,
  'height also uses the actual cut path'
)
assert.ok(
  Math.abs(getFinishedPieceSize(taller).widthCm - 12) < 1e-9,
  'aspect ratio follows the contour instead of the square PNG'
)
const stretched = resizeFinishedPiece({ ...asymmetric, lockAspectRatio: false }, 8, 4, 'width')
assert.ok(Math.abs(getFinishedPieceSize(stretched).widthCm - 8) < 1e-9)
assert.ok(Math.abs(getFinishedPieceSize(stretched).heightCm - 4) < 1e-9)
const narrowMask = {
  ...asymmetric,
  objects: asymmetric.objects.map((object) =>
    object.role === 'clipping-mask'
      ? { ...object, transform: { ...object.transform, widthCm: 1, heightCm: 1 } }
      : object
  )
}
assert.deepEqual(
  getFinishedPieceSize(narrowMask),
  measured,
  'finished size prioritizes the cut contour over a different mask'
)
for (const rotation of [0, 90, 180, 270] as const) {
  const bounds = getPlacedProductionBounds(
    createPlacedPieceFromPreset(asymmetric, 0, 0, rotation),
    asymmetric
  )
  assert.ok(
    Math.abs(bounds.widthCm - (rotation % 180 ? measured.heightCm : measured.widthCm)) < 1e-9
  )
}

const project: CutterProject = {
  sheet: { ...DEFAULT_CUTTER_SHEET, widthCm: 20, heightCm: 20 },
  sources: [source],
  pieces: [piece],
  placedPieces: [createPlacedPieceFromPreset(piece, 3, 3)],
  layers: { artwork: true, cutlines: true },
  exportSettings: getDefaultCutterExportSettings()
}
const pdf = await PDFDocument.load(await (await exportCutterPdf(project)).blob.arrayBuffer())
const oc = pdf.catalog.lookup(PDFName.of('OCProperties'), PDFDict)
const groups = oc.lookup(PDFName.of('OCGs'), PDFArray)
assert.deepEqual(
  Array.from({ length: groups.size() }, (_, index) =>
    groups.lookup(index, PDFDict).get(PDFName.of('Name'))?.toString()
  ),
  ['(Artwork)', '(CutContour)', '(FC RegisterMark Layer1)']
)
const hidden = oc.lookup(PDFName.of('D'), PDFDict).lookup(PDFName.of('OFF'), PDFArray)
assert.equal(hidden.size(), 1)
assert.equal(hidden.get(0).toString(), groups.get(1).toString())

const saved = createCutterProjectFile({
  ...project,
  mode: 'montage-sheet',
  activePieceId: piece.id,
  selectedPlacedIds: [],
  selectedEditorObjects: [],
  keyObject: { object: null }
})
const reopened = deserializeCutterProjectPayload(saved.payload)
assert.equal(reopened.pieces[0].cutline.customPathData, result.pathData)
assert.deepEqual(reopened.sources[0].bytes, result.png)
