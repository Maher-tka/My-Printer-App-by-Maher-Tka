/// <reference types="node" />

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEFAULT_CUTTER_SHEET } from '../tools/cutter-montage/lib/cutterLayout'
import {
  createPiecePresetFromSource,
  createPlacedPieceFromPreset
} from '../tools/cutter-montage/lib/piecePresets'
import type { BookletPage, BookletSource } from '../tools/booklet-montage/types'
import type { PieceSourceFile } from '../tools/cutter-montage/types'
import { getBookletProjectStateKey, getCutterProjectStateKey } from './projectDirtyState'
import {
  createBookletProjectFile,
  createCutterProjectFile,
  deserializeBookletProjectPayload,
  deserializeCutterProjectPayload,
  getSuggestedProjectFileName,
  isPrinterProjectFile
} from './projectFiles'

const bookletSource: BookletSource = {
  id: 'booklet-source-1',
  kind: 'pdf',
  name: 'Thesis.pdf',
  mimeType: 'application/pdf',
  bytes: new Uint8Array([1, 2, 3, 254]),
  pageCount: 1
}
const bookletPage: BookletPage = {
  id: 'booklet-page-1',
  kind: 'pdf',
  sourceType: 'pdf',
  sourceId: bookletSource.id,
  sourceName: bookletSource.name,
  sourceFileName: bookletSource.name,
  sourcePageIndex: 0,
  originalPageNumber: 1,
  currentOrderIndex: 0,
  originalOrderIndex: 0,
  importBatchId: 'batch-1',
  importBatchIndex: 0,
  label: 'Page 1',
  displayName: 'Page 1',
  thumbnailUrl: 'blob:temporary-thumbnail',
  widthMm: 210,
  heightMm: 297
}
const bookletFile = createBookletProjectFile({
  sources: [bookletSource],
  pages: [bookletPage],
  settings: {
    paperSize: 'A4',
    orientation: 'landscape',
    outputMode: 'front-back-pairs',
    customWidthMm: 297,
    customHeightMm: 210,
    scaleMode: 'fit',
    readingDirection: 'rtl',
    cropMarks: true,
    registrationMarks: false,
    exportQuality: 'standard'
  },
  sheetBoardState: { items: [], recentColors: ['#ffffff'] }
})
const parsedBooklet = JSON.parse(JSON.stringify(bookletFile)) as unknown

expectEqual(isPrinterProjectFile(parsedBooklet), true, 'booklet project validation')
const restoredBooklet = deserializeBookletProjectPayload(bookletFile.payload)
expectEqual([...restoredBooklet.sources[0].bytes], [1, 2, 3, 254], 'booklet source bytes')
expectEqual(restoredBooklet.pages[0].thumbnailUrl, undefined, 'temporary thumbnail omitted')
expectEqual(restoredBooklet.settings.readingDirection, 'rtl', 'booklet reading direction')
expectEqual(bookletFile.metadata.tool, 'booklet-montage', 'booklet metadata tool')
const bookletStateKey = getBookletProjectStateKey({
  sources: [bookletSource],
  pages: [bookletPage],
  settings: bookletFile.payload.settings,
  sheetBoardState: bookletFile.payload.sheetBoardState
})
expectEqual(
  getBookletProjectStateKey({
    ...restoredBooklet,
    pages: restoredBooklet.pages.map((page) => ({
      ...page,
      thumbnailUrl: 'blob:new-session-thumbnail'
    }))
  }),
  bookletStateKey,
  'booklet dirty state survives save/open and ignores temporary previews'
)
expectNotEqual(
  getBookletProjectStateKey({
    ...restoredBooklet,
    settings: { ...restoredBooklet.settings, cropMarks: false }
  }),
  bookletStateKey,
  'booklet setting edit marks project dirty'
)

const cutterSource: PieceSourceFile = {
  id: 'cutter-source-1',
  fileName: 'Sticker.png',
  displayName: 'Sticker',
  mimeType: 'image/png',
  bytes: new Uint8Array([137, 80, 78, 71]),
  previewUrl: 'blob:temporary-cutter-preview',
  naturalWidthPx: 800,
  naturalHeightPx: 600
}
const cutterPiece = createPiecePresetFromSource(cutterSource, [])
const placedPiece = createPlacedPieceFromPreset(cutterPiece, 2, 3)
const cutterFile = createCutterProjectFile({
  mode: 'montage-sheet',
  activePieceId: cutterPiece.id,
  selectedPlacedIds: [placedPiece.id],
  selectedEditorObjects: ['artwork', 'cutline'],
  keyObject: { object: 'cutline' },
  sheet: DEFAULT_CUTTER_SHEET,
  sources: [cutterSource],
  pieces: [cutterPiece],
  placedPieces: [placedPiece],
  layers: { artwork: true, cutlines: true },
  exportSettings: {
    strokeName: 'CutContour',
    includeArtwork: true,
    includeCutlines: true
  }
})
const parsedCutter = JSON.parse(JSON.stringify(cutterFile)) as unknown

expectEqual(isPrinterProjectFile(parsedCutter), true, 'cutter project validation')
const restoredCutter = deserializeCutterProjectPayload(cutterFile.payload)
expectEqual([...restoredCutter.sources[0].bytes], [137, 80, 78, 71], 'cutter source bytes')
expectEqual(restoredCutter.mode, 'montage-sheet', 'cutter mode')
expectEqual(
  restoredCutter.pieces[0].previewUrl,
  restoredCutter.sources[0].previewUrl,
  'cutter preview reconnected'
)
expectEqual(restoredCutter.selectedPlacedIds, [placedPiece.id], 'cutter selection')
expectEqual(cutterFile.metadata.tool, 'cutter-montage', 'cutter metadata tool')
const cutterStateKey = getCutterProjectStateKey({
  sources: [cutterSource],
  pieces: [cutterPiece],
  placedPieces: [placedPiece],
  sheet: cutterFile.payload.sheet,
  layers: cutterFile.payload.layers
})
expectEqual(
  getCutterProjectStateKey({
    sources: restoredCutter.sources,
    pieces: restoredCutter.pieces,
    placedPieces: restoredCutter.placedPieces,
    sheet: restoredCutter.sheet,
    layers: restoredCutter.layers
  }),
  cutterStateKey,
  'cutter dirty state survives save/open and ignores temporary previews'
)
expectNotEqual(
  getCutterProjectStateKey({
    sources: restoredCutter.sources,
    pieces: restoredCutter.pieces,
    placedPieces: restoredCutter.placedPieces.map((piece) => ({
      ...piece,
      xCm: piece.xCm + 1
    })),
    sheet: restoredCutter.sheet,
    layers: restoredCutter.layers
  }),
  cutterStateKey,
  'cutter layout edit marks project dirty'
)
URL.revokeObjectURL(restoredCutter.sources[0].previewUrl)

expectEqual(
  getSuggestedProjectFileName('Client: Job/01'),
  'Client- Job-01.mpjob',
  'safe suggested file name'
)

const temporaryProjectFolder = await mkdtemp(join(tmpdir(), 'my-printer-app-projects-'))

try {
  const bookletPath = join(temporaryProjectFolder, 'booklet-round-trip.mpjob')
  const cutterPath = join(temporaryProjectFolder, 'cutter-round-trip.mpjob')

  await Promise.all([
    writeFile(bookletPath, JSON.stringify(bookletFile), 'utf8'),
    writeFile(cutterPath, JSON.stringify(cutterFile), 'utf8')
  ])

  const [bookletFromDisk, cutterFromDisk] = await Promise.all([
    readFile(bookletPath, 'utf8').then((contents) => JSON.parse(contents) as unknown),
    readFile(cutterPath, 'utf8').then((contents) => JSON.parse(contents) as unknown)
  ])

  expectEqual(isPrinterProjectFile(bookletFromDisk), true, 'booklet .mpjob disk validation')
  expectEqual(isPrinterProjectFile(cutterFromDisk), true, 'cutter .mpjob disk validation')

  if (!isPrinterProjectFile(bookletFromDisk) || !isPrinterProjectFile(cutterFromDisk)) {
    throw new Error('Temporary .mpjob files did not pass project validation.')
  }

  expectEqual(
    [
      ...deserializeBookletProjectPayload(bookletFromDisk.payload as typeof bookletFile.payload)
        .sources[0].bytes
    ],
    [1, 2, 3, 254],
    'booklet .mpjob restores source bytes from disk'
  )
  const cutterFromDiskState = deserializeCutterProjectPayload(
    cutterFromDisk.payload as typeof cutterFile.payload
  )
  expectEqual(
    [...cutterFromDiskState.sources[0].bytes],
    [137, 80, 78, 71],
    'cutter .mpjob restores source bytes from disk'
  )
  URL.revokeObjectURL(cutterFromDiskState.sources[0].previewUrl)
} finally {
  await rm(temporaryProjectFolder, { recursive: true, force: true })
}

console.log('Project file tests passed: booklet and cutter .mpjob memory and disk round trips.')

function expectEqual(actual: unknown, expected: unknown, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

function expectNotEqual(actual: unknown, expected: unknown, label: string): void {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    throw new Error(`${label}: expected values to differ`)
  }
}
