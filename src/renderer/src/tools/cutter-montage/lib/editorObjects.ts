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
    currentObjects.find((object) => object.id === piece.artworkObjectId || object.role === 'artwork'),
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
        currentObjects.find((object) => object.id === piece.maskObjectId || object.role === 'clipping-mask'),
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
    currentObjects.find((object) => object.id === piece.cutlineObjectId || object.role === 'cutline'),
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
  const selectedObjectIds = selection.selectedTypes
    ? selection.selectedTypes.flatMap((type) => {
        if (type === 'helper-shape') {
          return helper ? [helper.id] : []
        }

        const object = objects.find((candidate) => candidate.type === type)
        return object ? [object.id] : []
      })
    : (migrated.selectedObjectIds ?? []).filter((id) => objects.some((object) => object.id === id))
  const keyObjectId = selection.keyObject?.object
    ? objects.find((object) => object.type === selection.keyObject?.object)?.id
    : migrated.keyObjectId && objects.some((object) => object.id === migrated.keyObjectId)
      ? migrated.keyObjectId
      : undefined

  return syncLegacyFieldsFromObjects({
    ...migrated,
    objects,
    artworkObjectId: artwork.id,
    maskObjectId: mask?.id,
    cutlineObjectId: cutline.id,
    helperObjectIds: objects.filter((object) => object.role === 'helper').map((object) => object.id),
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
  const duplicates = objects
    .filter((object) => selected.has(object.id))
    .map((object) => ({
      ...object,
      id: createObjectId(object.type),
      name: `${object.name} copy`,
      role: object.role === 'artwork' ? 'helper' as const : object.role,
      type: object.type === 'artwork' ? 'helper-shape' as const : object.type,
      sourceId: object.sourceId,
      transform: {
        ...object.transform,
        xCm: object.transform.xCm + offset,
        yCm: object.transform.yCm + offset
      }
    }))

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
    transform: { ...object.transform }
  }
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

function createOrUpdateObject(
  current: EditorObject | undefined,
  next: EditorObject
): EditorObject {
  return { ...current, ...next, id: current?.id ?? next.id, transform: { ...next.transform } }
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
