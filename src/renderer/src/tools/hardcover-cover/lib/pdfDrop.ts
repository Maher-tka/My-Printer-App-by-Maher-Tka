import type { HardcoverPdfCoverTarget } from '../types'

export type HardcoverPdfDropTarget = 'single' | HardcoverPdfCoverTarget
export interface HardcoverPdfDropImport {
  file: File
  target?: HardcoverPdfDropTarget
}

export function isFileDrag(transfer: Pick<DataTransfer, 'types'>): boolean {
  return Array.from(transfer.types).includes('Files')
}

/** Validate all files before replacing any source. Never infer roles by file order. */
export function planHardcoverPdfDrop(
  files: File[],
  target?: HardcoverPdfDropTarget
): HardcoverPdfDropImport[] {
  if (!files.length) throw new Error('Drop a PDF file, not a folder or link.')
  if (
    files.some(
      (file) =>
        (file.type && file.type !== 'application/pdf') || (!file.type && !/\.pdf$/i.test(file.name))
    )
  )
    throw new Error('Use PDF files for book covers. Convert Word documents or images to PDF first.')
  if (files.some((file) => !file.size))
    throw new Error('This PDF is empty. Choose a file with cover artwork.')
  if (files.length === 1) return [{ file: files[0], target: target ?? 'front' }]
  if (target || files.length !== 2)
    throw new Error(
      'Drop one PDF at a time onto Front or Back. You can also drop a clearly named front/back pair into the workspace.'
    )
  const back = files.filter((file) =>
    /(?:^|[\s_.-])(?:back|arriere|verso|rear)(?:[\s_.-]|$)|خلف(?:ية|ي)/i.test(
      file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    )
  )
  if (back.length !== 1)
    throw new Error(
      'Cannot tell which PDF is the back cover. Drop each file onto Front PDF or Back PDF.'
    )
  return [
    { file: files.find((file) => file !== back[0])!, target: 'front' },
    { file: back[0], target: 'back' }
  ]
}
