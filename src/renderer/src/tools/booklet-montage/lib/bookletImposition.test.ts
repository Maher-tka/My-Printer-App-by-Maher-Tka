import {
  blanksNeededForBooklet,
  createBlankPage,
  generateBookletSheets
} from './bookletImposition'
import { getPrintSizeMm, validatePrintSettings } from './printSizes'
import { getPlacement } from './renderSheet'
import type { SheetSettings } from '../types'

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

testFourPages()
testEightPages()
testTwelvePages()
testAutoBlankCount()
testPrintSizes()
testScaleModes()

console.log('Booklet tests passed: imposition, auto blanks, print sizes, and scale modes.')
