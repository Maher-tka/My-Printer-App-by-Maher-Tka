import {
  alignEditorObjects,
  duplicateObjects,
  duplicateShapeAsCutline,
  synchronizePieceEditorModel
} from './editorObjects'
import {
  createHelperShape,
  makeClippingMaskFromHelper,
  releaseClippingMaskToHelper
} from './maskUtils'
import {
  createPiecePresetFromSource,
  createPlacedPieceFromPreset
} from './piecePresets'
import { exportCutterSvg } from './svgExport'
import type { CutterProject, EditorObject, PieceSourceFile } from '../types'
import { DEFAULT_CUTTER_SHEET } from './cutterLayout'

async function run(): Promise<void> {
  const source = createSource('sticker.png')
  let piece = createPiecePresetFromSource(source, [])
  const shapeTransform = {
    xCm: 1.25,
    yCm: 0.75,
    widthCm: 4.5,
    heightCm: 4.5,
    rotation: 17
  }
  piece = synchronizePieceEditorModel({
    ...piece,
    helperShape: createHelperShape('ellipse', shapeTransform)
  })

  const helper = piece.objects.find((object) => object.role === 'helper')
  expectExists(helper, 'drawn helper shape should exist in the editor object model')

  const pasted = duplicateObjects(piece.objects, [helper.id], true)
  const pastedShape = pasted.objects.find((object) => object.id === pasted.selectedObjectIds[0])
  expectExists(pastedShape, 'paste in place should select the new object')
  expectEqual(
    pastedShape.transform,
    helper.transform,
    'paste in place must retain exact x/y/w/h/rotation'
  )

  const cutline = duplicateShapeAsCutline(pastedShape)
  expectEqual(cutline.transform, pastedShape.transform, 'cutline geometry')
  expectEqual(cutline.role, 'cutline', 'cutline role')
  expectEqual(cutline.strokeName, 'CutContour', 'cutline spot name')
  expectEqual(cutline.fillColor, 'none', 'cutline fill')

  const artwork = piece.objects.find((object) => object.role === 'artwork')
  expectExists(artwork, 'artwork object')
  const alignmentObjects: EditorObject[] = [
    { ...artwork, transform: { ...artwork.transform, xCm: 8, yCm: 9 } },
    { ...cutline, transform: { ...cutline.transform, xCm: 2, yCm: 3 } }
  ]
  const aligned = alignEditorObjects(
    alignmentObjects,
    alignmentObjects.map((object) => object.id),
    cutline.id,
    'center-horizontal'
  )
  const alignedKey = aligned.find((object) => object.id === cutline.id)
  const alignedArtwork = aligned.find((object) => object.id === artwork.id)
  expectEqual(alignedKey?.transform, alignmentObjects[1].transform, 'the key object must not move')
  expectEqual(
    alignedArtwork?.transform.xCm,
    alignmentObjects[1].transform.xCm +
      (alignmentObjects[1].transform.widthCm - alignmentObjects[0].transform.widthCm) / 2,
    'aligned artwork x'
  )

  piece = synchronizePieceEditorModel(makeClippingMaskFromHelper(piece))
  expectEqual(piece.clippingMaskEnabled, true, 'clipping enabled')
  expectExists(piece.maskObjectId, 'mask object id')
  expectEqual(piece.objects.find((object) => object.id === piece.maskObjectId)?.role, 'clipping-mask', 'mask role')

  const released = synchronizePieceEditorModel(releaseClippingMaskToHelper(piece))
  expectEqual(released.clippingMaskEnabled, false, 'clipping released')
  expectEqual(released.artwork.transform.widthCm, piece.artwork.transform.widthCm, 'artwork preserved')
  expectExists(released.helperShape, 'release mask should preserve the mask geometry as an editable shape')
  expectEqual(released.helperShape.transform, piece.mask.transform, 'released mask geometry')

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
  expectMatch(svg, /<(rect|ellipse|path)[^>]+data-spot-name="CutContour"/, 'vector cutline')
  expect(!/<image[^>]+data-spot-name="CutContour"/.test(svg), 'cutline must not be raster')

  const sameFileCopy = createPiecePresetFromSource(source, [piece])
  expectEqual(sameFileCopy.displayName, 'sticker copy 2', 'same-file duplicate naming')

  console.log('Cutter editor workflow tests passed.')
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
  if (!condition) {
    throw new Error(label)
  }
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
