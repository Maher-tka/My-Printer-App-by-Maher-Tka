import type {
  AlignmentCommand,
  EditorObject,
  EditorObjectType,
  EditorShapeType,
  KeyObjectState,
  MaskShape,
  PiecePreset
} from '../types'
import { CUT_CONTOUR_COLOR, CUT_CONTOUR_NAME } from './colorSpot'
import {
  normalizePiecePreset,
  syncLegacyFieldsFromObjects,
  syncObjectsFromLegacyFields
} from './pieceModelSync'

interface EditorSelectionSnapshot {
  selectedTypes?: EditorObjectType[]
  selectedObjectIds?: string[]
  keyObject?: KeyObjectState
}

export function synchronizePieceEditorModel(
  piece: PiecePreset,
  selection: EditorSelectionSnapshot = {}
): PiecePreset {
  const migrated = piece.objects?.length
    ? normalizePiecePreset(piece)
    : syncObjectsFromLegacyFields(piece)
  const currentObjects = migrated.objects
  const artwork = createOrUpdateObject(
    findObjectByIdOrRole(currentObjects, piece.artworkObjectId, 'artwork'),
    {
      id: migrated.artworkObjectId || `artwork-${piece.id}`,
      type: 'artwork',
      shapeType: 'image',
      role: 'artwork',
      name: 'Artwork',
      visible: migrated.objectVisibility.artwork,
      locked: migrated.objectLocks.artwork,
      transform: { ...migrated.artwork.transform },
      sourceId: migrated.sourceId,
      exportEnabled: true
    }
  )
  const mask = migrated.mask.enabled
    ? createOrUpdateObject(
        findObjectByIdOrRole(currentObjects, piece.maskObjectId, 'clipping-mask'),
        {
          id: migrated.maskObjectId || `mask-${piece.id}`,
          type: 'mask',
          shapeType: maskShapeToEditorShape(migrated.mask.shape),
          role: 'clipping-mask',
          name: 'Clipping Mask',
          visible: migrated.objectVisibility.mask,
          locked: migrated.objectLocks.mask,
          transform: { ...migrated.mask.transform },
          fillColor: 'transparent',
          exportEnabled: false
        }
      )
    : undefined
  const cutline = createOrUpdateObject(
    findObjectByIdOrRole(currentObjects, piece.cutlineObjectId, 'cutline'),
    {
      id: migrated.cutlineObjectId || `cutline-${piece.id}`,
      type: 'cutline',
      shapeType: cutlineShapeToEditorShape(migrated.cutline.shape),
      role: 'cutline',
      name: migrated.cutline.strokeName || CUT_CONTOUR_NAME,
      visible: migrated.objectVisibility.cutline,
      locked: migrated.objectLocks.cutline,
      transform: {
        xCm: migrated.cutline.transform.xCm,
        yCm: migrated.cutline.transform.yCm,
        widthCm: migrated.cutline.transform.widthCm,
        heightCm: migrated.cutline.transform.heightCm,
        rotation: migrated.cutline.transform.rotation
      },
      fillColor: 'none',
      strokeColor: migrated.cutline.strokeColor || CUT_CONTOUR_COLOR,
      strokeWidthPt: migrated.cutline.strokeWidthPt,
      strokeName: migrated.cutline.strokeName || CUT_CONTOUR_NAME,
      pathData: migrated.cutline.customPathData,
      offsetMm: migrated.cutline.transform.offsetMm,
      exportEnabled: true
    }
  )
  const legacyHelperId = migrated.helperShape?.id
  const retainedHelpers = currentObjects.filter(
    (object) => object.role === 'helper' && object.id !== legacyHelperId
  )
  const helper = migrated.helperShape
    ? createOrUpdateObject(
        currentObjects.find((object) => object.id === migrated.helperShape?.id),
        {
          id: migrated.helperShape.id,
          type: 'helper-shape',
          shapeType: maskShapeToEditorShape(migrated.helperShape.shape),
          role: 'helper',
          name: 'Helper Shape',
          visible: migrated.helperShape.visible && migrated.objectVisibility.helper,
          locked: migrated.helperShape.locked || migrated.objectLocks.helper,
          transform: { ...migrated.helperShape.transform },
          fillColor: 'rgba(139, 92, 246, 0.1)',
          strokeColor: '#8b5cf6',
          strokeWidthPt: 0.75,
          exportEnabled: false
        }
      )
    : undefined
  const objects = [artwork, mask, cutline, ...retainedHelpers, helper].filter(
    (object): object is EditorObject => Boolean(object)
  )
  const selectedObjectIds = selection.selectedObjectIds
    ? selection.selectedObjectIds.filter((id) => objects.some((object) => object.id === id))
    : selection.selectedTypes
      ? objects
          .filter((object) => selection.selectedTypes?.includes(object.type))
          .map((object) => object.id)
      : (migrated.selectedObjectIds ?? []).filter((id) =>
          objects.some((object) => object.id === id)
        )
  const requestedKeyId = selection.keyObject?.objectId
  const keyObjectId =
    requestedKeyId && selectedObjectIds.includes(requestedKeyId)
      ? requestedKeyId
      : selection.keyObject?.object
        ? objects.find(
            (object) =>
              object.type === selection.keyObject?.object && selectedObjectIds.includes(object.id)
          )?.id
        : migrated.keyObjectId && objects.some((object) => object.id === migrated.keyObjectId)
          ? migrated.keyObjectId
          : undefined

  return syncLegacyFieldsFromObjects({
    ...migrated,
    objects,
    artworkObjectId: artwork.id,
    maskObjectId: mask?.id,
    cutlineObjectId: cutline.id,
    helperObjectIds: objects
      .filter((object) => object.role === 'helper')
      .map((object) => object.id),
    selectedObjectIds,
    keyObjectId,
    groupLinked: migrated.artworkCutlineGrouped,
    lockAspectRatio: migrated.lockAspectRatio ?? true,
    clippingMaskEnabled: migrated.mask.enabled
  })
}

export function duplicateObjects(
  objects: EditorObject[],
  selectedIds: string[],
  inPlace: boolean
): { objects: EditorObject[]; selectedObjectIds: string[] } {
  const offset = inPlace ? 0 : 0.4
  const selected = new Set(selectedIds)
  const groupIds = new Map<string, string>()
  const duplicates = objects
    .filter((object) => selected.has(object.id))
    .map((object) => {
      const duplicateAsHelper = object.role !== 'helper'
      const groupId = object.groupId
        ? (groupIds.get(object.groupId) ?? createObjectId('group'))
        : undefined
      if (object.groupId && groupId) groupIds.set(object.groupId, groupId)
      return {
        ...object,
        id: createObjectId(object.type),
        name: `${object.name} copy`,
        role: duplicateAsHelper ? ('helper' as const) : object.role,
        type: duplicateAsHelper ? ('helper-shape' as const) : object.type,
        sourceId: object.sourceId,
        groupId,
        exportEnabled: duplicateAsHelper ? false : object.exportEnabled,
        transform: {
          ...object.transform,
          xCm: object.transform.xCm + offset,
          yCm: object.transform.yCm + offset
        }
      }
    })

  return {
    objects: [...objects, ...duplicates],
    selectedObjectIds: duplicates.map((object) => object.id)
  }
}

export function duplicateShapeAsCutline(object: EditorObject): EditorObject {
  return {
    ...object,
    id: createObjectId('cutline'),
    type: 'cutline',
    role: 'cutline',
    name: CUT_CONTOUR_NAME,
    fillColor: 'none',
    strokeColor: CUT_CONTOUR_COLOR,
    strokeWidthPt: object.strokeWidthPt ?? 0.25,
    strokeName: CUT_CONTOUR_NAME,
    exportEnabled: true,
    groupId: undefined,
    transform: { ...object.transform }
  }
}

export function makeClippingMaskFromSelection(
  piece: PiecePreset,
  selectedIds: string[] = piece.selectedObjectIds
): PiecePreset {
  const selected = new Set(selectedIds)
  const hasArtwork = piece.objects.some(
    (object) => selected.has(object.id) && object.role === 'artwork'
  )
  const shape = [...piece.objects]
    .reverse()
    .find(
      (object) =>
        selected.has(object.id) &&
        (object.role === 'helper' || object.role === 'clipping-mask') &&
        object.shapeType !== 'image'
    )
  if (!hasArtwork || !shape) return piece

  const objects = piece.objects.map((object) => {
    if (object.id === shape.id) {
      return {
        ...object,
        type: 'mask' as const,
        role: 'clipping-mask' as const,
        name: 'Clipping Mask',
        exportEnabled: false
      }
    }
    if (object.role === 'clipping-mask') {
      return {
        ...object,
        type: 'helper-shape' as const,
        role: 'helper' as const,
        name: getNextHelperName(piece.objects),
        exportEnabled: false
      }
    }
    return object
  })

  return syncLegacyFieldsFromObjects({
    ...piece,
    objects,
    maskObjectId: shape.id,
    clippingMaskEnabled: true,
    selectedObjectIds: [shape.id],
    keyObjectId: undefined
  })
}

export function releaseClippingMask(piece: PiecePreset): PiecePreset {
  const mask =
    piece.objects.find((object) => object.id === piece.maskObjectId) ??
    piece.objects.find((object) => object.role === 'clipping-mask')
  if (!mask) return piece

  return syncLegacyFieldsFromObjects({
    ...piece,
    objects: piece.objects.map((object) =>
      object.id === mask.id
        ? {
            ...object,
            type: 'helper-shape' as const,
            role: 'helper' as const,
            name: getNextHelperName(piece.objects),
            exportEnabled: false
          }
        : object
    ),
    maskObjectId: undefined,
    clippingMaskEnabled: false,
    selectedObjectIds: [mask.id],
    keyObjectId: undefined
  })
}

export function duplicateObjectAsCutline(piece: PiecePreset, objectId: string): PiecePreset {
  const source = piece.objects.find((object) => object.id === objectId)
  if (!source || source.shapeType === 'image') return piece
  const cutline = duplicateShapeAsCutline(source)
  return syncLegacyFieldsFromObjects({
    ...piece,
    objects: [...piece.objects, cutline],
    cutlineObjectId: cutline.id,
    selectedObjectIds: [cutline.id],
    keyObjectId: undefined
  })
}

export function convertObjectToCutline(piece: PiecePreset, objectId: string): PiecePreset {
  const source = piece.objects.find((object) => object.id === objectId)
  if (!source || source.shapeType === 'image') return piece
  const cutline = { ...duplicateShapeAsCutline(source), id: source.id }
  return syncLegacyFieldsFromObjects({
    ...piece,
    objects: piece.objects.map((object) => (object.id === objectId ? cutline : object)),
    maskObjectId: piece.maskObjectId === objectId ? undefined : piece.maskObjectId,
    clippingMaskEnabled: piece.maskObjectId === objectId ? false : piece.clippingMaskEnabled,
    cutlineObjectId: objectId,
    selectedObjectIds: [objectId],
    keyObjectId: undefined
  })
}

export function matchObjectGeometry(
  piece: PiecePreset,
  targetId: string | undefined,
  sourceId: string | undefined
): PiecePreset {
  if (!targetId || !sourceId || targetId === sourceId) return piece
  const source = piece.objects.find((object) => object.id === sourceId)
  if (!source) return piece
  return syncLegacyFieldsFromObjects({
    ...piece,
    objects: piece.objects.map((object) =>
      object.id === targetId && !object.locked
        ? { ...object, transform: { ...source.transform } }
        : object
    )
  })
}

export function centerObjectInside(
  piece: PiecePreset,
  targetId: string | undefined,
  containerId: string | undefined
): PiecePreset {
  if (!targetId || !containerId || targetId === containerId) return piece
  const container = piece.objects.find((object) => object.id === containerId)
  if (!container) return piece
  return syncLegacyFieldsFromObjects({
    ...piece,
    objects: piece.objects.map((object) =>
      object.id === targetId && !object.locked
        ? {
            ...object,
            transform: {
              ...object.transform,
              xCm:
                container.transform.xCm +
                (container.transform.widthCm - object.transform.widthCm) / 2,
              yCm:
                container.transform.yCm +
                (container.transform.heightCm - object.transform.heightCm) / 2
            }
          }
        : object
    )
  })
}

export function setObjectGroup(
  piece: PiecePreset,
  selectedIds: string[],
  grouped: boolean
): PiecePreset {
  const selected = new Set(selectedIds)
  if (selected.size < (grouped ? 2 : 1)) return piece
  const groupId = grouped ? createObjectId('group') : undefined
  const objects = piece.objects.map((object) =>
    selected.has(object.id) ? { ...object, groupId } : object
  )
  const hasGroups = objects.some((object) => Boolean(object.groupId))
  return syncLegacyFieldsFromObjects({
    ...piece,
    objects,
    groupLinked: hasGroups,
    artworkCutlineGrouped: hasGroups
  })
}

export function alignEditorObjects(
  objects: EditorObject[],
  selectedIds: string[],
  keyObjectId: string,
  command: AlignmentCommand
): EditorObject[] {
  const selected = new Set(selectedIds)
  const keyObject = objects.find((object) => object.id === keyObjectId)

  if (!keyObject || !selected.has(keyObjectId)) {
    return objects
  }

  return objects.map((object) => {
    if (!selected.has(object.id) || object.id === keyObjectId || object.locked) {
      return object
    }

    return {
      ...object,
      transform: {
        ...object.transform,
        ...getAlignedPosition(object, keyObject, command)
      }
    }
  })
}

export function getPrimaryObject(
  piece: PiecePreset,
  type: EditorObjectType
): EditorObject | undefined {
  return piece.objects.find((object) => object.type === type)
}

function createOrUpdateObject(current: EditorObject | undefined, next: EditorObject): EditorObject {
  return { ...current, ...next, id: current?.id ?? next.id, transform: { ...next.transform } }
}

function findObjectByIdOrRole(
  objects: EditorObject[],
  id: string | undefined,
  role: EditorObject['role']
): EditorObject | undefined {
  return (
    objects.find((object) => object.id === id) ?? objects.find((object) => object.role === role)
  )
}

function maskShapeToEditorShape(shape: MaskShape): EditorShapeType {
  if (shape === 'ellipse') return 'ellipse'
  if (shape === 'rounded-rectangle') return 'rounded-rectangle'
  if (shape === 'custom-polygon') return 'path'
  return 'rectangle'
}

function cutlineShapeToEditorShape(shape: PiecePreset['cutline']['shape']): EditorShapeType {
  if (shape === 'ellipse') return 'ellipse'
  if (shape === 'rounded-rectangle') return 'rounded-rectangle'
  if (shape === 'custom-path') return 'path'
  return 'rectangle'
}

function getAlignedPosition(
  object: EditorObject,
  keyObject: EditorObject,
  command: AlignmentCommand
): Pick<EditorObject['transform'], 'xCm' | 'yCm'> {
  const rect = object.transform
  const key = keyObject.transform

  if (command === 'left') return { xCm: key.xCm, yCm: rect.yCm }
  if (command === 'center-horizontal') {
    return { xCm: key.xCm + (key.widthCm - rect.widthCm) / 2, yCm: rect.yCm }
  }
  if (command === 'right') {
    return { xCm: key.xCm + key.widthCm - rect.widthCm, yCm: rect.yCm }
  }
  if (command === 'top') return { xCm: rect.xCm, yCm: key.yCm }
  if (command === 'center-vertical') {
    return { xCm: rect.xCm, yCm: key.yCm + (key.heightCm - rect.heightCm) / 2 }
  }
  if (command === 'bottom') {
    return { xCm: rect.xCm, yCm: key.yCm + key.heightCm - rect.heightCm }
  }

  return { xCm: rect.xCm, yCm: rect.yCm }
}

function createObjectId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function getNextHelperName(objects: EditorObject[]): string {
  return `Helper Shape ${objects.filter((object) => object.role === 'helper').length + 1}`
}
