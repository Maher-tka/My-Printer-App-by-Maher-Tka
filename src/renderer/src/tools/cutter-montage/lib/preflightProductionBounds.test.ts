import type { CutterProject, PiecePreset, PieceSourceFile } from '../types'
import { createCutlineFromArtworkBounds } from './cutlineValidation'
import { DEFAULT_CUTTER_SHEET } from './cutterLayout'
import { createPiecePresetFromSource, createPlacedPieceFromPreset } from './piecePresets'
import { runCutterPreflight } from './preflight'
import { applyCutterExportPreset } from './exportPresets'
import { synchronizePieceEditorModel } from './editorObjects'
import { autoArrangePieces, getPieceCapacityForTargetLength } from './nesting'
import { getProductionSheetProject } from './productionSheets'

function run(): void {
  const source = createSource()
  const piece = createPieceWithRotatedOffsetCutline(source)
  const safeAreaPlaced = createPlacedPieceFromPreset(piece, 3.5, 3.5)
  const staleNominalBounds = {
    xCm: safeAreaPlaced.xCm,
    yCm: safeAreaPlaced.yCm,
    widthCm: safeAreaPlaced.widthCm,
    heightCm: safeAreaPlaced.heightCm
  }
  const safeAreaReport = runCutterPreflight(
    createProject(source, piece, {
      ...safeAreaPlaced,
      productionBoundsCm: staleNominalBounds
    })
  )

  expect(
    safeAreaReport.safeAreaOutOfBoundsIds.includes(safeAreaPlaced.id),
    'rotated CutContour offset intruding into the unsafe margin is reported'
  )
  expect(
    safeAreaReport.issues.some(
      (issue) =>
        issue.id === 'outside-safe-area' && issue.placedPieceIds.includes(safeAreaPlaced.id)
    ),
    'unsafe-margin intrusion creates the safe-area warning'
  )
  expect(
    !safeAreaReport.outOfBoundsIds.includes(safeAreaPlaced.id),
    'production footprint that remains on the physical sheet is not a sheet-bounds error'
  )

  const sheetEdgePlaced = createPlacedPieceFromPreset(piece, 2, 2)
  const sheetEdgeReport = runCutterPreflight(
    createProject(source, piece, {
      ...sheetEdgePlaced,
      productionBoundsCm: {
        xCm: sheetEdgePlaced.xCm,
        yCm: sheetEdgePlaced.yCm,
        widthCm: sheetEdgePlaced.widthCm,
        heightCm: sheetEdgePlaced.heightCm
      }
    })
  )
  expect(
    sheetEdgeReport.outOfBoundsIds.includes(sheetEdgePlaced.id),
    'rotated CutContour offset outside the sheet is detected even when nominal bounds fit'
  )

  const placedWithInvalidRotation = createPlacedPieceFromPreset(piece, 3, 3)
  const invalidPlaced = {
    ...placedWithInvalidRotation,
    cutlineTransform: {
      ...placedWithInvalidRotation.cutlineTransform,
      rotation: Number.NaN
    }
  }
  const invalidReport = runCutterPreflight(createProject(source, piece, invalidPlaced))
  const invalidIssue = invalidReport.issues.find(
    (issue) => issue.id === 'invalid-production-geometry'
  )

  expect(Boolean(invalidIssue), 'non-finite production geometry creates an explicit issue')
  expect(invalidIssue?.severity === 'error', 'invalid production geometry is blocking')
  expect(
    invalidIssue?.placedPieceIds.includes(invalidPlaced.id) === true,
    'invalid production geometry identifies the affected placed piece'
  )
  expect(invalidReport.canExport === false, 'invalid production geometry fails preflight closed')
  expect(
    Number.isFinite(invalidReport.usedAreaPercent) &&
      Number.isFinite(invalidReport.wasteAreaPercent),
    'invalid production geometry does not contaminate utilization metrics'
  )

  for (const invalidOffset of [Number.NaN, Number.POSITIVE_INFINITY]) {
    const placedWithInvalidOffset = createPlacedPieceFromPreset(piece, 3, 3)
    const invalidOffsetPlaced = {
      ...placedWithInvalidOffset,
      cutlineTransform: {
        ...placedWithInvalidOffset.cutlineTransform,
        offsetMm: invalidOffset
      }
    }
    const invalidOffsetReport = runCutterPreflight(
      createProject(source, piece, invalidOffsetPlaced)
    )
    const invalidOffsetIssue = invalidOffsetReport.issues.find(
      (issue) => issue.id === 'invalid-production-geometry'
    )

    expect(
      invalidOffsetIssue?.placedPieceIds.includes(invalidOffsetPlaced.id) === true,
      `placed CutContour offset ${String(invalidOffset)} fails production geometry closed`
    )
    expect(
      invalidOffsetReport.canExport === false,
      `placed CutContour offset ${String(invalidOffset)} blocks export`
    )
  }

  const edgeSource = { ...source, id: 'quarter-turn-edge-source', naturalHeightPx: 400 }
  const edgePiece = createPieceWithZeroOffsetCutline(edgeSource)
  for (const rotation of [90, 180, 270] as const) {
    const edgePlaced = createPlacedPieceFromPreset(edgePiece, 1.5, 1.5, rotation)
    const edgeReport = runCutterPreflight(createProject(edgeSource, edgePiece, edgePlaced))

    expect(
      !edgeReport.outOfBoundsIds.includes(edgePlaced.id),
      `${rotation} degree placement exactly on the sheet edge is not out of bounds`
    )
    expect(
      !edgeReport.safeAreaOutOfBoundsIds.includes(edgePlaced.id),
      `${rotation} degree placement exactly on the safe-area edge has no false warning`
    )
  }

  const floatingNoisePlaced = createPlacedPieceFromPreset(edgePiece, 1.5 - 5e-10, 1.5 - 5e-10)
  const floatingNoiseReport = runCutterPreflight(
    createProject(edgeSource, edgePiece, floatingNoisePlaced)
  )
  expect(
    !floatingNoiseReport.safeAreaOutOfBoundsIds.includes(floatingNoisePlaced.id),
    'sub-nanometer floating-point drift at the safe-area edge is tolerated'
  )

  const materiallyOutsidePlaced = createPlacedPieceFromPreset(edgePiece, 1.5 - 0.001, 1.5)
  const materiallyOutsideReport = runCutterPreflight(
    createProject(edgeSource, edgePiece, materiallyOutsidePlaced)
  )
  expect(
    materiallyOutsideReport.safeAreaOutOfBoundsIds.includes(materiallyOutsidePlaced.id),
    'a real 0.001 cm safe-area intrusion is still reported'
  )

  const missingPresetPlaced = createPlacedPieceFromPreset(edgePiece, 2, 2)
  const missingPresetReport = runCutterPreflight({
    ...createProject(edgeSource, edgePiece, missingPresetPlaced),
    pieces: []
  })
  expect(
    missingPresetReport.issues.some(
      (issue) =>
        issue.id === 'missing-source' && issue.placedPieceIds.includes(missingPresetPlaced.id)
    ),
    'a missing preset remains a missing-source error'
  )
  expect(
    !missingPresetReport.issues.some(
      (issue) =>
        issue.id === 'invalid-production-geometry' &&
        issue.placedPieceIds.includes(missingPresetPlaced.id)
    ),
    'a valid cached footprint for a missing preset is not misreported as invalid geometry'
  )

  const artworkOnlyPiece = createPiecePresetFromSource(source, [])
  const artworkOnlyProject = createProject(
    source,
    artworkOnlyPiece,
    createPlacedPieceFromPreset(artworkOnlyPiece, 1.5, 1.5)
  )
  const printProject = {
    ...artworkOnlyProject,
    exportSettings: applyCutterExportPreset('pdf-print-only', artworkOnlyProject.sheet)
      .exportSettings
  }
  expect(
    runCutterPreflight(printProject).canExport,
    'print-only PDF accepts placed artwork without CutContour'
  )
  expect(
    !runCutterPreflight(artworkOnlyProject).canExport,
    'print-and-cut export still requires CutContour'
  )
  expect(
    !runCutterPreflight({
      ...artworkOnlyProject,
      exportSettings: applyCutterExportPreset('svg-eps-cut-only', artworkOnlyProject.sheet)
        .exportSettings
    }).canExport,
    'cut-only export still requires CutContour'
  )
  expect(
    !runCutterPreflight({
      ...printProject,
      placedPieces: [{ ...printProject.placedPieces[0], xCm: 100 }]
    }).canExport,
    'print-only PDF still blocks artwork outside the sheet'
  )

  const maskedSource = { ...source, naturalWidthPx: 1280, naturalHeightPx: 698 }
  const maskedPiece = createMaskedWorkshopPiece(maskedSource)
  const metreSheet = { ...DEFAULT_CUTTER_SHEET, heightCm: 50, lengthMode: 'fixed' as const }
  const capacity = getPieceCapacityForTargetLength(maskedPiece, metreSheet, 50)
  expect(capacity === 72, 'the workshop half-metre order fits its 72 masked stickers')
  const orderedPiece = { ...maskedPiece, quantity: capacity }
  const arrangement = autoArrangePieces([orderedPiece], metreSheet)
  const markedProject = getProductionSheetProject(
    {
      ...createProject(maskedSource, orderedPiece, arrangement.placedPieces[0]),
      sheet: metreSheet,
      placedPieces: arrangement.placedPieces,
      exportSettings: applyCutterExportPreset('pdf-print-only', metreSheet).exportSettings
    },
    0
  )
  expect(markedProject.sheet.widthCm === 92.5, 'the workshop production width is 92.5 cm')
  expect(markedProject.sheet.heightCm === 50, 'the half-metre production length stays fixed')
  expect(
    !runCutterPreflight(markedProject).issues.some((issue) => issue.id === 'registration-overlap'),
    'unprinted padded image frames do not overlap marks when the real sticker footprints are clear'
  )
  const movedIntoMark = {
    ...markedProject.placedPieces[0],
    xCm: markedProject.placedPieces[0].xCm - 1.5,
    yCm: markedProject.placedPieces[0].yCm - 1.5,
    productionBoundsCm: { xCm: 50, yCm: 30, widthCm: 1, heightCm: 1 }
  }
  expect(
    runCutterPreflight({
      ...markedProject,
      placedPieces: [movedIntoMark, ...markedProject.placedPieces.slice(1)]
    }).issues.some(
      (issue) =>
        issue.id === 'registration-overlap' && issue.placedPieceIds.includes(movedIntoMark.id)
    ),
    'a real mark collision is still detected from fresh geometry despite a stale cached footprint'
  )

  console.log('Preflight production-bounds tests passed.')
}

function createMaskedWorkshopPiece(source: PieceSourceFile): PiecePreset {
  const base = createCutlineFromArtworkBounds(createPiecePresetFromSource(source, []))
  const artwork = { xCm: 0, yCm: 0, widthCm: 16, heightCm: 8.725, rotation: 0 }
  const mask = {
    xCm: 4.60702505,
    yCm: 0.915122126,
    widthCm: 6.751488095,
    heightCm: 6.903113027,
    rotation: 0
  }
  const maskId = 'workshop-circle-mask'
  return synchronizePieceEditorModel({
    ...base,
    widthCm: 16,
    heightCm: 8.725,
    artwork: { ...base.artwork, transform: artwork },
    mask: { enabled: true, shape: 'ellipse', transform: mask },
    cutline: { ...base.cutline, shape: 'ellipse', transform: { ...mask, offsetMm: 1 } },
    maskObjectId: maskId,
    clippingMaskEnabled: true,
    objects: [
      ...base.objects.map((object) => ({
        ...object,
        ...(object.role === 'artwork'
          ? { transform: artwork }
          : { transform: mask, shapeType: 'ellipse' as const, offsetMm: 1 })
      })),
      {
        id: maskId,
        type: 'mask',
        shapeType: 'ellipse',
        role: 'clipping-mask',
        name: 'Workshop circle mask',
        visible: true,
        locked: false,
        exportEnabled: false,
        transform: mask,
        fillColor: 'transparent'
      }
    ]
  })
}

function createPieceWithRotatedOffsetCutline(source: PieceSourceFile): PiecePreset {
  const piece = createCutlineFromArtworkBounds(createPiecePresetFromSource(source, []))

  return {
    ...piece,
    cutline: {
      ...piece.cutline,
      transform: { ...piece.cutline.transform, offsetMm: 2, rotation: 45 }
    },
    objects: piece.objects.map((object) =>
      object.role === 'cutline'
        ? {
            ...object,
            offsetMm: 2,
            transform: { ...object.transform, rotation: 45 }
          }
        : object
    )
  }
}

function createPieceWithZeroOffsetCutline(source: PieceSourceFile): PiecePreset {
  const piece = createCutlineFromArtworkBounds(createPiecePresetFromSource(source, []))

  return {
    ...piece,
    cutline: {
      ...piece.cutline,
      transform: { ...piece.cutline.transform, offsetMm: 0 }
    },
    objects: piece.objects.map((object) =>
      object.role === 'cutline'
        ? {
            ...object,
            offsetMm: 0,
            transform: { ...object.transform, rotation: 0 }
          }
        : object
    )
  }
}

function createProject(
  source: PieceSourceFile,
  piece: PiecePreset,
  placedPiece: CutterProject['placedPieces'][number]
): CutterProject {
  return {
    sheet: { ...DEFAULT_CUTTER_SHEET, widthCm: 20, heightCm: 20, safeMarginCm: 1.5 },
    sources: [source],
    pieces: [piece],
    placedPieces: [placedPiece],
    layers: { artwork: true, cutlines: true },
    exportSettings: {
      strokeName: 'CutContour',
      includeArtwork: true,
      includeCutlines: true
    }
  }
}

function createSource(): PieceSourceFile {
  return {
    id: 'preflight-production-source',
    sourceKind: 'image',
    fileName: 'production-bounds.png',
    displayName: 'Production bounds',
    mimeType: 'image/png',
    bytes: new Uint8Array([137, 80, 78, 71]),
    previewUrl: 'blob:preflight-production-source',
    naturalWidthPx: 800,
    naturalHeightPx: 800
  }
}

function expect(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Expected ${message}`)
}

run()
