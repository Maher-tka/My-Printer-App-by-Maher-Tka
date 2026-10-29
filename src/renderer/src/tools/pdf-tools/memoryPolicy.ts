import {
  resolvePdfMemoryPolicy,
  GIB,
  type PdfMachineMemory,
  type PdfMemoryPolicy
} from '../../../../shared/pdf-memory'
import { getPerformancePreset } from '@/performance/performanceSettings'
import { optionalPdfNativeCall } from './nativePdfBridge'

let machine: PdfMachineMemory | undefined
export function setPdfMachineMemory(value: PdfMachineMemory): void {
  machine = value
}
export async function refreshPdfMemoryPolicy(
  read?: () => Promise<PdfMachineMemory>
): Promise<PdfMemoryPolicy> {
  try {
    const value = await optionalPdfNativeCall('pdf:machine-memory', read)
    if (value) setPdfMachineMemory(value)
  } catch {
    // Hardware detection is advisory: a failed query must never prevent importing files.
  }
  return getPdfMemoryPolicy()
}
export function getPdfMemoryPolicy(): PdfMemoryPolicy {
  const browser = globalThis.navigator as (Navigator & { deviceMemory?: number }) | undefined
  const heap = (globalThis.performance as Performance & { memory?: { jsHeapSizeLimit: number } })
    ?.memory?.jsHeapSizeLimit
  const policy = resolvePdfMemoryPolicy({
    totalBytes: machine?.totalBytes ?? (browser?.deviceMemory ?? 8) * GIB,
    availableBytes: machine?.availableBytes,
    heapLimitBytes: heap ?? machine?.heapLimitBytes
  })
  if (getPerformancePreset() === 'low-end')
    policy.maxCanvasPixels = Math.min(policy.maxCanvasPixels, 8_000_000)
  return policy
}
