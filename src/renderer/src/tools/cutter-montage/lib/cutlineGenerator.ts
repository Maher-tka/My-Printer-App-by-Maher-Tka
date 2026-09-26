import type {
  ArtworkTransform,
  EditorObject,
  PieceCutline,
  PiecePreset,
  PlacedPiece,
  CutlineTransform
} from '../types'
import { mmToCm } from './units'

export interface CutlineRect {
  xCm: number
  yCm: number
  widthCm: number
  heightCm: number
  rotation: number
}

export interface PlacedTransformScale {
  scaleX: number
  scaleY: number
  sceneWidthCm: number
  sceneHeightCm: number
}

export interface ProductionBounds {
  xCm: number
  yCm: number
  widthCm: number
  heightCm: number
}

type TransformBoundsSource = Pick<
  ArtworkTransform,
  'xCm' | 'yCm' | 'widthCm' | 'heightCm' | 'rotation'
>

function assertFiniteNumber(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite.`)
  }
}

function assertValidTransform(transform: TransformBoundsSource, label: string): void {
  assertFiniteNumber(transform.xCm, `${label} x`)
  assertFiniteNumber(transform.yCm, `${label} y`)
  assertFiniteNumber(transform.widthCm, `${label} width`)
  assertFiniteNumber(transform.heightCm, `${label} height`)
  assertFiniteNumber(transform.rotation, `${label} rotation`)
  if (transform.widthCm <= 0 || transform.heightCm <= 0) {
    throw new RangeError(`${label} dimensions must be greater than zero.`)
  }
}

function assertValidBounds(bounds: ProductionBounds, label: string): void {
  assertFiniteNumber(bounds.xCm, `${label} x`)
  assertFiniteNumber(bounds.yCm, `${label} y`)
  assertFiniteNumber(bounds.widthCm, `${label} width`)
  assertFiniteNumber(bounds.heightCm, `${label} height`)
  if (bounds.widthCm <= 0 || bounds.heightCm <= 0) {
    throw new RangeError(`${label} dimensions must be greater than zero.`)
  }
}

function getProductionObjects(piece: PiecePreset): EditorObject[] {
  const clippingMask = piece.clippingMaskEnabled
    ? piece.objects.find(
        (object) => object.id === piece.maskObjectId || object.role === 'clipping-mask'
      )
    : undefined

  return piece.objects.filter((object) => {
    if (object.role === 'cutline') return object.exportEnabled !== false
    if (object.id === clippingMask?.id) return true
    if (!object.visible) return false
    if (object.role === 'artwork') return !clippingMask
    return object.id === clippingMask?.id
  })
}

function unionBounds(
  bounds: Array<{ left: number; top: number; right: number; bottom: number }>,
  label: string
): ProductionBounds {
  const left = Math.min(...bounds.map((bound) => bound.left))
  const top = Math.min(...bounds.map((bound) => bound.top))
  const right = Math.max(...bounds.map((bound) => bound.right))
  const bottom = Math.max(...bounds.map((bound) => bound.bottom))
  const result = {
    xCm: left,
    yCm: top,
    widthCm: Math.max(right - left, 0.1),
    heightCm: Math.max(bottom - top, 0.1)
  }

  assertValidBounds(result, label)
  return result
}

function getRotatedTransformBounds(
  transform: TransformBoundsSource,
  offsetCm = 0
): { left: number; top: number; right: number; bottom: number } {
  assertValidTransform(transform, 'Production transform')
  assertFiniteNumber(offsetCm, 'Cutline offset')
  const centerX = transform.xCm + transform.widthCm / 2
  const centerY = transform.yCm + transform.heightCm / 2
  const widthCm = transform.widthCm + offsetCm * 2
  const heightCm = transform.heightCm + offsetCm * 2
  if (!Number.isFinite(widthCm) || !Number.isFinite(heightCm) || widthCm <= 0 || heightCm <= 0) {
    throw new RangeError('Cutline offset must produce finite, positive dimensions.')
  }
  const normalizedRotation = ((transform.rotation % 360) + 360) % 360
  let cosine: number
  let sine: number

  switch (normalizedRotation) {
    case 0:
      cosine = 1
      sine = 0
      break
    case 90:
      cosine = 0
      sine = 1
      break
    case 180:
      cosine = -1
      sine = 0
      break
    case 270:
      cosine = 0
      sine = -1
      break
    default: {
      const radians = (normalizedRotation * Math.PI) / 180
      cosine = Math.cos(radians)
      sine = Math.sin(radians)
    }
  }

  const rotatedWidthCm = Math.abs(widthCm * cosine) + Math.abs(heightCm * sine)
  const rotatedHeightCm = Math.abs(widthCm * sine) + Math.abs(heightCm * cosine)

  return {
    left: centerX - rotatedWidthCm / 2,
    top: centerY - rotatedHeightCm / 2,
    right: centerX + rotatedWidthCm / 2,
    bottom: centerY + rotatedHeightCm / 2
  }
}

/**
 * Return the scale for a piece-local transform inside a placed piece.
 *
 * A placed piece keeps its nominal piece bounds for editing, while a quarter
 * turn swaps the rendered outer width and height. Keep the local transform
 * in the piece coordinate system and only swap the scale axes here; callers
 * can then rotate the complete local scene around its center.
 */
export function getPlacedTransformScale(
  placed: PlacedPiece,
  preset: PiecePreset
): PlacedTransformScale {
  assertValidTransform(placed, 'Placed piece')
  assertFiniteNumber(preset.widthCm, 'Preset width')
  assertFiniteNumber(preset.heightCm, 'Preset height')
  if (preset.widthCm <= 0 || preset.heightCm <= 0) {
    throw new RangeError('Preset dimensions must be greater than zero.')
  }
  const quarterTurn = placed.rotation === 90 || placed.rotation === 270
  const scaleX = quarterTurn ? placed.heightCm / preset.widthCm : placed.widthCm / preset.widthCm
  const scaleY = quarterTurn ? placed.widthCm / preset.heightCm : placed.heightCm / preset.heightCm
  const sceneWidthCm = preset.widthCm * scaleX
  const sceneHeightCm = preset.heightCm * scaleY

  assertFiniteNumber(scaleX, 'Placed horizontal scale')
  assertFiniteNumber(scaleY, 'Placed vertical scale')
  assertFiniteNumber(sceneWidthCm, 'Placed scene width')
  assertFiniteNumber(sceneHeightCm, 'Placed scene height')

  return {
    scaleX,
    scaleY,
    sceneWidthCm,
    sceneHeightCm
  }
}

export function getPlacedTransformRect(
  placed: PlacedPiece,
  preset: PiecePreset,
  transform: Pick<ArtworkTransform, 'xCm' | 'yCm' | 'widthCm' | 'heightCm' | 'rotation'>,
  offsetCm = 0
): CutlineRect {
  assertValidTransform(transform, 'Placed production transform')
  assertFiniteNumber(offsetCm, 'Placed cutline offset')
  const { scaleX, scaleY, sceneWidthCm, sceneHeightCm } = getPlacedTransformScale(placed, preset)
  const localCenterX = (transform.xCm + transform.widthCm / 2) * scaleX
  const localCenterY = (transform.yCm + transform.heightCm / 2) * scaleY
  const localDeltaX = localCenterX - sceneWidthCm / 2
  const localDeltaY = localCenterY - sceneHeightCm / 2
  const radians = (placed.rotation * Math.PI) / 180
  const rotatedDeltaX = localDeltaX * Math.cos(radians) - localDeltaY * Math.sin(radians)
  const rotatedDeltaY = localDeltaX * Math.sin(radians) + localDeltaY * Math.cos(radians)
  const centerX = placed.xCm + placed.widthCm / 2 + rotatedDeltaX
  const centerY = placed.yCm + placed.heightCm / 2 + rotatedDeltaY
  const widthCm = transform.widthCm * scaleX + offsetCm * 2
  const heightCm = transform.heightCm * scaleY + offsetCm * 2
  const rotation = (placed.rotation + transform.rotation) % 360
  const rect = {
    xCm: centerX - widthCm / 2,
    yCm: centerY - heightCm / 2,
    widthCm,
    heightCm,
    rotation
  }

  assertValidTransform(rect, 'Placed production rectangle')
  return rect
}

function getPlacedObjectTransform(
  placed: PlacedPiece,
  object: EditorObject,
  preset: PiecePreset
): TransformBoundsSource {
  switch (object.role) {
    case 'artwork':
      return placed.artworkTransform
    case 'clipping-mask':
      return placed.maskTransform
    case 'cutline':
      return object.id ===
        (preset.cutlineObjectId ?? preset.objects.find((item) => item.role === 'cutline')?.id)
        ? placed.cutlineTransform
        : object.transform
    default:
      return object.transform
  }
}

/**
 * Return the local production footprint of a normalized piece.
 *
 * Active masks replace the artwork footprint with the mask footprint. The
 * cutline is still included because it is the physical production boundary.
 */
export function getPieceProductionFootprint(piece: PiecePreset): ProductionBounds {
  assertFiniteNumber(piece.widthCm, 'Piece width')
  assertFiniteNumber(piece.heightCm, 'Piece height')
  if (piece.widthCm <= 0 || piece.heightCm <= 0) {
    throw new RangeError('Piece dimensions must be greater than zero.')
  }
  const productionObjects = getProductionObjects(piece)
  const bounds = productionObjects.map((object) => {
    const offsetCm = object.role === 'cutline' ? (object.offsetMm ?? 0) / 10 : 0
    return getRotatedTransformBounds(object.transform, offsetCm)
  })

  if (bounds.length === 0) {
    return { xCm: 0, yCm: 0, widthCm: piece.widthCm, heightCm: piece.heightCm }
  }

  return unionBounds(bounds, 'Piece production footprint')
}

export function getPlacedArtworkRect(placed: PlacedPiece, preset: PiecePreset): CutlineRect {
  return getPlacedTransformRect(placed, preset, placed.artworkTransform)
}

export function getPlacedMaskArtworkRect(placed: PlacedPiece, preset: PiecePreset): CutlineRect {
  return getPlacedTransformRect(placed, preset, placed.maskTransform)
}

export function getPlacedCutlineRect(placed: PlacedPiece, preset: PiecePreset): CutlineRect {
  const transform = placed.cutlineTransform
  const offsetCm = mmToCm(transform.offsetMm)

  return getPlacedTransformRect(placed, preset, transform, offsetCm)
}

/**
 * Map a normalized local production footprint into sheet coordinates.
 *
 * Restored projects can contain cached bounds from before a clipping-mask
 * migration. Recompute them from the normalized preset while rotating around
 * the piece center so all quarter-turn placements use the same footprint.
 * CutContour offsets are physical sheet distances, so they are added after
 * per-copy scaling. Invalid or non-finite production geometry throws a
 * RangeError instead of returning bounds that could pass preflight.
 */
export function getPlacedProductionBounds(
  placed: PlacedPiece,
  preset: PiecePreset
): ProductionBounds {
  const productionObjects = getProductionObjects(preset)
  if (productionObjects.length === 0) {
    const pieceRect = getPlacedTransformRect(placed, preset, {
      xCm: 0,
      yCm: 0,
      widthCm: preset.widthCm,
      heightCm: preset.heightCm,
      rotation: 0
    })
    return unionBounds([getRotatedTransformBounds(pieceRect)], 'Placed production bounds')
  }

  const bounds = productionObjects.map((object) =>
    getRotatedTransformBounds(getPlacedEditorObjectRect(placed, preset, object))
  )

  return unionBounds(bounds, 'Placed production bounds')
}

export function getPieceCutlineRect(cutline: PieceCutline): CutlineRect {
  const offsetCm = mmToCm(cutline.transform.offsetMm)

  return {
    xCm: cutline.transform.xCm - offsetCm,
    yCm: cutline.transform.yCm - offsetCm,
    widthCm: cutline.transform.widthCm + offsetCm * 2,
    heightCm: cutline.transform.heightCm + offsetCm * 2,
    rotation: cutline.transform.rotation
  }
}

export function getPlacedCutlineSvgElement(placed: PlacedPiece, preset: PiecePreset): string {
  return getCutlineSvgElement(getPlacedCutlineRect(placed, preset), preset.cutline)
}

export function getCutlineSvgElement(rect: CutlineRect, cutline: PieceCutline): string {
  const common = `fill="none" stroke="${cutline.strokeColor}" stroke-width="${cutline.strokeWidthPt}pt" data-spot-name="${escapeXml(cutline.strokeName)}" vector-effect="non-scaling-stroke"`
  const transform = rect.rotation
    ? ` transform="rotate(${rect.rotation} ${rect.xCm + rect.widthCm / 2} ${rect.yCm + rect.heightCm / 2})"`
    : ''

  if (cutline.shape === 'ellipse') {
    return `<ellipse cx="${rect.xCm + rect.widthCm / 2}cm" cy="${rect.yCm + rect.heightCm / 2}cm" rx="${rect.widthCm / 2}cm" ry="${rect.heightCm / 2}cm"${transform} ${common} />`
  }

  if (cutline.shape === 'rounded-rectangle') {
    const radius = Math.min(rect.widthCm, rect.heightCm) * 0.08

    return `<rect x="${rect.xCm}cm" y="${rect.yCm}cm" width="${rect.widthCm}cm" height="${rect.heightCm}cm" rx="${radius}cm" ry="${radius}cm"${transform} ${common} />`
  }

  if (cutline.shape === 'custom-path' && cutline.customPathData) {
    return `<path d="${escapeXml(cutline.customPathData)}" transform="translate(${rect.xCm} ${rect.yCm}) scale(${rect.widthCm} ${rect.heightCm})" ${common} />`
  }

  return `<rect x="${rect.xCm}cm" y="${rect.yCm}cm" width="${rect.widthCm}cm" height="${rect.heightCm}cm"${transform} ${common} />`
}

export function copyCutlineTransform(transform: CutlineTransform): CutlineTransform {
  return { ...transform }
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** Use per-copy transforms for primary objects and preserve each extra contour. */
export function getPlacedEditorObjectRect(
  placed: PlacedPiece,
  preset: PiecePreset,
  object: EditorObject
): CutlineRect {
  const transform = getPlacedObjectTransform(placed, object, preset)
  const primaryCutlineId =
    preset.cutlineObjectId ?? preset.objects.find((item) => item.role === 'cutline')?.id
  const offsetMm =
    object.role !== 'cutline'
      ? 0
      : object.id === primaryCutlineId
        ? (placed.cutlineTransform.offsetMm ?? object.offsetMm ?? 0)
        : (object.offsetMm ?? 0)
  return getPlacedTransformRect(placed, preset, transform, mmToCm(offsetMm))
}
