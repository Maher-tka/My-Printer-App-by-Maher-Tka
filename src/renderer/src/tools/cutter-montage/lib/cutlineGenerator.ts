import type { PieceCutline, PiecePreset, PlacedPiece, CutlineTransform } from '../types'
import { mmToCm } from './units'

export interface CutlineRect {
  xCm: number
  yCm: number
  widthCm: number
  heightCm: number
  rotation: number
}

export function getPlacedArtworkRect(
  placed: PlacedPiece,
  preset: PiecePreset
): CutlineRect {
  const scaleX = placed.widthCm / preset.widthCm
  const scaleY = placed.heightCm / preset.heightCm
  const transform = placed.artworkTransform

  return {
    xCm: placed.xCm + transform.xCm * scaleX,
    yCm: placed.yCm + transform.yCm * scaleY,
    widthCm: transform.widthCm * scaleX,
    heightCm: transform.heightCm * scaleY,
    rotation: (placed.rotation + transform.rotation) % 360
  }
}

export function getPlacedCutlineRect(
  placed: PlacedPiece,
  preset: PiecePreset
): CutlineRect {
  const scaleX = placed.widthCm / preset.widthCm
  const scaleY = placed.heightCm / preset.heightCm
  const transform = placed.cutlineTransform
  const offsetCm = mmToCm(transform.offsetMm)

  return {
    xCm: placed.xCm + transform.xCm * scaleX - offsetCm,
    yCm: placed.yCm + transform.yCm * scaleY - offsetCm,
    widthCm: transform.widthCm * scaleX + offsetCm * 2,
    heightCm: transform.heightCm * scaleY + offsetCm * 2,
    rotation: (placed.rotation + transform.rotation) % 360
  }
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

export function getPlacedCutlineSvgElement(
  placed: PlacedPiece,
  preset: PiecePreset
): string {
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
