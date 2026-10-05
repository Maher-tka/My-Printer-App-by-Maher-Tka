import type { HardcoverPdfSource } from '../types'
import { getHardcoverPdfCoverSourceBytes } from './sourcePdf'

const sourceIds = new WeakMap<Uint8Array, number>()
let sourceSequence = 0

/** Runtime source identity ignores preview/placement changes and distinguishes same-name PDFs. */
export function getSpineDetectionSource(
  source: HardcoverPdfSource | undefined
): { key: string; bytes: Uint8Array; pageNumber: number } | undefined {
  if (!source) return
  if (source.sourceMode === 'separate' || source.frontSource || source.backSource) {
    const front = source.frontSource
    const bytes = front && getHardcoverPdfCoverSourceBytes(front)
    if (front && bytes)
      return { key: `${front.sourceId}:${front.pageNumber}`, bytes, pageNumber: front.pageNumber }
    return
  }
  if (!source.bytes) return
  if (!sourceIds.has(source.bytes)) sourceIds.set(source.bytes, ++sourceSequence)
  return {
    key: `${sourceIds.get(source.bytes)}:${source.frontPageNumber}`,
    bytes: source.bytes,
    pageNumber: source.frontPageNumber
  }
}
