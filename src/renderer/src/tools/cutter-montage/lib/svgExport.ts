import type {
  CutterExportResult,
  CutterProject,
  EditorObject,
  PiecePreset,
  PlacedPiece
} from '../types'
import { escapeXml, getPlacedEditorObjectRect, type CutlineRect } from './cutlineGenerator'
import { getProductionLabelSvgMarkup } from './productionLabel'
import { sourceToSvgArtworkDataUrl } from './rasterizeArtwork'
import {
  CUSTOMER_PREVIEW_CONTOUR_COLOR,
  CUSTOMER_PREVIEW_CONTOUR_DASH,
  CUSTOMER_PREVIEW_CONTOUR_LABEL,
  getCutterExportSemantics
} from './exportPresets'
import type { CutterContourRenderKind } from './exportPresets'
import { CUT_CONTOUR_COLOR, CUT_CONTOUR_NAME } from './colorSpot'
import {
  getRegistrationMarksSvgMarkup,
  shouldIncludeRegistrationInArtwork,
  shouldIncludeRegistrationLayer
} from './registrationMarks'

const CM_TO_MM = 10

export async function exportCutterSvg(
  project: CutterProject,
  reuseArtworkSymbols = false
): Promise<CutterExportResult> {
  const { sheet, sources, pieces, placedPieces, layers, exportSettings } = project
  const exportSemantics = getCutterExportSemantics(exportSettings)
  const pieceMap = new Map(pieces.map((piece) => [piece.id, piece]))
  const sourceMap = new Map(sources.map((source) => [source.id, source]))
  const symbolDefinitions = new Map<string, string>()
  const artworkEntries =
    exportSettings.includeArtwork && layers.artwork
      ? await Promise.all(
          placedPieces.map(async (placed) => {
            const piece = pieceMap.get(placed.presetId)
            const artwork = piece ? getArtworkObject(piece) : undefined
            const source = artwork
              ? sourceMap.get(artwork.sourceId ?? piece?.sourceId ?? '')
              : undefined
            if (
              !piece ||
              !artwork ||
              !artwork.visible ||
              artwork.exportEnabled === false ||
              !source
            ) {
              return { definition: '', artwork: '' }
            }

            const artworkRectCm = getPlacedObjectRect(placed, piece, artwork)
            const artworkRect = scaleRectToMm(artworkRectCm)
            const mask = getActiveMaskObject(piece)
            const clippingEnabled = Boolean(piece.clippingMaskEnabled && mask)
            const clipId = `clip-piece-${safeXmlId(placed.id)}`
            const definition =
              clippingEnabled && mask
                ? getMaskClipPathMarkup(
                    clipId,
                    scaleRectToMm(getPlacedObjectRect(placed, piece, mask)),
                    mask
                  )
                : ''
            const clipAttribute = clippingEnabled ? ` clip-path="url(#${clipId})"` : ''
            const href = await sourceToSvgArtworkDataUrl(source, {
              widthCm: artworkRectCm.widthCm,
              heightCm: artworkRectCm.heightCm
            })
            const symbolId = `source-${safeXmlId(source.id)}`
            if (reuseArtworkSymbols && !symbolDefinitions.has(source.id)) {
              symbolDefinitions.set(
                source.id,
                `<symbol id="${symbolId}" viewBox="0 0 1 1" preserveAspectRatio="none"><image xlink:href="${href}" x="0" y="0" width="1" height="1" preserveAspectRatio="none" /></symbol>`
              )
            }

            return {
              definition,
              artwork: [
                `<g id="artwork-${safeXmlId(placed.id)}" data-piece="${escapeXml(piece.displayName)}"${clipAttribute}>`,
                `<${reuseArtworkSymbols ? 'use' : 'image'} xlink:href="${reuseArtworkSymbols ? '#' + symbolId : href}" x="${formatNumber(artworkRect.xCm)}" y="${formatNumber(artworkRect.yCm)}" width="${formatNumber(artworkRect.widthCm)}" height="${formatNumber(artworkRect.heightCm)}" preserveAspectRatio="none"${getRotationTransform(artworkRect)} />`,
                '</g>'
              ].join('')
            }
          })
        )
      : []

  const cutlineMarkup =
    exportSemantics.contourRenderKind !== 'none'
      ? placedPieces
          .flatMap((placed) => {
            const piece = pieceMap.get(placed.presetId)
            if (!piece) return []
            return piece.objects
              .filter((object) => object.role === 'cutline' && object.exportEnabled !== false)
              .map((object) =>
                getCutlineSvgElementMm(
                  scaleRectToMm(getPlacedObjectRect(placed, piece, object, object.offsetMm ?? 0)),
                  object,
                  placed.id,
                  exportSemantics.contourRenderKind
                )
              )
          })
          .join('\n')
      : ''
  const artworkRegistrationMarkup = shouldIncludeRegistrationInArtwork(project)
    ? getRegistrationMarksSvgMarkup(project)
    : ''
  const registrationLayerMarkup = shouldIncludeRegistrationLayer(project)
    ? getRegistrationMarksSvgMarkup(project)
    : ''
  const productionLabelMarkup = getProductionLabelSvgMarkup(project)
  const contourGroupMarkup = getContourGroupMarkup(
    cutlineMarkup,
    exportSemantics.contourRenderKind,
    layers.cutlines
  )

  const widthMm = sheet.widthCm * CM_TO_MM
  const heightMm = sheet.heightCm * CM_TO_MM
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${formatNumber(widthMm)}mm" height="${formatNumber(heightMm)}mm" viewBox="0 0 ${formatNumber(widthMm)} ${formatNumber(heightMm)}">
  <title>Cutter Montage ${sheet.widthCm}x${sheet.heightCm}cm</title>
  <desc>${getExportDescription(project, exportSemantics.intent)}</desc>
  <defs>
${Array.from(symbolDefinitions.values()).join('\n')}
${artworkEntries
  .map((entry) => entry.definition)
  .filter(Boolean)
  .join('\n')}
  </defs>
  ${
    exportSettings.includeArtwork
      ? `<g id="Artwork" inkscape:groupmode="layer" inkscape:label="Artwork" data-layer-visible="${layers.artwork}">
${artworkEntries
  .map((entry) => entry.artwork)
  .filter(Boolean)
  .join('\n')}
${artworkRegistrationMarkup}
${productionLabelMarkup}
  </g>`
      : ''
  }
  ${
    registrationLayerMarkup
      ? `<g id="RegistrationMarks" inkscape:groupmode="layer" inkscape:label="Registration Marks">
${registrationLayerMarkup}
  </g>`
      : ''
  }
  ${contourGroupMarkup}
</svg>`

  return {
    blob: new Blob([svg], { type: 'image/svg+xml' }),
    fileName: getCutterFileName(sheet.widthCm, sheet.heightCm, 'svg')
  }
}

export function getCutterFileName(widthCm: number, heightCm: number, extension: string): string {
  return `cutter_montage_${formatNameNumber(widthCm)}x${formatNameNumber(heightCm)}cm.${extension}`
}

function getArtworkObject(piece: PiecePreset): EditorObject | undefined {
  return (
    piece.objects.find((object) => object.id === piece.artworkObjectId) ??
    piece.objects.find((object) => object.role === 'artwork')
  )
}

function getActiveMaskObject(piece: PiecePreset): EditorObject | undefined {
  if (!piece.clippingMaskEnabled) return undefined
  return (
    piece.objects.find((object) => object.id === piece.maskObjectId) ??
    piece.objects.find((object) => object.role === 'clipping-mask')
  )
}

function getPlacedObjectRect(
  placed: PlacedPiece,
  piece: PiecePreset,
  object: EditorObject,
  _offsetMm = 0
): CutlineRect {
  return getPlacedEditorObjectRect(placed, piece, object)
}

function getCutlineSvgElementMm(
  rect: CutlineRect,
  object: EditorObject,
  placedId: string,
  renderKind: CutterContourRenderKind
): string {
  if (renderKind === 'none') return ''

  const isProductionContour = renderKind === 'production'
  const strokeColor = isProductionContour ? CUT_CONTOUR_COLOR : CUSTOMER_PREVIEW_CONTOUR_COLOR
  const strokeWidth = object.strokeWidthPt ?? 0.25
  const identity = isProductionContour
    ? `id="CutContour-${safeXmlId(placedId)}-${safeXmlId(object.id)}" class="${CUT_CONTOUR_NAME}" data-production="true" data-spot-name="${CUT_CONTOUR_NAME}" data-spot-color="${CUT_CONTOUR_COLOR}"`
    : `id="CustomerPreviewContour-${safeXmlId(placedId)}-${safeXmlId(object.id)}" class="CustomerPreviewContour" data-production="false" data-preview-only="true" data-preview-label="${escapeXml(CUSTOMER_PREVIEW_CONTOUR_LABEL)}"`
  const dash = isProductionContour ? '' : ` stroke-dasharray="${CUSTOMER_PREVIEW_CONTOUR_DASH}"`
  const common = `${identity} data-object-id="${safeXmlId(object.id)}" fill="none" stroke="${escapeXml(strokeColor)}" stroke-width="${formatNumber(strokeWidth)}pt"${dash} vector-effect="non-scaling-stroke"`
  const rotation = getRotationTransform(rect)

  if (object.shapeType === 'ellipse') {
    return `<ellipse cx="${formatNumber(rect.xCm + rect.widthCm / 2)}" cy="${formatNumber(rect.yCm + rect.heightCm / 2)}" rx="${formatNumber(rect.widthCm / 2)}" ry="${formatNumber(rect.heightCm / 2)}"${rotation} ${common} />`
  }
  if (object.shapeType === 'rounded-rectangle') {
    const radius = Math.min(rect.widthCm, rect.heightCm) * 0.08
    return `<rect x="${formatNumber(rect.xCm)}" y="${formatNumber(rect.yCm)}" width="${formatNumber(rect.widthCm)}" height="${formatNumber(rect.heightCm)}" rx="${formatNumber(radius)}" ry="${formatNumber(radius)}"${rotation} ${common} />`
  }
  if (object.shapeType === 'path' && object.pathData) {
    const transform = getNormalizedPathTransform(rect)
    return `<path d="${escapeXml(object.pathData)}" transform="${transform}" ${common} />`
  }
  return `<rect x="${formatNumber(rect.xCm)}" y="${formatNumber(rect.yCm)}" width="${formatNumber(rect.widthCm)}" height="${formatNumber(rect.heightCm)}"${rotation} ${common} />`
}

function getContourGroupMarkup(
  cutlineMarkup: string,
  renderKind: CutterContourRenderKind,
  layerVisible: boolean
): string {
  if (renderKind === 'none') return ''

  if (renderKind === 'preview') {
    return `<g id="CustomerPreviewContour" inkscape:groupmode="layer" inkscape:label="${escapeXml(CUSTOMER_PREVIEW_CONTOUR_LABEL)}" data-preview-only="true" data-production="false" data-layer-visible="${layerVisible}">
${cutlineMarkup}
  </g>`
  }

  return `<g id="CutContour" inkscape:groupmode="layer" inkscape:label="${CUT_CONTOUR_NAME}" data-production="true" data-spot-name="${CUT_CONTOUR_NAME}" data-layer-visible="${layerVisible}">
${cutlineMarkup}
  </g>`
}

function getExportDescription(
  project: CutterProject,
  intent: ReturnType<typeof getCutterExportSemantics>['intent']
): string {
  const preset = escapeXml(project.exportSettings.preset ?? 'svg-illustrator')
  const target = escapeXml(project.productionInfo?.targetCutterLabel ?? 'Mimaki CG-130AR')
  const sheet = `Sheet ${project.sheet.widthCm} x ${project.sheet.heightCm} cm.`

  if (intent === 'print-only') {
    return `Print-only artwork export. ${sheet} Registration content is optional; no visible CutContour preview is included.`
  }

  if (intent === 'customer-preview') {
    return `Customer preview only. ${sheet} The orange dashed contour is visual guidance and must not be used as production CutContour.`
  }

  return `Offline Mimaki production export. ${sheet} Preset ${preset}. Target ${target}. The app adds Mimaki Type 1 registration marks; canonical ${CUT_CONTOUR_NAME} geometry stays in its own knife layer.`
}

function getMaskClipPathMarkup(id: string, rect: CutlineRect, mask: EditorObject): string {
  const transform = getRotationTransform(rect)
  if (mask.shapeType === 'ellipse') {
    return `<clipPath id="${id}" clipPathUnits="userSpaceOnUse"><ellipse cx="${formatNumber(rect.xCm + rect.widthCm / 2)}" cy="${formatNumber(rect.yCm + rect.heightCm / 2)}" rx="${formatNumber(rect.widthCm / 2)}" ry="${formatNumber(rect.heightCm / 2)}"${transform} /></clipPath>`
  }
  if (mask.shapeType === 'rounded-rectangle') {
    const radius = Math.min(rect.widthCm, rect.heightCm) * 0.08
    return `<clipPath id="${id}" clipPathUnits="userSpaceOnUse"><rect x="${formatNumber(rect.xCm)}" y="${formatNumber(rect.yCm)}" width="${formatNumber(rect.widthCm)}" height="${formatNumber(rect.heightCm)}" rx="${formatNumber(radius)}" ry="${formatNumber(radius)}"${transform} /></clipPath>`
  }
  if (mask.shapeType === 'path' && mask.pathData) {
    return `<clipPath id="${id}" clipPathUnits="userSpaceOnUse"><path d="${escapeXml(mask.pathData)}" transform="${getNormalizedPathTransform(rect)}" /></clipPath>`
  }
  return `<clipPath id="${id}" clipPathUnits="userSpaceOnUse"><rect x="${formatNumber(rect.xCm)}" y="${formatNumber(rect.yCm)}" width="${formatNumber(rect.widthCm)}" height="${formatNumber(rect.heightCm)}"${transform} /></clipPath>`
}

function scaleRectToMm(rect: CutlineRect): CutlineRect {
  return {
    ...rect,
    xCm: rect.xCm * CM_TO_MM,
    yCm: rect.yCm * CM_TO_MM,
    widthCm: rect.widthCm * CM_TO_MM,
    heightCm: rect.heightCm * CM_TO_MM
  }
}

function getRotationTransform(rect: CutlineRect): string {
  return rect.rotation
    ? ` transform="rotate(${formatNumber(rect.rotation)} ${formatNumber(rect.xCm + rect.widthCm / 2)} ${formatNumber(rect.yCm + rect.heightCm / 2)})"`
    : ''
}

function getNormalizedPathTransform(rect: CutlineRect): string {
  const translateAndScale = `translate(${formatNumber(rect.xCm)} ${formatNumber(rect.yCm)}) scale(${formatNumber(rect.widthCm)} ${formatNumber(rect.heightCm)})`

  if (!rect.rotation) return translateAndScale

  const centerX = rect.xCm + rect.widthCm / 2
  const centerY = rect.yCm + rect.heightCm / 2

  return `rotate(${formatNumber(rect.rotation)} ${formatNumber(centerX)} ${formatNumber(centerY)}) ${translateAndScale}`
}

function safeXmlId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-')
}

function formatNumber(value: number): string {
  return Number(value.toFixed(4)).toString()
}

function formatNameNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace('.', '-')
}
