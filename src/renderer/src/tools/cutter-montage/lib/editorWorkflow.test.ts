import {
  alignEditorObjects,
  convertObjectToCutline,
  canMakeClippingMaskFromSelection,
  deleteEditorObjects,
  duplicateObjectAsCutline,
  duplicateObjects,
  makeClippingMaskFromSelection,
  makeClippingMaskAndCutlineFromSelection,
  matchObjectGeometry,
  releaseClippingMask,
  setObjectGroup,
  synchronizePieceEditorModel
} from './editorObjects'
import { normalizePiecePreset, syncLegacyFieldsFromObjects, updateObject } from './pieceModelSync'
import {
  createPiecePresetFromSource,
  createPlacedPieceFromPreset,
  resizePiecePreset,
  syncPieceBounds
} from './piecePresets'
import { parsePdfPageRange } from './pdfPageRange'
import { exportCutterPdf } from './pdfCutExport'
import { exportCutterSvg } from './svgExport'
import { applyCutterExportPreset } from './exportPresets'
import { autoArrangePieces } from './nesting'
import { detectOutOfBounds, detectOverlaps } from './nestingStrategies'
import { runCutterPreflight } from './preflight'
import { createProductionNotesText } from './productionNotes'
import { getPlacedProductionBounds } from './cutlineGenerator'
import { getRegistrationMarkOutOfBoundsCount, getRegistrationMarks } from './registrationMarks'
import { createCutlineFromArtworkBounds, validateCutterCutlines } from './cutlineValidation'
import { appendPenPoint, normalizePenPath } from './penPath'
import { constrainArtworkToMask, fitArtworkInsideMask, fitArtworkToCoverMask } from './maskUtils'
import { getShapeDrawTransform, translateDraftShape } from './shapeDraw'
import { resolvePieceHistoryUpdate } from '../hooks/usePieceEditorHistory'
import type {
  ArtworkTransform,
  CutterProject,
  EditorObject,
  EditorShapeType,
  PieceSourceFile
} from '../types'
import {
  calculateDraggedSheetHeight,
  DEFAULT_CUTTER_SHEET,
  getSafeArea,
  getSheetWarnings,
  normalizeCutterSheetSettings
} from './cutterLayout'
import { PDFDocument } from 'pdf-lib'
import {
  getMarkedSheetWidth,
  getPlacedSheetIndex,
  getProductionSheetCount,
  getProductionSheetHeight,
  getProductionSheetProject
} from './productionSheets'
import { cmToPoints } from './units'
import { TARGET_CUTTER_PROFILE } from './cutterDeviceProfile'
import { getSheetUsageStats } from './sheetUsage'
import { getProductionSheetLayoutGroups } from './productionSheetGroups'

async function run(): Promise<void> {
  expectEqual(DEFAULT_CUTTER_SHEET.heightCm, 100, 'production packing prefers a 100 cm length')
  expectEqual(
    calculateDraggedSheetHeight(100, 100, 10, 0.5),
    110,
    'dragging the sheet handle down increases its physical length'
  )
  expectEqual(
    calculateDraggedSheetHeight(100, -1_000, 10, 0.5),
    50,
    'dragging above the minimum clamps the sheet to 50 cm'
  )
  expectEqual(
    calculateDraggedSheetHeight(100, 1_000, 10, 0.5),
    140,
    'dragging below the maximum clamps the sheet to 140 cm'
  )
  expectEqual(
    calculateDraggedSheetHeight(100, 7, 10, 0.5),
    100.5,
    'dragged sheet heights snap to the configured grid step'
  )
  expectEqual(
    normalizeCutterSheetSettings({ ...DEFAULT_CUTTER_SHEET, heightCm: 13.5 }).heightCm,
    100,
    'legacy short sheet capacity migrates to the preferred 100 cm packing length'
  )
  expectEqual(
    normalizeCutterSheetSettings({ ...DEFAULT_CUTTER_SHEET, heightCm: 180 }).heightCm,
    140,
    'production packing length is capped at 140 cm'
  )
  expect(
    getSheetWarnings({ ...DEFAULT_CUTTER_SHEET, heightCm: 130 }).some((warning) =>
      warning.includes('100 cm is preferred')
    ),
    'a 130 cm production sheet warns that 100 cm is preferred'
  )
  expectEqual(TARGET_CUTTER_PROFILE.model, 'CG-130AR', 'target cutter profile')
  expectEqual(
    TARGET_CUTTER_PROFILE.applicationSheetMaxWidthCm,
    96,
    'CG-130AR profile keeps the user-defined 96 cm sheet maximum'
  )
  expectEqual(
    TARGET_CUTTER_PROFILE.applicationSheetMaxHeightCm,
    140,
    'CG-130AR profile allows production sheets up to 140 cm long'
  )
  const centeredCircle = getShapeDrawTransform(
    { startX: 5, startY: 5 },
    { xCm: 7, yCm: 6 },
    true,
    true
  )
  expectEqual(
    centeredCircle,
    {
      xCm: 3,
      yCm: 3,
      widthCm: 4,
      heightCm: 4,
      rotation: 0
    },
    'Shift+Alt circle grows symmetrically from initial center'
  )
  const repositionedCircle = translateDraftShape(centeredCircle, 1.25, -0.5)
  expectEqual(repositionedCircle.widthCm, 4, 'Space reposition preserves circle width')
  expectEqual(repositionedCircle.heightCm, 4, 'Space reposition preserves circle height')
  expectEqual(repositionedCircle.xCm, 4.25, 'Space reposition moves circle X')
  expectEqual(repositionedCircle.yCm, 2.5, 'Space reposition moves circle Y')

  const maskBounds = { xCm: 2, yCm: 2, widthCm: 4, heightCm: 4, rotation: 0 }
  const constrainedLargeArtwork = constrainArtworkToMask(
    { xCm: -20, yCm: -20, widthCm: 10, heightCm: 10, rotation: 0 },
    maskBounds
  )
  expectEqual(constrainedLargeArtwork.xCm, -4, 'large artwork cannot detach left of mask')
  expectEqual(constrainedLargeArtwork.yCm, -4, 'large artwork cannot detach above mask')
  const constrainedSmallArtwork = constrainArtworkToMask(
    { xCm: -20, yCm: -20, widthCm: 2, heightCm: 2, rotation: 0 },
    maskBounds
  )
  expectEqual(constrainedSmallArtwork.xCm, 2, 'small artwork stays inside mask horizontally')
  expectEqual(constrainedSmallArtwork.yCm, 2, 'small artwork stays inside mask vertically')

  const penPoints = [
    { xCm: 0.5, yCm: 0.5 },
    { xCm: 1.5, yCm: 1 },
    { xCm: 2.5, yCm: 0.75 }
  ]
  const normalizedPenPath = normalizePenPath(
    appendPenPoint(penPoints.slice(0, 2), penPoints[2]),
    5,
    5
  )
  expectExists(normalizedPenPath, 'pen stroke creates normalized path geometry')
  expectMatch(normalizedPenPath.pathData, /^M .+ L .+ L /, 'pen stroke keeps drawn points')
  expect(
    normalizedPenPath.transform.widthCm > 0 && normalizedPenPath.transform.heightCm > 0,
    'pen stroke has selectable bounds'
  )

  const source = createSource('sticker.png')
  let piece = createPiecePresetFromSource(source, [])
  expectEqual(piece.objects.length, 1, 'new artwork starts with one editor object')
  expectEqual(piece.objects[0]?.role, 'artwork', 'new artwork starts with artwork only')
  expectEqual(piece.cutlineObjectId, undefined, 'new artwork does not auto-create CutContour')
  expectEqual(piece.selectedObjectIds, [piece.artworkObjectId!], 'new artwork selects only artwork')
  const manualCutlinePiece = createCutlineFromArtworkBounds(piece)
  expectExists(
    manualCutlinePiece.cutlineObjectId,
    'manual artwork-bounds action creates CutContour'
  )
  expectEqual(
    manualCutlinePiece.objects.filter((object) => object.role === 'cutline').length,
    1,
    'manual artwork-bounds action creates one CutContour object'
  )
  expectEqual(
    manualCutlinePiece.selectedObjectIds,
    [manualCutlinePiece.cutlineObjectId!],
    'manual CutContour becomes selected'
  )
  const rapidResize = resolvePieceHistoryUpdate(piece, (currentPiece) =>
    resizePiecePreset(currentPiece, 4, 4, 'width')
  )
  const rapidResizeThenQuantity = resolvePieceHistoryUpdate(rapidResize, (currentPiece) => ({
    ...currentPiece,
    quantity: 100
  }))
  expectEqual(rapidResizeThenQuantity.widthCm, 4, 'rapid quantity edit preserves prior width')
  expectEqual(
    rapidResizeThenQuantity.heightCm,
    rapidResize.heightCm,
    'rapid quantity edit preserves prior height'
  )
  expectEqual(rapidResizeThenQuantity.quantity, 100, 'rapid quantity edit reaches 100 copies')
  const rectangle = createHelper('helper-rectangle', 'rectangle', {
    xCm: 1.25,
    yCm: 0.75,
    widthCm: 4.5,
    heightCm: 3.25,
    rotation: 17
  })
  const ellipse = createHelper('helper-ellipse', 'ellipse', {
    xCm: 2.5,
    yCm: 1.5,
    widthCm: 3.75,
    heightCm: 3.75,
    rotation: 9
  })
  piece = syncLegacyFieldsFromObjects({
    ...piece,
    objects: [...piece.objects, rectangle, ellipse],
    helperObjectIds: [rectangle.id, ellipse.id],
    selectedObjectIds: [rectangle.id, ellipse.id]
  })

  expectEqual(
    piece.selectedObjectIds,
    [rectangle.id, ellipse.id],
    'selection keeps real helper ids'
  )
  expectEqual(
    piece.objects.filter((object) => object.role === 'helper').length,
    2,
    'multiple helpers coexist'
  )

  assertPasteInPlace(piece.objects, rectangle)
  assertPasteInPlace(piece.objects, ellipse)

  const cutlinePiece = duplicateObjectAsCutline(piece, ellipse.id)
  const cutline = cutlinePiece.objects.find((object) => object.id === cutlinePiece.cutlineObjectId)
  expectExists(cutline, 'duplicated cutline object')
  expect(cutline.id !== ellipse.id, 'duplicated cutline gets a new id')
  expectEqual(cutline.transform, ellipse.transform, 'cutline geometry exactly matches source')
  expectEqual(cutline.role, 'cutline', 'cutline role')
  expectEqual(cutline.type, 'cutline', 'cutline type')
  expectEqual(cutline.strokeName, 'CutContour', 'cutline spot name')
  expectEqual(cutline.fillColor, 'none', 'cutline fill')
  expect(
    cutlinePiece.objects.some((object) => object.id === ellipse.id),
    'source shape still exists'
  )
  expectEqual(cutlinePiece.selectedObjectIds, [cutline.id], 'new cutline becomes selected')

  const artwork = piece.objects.find((object) => object.role === 'artwork')
  expectExists(artwork, 'artwork object')
  assertKeyAlignment(artwork, cutline)

  const matched = matchObjectGeometry(cutlinePiece, cutline.id, ellipse.id)
  expectEqual(
    matched.objects.find((object) => object.id === cutline.id)?.transform,
    ellipse.transform,
    'match cutline to mask copies x/y/w/h/rotation exactly'
  )

  piece = makeClippingMaskFromSelection(
    syncLegacyFieldsFromObjects({
      ...cutlinePiece,
      selectedObjectIds: [artwork.id, ellipse.id]
    })
  )
  expectEqual(piece.clippingMaskEnabled, true, 'clipping enabled')
  expectEqual(piece.maskObjectId, ellipse.id, 'selected shape becomes mask by id')
  expectEqual(
    piece.objects.find((object) => object.id === ellipse.id)?.role,
    'clipping-mask',
    'mask role'
  )
  expectEqual(
    piece.objects.find((object) => object.id === ellipse.id)?.locked,
    true,
    'active mask is locked'
  )
  const fittedArtwork = fitArtworkInsideMask(artwork.transform, ellipse.transform)
  const coveredArtwork = { ...artwork.transform }
  expectEqual(
    piece.objects.find((object) => object.id === artwork.id)?.transform,
    coveredArtwork,
    'new clipping mask preserves artwork position, size and rotation'
  )
  expectEqual(
    piece.objects.find((object) => object.id === artwork.id)?.locked,
    true,
    'active artwork is locked'
  )
  expectEqual(piece.maskWorkflowVersion, 3, 'active mask workflow is versioned')
  expectEqual(
    piece.objects.find((object) => object.id === ellipse.id)?.transform,
    ellipse.transform,
    'cover-fit preserves exact mask geometry'
  )
  const screenshotMaskedPiece = {
    ...syncPieceBounds(piece, 10.9, 11.3),
    quantity: 125
  }
  const screenshotLayout = autoArrangePieces([screenshotMaskedPiece], {
    ...DEFAULT_CUTTER_SHEET,
    heightCm: 76.5,
    lengthMode: 'fixed'
  })
  const screenshotFirstSheetCount = screenshotLayout.placedPieces.filter(
    (placed) => getPlacedSheetIndex(placed) === 0
  ).length
  expect(
    screenshotFirstSheetCount > 9,
    '125 masked 10.9 x 11.3 cm pieces use more than one row on a 76.5 cm sheet'
  )
  expect(
    getProductionSheetCount(screenshotLayout.placedPieces) < 14,
    'the screenshot-sized masked job does not create fourteen one-row sheets'
  )
  const screenshotUnmaskedPiece = {
    ...syncPieceBounds(createPiecePresetFromSource(createSource('screenshot.png'), []), 10.9, 11.3),
    quantity: 125
  }
  const screenshotUnmaskedLayout = autoArrangePieces([screenshotUnmaskedPiece], {
    ...DEFAULT_CUTTER_SHEET,
    heightCm: 100,
    lengthMode: 'fixed'
  })
  expect(
    screenshotUnmaskedLayout.placedPieces.filter((placed) => getPlacedSheetIndex(placed) === 0)
      .length > 8,
    '125 unmasked 10.9 x 11.3 cm pieces wrap into more than one row'
  )
  expectEqual(
    canMakeClippingMaskFromSelection(piece, [artwork.id, ellipse.id]),
    false,
    'active mask cannot be remade without release'
  )
  const attemptedMaskEdit = matchObjectGeometry(piece, ellipse.id, artwork.id)
  expectEqual(
    attemptedMaskEdit.objects.find((object) => object.id === ellipse.id)?.transform,
    piece.objects.find((object) => object.id === ellipse.id)?.transform,
    'active mask geometry cannot be changed'
  )
  expect(
    piece.objects.some((object) => object.id === artwork.id),
    'original artwork is preserved'
  )
  const artworkTransformBeforeContentMove = piece.objects.find(
    (object) => object.id === artwork.id
  )?.transform
  const movedContent = updateObject(piece, artwork.id, {
    transform: { ...artwork.transform, xCm: artwork.transform.xCm + 1.25 }
  })
  expectEqual(
    movedContent.objects.find((object) => object.id === artwork.id)?.transform,
    artworkTransformBeforeContentMove,
    'locked masked artwork cannot move'
  )

  const legacyArtworkTransform = {
    ...artwork.transform,
    xCm: -4,
    yCm: -3,
    widthCm: artwork.transform.widthCm * 1.5,
    heightCm: artwork.transform.heightCm * 1.5
  }
  const legacyActive = {
    ...piece,
    maskWorkflowVersion: undefined,
    artworkLockBeforeMask: undefined,
    objectLocks: { ...piece.objectLocks, artwork: false },
    objects: piece.objects.map((object) =>
      object.id === artwork.id
        ? { ...object, locked: false, transform: legacyArtworkTransform }
        : object
    )
  }
  const migratedLegacy = normalizePiecePreset(legacyActive)
  expectEqual(
    migratedLegacy.objects.find((object) => object.id === artwork.id)?.transform,
    fitArtworkToCoverMask(legacyArtworkTransform, ellipse.transform),
    'legacy unlocked active mask is cover-migrated'
  )
  expectEqual(
    migratedLegacy.objects.find((object) => object.id === artwork.id)?.locked,
    true,
    'legacy migration locks artwork'
  )
  expectEqual(migratedLegacy.maskWorkflowVersion, 3, 'legacy migration writes workflow marker')
  const migratedAgain = normalizePiecePreset(migratedLegacy)
  expectEqual(
    migratedAgain.objects.find((object) => object.id === artwork.id)?.transform,
    migratedLegacy.objects.find((object) => object.id === artwork.id)?.transform,
    'mask migration is idempotent'
  )
  const v2ContainArtwork = fitArtworkInsideMask(artwork.transform, ellipse.transform)
  const v2Active = {
    ...piece,
    maskWorkflowVersion: 2 as const,
    objectLocks: { ...piece.objectLocks, artwork: true },
    objects: piece.objects.map((object) =>
      object.id === artwork.id ? { ...object, locked: true, transform: v2ContainArtwork } : object
    )
  }
  const migratedV2 = normalizePiecePreset(v2Active)
  expectEqual(
    migratedV2.objects.find((object) => object.id === artwork.id)?.transform,
    fitArtworkToCoverMask(v2ContainArtwork, ellipse.transform),
    'version-2 contain-fitted artwork migrates to cover geometry'
  )
  expectEqual(migratedV2.maskWorkflowVersion, 3, 'version-2 migration advances workflow marker')
  expectEqual(
    migratedV2.objects.find((object) => object.id === ellipse.id)?.transform,
    ellipse.transform,
    'version-2 migration preserves exact mask geometry'
  )
  const migratedV2Again = normalizePiecePreset(migratedV2)
  expectEqual(
    migratedV2Again.objects.find((object) => object.id === artwork.id)?.transform,
    migratedV2.objects.find((object) => object.id === artwork.id)?.transform,
    'version-2 cover migration is idempotent'
  )
  const alreadyLockedLegacy = normalizePiecePreset({
    ...piece,
    maskWorkflowVersion: undefined,
    objects: piece.objects.map((object) =>
      object.id === artwork.id
        ? {
            ...object,
            locked: true,
            transform: { ...object.transform, xCm: object.transform.xCm + 0.75 }
          }
        : object
    )
  })
  expectEqual(
    alreadyLockedLegacy.objects.find((object) => object.id === artwork.id)?.transform.xCm,
    coveredArtwork.xCm + 0.75,
    'already locked legacy artwork is not rescaled'
  )

  const pastedMask = duplicateObjects(piece.objects, [ellipse.id], true)
  const pastedMaskId = pastedMask.selectedObjectIds[0]
  const pastedMaskPiece = synchronizePieceEditorModel(
    syncLegacyFieldsFromObjects({
      ...piece,
      objects: pastedMask.objects,
      selectedObjectIds: pastedMask.selectedObjectIds
    })
  )
  expectEqual(
    pastedMaskPiece.objects.find((object) => object.id === pastedMaskId)?.role,
    'helper',
    'pasted canonical mask becomes an editable helper'
  )
  expectEqual(
    pastedMaskPiece.selectedObjectIds,
    [pastedMaskId],
    'pasted mask helper remains selected after model normalization'
  )
  const convertedPastedMask = synchronizePieceEditorModel(
    convertObjectToCutline(pastedMaskPiece, pastedMaskId)
  )
  expectEqual(
    convertedPastedMask.selectedObjectIds,
    [pastedMaskId],
    'converted pasted mask remains selected as canonical cutline'
  )
  expectEqual(
    convertedPastedMask.cutlineObjectId,
    pastedMaskId,
    'converted pasted mask becomes canonical CutContour by id'
  )

  const released = releaseClippingMask(piece)
  expectEqual(released.clippingMaskEnabled, false, 'clipping released')
  expectEqual(released.maskObjectId, undefined, 'released mask id cleared')
  expectEqual(
    released.objects.find((object) => object.id === ellipse.id)?.locked,
    false,
    'released mask becomes editable'
  )
  expectEqual(
    released.objects.find((object) => object.id === artwork.id)?.locked,
    false,
    'release restores prior artwork editability'
  )

  const combined = makeClippingMaskAndCutlineFromSelection(
    {
      ...released,
      selectedObjectIds: [released.artworkObjectId, ellipse.id].filter(Boolean) as string[]
    },
    [released.artworkObjectId, ellipse.id].filter(Boolean) as string[]
  )
  const combinedMask = combined.objects.find((object) => object.id === combined.maskObjectId)
  const combinedCutline = combined.objects.find((object) => object.id === combined.cutlineObjectId)
  expectEqual(combined.clippingMaskEnabled, true, 'combined action enables clipping')
  expectEqual(combinedMask?.shapeType, 'ellipse', 'combined mask keeps ellipse geometry')
  expectEqual(combinedCutline?.shapeType, 'ellipse', 'combined cutline copies ellipse geometry')
  expectEqual(combinedMask?.groupId, combinedCutline?.groupId, 'mask and cutline stay linked')
  const combinedReleased = releaseClippingMask(combined)
  expectEqual(combinedReleased.clippingMaskEnabled, false, 'combined mask can be released')
  expectEqual(
    combinedReleased.objects.find((object) => object.id === combined.cutlineObjectId)?.role,
    'cutline',
    'releasing mask preserves CutContour'
  )
  const maskFromCutline = makeClippingMaskFromSelection(
    combinedReleased,
    [combinedReleased.artworkObjectId, combinedReleased.cutlineObjectId].filter(Boolean) as string[]
  )
  expectEqual(
    canMakeClippingMaskFromSelection(
      combinedReleased,
      [combinedReleased.artworkObjectId, combinedReleased.cutlineObjectId].filter(
        Boolean
      ) as string[]
    ),
    true,
    'fresh artwork and existing CutContour enable Make Mask'
  )
  expectEqual(maskFromCutline.clippingMaskEnabled, true, 'selected CutContour can create mask')
  expectEqual(
    maskFromCutline.objects.find((object) => object.id === combinedReleased.cutlineObjectId)?.role,
    'cutline',
    'masking from CutContour preserves contour semantics'
  )
  expect(
    maskFromCutline.maskObjectId !== maskFromCutline.cutlineObjectId,
    'CutContour is cloned into a separate non-destructive mask'
  )
  const deletedMask = deleteEditorObjects(maskFromCutline, [maskFromCutline.maskObjectId!])
  expectEqual(deletedMask.clippingMaskEnabled, false, 'deleting mask disables clipping')
  expectEqual(deletedMask.maskObjectId, undefined, 'deleting mask clears mask id')
  expectEqual(
    deletedMask.objects.find((object) => object.id === maskFromCutline.cutlineObjectId)?.role,
    'cutline',
    'deleting linked mask preserves CutContour'
  )
  const deletedCutline = synchronizePieceEditorModel(
    deleteEditorObjects(deletedMask, [deletedMask.cutlineObjectId!])
  )
  expectEqual(deletedCutline.cutlineObjectId, undefined, 'deleting CutContour clears contour id')
  expectEqual(deletedCutline.groupLinked, false, 'deleting group mate clears orphaned group')
  const deletedArtwork = synchronizePieceEditorModel(
    deleteEditorObjects(deletedCutline, [deletedCutline.artworkObjectId!])
  )
  expectEqual(deletedArtwork.artworkObjectId, undefined, 'deleting artwork clears artwork id')
  expect(
    !deletedArtwork.selectedObjectIds.includes(deletedCutline.artworkObjectId!),
    'deleting artwork clears stale selection'
  )
  const deletedAll = synchronizePieceEditorModel(
    deleteEditorObjects(
      piece,
      piece.objects.map((object) => object.id)
    )
  )
  expectEqual(deletedAll.objects.length, 0, 'deleting every object remains empty after sync')
  expectEqual(deletedAll.artworkObjectId, undefined, 'empty editor does not recreate artwork')
  expectEqual(deletedAll.cutlineObjectId, undefined, 'empty editor does not recreate CutContour')
  expectEqual(
    released.objects.find((object) => object.id === ellipse.id)?.role,
    'helper',
    'released mask remains editable'
  )

  const grouped = setObjectGroup(
    syncLegacyFieldsFromObjects({
      ...piece,
      selectedObjectIds: [artwork.id, ellipse.id, cutline.id]
    }),
    [artwork.id, ellipse.id, cutline.id],
    true
  )
  const groupIds = new Set(
    grouped.objects
      .filter((object) => [artwork.id, ellipse.id, cutline.id].includes(object.id))
      .map((object) => object.groupId)
  )
  expectEqual(groupIds.size, 1, 'linked workflow objects share one group id')

  const placed = createPlacedPieceFromPreset(piece, 2, 3)
  const project: CutterProject = {
    sheet: { ...DEFAULT_CUTTER_SHEET, widthCm: 95, heightCm: 120 },
    sources: [source],
    pieces: [piece],
    placedPieces: [placed],
    layers: { artwork: true, cutlines: true },
    exportSettings: {
      strokeName: 'CutContour',
      includeArtwork: true,
      includeCutlines: true
    }
  }
  const emptyUsage = getSheetUsageStats({
    ...project,
    sources: [],
    pieces: [],
    placedPieces: []
  })
  expectEqual(emptyUsage.sheetCount, 0, 'empty job reports no production sheets')
  expectEqual(emptyUsage.usedHeightCm, 0, 'empty job reports no material usage')
  const svg = await (await exportCutterSvg(project)).blob.text()
  expectMatch(svg, /width="950mm" height="1200mm" viewBox="0 0 950 1200"/, 'physical SVG artboard')
  expectMatch(svg, /<defs>[\s\S]*<clipPath id="clip-piece-/, 'SVG clip path')
  expectMatch(svg, /<g id="Artwork"/, 'Artwork group')
  expectMatch(svg, /<g id="CutContour"/, 'CutContour group')
  expectMatch(
    svg,
    /<(rect|ellipse|path)[^>]+data-spot-name="CutContour"[^>]+fill="none"/,
    'vector CutContour'
  )
  expect(!/<image[^>]+data-spot-name="CutContour"/.test(svg), 'cutline must not be raster')
  const registrationProject: CutterProject = {
    ...project,
    sheet: {
      ...project.sheet,
      registrationMarks: {
        enabled: true,
        type: 'mimaki',
        sizeMm: 10,
        marginMm: 0,
        color: '#000000',
        includeIn: 'artwork'
      },
      productionLabel: {
        enabled: true,
        position: 'bottom-left',
        size: 'small',
        placement: 'margin'
      }
    },
    exportSettings: {
      ...project.exportSettings,
      includeRegistrationMarks: true,
      includeProductionLabel: true,
      preset: 'illustrator-print-cut-svg'
    },
    productionInfo: { jobName: 'Client Stickers', appName: 'My Printer App by Maher Tka' }
  }
  expectEqual(
    getRegistrationMarks(registrationProject).length,
    5,
    'app creates four Mimaki Type 1 corners and one direction mark'
  )
  expectEqual(
    getRegistrationMarkOutOfBoundsCount(registrationProject),
    0,
    'registration marks stay inside sheet'
  )
  const registrationSvg = await (await exportCutterSvg(registrationProject)).blob.text()
  expect(
    registrationSvg.includes('data-mimaki-mark="type-1"') &&
      registrationSvg.includes('data-mimaki-mark="direction"'),
    'production SVG contains app-generated Mimaki marks'
  )
  expectMatch(registrationSvg, /<g id="ProductionInfo"/, 'production label in SVG')
  const placedFootprint = getPlacedProductionBounds(placed, piece)
  const overlappingMarksPreflight = runCutterPreflight({
    ...registrationProject,
    placedPieces: [
      {
        ...placed,
        xCm: placed.xCm + 0.7 - placedFootprint.xCm,
        yCm: placed.yCm + 0.7 - placedFootprint.yCm
      }
    ]
  })
  expect(
    overlappingMarksPreflight.issues.some((issue) => issue.id === 'registration-overlap'),
    'preflight detects actual production footprints covering app-generated marks'
  )
  const mimakiPreset = applyCutterExportPreset('mimaki-cutcontour-svg', registrationProject.sheet)
  expectEqual(
    mimakiPreset.exportSettings.strokeName,
    'CutContour',
    'Mimaki preset forces CutContour stroke name'
  )
  expectEqual(mimakiPreset.exportSettings.includeCutlines, true, 'Mimaki preset keeps cutlines on')
  expectEqual(
    mimakiPreset.exportSettings.includeRegistrationMarks,
    true,
    'Mimaki preset includes the app-generated marks'
  )
  const wrongSpotPiece = {
    ...piece,
    cutline: { ...piece.cutline, strokeName: 'KnifeLine' },
    objects: piece.objects.map((object) =>
      object.role === 'cutline' ? { ...object, strokeName: 'KnifeLine' } : object
    )
  }
  expect(
    validateCutterCutlines({ ...project, pieces: [wrongSpotPiece] }).some(
      (issue) => issue.id === 'piece-cutline-wrong-spot'
    ),
    'cutline validator catches wrong spot name'
  )
  const notes = createProductionNotesText(
    registrationProject,
    runCutterPreflight(registrationProject),
    [
      '01_Mimaki_Marked_Print_Layout_01_PRINT_1_COPY.pdf',
      '02_Mimaki_PrintCut_Layout_01_PRINT_1_COPY.svg'
    ]
  )
  expectMatch(notes, /Job name: Client Stickers/, 'production notes include job name')
  expectMatch(
    notes,
    /02_Mimaki_PrintCut_Layout_01_PRINT_1_COPY.svg/,
    'production notes include file list'
  )

  const printOnlySvg = await (
    await exportCutterSvg({
      ...project,
      exportSettings: {
        ...project.exportSettings,
        includeArtwork: true,
        includeCutlines: false,
        mode: 'print-only'
      }
    })
  ).blob.text()
  expectMatch(printOnlySvg, /<g id="Artwork"/, 'Print Only includes Artwork')
  expect(!/<g id="CutContour"/.test(printOnlySvg), 'Print Only excludes CutContour group')
  const cutOnlySvg = await (
    await exportCutterSvg({
      ...project,
      exportSettings: {
        ...project.exportSettings,
        includeArtwork: false,
        includeCutlines: true,
        mode: 'cut-only'
      }
    })
  ).blob.text()
  expect(!/<g id="Artwork"/.test(cutOnlySvg), 'Cut Only excludes Artwork group')
  expectMatch(cutOnlySvg, /<g id="CutContour"/, 'Cut Only includes CutContour')
  expectEqual(parsePdfPageRange('1-3,7,3', 10), [1, 2, 3, 7], 'PDF range parser')
  const svgPdfSource = createSvgSourceWithRasterPreview('sticker.svg')
  const svgPdfPiece = createPiecePresetFromSource(svgPdfSource, [])
  const svgPdfPlaced = createPlacedPieceFromPreset(svgPdfPiece, 1, 1)
  const svgPdfExport = await exportCutterPdf({
    ...project,
    sources: [svgPdfSource],
    pieces: [svgPdfPiece],
    placedPieces: [svgPdfPlaced]
  })
  const svgPdfText = new TextDecoder().decode(await svgPdfExport.blob.arrayBuffer())
  expect(!svgPdfText.includes('SVG artwork'), 'PDF export no longer writes SVG placeholder text')

  const mixedPiece = { ...sameSizePiece(piece, 'mixed-small', 3, 2), quantity: 4 }
  const largePiece = { ...sameSizePiece(piece, 'mixed-large', 8, 6), quantity: 2 }
  const arranged = autoArrangePieces([mixedPiece, largePiece], {
    ...DEFAULT_CUTTER_SHEET,
    widthCm: 30,
    heightCm: 30,
    sortStrategy: 'largest-first'
  })
  expectEqual(arranged.placedCount, 6, 'mixed-size auto arrange places all requested pieces')
  expect((arranged.usedAreaPercent ?? 0) > 0, 'auto arrange reports used area')
  expectEqual(
    detectOutOfBounds(arranged.placedPieces, {
      ...DEFAULT_CUTTER_SHEET,
      widthCm: 30,
      heightCm: 30
    }),
    [],
    'arranged pieces stay in bounds'
  )

  const overlapping = [
    createPlacedPieceFromPreset(piece, 1, 1),
    createPlacedPieceFromPreset(piece, 1.5, 1.5)
  ]
  expectEqual(detectOverlaps(overlapping).length, 1, 'overlap detection finds obvious collision')
  const outside = { ...createPlacedPieceFromPreset(piece, 94, 119), widthCm: 5, heightCm: 5 }
  expectEqual(
    detectOutOfBounds([outside], project.sheet),
    [outside.id],
    'out-of-bounds detection finds overflow'
  )
  const preflight = runCutterPreflight({ ...project, placedPieces: overlapping })
  expect(
    preflight.issues.some((issue) => issue.id === 'overlap'),
    'preflight reports overlaps'
  )

  const locked = { ...createPlacedPieceFromPreset(piece, 3, 4), locked: true }
  const withLocked = autoArrangePieces(
    [{ ...piece, quantity: 2 }],
    { ...DEFAULT_CUTTER_SHEET, preserveManualPositions: false },
    [locked]
  )
  expectEqual(
    withLocked.placedPieces.find((placedPiece) => placedPiece.id === locked.id),
    locked,
    'locked placed piece remains fixed during auto arrange'
  )
  expectEqual(
    withLocked.placedPieces.length,
    2,
    'locked retained copy counts toward requested quantity'
  )

  const productionPiece = { ...sameSizePiece(piece, 'production-copy', 5, 5), quantity: 400 }
  const productionLayout = autoArrangePieces([productionPiece], DEFAULT_CUTTER_SHEET)
  const productionSheetCount = getProductionSheetCount(productionLayout.placedPieces)
  expectEqual(productionLayout.placedCount, 400, 'production layout places every requested copy')
  expect(productionSheetCount > 1, 'production layout overflows onto additional sheets')
  expectEqual(
    getSafeArea(DEFAULT_CUTTER_SHEET).xCm,
    DEFAULT_CUTTER_SHEET.safeMarginCm,
    'the 15 mm safe margin reserves the 10 mm registration arms plus clearance'
  )
  for (let sheetIndex = 0; sheetIndex < productionSheetCount; sheetIndex += 1) {
    expect(
      getMarkedSheetWidth(productionLayout.placedPieces, DEFAULT_CUTTER_SHEET, sheetIndex) <= 96,
      `production sheet ${sheetIndex + 1} stays within the 96 cm final width`
    )
    expect(
      getProductionSheetHeight(productionLayout.placedPieces, DEFAULT_CUTTER_SHEET, sheetIndex) <=
        100,
      `production sheet ${sheetIndex + 1} stays within the preferred 100 cm length`
    )
    if (sheetIndex < productionSheetCount - 1) {
      expectEqual(
        getProductionSheetHeight(productionLayout.placedPieces, DEFAULT_CUTTER_SHEET, sheetIndex),
        100,
        `full production sheet ${sheetIndex + 1} keeps the complete one-meter length`
      )
    }
  }
  expectEqual(
    getProductionSheetHeight(
      productionLayout.placedPieces,
      { ...DEFAULT_CUTTER_SHEET, heightCm: 50, lengthMode: 'fixed' },
      0
    ),
    50,
    'a fixed half-meter material order keeps the complete 50 cm output length'
  )
  const productionPdf = await exportCutterPdf({
    ...project,
    sheet: DEFAULT_CUTTER_SHEET,
    pieces: [productionPiece],
    placedPieces: productionLayout.placedPieces,
    exportSettings: {
      ...project.exportSettings,
      includeArtwork: false,
      includeCutlines: true,
      includeRegistrationMarks: true
    }
  })
  const productionLayoutCount = getProductionSheetLayoutGroups({
    ...project,
    sheet: DEFAULT_CUTTER_SHEET,
    pieces: [productionPiece],
    placedPieces: productionLayout.placedPieces
  }).length
  const loadedProductionPdf = await PDFDocument.load(await productionPdf.blob.arrayBuffer())
  expectEqual(
    loadedProductionPdf.getPageCount(),
    productionLayoutCount,
    'production PDF creates one page per unique imposed layout'
  )
  for (const page of loadedProductionPdf.getPages()) {
    expect(
      page.getWidth() <= cmToPoints(96) + 0.01 && page.getHeight() <= cmToPoints(100) + 0.01,
      'default production PDF pages stay within the 96 x 100 cm preferred size'
    )
  }
  const secondHandoffSheet = getProductionSheetProject(
    {
      ...project,
      sheet: DEFAULT_CUTTER_SHEET,
      pieces: [productionPiece],
      placedPieces: productionLayout.placedPieces
    },
    1
  )
  expect(
    secondHandoffSheet.placedPieces.length > 0 &&
      secondHandoffSheet.placedPieces.every((placedPiece) => placedPiece.sheetIndex === 1),
    'Mimaki package isolates only the selected production sheet'
  )
  const secondHandoffSvg = await exportCutterSvg({
    ...secondHandoffSheet,
    exportSettings: {
      ...secondHandoffSheet.exportSettings,
      includeRegistrationMarks: false,
      includeProductionLabel: false
    }
  })
  expect(
    !(await secondHandoffSvg.blob.text()).includes('RegistrationMarks'),
    'explicit cut-only selected-sheet export contains no generated marks'
  )

  const mixedModels = [
    { ...sameSizePiece(piece, 'round-4cm', 4, 4), quantity: 31 },
    { ...sameSizePiece(piece, 'wide-8x3cm', 8, 3), quantity: 17 },
    { ...sameSizePiece(piece, 'label-6x5cm', 6, 5), quantity: 24 },
    { ...sameSizePiece(piece, 'badge-7cm', 7, 7), quantity: 12 },
    { ...sameSizePiece(piece, 'mini-3cm', 3, 3), quantity: 40 },
    { ...sameSizePiece(piece, 'strip-12x2cm', 12, 2), quantity: 9 }
  ]
  const mixedLayout = autoArrangePieces(mixedModels, DEFAULT_CUTTER_SHEET)
  expectEqual(
    mixedLayout.placedCount,
    mixedModels.reduce((total, model) => total + model.quantity, 0),
    'mixed-model job places every requested quantity'
  )
  for (const model of mixedModels) {
    expectEqual(
      mixedLayout.placedPieces.filter((placedPiece) => placedPiece.presetId === model.id).length,
      model.quantity,
      `mixed-model job preserves ${model.id} quantity`
    )
  }
  expectEqual(
    detectOverlaps(mixedLayout.placedPieces),
    [],
    'mixed variable-size production sheets have no contour-footprint overlaps'
  )

  const sameFileCopy = createPiecePresetFromSource(source, [piece])
  expectEqual(sameFileCopy.displayName, 'sticker copy 2', 'same-file duplicate naming')
  expectEqual(
    synchronizePieceEditorModel(piece).selectedObjectIds,
    piece.selectedObjectIds,
    'model sync preserves id selection'
  )

  console.log('Cutter editor workflow tests passed.')
}

function assertPasteInPlace(objects: EditorObject[], source: EditorObject): void {
  const pasted = duplicateObjects(objects, [source.id], true)
  const pastedShape = pasted.objects.find((object) => object.id === pasted.selectedObjectIds[0])
  expectExists(pastedShape, `${source.shapeType} paste in place should select the new object`)
  expect(pastedShape.id !== source.id, `${source.shapeType} paste gets a new id`)
  expectEqual(
    pastedShape.transform,
    source.transform,
    `${source.shapeType} paste in place retains exact geometry`
  )
}

function assertKeyAlignment(artwork: EditorObject, cutline: EditorObject): void {
  const objects: EditorObject[] = [
    { ...artwork, transform: { ...artwork.transform, xCm: 8, yCm: 9 } },
    { ...cutline, transform: { ...cutline.transform, xCm: 2, yCm: 3 } }
  ]
  const ids = objects.map((object) => object.id)
  const cutlineKey = alignEditorObjects(objects, ids, cutline.id, 'center-horizontal')
  expectEqual(
    cutlineKey.find((object) => object.id === cutline.id)?.transform,
    objects[1].transform,
    'cutline key stays fixed'
  )
  expect(
    cutlineKey.find((object) => object.id === artwork.id)?.transform.xCm !==
      objects[0].transform.xCm,
    'artwork moves when cutline is key'
  )

  const artworkKey = alignEditorObjects(objects, ids, artwork.id, 'center-vertical')
  expectEqual(
    artworkKey.find((object) => object.id === artwork.id)?.transform,
    objects[0].transform,
    'artwork key stays fixed'
  )
  expect(
    artworkKey.find((object) => object.id === cutline.id)?.transform.yCm !==
      objects[1].transform.yCm,
    'cutline moves when artwork is key'
  )
}

function createHelper(
  id: string,
  shapeType: EditorShapeType,
  transform: ArtworkTransform
): EditorObject {
  return {
    id,
    type: 'helper-shape',
    shapeType,
    role: 'helper',
    name: shapeType === 'ellipse' ? 'Helper Shape 2' : 'Helper Shape 1',
    visible: true,
    locked: false,
    transform: { ...transform },
    fillColor: 'rgba(139, 92, 246, 0.1)',
    strokeColor: '#8b5cf6',
    strokeWidthPt: 0.75,
    exportEnabled: false
  }
}

function createSource(fileName: string): PieceSourceFile {
  return {
    id: 'source-test',
    sourceKind: 'image',
    fileName,
    displayName: fileName.replace(/\.[^.]+$/, ''),
    mimeType: 'image/png',
    bytes: new Uint8Array([137, 80, 78, 71]),
    previewUrl: 'blob:test-source',
    naturalWidthPx: 800,
    naturalHeightPx: 600
  }
}

function createSvgSourceWithRasterPreview(fileName: string): PieceSourceFile {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="red"/></svg>'
  const pngPreview =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lN2e6wAAAABJRU5ErkJggg=='

  return {
    id: 'source-svg-test',
    sourceKind: 'svg',
    fileName,
    displayName: fileName.replace(/\.[^.]+$/, ''),
    mimeType: 'image/svg+xml',
    bytes: new TextEncoder().encode(svg),
    previewUrl: pngPreview,
    previewDataUrl: pngPreview,
    naturalWidthPx: 20,
    naturalHeightPx: 20
  }
}

function sameSizePiece(
  piece: ReturnType<typeof createPiecePresetFromSource>,
  id: string,
  widthCm: number,
  heightCm: number
) {
  return {
    ...piece,
    id,
    displayName: id,
    widthCm,
    heightCm,
    artwork: { ...piece.artwork, transform: { ...piece.artwork.transform, widthCm, heightCm } },
    cutline: { ...piece.cutline, transform: { ...piece.cutline.transform, widthCm, heightCm } },
    objects: piece.objects.map((object) => ({
      ...object,
      id: `${id}-${object.id}`,
      transform: { ...object.transform, widthCm, heightCm }
    })),
    artworkObjectId: `${id}-${piece.artworkObjectId}`,
    cutlineObjectId: piece.cutlineObjectId ? `${id}-${piece.cutlineObjectId}` : undefined,
    selectedObjectIds: []
  }
}

void run()

function expect(condition: boolean, label: string): asserts condition {
  if (!condition) throw new Error(label)
}

function expectExists<T>(value: T | null | undefined, label: string): asserts value is T {
  expect(value !== null && value !== undefined, label)
}

function expectEqual(actual: unknown, expected: unknown, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

function expectMatch(value: string, pattern: RegExp, label: string): void {
  expect(pattern.test(value), `${label}: pattern ${pattern} was not found`)
}
