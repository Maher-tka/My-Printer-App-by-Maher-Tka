import type {
  BookDirection,
  CoverDimensions,
  CoverGuideMark,
  CoverSetup,
  CoverZone,
  HardcoverProductionPreset
} from '../types'

export const DEFAULT_HARDCOVER_PRODUCTION_PRESET: HardcoverProductionPreset = {
  id: 'my-shop-hardcover-sheet',
  name: 'My shop hardcover sheet',
  paperWidthMm: 500,
  paperHeightMm: 325,
  boardWidthMm: 210,
  boardHeightMm: 297,
  spineWidthMm: 20,
  leftBandWidthMm: 5,
  rightBandWidthMm: 5,
  markLengthMm: 15,
  centerOnSheet: true,
  cropMarks: false,
  defaultDirection: 'ltr'
}

export const DEFAULT_A4_COVER_SETUP: CoverSetup = createSetupFromProductionPreset(
  DEFAULT_HARDCOVER_PRODUCTION_PRESET,
  'a4'
)

export const DEFAULT_A5_COVER_SETUP: CoverSetup = createSetupFromProductionPreset(
  {
    ...DEFAULT_HARDCOVER_PRODUCTION_PRESET,
    id: 'a5-hardcover-sheet',
    name: 'A5 hardcover sheet',
    paperWidthMm: 350,
    paperHeightMm: 250,
    boardWidthMm: 148,
    boardHeightMm: 210,
    spineWidthMm: 15
  },
  'a5'
)

export function createSetupFromProductionPreset(
  preset: HardcoverProductionPreset,
  coverPreset: CoverSetup['preset'] = 'custom',
  unit: CoverSetup['unit'] = 'cm'
): CoverSetup {
  return {
    preset: coverPreset,
    unit,
    bookDirection: preset.defaultDirection,
    boardWidthMm: preset.boardWidthMm,
    boardHeightMm: preset.boardHeightMm,
    bookWidthMm: preset.boardWidthMm,
    bookHeightMm: preset.boardHeightMm,
    spineWidthMm: preset.spineWidthMm,
    leftBandWidthMm: preset.leftBandWidthMm,
    rightBandWidthMm: preset.rightBandWidthMm,
    useSameBandWidth: preset.leftBandWidthMm === preset.rightBandWidthMm,
    markLengthMm: preset.markLengthMm,
    centerOnSheet: preset.centerOnSheet,
    wrap: { topMm: 0, rightMm: 0, bottomMm: 0, leftMm: 0 },
    hingeMm: Math.max(preset.leftBandWidthMm, preset.rightBandWidthMm, 3),
    bleedMm: 0,
    paperWidthMm: preset.paperWidthMm,
    paperHeightMm: preset.paperHeightMm
  }
}

export function applyProductionPresetToSetup(
  current: CoverSetup,
  preset: HardcoverProductionPreset
): CoverSetup {
  return {
    ...current,
    preset: 'custom',
    bookDirection: preset.defaultDirection,
    boardWidthMm: preset.boardWidthMm,
    boardHeightMm: preset.boardHeightMm,
    bookWidthMm: preset.boardWidthMm,
    bookHeightMm: preset.boardHeightMm,
    spineWidthMm: preset.spineWidthMm,
    leftBandWidthMm: preset.leftBandWidthMm,
    rightBandWidthMm: preset.rightBandWidthMm,
    useSameBandWidth: preset.leftBandWidthMm === preset.rightBandWidthMm,
    markLengthMm: preset.markLengthMm,
    centerOnSheet: preset.centerOnSheet,
    hingeMm: Math.max(preset.leftBandWidthMm, preset.rightBandWidthMm, current.hingeMm, 3),
    bleedMm: 0,
    paperWidthMm: preset.paperWidthMm,
    paperHeightMm: preset.paperHeightMm
  }
}

export function createProductionPresetFromSetup(
  setup: CoverSetup,
  cropMarks: boolean,
  base: HardcoverProductionPreset = DEFAULT_HARDCOVER_PRODUCTION_PRESET
): HardcoverProductionPreset {
  return {
    ...base,
    paperWidthMm: setup.paperWidthMm,
    paperHeightMm: setup.paperHeightMm,
    boardWidthMm: getBoardWidth(setup),
    boardHeightMm: getBoardHeight(setup),
    spineWidthMm: setup.spineWidthMm,
    leftBandWidthMm: setup.leftBandWidthMm,
    rightBandWidthMm: setup.rightBandWidthMm,
    markLengthMm: setup.markLengthMm,
    centerOnSheet: setup.centerOnSheet,
    cropMarks,
    defaultDirection: setup.bookDirection
  }
}

export function normalizeCoverSetup(setup: CoverSetup): CoverSetup {
  const boardWidthMm = getBoardWidth(setup)
  const boardHeightMm = getBoardHeight(setup)
  const leftBandWidthMm = setup.leftBandWidthMm ?? setup.hingeMm ?? 5
  const rightBandWidthMm = setup.rightBandWidthMm ?? setup.hingeMm ?? leftBandWidthMm

  return {
    ...DEFAULT_A4_COVER_SETUP,
    ...setup,
    bookDirection: setup.bookDirection ?? 'ltr',
    boardWidthMm,
    boardHeightMm,
    bookWidthMm: setup.bookWidthMm ?? boardWidthMm,
    bookHeightMm: setup.bookHeightMm ?? boardHeightMm,
    leftBandWidthMm,
    rightBandWidthMm,
    useSameBandWidth: setup.useSameBandWidth ?? leftBandWidthMm === rightBandWidthMm,
    markLengthMm: setup.markLengthMm ?? DEFAULT_HARDCOVER_PRODUCTION_PRESET.markLengthMm,
    centerOnSheet: setup.centerOnSheet ?? true,
    paperWidthMm: setup.paperWidthMm ?? DEFAULT_HARDCOVER_PRODUCTION_PRESET.paperWidthMm,
    paperHeightMm: setup.paperHeightMm ?? DEFAULT_HARDCOVER_PRODUCTION_PRESET.paperHeightMm
  }
}

export function calculateCoverDimensions(input: CoverSetup): CoverDimensions {
  const setup = normalizeCoverSetup(input)
  const boardWidthMm = Math.max(0, getBoardWidth(setup))
  const boardHeightMm = Math.max(0, getBoardHeight(setup))
  const spineWidthMm = Math.max(0, setup.spineWidthMm)
  const leftBandWidthMm = Math.max(0, setup.leftBandWidthMm)
  const rightBandWidthMm = Math.max(0, setup.rightBandWidthMm)
  const paperWidthMm = Math.max(0, setup.paperWidthMm)
  const paperHeightMm = Math.max(0, setup.paperHeightMm)
  const markLengthMm = Math.max(0, setup.markLengthMm)
  const structureWidthMm =
    boardWidthMm + leftBandWidthMm + spineWidthMm + rightBandWidthMm + boardWidthMm
  const structureHeightMm = boardHeightMm
  const horizontalMarginMm = setup.centerOnSheet ? (paperWidthMm - structureWidthMm) / 2 : 0
  const verticalMarginMm = setup.centerOnSheet ? (paperHeightMm - structureHeightMm) / 2 : 0

  const leftBoard = zone(horizontalMarginMm, verticalMarginMm, boardWidthMm, boardHeightMm)
  const leftBand = zone(
    leftBoard.xMm + leftBoard.widthMm,
    verticalMarginMm,
    leftBandWidthMm,
    boardHeightMm
  )
  const spine = zone(leftBand.xMm + leftBand.widthMm, verticalMarginMm, spineWidthMm, boardHeightMm)
  const rightBand = zone(
    spine.xMm + spine.widthMm,
    verticalMarginMm,
    rightBandWidthMm,
    boardHeightMm
  )
  const rightBoard = zone(
    rightBand.xMm + rightBand.widthMm,
    verticalMarginMm,
    boardWidthMm,
    boardHeightMm
  )
  const front = setup.bookDirection === 'rtl' ? leftBoard : rightBoard
  const back = setup.bookDirection === 'rtl' ? rightBoard : leftBoard
  const safeInset = Math.max(setup.hingeMm ?? 0, 3)
  const safeBack = insetZone(back, safeInset)
  const safeFront = insetZone(front, safeInset)
  const safeSpine = insetZone(spine, Math.min(safeInset, Math.max(spineWidthMm / 4, 1)))
  const guideMarkPositionsMm = [leftBand.xMm, spine.xMm, rightBand.xMm, rightBoard.xMm]
  const guideMarks = createGuideMarks(guideMarkPositionsMm, paperHeightMm, markLengthMm)
  const warnings = createWarnings({
    setup,
    boardWidthMm,
    boardHeightMm,
    spineWidthMm,
    leftBandWidthMm,
    rightBandWidthMm,
    paperWidthMm,
    paperHeightMm,
    structureWidthMm,
    structureHeightMm,
    markLengthMm
  })

  return {
    fullWidthMm: paperWidthMm,
    fullHeightMm: paperHeightMm,
    structureWidthMm,
    structureHeightMm,
    horizontalMarginMm,
    verticalMarginMm,
    orientation: paperWidthMm >= paperHeightMm ? 'landscape' : 'portrait',
    sheet: zone(0, 0, paperWidthMm, paperHeightMm),
    leftBoard,
    rightBoard,
    leftBand,
    rightBand,
    back,
    spine,
    front,
    safeBack,
    safeSpine,
    safeFront,
    guideMarkPositionsMm,
    guideMarks,
    warnings
  }
}

export function applyCoverPreset(current: CoverSetup, preset: CoverSetup['preset']): CoverSetup {
  if (preset === 'a4') return { ...DEFAULT_A4_COVER_SETUP, unit: current.unit }
  if (preset === 'a5') return { ...DEFAULT_A5_COVER_SETUP, unit: current.unit }
  return { ...current, preset: 'custom' }
}

export function isValidHardcoverPageNumber(pageNumber: number, pageCount: number): boolean {
  return Number.isInteger(pageNumber) && pageNumber >= 1 && pageNumber <= pageCount
}

function getBoardWidth(setup: CoverSetup): number {
  return setup.boardWidthMm ?? setup.bookWidthMm ?? DEFAULT_HARDCOVER_PRODUCTION_PRESET.boardWidthMm
}

function getBoardHeight(setup: CoverSetup): number {
  return (
    setup.boardHeightMm ?? setup.bookHeightMm ?? DEFAULT_HARDCOVER_PRODUCTION_PRESET.boardHeightMm
  )
}

function createGuideMarks(
  positions: number[],
  paperHeightMm: number,
  markLengthMm: number
): CoverGuideMark[] {
  const topEnd = Math.min(markLengthMm, paperHeightMm)
  const bottomStart = Math.max(paperHeightMm - markLengthMm, 0)

  return positions.flatMap((xMm) => [
    { xMm, yStartMm: 0, yEndMm: topEnd, edge: 'top' as const },
    { xMm, yStartMm: bottomStart, yEndMm: paperHeightMm, edge: 'bottom' as const }
  ])
}

function createWarnings(input: {
  setup: CoverSetup
  boardWidthMm: number
  boardHeightMm: number
  spineWidthMm: number
  leftBandWidthMm: number
  rightBandWidthMm: number
  paperWidthMm: number
  paperHeightMm: number
  structureWidthMm: number
  structureHeightMm: number
  markLengthMm: number
}): string[] {
  const warnings: string[] = []

  if (input.boardWidthMm <= 0 || input.boardHeightMm <= 0 || input.spineWidthMm <= 0) {
    warnings.push('Board width, board height, and spine thickness must be greater than zero.')
  }
  if (input.leftBandWidthMm < 0 || input.rightBandWidthMm < 0) {
    warnings.push('Binding band widths cannot be negative.')
  }
  if (input.spineWidthMm > 0 && input.spineWidthMm < 8) {
    warnings.push('Spine is under 8 mm; readable spine text may not fit.')
  }
  if (input.markLengthMm <= 0) {
    warnings.push('Binding guide mark length must be greater than zero.')
  }
  if (input.markLengthMm > input.paperHeightMm / 2) {
    warnings.push('Binding guide marks are longer than half the sheet height.')
  }
  if (
    input.structureWidthMm > input.paperWidthMm ||
    input.structureHeightMm > input.paperHeightMm
  ) {
    warnings.push('The hardcover structure does not fit inside the selected printer sheet.')
  }

  return warnings
}

function zone(xMm: number, yMm: number, widthMm: number, heightMm: number): CoverZone {
  return { xMm, yMm, widthMm, heightMm }
}

function insetZone(value: CoverZone, insetMm: number): CoverZone {
  return {
    xMm: value.xMm + insetMm,
    yMm: value.yMm + insetMm,
    widthMm: Math.max(0, value.widthMm - insetMm * 2),
    heightMm: Math.max(0, value.heightMm - insetMm * 2)
  }
}

export function getDirectionLabel(direction: BookDirection): string {
  return direction === 'rtl' ? 'RTL / Arabic' : 'LTR / French / English'
}
