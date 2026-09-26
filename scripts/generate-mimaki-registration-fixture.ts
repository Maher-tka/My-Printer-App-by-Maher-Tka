import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import type { CutterProject, PieceSourceFile } from '../src/renderer/src/tools/cutter-montage/types'
import { createCutlineFromArtworkBounds } from '../src/renderer/src/tools/cutter-montage/lib/cutlineValidation'
import { DEFAULT_CUTTER_SHEET } from '../src/renderer/src/tools/cutter-montage/lib/cutterLayout'
import { autoArrangePieces } from '../src/renderer/src/tools/cutter-montage/lib/nesting'
import { createPiecePresetFromSource } from '../src/renderer/src/tools/cutter-montage/lib/piecePresets'
import { exportCutterPdf } from '../src/renderer/src/tools/cutter-montage/lib/pdfCutExport'
import { exportCutterSvg } from '../src/renderer/src/tools/cutter-montage/lib/svgExport'
import { exportCutterProductionBatch } from '../src/renderer/src/tools/cutter-montage/lib/batchExport'
import { runCutterPreflight } from '../src/renderer/src/tools/cutter-montage/lib/preflight'

const outputDirectory = resolve('output', 'quality', 'mimaki-registration')
const pngBytes = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Wl7AAAAAASUVORK5CYII=',
    'base64'
  )
)
const source: PieceSourceFile = {
  id: 'mimaki-fixture-source',
  sourceKind: 'image',
  fileName: 'mimaki-fixture.png',
  displayName: 'Mimaki fixture',
  mimeType: 'image/png',
  bytes: pngBytes,
  previewUrl: `data:image/png;base64,${Buffer.from(pngBytes).toString('base64')}`,
  naturalWidthPx: 1,
  naturalHeightPx: 1
}
const basePiece = createCutlineFromArtworkBounds(createPiecePresetFromSource(source, []))
const piece = { ...basePiece, widthCm: 4, heightCm: 4, quantity: 12 }
const sheet = {
  ...DEFAULT_CUTTER_SHEET,
  widthCm: 20,
  heightCm: 30,
  lengthMode: 'fixed' as const,
  showGrid: false
}
const layout = autoArrangePieces([piece], sheet)
const project: CutterProject = {
  sheet,
  sources: [source],
  pieces: [piece],
  placedPieces: layout.placedPieces,
  layers: { artwork: true, cutlines: true },
  exportSettings: {
    strokeName: 'CutContour',
    includeArtwork: true,
    includeCutlines: false,
    includeRegistrationMarks: true,
    includeProductionLabel: false,
    mode: 'print-only',
    preset: 'pdf-print-only'
  },
  productionInfo: {
    jobName: 'Mimaki Registration Fixture',
    appName: 'My Printer App by Maher Tka',
    targetCutterProfileId: 'mimaki-cg-130ar',
    targetCutterLabel: 'Mimaki CG-130AR',
    integrationMode: 'offline-mimaki-package'
  }
}

await mkdir(outputDirectory, { recursive: true })
const pdf = await exportCutterPdf(project)
const svg = await exportCutterSvg(project)
const batch = await exportCutterProductionBatch(project, runCutterPreflight(project))
await Promise.all([
  writeFile(resolve(outputDirectory, 'mimaki-registration-fixture.pdf'), await pdf.blob.bytes()),
  writeFile(resolve(outputDirectory, 'mimaki-registration-fixture.svg'), await svg.blob.text()),
  ...batch.files.map(async (file) => {
    const filePath = resolve(outputDirectory, file.fileName)
    await mkdir(dirname(filePath), { recursive: true })
    await writeFile(filePath, await file.blob.bytes())
  })
])

console.log(`${outputDirectory}\n${batch.files.map((file) => file.fileName).join('\n')}`)
