import assert from 'node:assert/strict'
import { createPiecePresetFromSource } from './piecePresets'
import {
  makeClippingMaskAndCutlineFromSelection,
  synchronizePieceEditorModel
} from './editorObjects'
import { getPieceEditorViewBounds, getCutViewMask } from './pieceEditorView'
import { nudgeCutline, setCutlineOffset } from './cutlineAdjustment'
import type { EditorObject } from '../types'

const photo = createPiecePresetFromSource(
  {
    id: 'view-source',
    sourceKind: 'image',
    fileName: 'photo.jpg',
    displayName: 'photo',
    mimeType: 'image/jpeg',
    bytes: new Uint8Array(),
    previewUrl: 'blob:view',
    naturalWidthPx: 1440,
    naturalHeightPx: 960
  },
  []
)
const cut: EditorObject = {
  id: 'view-cut',
  type: 'cutline',
  role: 'cutline',
  shapeType: 'ellipse',
  name: 'CutContour',
  visible: true,
  locked: false,
  exportEnabled: true,
  offsetMm: 0,
  transform: { xCm: 6.5, yCm: 3.5, widthCm: 5, heightCm: 5, rotation: 0 }
}
const cutPhoto = synchronizePieceEditorModel({
  ...photo,
  objects: [...photo.objects, cut],
  cutlineObjectId: cut.id
})
const masked = makeClippingMaskAndCutlineFromSelection(cutPhoto, [photo.artworkObjectId!, cut.id])
const snapshot = JSON.stringify(masked)
assert.deepEqual(getPieceEditorViewBounds(masked, false), {
  xCm: 0,
  yCm: 0,
  widthCm: 18,
  heightCm: 12
})
assert.deepEqual(getPieceEditorViewBounds(masked, true), {
  xCm: 6.5,
  yCm: 3.5,
  widthCm: 5,
  heightCm: 5
})
assert.equal(
  JSON.stringify(masked),
  snapshot,
  'focusing the sticker does not mutate production geometry'
)
assert.equal(getCutViewMask(masked)?.id, masked.maskObjectId)
assert.equal(
  getCutViewMask(cutPhoto)?.id,
  cut.id,
  'contour-only artwork is cropped for the preview'
)
assert.equal(getCutViewMask(photo), undefined, 'uncut artwork remains fully visible')
assert.deepEqual(getPieceEditorViewBounds(photo, true), getPieceEditorViewBounds(photo, false))

const offset = setCutlineOffset(masked, cut.id, 1)
const expanded = getPieceEditorViewBounds(offset, true)
assert.ok(Math.abs(expanded.xCm - 6.4) < 1e-9)
assert.ok(Math.abs(expanded.yCm - 3.4) < 1e-9)
assert.ok(Math.abs(expanded.widthCm - 5.2) < 1e-9, 'outward cut margin stays visible')
assert.deepEqual(
  getPieceEditorViewBounds(setCutlineOffset(masked, cut.id, -1), true),
  getPieceEditorViewBounds(masked, true),
  'inward trim still shows the entire mask'
)
const moved = getPieceEditorViewBounds(nudgeCutline(masked, cut.id, 10, 0), true)
assert.deepEqual(
  moved,
  { xCm: 6.5, yCm: 3.5, widthCm: 6, heightCm: 5 },
  'camera includes moved contour and mask'
)

const rotatedCircle = synchronizePieceEditorModel({
  ...cutPhoto,
  objects: cutPhoto.objects.map((object) =>
    object.id === cut.id ? { ...object, transform: { ...object.transform, rotation: 45 } } : object
  )
})
assert.deepEqual(
  getPieceEditorViewBounds(rotatedCircle, true),
  getPieceEditorViewBounds(cutPhoto, true),
  'rotated circles keep a tight preview'
)
const rotatedRectangle = synchronizePieceEditorModel({
  ...cutPhoto,
  objects: cutPhoto.objects.map((object) =>
    object.id === cut.id
      ? {
          ...object,
          shapeType: 'rectangle' as const,
          transform: { xCm: -2, yCm: -1, widthCm: 4, heightCm: 2, rotation: 90 }
        }
      : object
  )
})
const rectangleBounds = getPieceEditorViewBounds(rotatedRectangle, true)
assert.ok(Math.abs(rectangleBounds.xCm + 1) < 1e-9)
assert.ok(Math.abs(rectangleBounds.yCm + 2) < 1e-9)
assert.ok(Math.abs(rectangleBounds.widthCm - 2) < 1e-9)
assert.ok(
  Math.abs(rectangleBounds.heightCm - 4) < 1e-9,
  'rotated contours outside the source frame remain visible'
)
console.log('Cutter focused sticker view tests passed.')
