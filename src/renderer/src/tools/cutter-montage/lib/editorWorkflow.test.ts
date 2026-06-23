import {
  alignEditorObjects,
  duplicateObjectAsCutline,
  duplicateObjects,
  makeClippingMaskFromSelection,
  matchObjectGeometry,
  releaseClippingMask,
  setObjectGroup,
  synchronizePieceEditorModel
} from './editorObjects'
import { syncLegacyFieldsFromObjects } from './pieceModelSync'
import { createPiecePresetFromSource, createPlacedPieceFromPreset } from './piecePresets'
import { exportCutterSvg } from './svgExport'
import type {
  ArtworkTransform,
  CutterProject,
  EditorObject,
  EditorShapeType,
  PieceSourceFile
} from '../types'
import { DEFAULT_CUTTER_SHEET } from './cutterLayout'

async function run(): Promise<void> {
  const source = createSource('sticker.png')
  let piece = createPiecePresetFromSource(source, [])
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

  expectEqual(piece.selectedObjectIds, [rectangle.id, ellipse.id], 'selection keeps real helper ids')
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
  expect(cutlinePiece.objects.some((object) => object.id === ellipse.id), 'source shape still exists')
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

  piece = makeClippingMaskFromSelection(syncLegacyFieldsFromObjects({
    ...cutlinePiece,
    selectedObjectIds: [artwork.id, ellipse.id]
  }))
  expectEqual(piece.clippingMaskEnabled, true, 'clipping enabled')
  expectEqual(piece.maskObjectId, ellipse.id, 'selected shape becomes mask by id')
  expectEqual(
    piece.objects.find((object) => object.id === ellipse.id)?.role,
    'clipping-mask',
    'mask role'
  )
  expect(piece.objects.some((object) => object.id === artwork.id), 'original artwork is preserved')

  const released = releaseClippingMask(piece)
  expectEqual(released.clippingMaskEnabled, false, 'clipping released')
  expectEqual(released.maskObjectId, undefined, 'released mask id cleared')
  expectEqual(
    released.objects.find((object) => object.id === ellipse.id)?.role,
    'helper',
    'released mask remains editable'
  )

  const grouped = setObjectGroup(
    syncLegacyFieldsFromObjects({ ...piece, selectedObjectIds: [artwork.id, ellipse.id, cutline.id] }),
    [artwork.id, ellipse.id, cutline.id],
    true
  )
  const groupIds = new Set(grouped.objects
    .filter((object) => [artwork.id, ellipse.id, cutline.id].includes(object.id))
    .map((object) => object.groupId))
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
  const svg = await (await exportCutterSvg(project)).blob.text()
  expectMatch(svg, /width="950mm" height="1200mm" viewBox="0 0 950 1200"/, 'physical SVG artboard')
  expectMatch(svg, /<defs>[\s\S]*<clipPath id="clip-piece-/, 'SVG clip path')
  expectMatch(svg, /<g id="Artwork"/, 'Artwork group')
  expectMatch(svg, /<g id="CutContour"/, 'CutContour group')
  expectMatch(svg, /<(rect|ellipse|path)[^>]+data-spot-name="CutContour"[^>]+fill="none"/, 'vector CutContour')
  expect(!/<image[^>]+data-spot-name="CutContour"/.test(svg), 'cutline must not be raster')

  const sameFileCopy = createPiecePresetFromSource(source, [piece])
  expectEqual(sameFileCopy.displayName, 'sticker copy 2', 'same-file duplicate naming')
  expectEqual(synchronizePieceEditorModel(piece).selectedObjectIds, piece.selectedObjectIds, 'model sync preserves id selection')

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
  expectEqual(cutlineKey.find((object) => object.id === cutline.id)?.transform, objects[1].transform, 'cutline key stays fixed')
  expect(cutlineKey.find((object) => object.id === artwork.id)?.transform.xCm !== objects[0].transform.xCm, 'artwork moves when cutline is key')

  const artworkKey = alignEditorObjects(objects, ids, artwork.id, 'center-vertical')
  expectEqual(artworkKey.find((object) => object.id === artwork.id)?.transform, objects[0].transform, 'artwork key stays fixed')
  expect(artworkKey.find((object) => object.id === cutline.id)?.transform.yCm !== objects[1].transform.yCm, 'cutline moves when artwork is key')
}

function createHelper(id: string, shapeType: EditorShapeType, transform: ArtworkTransform): EditorObject {
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
    fileName,
    displayName: fileName.replace(/\.[^.]+$/, ''),
    mimeType: 'image/png',
    bytes: new Uint8Array([137, 80, 78, 71]),
    previewUrl: 'blob:test-source',
    naturalWidthPx: 800,
    naturalHeightPx: 600
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
