import { totalmem, freemem } from 'node:os'
import { getHeapStatistics } from 'node:v8'
import type { PdfMachineMemory } from '../shared/pdf-memory.js'
export function getPdfMachineMemory(): PdfMachineMemory {
  return {
    totalBytes: totalmem(),
    availableBytes: freemem(),
    heapLimitBytes: getHeapStatistics().heap_size_limit
  }
}
