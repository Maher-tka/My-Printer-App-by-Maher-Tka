import type { BookletPage, BookletSheet } from '../types'

export function blanksNeededForBooklet(pageCount: number): number {
  if (pageCount <= 0) {
    return 0
  }

  return (4 - (pageCount % 4)) % 4
}

export function isBookletPageCount(pageCount: number): boolean {
  return pageCount > 0 && pageCount % 4 === 0
}

export function generateBookletSheets<TPage>(pages: TPage[]): BookletSheet<TPage>[] {
  if (pages.length === 0) {
    return []
  }

  if (!isBookletPageCount(pages.length)) {
    throw new Error('Booklet page count must be divisible by 4.')
  }

  const totalPages = pages.length
  const sheetCount = totalPages / 4
  const sheets: BookletSheet<TPage>[] = []
  const getSlot = (pageNumber: number) => ({
    pageNumber,
    page: pages[pageNumber - 1]
  })

  for (let sheetIndex = 0; sheetIndex < sheetCount; sheetIndex += 1) {
    const sheetNumber = sheetIndex + 1
    const outerLeft = totalPages - sheetIndex * 2
    const outerRight = 1 + sheetIndex * 2
    const innerLeft = 2 + sheetIndex * 2
    const innerRight = totalPages - 1 - sheetIndex * 2

    sheets.push({
      sheetNumber,
      front: {
        sheetNumber,
        side: 'front',
        left: getSlot(outerLeft),
        right: getSlot(outerRight)
      },
      back: {
        sheetNumber,
        side: 'back',
        left: getSlot(innerLeft),
        right: getSlot(innerRight)
      }
    })
  }

  return sheets
}

export function createBlankPage(sequence: number): BookletPage {
  return {
    id: createStableId('blank'),
    kind: 'blank',
    displayName: `Blank Page ${sequence}`,
    widthMm: 210,
    heightMm: 297
  }
}

export function createStableId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}
