import type { CutterProject, PieceSourceFile } from '../types'
import { DEFAULT_CUTTER_SHEET } from './cutterLayout'
import { CUT_CONTOUR_COLOR, CUT_CONTOUR_NAME } from './colorSpot'
import { createCutlineFromArtworkBounds } from './cutlineValidation'
import { exportCutterEps } from './epsExport'
import { getCutterExportSemantics } from './exportPresets'
import { createPiecePresetFromSource, createPlacedPieceFromPreset } from './piecePresets'
import { exportCutterSvg } from './svgExport'

async function run(): Promise<void> {
  const source: PieceSourceFile = {
    id: 'production-export-source',
    sourceKind: 'image',
    fileName: 'illustrator-vinyl-reference.png',
    displayName: 'illustrator-vinyl-reference',
    mimeType: 'image/png',
    bytes: new Uint8Array([0, 1, 2]),
    previewUrl: 'data:image/png;base64,AAECAw==',
    naturalWidthPx: 1000,
    naturalHeightPx: 1000
  }
  const sourcePiece = createCutlineFromArtworkBounds(createPiecePresetFromSource(source, []))
  const piece = {
    ...sourcePiece,
    cutline: {
      ...sourcePiece.cutline,
      strokeName: 'KnifeLine',
      strokeColor: '#00ff00'
    },
    objects: sourcePiece.objects.map((object) =>
      object.role === 'cutline'
        ? { ...object, strokeName: 'KnifeLine', strokeColor: '#00ff00' }
        : object
    )
  }
  const placedPiece = createPlacedPieceFromPreset(piece, 1, 1)
  const baseProject: CutterProject = {
    sheet: { ...DEFAULT_CUTTER_SHEET, widthCm: 20, heightCm: 20 },
    sources: [source],
    pieces: [piece],
    placedPieces: [placedPiece],
    layers: { artwork: true, cutlines: true },
    exportSettings: {
      strokeName: 'KnifeLine',
      includeArtwork: true,
      includeCutlines: true,
      includeRegistrationMarks: false,
      includeProductionLabel: false,
      mode: 'print-cut',
      preset: 'illustrator-print-cut-svg'
    }
  }

  const printOnlyProject: CutterProject = {
    ...baseProject,
    exportSettings: {
      ...baseProject.exportSettings,
      mode: 'print-only',
      preset: 'pdf-print-only',
      includeCutlines: true
    }
  }
  const printOnlySvg = await (await exportCutterSvg(printOnlyProject)).blob.text()
  assert(printOnlySvg.includes('<g id="Artwork"'), 'print-only keeps artwork')
  assert(!printOnlySvg.includes('<g id="CutContour"'), 'print-only has no visible CutContour group')
  assert(
    !printOnlySvg.includes('<g id="CustomerPreviewContour"'),
    'print-only has no customer preview contour'
  )
  assert(
    getCutterExportSemantics(printOnlyProject.exportSettings).contourRenderKind === 'none',
    'print-only semantics suppress contour rendering even with stale cutline flag'
  )

  const handoffSvg = await (await exportCutterSvg(baseProject)).blob.text()
  assert(handoffSvg.includes('<g id="CutContour"'), 'FineCut handoff has CutContour group')
  assert(
    handoffSvg.includes(`data-spot-name="${CUT_CONTOUR_NAME}"`),
    'FineCut handoff identifies the canonical CutContour spot'
  )
  assert(
    handoffSvg.includes(`class="${CUT_CONTOUR_NAME}"`),
    'FineCut handoff gives vector geometry the canonical CutContour class'
  )
  assert(
    handoffSvg.includes(`data-production="true"`) &&
      handoffSvg.includes(`stroke="${CUT_CONTOUR_COLOR}"`),
    'FineCut handoff marks canonical production geometry'
  )
  assert(!handoffSvg.includes('KnifeLine'), 'FineCut handoff does not leak a custom spot name')

  const previewProject: CutterProject = {
    ...baseProject,
    exportSettings: {
      ...baseProject.exportSettings,
      mode: 'customer-preview',
      preset: 'customer-preview'
    }
  }
  const previewSvg = await (await exportCutterSvg(previewProject)).blob.text()
  assert(
    previewSvg.includes('<g id="CustomerPreviewContour"'),
    'customer preview has a separate preview contour group'
  )
  assert(
    previewSvg.includes('data-preview-only="true"') &&
      previewSvg.includes('stroke-dasharray="6 3"'),
    'customer preview contour is visibly marked as non-production'
  )
  assert(
    !previewSvg.includes('<g id="CutContour"'),
    'customer preview has no production CutContour group'
  )
  assert(
    !previewSvg.includes('data-spot-name="CutContour"'),
    'preview has no production spot identity'
  )

  const eps = await (await exportCutterEps(baseProject)).blob.text()
  assert(eps.includes(`%%DocumentCustomColors: (${CUT_CONTOUR_NAME})`), 'EPS names CutContour')
  assert(eps.includes(`% ${CUT_CONTOUR_NAME} geometry`), 'EPS labels vector geometry as CutContour')
  assert(!eps.includes('KnifeLine'), 'EPS does not leak a custom spot name')

  console.log('Production export semantics tests passed.')
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

void run()
