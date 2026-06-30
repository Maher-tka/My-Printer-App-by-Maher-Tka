import { blanksNeededForBooklet, createBlankPage, generateBookletSheets } from './bookletImposition'
import {
  DEFAULT_SHEET_SETTINGS,
  getPrintSizeMm,
  getSheetLayoutMm,
  validatePrintSettings
} from './printSizes'
import {
  createCanvasRenderAssets,
  getPlacement,
  renderCanvasSheetSide,
  renderPdfSheetSide
} from './renderSheet'
import { naturalSortFileNames } from './naturalSort'
import { getBookletImageExportFolderName, getNumberedMontageImageFileName } from './exportNaming'
import { normalizeCurrentOrder, reorderPagesByDrag, resetToOriginalOrder } from './pageOrdering'
import type { BookletPage, BookletSide, SheetSettings } from '../types'

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
    ...DEFAULT_SHEET_SETTINGS,
    customWidthMm: 500,
    customHeightMm: 700
  }

  expectEqual(DEFAULT_SHEET_SETTINGS.cropMarks, false, 'default crop marks off')
  expectEqual(DEFAULT_SHEET_SETTINGS.registrationMarks, false, 'default registration marks off')
  expectEqual(DEFAULT_SHEET_SETTINGS.outerMarginMm, 0, 'default outer margin is zero')
  expectEqual(DEFAULT_SHEET_SETTINGS.pageGapMm, 0, 'default page gap is zero')
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
  expectEqual(
    validatePrintSettings({ ...baseSettings, outerMarginMm: -1 }).length > 0,
    true,
    'negative outer margin validation'
  )
  expectEqual(
    validatePrintSettings({ ...baseSettings, pageGapMm: -1 }).length > 0,
    true,
    'negative page gap validation'
  )
  expectEqual(
    validatePrintSettings({ ...baseSettings, outerMarginMm: 150 }).length > 0,
    true,
    'oversized margin validation'
  )
}

function testDefaultZeroGapLayout(): void {
  const layout = getSheetLayoutMm(DEFAULT_SHEET_SETTINGS)
  const { left, right } = layout.trimSlots

  expectEqual(left.x, 0, 'default A4 left slot x')
  expectEqual(left.y, 0, 'default A4 left slot y')
  expectEqual(left.width, 148.5, 'default A4 left slot width')
  expectEqual(left.height, 210, 'default A4 left slot height')
  expectEqual(right.x, 148.5, 'default A4 right slot x')
  expectEqual(right.y, 0, 'default A4 right slot y')
  expectEqual(right.width, 148.5, 'default A4 right slot width')
  expectEqual(right.height, 210, 'default A4 right slot height')
  expectEqual(left.x + left.width, right.x, 'left right edge touches right left edge')
}

function testScaleModes(): void {
  const naturalSize = { width: 100, height: 100 }
  const targetRect = { x: 0, y: 0, width: 100, height: 50 }

  expectEqual(
    getPlacement(naturalSize, targetRect, 'fit'),
    {
      x: 25,
      y: 0,
      width: 50,
      height: 50
    },
    'fit scale mode'
  )
  expectEqual(
    getPlacement(naturalSize, targetRect, 'original'),
    {
      x: 25,
      y: 0,
      width: 50,
      height: 50
    },
    'original scale mode when page is larger than target'
  )
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

async function testMarksDisabledByDefault(): Promise<void> {
  const side: BookletSide = {
    sheetNumber: 1,
    side: 'front',
    left: { pageNumber: 4, page: createBlankPage(1) },
    right: { pageNumber: 1, page: createBlankPage(2) }
  }
  const layout = getSheetLayoutMm(DEFAULT_SHEET_SETTINGS)
  const pdfPage = {
    drawLine: () => {
      throw new Error('PDF crop or registration marks should not be drawn by default.')
    },
    drawRectangle: () => undefined
  }
  const canvas = new CanvasSpy()

  await renderPdfSheetSide(
    pdfPage as unknown as Parameters<typeof renderPdfSheetSide>[0],
    side,
    DEFAULT_SHEET_SETTINGS,
    layout,
    {
      pdf: {} as Parameters<typeof renderPdfSheetSide>[4]['pdf'],
      sourceMap: new Map(),
      pdfPages: new Map(),
      images: new Map()
    }
  )
  await renderCanvasSheetSide(
    canvas as unknown as CanvasRenderingContext2D,
    side,
    DEFAULT_SHEET_SETTINGS,
    layout,
    createCanvasRenderAssets([]),
    72
  )
  expectEqual(canvas.strokeCount, 0, 'canvas crop and registration marks are not drawn by default')
}

class CanvasSpy {
  fillStyle = '#ffffff'
  strokeStyle = '#000000'
  lineWidth = 1
  strokeCount = 0

  save(): void {}
  restore(): void {}
  fillRect(): void {}
  beginPath(): void {}
  moveTo(): void {}
  lineTo(): void {}
  stroke(): void {
    this.strokeCount += 1
  }
}

testFourPages()
testEightPages()
testEightPagesRtl()
testTwelvePages()
testAutoBlankCount()
testPrintSizes()
testDefaultZeroGapLayout()
testScaleModes()
testNaturalImageSorting()
testDragOrderDrivesImposition()
testResetOriginalOrder()
testImageExportNaming()
await testMarksDisabledByDefault()

console.log(
  'Booklet tests passed: imposition, auto blanks, print sizes, scale modes, sorting, page ordering, and export naming.'
)
