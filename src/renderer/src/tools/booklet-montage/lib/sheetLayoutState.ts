import type {
  BookletSheet,
  BookletSide,
  EmptyMontageSheet,
  EmptySheetBoardItem,
  SheetBoardItem,
  SheetBoardPosition,
  SheetBoardState
} from '../types'
import { normalizeHex } from './colorUtils'

export const SHEET_BOARD_CARD = {
  width: 340,
  height: 300,
  gap: 18,
  padding: 20,
  columns: 3
}

const DEFAULT_EMPTY_SHEET_COLOR = '#FFFFFF'
const MAX_RECENT_COLORS = 10

export const emptySheetSwatches = [
  '#FFFFFF',
  '#F8FAFC',
  '#E2E8F0',
  '#111827',
  '#2563EB',
  '#0F766E',
  '#16A34A',
  '#F59E0B',
  '#DC2626',
  '#DB2777'
]

export function createInitialSheetBoardState(): SheetBoardState {
  return {
    items: [],
    recentColors: []
  }
}

export function flattenBookletSides(sheets: BookletSheet[]): BookletSide[] {
  return sheets.flatMap((sheet) => [sheet.front, sheet.back])
}

export function getSideKey(side: BookletSide): string {
  return `${side.sheetNumber}-${side.side}`
}

export function syncSheetBoardWithBookletSides(
  sides: BookletSide[],
  currentState: SheetBoardState
): SheetBoardState {
  const currentById = new Map(currentState.items.map((item) => [item.id, item]))
  const sideItems: SheetBoardItem[] = sides.map((side, index) => {
    const sideKey = getSideKey(side)
    const id = getSideItemId(sideKey)
    const existing = currentById.get(id)

    return {
      id,
      kind: 'booklet-side',
      sideKey,
      position: existing?.position ?? getAutomaticBoardPosition(index)
    }
  })
  const hadBookletSideItems = currentState.items.some((item) => item.kind === 'booklet-side')
  const emptyItems = currentState.items
    .filter((item): item is EmptySheetBoardItem => item.kind === 'empty-sheet')
    .map((item, index) =>
      !hadBookletSideItems && sides.length > 0
        ? {
            ...item,
            position: getAutomaticBoardPosition(sides.length + index)
          }
        : item
    )

  return {
    ...currentState,
    items: [...sideItems, ...emptyItems]
  }
}

export function addEmptySheetToBoard(state: SheetBoardState): SheetBoardState {
  const emptyCount = state.items.filter((item) => item.kind === 'empty-sheet').length
  const item: EmptySheetBoardItem = {
    id: createStableBoardId('empty-sheet'),
    kind: 'empty-sheet',
    label: `Empty Sheet ${emptyCount + 1}`,
    colorHex: DEFAULT_EMPTY_SHEET_COLOR,
    position: getAutomaticBoardPosition(state.items.length)
  }

  return {
    ...state,
    items: [...state.items, item]
  }
}

export function resetSheetBoardLayout(state: SheetBoardState): SheetBoardState {
  return {
    ...state,
    items: state.items.map((item, index) => ({
      ...item,
      position: getAutomaticBoardPosition(index)
    }))
  }
}

export function updateSheetBoardPosition(
  state: SheetBoardState,
  itemId: string,
  position: SheetBoardPosition
): SheetBoardState {
  return {
    ...state,
    items: state.items.map((item) =>
      item.id === itemId
        ? {
            ...item,
            position: {
              x: Math.max(0, Math.round(position.x)),
              y: Math.max(0, Math.round(position.y))
            }
          }
        : item
    )
  }
}

export function removeEmptySheetFromBoard(state: SheetBoardState, itemId: string): SheetBoardState {
  return {
    ...state,
    items: state.items.filter((item) => item.id !== itemId || item.kind !== 'empty-sheet')
  }
}

export function duplicateEmptySheetInBoard(
  state: SheetBoardState,
  itemId: string
): SheetBoardState {
  const source = state.items.find(
    (item): item is EmptySheetBoardItem => item.id === itemId && item.kind === 'empty-sheet'
  )

  if (!source) {
    return state
  }

  const emptyCount = state.items.filter((item) => item.kind === 'empty-sheet').length
  const copy: EmptySheetBoardItem = {
    ...source,
    id: createStableBoardId('empty-sheet'),
    label: `Empty Sheet ${emptyCount + 1}`,
    position: {
      x: source.position.x + 28,
      y: source.position.y + 28
    }
  }

  return {
    ...state,
    items: [...state.items, copy]
  }
}

export function updateEmptySheetColor(
  state: SheetBoardState,
  itemId: string,
  colorHex: string
): SheetBoardState {
  const normalized = normalizeHex(colorHex) ?? DEFAULT_EMPTY_SHEET_COLOR

  return {
    ...state,
    recentColors: rememberRecentColor(state.recentColors, normalized),
    items: state.items.map((item) =>
      item.id === itemId && item.kind === 'empty-sheet'
        ? {
            ...item,
            colorHex: normalized
          }
        : item
    )
  }
}

export function rememberSheetBoardColor(state: SheetBoardState, colorHex: string): SheetBoardState {
  const normalized = normalizeHex(colorHex)

  if (!normalized) {
    return state
  }

  return {
    ...state,
    recentColors: rememberRecentColor(state.recentColors, normalized)
  }
}

export function getEmptySheetsForExport(state: SheetBoardState): EmptyMontageSheet[] {
  return state.items
    .filter((item): item is EmptySheetBoardItem => item.kind === 'empty-sheet')
    .map((item) => ({
      id: item.id,
      label: item.label,
      colorHex: item.colorHex || DEFAULT_EMPTY_SHEET_COLOR
    }))
}

export function getBoardCanvasSize(items: SheetBoardItem[]): { width: number; height: number } {
  if (items.length === 0) {
    return { width: 0, height: 0 }
  }

  return items.reduce(
    (size, item) => ({
      width: Math.max(
        size.width,
        item.position.x + SHEET_BOARD_CARD.width + SHEET_BOARD_CARD.padding
      ),
      height: Math.max(
        size.height,
        item.position.y + SHEET_BOARD_CARD.height + SHEET_BOARD_CARD.padding
      )
    }),
    { width: 0, height: 0 }
  )
}

export function getAutomaticBoardPosition(index: number): SheetBoardPosition {
  const column = index % SHEET_BOARD_CARD.columns
  const row = Math.floor(index / SHEET_BOARD_CARD.columns)

  return {
    x: SHEET_BOARD_CARD.padding + column * (SHEET_BOARD_CARD.width + SHEET_BOARD_CARD.gap),
    y: SHEET_BOARD_CARD.padding + row * (SHEET_BOARD_CARD.height + SHEET_BOARD_CARD.gap)
  }
}

function getSideItemId(sideKey: string): string {
  return `booklet-side-${sideKey}`
}

function rememberRecentColor(colors: string[], colorHex: string): string[] {
  return [colorHex, ...colors.filter((color) => color !== colorHex)].slice(0, MAX_RECENT_COLORS)
}

function createStableBoardId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}
