import type { CutterSheetSettings, EditorObject, PiecePreset, PlacedPiece } from '../types'
import { getPieceProductionFootprint, getPlacedProductionBounds } from './cutlineGenerator'
import { calculateUsedArea, detectOutOfBounds, detectOverlaps } from './nestingStrategies'

function run(): void {
  expectBounds(
    getPieceProductionFootprint(createPiece(createArtwork(0))),
    { xCm: 2, yCm: 3, widthCm: 8, heightCm: 4 },
    'unrotated artwork preserves its bounds'
  )

  expectBounds(
    getPieceProductionFootprint(createPiece(createArtwork(90))),
    { xCm: 4, yCm: 1, widthCm: 4, heightCm: 8 },
    '90-degree artwork swaps its bounds around the center'
  )

  expectBounds(
    getPieceProductionFootprint(createPiece(createArtwork(180))),
    { xCm: 2, yCm: 3, widthCm: 8, heightCm: 4 },
    '180-degree artwork preserves its bounds'
  )

  expectBounds(
    getPieceProductionFootprint(createPiece(createArtwork(270))),
    { xCm: 4, yCm: 1, widthCm: 4, heightCm: 8 },
    '270-degree artwork swaps its bounds around the center'
  )

  const radians = Math.PI / 6
  const arbitraryWidth = 8 * Math.cos(radians) + 4 * Math.sin(radians)
  const arbitraryHeight = 8 * Math.sin(radians) + 4 * Math.cos(radians)
  expectBounds(
    getPieceProductionFootprint(createPiece(createArtwork(30))),
    {
      xCm: 6 - arbitraryWidth / 2,
      yCm: 5 - arbitraryHeight / 2,
      widthCm: arbitraryWidth,
      heightCm: arbitraryHeight
    },
    'arbitrary-angle artwork uses its mathematically correct AABB'
  )

  const cutline = createArtwork(90, {
    id: 'cutline',
    type: 'cutline',
    role: 'cutline',
    name: 'CutContour',
    offsetMm: 10,
    exportEnabled: true
  })
  expectBounds(
    getPieceProductionFootprint(createPiece(cutline)),
    { xCm: 3, yCm: 0, widthCm: 6, heightCm: 10 },
    'cutline offset expands the rectangle before rotation'
  )

  const cutlinePiece = createPiece(
    createArtwork(0, {
      id: 'scaled-cutline',
      type: 'cutline',
      role: 'cutline',
      name: 'CutContour',
      offsetMm: 10,
      exportEnabled: true
    })
  )
  expectBounds(
    getPlacedProductionBounds(createPlacedPiece(cutlinePiece, 0.5), cutlinePiece),
    { xCm: 100, yCm: 200.5, widthCm: 6, heightCm: 4 },
    'half-scale placement keeps the one-centimeter physical offset unscaled'
  )
  expectBounds(
    getPlacedProductionBounds(createPlacedPiece(cutlinePiece, 2), cutlinePiece),
    { xCm: 103, yCm: 205, widthCm: 18, heightCm: 10 },
    'double-scale placement keeps the one-centimeter physical offset unscaled'
  )
  expectBounds(
    getPlacedProductionBounds(createPlacedPiece(cutlinePiece, 0.5, 90), cutlinePiece),
    { xCm: 105.5, yCm: 200, widthCm: 4, heightCm: 6 },
    'rotated half-scale placement rotates the physical-offset footprint'
  )

  expectThrows(
    () => getPieceProductionFootprint(createPiece(createArtwork(Number.NaN))),
    'non-finite object rotation is rejected'
  )
  expectThrows(
    () =>
      getPieceProductionFootprint(
        createPiece(
          createArtwork(0, {
            id: 'invalid-offset',
            type: 'cutline',
            role: 'cutline',
            offsetMm: Number.POSITIVE_INFINITY,
            exportEnabled: true
          })
        )
      ),
    'non-finite cutline offset is rejected'
  )
  const finitePlaced = createPlacedPiece(cutlinePiece, 1)
  expectThrows(
    () =>
      getPlacedProductionBounds(
        { ...finitePlaced, rotation: Number.NaN as PlacedPiece['rotation'] },
        cutlinePiece
      ),
    'non-finite placed rotation is rejected'
  )

  const invalidCachedBounds = {
    ...finitePlaced,
    id: 'invalid-cached-bounds',
    productionBoundsCm: { xCm: Number.NaN, yCm: 0, widthCm: 1, heightCm: 1 }
  }
  const safeNeighbor = {
    ...finitePlaced,
    id: 'safe-neighbor',
    xCm: 500,
    yCm: 500,
    productionBoundsCm: { xCm: 500, yCm: 500, widthCm: 1, heightCm: 1 }
  }
  expect(
    detectOutOfBounds([invalidCachedBounds], createSheet()).includes(invalidCachedBounds.id),
    'non-finite cached bounds fail closed as out of bounds'
  )
  expect(
    detectOverlaps([invalidCachedBounds, safeNeighbor]).length === 1,
    'non-finite cached bounds fail closed as an overlap on the same sheet'
  )

  const invalidTransform = {
    ...finitePlaced,
    id: 'invalid-transform',
    cutlineTransform: { ...finitePlaced.cutlineTransform, offsetMm: Number.NaN },
    productionBoundsCm: { xCm: 0, yCm: 0, widthCm: 1, heightCm: 1 }
  }
  expect(
    detectOutOfBounds([invalidTransform], createSheet()).includes(invalidTransform.id),
    'non-finite production transform fails closed despite finite cached bounds'
  )
  expect(
    detectOverlaps([invalidTransform, safeNeighbor]).length === 1,
    'non-finite production transform fails closed in overlap detection'
  )
  expect(
    calculateUsedArea([invalidTransform], createSheet()).usedAreaPercent === 100,
    'non-finite production geometry reports fully unsafe area usage'
  )

  console.log('Cutline production-bounds tests passed.')
}

function createArtwork(rotation: number, overrides: Partial<EditorObject> = {}): EditorObject {
  return {
    id: 'artwork',
    type: 'artwork',
    shapeType: 'rectangle',
    role: 'artwork',
    name: 'Artwork',
    visible: true,
    locked: false,
    transform: { xCm: 2, yCm: 3, widthCm: 8, heightCm: 4, rotation },
    ...overrides
  }
}

function createPiece(object: EditorObject): PiecePreset {
  return {
    widthCm: 20,
    heightCm: 20,
    clippingMaskEnabled: false,
    objects: [object]
  } as PiecePreset
}

function createPlacedPiece(
  piece: PiecePreset,
  scale: number,
  rotation: PlacedPiece['rotation'] = 0
): PlacedPiece {
  const quarterTurn = rotation === 90 || rotation === 270
  return {
    id: `placed-${scale}-${rotation}`,
    presetId: 'production-piece',
    sourceFileName: 'production.svg',
    displayName: 'Production piece',
    xCm: 100,
    yCm: 200,
    widthCm: (quarterTurn ? piece.heightCm : piece.widthCm) * scale,
    heightCm: (quarterTurn ? piece.widthCm : piece.heightCm) * scale,
    rotation,
    locked: false,
    artworkTransform: { xCm: 2, yCm: 3, widthCm: 8, heightCm: 4, rotation: 0 },
    maskTransform: { xCm: 2, yCm: 3, widthCm: 8, heightCm: 4, rotation: 0 },
    cutlineTransform: {
      xCm: 2,
      yCm: 3,
      widthCm: 8,
      heightCm: 4,
      rotation: 0,
      offsetMm: 10
    },
    sheetIndex: 0
  }
}

function createSheet(): CutterSheetSettings {
  return {
    widthCm: 1000,
    heightCm: 1000,
    rollWidthCm: 1000,
    unit: 'cm',
    safeMarginCm: 0,
    spacingMm: 0,
    snapToGrid: false,
    gridStepCm: 1,
    allowRotation: true,
    preserveManualPositions: true,
    showGrid: false
  }
}

function expectBounds(
  actual: { xCm: number; yCm: number; widthCm: number; heightCm: number },
  expected: { xCm: number; yCm: number; widthCm: number; heightCm: number },
  label: string
): void {
  expectClose(actual.xCm, expected.xCm, `${label} x`)
  expectClose(actual.yCm, expected.yCm, `${label} y`)
  expectClose(actual.widthCm, expected.widthCm, `${label} width`)
  expectClose(actual.heightCm, expected.heightCm, `${label} height`)
}

function expectClose(actual: number, expected: number, label: string): void {
  if (!Number.isFinite(actual) || !Number.isFinite(expected)) {
    throw new Error(`${label}: expected finite values, got ${expected} and ${actual}`)
  }
  if (Math.abs(actual - expected) >= 0.000001) {
    throw new Error(`${label}: ${actual} !== ${expected}`)
  }
}

function expect(condition: boolean, label: string): asserts condition {
  if (!condition) throw new Error(label)
}

function expectThrows(action: () => unknown, label: string): void {
  try {
    action()
  } catch (error) {
    if (error instanceof RangeError) return
    throw error
  }
  throw new Error(label)
}

void run()
