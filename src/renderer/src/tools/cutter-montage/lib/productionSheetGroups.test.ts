import type { CutterProject, PieceSourceFile, PlacedPiece } from '../types'
import { exportCutterProductionBatch } from './batchExport'
import { createCutlineFromArtworkBounds } from './cutlineValidation'
import { DEFAULT_CUTTER_SHEET } from './cutterLayout'
import {
  createPiecePresetFromSource,
  createPlacedPieceFromPreset,
  resizePiecePreset
} from './piecePresets'
import { runCutterPreflight } from './preflight'
import {
  getProductionSheetLayoutGroups,
  getProductionSheetLayoutSignature
} from './productionSheetGroups'

const pngBytes = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Wl7AAAAAASUVORK5CYII=',
    'base64'
  )
)

async function run(): Promise<void> {
  const source: PieceSourceFile = {
    id: 'repeat-layout-source',
    sourceKind: 'image',
    fileName: 'repeat-layout.png',
    displayName: 'Repeat layout sticker',
    mimeType: 'image/png',
    bytes: pngBytes,
    previewUrl: `data:image/png;base64,${Buffer.from(pngBytes).toString('base64')}`,
    naturalWidthPx: 1,
    naturalHeightPx: 1
  }
  const piece = {
    ...resizePiecePreset(
      createCutlineFromArtworkBounds(createPiecePresetFromSource(source, [])),
      4,
      4,
      'width'
    ),
    quantity: 145
  }
  const fullSheetPlacements = createFullSheetPlacements(piece)
  const placedPieces: PlacedPiece[] = [
    ...[0, 1, 2, 3].flatMap((sheetIndex) =>
      fullSheetPlacements.map((placed, placementIndex) => ({
        ...placed,
        id: `sheet-${sheetIndex}-piece-${placementIndex}`,
        sheetIndex
      }))
    ),
    {
      ...createPlacedPieceFromPreset(piece, 4, 64),
      id: 'remainder-piece',
      sheetIndex: 4
    }
  ]
  const project: CutterProject = {
    sheet: {
      ...DEFAULT_CUTTER_SHEET,
      widthCm: 96,
      heightCm: 100,
      lengthMode: 'auto-trim-last',
      showGrid: false
    },
    sources: [source],
    pieces: [piece],
    placedPieces,
    layers: { artwork: true, cutlines: true },
    exportSettings: {
      strokeName: 'CutContour',
      includeArtwork: true,
      includeCutlines: true,
      includeRegistrationMarks: true,
      includeProductionLabel: false,
      mode: 'print-cut',
      preset: 'mimaki-cutcontour-svg'
    },
    productionInfo: {
      jobName: '145 Piece Repeat Test',
      appName: 'My Printer App by Maher Tka',
      targetCutterProfileId: 'mimaki-cg-130ar',
      targetCutterLabel: 'Mimaki CG-130AR',
      integrationMode: 'offline-mimaki-package'
    }
  }

  const groups = getProductionSheetLayoutGroups(project)
  expectEqual(groups.length, 2, 'four full sheets collapse while the remainder stays separate')
  expectEqual(groups[0]?.repeatCount, 4, 'full one-meter layout prints four times')
  expectEqual(groups[0]?.sheetIndices, [0, 1, 2, 3], 'collapsed physical sheet numbers')
  expectEqual(groups[0]?.copiesPerSheet, 36, 'full layout piece count')
  expectEqual(groups[0]?.totalCopies, 144, 'full layout total across repetitions')
  expectEqual(groups[0]?.heightCm, 100, 'full layout keeps one-meter material length')
  expectEqual(groups[1]?.repeatCount, 1, 'remainder layout prints once')
  expectEqual(groups[1]?.copiesPerSheet, 1, 'remainder carries the final sticker')
  expectEqual(groups[1]?.heightCm, 69.5, 'remainder trims without an implicit cut border')

  const firstPhysicalSheet = {
    ...project,
    placedPieces: fullSheetPlacements.map((placed, index) => ({
      ...placed,
      id: `first-${index}`,
      sheetIndex: 0
    }))
  }
  const sameGeometryWithNewRuntimeIds = {
    ...project,
    placedPieces: fullSheetPlacements.map((placed, index) => ({
      ...placed,
      id: `different-runtime-id-${index}`,
      sheetIndex: 99
    }))
  }
  expectEqual(
    getProductionSheetLayoutSignature(firstPhysicalSheet),
    getProductionSheetLayoutSignature(sameGeometryWithNewRuntimeIds),
    'runtime ids and physical sheet numbers do not prevent exact collapsing'
  )

  const changedRotation = {
    ...project,
    placedPieces: project.placedPieces.map((placed) =>
      placed.id === 'sheet-2-piece-0' ? { ...placed, rotation: 90 as const } : placed
    )
  }
  expectEqual(
    getProductionSheetLayoutGroups(changedRotation).length,
    3,
    'a changed output geometry remains a separate layout'
  )

  const batch = await exportCutterProductionBatch(project, runCutterPreflight(project))
  expectEqual(batch.files.length, 14, 'two unique layouts produce two file sets plus job metadata')
  expect(
    batch.files.some((file) => file.fileName.endsWith('01_Mimaki_Marked_Print_Layout_01_x4.pdf')),
    'full-layout print filename carries the four-copy instruction'
  )
  expect(
    batch.files.some((file) => file.fileName.endsWith('01_Mimaki_Marked_Print_Layout_02_x1.pdf')),
    'remainder print filename carries its one-copy instruction'
  )
  expect(
    batch.files.some((file) =>
      file.fileName.endsWith('03_CutOnly_CutContour_Layout_01_RUN_4_CUT_PASSES.svg')
    ),
    'cut filename carries the matching four-pass instruction'
  )

  const manifestFile = batch.files.find((file) =>
    file.fileName.endsWith('mimaki_job_manifest.json')
  )
  expect(manifestFile, 'batch includes a repeat-aware manifest')
  const manifest = JSON.parse(await manifestFile.blob.text()) as {
    sheets: Array<{
      printCopies: number
      cutPasses: number
      sourceSheetNumbers: number[]
      totalCopies: number
    }>
  }
  expectEqual(manifest.sheets.length, 2, 'manifest contains only unique layouts')
  expectEqual(manifest.sheets[0]?.printCopies, 4, 'manifest print repetition')
  expectEqual(manifest.sheets[0]?.cutPasses, 4, 'manifest cut repetition')
  expectEqual(manifest.sheets[0]?.sourceSheetNumbers, [1, 2, 3, 4], 'manifest physical sheets')
  expectEqual(manifest.sheets[0]?.totalCopies, 144, 'manifest repeated piece total')

  const notesFile = batch.files.find((file) => file.fileName.endsWith('production_notes.txt'))
  expect(notesFile, 'batch includes production notes')
  const notes = await notesFile.blob.text()
  expect(
    notes.includes('Layout 1: print 4 copies and run 4 cut passes'),
    'notes explain repetitions'
  )
  expect(notes.includes('Layout 2: print 1 copy and run 1 cut pass'), 'notes explain remainder')

  console.log('Production sheet repeat grouping tests passed.')
}

function createFullSheetPlacements(piece: ReturnType<typeof resizePiecePreset>): PlacedPiece[] {
  const placements: PlacedPiece[] = []

  for (let row = 0; row < 6; row += 1) {
    for (let column = 0; column < 6; column += 1) {
      placements.push(createPlacedPieceFromPreset(piece, 4 + column * 5, 4 + row * 5))
    }
  }

  return placements
}

function expect(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(label)
}

function expectEqual(actual: unknown, expected: unknown, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

void run()
