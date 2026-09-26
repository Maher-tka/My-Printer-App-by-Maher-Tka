import { DEFAULT_CUTTER_SHEET } from '../lib/cutterLayout'
import { createCutlineFromArtworkBounds } from '../lib/cutlineValidation'
import { autoArrangePieces, getPieceCapacityForTargetLength } from '../lib/nesting'
import { getPlacedSheetIndex, getProductionSheetCount } from '../lib/productionSheets'
import {
  createPiecePresetFromSource,
  createPlacedPieceFromPreset,
  resizePiecePreset
} from '../lib/piecePresets'
import type { PiecePreset, PieceSourceFile, PlacedPiece } from '../types'
import {
  canRestoreAutoArrangeSnapshot,
  clearArrangedRepackWarnings,
  createAutoArrangeUndoSnapshot,
  getLockedRepackWarningPieceIds,
  migrateLegacyProductionLayout,
  preparePlacedPiecesForExplicitArrange,
  reconcilePieceUpdate,
  resizeCutterProductionLayout,
  restoreUnselectedPlacementLocks
} from './useCutterProject'

function run(): void {
  const piece = createPiece('piece-a', 'Piece A', 3)
  const otherPiece = createPiece('piece-b', 'Piece B', 1)
  const first = placed(piece, 'keep-first', 7, 11, 0, true)
  const second = placed(piece, 'keep-second', 19, 23, 90, false)
  const third = placed(piece, 'remove-third', 31, 37, 180, true)
  const other = placed(otherPiece, 'keep-other', 43, 47, 270, true)

  const snapshotPieces = [piece, otherPiece]
  const guardedSnapshot = createAutoArrangeUndoSnapshot(
    [first, other],
    new Set(),
    snapshotPieces,
    DEFAULT_CUTTER_SHEET
  )
  expect(
    canRestoreAutoArrangeSnapshot(guardedSnapshot, snapshotPieces, { ...DEFAULT_CUTTER_SHEET }),
    'unchanged normalized sheet allows undo'
  )
  expect(
    !canRestoreAutoArrangeSnapshot(guardedSnapshot, [piece], DEFAULT_CUTTER_SHEET),
    'deleting a preset invalidates undo instead of resurrecting missing artwork'
  )
  expect(
    !canRestoreAutoArrangeSnapshot(
      guardedSnapshot,
      [{ ...piece, widthCm: 20 }, otherPiece],
      DEFAULT_CUTTER_SHEET
    ),
    'geometry edits invalidate stale placement snapshots'
  )
  expect(
    !canRestoreAutoArrangeSnapshot(guardedSnapshot, snapshotPieces, {
      ...DEFAULT_CUTTER_SHEET,
      safeMarginCm: DEFAULT_CUTTER_SHEET.safeMarginCm + 1
    }),
    'sheet edits invalidate obsolete arrangements'
  )

  const decreased = reconcilePieceUpdate(
    [piece, otherPiece],
    [first, other, second, third],
    { ...piece, quantity: 1 },
    DEFAULT_CUTTER_SHEET
  )
  const decreasedCopies = copiesOf(decreased.placedPieces, piece.id)

  expectEqual(decreasedCopies.length, 1, 'quantity decrease removes only the excess')
  expectPlacement(decreasedCopies[0], first, 'the first copy is retained deterministically')
  expectPlacement(
    decreased.placedPieces.find((candidate) => candidate.id === other.id),
    other,
    'another preset is untouched'
  )
  expectEqual(decreased.removedCopyCount, 2, 'removed copy count is reported')

  const twoCopyPiece = { ...piece, quantity: 2 }
  const resized = { ...resizePiecePreset(twoCopyPiece, 8, 6, 'width'), quantity: 4 }
  const increased = reconcilePieceUpdate(
    [twoCopyPiece, otherPiece],
    [first, other, second],
    resized,
    { ...DEFAULT_CUTTER_SHEET, preserveManualPositions: false }
  )
  const increasedCopies = copiesOf(increased.placedPieces, piece.id)

  expectEqual(increasedCopies.length, 4, 'quantity increase adds only the missing copies')
  expectPlacement(increasedCopies[0], first, 'locked placement survives resize and increase')
  expect(
    !increasedCopies.some((candidate) => candidate.id === second.id),
    'unlocked placement is recreated so the resized montage can repack'
  )
  expectEqual(increasedCopies[0].widthCm, resized.widthCm, 'retained geometry refreshes')
  expectEqual(increasedCopies[1].widthCm, resized.widthCm, 'repacked width refreshes')
  expectEqual(increasedCopies[1].heightCm, resized.heightCm, 'repacked height refreshes')
  expectEqual(increased.lockedRetainedCopyCount, 1, 'only the locked copy stays in place')
  expectEqual(increased.addedCopyCount, 3, 'repacked and missing copies are reported')
  expectEqual(increased.removedCopyCount, 1, 'unlocked stale placement is replaced')
  expectPlacement(
    increased.placedPieces.find((candidate) => candidate.id === other.id),
    other,
    'focused reconciliation does not rearrange another preset'
  )

  const firstCommit = reconcilePieceUpdate(
    [twoCopyPiece],
    [first, second],
    resizePiecePreset(twoCopyPiece, 7, 99, 'width'),
    DEFAULT_CUTTER_SHEET
  )
  const secondCommit = reconcilePieceUpdate(
    firstCommit.pieces,
    firstCommit.placedPieces,
    { ...firstCommit.piece, quantity: 3 },
    DEFAULT_CUTTER_SHEET
  )

  expectEqual(secondCommit.piece.widthCm, 7, 'a sequential quantity commit keeps the prior resize')
  expectEqual(
    copiesOf(secondCommit.placedPieces, piece.id).length,
    3,
    'sequential commit adds one copy'
  )

  const artworkOnlyPiece = createArtworkOnlyFourCmPiece(24)
  const artworkOnlyInitialLayout = autoArrangePieces([artworkOnlyPiece], DEFAULT_CUTTER_SHEET)
  const artworkOnlyHundred = reconcilePieceUpdate(
    [artworkOnlyPiece],
    artworkOnlyInitialLayout.placedPieces,
    { ...artworkOnlyPiece, quantity: 100 },
    DEFAULT_CUTTER_SHEET
  )

  expectEqual(artworkOnlyPiece.cutlineObjectId, undefined, 'fixture remains artwork-only')
  expectEqual(
    artworkOnlyInitialLayout.placedCount,
    24,
    'artwork-only fixture starts with the reported 24 arranged copies'
  )
  expectEqual(
    copiesOf(artworkOnlyHundred.placedPieces, artworkOnlyPiece.id).length,
    100,
    'increasing a 4 cm artwork-only piece from 24 to 100 adds every missing copy'
  )
  expectEqual(artworkOnlyHundred.addedCopyCount, 76, 'artwork-only increase reports 76 new copies')
  expectEqual(
    artworkOnlyHundred.warning,
    null,
    '4 cm artwork-only copies all fit production sheets'
  )

  const largeArtworkOnlyPiece = createArtworkOnlySquarePiece(24, 18)
  const largeInitialLayout = autoArrangePieces([largeArtworkOnlyPiece], DEFAULT_CUTTER_SHEET)
  const resizedArtworkOnlyPiece = resizePiecePreset(largeArtworkOnlyPiece, 4, 4, 'width')
  const resizedFirst = reconcilePieceUpdate(
    [largeArtworkOnlyPiece],
    largeInitialLayout.placedPieces,
    resizedArtworkOnlyPiece,
    DEFAULT_CUTTER_SHEET
  )
  const sizeThenQuantity = reconcilePieceUpdate(
    resizedFirst.pieces,
    resizedFirst.placedPieces,
    { ...resizedFirst.piece, quantity: 100 },
    DEFAULT_CUTTER_SHEET
  )

  expectEqual(
    copiesOf(resizedFirst.placedPieces, largeArtworkOnlyPiece.id).length,
    24,
    'size edit keeps all 24 requested copies'
  )
  expectEqual(
    new Set(resizedFirst.placedPieces.map(getPlacedSheetIndex)).size,
    1,
    'size edit immediately repacks the original 24 copies onto one compact sheet'
  )
  expectEqual(
    copiesOf(sizeThenQuantity.placedPieces, largeArtworkOnlyPiece.id).length,
    100,
    'size then quantity produces all 100 copies'
  )
  expectEqual(
    getProductionSheetCount(sizeThenQuantity.placedPieces),
    1,
    'size then quantity keeps all 100 four-centimeter copies on one production sheet'
  )

  const quantityFirst = reconcilePieceUpdate(
    [largeArtworkOnlyPiece],
    largeInitialLayout.placedPieces,
    { ...largeArtworkOnlyPiece, quantity: 100 },
    DEFAULT_CUTTER_SHEET
  )
  const quantityThenSize = reconcilePieceUpdate(
    quantityFirst.pieces,
    quantityFirst.placedPieces,
    resizePiecePreset(quantityFirst.piece, 4, 4, 'width'),
    DEFAULT_CUTTER_SHEET
  )

  expectEqual(
    copiesOf(quantityThenSize.placedPieces, largeArtworkOnlyPiece.id).length,
    100,
    'quantity then size preserves all 100 copies'
  )
  expectEqual(
    getProductionSheetCount(quantityThenSize.placedPieces),
    1,
    'quantity then size repacks all 100 four-centimeter copies onto one production sheet'
  )

  const hundredLargeCopies = createArtworkOnlySquarePiece(100, 15.68)
  const hundredLargeLayout = autoArrangePieces([hundredLargeCopies], DEFAULT_CUTTER_SHEET)
  expectEqual(hundredLargeLayout.placedCount, 100, 'all 100 15.68 cm copies are placed')
  expectEqual(
    getProductionSheetCount(hundredLargeLayout.placedPieces),
    4,
    '100 copies at 15.68 cm use four 1 m production sheets instead of one row per sheet'
  )

  const lockedTenCmPiece = { ...createArtworkOnlySquarePiece(100, 10), locked: true }
  const legacyOneRowLayout = autoArrangePieces([lockedTenCmPiece], {
    ...DEFAULT_CUTTER_SHEET,
    heightCm: 13.5
  })
  expectEqual(
    getProductionSheetCount(legacyOneRowLayout.placedPieces),
    13,
    'legacy 13.5 cm packing reproduces the thirteen one-row sheets'
  )
  const explicitArrangeInput = preparePlacedPiecesForExplicitArrange(
    legacyOneRowLayout.placedPieces,
    new Set([lockedTenCmPiece.id]),
    false
  )
  const repairedOneMeterLayout = autoArrangePieces(
    [lockedTenCmPiece],
    DEFAULT_CUTTER_SHEET,
    explicitArrangeInput
  )
  expectEqual(
    getProductionSheetCount(repairedOneMeterLayout.placedPieces),
    2,
    'Arrange Copies rebuilds legacy locked rows into full one-meter sheets'
  )
  expect(
    repairedOneMeterLayout.placedPieces.every((placed) => placed.locked),
    'repacked copies restore the preset lock after their positions are rebuilt'
  )
  const migratedLegacyLayout = migrateLegacyProductionLayout(
    [lockedTenCmPiece],
    legacyOneRowLayout.placedPieces,
    { ...DEFAULT_CUTTER_SHEET, heightCm: 13.5 }
  )
  expectEqual(migratedLegacyLayout.migrated, true, 'legacy short-sheet projects migrate on open')
  expectEqual(migratedLegacyLayout.sheet.heightCm, 100, 'legacy projects reopen at one meter')
  expectEqual(
    getProductionSheetCount(migratedLegacyLayout.placedPieces),
    2,
    'opening a legacy project automatically rebuilds its thirteen rows into two sheets'
  )
  const screenshotPiece = {
    ...createArtworkOnlySquarePiece(125, 10),
    id: 'screenshot-stale-piece'
  }
  const screenshotStaleRows = Array.from({ length: 125 }, (_, index) => ({
    ...createPlacedPieceFromPreset(screenshotPiece, 1.5 + (index % 9) * 10.3, 1.5),
    sheetIndex: Math.floor(index / 9),
    locked: index % 2 === 0
  }))
  const screenshotRepacked = resizeCutterProductionLayout(
    [screenshotPiece],
    screenshotStaleRows,
    { ...DEFAULT_CUTTER_SHEET, heightCm: 76.5, lengthMode: 'fixed' },
    76.5
  )
  expect(
    screenshotRepacked.placedPieces.filter((placed) => getPlacedSheetIndex(placed) === 0).length >
      9,
    'reapplying the current drag height compacts a stale one-row sheet into multiple rows'
  )
  expect(
    screenshotRepacked.sheetCount < 14,
    'reapplying the current drag height removes the fourteen-sheet stale layout'
  )

  const overflowPiece = {
    ...resizePiecePreset(
      { ...createArtworkOnlySquarePiece(125, 10.9), lockAspectRatio: false },
      10.9,
      11.3,
      'height'
    ),
    id: 'stacked-overflow-piece',
    quantity: 125
  }
  const seventySixCentimeterStack = resizeCutterProductionLayout(
    [overflowPiece],
    [],
    DEFAULT_CUTTER_SHEET,
    76.5
  )
  const seventySixCentimeterCounts = Array.from(
    { length: seventySixCentimeterStack.sheetCount },
    (_, sheetIndex) =>
      seventySixCentimeterStack.placedPieces.filter(
        (placedPiece) => getPlacedSheetIndex(placedPiece) === sheetIndex
      ).length
  )
  expectEqual(
    seventySixCentimeterStack.sheetCount,
    3,
    'overflow copies automatically create three production sheets'
  )
  expectEqual(
    seventySixCentimeterCounts.join(','),
    '48,48,29',
    'overflow copies fill each following sheet in order'
  )

  const tallerStack = resizeCutterProductionLayout(
    seventySixCentimeterStack.pieces,
    seventySixCentimeterStack.placedPieces,
    seventySixCentimeterStack.sheet,
    100
  )
  const tallerCounts = Array.from(
    { length: tallerStack.sheetCount },
    (_, sheetIndex) =>
      tallerStack.placedPieces.filter(
        (placedPiece) => getPlacedSheetIndex(placedPiece) === sheetIndex
      ).length
  )
  expectEqual(tallerStack.sheetCount, 2, 'making the first sheet taller removes excess sheets')
  expectEqual(
    tallerCounts.join(','),
    '64,61',
    'resizing the first sheet reflows every remaining copy into the sheet below'
  )

  const shorterStack = resizeCutterProductionLayout(
    tallerStack.pieces,
    tallerStack.placedPieces,
    tallerStack.sheet,
    50
  )
  const shorterCounts = Array.from(
    { length: shorterStack.sheetCount },
    (_, sheetIndex) =>
      shorterStack.placedPieces.filter(
        (placedPiece) => getPlacedSheetIndex(placedPiece) === sheetIndex
      ).length
  )
  expectEqual(shorterStack.sheetCount, 6, 'making the first sheet shorter adds overflow sheets')
  expectEqual(
    shorterCounts.join(','),
    '24,24,24,24,24,5',
    'shortening the first sheet pushes all remaining copies through the sheets below'
  )

  const unselectedPreset = {
    ...createArtworkOnlySquarePiece(1, 5),
    id: 'unselected-piece'
  }
  const unselectedPlacement = {
    ...createPlacedPieceFromPreset(unselectedPreset, 30, 30),
    locked: false
  }
  const selectedPlacement = legacyOneRowLayout.placedPieces[0]
  const preparedSelection = preparePlacedPiecesForExplicitArrange(
    [selectedPlacement, unselectedPlacement],
    new Set([selectedPlacement.presetId]),
    false
  )
  expectEqual(
    preparedSelection.find((placed) => placed.id === unselectedPlacement.id)?.locked,
    true,
    'Arrange selected temporarily protects unselected placements'
  )
  const restoredSelection = restoreUnselectedPlacementLocks(
    preparedSelection,
    [selectedPlacement, unselectedPlacement],
    new Set([selectedPlacement.presetId])
  )
  expectEqual(
    restoredSelection.find((placed) => placed.id === unselectedPlacement.id)?.locked,
    false,
    'Arrange selected restores the original lock state of unselected placements'
  )

  const lengthOrderPiece = createArtworkOnlySquarePiece(1, 4)
  const halfMeterCapacity = getPieceCapacityForTargetLength(
    lengthOrderPiece,
    DEFAULT_CUTTER_SHEET,
    50
  )
  const oneMeterCapacity = getPieceCapacityForTargetLength(
    lengthOrderPiece,
    DEFAULT_CUTTER_SHEET,
    100
  )
  const onePointThreeMeterCapacity = getPieceCapacityForTargetLength(
    lengthOrderPiece,
    DEFAULT_CUTTER_SHEET,
    130
  )
  const onePointFourMeterCapacity = getPieceCapacityForTargetLength(
    lengthOrderPiece,
    DEFAULT_CUTTER_SHEET,
    140
  )
  expect(halfMeterCapacity > 0, 'a half-meter target produces a positive copy count')
  expect(oneMeterCapacity > halfMeterCapacity, 'one meter holds more copies than half a meter')
  expect(
    onePointThreeMeterCapacity > oneMeterCapacity,
    'a 1.3 meter target holds more copies than one meter'
  )
  expect(
    onePointFourMeterCapacity >= onePointThreeMeterCapacity,
    'a 1.4 meter target never holds fewer copies than 1.3 meters'
  )
  expectEqual(
    getProductionSheetCount(
      autoArrangePieces([{ ...lengthOrderPiece, quantity: halfMeterCapacity }], {
        ...DEFAULT_CUTTER_SHEET,
        heightCm: 50
      }).placedPieces
    ),
    1,
    'the calculated half-meter quantity fits exactly one target sheet'
  )
  expectEqual(
    getProductionSheetCount(
      autoArrangePieces([{ ...lengthOrderPiece, quantity: halfMeterCapacity + 1 }], {
        ...DEFAULT_CUTTER_SHEET,
        heightCm: 50
      }).placedPieces
    ),
    2,
    'one extra copy spills beyond the half-meter target'
  )
  const resizedExactOrder = resizeCutterProductionLayout(
    [lockedTenCmPiece],
    repairedOneMeterLayout.placedPieces,
    DEFAULT_CUTTER_SHEET,
    50
  )
  expectEqual(resizedExactOrder.sheet.heightCm, 50, 'dragging sets the requested sheet length')
  expectEqual(
    resizedExactOrder.placedCount,
    lockedTenCmPiece.quantity,
    'dragging reflows every exact-quantity copy without changing the order count'
  )
  expect(
    resizedExactOrder.sheetCount > getProductionSheetCount(repairedOneMeterLayout.placedPieces),
    'shortening an exact-quantity sheet creates more production sheets when needed'
  )
  const resizedMaterialOrder = resizeCutterProductionLayout(
    [
      {
        ...lengthOrderPiece,
        orderMode: 'target-length',
        targetLengthCm: 100,
        quantity: oneMeterCapacity
      }
    ],
    [],
    { ...DEFAULT_CUTTER_SHEET, lengthMode: 'fixed' },
    50
  )
  expectEqual(
    resizedMaterialOrder.pieces[0].quantity,
    halfMeterCapacity,
    'dragging a material-length order recalculates the number of copies that fill it'
  )
  expectEqual(
    resizedMaterialOrder.sheetCount,
    1,
    'a resized material-length order still fills one target sheet'
  )

  const warningIds = new Set([piece.id, otherPiece.id])
  const undoSnapshot = createAutoArrangeUndoSnapshot([first, other], warningIds)
  const warningsAfterArrange = clearArrangedRepackWarnings(warningIds, [piece.id])

  expectEqual(warningsAfterArrange.has(piece.id), false, 'arrange clears its repack warning')
  expectEqual(
    warningsAfterArrange.has(otherPiece.id),
    true,
    'focused arrange preserves another piece warning'
  )
  expectEqual(
    undoSnapshot.repackWarningPieceIds.has(piece.id),
    true,
    'undo snapshot retains the cleared warning'
  )
  expectEqual(
    undoSnapshot.repackWarningPieceIds.has(otherPiece.id),
    true,
    'undo snapshot retains all pending warnings'
  )
  expectEqual(undoSnapshot.placedPieces.length, 2, 'undo snapshot retains the prior layout')

  warningIds.clear()
  expectEqual(
    undoSnapshot.repackWarningPieceIds.size,
    2,
    'undo snapshot is isolated from later warning mutations'
  )

  const warningsAfterUndo = new Set(undoSnapshot.repackWarningPieceIds)
  const warningsAfterSecondArrange = clearArrangedRepackWarnings(warningsAfterUndo, [piece.id])
  expectEqual(
    warningsAfterSecondArrange.has(piece.id),
    false,
    'a successful arrange after undo clears the restored warning again'
  )

  const lockedWarnings = new Set([piece.id, otherPiece.id])
  const lockedWarningPieceIds = getLockedRepackWarningPieceIds(
    lockedWarnings,
    [piece.id],
    [first, other]
  )
  const warningsAfterLockedArrange = clearArrangedRepackWarnings(
    lockedWarnings,
    [piece.id],
    lockedWarningPieceIds
  )

  expectEqual(
    warningsAfterLockedArrange.has(piece.id),
    true,
    'arrange keeps a pending warning when a target copy is locked in place'
  )
  expectEqual(
    warningsAfterLockedArrange.has(otherPiece.id),
    true,
    'locked arrange still preserves warnings for untargeted pieces'
  )

  const unlockedFirst = { ...first, locked: false }
  const unlockedWarningPieceIds = getLockedRepackWarningPieceIds(
    warningsAfterLockedArrange,
    [piece.id],
    [unlockedFirst, other]
  )
  const warningsAfterUnlockedArrange = clearArrangedRepackWarnings(
    warningsAfterLockedArrange,
    [piece.id],
    unlockedWarningPieceIds
  )

  expectEqual(
    warningsAfterUnlockedArrange.has(piece.id),
    false,
    'a later arrange clears the warning after target copies are unlocked'
  )

  console.log('Cutter piece reconciliation tests passed.')
}

function createPiece(id: string, displayName: string, quantity: number): PiecePreset {
  const source: PieceSourceFile = {
    id: `source-${id}`,
    sourceKind: 'image',
    fileName: `${displayName}.png`,
    displayName,
    mimeType: 'image/png',
    bytes: new Uint8Array([1]),
    previewUrl: `blob:${id}`,
    naturalWidthPx: 800,
    naturalHeightPx: 600
  }
  const created = createCutlineFromArtworkBounds(createPiecePresetFromSource(source, []))
  return { ...created, id, displayName, quantity }
}

function createArtworkOnlyFourCmPiece(quantity: number): PiecePreset {
  return createArtworkOnlySquarePiece(quantity, 4)
}

function createArtworkOnlySquarePiece(quantity: number, sizeCm: number): PiecePreset {
  const source: PieceSourceFile = {
    id: 'source-artwork-only-4cm',
    sourceKind: 'image',
    fileName: 'Artwork Only 4 cm.png',
    displayName: 'Artwork Only 4 cm',
    mimeType: 'image/png',
    bytes: new Uint8Array([1]),
    previewUrl: 'blob:artwork-only-4cm',
    naturalWidthPx: 800,
    naturalHeightPx: 800
  }
  const created = createPiecePresetFromSource(source, [])
  const resized = resizePiecePreset(created, sizeCm, sizeCm, 'width')

  return { ...resized, id: 'artwork-only-4cm', quantity }
}

function placed(
  piece: PiecePreset,
  id: string,
  xCm: number,
  yCm: number,
  rotation: 0 | 90 | 180 | 270,
  locked: boolean
): PlacedPiece {
  return {
    ...createPlacedPieceFromPreset(piece, xCm, yCm, rotation),
    id,
    xCm,
    yCm,
    rotation,
    locked,
    sheetIndex: 1
  }
}

function copiesOf(placedPieces: PlacedPiece[], presetId: string): PlacedPiece[] {
  return placedPieces.filter((piece) => piece.presetId === presetId)
}

function expectPlacement(
  actual: PlacedPiece | undefined,
  expected: PlacedPiece,
  message: string
): void {
  expect(actual !== undefined, `${message}: placement exists`)
  expectEqual(actual!.id, expected.id, `${message}: ID`)
  expectEqual(actual!.xCm, expected.xCm, `${message}: x`)
  expectEqual(actual!.yCm, expected.yCm, `${message}: y`)
  expectEqual(actual!.rotation, expected.rotation, `${message}: rotation`)
  expectEqual(actual!.locked, expected.locked, `${message}: lock`)
  expectEqual(actual!.sheetIndex, expected.sheetIndex, `${message}: sheet`)
}

function expectEqual<T>(actual: T, expected: T, message: string): void {
  expect(
    Object.is(actual, expected),
    `${message}; expected ${String(expected)}, received ${String(actual)}`
  )
}

function expect(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
}

run()
