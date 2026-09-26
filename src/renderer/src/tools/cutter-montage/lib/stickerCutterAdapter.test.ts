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
assert.equal(resized.widthCm, 10)
assert.ok(
  Math.abs(resized.artwork.transform.widthCm / piece.artwork.transform.widthCm - 10 / 8.4) < 0.001
)
assert.equal(resized.cutline.transform.widthCm, resized.widthCm)
assert.equal(resized.cutline.customPathData, piece.cutline.customPathData)
assert.ok(Math.abs((resized.stickerMakerOffsetMm ?? 0) - 2 * (10 / 8.4)) < 0.001)

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
