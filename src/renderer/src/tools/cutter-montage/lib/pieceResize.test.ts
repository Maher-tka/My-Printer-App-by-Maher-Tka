import { synchronizePieceEditorModel } from './editorObjects'
import { createCutlineFromArtworkBounds } from './cutlineValidation'
import {
  createPiecePresetFromSource,
  CUTTER_PIECE_MAX_DIMENSION_CM,
  CUTTER_PIECE_MIN_DIMENSION_CM,
  resizePiecePreset
} from './piecePresets'
import type { EditorObject, PiecePreset, PieceSourceFile } from '../types'

function run(): void {
  const piece = createMaskedPiece()
  const resized = resizePiecePreset(piece, 6, 99, 'width')

  expectClose(resized.widthCm, 6, 'width-axis resize uses requested width')
  expectClose(resized.heightCm, 3, 'locked aspect derives height')
  expectEqual(resized.clippingMaskEnabled, true, 'clipping remains active')
  expectEqual(resized.mask.enabled, true, 'legacy mask remains enabled')
  expectEqual(resized.artworkLockBeforeMask, false, 'pre-mask artwork lock is preserved')

  for (const original of piece.objects) {
    const scaled = getObject(resized, original.id)
    expectClose(scaled.transform.xCm, original.transform.xCm * 0.6, `${original.role} x scales`)
    expectClose(scaled.transform.yCm, original.transform.yCm * 0.6, `${original.role} y scales`)
    expectClose(
      scaled.transform.widthCm,
      original.transform.widthCm * 0.6,
      `${original.role} width scales`
    )
    expectClose(
      scaled.transform.heightCm,
      original.transform.heightCm * 0.6,
      `${original.role} height scales`
    )
    expectEqual(scaled.locked, original.locked, `${original.role} lock is preserved`)
    expectEqual(scaled.groupId, original.groupId, `${original.role} group is preserved`)
    expectEqual(
      scaled.transform.rotation,
      original.transform.rotation,
      `${original.role} rotation is preserved`
    )
  }

  const originalArtwork = getObject(piece, piece.artworkObjectId!)
  const resizedArtwork = getObject(resized, resized.artworkObjectId!)
  const originalMask = getObject(piece, piece.maskObjectId!)
  const resizedMask = getObject(resized, resized.maskObjectId!)
  expectClose(
    resizedArtwork.transform.xCm / resized.widthCm,
    originalArtwork.transform.xCm / piece.widthCm,
    'artwork crop x ratio is preserved'
  )
  expectClose(
    resizedArtwork.transform.widthCm / resizedMask.transform.widthCm,
    originalArtwork.transform.widthCm / originalMask.transform.widthCm,
    'artwork-to-mask crop width ratio is preserved'
  )
  expectEqual(
    resized.cutline.transform.offsetMm,
    piece.cutline.transform.offsetMm,
    'CutContour physical offset metadata is preserved'
  )
  expectEqual(
    resized.objects.find((object) => object.role === 'cutline')?.pathData,
    piece.objects.find((object) => object.role === 'cutline')?.pathData,
    'CutContour path metadata is preserved'
  )
  expectEqual(resized.displayName, piece.displayName, 'unrelated piece metadata is preserved')

  const unlocked = resizePiecePreset({ ...piece, lockAspectRatio: false }, 8, 6, 'width')
  expectClose(unlocked.widthCm, 8, 'unlocked resize honors width')
  expectClose(unlocked.heightCm, 6, 'unlocked resize honors height')
  expectRepresentableTransform(piece, unlocked, 0.8, 1.2, 'unlocked non-uniform scale')

  const quarterTurn = getObject(unlocked, unlocked.cutlineObjectId!)
  expectTransform(
    quarterTurn.transform,
    { xCm: -0.8, yCm: 1.4, widthCm: 9.6, heightCm: 3.2, rotation: 90 },
    '90-degree object swaps the piece-space scale axes exactly'
  )

  const twoSeventyPiece = withObjectTransform(piece, piece.cutlineObjectId!, {
    ...getObject(piece, piece.cutlineObjectId!).transform,
    rotation: 270
  })
  const twoSeventy = resizePiecePreset(
    { ...twoSeventyPiece, lockAspectRatio: false },
    8,
    6,
    'width'
  )
  expectTransform(
    getObject(twoSeventy, twoSeventy.cutlineObjectId!).transform,
    { xCm: -0.8, yCm: 1.4, widthCm: 9.6, heightCm: 3.2, rotation: 270 },
    '270-degree object swaps the piece-space scale axes exactly'
  )

  const arbitraryTransform = {
    xCm: 1,
    yCm: 0.5,
    widthCm: 8,
    heightCm: 4,
    rotation: 30
  }
  const arbitraryPiece = withObjectTransform(
    withObjectTransform(piece, piece.artworkObjectId!, arbitraryTransform),
    piece.maskObjectId!,
    arbitraryTransform
  )
  const arbitrary = resizePiecePreset({ ...arbitraryPiece, lockAspectRatio: false }, 8, 6, 'width')
  expectTransform(
    getObject(arbitrary, arbitrary.artworkObjectId!).transform,
    { xCm: 0.4, yCm: 0.8, widthCm: 7.2, heightCm: 4.4, rotation: 30 },
    'arbitrary rotation uses the rotation-preserving shear-free projection'
  )
  expectTransform(
    getObject(arbitrary, arbitrary.maskObjectId!).transform,
    getObject(arbitrary, arbitrary.artworkObjectId!).transform,
    'coincident arbitrary-angle artwork and mask remain aligned'
  )

  const heightDriven = resizePiecePreset(piece, 99, 4, 'height')
  expectClose(heightDriven.widthCm, 8, 'height-axis resize derives width')
  expectClose(heightDriven.heightCm, 4, 'height-axis resize uses requested height')

  const extremeRatio = resizePiecePreset(
    { ...piece, widthCm: 100, heightCm: 1, lockAspectRatio: true },
    0.5,
    99,
    'width'
  )
  expectClose(
    extremeRatio.widthCm,
    48,
    'derived minimum preserves the normalized safe aspect ratio'
  )
  expectClose(extremeRatio.heightCm, 0.5, 'derived axis respects minimum')

  const nonFinite = resizePiecePreset(
    { ...piece, lockAspectRatio: false },
    Number.NaN,
    Number.POSITIVE_INFINITY,
    'width'
  )
  expectClose(nonFinite.widthCm, 10, 'NaN width falls back to current width')
  expectClose(nonFinite.heightCm, 5, 'infinite height falls back to current height')
  expectFiniteModel(nonFinite, 'non-finite request')

  const clamped = resizePiecePreset({ ...piece, lockAspectRatio: false }, -4, 0.1, 'height')
  expectClose(clamped.widthCm, 0.5, 'negative width clamps to minimum')
  expectClose(clamped.heightCm, 0.5, 'below-minimum height clamps to minimum')
  expectFiniteModel(clamped, 'minimum-clamped request')

  const hugeLockedWidth = resizePiecePreset(piece, 1e308, piece.heightCm, 'width')
  expectClose(
    hugeLockedWidth.widthCm,
    CUTTER_PIECE_MAX_DIMENSION_CM,
    'huge locked width clamps to maximum'
  )
  expectClose(hugeLockedWidth.heightCm, 48, 'huge locked width preserves aspect ratio')
  expectFiniteModel(hugeLockedWidth, 'huge locked width')

  const hugeLockedHeight = resizePiecePreset(piece, piece.widthCm, 1e308, 'height')
  expectClose(
    hugeLockedHeight.widthCm,
    CUTTER_PIECE_MAX_DIMENSION_CM,
    'huge locked height constrains width to maximum'
  )
  expectClose(hugeLockedHeight.heightCm, 48, 'huge locked height preserves aspect ratio')
  expectFiniteModel(hugeLockedHeight, 'huge locked height')

  const hugeUnlockedWidth = resizePiecePreset(
    { ...piece, lockAspectRatio: false },
    1e308,
    6,
    'width'
  )
  expectClose(
    hugeUnlockedWidth.widthCm,
    CUTTER_PIECE_MAX_DIMENSION_CM,
    'huge unlocked width clamps independently'
  )
  expectClose(hugeUnlockedWidth.heightCm, 6, 'huge unlocked width preserves requested height')
  expectFiniteModel(hugeUnlockedWidth, 'huge unlocked width')

  const hugeUnlockedHeight = resizePiecePreset(
    { ...piece, lockAspectRatio: false },
    8,
    1e308,
    'height'
  )
  expectClose(hugeUnlockedHeight.widthCm, 8, 'huge unlocked height preserves requested width')
  expectClose(
    hugeUnlockedHeight.heightCm,
    CUTTER_PIECE_MAX_DIMENSION_CM,
    'huge unlocked height clamps independently'
  )
  expectFiniteModel(hugeUnlockedHeight, 'huge unlocked height')

  const invalidCurrent = resizePiecePreset(
    { ...piece, widthCm: 0, heightCm: Number.NaN, lockAspectRatio: false },
    Number.NaN,
    Number.NaN,
    'width'
  )
  expectClose(invalidCurrent.widthCm, 0.5, 'zero current width uses safe fallback')
  expectClose(invalidCurrent.heightCm, 0.5, 'invalid current height uses safe fallback')
  expectFiniteModel(invalidCurrent, 'invalid current dimensions')

  const overflowingAspect = resizePiecePreset(
    { ...piece, widthCm: 1e308, heightCm: 1, lockAspectRatio: true },
    1e308,
    1e308,
    'height'
  )
  expectClose(
    overflowingAspect.widthCm,
    CUTTER_PIECE_MAX_DIMENSION_CM,
    'overflowing aspect resize normalizes current width'
  )
  expectClose(overflowingAspect.heightCm, 1, 'overflowing aspect resize keeps current height')
  expectFiniteModel(overflowingAspect, 'overflowing aspect resize')

  const overflowingRatio = resizePiecePreset(
    { ...piece, widthCm: Number.MAX_VALUE, heightCm: 0.5, lockAspectRatio: true },
    20,
    20,
    'width'
  )
  expectClose(
    overflowingRatio.widthCm,
    CUTTER_PIECE_MAX_DIMENSION_CM,
    'extreme aspect ratio constrains width to the maximum'
  )
  expectClose(overflowingRatio.heightCm, 0.5, 'non-finite aspect ratio keeps current height')
  expectFiniteModel(overflowingRatio, 'non-finite aspect ratio')

  const overflowingGeometryPiece = withObjectTransform(piece, piece.artworkObjectId!, {
    ...getObject(piece, piece.artworkObjectId!).transform,
    widthCm: 20
  })
  const overflowingGeometry = resizePiecePreset(
    { ...overflowingGeometryPiece, lockAspectRatio: false },
    CUTTER_PIECE_MAX_DIMENSION_CM,
    5,
    'width'
  )
  expectClose(
    overflowingGeometry.widthCm,
    CUTTER_PIECE_MAX_DIMENSION_CM,
    'extreme request clamps before transforming object geometry'
  )
  expectTransform(
    getObject(overflowingGeometry, overflowingGeometry.artworkObjectId!).transform,
    { xCm: 4.8, yCm: 0.25, widthCm: 192, heightCm: 4.5, rotation: 0 },
    'clamped resize keeps transformed object geometry finite'
  )
  expectFiniteModel(overflowingGeometry, 'overflowing object geometry')

  const widestAspect = resizePiecePreset(
    {
      ...piece,
      widthCm: CUTTER_PIECE_MAX_DIMENSION_CM,
      heightCm: CUTTER_PIECE_MIN_DIMENSION_CM,
      lockAspectRatio: true
    },
    1,
    1e308,
    'height'
  )
  expectClose(widestAspect.widthCm, CUTTER_PIECE_MAX_DIMENSION_CM, 'widest ratio width is safe')
  expectClose(widestAspect.heightCm, CUTTER_PIECE_MIN_DIMENSION_CM, 'widest ratio is preserved')
  expectFiniteModel(widestAspect, 'widest supported aspect ratio')

  const tallestAspect = resizePiecePreset(
    {
      ...piece,
      widthCm: CUTTER_PIECE_MIN_DIMENSION_CM,
      heightCm: CUTTER_PIECE_MAX_DIMENSION_CM,
      lockAspectRatio: true
    },
    1e308,
    1,
    'width'
  )
  expectClose(tallestAspect.widthCm, CUTTER_PIECE_MIN_DIMENSION_CM, 'tallest ratio is preserved')
  expectClose(tallestAspect.heightCm, CUTTER_PIECE_MAX_DIMENSION_CM, 'tallest ratio height is safe')
  expectFiniteModel(tallestAspect, 'tallest supported aspect ratio')

  console.log('Piece resize tests passed.')
}

function createMaskedPiece(): PiecePreset {
  const source: PieceSourceFile = {
    id: 'resize-source',
    sourceKind: 'image',
    fileName: 'masked-sticker.png',
    displayName: 'masked-sticker',
    mimeType: 'image/png',
    bytes: new Uint8Array([137, 80, 78, 71]),
    previewUrl: 'blob:resize-source',
    naturalWidthPx: 800,
    naturalHeightPx: 400
  }
  const base = createCutlineFromArtworkBounds(createPiecePresetFromSource(source, []))
  const groupId = 'masked-sticker-group'
  const artwork = {
    ...getObject(base, base.artworkObjectId!),
    locked: true,
    groupId,
    transform: { xCm: 0.5, yCm: 0.25, widthCm: 9, heightCm: 4.5, rotation: 0 }
  }
  const cutline = {
    ...getObject(base, base.cutlineObjectId!),
    groupId,
    pathData: 'M 1 0.5 L 9 0.5 L 9 4.5 Z',
    offsetMm: 1.25,
    transform: { xCm: 1, yCm: 0.5, widthCm: 8, heightCm: 4, rotation: 90 }
  }
  const mask: EditorObject = {
    id: 'resize-mask',
    type: 'mask',
    shapeType: 'ellipse',
    role: 'clipping-mask',
    name: 'Clipping Mask',
    visible: true,
    locked: true,
    groupId,
    transform: { xCm: 1, yCm: 0.5, widthCm: 8, heightCm: 4, rotation: 0 },
    fillColor: 'transparent',
    exportEnabled: false
  }
  const helper: EditorObject = {
    id: 'resize-helper',
    type: 'helper-shape',
    shapeType: 'rectangle',
    role: 'helper',
    name: 'Helper Shape',
    visible: true,
    locked: true,
    transform: { xCm: 2, yCm: 1, widthCm: 3, heightCm: 2, rotation: 180 },
    fillColor: 'transparent',
    exportEnabled: false
  }

  return synchronizePieceEditorModel({
    ...base,
    widthCm: 10,
    heightCm: 5,
    lockAspectRatio: true,
    clippingMaskEnabled: true,
    maskWorkflowVersion: 3,
    artworkLockBeforeMask: false,
    objects: [artwork, mask, cutline, helper],
    maskObjectId: mask.id,
    helperObjectIds: [helper.id],
    selectedObjectIds: [mask.id, cutline.id],
    keyObjectId: cutline.id
  })
}

function getObject(piece: PiecePreset, id: string): EditorObject {
  const object = piece.objects.find((candidate) => candidate.id === id)
  if (!object) throw new Error(`Expected object ${id}`)
  return object
}

function withObjectTransform(
  piece: PiecePreset,
  objectId: string,
  transform: EditorObject['transform']
): PiecePreset {
  return synchronizePieceEditorModel({
    ...piece,
    objects: piece.objects.map((object) =>
      object.id === objectId ? { ...object, transform: { ...transform } } : object
    )
  })
}

function expectRepresentableTransform(
  before: PiecePreset,
  after: PiecePreset,
  widthScale: number,
  heightScale: number,
  label: string
): void {
  for (const original of before.objects) {
    const resized = getObject(after, original.id)
    const radians = (original.transform.rotation * Math.PI) / 180
    const cosineSquared = Math.cos(radians) ** 2
    const sineSquared = Math.sin(radians) ** 2
    const expectedWidth =
      original.transform.widthCm * (widthScale * cosineSquared + heightScale * sineSquared)
    const expectedHeight =
      original.transform.heightCm * (widthScale * sineSquared + heightScale * cosineSquared)
    const expectedCenterX = (original.transform.xCm + original.transform.widthCm / 2) * widthScale
    const expectedCenterY = (original.transform.yCm + original.transform.heightCm / 2) * heightScale
    expectClose(resized.transform.xCm, expectedCenterX - expectedWidth / 2, `${label} x`)
    expectClose(resized.transform.yCm, expectedCenterY - expectedHeight / 2, `${label} y`)
    expectClose(resized.transform.widthCm, expectedWidth, `${label} width`)
    expectClose(resized.transform.heightCm, expectedHeight, `${label} height`)
    expectClose(
      resized.transform.rotation,
      original.transform.rotation,
      `${label} rotation is preserved`
    )
  }
}

function expectFiniteModel(piece: PiecePreset, label: string): void {
  expect(Number.isFinite(piece.widthCm), `${label}: piece width must be finite`)
  expect(Number.isFinite(piece.heightCm), `${label}: piece height must be finite`)
  for (const object of piece.objects) {
    expect(Number.isFinite(object.transform.xCm), `${label}: ${object.role} x must be finite`)
    expect(Number.isFinite(object.transform.yCm), `${label}: ${object.role} y must be finite`)
    expect(
      Number.isFinite(object.transform.widthCm),
      `${label}: ${object.role} width must be finite`
    )
    expect(
      Number.isFinite(object.transform.heightCm),
      `${label}: ${object.role} height must be finite`
    )
  }
}

function expectTransform(
  actual: EditorObject['transform'],
  expected: EditorObject['transform'],
  label: string
): void {
  expectClose(actual.xCm, expected.xCm, `${label}: x`)
  expectClose(actual.yCm, expected.yCm, `${label}: y`)
  expectClose(actual.widthCm, expected.widthCm, `${label}: width`)
  expectClose(actual.heightCm, expected.heightCm, `${label}: height`)
  expectClose(actual.rotation, expected.rotation, `${label}: rotation`)
}

function expect(condition: boolean, label: string): asserts condition {
  if (!condition) throw new Error(label)
}

function expectClose(actual: number, expected: number, label: string): void {
  if (!Number.isFinite(actual) || !Number.isFinite(expected)) {
    throw new Error(`${label}: expected finite values, got ${expected} and ${actual}`)
  }
  if (Math.abs(actual - expected) > 1e-9) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`)
  }
}

function expectEqual(actual: unknown, expected: unknown, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

run()
