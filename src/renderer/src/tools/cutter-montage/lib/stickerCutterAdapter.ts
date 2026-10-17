import type { PiecePreset, PieceSourceFile } from '../types'
import type { StickerMakerResult } from './stickerMaker'
import { createCutterId } from './nesting'
import { createPiecePresetFromSource } from './piecePresets'
import { getFinishedPieceSize, resizeFinishedPiece } from './pieceSize'
import { synchronizePieceEditorModel } from './editorObjects'
import { bytesToArrayBuffer } from './sourcePreview'

export interface StickerSendOrder {
  result: StickerMakerResult
  quantity: number
}

export function createStickerCutterAssets(
  result: StickerMakerResult,
  offsetMm: number,
  existingPieces: PiecePreset[],
  quantity = 1
): { source: PieceSourceFile; piece: PiecePreset } {
  const fileName = `${result.fileName.replace(/\.[^.]+$/, '')}_artwork.png`
  const source: PieceSourceFile = {
    id: createCutterId('source'),
    sourceKind: 'image',
    fileName,
    originalFileName: result.fileName,
    displayName: result.fileName.replace(/\.[^.]+$/, ''),
    mimeType: 'image/png',
    bytes: result.png,
    previewUrl: URL.createObjectURL(
      new Blob([bytesToArrayBuffer(result.png)], { type: 'image/png' })
    ),
    naturalWidthPx: result.widthPx,
    naturalHeightPx: result.heightPx
  }
  const base = createPiecePresetFromSource(source, existingPieces)
  const marginCm = offsetMm / 10
  const widthCm = result.widthMm / 10 + marginCm * 2
  const heightCm = result.heightMm / 10 + marginCm * 2
  const artworkTransform = {
    xCm: marginCm,
    yCm: marginCm,
    widthCm: result.widthMm / 10,
    heightCm: result.heightMm / 10,
    rotation: 0
  }
  const cutlineTransform = {
    xCm: 0,
    yCm: 0,
    widthCm,
    heightCm,
    rotation: 0,
    offsetMm: 0
  }
  const groupId = createCutterId('sticker')
  const cutlineId = createCutterId('cutline')
  const piece = synchronizePieceEditorModel({
    ...base,
    quantity: Math.max(1, Math.min(100000, Math.round(quantity))),
    stickerMakerOffsetMm: offsetMm,
    widthCm,
    heightCm,
    artwork: { ...base.artwork, transform: artworkTransform },
    cutline: {
      ...base.cutline,
      shape: 'custom-path',
      customPathData: result.pathData,
      transform: cutlineTransform
    },
    artworkCutlineGrouped: true,
    groupLinked: true,
    cutlineObjectId: cutlineId,
    objects: [
      { ...base.objects[0], transform: artworkTransform, groupId },
      {
        id: cutlineId,
        type: 'cutline',
        shapeType: 'path',
        role: 'cutline',
        name: 'CutContour',
        visible: true,
        locked: false,
        transform: cutlineTransform,
        pathData: result.pathData,
        strokeName: base.cutline.strokeName,
        strokeColor: base.cutline.strokeColor,
        strokeWidthPt: 0.25,
        offsetMm: 0,
        exportEnabled: true,
        groupId
      }
    ]
  })
  return { source, piece: ensureStickerContourMask(piece) }
}

/** Retain the source PNG, but clip its padded canvas to the generated cut boundary. */
function ensureStickerContourMask(piece: PiecePreset): PiecePreset {
  if (piece.stickerMakerOffsetMm === undefined || piece.clippingMaskEnabled) return piece
  const contour = piece.objects.find(
    (object) => object.id === piece.cutlineObjectId && object.role === 'cutline'
  )
  if (!contour) return piece
  const maskId = createCutterId('sticker-mask')
  return synchronizePieceEditorModel({
    ...piece,
    clippingMaskEnabled: true,
    maskObjectId: maskId,
    maskWorkflowVersion: 3,
    artworkLockBeforeMask:
      piece.objects.find((object) => object.role === 'artwork')?.locked ?? false,
    objects: [
      ...piece.objects,
      {
        ...contour,
        id: maskId,
        type: 'mask',
        role: 'clipping-mask',
        name: 'Sticker boundary',
        transform: { ...contour.transform },
        exportEnabled: false,
        offsetMm: 0
      }
    ]
  })
}

/** Scale the finished artwork and vector contour together in Cutter Montage. */
export function resizeFinishedStickerWidth(piece: PiecePreset, widthMm: number): PiecePreset {
  if (!Number.isFinite(widthMm) || widthMm < 5 || widthMm > 960) return piece
  const prepared = ensureStickerContourMask(piece)
  const resized = resizeFinishedPiece(
    prepared,
    widthMm / 10,
    getFinishedPieceSize(piece).heightCm,
    'width'
  )
  return {
    ...resized,
    stickerMakerOffsetMm:
      piece.stickerMakerOffsetMm === undefined
        ? undefined
        : piece.stickerMakerOffsetMm * (resized.widthCm / piece.widthCm)
  }
}
