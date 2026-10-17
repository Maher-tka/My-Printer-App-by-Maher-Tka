import assert from 'node:assert/strict'
import { DEFAULT_CUTTER_SHEET, getSafeArea } from './cutterLayout'
import {
  getPlacedArtworkRect,
  getPlacedCutlineRect,
  getPlacedProductionBounds
} from './cutlineGenerator'
import {
  createPiecePresetFromSource,
  createPlacedPieceFromPreset,
  syncPieceBounds
} from './piecePresets'
import { moveLayoutSelection } from './manualLayout'
import { autoArrangePieces } from './nesting'
import { rebuildOrderLayout } from './orderLayout'
import { createCutlineFromArtworkBounds } from './cutlineValidation'
import { exportCutterSvg } from './svgExport'
import { createCutterProjectFile, deserializeCutterProjectPayload } from '@/projects/projectFiles'
import type { PiecePreset, PlacedPiece } from '../types'

const sheet = {
  ...DEFAULT_CUTTER_SHEET,
  widthCm: 20,
  heightCm: 12,
  safeMarginCm: 0,
  spacingMm: 0,
  snapToGrid: false,
  autoExpandHeight: false,
  lengthMode: 'fixed' as const
}
const source = {
  id: 'source',
  sourceKind: 'image' as const,
  fileName: 'sticker.png',
  displayName: 'Sticker',
  mimeType: 'image/png',
  bytes: new Uint8Array([1]),
  previewUrl: 'data:image/png;base64,AA==',
  naturalWidthPx: 400,
  naturalHeightPx: 200
}
const piece = createCutlineFromArtworkBounds(
  syncPieceBounds(createPiecePresetFromSource(source, []), 4, 2)
)
const other = {
  ...createCutlineFromArtworkBounds(syncPieceBounds(createPiecePresetFromSource(source, []), 6, 3)),
  id: 'other'
}
function place(
  preset: PiecePreset,
  id: string,
  xCm: number,
  yCm: number,
  extra: Partial<PlacedPiece> = {}
) {
  return { ...createPlacedPieceFromPreset(preset, xCm, yCm), id, sheetIndex: 0, ...extra }
}
const original = [
  place(piece, 'drag', 0, 0),
  place(other, 'neighbor', 6, 0),
  place(piece, 'far', 14, 8),
  place(piece, 'other-sheet', 6, 0, { sheetIndex: 1 })
]
const before = JSON.stringify(original)
const result = moveLayoutSelection(original, [piece, other], sheet, 'drag', 7, 0)
assert.equal(result.error, null)
assert.equal(result.movedCount, 1)
assert.equal(result.rearrangedCount, 1)
assert.equal(result.placedPieces[0].xCm, 7)
assert.notDeepEqual(result.placedPieces[1], original[1])
assert.equal(result.placedPieces[2], original[2], 'unaffected stickers retain their state')
assert.equal(result.placedPieces[3], original[3], 'other physical sheets do not move')
assert.equal(
  JSON.stringify(original),
  before,
  'moving is atomic and does not mutate the undo snapshot'
)
for (let i = 0; i < 2; i++) {
  const moved = result.placedPieces[i],
    prior = original[i]
  const preset = i === 0 ? piece : other
  assert.equal(moved.id, prior.id)
  assert.deepEqual(moved.artworkTransform, prior.artworkTransform)
  assert.deepEqual(moved.cutlineTransform, prior.cutlineTransform)
  assert.deepEqual(moved.productionBoundsCm, getPlacedProductionBounds(moved, preset))
  const oldArt = getPlacedArtworkRect(prior, preset),
    newArt = getPlacedArtworkRect(moved, preset)
  const oldCut = getPlacedCutlineRect(prior, preset),
    newCut = getPlacedCutlineRect(moved, preset)
  assert.ok(Math.abs(newArt.xCm - oldArt.xCm - (newCut.xCm - oldCut.xCm)) < 1e-7)
  assert.ok(Math.abs(newArt.yCm - oldArt.yCm - (newCut.yCm - oldCut.yCm)) < 1e-7)
}
const locked = original.map((p) => (p.id === 'neighbor' ? { ...p, locked: true } : p))
const blocked = moveLayoutSelection(locked, [piece, other], sheet, 'drag', 7, 0)
assert.match(blocked.error!, /locked sticker/)
assert.equal(blocked.placedPieces, locked)
assert.equal(
  moveLayoutSelection(locked, [piece, other], sheet, 'neighbor', 1, 1).placedPieces,
  locked
)
const tight = { ...sheet, widthCm: 10, heightCm: 3 }
const tightPlacements = [place(piece, 'drag', 0, 0), place(other, 'neighbor', 4, 0)]
const noRoom = moveLayoutSelection(tightPlacements, [piece, other], tight, 'drag', 3, 0)
assert.match(noRoom.error!, /not enough free space/)
assert.equal(
  noRoom.placedPieces,
  tightPlacements,
  'a failed rearrangement keeps every original sticker'
)
const group = [
  place(piece, 'a', 0, 0),
  place(piece, 'b', 4, 0),
  place(piece, 'c', 12, 0, { locked: true })
]
const grouped = moveLayoutSelection(group, [piece], sheet, 'a', -100, 20, ['a', 'b', 'c'])
assert.equal(grouped.error, null)
assert.equal(grouped.placedPieces[1].xCm - grouped.placedPieces[0].xCm, 4)
assert.equal(grouped.placedPieces[1].yCm - grouped.placedPieces[0].yCm, 0)
assert.equal(grouped.placedPieces[2], group[2])
assert.equal(grouped.placedPieces[0].yCm, 10)
const snappedSheet = {
  ...sheet,
  safeMarginCm: 0.3,
  spacingMm: 3,
  snapToGrid: true,
  gridStepCm: 0.5
}
const arranged = autoArrangePieces(
  [
    { ...piece, quantity: 20 },
    { ...other, quantity: 8 }
  ],
  snappedSheet
).placedPieces
const dragged = arranged[0],
  target = arranged[2]
const packed = moveLayoutSelection(
  arranged,
  [piece, other],
  snappedSheet,
  dragged.id,
  target.xCm,
  target.yCm
)
assert.equal(packed.error, null)
assert.equal(packed.placedPieces.length, arranged.length)
const safe = getSafeArea(snappedSheet)
for (const a of packed.placedPieces) {
  const bounds = a.productionBoundsCm!
  assert.ok(bounds.xCm >= safe.xCm - 1e-7 && bounds.yCm >= safe.yCm - 1e-7)
  assert.ok(bounds.xCm + bounds.widthCm <= safe.xCm + safe.widthCm + 1e-7)
  assert.ok(bounds.yCm + bounds.heightCm <= safe.yCm + safe.heightCm + 1e-7)
  for (const b of packed.placedPieces) {
    if (a.id === b.id || a.sheetIndex !== b.sheetIndex) continue
    const r = b.productionBoundsCm!
    assert.ok(
      bounds.xCm + bounds.widthCm + 0.3 <= r.xCm + 1e-7 ||
        r.xCm + r.widthCm + 0.3 <= bounds.xCm + 1e-7 ||
        bounds.yCm + bounds.heightCm + 0.3 <= r.yCm + 1e-7 ||
        r.yCm + r.heightCm + 0.3 <= bounds.yCm + 1e-7,
      'rearranged stickers preserve production spacing'
    )
  }
}
const retained = rebuildOrderLayout(
  [
    { ...piece, quantity: 1 },
    { ...other, quantity: 1 }
  ],
  { ...sheet, preserveManualPositions: true },
  result.placedPieces.slice(0, 2)
)
assert.deepEqual(
  retained.placedPieces.map((p) => [p.id, p.xCm, p.yCm]),
  result.placedPieces.slice(0, 2).map((p) => [p.id, p.xCm, p.yCm]),
  'manual arrangement survives order rebuilding'
)
assert.equal(
  moveLayoutSelection(original, [piece, other], sheet, 'drag', NaN, 2).placedPieces,
  original
)
// Export uses the edited placement for both the artwork and CutContour.
const project = {
  sheet: { ...sheet, preserveManualPositions: true },
  sources: [source],
  pieces: [piece, other],
  placedPieces: result.placedPieces.slice(0, 2),
  layers: { artwork: true, cutlines: true },
  exportSettings: { strokeName: 'CutContour', includeArtwork: true, includeCutlines: true }
}
const svg = await (await exportCutterSvg(project)).blob.text()
assert.match(svg, /<g id="artwork-drag"[^>]*>\s*<image[^>]*x="70" y="0" width="40" height="20"/)
assert.match(svg, /<rect x="70" y="0" width="40" height="20"[^>]*id="CutContour-drag-/)
const file = createCutterProjectFile({
  ...project,
  mode: 'montage-sheet',
  activePieceId: piece.id,
  selectedPlacedIds: ['drag'],
  selectedEditorObjects: [],
  keyObject: { object: null }
})
const restored = deserializeCutterProjectPayload(JSON.parse(JSON.stringify(file.payload)))
assert.equal(restored.sheet.preserveManualPositions, true)
assert.deepEqual(
  restored.placedPieces,
  project.placedPieces,
  'project save/reopen retains the manually edited placements'
)

// Rotated and independently resized copies retain their local artwork/cutline relationship.
const rotated = place(piece, 'rotated', 1, 2, { rotation: 90, widthCm: 3, heightCm: 6 })
const rotatedResult = moveLayoutSelection([rotated], [piece], sheet, 'rotated', 10, 5)
assert.equal(rotatedResult.error, null)
const movedRotated = rotatedResult.placedPieces[0]
assert.equal(movedRotated.rotation, 90)
assert.equal(movedRotated.widthCm, 3)
assert.equal(movedRotated.heightCm, 6)
for (const getRect of [getPlacedArtworkRect, getPlacedCutlineRect]) {
  const beforeRect = getRect(rotated, piece),
    afterRect = getRect(movedRotated, piece)
  assert.ok(Math.abs(afterRect.xCm - beforeRect.xCm - (movedRotated.xCm - rotated.xCm)) < 1e-7)
  assert.ok(Math.abs(afterRect.yCm - beforeRect.yCm - (movedRotated.yCm - rotated.yCm)) < 1e-7)
  assert.equal(afterRect.rotation, beforeRect.rotation)
}
const offsetPiece: PiecePreset = {
  ...piece,
  cutline: { ...piece.cutline, transform: { ...piece.cutline.transform, offsetMm: 2 } },
  objects: piece.objects.map((object) =>
    object.role === 'cutline' ? { ...object, offsetMm: 2 } : object
  )
}
const offsetPlaced = place(offsetPiece, 'offset', 2, 2)
const offsetMove = moveLayoutSelection([offsetPlaced], [offsetPiece], sheet, 'offset', -100, -100)
assert.equal(offsetMove.error, null)
assert.ok(Math.abs(offsetMove.placedPieces[0].productionBoundsCm!.xCm) < 1e-7)
assert.ok(Math.abs(offsetMove.placedPieces[0].productionBoundsCm!.yCm) < 1e-7)
assert.ok(
  offsetMove.placedPieces[0].xCm > 0,
  'cut margin remains inside the safe area even when the artwork is dragged to the edge'
)
assert.deepEqual(offsetMove.placedPieces[0].cutlineTransform, offsetPlaced.cutlineTransform)
console.log(
  'Manual sticker moves, nearby rearrangement, cutline offsets, groups, locks and spacing passed.'
)
