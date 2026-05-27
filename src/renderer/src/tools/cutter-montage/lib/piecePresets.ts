import { CUT_CONTOUR_COLOR, CUT_CONTOUR_NAME } from './colorSpot'
import { createCutterId } from './nesting'
import type {
  ArtworkTransform,
  CutlineTransform,
  PiecePreset,
  PieceSourceFile,
  PlacedPiece
} from '../types'

export function createPiecePresetFromSource(
  source: PieceSourceFile,
  existingPieces: PiecePreset[]
): PiecePreset {
  const widthCm = getDefaultPieceWidthCm(source.naturalWidthPx)
  const heightCm = Math.max(widthCm * (source.naturalHeightPx / source.naturalWidthPx), 0.5)
  const displayName = getUniquePieceName(source.fileName, existingPieces)
  const artworkTransform: ArtworkTransform = {
    xCm: 0,
    yCm: 0,
    widthCm,
    heightCm,
    rotation: 0
  }
  const cutlineTransform: CutlineTransform = {
    xCm: 0,
    yCm: 0,
    widthCm,
    heightCm,
    rotation: 0,
    offsetMm: 1
  }

  return {
    id: createCutterId('piece'),
    sourceId: source.id,
    sourceFileName: source.fileName,
    displayName,
    previewUrl: source.previewUrl,
    naturalWidthPx: source.naturalWidthPx,
    naturalHeightPx: source.naturalHeightPx,
    widthCm,
    heightCm,
    quantity: 1,
    rotationAllowed: true,
    locked: false,
    artwork: {
      sourceId: source.id,
      sourceFileName: source.fileName,
      previewUrl: source.previewUrl,
      transform: artworkTransform
    },
    cutline: {
      shape: 'rectangle',
      transform: cutlineTransform,
      strokeName: CUT_CONTOUR_NAME,
      strokeColor: CUT_CONTOUR_COLOR,
      strokeWidthPt: 0.25
    }
  }
}

export function duplicatePiecePreset(
  piece: PiecePreset,
  existingPieces: PiecePreset[]
): PiecePreset {
  return {
    ...piece,
    id: createCutterId('piece'),
    displayName: getUniquePieceName(piece.sourceFileName, existingPieces),
    artwork: {
      ...piece.artwork,
      transform: { ...piece.artwork.transform }
    },
    cutline: {
      ...piece.cutline,
      transform: { ...piece.cutline.transform }
    }
  }
}

export function createPlacedPieceFromPreset(
  piece: PiecePreset,
  xCm: number,
  yCm: number,
  rotation: 0 | 90 | 180 | 270 = 0
): PlacedPiece {
  return {
    id: createCutterId('placed'),
    presetId: piece.id,
    sourceFileName: piece.sourceFileName,
    displayName: piece.displayName,
    xCm,
    yCm,
    widthCm: rotation === 90 || rotation === 270 ? piece.heightCm : piece.widthCm,
    heightCm: rotation === 90 || rotation === 270 ? piece.widthCm : piece.heightCm,
    rotation,
    locked: piece.locked,
    artworkTransform: { ...piece.artwork.transform },
    cutlineTransform: { ...piece.cutline.transform }
  }
}

export function syncPieceBounds(piece: PiecePreset, widthCm: number, heightCm: number): PiecePreset {
  const safeWidth = Math.max(widthCm, 0.5)
  const safeHeight = Math.max(heightCm, 0.5)
  const widthScale = safeWidth / piece.widthCm
  const heightScale = safeHeight / piece.heightCm

  return {
    ...piece,
    widthCm: safeWidth,
    heightCm: safeHeight,
    artwork: {
      ...piece.artwork,
      transform: {
        ...piece.artwork.transform,
        xCm: piece.artwork.transform.xCm * widthScale,
        yCm: piece.artwork.transform.yCm * heightScale,
        widthCm: piece.artwork.transform.widthCm * widthScale,
        heightCm: piece.artwork.transform.heightCm * heightScale
      }
    },
    cutline: {
      ...piece.cutline,
      transform: {
        ...piece.cutline.transform,
        xCm: piece.cutline.transform.xCm * widthScale,
        yCm: piece.cutline.transform.yCm * heightScale,
        widthCm: piece.cutline.transform.widthCm * widthScale,
        heightCm: piece.cutline.transform.heightCm * heightScale
      }
    }
  }
}

function getDefaultPieceWidthCm(naturalWidthPx: number): number {
  return Math.max(3, Math.min(naturalWidthPx / 80, 18))
}

function getUniquePieceName(fileName: string, existingPieces: PiecePreset[]): string {
  const baseName = fileName.replace(/\.[^.]+$/, '')
  const matchingCount = existingPieces.filter((piece) => piece.sourceFileName === fileName).length

  return matchingCount === 0 ? baseName : `${baseName} copy ${matchingCount + 1}`
}
