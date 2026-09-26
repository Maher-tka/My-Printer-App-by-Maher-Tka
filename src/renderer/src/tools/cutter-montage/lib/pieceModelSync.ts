import type { EditorObject, EditorShapeType, MaskShape, PiecePreset } from '../types'
import { CUT_CONTOUR_COLOR, CUT_CONTOUR_NAME } from './colorSpot'
import { fitArtworkToCoverMask } from './maskUtils'

const PREVIOUS_MASK_WORKFLOW_VERSION = 2 as const
const CURRENT_MASK_WORKFLOW_VERSION = 3 as const

export function normalizePiecePreset(piece: PiecePreset): PiecePreset {
  const objects = Array.isArray(piece.objects) ? piece.objects : []
  const hasObjectModel = Array.isArray(piece.objects)
  const hasCanonicalArtwork = objects.some(
    (object) => object.id === piece.artworkObjectId || object.role === 'artwork'
  )

  return hasObjectModel || hasCanonicalArtwork
    ? syncLegacyFieldsFromObjects({ ...piece, objects })
    : syncObjectsFromLegacyFields({ ...piece, objects })
}

export function getArtworkObject(piece: PiecePreset): EditorObject | undefined {
  return getObjectByIdOrRole(piece, piece.artworkObjectId, 'artwork')
}

export function getMaskObject(piece: PiecePreset): EditorObject | undefined {
  return getObjectByIdOrRole(piece, piece.maskObjectId, 'clipping-mask')
}

export function getCutlineObject(piece: PiecePreset): EditorObject | undefined {
  return getObjectByIdOrRole(piece, piece.cutlineObjectId, 'cutline')
}

export function getHelperObjects(piece: PiecePreset): EditorObject[] {
  const ids = new Set(piece.helperObjectIds ?? [])
  return piece.objects.filter((object) => object.role === 'helper' || ids.has(object.id))
}

export function updateObject(
  piece: PiecePreset,
  objectId: string,
  patch: Partial<Omit<EditorObject, 'id'>> & { transform?: Partial<EditorObject['transform']> }
): PiecePreset {
  let changed = false
  const objects = piece.objects.map((object) => {
    if (object.id !== objectId || object.locked) return object
    changed = true
    return {
      ...object,
      ...patch,
      id: object.id,
      transform: patch.transform
        ? { ...object.transform, ...patch.transform }
        : { ...object.transform }
    }
  })

  return changed ? syncLegacyFieldsFromObjects({ ...piece, objects }) : piece
}

export function syncLegacyFieldsFromObjects(piece: PiecePreset): PiecePreset {
  const objects = dedupeObjects(piece.objects ?? [])
  const sourceMask = getObjectByIdOrRole({ ...piece, objects }, piece.maskObjectId, 'clipping-mask')
  const sourceArtwork = getObjectByIdOrRole({ ...piece, objects }, piece.artworkObjectId, 'artwork')
  const clippingMaskEnabled = Boolean(
    sourceMask && (piece.clippingMaskEnabled ?? piece.mask.enabled)
  )
  const shouldMigrateActiveMask = Boolean(
    clippingMaskEnabled &&
    sourceMask &&
    piece.maskWorkflowVersion !== CURRENT_MASK_WORKFLOW_VERSION &&
    sourceArtwork &&
    (piece.maskWorkflowVersion === PREVIOUS_MASK_WORKFLOW_VERSION || !sourceArtwork.locked)
  )
  const normalizedObjects =
    clippingMaskEnabled && sourceMask && !piece.maskEditingEnabled
      ? objects.map((object) => {
          if (object.id === sourceMask.id) return { ...object, locked: true }
          if (sourceArtwork && object.id === sourceArtwork.id) {
            return {
              ...object,
              locked: true,
              transform: shouldMigrateActiveMask
                ? fitArtworkToCoverMask(object.transform, sourceMask.transform)
                : { ...object.transform }
            }
          }
          return object
        })
      : objects
  const artwork = getObjectByIdOrRole(
    { ...piece, objects: normalizedObjects },
    piece.artworkObjectId,
    'artwork'
  )
  const mask = getObjectByIdOrRole(
    { ...piece, objects: normalizedObjects },
    piece.maskObjectId,
    'clipping-mask'
  )
  const cutline = getObjectByIdOrRole(
    { ...piece, objects: normalizedObjects },
    piece.cutlineObjectId,
    'cutline'
  )
  const helpers = normalizedObjects.filter((object) => object.role === 'helper')
  const selectedObjectIds = (piece.selectedObjectIds ?? []).filter((id) =>
    normalizedObjects.some((object) => object.id === id)
  )
  const keyObjectId =
    piece.keyObjectId && selectedObjectIds.includes(piece.keyObjectId)
      ? piece.keyObjectId
      : undefined
  const primaryHelper = getPrimaryHelper(piece, helpers)

  return {
    ...piece,
    objects: normalizedObjects,
    artworkObjectId: artwork?.id,
    maskObjectId: mask?.id,
    cutlineObjectId: cutline?.id,
    helperObjectIds: helpers.map((object) => object.id),
    selectedObjectIds,
    keyObjectId,
    groupLinked: objects.some((object) => Boolean(object.groupId)),
    artworkCutlineGrouped: objects.some((object) => Boolean(object.groupId)),
    clippingMaskEnabled,
    maskWorkflowVersion: clippingMaskEnabled
      ? CURRENT_MASK_WORKFLOW_VERSION
      : piece.maskWorkflowVersion,
    artworkLockBeforeMask:
      clippingMaskEnabled &&
      piece.maskWorkflowVersion !== CURRENT_MASK_WORKFLOW_VERSION &&
      piece.maskWorkflowVersion !== PREVIOUS_MASK_WORKFLOW_VERSION &&
      piece.artworkLockBeforeMask === undefined &&
      sourceArtwork
        ? sourceArtwork.locked
        : piece.artworkLockBeforeMask,
    artwork: artwork
      ? {
          ...piece.artwork,
          sourceId: artwork.sourceId ?? piece.artwork.sourceId,
          transform: { ...artwork.transform }
        }
      : piece.artwork,
    mask: mask
      ? {
          enabled: Boolean(piece.clippingMaskEnabled ?? piece.mask.enabled),
          shape: editorShapeToMaskShape(mask.shapeType),
          transform: { ...mask.transform }
        }
      : { ...piece.mask, enabled: false },
    cutline: cutline
      ? {
          ...piece.cutline,
          shape: editorShapeToCutlineShape(cutline.shapeType),
          transform: {
            ...cutline.transform,
            offsetMm: cutline.offsetMm ?? piece.cutline.transform.offsetMm
          },
          strokeName: cutline.strokeName ?? piece.cutline.strokeName ?? CUT_CONTOUR_NAME,
          strokeColor: cutline.strokeColor ?? piece.cutline.strokeColor ?? CUT_CONTOUR_COLOR,
          strokeWidthPt: cutline.strokeWidthPt ?? piece.cutline.strokeWidthPt,
          customPathData: cutline.pathData
        }
      : piece.cutline,
    helperShape: primaryHelper
      ? {
          id: primaryHelper.id,
          role: 'helper',
          shape: editorShapeToMaskShape(primaryHelper.shapeType),
          transform: { ...primaryHelper.transform },
          visible: primaryHelper.visible,
          locked: primaryHelper.locked
        }
      : undefined,
    objectVisibility: {
      artwork: artwork?.visible ?? piece.objectVisibility.artwork,
      mask: mask?.visible ?? piece.objectVisibility.mask,
      cutline: cutline?.visible ?? piece.objectVisibility.cutline,
      helper: primaryHelper?.visible ?? piece.objectVisibility.helper
    },
    objectLocks: {
      artwork: artwork?.locked ?? piece.objectLocks.artwork,
      mask: mask?.locked ?? false,
      cutline: cutline?.locked ?? piece.objectLocks.cutline,
      helper: primaryHelper?.locked ?? piece.objectLocks.helper
    }
  }
}

export function syncObjectsFromLegacyFields(piece: PiecePreset): PiecePreset {
  const current = Array.isArray(piece.objects) ? piece.objects : []
  const activeMask = Boolean(piece.mask.enabled || piece.clippingMaskEnabled)
  const shouldMigrateActiveMask =
    activeMask &&
    piece.maskWorkflowVersion !== CURRENT_MASK_WORKFLOW_VERSION &&
    (piece.maskWorkflowVersion === PREVIOUS_MASK_WORKFLOW_VERSION || !piece.objectLocks.artwork)
  const artworkTransform = shouldMigrateActiveMask
    ? fitArtworkToCoverMask(piece.artwork.transform, piece.mask.transform)
    : { ...piece.artwork.transform }
  const artworkId = piece.artworkObjectId || `artwork-${piece.id}`
  const artwork = mergeObject(findByIdOrRole(current, artworkId, 'artwork'), {
    id: artworkId,
    type: 'artwork',
    shapeType: 'image',
    role: 'artwork',
    name: 'Artwork',
    visible: piece.objectVisibility.artwork,
    locked: activeMask ? true : piece.objectLocks.artwork,
    transform: artworkTransform,
    sourceId: piece.sourceId,
    exportEnabled: true
  })
  const mask =
    piece.mask.enabled || piece.clippingMaskEnabled
      ? mergeObject(findByIdOrRole(current, piece.maskObjectId, 'clipping-mask'), {
          id: piece.maskObjectId || `mask-${piece.id}`,
          type: 'mask',
          shapeType: maskShapeToEditorShape(piece.mask.shape),
          role: 'clipping-mask',
          name: 'Clipping Mask',
          visible: piece.objectVisibility.mask,
          locked: true,
          transform: { ...piece.mask.transform },
          fillColor: 'transparent',
          exportEnabled: false
        })
      : undefined
  const cutlineId = piece.cutlineObjectId || `cutline-${piece.id}`
  const cutline = mergeObject(findByIdOrRole(current, cutlineId, 'cutline'), {
    id: cutlineId,
    type: 'cutline',
    shapeType: cutlineShapeToEditorShape(piece.cutline.shape),
    role: 'cutline',
    name: piece.cutline.strokeName || CUT_CONTOUR_NAME,
    visible: piece.objectVisibility.cutline,
    locked: piece.objectLocks.cutline,
    transform: {
      xCm: piece.cutline.transform.xCm,
      yCm: piece.cutline.transform.yCm,
      widthCm: piece.cutline.transform.widthCm,
      heightCm: piece.cutline.transform.heightCm,
      rotation: piece.cutline.transform.rotation
    },
    fillColor: 'none',
    strokeColor: piece.cutline.strokeColor || CUT_CONTOUR_COLOR,
    strokeWidthPt: piece.cutline.strokeWidthPt,
    strokeName: piece.cutline.strokeName || CUT_CONTOUR_NAME,
    pathData: piece.cutline.customPathData,
    offsetMm: piece.cutline.transform.offsetMm,
    exportEnabled: true
  })
  const helperId = piece.helperShape?.id
  const retainedHelpers = current.filter(
    (object) => object.role === 'helper' && object.id !== helperId
  )
  const helper = piece.helperShape
    ? mergeObject(findByIdOrRole(current, helperId, 'helper'), {
        id: helperId ?? `helper-${piece.id}`,
        type: 'helper-shape',
        shapeType: maskShapeToEditorShape(piece.helperShape.shape),
        role: 'helper',
        name: 'Helper Shape',
        visible: piece.helperShape.visible && piece.objectVisibility.helper,
        locked: piece.helperShape.locked || piece.objectLocks.helper,
        transform: { ...piece.helperShape.transform },
        fillColor: 'rgba(139, 92, 246, 0.1)',
        strokeColor: '#8b5cf6',
        strokeWidthPt: 0.75,
        exportEnabled: false
      })
    : undefined
  const objects = [artwork, mask, cutline, ...retainedHelpers, helper].filter(
    (object): object is EditorObject => Boolean(object)
  )

  return syncLegacyFieldsFromObjects({
    ...piece,
    objects,
    artworkObjectId: artwork.id,
    maskObjectId: mask?.id,
    cutlineObjectId: cutline.id,
    helperObjectIds: objects
      .filter((object) => object.role === 'helper')
      .map((object) => object.id),
    selectedObjectIds: (piece.selectedObjectIds ?? []).filter((id) =>
      objects.some((object) => object.id === id)
    ),
    keyObjectId: piece.keyObjectId,
    maskWorkflowVersion: activeMask ? CURRENT_MASK_WORKFLOW_VERSION : piece.maskWorkflowVersion,
    artworkLockBeforeMask:
      activeMask &&
      piece.maskWorkflowVersion !== CURRENT_MASK_WORKFLOW_VERSION &&
      piece.maskWorkflowVersion !== PREVIOUS_MASK_WORKFLOW_VERSION &&
      piece.artworkLockBeforeMask === undefined
        ? piece.objectLocks.artwork
        : piece.artworkLockBeforeMask
  })
}

function getObjectByIdOrRole(
  piece: PiecePreset,
  id: string | undefined,
  role: EditorObject['role']
): EditorObject | undefined {
  return findByIdOrRole(piece.objects, id, role)
}

function findByIdOrRole(
  objects: EditorObject[],
  id: string | undefined,
  role: EditorObject['role']
): EditorObject | undefined {
  return (
    objects.find((object) => object.id === id) ?? objects.find((object) => object.role === role)
  )
}

function mergeObject(current: EditorObject | undefined, next: EditorObject): EditorObject {
  return {
    ...current,
    ...next,
    id: current?.id ?? next.id,
    transform: { ...next.transform }
  }
}

function getPrimaryHelper(piece: PiecePreset, helpers: EditorObject[]): EditorObject | undefined {
  const preferredIds = piece.helperObjectIds ?? []
  for (let index = preferredIds.length - 1; index >= 0; index -= 1) {
    const match = helpers.find((helper) => helper.id === preferredIds[index])
    if (match) return match
  }
  return helpers[helpers.length - 1]
}

function dedupeObjects(objects: EditorObject[]): EditorObject[] {
  const seen = new Set<string>()
  return objects.filter((object) => {
    if (seen.has(object.id)) return false
    seen.add(object.id)
    return true
  })
}

export function maskShapeToEditorShape(shape: MaskShape): EditorShapeType {
  if (shape === 'ellipse') return 'ellipse'
  if (shape === 'rounded-rectangle') return 'rounded-rectangle'
  if (shape === 'custom-polygon') return 'path'
  return 'rectangle'
}

export function cutlineShapeToEditorShape(shape: PiecePreset['cutline']['shape']): EditorShapeType {
  if (shape === 'ellipse') return 'ellipse'
  if (shape === 'rounded-rectangle') return 'rounded-rectangle'
  if (shape === 'custom-path') return 'path'
  return 'rectangle'
}

export function editorShapeToMaskShape(shape: EditorShapeType): MaskShape {
  if (shape === 'ellipse') return 'ellipse'
  if (shape === 'rounded-rectangle') return 'rounded-rectangle'
  if (shape === 'path') return 'custom-polygon'
  return 'rectangle'
}

function editorShapeToCutlineShape(shape: EditorShapeType): PiecePreset['cutline']['shape'] {
  if (shape === 'ellipse') return 'ellipse'
  if (shape === 'rounded-rectangle') return 'rounded-rectangle'
  if (shape === 'path') return 'custom-path'
  return 'rectangle'
}
