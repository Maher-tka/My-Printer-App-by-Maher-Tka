import { isSequentialProject } from '../../../shared/sequential-validation'
import {
  PRINTER_PROJECT_SCHEMA,
  PRINTER_PROJECT_VERSION,
  type PrinterProjectFile
} from '../types/projects'

// Keep startup validation independent of tool editors and artwork serializers.
export function isPrinterProjectFile(value: unknown): value is PrinterProjectFile {
  if (!value || typeof value !== 'object') return false

  const candidate = value as Partial<PrinterProjectFile>
  return (
    candidate.schema === PRINTER_PROJECT_SCHEMA &&
    candidate.version === PRINTER_PROJECT_VERSION &&
    Boolean(candidate.metadata) &&
    Boolean(candidate.payload) &&
    (candidate.metadata?.tool === 'booklet-montage' ||
      candidate.metadata?.tool === 'cutter-montage' ||
      candidate.metadata?.tool === 'hardcover-cover' ||
      (candidate.metadata?.tool === 'sequential-number' && isSequentialProject(candidate.payload)))
  )
}
