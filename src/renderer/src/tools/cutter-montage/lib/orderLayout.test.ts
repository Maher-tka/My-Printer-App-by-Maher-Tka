import assert from 'node:assert/strict'
import fixture from './orderLayout.fixture.json'
import type { CutterProject, CutterSheetSettings, PiecePreset } from '../types'
import { synchronizePieceEditorModel } from './editorObjects'
import { autoArrangePieces, getPieceCapacityForTargetLength } from './nesting'
import { getCutterOrderLimitMessage, MAX_CUTTER_JOB_COPIES } from './layoutLimits'
import { duplicatePiecePreset } from './piecePresets'
import { getPieceSize, resizePieceToSize } from './pieceSize'
import { getProductionSheetLayoutGroups } from './productionSheetGroups'
import { getProductionSheetProject } from './productionSheets'
import { getOrderLayoutSignature, getSheetDesignCounts, rebuildOrderLayout } from './orderLayout'

const sheet = fixture.sheet as CutterSheetSettings
const pieces = (fixture.pieces as unknown as PiecePreset[]).map((piece) =>
  synchronizePieceEditorModel(piece)
)
const firstOnly = rebuildOrderLayout([pieces[0]], sheet, [])
assert.equal(firstOnly.placedCount, 800)
const restored = rebuildOrderLayout(pieces, sheet, firstOnly.placedPieces)
assert.equal(
  restored.placedCount,
  801,
  'saved project adds its missing second design automatically'
)
assert.equal(count(restored, pieces[1].id), 1)
assertCountsMatchOrders(restored)

const increased = rebuildOrderLayout(
  [
    { ...pieces[0], quantity: 18 },
    { ...pieces[1], quantity: 12 }
  ],
  sheet,
  restored.placedPieces
)
assert.equal(increased.placedCount, 30, 'quantity changes update total copies')
assert.equal(count(increased, pieces[0].id), 18)
assert.equal(count(increased, pieces[1].id), 12)
assertCountsMatchOrders(increased)
const decreased = rebuildOrderLayout(
  [{ ...increased.pieces[0], quantity: 3 }, increased.pieces[1]],
  sheet,
  increased.placedPieces
)
assert.equal(decreased.placedCount, 15, 'decrease removes surplus copies')
assertCountsMatchOrders(decreased)

const resized = resizePieceToSize(pieces[0], 3, getPieceSize(pieces[0]).heightCm, 'width')
const resizedOrder = rebuildOrderLayout([resized, pieces[1]], sheet, restored.placedPieces)
assert.equal(resizedOrder.placedCount, 801, 'size edits preserve copy orders')
assert.ok(
  resizedOrder.sheetCount! < restored.sheetCount!,
  'size edits compact all designs across sheets'
)
assertCountsMatchOrders(resizedOrder)

const metrePiece = { ...pieces[0], orderMode: 'target-length' as const, targetLengthCm: 50 }
const metreOrder = rebuildOrderLayout([metrePiece, pieces[1]], sheet, restored.placedPieces)
const resizedMetre = resizePieceToSize(
  metreOrder.pieces[0],
  3,
  getPieceSize(metreOrder.pieces[0]).heightCm,
  'width'
)
const newMetreOrder = rebuildOrderLayout([resizedMetre, pieces[1]], sheet, metreOrder.placedPieces)
assert.equal(
  newMetreOrder.pieces[0].quantity,
  getPieceCapacityForTargetLength(resizedMetre, sheet, 50)
)
assert.ok(
  newMetreOrder.pieces[0].quantity > metreOrder.pieces[0].quantity,
  'metre count increases for smaller stickers'
)
assertCountsMatchOrders(newMetreOrder)

const duplicate = { ...duplicatePiecePreset(pieces[1], pieces), quantity: 7 }
const added = rebuildOrderLayout([...decreased.pieces, duplicate], sheet, decreased.placedPieces)
assert.equal(added.placedCount, 22, 'new design joins the existing layout immediately')
assert.equal(count(added, duplicate.id), 7)
assertCountsMatchOrders(added)
const removed = rebuildOrderLayout(
  added.pieces.filter((piece) => piece.id !== duplicate.id),
  sheet,
  added.placedPieces
)
assert.equal(removed.placedCount, 15, 'deleted designs leave no phantom copies')

const maskEdit = {
  ...pieces[0],
  objects: pieces[0].objects.map((object) =>
    object.id === pieces[0].maskObjectId
      ? { ...object, transform: { ...object.transform, widthCm: 2 } }
      : object
  )
}
assert.notEqual(
  getOrderLayoutSignature([pieces[0]], sheet),
  getOrderLayoutSignature([maskEdit], sheet),
  'mask-only edits invalidate layout even when frame size stays the same'
)
assert.equal(
  getOrderLayoutSignature(pieces, sheet),
  getOrderLayoutSignature(pieces, { ...sheet, showGrid: !sheet.showGrid }),
  'view changes do not move stickers'
)
const manualPiece = { ...pieces[1], quantity: 1 }
const locked = {
  ...decreased.placedPieces.find((placed) => placed.presetId === manualPiece.id)!,
  locked: true
}
const manual = rebuildOrderLayout([manualPiece], { ...sheet, preserveManualPositions: true }, [
  locked,
  { ...locked, id: 'surplus' }
])
assert.equal(manual.placedCount, 1, 'manual layouts still trim surplus quantities')
assert.equal(manual.placedPieces[0].id, locked.id)
assert.equal(manual.placedPieces[0].xCm, locked.xCm, 'manual position remains intact')

function count(layout: ReturnType<typeof rebuildOrderLayout>, id: string): number {
  return layout.placedPieces.filter((placed) => placed.presetId === id).length
}

function assertCountsMatchOrders(layout: ReturnType<typeof rebuildOrderLayout>): void {
  for (const piece of layout.pieces) assert.equal(count(layout, piece.id), piece.quantity)
  const project = {
    pieces: layout.pieces,
    placedPieces: layout.placedPieces,
    sheet: layout.sheet
  } as CutterProject
  const groups = getProductionSheetLayoutGroups(project)
  let total = 0
  for (const group of groups) {
    const sheetProject = getProductionSheetProject(project, group.templateSheetIndex)
    const breakdown = getSheetDesignCounts(layout.pieces, sheetProject.placedPieces)
    assert.equal(
      breakdown.reduce((sum, design) => sum + design.count, 0),
      group.copiesPerSheet
    )
    total += breakdown.reduce((sum, design) => sum + design.count * group.repeatCount, 0)
  }
  assert.equal(
    total,
    layout.placedCount,
    'per-design and repeated-sheet counts agree with job total'
  )
}

const autoSheet = { ...sheet, autoExpandHeight: true }
const shortOrder = rebuildOrderLayout([{ ...pieces[0], quantity: 10 }], autoSheet, [])
const longOrder = rebuildOrderLayout(
  [{ ...pieces[0], quantity: 300 }],
  autoSheet,
  shortOrder.placedPieces
)
assert.equal(longOrder.sheetCount, 1, 'height expands instead of adding a sheet prematurely')
assert.ok(longOrder.sheet.heightCm > shortOrder.sheet.heightCm, 'more copies grow the sheet height')
assert.ok(longOrder.sheet.heightCm <= 140, 'auto height respects the physical cutter limit')
const overflowOrder = rebuildOrderLayout(
  [{ ...pieces[0], quantity: 1000 }],
  autoSheet,
  longOrder.placedPieces
)
assert.ok(overflowOrder.sheetCount! > 1, 'overflow creates additional physical sheets')
assertCountsMatchOrders(overflowOrder)
for (let index = 0; index < overflowOrder.sheetCount!; index++) {
  const output = getProductionSheetProject(
    {
      pieces: overflowOrder.pieces,
      placedPieces: overflowOrder.placedPieces,
      sheet: overflowOrder.sheet
    } as CutterProject,
    index
  )
  assert.ok(output.sheet.heightCm <= 140)
  for (const placed of output.placedPieces) {
    const bounds = placed.productionBoundsCm!
    assert.ok(
      bounds.yCm + bounds.heightCm <= output.sheet.heightCm - sheet.safeMarginCm + 1e-9,
      'canvas/export height contains each sticker and its cutter margin'
    )
  }
}
const fixedOrder = rebuildOrderLayout(
  [{ ...pieces[0], quantity: 300 }],
  { ...sheet, heightCm: 50, autoExpandHeight: false, lengthMode: 'fixed' },
  []
)
assert.equal(fixedOrder.sheet.heightCm, 50, 'fixed height remains available')
assert.ok(fixedOrder.sheetCount! > longOrder.sheetCount!, 'fixed height uses more sheets')
const spacedOrder = rebuildOrderLayout(
  [{ ...pieces[0], quantity: 150 }],
  { ...autoSheet, spacingMm: 20 },
  []
)
assert.notEqual(
  getOrderLayoutSignature(shortOrder.pieces, autoSheet),
  getOrderLayoutSignature(shortOrder.pieces, { ...autoSheet, spacingMm: 20 }),
  'spacing changes invalidate layout'
)
assertCountsMatchOrders(spacedOrder)

for (const quantity of [1e9, Number.MAX_SAFE_INTEGER, Infinity, NaN, -1, 2.5]) {
  const rejected = autoArrangePieces([{ ...pieces[0], quantity }], sheet, firstOnly.placedPieces)
  assert.match(rejected.warning ?? '', /5,000/)
  assert.equal(
    rejected.placedPieces,
    firstOnly.placedPieces,
    'invalid quantities keep the previous sheet without generating copies'
  )
}
assert.ok(
  getCutterOrderLimitMessage([{ quantity: MAX_CUTTER_JOB_COPIES }, { quantity: 1 }]),
  'total job limit applies across different designs'
)
assert.equal(getCutterOrderLimitMessage([{ quantity: MAX_CUTTER_JOB_COPIES }]), null)
assert.equal(
  getCutterOrderLimitMessage([{ quantity: 0 }, { quantity: 10 }]),
  null,
  'internal selected-design arrangement remains supported'
)

console.log(
  'Mixed sticker order and automatic-height layout tests passed (workshop project geometry).'
)
