import type { CutterSheetSettings, EditorObject, PiecePreset, PlacedPiece } from '../types'
import { getPieceProductionFootprint, getPlacedProductionBounds } from './cutlineGenerator'
import { calculateUsedArea, detectOutOfBounds, detectOverlaps } from './nestingStrategies'
import {
  getCutlinePreviewTransform,
  matchCutlineToMask,
  nudgeCutline,
  setCutlineOffset
} from './cutlineAdjustment'
import { createPiecePresetFromSource, createPlacedPieceFromPreset } from './piecePresets'
import {
  createCutlineFromArtworkBounds,
  createCutlineFromMaskBounds,
  getCutlineInspectorState
} from './cutlineValidation'
import { getCutlineObject, syncLegacyFieldsFromObjects } from './pieceModelSync'
import { getPlacedEditorObjectRect } from './cutlineGenerator'

function run(): void {
  checkContourPrecision()
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

function checkContourPrecision(): void {
  const base = createPiecePresetFromSource(
    {
      id: 'edge-source',
      fileName: 'edge.png',
      displayName: 'Edge',
      mimeType: 'image/png',
      bytes: new Uint8Array(),
      previewUrl: '',
      naturalWidthPx: 400,
      naturalHeightPx: 400
    },
    []
  )
  const created = createCutlineFromArtworkBounds(base)
  expect(created.cutline.transform.offsetMm === 0, 'new cut contours do not add an unwanted border')
  expect(
    !getCutlineInspectorState(created).issues.some(
      (issue) => issue.id === 'piece-cutline-offset-small'
    ),
    'zero border is a valid intentional cut setting'
  )
  const mask: EditorObject = {
    id: 'edge-mask',
    type: 'mask',
    role: 'clipping-mask',
    shapeType: 'ellipse',
    name: 'Mask',
    visible: true,
    locked: true,
    transform: { xCm: 0.5, yCm: 0.7, widthCm: 3, heightCm: 2, rotation: 30 }
  }
  const masked = syncLegacyFieldsFromObjects({
    ...created,
    objects: [...created.objects, mask],
    maskObjectId: mask.id,
    clippingMaskEnabled: true
  })
  const aroundMask = createCutlineFromMaskBounds(masked)
  const id = aroundMask.cutlineObjectId!
  const adjusted = setCutlineOffset(aroundMask, id, -0.2)
  const cut = getCutlineObject(adjusted)!
  expectBounds(
    getCutlinePreviewTransform({ ...cut, offsetMm: undefined }, adjusted),
    { xCm: 0.52, yCm: 0.72, widthCm: 2.96, heightCm: 1.96 },
    'legacy primary contours keep their stored cut adjustment in the preview'
  )
  expectBounds(
    getCutlinePreviewTransform(cut),
    { xCm: 0.52, yCm: 0.72, widthCm: 2.96, heightCm: 1.96 },
    'inward trim in the editor is exactly 0.2 mm per side'
  )
  expect(
    adjusted.cutline.transform.offsetMm === -0.2,
    'precision adjustment synchronizes saved and placed contour settings'
  )
  const placed = createPlacedPieceFromPreset(adjusted, 10, 20)
  const production = getPlacedEditorObjectRect(placed, adjusted, cut)
  const zero = getPlacedEditorObjectRect(
    createPlacedPieceFromPreset(aroundMask, 10, 20),
    aroundMask,
    getCutlineObject(aroundMask)!
  )
  expectClose(production.widthCm, zero.widthCm - 0.04, 'production trim matches the editor width')
  expectClose(
    production.heightCm,
    zero.heightCm - 0.04,
    'production trim matches the editor height'
  )
  expectClose(production.rotation, 30, 'rotated masks keep contour rotation when trimming')
  const moved = nudgeCutline(adjusted, id, 0.01, -0.05)
  expectClose(moved.cutline.transform.xCm, 0.501, '0.01 mm nudge stays precise')
  expectClose(moved.cutline.transform.yCm, 0.695, '0.05 mm vertical nudge stays precise')
  expect(
    JSON.stringify(moved.artwork) === JSON.stringify(adjusted.artwork) &&
      JSON.stringify(moved.mask) === JSON.stringify(adjusted.mask),
    'contour adjustments preserve artwork and its locked mask'
  )
  const matched = matchCutlineToMask(moved, id)
  expectBounds(
    matched.cutline.transform,
    mask.transform,
    'matching removes both offset and position drift'
  )
  expect(
    matched.cutline.transform.offsetMm === 0 && matched.cutline.shape === 'ellipse',
    'matching uses the mask shape with no extra margin'
  )
  const locked = syncLegacyFieldsFromObjects({
    ...adjusted,
    objects: adjusted.objects.map((object) =>
      object.id === id ? { ...object, locked: true } : object
    )
  })
  expect(
    setCutlineOffset(locked, id, 1) === locked &&
      nudgeCutline(locked, id, 1, 1) === locked &&
      matchCutlineToMask(locked, id) === locked,
    'precision tools respect contour locks'
  )
  expect(
    setCutlineOffset(adjusted, id, -10) === adjusted &&
      setCutlineOffset(adjusted, id, NaN) === adjusted,
    'invalid and collapsed contours are rejected'
  )
  const customMask = syncLegacyFieldsFromObjects({
    ...masked,
    objects: masked.objects.map((object) =>
      object.id === mask.id
        ? { ...object, shapeType: 'path' as const, pathData: 'M 0 0 L 1 0 L .5 1 Z' }
        : object
    )
  })
  const pathMatched = matchCutlineToMask(customMask, id)
  expect(
    pathMatched.cutline.customPathData === 'M 0 0 L 1 0 L .5 1 Z',
    'matching custom masks copies the actual path'
  )
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
