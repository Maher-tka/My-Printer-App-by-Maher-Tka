import {
  blanksNeededForBooklet,
  createBlankPage,
  generateBookletSheets
} from './bookletImposition'
import { getPrintSizeMm, validatePrintSettings } from './printSizes'
import { getPlacement } from './renderSheet'
import { naturalSortFileNames } from './naturalSort'
import {
  getBookletImageExportFolderName,
  getNumberedMontageImageFileName
} from './exportNaming'
import {
  normalizeCurrentOrder,
  reorderPagesByDrag,
  resetToOriginalOrder
} from './pageOrdering'
import type { BookletPage, SheetSettings } from '../types'

interface TestPage {
  label: string
}

type TestSide = ReturnType<typeof generateBookletSheets<TestPage>>[number]['front']

function pages(count: number): TestPage[] {
  return Array.from({ length: count }, (_, index) => ({ label: `P${index + 1}` }))
}

function sideLabels(side: TestSide): string {
  return `${side.left.page.label},${side.right.page.label}`
}

function expectEqual(actual: unknown, expected: unknown, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

function testFourPages(): void {
  const sheets = generateBookletSheets(pages(4))

  expectEqual(sheets.length, 1, '4 pages sheet count')
  expectEqual(sideLabels(sheets[0].front), 'P4,P1', '4 pages front')
  expectEqual(sideLabels(sheets[0].back), 'P2,P3', '4 pages back')
}

function testEightPages(): void {
  const sheets = generateBookletSheets(pages(8))

  expectEqual(sheets.length, 2, '8 pages sheet count')
  expectEqual(sideLabels(sheets[0].front), 'P8,P1', '8 pages sheet 1 front')
  expectEqual(sideLabels(sheets[0].back), 'P2,P7', '8 pages sheet 1 back')
  expectEqual(sideLabels(sheets[1].front), 'P6,P3', '8 pages sheet 2 front')
  expectEqual(sideLabels(sheets[1].back), 'P4,P5', '8 pages sheet 2 back')
}

function testEightPagesRtl(): void {
  const sheets = generateBookletSheets(pages(8), 'rtl')

  expectEqual(sheets.length, 2, '8 pages RTL sheet count')
  expectEqual(sideLabels(sheets[0].front), 'P1,P8', '8 pages RTL sheet 1 front')
  expectEqual(sideLabels(sheets[0].back), 'P7,P2', '8 pages RTL sheet 1 back')
  expectEqual(sideLabels(sheets[1].front), 'P3,P6', '8 pages RTL sheet 2 front')
  expectEqual(sideLabels(sheets[1].back), 'P5,P4', '8 pages RTL sheet 2 back')
}

function testTwelvePages(): void {
  const sheets = generateBookletSheets(pages(12))

  expectEqual(sheets.length, 3, '12 pages sheet count')
  expectEqual(sideLabels(sheets[0].front), 'P12,P1', '12 pages sheet 1 front')
  expectEqual(sideLabels(sheets[1].front), 'P10,P3', '12 pages sheet 2 front')
  expectEqual(sideLabels(sheets[2].back), 'P6,P7', '12 pages sheet 3 back')
}

function testAutoBlankCount(): void {
  const sourcePages = pages(5)
  const blanks = Array.from({ length: blanksNeededForBooklet(sourcePages.length) }, (_, index) => ({
    label: createBlankPage(index + 1).displayName
  }))
  const sheets = generateBookletSheets([...sourcePages, ...blanks])

  expectEqual(blanks.length, 3, '5 pages blank count')
  expectEqual(sheets.length, 2, '5 pages with blanks sheet count')
  expectEqual(sideLabels(sheets[0].front), 'Blank Page 3,P1', '5 pages auto blank front')
}

function testPrintSizes(): void {
  const baseSettings: SheetSettings = {
    paperSize: 'A4',
    orientation: 'landscape',
    outputMode: 'front-back-pairs',
    customWidthMm: 500,
    customHeightMm: 700,
    scaleMode: 'fit',
    readingDirection: 'ltr',
    cropMarks: true,
    registrationMarks: false,
    exportQuality: 'standard'
  }

  expectEqual(
    getPrintSizeMm({ ...baseSettings, paperSize: 'A4', orientation: 'landscape' }),
    { widthMm: 297, heightMm: 210 },
    'A4 landscape size'
  )
  expectEqual(
    getPrintSizeMm({ ...baseSettings, paperSize: 'A3', orientation: 'landscape' }),
    { widthMm: 420, heightMm: 297 },
    'A3 landscape size'
  )
  expectEqual(
    getPrintSizeMm({ ...baseSettings, paperSize: 'SRA3', orientation: 'portrait' }),
    { widthMm: 320, heightMm: 450 },
    'SRA3 portrait size'
  )
  expectEqual(
    getPrintSizeMm({ ...baseSettings, paperSize: 'custom', orientation: 'landscape' }),
    { widthMm: 700, heightMm: 500 },
    'custom landscape size'
  )
  expectEqual(
    validatePrintSettings({ ...baseSettings, paperSize: 'custom', customWidthMm: 0 }).length > 0,
    true,
    'invalid custom size validation'
  )
}

function testScaleModes(): void {
  const naturalSize = { width: 100, height: 100 }
  const targetRect = { x: 0, y: 0, width: 100, height: 50 }

  expectEqual(getPlacement(naturalSize, targetRect, 'fit'), {
    x: 25,
    y: 0,
    width: 50,
    height: 50
  }, 'fit scale mode')
  expectEqual(getPlacement(naturalSize, targetRect, 'original'), {
    x: 25,
    y: 0,
    width: 50,
    height: 50
  }, 'original scale mode when page is larger than target')
  expectEqual(getPlacement(naturalSize, targetRect, 'stretch'), targetRect, 'stretch scale mode')
}

function testNaturalImageSorting(): void {
  expectEqual(
    naturalSortFileNames(['1.jpg', '10.jpg', '2.jpg', 'page_3.png', 'page_11.png']),
    ['1.jpg', '2.jpg', '10.jpg', 'page_3.png', 'page_11.png'],
    'natural image filename sorting'
  )
}

function testDragOrderDrivesImposition(): void {
  const sourcePages = bookletPages(4)
  const reordered = reorderPagesByDrag(sourcePages, 'page-3', 'page-2')
  const sheets = generateBookletSheets(reordered)

  expectEqual(
    reordered.map((page) => page.label),
    ['P1', 'P3', 'P2', 'P4'],
    'manual drag page order'
  )
  expectEqual(sideLabels(sheets[0].front), 'P4,P1', 'manual order front imposition')
  expectEqual(sideLabels(sheets[0].back), 'P3,P2', 'manual order back imposition')
}

function testResetOriginalOrder(): void {
  const [page1, page2, page3, page4] = bookletPages(4)
  const blank = createBlankPage(1)
  const mixedOrder = normalizeCurrentOrder([page1, page3, blank, page2, page4])

  expectEqual(
    resetToOriginalOrder(mixedOrder, 'keep').map((page) => page.label),
    ['P1', 'P2', 'P3', 'P4', 'Blank Page'],
    'reset original order and keep blanks'
  )
  expectEqual(
    resetToOriginalOrder(mixedOrder, 'remove').map((page) => page.label),
    ['P1', 'P2', 'P3', 'P4'],
    'reset original order and remove blanks'
  )
}

function testImageExportNaming(): void {
  const settings: Pick<SheetSettings, 'scaleMode'> = { scaleMode: 'fit' }

  expectEqual(
    getBookletImageExportFolderName(
      [
        {
          id: 'source-1',
          kind: 'pdf',
          name: 'Memoire_2025_Volume1.pdf',
          mimeType: 'application/pdf',
          bytes: new Uint8Array()
        }
      ],
      settings
    ),
    'Memoire_2025_Volume1_fit',
    'image export folder keeps source name and scale mode'
  )
  expectEqual(getNumberedMontageImageFileName(1, 'jpg'), '001.jpg', 'first image export file')
  expectEqual(getNumberedMontageImageFileName(12, 'png'), '012.png', 'twelfth image export file')
}

function bookletPages(count: number): BookletPage[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `page-${index + 1}`,
    kind: 'pdf',
    sourceType: 'pdf',
    sourceId: 'source-1',
    sourceName: 'test.pdf',
    sourceFileName: 'test.pdf',
    sourcePageIndex: index,
    originalPageNumber: index + 1,
    currentOrderIndex: index,
    originalOrderIndex: index,
    importBatchId: 'batch-1',
    importBatchIndex: index,
    label: `P${index + 1}`,
    displayName: `PDF Page ${index + 1}`,
    widthMm: 210,
    heightMm: 297
  }))
}

testFourPages()
testEightPages()
testEightPagesRtl()
testTwelvePages()
testAutoBlankCount()
testPrintSizes()
testScaleModes()
testNaturalImageSorting()
testDragOrderDrivesImposition()
testResetOriginalOrder()
testImageExportNaming()

console.log('Booklet tests passed: imposition, auto blanks, print sizes, scale modes, sorting, page ordering, and export naming.')
