import type { AlignmentCommand, EditorObjectType, KeyObjectState, PiecePreset } from '../types'

export function alignPieceObjects(
  piece: PiecePreset,
  selectedObjects: EditorObjectType[],
  keyObject: KeyObjectState,
  command: AlignmentCommand
): PiecePreset {
  if (selectedObjects.length === 0) {
    return piece
  }

  if (command === 'distribute-horizontal' || command === 'distribute-vertical') {
    return distributeObjects(piece, command)
  }

  const key = keyObject.object && selectedObjects.includes(keyObject.object)
    ? keyObject.object
    : selectedObjects.length > 1
      ? selectedObjects[0]
      : null

  if (key) {
    return moveObjectsToKey(piece, selectedObjects, key, command)
  }

  return moveObjectsToPieceBounds(piece, selectedObjects, command)
}

export function centerArtworkToCutline(piece: PiecePreset): PiecePreset {
  const cutline = piece.cutline.transform
  const artwork = piece.mask.enabled ? piece.mask.transform : piece.artwork.transform
  const xCm = cutline.xCm + (cutline.widthCm - artwork.widthCm) / 2
  const yCm = cutline.yCm + (cutline.heightCm - artwork.heightCm) / 2

  if (piece.mask.enabled) {
    const deltaX = xCm - piece.mask.transform.xCm
    const deltaY = yCm - piece.mask.transform.yCm

    return {
      ...piece,
      artwork: {
        ...piece.artwork,
        transform: {
          ...piece.artwork.transform,
          xCm: piece.artwork.transform.xCm + deltaX,
          yCm: piece.artwork.transform.yCm + deltaY
        }
      },
      mask: {
        ...piece.mask,
        transform: {
          ...piece.mask.transform,
          xCm,
          yCm
        }
      }
    }
  }

  return {
    ...piece,
    artwork: {
      ...piece.artwork,
      transform: {
        ...artwork,
        xCm,
        yCm
      }
    }
  }
}

export function centerCutlineToArtwork(piece: PiecePreset): PiecePreset {
  const artwork = piece.mask.enabled ? piece.mask.transform : piece.artwork.transform
  const cutline = piece.cutline.transform

  return {
    ...piece,
    cutline: {
      ...piece.cutline,
      transform: {
        ...cutline,
        xCm: artwork.xCm + (artwork.widthCm - cutline.widthCm) / 2,
        yCm: artwork.yCm + (artwork.heightCm - cutline.heightCm) / 2
      }
    }
  }
}

function moveObjectsToKey(
  piece: PiecePreset,
  selectedObjects: EditorObjectType[],
  key: EditorObjectType,
  command: AlignmentCommand
): PiecePreset {
  const keyRect = getObjectRect(piece, key)

  return selectedObjects.reduce((nextPiece, object) => {
    if (object === key) {
      return nextPiece
    }

    const rect = getObjectRect(nextPiece, object)

    return setObjectPosition(nextPiece, object, getAlignedPosition(rect, keyRect, command))
  }, piece)
}

function moveObjectsToPieceBounds(
  piece: PiecePreset,
  selectedObjects: EditorObjectType[],
  command: AlignmentCommand
): PiecePreset {
  const bounds = { xCm: 0, yCm: 0, widthCm: piece.widthCm, heightCm: piece.heightCm }

  return selectedObjects.reduce((nextPiece, object) => {
    const rect = getObjectRect(nextPiece, object)

    return setObjectPosition(nextPiece, object, getAlignedPosition(rect, bounds, command))
  }, piece)
}

function distributeObjects(piece: PiecePreset, command: AlignmentCommand): PiecePreset {
  const artwork = piece.artwork.transform
  const cutline = piece.cutline.transform

  if (command === 'distribute-horizontal') {
    const totalWidth = artwork.widthCm + cutline.widthCm
    const gap = Math.max((piece.widthCm - totalWidth) / 3, 0)

    return {
      ...piece,
      artwork: { ...piece.artwork, transform: { ...artwork, xCm: gap } },
      cutline: {
        ...piece.cutline,
        transform: { ...cutline, xCm: gap * 2 + artwork.widthCm }
      }
    }
  }

  const totalHeight = artwork.heightCm + cutline.heightCm
  const gap = Math.max((piece.heightCm - totalHeight) / 3, 0)

  return {
    ...piece,
    artwork: { ...piece.artwork, transform: { ...artwork, yCm: gap } },
    cutline: {
      ...piece.cutline,
      transform: { ...cutline, yCm: gap * 2 + artwork.heightCm }
    }
  }
}

function getAlignedPosition(
  rect: Rect,
  target: Rect,
  command: AlignmentCommand
): { xCm: number; yCm: number } {
  if (command === 'left') {
    return { xCm: target.xCm, yCm: rect.yCm }
  }

  if (command === 'center-horizontal') {
    return { xCm: target.xCm + (target.widthCm - rect.widthCm) / 2, yCm: rect.yCm }
  }

  if (command === 'right') {
    return { xCm: target.xCm + target.widthCm - rect.widthCm, yCm: rect.yCm }
  }

  if (command === 'top') {
    return { xCm: rect.xCm, yCm: target.yCm }
  }

  if (command === 'center-vertical') {
    return { xCm: rect.xCm, yCm: target.yCm + (target.heightCm - rect.heightCm) / 2 }
  }

  if (command === 'bottom') {
    return { xCm: rect.xCm, yCm: target.yCm + target.heightCm - rect.heightCm }
  }

  return { xCm: rect.xCm, yCm: rect.yCm }
}

function getObjectRect(piece: PiecePreset, object: EditorObjectType): Rect {
  const transform =
    object === 'artwork'
      ? piece.artwork.transform
      : object === 'mask'
        ? piece.mask.transform
        : object === 'helper-shape'
          ? piece.helperShape?.transform ?? piece.mask.transform
          : piece.cutline.transform

  return {
    xCm: transform.xCm,
    yCm: transform.yCm,
    widthCm: transform.widthCm,
    heightCm: transform.heightCm
  }
}

function setObjectPosition(
  piece: PiecePreset,
  object: EditorObjectType,
  position: { xCm: number; yCm: number }
): PiecePreset {
  if (object === 'artwork') {
    return {
      ...piece,
      artwork: {
        ...piece.artwork,
        transform: { ...piece.artwork.transform, ...position }
      }
    }
  }

  if (object === 'mask') {
    return {
      ...piece,
      mask: {
        ...piece.mask,
        transform: { ...piece.mask.transform, ...position }
      }
    }
  }

  if (object === 'helper-shape') {
    if (!piece.helperShape) {
      return piece
    }

    return {
      ...piece,
      helperShape: {
        ...piece.helperShape,
        transform: { ...piece.helperShape.transform, ...position }
      }
    }
  }

  return {
    ...piece,
    cutline: {
      ...piece.cutline,
      transform: { ...piece.cutline.transform, ...position }
    }
  }
}

interface Rect {
  xCm: number
  yCm: number
  widthCm: number
  heightCm: number
}
