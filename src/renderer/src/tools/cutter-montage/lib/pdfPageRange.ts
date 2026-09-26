export function parsePdfPageRange(value: string, pageCount: number): number[] {
  const trimmed = value.trim()

  if (!trimmed) {
    return []
  }

  const pages = new Set<number>()

  for (const part of trimmed.split(',')) {
    const token = part.trim()

    if (!token) {
      continue
    }

    const rangeMatch = /^(\d+)\s*-\s*(\d+)$/.exec(token)

    if (rangeMatch) {
      const start = Number(rangeMatch[1])
      const end = Number(rangeMatch[2])
      assertPageNumber(start, pageCount)
      assertPageNumber(end, pageCount)

      for (let page = Math.min(start, end); page <= Math.max(start, end); page += 1) {
        pages.add(page)
      }

      continue
    }

    if (!/^\d+$/.test(token)) {
      throw new Error('Use page numbers like 1-4,7,10.')
    }

    const pageNumber = Number(token)
    assertPageNumber(pageNumber, pageCount)
    pages.add(pageNumber)
  }

  return [...pages].sort((first, second) => first - second)
}

function assertPageNumber(pageNumber: number, pageCount: number): void {
  if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > pageCount) {
    throw new Error(`Choose pages between 1 and ${pageCount}.`)
  }
}
