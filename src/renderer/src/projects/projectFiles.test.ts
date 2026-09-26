import { createDefaultSequentialProject } from '../tools/sequential-number/lib/layout'
import { createSequentialProjectFile } from '../tools/sequential-number/lib/project'
/// <reference types="node" />

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEFAULT_CUTTER_SHEET } from '../tools/cutter-montage/lib/cutterLayout'
import {
  createPiecePresetFromSource,
  createPlacedPieceFromPreset
} from '../tools/cutter-montage/lib/piecePresets'
import type { BookletPage, BookletSource, SheetSettings } from '../tools/booklet-montage/types'
import { DEFAULT_CREEP_SETTINGS } from '../tools/booklet-montage/lib/creepCompensation'
import type { PieceSourceFile } from '../tools/cutter-montage/types'
import { createDefaultHardcoverProject } from '../tools/hardcover-cover/hooks/useHardcoverProject'
import {
  getBookletProjectStateKey,
  getCutterProjectStateKey,
  getHardcoverProjectStateKey
} from './projectDirtyState'
import {
  createBookletProjectFile,
  createCutterProjectFile,
  createHardcoverProjectFile,
  deserializeBookletProjectPayload,
  deserializeCutterProjectPayload,
  deserializeHardcoverProjectPayload,
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
    outerMarginMm: 0,
    pageGapMm: 0,
    cropMarks: true,
    registrationMarks: false,
    exportQuality: 'standard',
    creep: {
      ...DEFAULT_CREEP_SETTINGS,
      enabled: true,
      mode: 'measured',
      measuredTotalCreepMm: 1.2,
      paperCaliperMm: 0.115,
      calibrationMultiplier: 1.08,
      manualTotalCreepMm: 1.25,
      distribution: 'linear',
      showOverlay: true,
      selectedPaperPresetId: 'paper-1',
      paperPresets: [
        {
          id: 'paper-1',
          name: 'Configured coated stock',
          paperCaliperMm: 0.115,
          calibrationMultiplier: 1.08,
          machineName: 'Stitcher 1'
        }
      ]
    }
  },
  sheetBoardState: { items: [], recentColors: ['#ffffff'] }
})
const parsedBooklet = JSON.parse(JSON.stringify(bookletFile)) as unknown

expectEqual(isPrinterProjectFile(parsedBooklet), true, 'booklet project validation')
const restoredBooklet = deserializeBookletProjectPayload(bookletFile.payload)
expectEqual([...restoredBooklet.sources[0].bytes], [1, 2, 3, 254], 'booklet source bytes')
expectEqual(restoredBooklet.pages[0].thumbnailUrl, undefined, 'temporary thumbnail omitted')
expectEqual(restoredBooklet.settings.readingDirection, 'rtl', 'booklet reading direction')
expectEqual(restoredBooklet.settings.outerMarginMm, 0, 'booklet outer margin restored')
expectEqual(restoredBooklet.settings.pageGapMm, 0, 'booklet page gap restored')
expectEqual(restoredBooklet.settings.cropMarks, true, 'explicit old crop marks true is preserved')
expectEqual(bookletFile.metadata.tool, 'booklet-montage', 'booklet metadata tool')
expectEqual(restoredBooklet.settings.creep.enabled, true, 'booklet creep enabled state restored')
expectEqual(
  restoredBooklet.settings.creep.measuredTotalCreepMm,
  1.2,
  'booklet measured creep restored'
)
expectEqual(restoredBooklet.settings.creep.paperCaliperMm, 0.115, 'booklet caliper restored')
expectEqual(
  restoredBooklet.settings.creep.calibrationMultiplier,
  1.08,
  'booklet calibration restored'
)
expectEqual(
  restoredBooklet.settings.creep.manualTotalCreepMm,
  1.25,
  'booklet manual creep restored'
)
expectEqual(
  restoredBooklet.settings.creep.paperPresets[0]?.machineName,
  'Stitcher 1',
  'booklet paper preset and machine metadata restored'
)
const legacyBooklet = deserializeBookletProjectPayload({
  ...bookletFile.payload,
  settings: {
    paperSize: 'A4',
    orientation: 'landscape',
    outputMode: 'front-back-pairs',
    customWidthMm: 297,
    customHeightMm: 210,
    scaleMode: 'fit',
    readingDirection: 'ltr',
    exportQuality: 'standard'
  } as SheetSettings
})
expectEqual(legacyBooklet.settings.outerMarginMm, 0, 'legacy booklet outer margin defaults to zero')
expectEqual(legacyBooklet.settings.pageGapMm, 0, 'legacy booklet page gap defaults to zero')
expectEqual(legacyBooklet.settings.cropMarks, false, 'legacy booklet crop marks default off')
expectEqual(
  legacyBooklet.settings.registrationMarks,
  false,
  'legacy booklet registration marks default off'
)
expectEqual(legacyBooklet.settings.creep.enabled, false, 'legacy booklet creep defaults off')
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
const stablePreviewDataUrl = 'data:image/svg+xml;base64,PHN2Zy8+'
const stablePreviewPiece = createPiecePresetFromSource(
  {
    ...cutterSource,
    id: 'cutter-stable-preview-source-1',
    fileName: 'Stable Sticker.svg',
    mimeType: 'image/svg+xml',
    previewUrl: 'blob:revoked-cutter-preview',
    previewDataUrl: stablePreviewDataUrl
  },
  []
)
expectEqual(stablePreviewPiece.previewUrl, stablePreviewDataUrl, 'piece uses stable source preview')
expectEqual(
  stablePreviewPiece.artwork.previewUrl,
  stablePreviewDataUrl,
  'artwork uses stable source preview'
)
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
  restoredCutter.sheet.registrationMarks?.enabled,
  true,
  'cutter projects use automatic Mimaki registration marks'
)
expectEqual(
  cutterFile.payload.exportSettings.includeRegistrationMarks,
  true,
  'cutter project export keeps automatic marks enabled'
)
expectEqual(
  restoredCutter.sheet.productionLabel?.enabled,
  false,
  'legacy cutter production label default off'
)
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

const cutterPdfPreview =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAqf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/ASP/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/ASP/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/Al//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/IV//2gAMAwEAAgADAAAAEP/EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQMBAT8QH//EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQIBAT8QH//EABQQAQAAAAAAAAAAAAAAAAAAABD/2gAIAQEAAT8QH//Z'
const cutterPdfSource: PieceSourceFile = {
  id: 'cutter-pdf-source-1',
  sourceKind: 'pdf-page',
  fileName: 'stickers - page 2.pdf',
  displayName: 'stickers - page 2',
  originalFileName: 'stickers.pdf',
  mimeType: 'application/pdf',
  bytes: new Uint8Array([37, 80, 68, 70, 45]),
  previewUrl: cutterPdfPreview,
  previewDataUrl: cutterPdfPreview,
  pdfPageNumber: 2,
  pageCount: 8,
  naturalWidthPx: 595,
  naturalHeightPx: 842
}
const cutterPdfPiece = createPiecePresetFromSource(cutterPdfSource, [cutterPiece])
const cutterPdfFile = createCutterProjectFile({
  mode: 'piece-editor',
  activePieceId: cutterPdfPiece.id,
  selectedPlacedIds: [],
  selectedEditorObjects: ['artwork'],
  keyObject: { object: 'artwork' },
  sheet: DEFAULT_CUTTER_SHEET,
  sources: [cutterPdfSource],
  pieces: [cutterPdfPiece],
  placedPieces: [],
  layers: { artwork: true, cutlines: true },
  exportSettings: {
    strokeName: 'CutContour',
    includeArtwork: true,
    includeCutlines: true,
    mode: 'print-cut'
  }
})
const restoredPdfCutter = deserializeCutterProjectPayload(cutterPdfFile.payload)
expectEqual(restoredPdfCutter.sources[0].sourceKind, 'pdf-page', 'cutter PDF source kind restored')
expectEqual(restoredPdfCutter.sources[0].pdfPageNumber, 2, 'cutter PDF page number restored')
expectEqual(
  restoredPdfCutter.sources[0].previewUrl,
  cutterPdfPreview,
  'cutter PDF preview data restored'
)
expectEqual(
  restoredPdfCutter.pieces[0].displayName,
  'stickers - page 2',
  'cutter PDF piece display name restored'
)

const hardcoverState = createDefaultHardcoverProject()
hardcoverState.sourcePdf = {
  fileName: 'memoire.pdf',
  pageCount: 12,
  frontPageNumber: 1,
  backCoverEnabled: true,
  backPageNumber: 12,
  fitMode: 'fit',
  thumbnailDataUrl: 'blob:temporary-hardcover-thumbnail',
  backThumbnailDataUrl: 'blob:temporary-hardcover-back-thumbnail',
  pagePreviews: [
    { pageNumber: 1, rotation: 0, thumbnailDataUrl: 'blob:temporary-hardcover-thumbnail' },
    { pageNumber: 12, rotation: 0, thumbnailDataUrl: 'blob:temporary-hardcover-back-thumbnail' }
  ],
  bytes: new Uint8Array([37, 80, 68, 70])
}
const hardcoverFile = createHardcoverProjectFile({ state: hardcoverState })
const parsedHardcover = JSON.parse(JSON.stringify(hardcoverFile)) as unknown
expectEqual(isPrinterProjectFile(parsedHardcover), true, 'hardcover project validation')
const restoredHardcover = deserializeHardcoverProjectPayload(hardcoverFile.payload)
expectEqual(restoredHardcover.setup.bookWidthMm, 210, 'hardcover book width restored')
expectEqual(restoredHardcover.setup.spineWidthMm, 20, 'hardcover spine restored')
expectEqual(restoredHardcover.sourcePdf?.fileName, 'memoire.pdf', 'hardcover PDF metadata saved')
expectEqual(restoredHardcover.sourcePdf?.bytes, undefined, 'hardcover PDF bytes omitted')
expectEqual(
  restoredHardcover.sourcePdf?.thumbnailDataUrl,
  undefined,
  'hardcover temporary PDF thumbnail omitted'
)
expectEqual(
  restoredHardcover.sourcePdf?.backThumbnailDataUrl,
  undefined,
  'hardcover temporary back PDF thumbnail omitted'
)
expectEqual(
  restoredHardcover.sourcePdf?.pagePreviews,
  undefined,
  'hardcover PDF carousel thumbnails omitted'
)
expectEqual(restoredHardcover.sourcePdf?.backCoverEnabled, true, 'hardcover back toggle saved')
expectEqual(restoredHardcover.sourcePdf?.backPageNumber, 12, 'hardcover back page saved')
expectEqual(hardcoverFile.metadata.tool, 'hardcover-cover', 'hardcover metadata tool')
expectEqual(
  getHardcoverProjectStateKey(restoredHardcover),
  getHardcoverProjectStateKey(hardcoverState),
  'hardcover dirty state survives save/open and ignores PDF bytes'
)

const autoFitCover = createDefaultHardcoverProject()
autoFitCover.content.spine.autoFit = true
const initialAutoFitKey = getHardcoverProjectStateKey(autoFitCover)
autoFitCover.content.spine.fontSizePt += 2
expectEqual(
  getHardcoverProjectStateKey(autoFitCover),
  initialAutoFitKey,
  'automatic spine sizing does not mark an untouched hardcover dirty'
)
autoFitCover.content.spine.shortTitle = 'Edited title'
expectNotEqual(
  getHardcoverProjectStateKey(autoFitCover),
  initialAutoFitKey,
  'spine text edits still mark hardcover dirty'
)
autoFitCover.content.spine.autoFit = false
const manualFontKey = getHardcoverProjectStateKey(autoFitCover)
autoFitCover.content.spine.fontSizePt += 2
expectNotEqual(
  getHardcoverProjectStateKey(autoFitCover),
  manualFontKey,
  'manual spine font size edits still mark hardcover dirty'
)

expectEqual(
  getSuggestedProjectFileName('Client: Job/01', 'booklet-montage'),
  'Client- Job-01.myprinter-booklet.json',
  'safe suggested file name'
)

const sequentialState = createDefaultSequentialProject()
sequentialState.name = 'Invoice duplicate and stub'
sequentialState.settings.backMode = 'blank'
sequentialState.settings.startNumber = 120
sequentialState.settings.quantity = 73
sequentialState.positions.push({ ...sequentialState.positions[0], id: 'stub', xMm: 70 })
sequentialState.front = {
  name: 'invoice.png',
  kind: 'png',
  bytesBase64: 'iVBORw==',
  pageNumber: 1,
  pageCount: 1,
  widthMm: 90,
  heightMm: 50,
  previewDataUrl: 'data:image/png;base64,iVBORw=='
}
const sequentialFile = createSequentialProjectFile(sequentialState)
const parsedSequential = JSON.parse(JSON.stringify(sequentialFile))
expectEqual(isPrinterProjectFile(parsedSequential), true, 'sequential project validates')
expectEqual(
  parsedSequential.payload,
  sequentialState,
  'sequential payload preserves artwork, stub and duplex settings'
)
expectEqual(
  getSuggestedProjectFileName('Invoice 01', 'sequential-number'),
  'Invoice 01.myprinter-sequential.json',
  'sequential file extension'
)
for (const [label, payload] of [
  ['missing settings', { ...sequentialState, settings: null }],
  [
    'invalid quantity',
    { ...sequentialState, settings: { ...sequentialState.settings, quantity: -1 } }
  ],
  [
    'invalid duplex',
    { ...sequentialState, settings: { ...sequentialState.settings, backMode: 'unexpected' } }
  ],
  ['missing positions', { ...sequentialState, positions: null }],
  [
    'invalid font',
    { ...sequentialState, positions: [{ ...sequentialState.positions[0], fontSizePt: Infinity }] }
  ],
  [
    'invalid artwork',
    { ...sequentialState, front: { ...sequentialState.front, bytesBase64: 'invalid!' } }
  ],
  [
    'external preview',
    {
      ...sequentialState,
      front: { ...sequentialState.front, previewDataUrl: 'https://example.com/image.png' }
    }
  ]
] as const) {
  expectEqual(
    isPrinterProjectFile({ ...sequentialFile, payload }),
    false,
    `sequential rejects ${label}`
  )
}

const temporaryProjectFolder = await mkdtemp(join(tmpdir(), 'my-printer-app-projects-'))

try {
  const sequentialPath = join(temporaryProjectFolder, 'invoice.myprinter-sequential.json')
  await writeFile(sequentialPath, JSON.stringify(sequentialFile), 'utf8')
  const sequentialFromDisk = JSON.parse(await readFile(sequentialPath, 'utf8'))
  expectEqual(isPrinterProjectFile(sequentialFromDisk), true, 'sequential disk validation')
  expectEqual(sequentialFromDisk.payload, sequentialState, 'sequential disk round trip')
  const bookletPath = join(temporaryProjectFolder, 'booklet-round-trip.mpjob')
  const cutterPath = join(temporaryProjectFolder, 'cutter-round-trip.mpjob')
  const hardcoverPath = join(temporaryProjectFolder, 'hardcover-round-trip.mpjob')

  await Promise.all([
    writeFile(bookletPath, JSON.stringify(bookletFile), 'utf8'),
    writeFile(cutterPath, JSON.stringify(cutterFile), 'utf8'),
    writeFile(hardcoverPath, JSON.stringify(hardcoverFile), 'utf8')
  ])

  const [bookletFromDisk, cutterFromDisk, hardcoverFromDisk] = await Promise.all([
    readFile(bookletPath, 'utf8').then((contents) => JSON.parse(contents) as unknown),
    readFile(cutterPath, 'utf8').then((contents) => JSON.parse(contents) as unknown),
    readFile(hardcoverPath, 'utf8').then((contents) => JSON.parse(contents) as unknown)
  ])

  expectEqual(isPrinterProjectFile(bookletFromDisk), true, 'booklet .mpjob disk validation')
  expectEqual(isPrinterProjectFile(cutterFromDisk), true, 'cutter .mpjob disk validation')
  expectEqual(isPrinterProjectFile(hardcoverFromDisk), true, 'hardcover .mpjob disk validation')

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
  if (!isPrinterProjectFile(hardcoverFromDisk))
    throw new Error('Hardcover .mpjob did not pass validation.')
  expectEqual(
    deserializeHardcoverProjectPayload(hardcoverFromDisk.payload as typeof hardcoverFile.payload)
      .content.front.studentName,
    'Student Name',
    'hardcover .mpjob restores cover content from disk'
  )
} finally {
  await rm(temporaryProjectFolder, { recursive: true, force: true })
}

console.log(
  'Project file tests passed: booklet, cutter, hardcover, and sequential memory and disk round trips.'
)

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
