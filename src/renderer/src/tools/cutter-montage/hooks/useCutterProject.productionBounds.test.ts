import { DEFAULT_CUTTER_SHEET } from '../lib/cutterLayout'
import { getPlacedProductionBounds } from '../lib/cutlineGenerator'
import {
  createPiecePresetFromSource,
  createPlacedPieceFromPreset,
  resizePiecePreset
} from '../lib/piecePresets'
import { getProductionSheetHeight, getProductionSheetWidth } from '../lib/productionSheets'
import type { PiecePreset, PieceSourceFile, PlacedPiece } from '../types'
import { refreshPlacedPieceProductionBounds, resizePlacedPieceDimensions } from './useCutterProject'

function run(): void {
  const piece = createPiece()
  const original = {
    ...createPlacedPieceFromPreset(piece, 2, 3),
    id: 'placed-original',
    locked: true,
    sheetIndex: 0
  }

  const farMoved = refreshPlacedPieceProductionBounds({ ...original, xCm: 80, yCm: 70 }, [piece])
  expectPlacementIdentity(farMoved, 'placed-original', true, 0, 'move preserves placement state')
  expectFreshBounds(farMoved, piece, 'move refreshes production bounds')
  const farMovedBounds = farMoved.productionBoundsCm!
  const productionWidth = getProductionSheetWidth([farMoved], DEFAULT_CUTTER_SHEET, 0)
  const productionHeight = getProductionSheetHeight([farMoved], DEFAULT_CUTTER_SHEET, 0)
  expect(
    productionWidth > 80 && productionWidth >= farMovedBounds.xCm + farMovedBounds.widthCm,
    'far-moved production sheet includes the piece instead of keeping the old 13 cm crop'
  )
  expect(
    productionHeight > 70 && productionHeight >= farMovedBounds.yCm + farMovedBounds.heightCm,
    'far-moved production sheet height includes the piece instead of keeping the old 8 cm crop'
  )

  const resized = refreshPlacedPieceProductionBounds({ ...original, widthCm: 6, heightCm: 3 }, [
    piece
  ])
  expectFreshBounds(resized, piece, 'manual resize refreshes production bounds')

  const hugeResize = resizePlacedPieceDimensions(original, 1e308, 1e308, [piece])
  expectEqual(hugeResize.widthCm, 96, 'manual width clamps to the maximum before bounds refresh')
  expectEqual(hugeResize.heightCm, 96, 'manual height clamps to the maximum before bounds refresh')
  expectFreshBounds(hugeResize, piece, 'huge manual resize keeps finite production bounds')

  const rotated = refreshPlacedPieceProductionBounds(
    {
      ...original,
      rotation: 90,
      widthCm: original.heightCm,
      heightCm: original.widthCm
    },
    [piece]
  )
  expectFreshBounds(rotated, piece, 'rotation refreshes production bounds')
  expectEqual(rotated.widthCm, original.heightCm, 'rotation swaps placed width')
  expectEqual(rotated.heightCm, original.widthCm, 'rotation swaps placed height')

  const duplicate = refreshPlacedPieceProductionBounds(
    { ...original, id: 'placed-duplicate', xCm: original.xCm + 1, yCm: original.yCm + 1 },
    [piece]
  )
  expectPlacementIdentity(
    duplicate,
    'placed-duplicate',
    true,
    0,
    'duplicate preserves placement state'
  )
  expectFreshBounds(duplicate, piece, 'duplicate refreshes production bounds')

  const nudged = refreshPlacedPieceProductionBounds(
    { ...original, xCm: original.xCm + 0.1, yCm: original.yCm - 0.1 },
    [piece]
  )
  expectFreshBounds(nudged, piece, 'keyboard nudge refreshes production bounds')

  const aligned = refreshPlacedPieceProductionBounds({ ...original, xCm: 25, yCm: 18 }, [piece])
  expectFreshBounds(aligned, piece, 'align/distribute result refreshes production bounds')

  const orphaned = refreshPlacedPieceProductionBounds(
    {
      ...original,
      xCm: 50,
      productionBoundsCm: { xCm: 2, yCm: 3, widthCm: 10, heightCm: 5 }
    },
    []
  )
  expect(
    orphaned.productionBoundsCm === undefined,
    'missing preset removes stale cached bounds instead of trusting them'
  )

  console.log('Cutter placed-piece production-bounds tests passed.')
}

function createPiece(): PiecePreset {
  const source: PieceSourceFile = {
    id: 'source-production-bounds',
    sourceKind: 'image',
    fileName: 'production-bounds.png',
    displayName: 'Production Bounds',
    mimeType: 'image/png',
    bytes: new Uint8Array([1]),
    previewUrl: 'blob:production-bounds',
    naturalWidthPx: 1000,
    naturalHeightPx: 500
  }
  const created = createPiecePresetFromSource(source, [])
  return resizePiecePreset(created, 10, 5, 'width')
}

function expectFreshBounds(actual: PlacedPiece, piece: PiecePreset, message: string): void {
  expect(actual.productionBoundsCm !== undefined, `${message}: cached bounds exist`)
  const expected = getPlacedProductionBounds(actual, piece)
  const bounds = actual.productionBoundsCm!

  expectClose(bounds.xCm, expected.xCm, `${message}: x`)
  expectClose(bounds.yCm, expected.yCm, `${message}: y`)
  expectClose(bounds.widthCm, expected.widthCm, `${message}: width`)
  expectClose(bounds.heightCm, expected.heightCm, `${message}: height`)
}

function expectPlacementIdentity(
  actual: PlacedPiece,
  id: string,
  locked: boolean,
  sheetIndex: number,
  message: string
): void {
  expectEqual(actual.id, id, `${message}: ID`)
  expectEqual(actual.locked, locked, `${message}: lock`)
  expectEqual(actual.sheetIndex, sheetIndex, `${message}: sheet`)
}

function expectClose(actual: number, expected: number, message: string): void {
  expect(
    Number.isFinite(actual) && Math.abs(actual - expected) <= 1e-9,
    `${message}; expected ${expected}, received ${actual}`
  )
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
