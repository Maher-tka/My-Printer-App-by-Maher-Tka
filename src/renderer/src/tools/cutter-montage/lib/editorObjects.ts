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

interface EditorSelectionSnapshot {
  selectedTypes?: EditorObjectType[]
  keyObject?: KeyObjectState
}

export function synchronizePieceEditorModel(
  piece: PiecePreset,
  selection: EditorSelectionSnapshot = {}
): PiecePreset {
  const currentObjects = Array.isArray(piece.objects) ? piece.objects : []
  const artwork = createOrUpdateObject(
    currentObjects.find((object) => object.id === piece.artworkObjectId || object.role === 'artwork'),
    {
      id: piece.artworkObjectId || `artwork-${piece.id}`,
      type: 'artwork',
      shapeType: 'image',
      role: 'artwork',
      name: 'Artwork',
      visible: piece.objectVisibility.artwork,
      locked: piece.objectLocks.artwork,
      transform: { ...piece.artwork.transform },
      sourceId: piece.sourceId,
      exportEnabled: true
    }
  )
  const hadMaskObject = Boolean(
    piece.maskObjectId || currentObjects.some((object) => object.role === 'clipping-mask')
  )
  const mask = piece.mask.enabled || hadMaskObject
    ? createOrUpdateObject(
        currentObjects.find((object) => object.id === piece.maskObjectId || object.role === 'clipping-mask'),
        {
          id: piece.maskObjectId || `mask-${piece.id}`,
          type: 'mask',
          shapeType: maskShapeToEditorShape(piece.mask.shape),
          role: 'clipping-mask',
          name: 'Clipping Mask',
          visible: piece.objectVisibility.mask,
          locked: piece.objectLocks.mask,
          transform: { ...piece.mask.transform },
          fillColor: 'transparent',
          exportEnabled: false
        }
      )
    : undefined
  const cutline = createOrUpdateObject(
    currentObjects.find((object) => object.id === piece.cutlineObjectId || object.role === 'cutline'),
    {
      id: piece.cutlineObjectId || `cutline-${piece.id}`,
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
    }
  )
  const legacyHelperId = piece.helperShape?.id
  const retainedHelpers = currentObjects.filter(
    (object) => object.role === 'helper' && object.id !== legacyHelperId
  )
  const helper = piece.helperShape
    ? createOrUpdateObject(
        currentObjects.find((object) => object.id === piece.helperShape?.id),
        {
          id: piece.helperShape.id,
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
    : (piece.selectedObjectIds ?? []).filter((id) => objects.some((object) => object.id === id))
  const keyObjectId = selection.keyObject?.object
    ? objects.find((object) => object.type === selection.keyObject?.object)?.id
    : piece.keyObjectId && objects.some((object) => object.id === piece.keyObjectId)
      ? piece.keyObjectId
      : undefined

  return {
    ...piece,
    objects,
    artworkObjectId: artwork.id,
    maskObjectId: mask?.id,
    cutlineObjectId: cutline.id,
    helperObjectIds: objects.filter((object) => object.role === 'helper').map((object) => object.id),
    selectedObjectIds,
    keyObjectId,
    groupLinked: piece.artworkCutlineGrouped,
    lockAspectRatio: piece.lockAspectRatio ?? true,
    clippingMaskEnabled: piece.mask.enabled
  }
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
