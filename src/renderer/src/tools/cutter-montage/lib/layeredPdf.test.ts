import { exportCutterSvg } from './svgExport'
import { exportCutterEps } from './epsExport'
import { getPieceProductionFootprint, getPlacedProductionBounds } from './cutlineGenerator'
import { strict as assert } from 'node:assert'
import { mkdirSync, writeFileSync } from 'node:fs'
import { PDFDocument, PDFDict, PDFName, PDFArray, PDFRawStream, decodePDFRawStream } from 'pdf-lib'
import { createPiecePresetFromSource, createPlacedPieceFromPreset } from './piecePresets'
import { createCutlineFromArtworkBounds } from './cutlineValidation'
import { objectPath } from './pdfProductionLayers'
import { syncLegacyFieldsFromObjects } from './pieceModelSync'
import { exportCutterPdf } from './pdfCutExport'
import { DEFAULT_CUTTER_SHEET } from './cutterLayout'
import { getDefaultCutterExportSettings } from './exportPresets'
import type { CutterProject, PieceSourceFile } from '../types'

async function run() {
  const source: PieceSourceFile = {
    id: 'proof',
    fileName: 'proof.png',
    displayName: 'Proof',
    sourceKind: 'image',
    mimeType: 'image/png',
    bytes: new Uint8Array(
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAIAAAD/gAIDAAABBUlEQVR4nO3bMQ3DQBBFwUtkHsaSMlCM0KUxGEKQOBTyKl+kGQSrp9/u4zq3MZ91f435PO8+4J+IFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBUsc/6Mft7HmI9lBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgVijd99AQbZBxrEIxcIAAAAAElFTkSuQmCC',
        'base64'
      )
    ),
    previewUrl: '',
    naturalWidthPx: 100,
    naturalHeightPx: 100
  }
  const initial = createCutlineFromArtworkBounds(createPiecePresetFromSource(source, []))
  const contour = initial.objects.find((o) => o.role === 'cutline')!
  const piece = syncLegacyFieldsFromObjects({
    ...initial,
    clippingMaskEnabled: true,
    maskWorkflowVersion: 3,
    maskObjectId: 'mask-proof',
    objects: [
      ...initial.objects,
      {
        ...contour,
        id: 'mask-proof',
        type: 'mask',
        role: 'clipping-mask',
        shapeType: 'ellipse',
        exportEnabled: false,
        transform: { ...contour.transform, widthCm: 3, heightCm: 2, rotation: 25 }
      },
      {
        ...contour,
        id: 'custom',
        shapeType: 'path' as const,
        pathData: 'M 0 0 L 1 0 L .5 1 Z',
        visible: false,
        transform: { ...contour.transform, xCm: 1, yCm: 1, rotation: 25 }
      }
    ]
  })
  const project: CutterProject = {
    sheet: { ...DEFAULT_CUTTER_SHEET, widthCm: 20, heightCm: 20 },
    sources: [source],
    pieces: [piece],
    placedPieces: [createPlacedPieceFromPreset(piece, 5, 5)],
    layers: { artwork: true, cutlines: false },
    exportSettings: getDefaultCutterExportSettings()
  }
  const bytes = new Uint8Array(await (await exportCutterPdf(project)).blob.arrayBuffer())
  const pdf = await PDFDocument.load(bytes)
  const properties = pdf.catalog.lookup(PDFName.of('OCProperties'), PDFDict)
  const groups = properties.lookup(PDFName.of('OCGs'), PDFArray)
  assert.equal(groups.size(), 3)
  const cutRef = groups.get(1)
  const cut = groups.lookup(1, PDFDict)
  assert.equal(cut.get(PDFName.of('Name'))?.toString(), '(CutContour)')
  const defaults = properties.lookup(PDFName.of('D'), PDFDict)
  assert.equal(defaults.lookup(PDFName.of('OFF'), PDFArray).get(0).toString(), cutRef.toString())
  assert.equal(
    cut
      .lookup(PDFName.of('Usage'), PDFDict)
      .lookup(PDFName.of('Print'), PDFDict)
      .get(PDFName.of('PrintState'))
      ?.toString(),
    '/OFF'
  )
  const page = pdf.getPage(0)
  const streams = page.node.Contents() as PDFArray
  const content = Array.from({ length: streams.size() }, (_, i) =>
    new TextDecoder().decode(decodePDFRawStream(streams.lookup(i, PDFRawStream)).decode())
  ).join('')
  assert.equal(
    (content.match(/\/CutContour CS/g) ?? []).length,
    2,
    'hidden editor contours remain in the PDF'
  )
  assert.match(content, /0\.25 w/, 'quarter point stroke retained')
  assert.match(content, /[0-9] [0-9.]+ l/, 'custom path remains vector geometry')
  assert.match(
    page.node.Resources()!.lookup(PDFName.of('ColorSpace'), PDFDict).toString(),
    /\/Separation \/CutContour \/DeviceCMYK/
  )
  mkdirSync('tmp/pdfs/layered-cutter', { recursive: true })
  writeFileSync('tmp/pdfs/layered-cutter/print.pdf', bytes)
  defaults.set(PDFName.of('ON'), pdf.context.obj(groups.asArray()))
  defaults.set(PDFName.of('OFF'), pdf.context.obj([]))
  writeFileSync('tmp/pdfs/layered-cutter/cut-visible.pdf', await pdf.save())
  const printOnly = await PDFDocument.load(
    await (
      await exportCutterPdf({
        ...project,
        exportSettings: { ...project.exportSettings, mode: 'print-only' }
      })
    ).blob.arrayBuffer()
  )
  const onlyContents = printOnly.getPage(0).node.Contents() as PDFArray
  const onlyText = Array.from({ length: onlyContents.size() }, (_, i) =>
    new TextDecoder().decode(decodePDFRawStream(onlyContents.lookup(i, PDFRawStream)).decode())
  ).join('')
  assert.doesNotMatch(onlyText, /\/CutContour CS/, 'print-only explicitly omits knife paths')
  const rotated = objectPath(
    { shapeType: 'rectangle' },
    { xCm: 2, yCm: 3, widthCm: 4, heightCm: 2, rotation: 90 },
    20
  )[0]
    .toString()
    .split(' ')
  assert.ok(
    Math.abs(Number(rotated[0]) - (5 * 72) / 2.54) < 1e-8,
    'rotated path x is baked in physical points'
  )
  assert.ok(
    Math.abs(Number(rotated[1]) - (18 * 72) / 2.54) < 1e-8,
    'rotated path y is baked in physical points'
  )
  assert.match(content, /W\nn/, 'mask exports as a true clipping path')
  const visiblePiece = {
    ...piece,
    objects: piece.objects.map((object) => ({ ...object, visible: true }))
  }
  assert.deepEqual(
    getPieceProductionFootprint(piece),
    getPieceProductionFootprint(visiblePiece),
    'hiding a contour does not change the packing footprint'
  )
  assert.deepEqual(
    getPlacedProductionBounds(project.placedPieces[0], piece),
    getPlacedProductionBounds(project.placedPieces[0], visiblePiece),
    'hiding a contour does not change placed bounds'
  )
  const primaryOnly = {
    ...piece,
    objects: piece.objects.filter((object) => object.id !== 'custom')
  }
  const allBounds = getPlacedProductionBounds(project.placedPieces[0], piece)
  const primaryBounds = getPlacedProductionBounds(project.placedPieces[0], primaryOnly)
  assert.ok(
    allBounds.widthCm > primaryBounds.widthCm,
    'additional contour contributes its own geometry to bounds'
  )
  const svg = await (await exportCutterSvg(project)).blob.text()
  assert.match(svg, /data-object-id="custom"/, 'SVG retains hidden custom contour')
  const eps = await exportCutterEps(project).blob.text()
  assert.equal((eps.match(/% CutContour geometry/g) ?? []).length, 2, 'EPS retains all contours')
  assert.match(eps, /0.25 setlinewidth/)
  const spaces = page.node.Resources()!.lookup(PDFName.of('ColorSpace'), PDFDict).toString()
  assert.match(spaces, /\/Separation \/MimakiFCRM \/DeviceCMYK/)
  assert.match(spaces, /\/Separation \/MimakiFCRMDir \/DeviceCMYK/)
  assert.match(content, /\/MimakiFCRM CS/, 'registration strokes use the sample spot name')
  assert.match(content, /\/MimakiFCRMDir cs/, 'direction fill uses the sample spot name')
  console.log('Layered PDF regression checks passed.')
}
void run()
