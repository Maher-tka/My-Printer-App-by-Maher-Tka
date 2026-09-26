import {
  PDFDocument,
  fill,
  setLineJoin,
  setLineCap,
  PDFOperator,
  PDFOperatorNames,
  PDFNumber,
  setLineWidth,
  stroke,
  setStrokingRgbColor,
  setDashPattern,
  StandardFonts,
  appendBezierCurve,
  clip,
  closePath,
  degrees,
  endPath,
  lineTo,
  moveTo,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  rgb,
  rotateDegrees,
  translate
} from 'pdf-lib'
import type {
  CutterExportResult,
  CutterProject,
  PiecePreset,
  PieceSourceFile,
  PlacedPiece
} from '../types'
import { getPlacedArtworkRect, getPlacedEditorObjectRect } from './cutlineGenerator'
import {
  beginPdfLayer,
  endPdfLayer,
  createProductionLayers,
  installCutSpot,
  cutSpotOperators,
  registrationSpotOperators,
  objectPath
} from './pdfProductionLayers'
import { getPlacedMaskRect } from './maskUtils'
import { getProductionLabelLayout } from './productionLabel'
import { getProductionSheetLayoutGroups } from './productionSheetGroups'
import { getProductionSheetCount, getProductionSheetProject } from './productionSheets'
import { rasterizeSourceForPdf } from './rasterizeArtwork'
import { getRegistrationMarks } from './registrationMarks'
import { getCutterExportSemantics } from './exportPresets'
import { cmToPoints, mmToPoints } from './units'
import { getCutterFileName } from './svgExport'

export async function exportCutterPdf(project: CutterProject): Promise<CutterExportResult> {
  const pdf = await PDFDocument.create()
  const semantics = getCutterExportSemantics(project.exportSettings)
  const pdfLayers = createProductionLayers(pdf, semantics.isCustomerPreview)
  const pieceMap = new Map(project.pieces.map((piece) => [piece.id, piece]))
  const sourceMap = new Map(project.sources.map((source) => [source.id, source]))
  const physicalSheetCount = getProductionSheetCount(project.placedPieces)
  const layoutGroups = getProductionSheetLayoutGroups(project)

  pdf.setTitle('Cutter montage - unique production layouts')
  pdf.setSubject(
    layoutGroups
      .map(
        (group, layoutIndex) =>
          `Layout ${layoutIndex + 1}: print ${group.repeatCount} cop${group.repeatCount === 1 ? 'y' : 'ies'}`
      )
      .join('; ')
  )

  for (const group of layoutGroups) {
    const sheetProject = getProductionSheetProject(project, group.templateSheetIndex)
    const page = pdf.addPage([
      cmToPoints(sheetProject.sheet.widthCm),
      cmToPoints(sheetProject.sheet.heightCm)
    ])

    installCutSpot(pdf, page)
    beginPdfLayer(page, pdfLayers.artwork)
    page.drawRectangle({
      x: 0,
      y: 0,
      width: cmToPoints(sheetProject.sheet.widthCm),
      height: cmToPoints(sheetProject.sheet.heightCm),
      color: rgb(1, 1, 1)
    })

    if (sheetProject.layers.artwork && sheetProject.exportSettings.includeArtwork) {
      for (const placed of sheetProject.placedPieces) {
        const piece = pieceMap.get(placed.presetId)
        const source = piece ? sourceMap.get(piece.sourceId) : undefined

        if (piece && source && piece.objectVisibility.artwork) {
          await drawArtwork(pdf, page, source, placed, sheetProject.sheet.heightCm, piece)
        }
      }
    }

    endPdfLayer(page)
    const exportSemantics = getCutterExportSemantics(sheetProject.exportSettings)
    const contourRenderKind = exportSemantics.contourRenderKind

    beginPdfLayer(page, pdfLayers.cut)
    if (contourRenderKind !== 'none') {
      for (const placed of sheetProject.placedPieces) {
        const piece = pieceMap.get(placed.presetId)
        if (!piece) continue
        for (const object of piece.objects.filter(
          (object) => object.role === 'cutline' && object.exportEnabled !== false
        )) {
          const rect = getPlacedEditorObjectRect(placed, piece, object)
          page.pushOperators(
            pushGraphicsState(),
            ...(contourRenderKind === 'preview'
              ? [
                  setStrokingRgbColor(0.976, 0.451, 0.086),
                  setDashPattern([mmToPoints(2), mmToPoints(1)], 0)
                ]
              : cutSpotOperators()),
            setLineWidth(object.strokeWidthPt ?? 0.25),
            ...objectPath(object, rect, sheetProject.sheet.heightCm),
            stroke(),
            popGraphicsState()
          )
        }
      }
    }
    endPdfLayer(page)
    beginPdfLayer(page, pdfLayers.registration)
    if (sheetProject.exportSettings.includeRegistrationMarks !== false) {
      drawRegistrationMarks(page, sheetProject)
    }

    endPdfLayer(page)
    beginPdfLayer(page, pdfLayers.artwork)
    if (exportSemantics.isCustomerPreview) {
      const font = await pdf.embedFont(StandardFonts.HelveticaBold)
      page.drawText('CUSTOMER PREVIEW - NOT FOR PRODUCTION CUTTING', {
        x: cmToPoints(sheetProject.sheet.widthCm * 0.18),
        y: cmToPoints(sheetProject.sheet.heightCm * 0.5),
        size: 18,
        rotate: degrees(22),
        color: rgb(0.75, 0.08, 0.08),
        opacity: 0.38,
        font
      })
    }

    if (sheetProject.exportSettings.includeProductionLabel !== false) {
      await drawProductionLabel(pdf, page, sheetProject)
    }
    endPdfLayer(page)
  }

  const bytes = await pdf.save({ addDefaultPage: false, useObjectStreams: true })
  const firstSheet = getProductionSheetProject(project, 0)

  return {
    blob: new Blob([bytesToArrayBuffer(bytes)], { type: 'application/pdf' }),
    fileName:
      physicalSheetCount > 1
        ? `cutter_montage_96cm_${layoutGroups.length}_layouts_${physicalSheetCount}_prints.pdf`
        : getCutterFileName(firstSheet.sheet.widthCm, firstSheet.sheet.heightCm, 'pdf')
  }
}

function drawRegistrationMarks(page: PdfPage, project: CutterProject): void {
  for (const mark of getRegistrationMarks(project)) {
    const color = hexToRgb(mark.color)
    const x = mmToPoints(mark.xMm)
    const markHeightMm = mark.boundsCm.heightCm * 10
    const y = cmToPoints(project.sheet.heightCm) - mmToPoints(mark.yMm + markHeightMm)
    const size = mmToPoints(mark.sizeMm)
    const centerX = x + size / 2
    const centerY = y + size / 2

    if (mark.type === 'mimaki') {
      if (mark.position === 'direction') {
        const triangleHeight = mmToPoints(markHeightMm)
        page.pushOperators(
          pushGraphicsState(),
          ...registrationSpotOperators(true),
          moveTo(x + size / 2, y),
          lineTo(x, y + triangleHeight),
          lineTo(x + size, y + triangleHeight),
          closePath(),
          fill(),
          popGraphicsState()
        )
        continue
      }

      const left = mark.xMm
      const top = mark.yMm
      const right = left + mark.sizeMm
      const bottom = top + mark.sizeMm
      const [first, corner, last]: [[number, number], [number, number], [number, number]] =
        mark.position === 'top-left'
          ? [
              [left, bottom],
              [right, bottom],
              [right, top]
            ]
          : mark.position === 'top-right'
            ? [
                [right, bottom],
                [left, bottom],
                [left, top]
              ]
            : mark.position === 'bottom-left'
              ? [
                  [left, top],
                  [right, top],
                  [right, bottom]
                ]
              : [
                  [right, top],
                  [left, top],
                  [left, bottom]
                ]

      const point = (p: readonly [number, number]) =>
        [mmToPoints(p[0]), cmToPoints(project.sheet.heightCm) - mmToPoints(p[1])] as const
      page.pushOperators(
        pushGraphicsState(),
        ...registrationSpotOperators(),
        setLineWidth(mmToPoints(mark.strokeWidthMm)),
        setLineJoin(0),
        setLineCap(0),
        PDFOperator.of(PDFOperatorNames.SetLineMiterLimit, [PDFNumber.of(2)]),
        moveTo(...point(first)),
        lineTo(...point(corner)),
        lineTo(...point(last)),
        stroke(),
        popGraphicsState()
      )
      continue
    }

    if (mark.type === 'corner-square') {
      page.drawRectangle({ x, y, width: size, height: size, color })
      continue
    }

    if (mark.type === 'circle') {
      page.drawEllipse({
        x: centerX,
        y: centerY,
        xScale: size / 2,
        yScale: size / 2,
        borderColor: color,
        borderWidth: mmToPoints(0.35)
      })
      continue
    }

    page.drawLine({
      start: { x, y: centerY },
      end: { x: centerX - size / 4, y: centerY },
      color,
      thickness: mmToPoints(0.35)
    })
    page.drawLine({
      start: { x: centerX + size / 4, y: centerY },
      end: { x: x + size, y: centerY },
      color,
      thickness: mmToPoints(0.35)
    })
    page.drawLine({
      start: { x: centerX, y },
      end: { x: centerX, y: centerY - size / 4 },
      color,
      thickness: mmToPoints(0.35)
    })
    page.drawLine({
      start: { x: centerX, y: centerY + size / 4 },
      end: { x: centerX, y: y + size },
      color,
      thickness: mmToPoints(0.35)
    })
  }
}

function drawRegistrationLine(
  page: PdfPage,
  sheetHeightCm: number,
  startMm: readonly [number, number],
  endMm: readonly [number, number],
  color: ReturnType<typeof rgb>,
  thicknessMm: number
): void {
  page.drawLine({
    start: {
      x: mmToPoints(startMm[0]),
      y: cmToPoints(sheetHeightCm) - mmToPoints(startMm[1])
    },
    end: {
      x: mmToPoints(endMm[0]),
      y: cmToPoints(sheetHeightCm) - mmToPoints(endMm[1])
    },
    color,
    thickness: mmToPoints(thicknessMm)
  })
}

async function drawProductionLabel(
  pdf: PDFDocument,
  page: PdfPage,
  project: CutterProject
): Promise<void> {
  const layout = getProductionLabelLayout(project)

  if (!layout) return

  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const x = mmToPoints(layout.xMm)
  const y = cmToPoints(project.sheet.heightCm) - mmToPoints(layout.yMm + layout.heightMm)
  const lineHeight = layout.fontSizePt + 3

  page.drawRectangle({
    x,
    y,
    width: mmToPoints(layout.widthMm),
    height: mmToPoints(layout.heightMm),
    color: rgb(1, 1, 1),
    opacity: 0.86,
    borderColor: rgb(0.28, 0.33, 0.41),
    borderWidth: 0.35
  })

  layout.lines.forEach((line, index) => {
    page.drawText(line, {
      x: x + mmToPoints(2),
      y: y + mmToPoints(layout.heightMm) - 10 - index * lineHeight,
      size: layout.fontSizePt,
      color: rgb(0.06, 0.09, 0.16),
      font
    })
  })
}

async function drawArtwork(
  pdf: PDFDocument,
  page: ReturnType<PDFDocument['addPage']>,
  source: PieceSourceFile,
  placed: PlacedPiece,
  sheetHeightCm: number,
  piece: PiecePreset
): Promise<void> {
  const artworkRect = getPlacedArtworkRect(placed, piece)
  const maskRect = getPlacedMaskRect(placed, piece)
  const hasMask = piece.clippingMaskEnabled ?? piece.mask.enabled

  const rasterized = await rasterizeSourceForPdf(source, {
    widthCm: artworkRect.widthCm,
    heightCm: artworkRect.heightCm
  })
  const image =
    rasterized.mimeType === 'image/png'
      ? await pdf.embedPng(rasterized.bytes)
      : await pdf.embedJpg(rasterized.bytes)
  const pdfRect = toPdfRect(artworkRect, sheetHeightCm)

  if (hasMask) {
    const mask = piece.objects.find(
      (object) => object.id === piece.maskObjectId || object.role === 'clipping-mask'
    )
    if (mask) {
      page.pushOperators(
        pushGraphicsState(),
        ...objectPath(mask, maskRect, sheetHeightCm),
        clip(),
        endPath()
      )
    } else {
      pushMaskClip(page, maskRect, sheetHeightCm, piece.mask.shape)
    }
  }

  page.pushOperators(
    pushGraphicsState(),
    translate(pdfRect.centerX, pdfRect.centerY),
    rotateDegrees(-artworkRect.rotation)
  )
  page.drawImage(image, {
    x: -pdfRect.width / 2,
    y: -pdfRect.height / 2,
    width: pdfRect.width,
    height: pdfRect.height
  })

  page.pushOperators(popGraphicsState())
  if (hasMask) {
    page.pushOperators(popGraphicsState())
  }
}

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

type PdfPage = ReturnType<PDFDocument['addPage']>

interface RectLike {
  xCm: number
  yCm: number
  widthCm: number
  heightCm: number
  rotation: number
}

interface PdfRect {
  x: number
  y: number
  width: number
  height: number
  centerX: number
  centerY: number
}

function pushMaskClip(
  page: PdfPage,
  rect: RectLike,
  sheetHeightCm: number,
  shape: PiecePreset['mask']['shape']
): void {
  const pdfRect = toPdfRect(rect, sheetHeightCm)

  page.pushOperators(pushGraphicsState())
  if (rect.rotation) {
    page.pushOperators(
      translate(pdfRect.centerX, pdfRect.centerY),
      rotateDegrees(-rect.rotation),
      translate(-pdfRect.centerX, -pdfRect.centerY)
    )
  }

  if (shape === 'ellipse') {
    pushEllipsePath(page, pdfRect)
  } else if (shape === 'custom-polygon') {
    page.pushOperators(
      moveTo(pdfRect.centerX, pdfRect.y + pdfRect.height),
      lineTo(pdfRect.x + pdfRect.width, pdfRect.centerY),
      lineTo(pdfRect.centerX, pdfRect.y),
      lineTo(pdfRect.x, pdfRect.centerY),
      closePath()
    )
  } else {
    page.pushOperators(rectangle(pdfRect.x, pdfRect.y, pdfRect.width, pdfRect.height))
  }

  page.pushOperators(clip(), endPath())
}

function pushEllipsePath(page: PdfPage, rect: PdfRect): void {
  const kappa = 0.5522847498307936
  const rx = rect.width / 2
  const ry = rect.height / 2
  const cx = rect.centerX
  const cy = rect.centerY

  page.pushOperators(
    moveTo(cx + rx, cy),
    appendBezierCurve(cx + rx, cy + ry * kappa, cx + rx * kappa, cy + ry, cx, cy + ry),
    appendBezierCurve(cx - rx * kappa, cy + ry, cx - rx, cy + ry * kappa, cx - rx, cy),
    appendBezierCurve(cx - rx, cy - ry * kappa, cx - rx * kappa, cy - ry, cx, cy - ry),
    appendBezierCurve(cx + rx * kappa, cy - ry, cx + rx, cy - ry * kappa, cx + rx, cy),
    closePath()
  )
}

function toPdfRect(rect: RectLike, sheetHeightCm: number): PdfRect {
  const x = cmToPoints(rect.xCm)
  const y = cmToPoints(sheetHeightCm - rect.yCm - rect.heightCm)
  const width = cmToPoints(rect.widthCm)
  const height = cmToPoints(rect.heightCm)

  return {
    x,
    y,
    width,
    height,
    centerX: x + width / 2,
    centerY: y + height / 2
  }
}

function hexToRgb(value: string): ReturnType<typeof rgb> {
  const normalized = value.trim().replace('#', '')
  const full =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => `${char}${char}`)
          .join('')
      : normalized.padEnd(6, '0').slice(0, 6)
  const red = Number.parseInt(full.slice(0, 2), 16) / 255
  const green = Number.parseInt(full.slice(2, 4), 16) / 255
  const blue = Number.parseInt(full.slice(4, 6), 16) / 255

  return rgb(red, green, blue)
}
