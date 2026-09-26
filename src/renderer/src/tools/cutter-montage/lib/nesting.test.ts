import { DEFAULT_CUTTER_SHEET, getSafeArea } from './cutterLayout'
import { getPlacedArtworkRect, getPlacedProductionBounds } from './cutlineGenerator'
import { getPlacedMaskRect } from './maskUtils'
import { autoArrangePieces } from './nesting'
import {
  createPiecePresetFromSource,
  createPlacedPieceFromPreset,
  refreshPlacedPieceFromPreset,
  syncPieceBounds
} from './piecePresets'
import type { PieceSourceFile, PiecePreset } from '../types'
import { synchronizePieceEditorModel } from './editorObjects'

function run(): void {
  const paddedPiece = createPiecePresetFromSource(createSource(), [])
  const tightArtwork = {
    xCm: 2,
    yCm: 2,
    widthCm: 4,
    heightCm: 3,
    rotation: 0
  }
  const tightCutline = {
    ...tightArtwork,
    offsetMm: 0
  }
  const prepared = synchronizePieceEditorModel({
    ...paddedPiece,
    widthCm: 4,
    heightCm: 3,
    quantity: 3,
    artwork: { ...paddedPiece.artwork, transform: tightArtwork },
    cutline: { ...paddedPiece.cutline, transform: tightCutline },
    objects: paddedPiece.objects.map((object) => ({
      ...object,
      transform: object.role === 'cutline' ? tightCutline : tightArtwork
    }))
  })

  const layout = autoArrangePieces([prepared], {
    ...DEFAULT_CUTTER_SHEET,
    heightCm: 10,
    spacingMm: 5,
    safeMarginCm: 0
  })

  expect(layout.placedCount === 3, 'all padded-artwork copies should be placed')
  expect(
    layout.placedPieces.every((placed) => placed.productionBoundsCm),
    'production bounds exist'
  )
  const normalSafeArea = getSafeArea({
    ...DEFAULT_CUTTER_SHEET,
    heightCm: 10,
    spacingMm: 5,
    safeMarginCm: 0
  })
  expect(
    layout.placedPieces.every((placed) => isInside(placed.productionBoundsCm!, normalSafeArea)),
    'normal arranged production footprints stay inside the safe area'
  )
  for (const first of layout.placedPieces) {
    for (const second of layout.placedPieces) {
      if (first.id >= second.id || first.sheetIndex !== second.sheetIndex) continue
      expect(
        !overlap(first.productionBoundsCm!, second.productionBoundsCm!, 0.05),
        'arranged production footprints must not overlap'
      )
    }
  }

  const offsetPiece = synchronizePieceEditorModel({
    ...prepared,
    quantity: 6,
    cutline: {
      ...prepared.cutline,
      transform: { ...prepared.cutline.transform, offsetMm: 1 }
    },
    objects: prepared.objects.map((object) =>
      object.role === 'cutline'
        ? { ...object, transform: { ...object.transform, offsetMm: 1 } }
        : object
    )
  })
  const offsetSettings = {
    ...DEFAULT_CUTTER_SHEET,
    widthCm: 10,
    heightCm: 15,
    safeMarginCm: 0.5,
    spacingMm: 3,
    snapToGrid: true,
    gridStepCm: 0.5
  }
  const offsetSafeArea = getSafeArea(offsetSettings)
  const offsetLayout = autoArrangePieces([offsetPiece], offsetSettings)
  expectEqual(offsetLayout.placedCount, 6, 'all offset-cutline copies should be placed')
  expectEqual(offsetLayout.sheetCount, 1, 'offset-cutline copies should use one sheet')
  expect(
    new Set(offsetLayout.placedPieces.map((placed) => placed.productionBoundsCm!.yCm)).size > 1,
    'offset-cutline copies should wrap across multiple rows'
  )
  for (const placed of offsetLayout.placedPieces) {
    const bounds = placed.productionBoundsCm!
    expect(
      bounds.xCm >= offsetSafeArea.xCm - 0.0001 &&
        bounds.yCm >= offsetSafeArea.yCm - 0.0001 &&
        bounds.xCm + bounds.widthCm <= offsetSafeArea.xCm + offsetSafeArea.widthCm + 0.0001 &&
        bounds.yCm + bounds.heightCm <= offsetSafeArea.yCm + offsetSafeArea.heightCm + 0.0001,
      'offset-cutline production bounds stay inside the safe area'
    )
    expectClose(
      bounds.xCm,
      Math.round(bounds.xCm / offsetSettings.gridStepCm) * offsetSettings.gridStepCm,
      'offset-cutline production footprint X snaps to grid'
    )
    expectClose(
      bounds.yCm,
      Math.round(bounds.yCm / offsetSettings.gridStepCm) * offsetSettings.gridStepCm,
      'offset-cutline production footprint Y snaps to grid'
    )
  }
  for (const first of offsetLayout.placedPieces) {
    for (const second of offsetLayout.placedPieces) {
      if (first.id >= second.id || first.sheetIndex !== second.sheetIndex) continue
      expect(
        !overlap(first.productionBoundsCm!, second.productionBoundsCm!, 0.3 - 0.0001),
        'offset-cutline production footprints keep configured spacing'
      )
    }
  }

  const twentyMaskedPieces = createSevenCmMaskedPiece(20)
  const twentyPieceSafeArea = getSafeArea(DEFAULT_CUTTER_SHEET)
  const twentyPieceLayout = autoArrangePieces([twentyMaskedPieces], DEFAULT_CUTTER_SHEET)
  const configuredSpacingCm = DEFAULT_CUTTER_SHEET.spacingMm / 10
  expectEqual(twentyPieceLayout.placedCount, 20, 'all twenty 7 cm masked copies are placed')
  expectEqual(twentyPieceLayout.sheetCount, 1, 'twenty 7 cm masked copies fit on one sheet')
  expect(
    twentyPieceLayout.placedPieces.every((placed) =>
      isInside(placed.productionBoundsCm!, twentyPieceSafeArea)
    ),
    'twenty-copy production bounds stay inside the default safe area'
  )
  for (const first of twentyPieceLayout.placedPieces) {
    for (const second of twentyPieceLayout.placedPieces) {
      if (first.id >= second.id || first.sheetIndex !== second.sheetIndex) continue
      expect(
        !overlap(
          first.productionBoundsCm!,
          second.productionBoundsCm!,
          configuredSpacingCm - GEOMETRY_TOLERANCE_CM
        ),
        'twenty-copy production bounds keep configured spacing without overlaps'
      )
    }
  }

  const maskedPiece = createMaskedPiece()
  const rotatedPlaced = createPlacedPieceFromPreset(maskedPiece, 10, 20, 90)
  const rotatedArtwork = getPlacedArtworkRect(rotatedPlaced, maskedPiece)
  const rotatedMask = getPlacedMaskRect(rotatedPlaced, maskedPiece)
  expectEqual(rotatedArtwork.rotation, 90, 'placed artwork keeps the quarter-turn rotation')
  expectClose(
    rotatedArtwork.xCm + rotatedArtwork.widthCm / 2,
    rotatedPlaced.xCm + rotatedPlaced.widthCm / 2,
    'rotated artwork keeps its piece-center mapping'
  )
  expectClose(
    rotatedArtwork.yCm + rotatedArtwork.heightCm / 2,
    rotatedPlaced.yCm + rotatedPlaced.heightCm / 2,
    'rotated artwork keeps its vertical center mapping'
  )
  expectEqual(
    rotatedArtwork.widthCm,
    maskedPiece.artwork.transform.widthCm,
    'rotated artwork width stays in normalized local coordinates'
  )
  expectEqual(
    rotatedArtwork.heightCm,
    maskedPiece.artwork.transform.heightCm,
    'rotated artwork height stays in normalized local coordinates'
  )
  expectClose(
    rotatedMask.xCm + rotatedMask.widthCm / 2,
    rotatedPlaced.xCm + rotatedPlaced.widthCm / 2,
    'rotated mask keeps its piece-center mapping'
  )
  expectClose(
    rotatedMask.yCm + rotatedMask.heightCm / 2,
    rotatedPlaced.yCm + rotatedPlaced.heightCm / 2,
    'rotated mask keeps its vertical center mapping'
  )

  for (const rotation of [0, 90, 180, 270] as const) {
    const placed = createPlacedPieceFromPreset(maskedPiece, 10, 20, rotation)
    const artworkAabb = getRotatedAabb(getPlacedArtworkRect(placed, maskedPiece))
    const maskAabb = getRotatedAabb(getPlacedMaskRect(placed, maskedPiece))

    expect(
      artworkAabb.xCm <= maskAabb.xCm + 0.0001 &&
        artworkAabb.yCm <= maskAabb.yCm + 0.0001 &&
        artworkAabb.xCm + artworkAabb.widthCm >= maskAabb.xCm + maskAabb.widthCm - 0.0001 &&
        artworkAabb.yCm + artworkAabb.heightCm >= maskAabb.yCm + maskAabb.heightCm - 0.0001,
      `artwork covers the mask at ${rotation} degrees`
    )

    const productionBounds = getPlacedProductionBounds(placed, maskedPiece)
    expect(
      productionBounds.xCm <= maskAabb.xCm + 0.0001 &&
        productionBounds.yCm <= maskAabb.yCm + 0.0001 &&
        productionBounds.xCm + productionBounds.widthCm >=
          maskAabb.xCm + maskAabb.widthCm - 0.0001 &&
        productionBounds.yCm + productionBounds.heightCm >=
          maskAabb.yCm + maskAabb.heightCm - 0.0001,
      `placed production bounds cover the mask at ${rotation} degrees`
    )
  }

  const restoredPlacement = {
    ...rotatedPlaced,
    sourceFileName: 'stale-source.png',
    displayName: 'Stale name',
    widthCm: maskedPiece.widthCm,
    heightCm: maskedPiece.heightCm,
    artworkTransform: { ...paddedPiece.artwork.transform },
    maskTransform: { ...paddedPiece.mask.transform },
    cutlineTransform: { ...paddedPiece.cutline.transform },
    sheetIndex: 3
  }
  const refreshedPlacement = refreshPlacedPieceFromPreset(restoredPlacement, maskedPiece)
  expectEqual(refreshedPlacement.xCm, rotatedPlaced.xCm, 'restore keeps placed X')
  expectEqual(refreshedPlacement.yCm, rotatedPlaced.yCm, 'restore keeps placed Y')
  expectEqual(refreshedPlacement.rotation, rotatedPlaced.rotation, 'restore keeps placed rotation')
  expectEqual(refreshedPlacement.sheetIndex, 3, 'restore keeps sheet index')
  expectEqual(refreshedPlacement.widthCm, maskedPiece.heightCm, 'restore refreshes rotated width')
  expectEqual(refreshedPlacement.heightCm, maskedPiece.widthCm, 'restore refreshes rotated height')
  expectTransformEqual(
    refreshedPlacement.artworkTransform,
    maskedPiece.artwork.transform,
    'restore refreshes artwork transform'
  )
  expectTransformEqual(
    refreshedPlacement.maskTransform,
    maskedPiece.mask.transform,
    'restore refreshes mask transform'
  )
  expectTransformEqual(
    refreshedPlacement.cutlineTransform,
    maskedPiece.cutline.transform,
    'restore refreshes cutline transform'
  )
  expect(
    refreshedPlacement.productionBoundsCm !== restoredPlacement.productionBoundsCm,
    'restore refreshes cached production bounds'
  )

  const restoredPlacements = [0, 90, 180, 270].map((rotation, index) => ({
    ...createPlacedPieceFromPreset(
      maskedPiece,
      3 + index,
      5 + index,
      rotation as 0 | 90 | 180 | 270
    ),
    id: `legacy-placement-${index}`,
    sourceFileName: 'stale-source.png',
    displayName: 'Stale name',
    locked: index % 2 === 0,
    sheetIndex: index + 1,
    productionBoundsCm: { xCm: -100, yCm: -100, widthCm: 0.1, heightCm: 0.1 }
  }))
  const refreshedPlacements = restoredPlacements.map((placed) =>
    refreshPlacedPieceFromPreset(placed, maskedPiece)
  )
  expectEqual(
    refreshedPlacements.map((placed) => placed.id).join(','),
    restoredPlacements.map((placed) => placed.id).join(','),
    'restore keeps placed copy order and ids'
  )
  for (let index = 0; index < restoredPlacements.length; index += 1) {
    const before = restoredPlacements[index]
    const after = refreshedPlacements[index]
    expectEqual(after.xCm, before.xCm, `restore keeps copy ${index} X`)
    expectEqual(after.yCm, before.yCm, `restore keeps copy ${index} Y`)
    expectEqual(after.rotation, before.rotation, `restore keeps copy ${index} rotation`)
    expectEqual(after.locked, before.locked, `restore keeps copy ${index} lock`)
    expectEqual(after.sheetIndex, before.sheetIndex, `restore keeps copy ${index} sheet`)
    expect(
      after.productionBoundsCm?.widthCm !== 0.1 && after.productionBoundsCm?.heightCm !== 0.1,
      `restore refreshes copy ${index} production bounds`
    )
  }

  const resizedMaskedPiece = syncPieceBounds(maskedPiece, 18, 10)
  const placementsBeforeSizeEdit = ([90, 270] as const).map((rotation, index) => ({
    ...createPlacedPieceFromPreset(maskedPiece, 14 + index * 9, 23 + index * 7, rotation),
    id: `size-edit-placement-${rotation}`,
    locked: index === 0,
    sheetIndex: index + 4,
    productionBoundsCm: { xCm: -20, yCm: -20, widthCm: 0.1, heightCm: 0.1 }
  }))
  const placementsAfterSizeEdit = placementsBeforeSizeEdit.map((placed) =>
    refreshPlacedPieceFromPreset(placed, resizedMaskedPiece)
  )

  for (let index = 0; index < placementsBeforeSizeEdit.length; index += 1) {
    const before = placementsBeforeSizeEdit[index]
    const after = placementsAfterSizeEdit[index]
    const expectedBounds = getPlacedProductionBounds(after, resizedMaskedPiece)

    expectEqual(after.id, before.id, `size edit keeps copy ${index} id`)
    expectEqual(after.xCm, before.xCm, `size edit keeps copy ${index} X`)
    expectEqual(after.yCm, before.yCm, `size edit keeps copy ${index} Y`)
    expectEqual(after.rotation, before.rotation, `size edit keeps copy ${index} rotation`)
    expectEqual(after.locked, before.locked, `size edit keeps copy ${index} lock`)
    expectEqual(after.sheetIndex, before.sheetIndex, `size edit keeps copy ${index} sheet`)
    expectEqual(
      after.widthCm,
      resizedMaskedPiece.heightCm,
      `size edit keeps copy ${index} quarter-turn width swap`
    )
    expectEqual(
      after.heightCm,
      resizedMaskedPiece.widthCm,
      `size edit keeps copy ${index} quarter-turn height swap`
    )
    expectTransformEqual(
      after.artworkTransform,
      resizedMaskedPiece.artwork.transform,
      `size edit refreshes copy ${index} artwork transform`
    )
    expectTransformEqual(
      after.maskTransform,
      resizedMaskedPiece.mask.transform,
      `size edit refreshes copy ${index} mask transform`
    )
    expectTransformEqual(
      after.cutlineTransform,
      resizedMaskedPiece.cutline.transform,
      `size edit refreshes copy ${index} cutline transform`
    )
    expectClose(
      after.productionBoundsCm!.xCm,
      expectedBounds.xCm,
      `size edit refreshes copy ${index} production bounds X`
    )
    expectClose(
      after.productionBoundsCm!.yCm,
      expectedBounds.yCm,
      `size edit refreshes copy ${index} production bounds Y`
    )
    expectClose(
      after.productionBoundsCm!.widthCm,
      expectedBounds.widthCm,
      `size edit refreshes copy ${index} production bounds width`
    )
    expectClose(
      after.productionBoundsCm!.heightCm,
      expectedBounds.heightCm,
      `size edit refreshes copy ${index} production bounds height`
    )
  }

  const quantityPreservedLayout = autoArrangePieces(
    [{ ...maskedPiece, quantity: restoredPlacements.length }],
    {
      ...DEFAULT_CUTTER_SHEET,
      preserveManualPositions: true,
      safeMarginCm: 0,
      spacingMm: 0
    },
    restoredPlacements
  )
  expectEqual(
    quantityPreservedLayout.requestedCount,
    restoredPlacements.length,
    'restore keeps preset quantity'
  )
  expectEqual(
    quantityPreservedLayout.placedCount,
    restoredPlacements.length,
    'restore keeps every placed copy'
  )
  expectEqual(
    quantityPreservedLayout.placedPieces.map((placed) => placed.id).join(','),
    restoredPlacements.map((placed) => placed.id).join(','),
    'arrange keeps restored copy order'
  )
  for (let index = 0; index < restoredPlacements.length; index += 1) {
    expectEqual(
      quantityPreservedLayout.placedPieces[index].xCm,
      restoredPlacements[index].xCm,
      `arrange keeps restored copy ${index} X`
    )
    expectEqual(
      quantityPreservedLayout.placedPieces[index].yCm,
      restoredPlacements[index].yCm,
      `arrange keeps restored copy ${index} Y`
    )
  }

  const rotatedLayout = autoArrangePieces([maskedPiece], {
    ...DEFAULT_CUTTER_SHEET,
    widthCm: 7,
    heightCm: 20,
    safeMarginCm: 0,
    spacingMm: 0
  })
  const arrangedRotated = rotatedLayout.placedPieces[0]
  expect(Boolean(arrangedRotated), 'forced rotation layout places the masked piece')
  expectEqual(arrangedRotated.rotation, 90, 'narrow sheet uses a quarter-turn placement')
  const arrangedMask = getPlacedMaskRect(arrangedRotated, maskedPiece)
  const arrangedBounds = arrangedRotated.productionBoundsCm!
  const arrangedMaskAabb = getRotatedAabb(arrangedMask)
  expect(
    isInside(
      arrangedBounds,
      getSafeArea({
        ...DEFAULT_CUTTER_SHEET,
        widthCm: 7,
        heightCm: 20,
        safeMarginCm: 0,
        spacingMm: 0
      })
    ),
    'arranged rotated production footprint stays inside the safe area'
  )
  expect(
    arrangedMaskAabb.xCm >= arrangedBounds.xCm - 0.0001 &&
      arrangedMaskAabb.yCm >= arrangedBounds.yCm - 0.0001 &&
      arrangedMaskAabb.xCm + arrangedMaskAabb.widthCm <=
        arrangedBounds.xCm + arrangedBounds.widthCm + 0.0001 &&
      arrangedMaskAabb.yCm + arrangedMaskAabb.heightCm <=
        arrangedBounds.yCm + arrangedBounds.heightCm + 0.0001,
    'arranged rotated mask stays inside the production footprint'
  )

  console.log('Cutter nesting tests passed.')
}

function createMaskedPiece(): PiecePreset {
  const base = createPiecePresetFromSource(
    {
      ...createSource(),
      id: 'masked-source',
      fileName: 'masked.png',
      naturalWidthPx: 1200,
      naturalHeightPx: 800
    },
    []
  )
  const artwork = { xCm: 0, yCm: 1, widthCm: 12, heightCm: 6, rotation: 0 }
  const mask = { xCm: 2, yCm: 2, widthCm: 8, heightCm: 4, rotation: 0 }
  const cutline = { ...mask, offsetMm: 1 }
  const maskId = 'mask-geometry-test'
  const objects = base.objects.map((object) =>
    object.role === 'artwork'
      ? { ...object, locked: true, transform: artwork }
      : object.role === 'cutline'
        ? { ...object, transform: cutline }
        : object
  )
  objects.push({
    id: maskId,
    type: 'mask',
    shapeType: 'rectangle',
    role: 'clipping-mask',
    name: 'Clipping Mask',
    visible: true,
    locked: true,
    transform: mask,
    fillColor: 'transparent',
    exportEnabled: false
  })

  return synchronizePieceEditorModel({
    ...base,
    widthCm: 12,
    heightCm: 8,
    artwork: { ...base.artwork, transform: artwork },
    mask: { ...base.mask, enabled: true, shape: 'rectangle', transform: mask },
    cutline: { ...base.cutline, transform: cutline },
    objects,
    maskObjectId: maskId,
    clippingMaskEnabled: true,
    maskWorkflowVersion: 2,
    artworkLockBeforeMask: false,
    objectLocks: { ...base.objectLocks, artwork: true, mask: true },
    selectedObjectIds: [maskId]
  })
}

function createSevenCmMaskedPiece(quantity: number): PiecePreset {
  const base = createMaskedPiece()
  const artwork = { xCm: 0, yCm: 0, widthCm: 7, heightCm: 7, rotation: 0 }
  const mask = { ...artwork }
  const cutline = { ...artwork, offsetMm: 1 }

  return synchronizePieceEditorModel({
    ...base,
    widthCm: 7,
    heightCm: 7,
    quantity,
    artwork: { ...base.artwork, transform: artwork },
    mask: { ...base.mask, transform: mask },
    cutline: { ...base.cutline, transform: cutline },
    objects: base.objects.map((object) => ({
      ...object,
      transform:
        object.role === 'cutline'
          ? cutline
          : object.role === 'artwork'
            ? artwork
            : object.role === 'clipping-mask'
              ? mask
              : object.transform
    }))
  })
}

function getRotatedAabb(rect: {
  xCm: number
  yCm: number
  widthCm: number
  heightCm: number
  rotation: number
}): { xCm: number; yCm: number; widthCm: number; heightCm: number } {
  const radians = (rect.rotation * Math.PI) / 180
  const width =
    Math.abs(rect.widthCm * Math.cos(radians)) + Math.abs(rect.heightCm * Math.sin(radians))
  const height =
    Math.abs(rect.widthCm * Math.sin(radians)) + Math.abs(rect.heightCm * Math.cos(radians))
  return {
    xCm: rect.xCm + rect.widthCm / 2 - width / 2,
    yCm: rect.yCm + rect.heightCm / 2 - height / 2,
    widthCm: width,
    heightCm: height
  }
}

function createSource(): PieceSourceFile {
  return {
    id: 'padded-source',
    sourceKind: 'image',
    fileName: 'padded.png',
    displayName: 'padded',
    mimeType: 'image/png',
    bytes: new Uint8Array([137, 80, 78, 71]),
    previewUrl: 'blob:padded',
    naturalWidthPx: 800,
    naturalHeightPx: 600
  }
}

function overlap(
  first: { xCm: number; yCm: number; widthCm: number; heightCm: number },
  second: { xCm: number; yCm: number; widthCm: number; heightCm: number },
  paddingCm: number
): boolean {
  return !(
    first.xCm + first.widthCm + paddingCm <= second.xCm ||
    second.xCm + second.widthCm + paddingCm <= first.xCm ||
    first.yCm + first.heightCm + paddingCm <= second.yCm ||
    second.yCm + second.heightCm + paddingCm <= first.yCm
  )
}

const GEOMETRY_TOLERANCE_CM = 0.0001

function isInside(
  inner: { xCm: number; yCm: number; widthCm: number; heightCm: number },
  outer: { xCm: number; yCm: number; widthCm: number; heightCm: number }
): boolean {
  return (
    inner.xCm >= outer.xCm - 0.0001 &&
    inner.yCm >= outer.yCm - 0.0001 &&
    inner.xCm + inner.widthCm <= outer.xCm + outer.widthCm + 0.0001 &&
    inner.yCm + inner.heightCm <= outer.yCm + outer.heightCm + 0.0001
  )
}

void run()

function expect(condition: boolean, label: string): asserts condition {
  if (!condition) throw new Error(label)
}

function expectEqual<T>(actual: T, expected: T, label: string): void {
  expect(actual === expected, `${label}: ${String(actual)} !== ${String(expected)}`)
}

function expectClose(actual: number, expected: number, label: string): void {
  expect(Math.abs(actual - expected) < 0.0001, `${label}: ${actual} !== ${expected}`)
}

function expectTransformEqual(
  actual: { xCm: number; yCm: number; widthCm: number; heightCm: number; rotation: number },
  expected: { xCm: number; yCm: number; widthCm: number; heightCm: number; rotation: number },
  label: string
): void {
  expectClose(actual.xCm, expected.xCm, `${label} x`)
  expectClose(actual.yCm, expected.yCm, `${label} y`)
  expectClose(actual.widthCm, expected.widthCm, `${label} width`)
  expectClose(actual.heightCm, expected.heightCm, `${label} height`)
  expectClose(actual.rotation, expected.rotation, `${label} rotation`)
}
