import assert from 'node:assert/strict'
import { createPiecePresetFromSource } from './piecePresets'
import {
  isSelectableLayerObject,
  renameLayerObject,
  reorderLayerObject,
  setMaskEditing
} from './editorLayers'
import { synchronizePieceEditorModel } from './editorObjects'

const piece = createPiecePresetFromSource(
  {
    id: 'layers-test',
    sourceKind: 'image',
    fileName: 'sticker.png',
    displayName: 'Sticker',
    mimeType: 'image/png',
    bytes: new Uint8Array(),
    previewUrl: 'blob:layer-test',
    naturalWidthPx: 800,
    naturalHeightPx: 600
  },
  []
)
const artwork = piece.objects[0]
const cutline = {
  ...artwork,
  id: 'test-cutline',
  name: 'CutContour',
  role: 'cutline' as const,
  type: 'cutline' as const,
  shapeType: 'rectangle' as const,
  strokeName: 'CutContour',
  strokeWidthPt: 0.25,
  exportEnabled: true
}
const layered = { ...piece, objects: [artwork, cutline], cutlineObjectId: cutline.id }
const reordered = reorderLayerObject(layered, artwork.id, 1)
assert.deepEqual(
  reordered.objects.map((object) => object.id),
  [cutline.id, artwork.id]
)
assert.deepEqual(
  layered.objects.map((object) => object.id),
  [artwork.id, cutline.id],
  'reordering must preserve undo snapshot'
)
assert.deepEqual(
  reordered.objects[0].transform,
  cutline.transform,
  'stacking must not move geometry'
)
const renamed = renameLayerObject(reordered, cutline.id, 'Production cut')
assert.equal(renamed.objects[0].name, 'Production cut')
assert.equal(renamed.objects[0].strokeName, 'CutContour', 'display rename must preserve spot color')
assert.equal(renamed.objects[0].strokeWidthPt, 0.25)
const extraCut = { ...cutline, id: 'extra-cut', name: 'Inner contour' }
const extraMask = {
  ...cutline,
  id: 'extra-mask',
  role: 'clipping-mask' as const,
  type: 'mask' as const,
  exportEnabled: false
}
const withExtras = { ...renamed, objects: [...renamed.objects, extraCut, extraMask] }
const normalized = synchronizePieceEditorModel(withExtras)
assert.deepEqual(
  normalized.objects.map((object) => object.id),
  withExtras.objects.map((object) => object.id),
  'project normalization must preserve complete layer stack'
)
assert.equal(
  normalized.objects[0].name,
  'Production cut',
  'project normalization must retain custom names'
)
assert.equal(normalized.objects[0].strokeName, 'CutContour')
assert.deepEqual(
  normalized.objects.find((object) => object.id === extraCut.id),
  extraCut,
  'additional production contours must survive normalization'
)
assert.deepEqual(
  normalized.objects.find((object) => object.id === extraMask.id),
  extraMask,
  'additional masks must survive normalization'
)
const hiddenCut = { ...cutline, visible: false }
assert.equal(isSelectableLayerObject(layered, hiddenCut), false)
assert.equal(isSelectableLayerObject(layered, { ...artwork, locked: true }), false)
const hiddenReorder = reorderLayerObject(
  { ...layered, objects: [artwork, hiddenCut] },
  cutline.id,
  0
)
assert.equal(
  hiddenReorder.objects[0].exportEnabled,
  true,
  'hidden cutline still belongs in production export'
)
const locked = { ...layered, objects: [{ ...artwork, locked: true }, cutline] }
assert.equal(reorderLayerObject(locked, artwork.id, 1), locked)
assert.equal(renameLayerObject(locked, artwork.id, 'Changed'), locked)
const masked = { ...layered, clippingMaskEnabled: true, artworkObjectId: artwork.id }
assert.equal(isSelectableLayerObject(masked, artwork), false)
assert.equal(reorderLayerObject(masked, artwork.id, 1), masked)
console.log('Editor layer stacking, selection, and production metadata tests passed.')

const realMask = {
  ...cutline,
  id: 'active-mask',
  role: 'clipping-mask' as const,
  type: 'mask' as const,
  locked: true,
  exportEnabled: false
}
const protectedPiece = synchronizePieceEditorModel({
  ...piece,
  clippingMaskEnabled: true,
  maskWorkflowVersion: 3,
  maskObjectId: realMask.id,
  objects: [{ ...artwork, locked: true }, realMask]
})
const editableMask = synchronizePieceEditorModel(setMaskEditing(protectedPiece, true))
assert.equal(editableMask.objects.find((object) => object.id === artwork.id)?.locked, false)
assert.equal(editableMask.objects.find((object) => object.id === realMask.id)?.locked, false)
assert.equal(isSelectableLayerObject(editableMask, editableMask.objects[0]), true)
assert.deepEqual(
  editableMask.objects.map((object) => object.transform),
  protectedPiece.objects.map((object) => object.transform),
  'entering clipping-group edit mode must not move or rescale artwork'
)
const finishedMask = synchronizePieceEditorModel(setMaskEditing(editableMask, false))
assert.equal(finishedMask.clippingMaskEnabled, true)
assert.ok(finishedMask.objects.every((object) => object.locked))
