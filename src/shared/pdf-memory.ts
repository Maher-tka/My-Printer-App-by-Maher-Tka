export const MIB = 1024 * 1024
export const GIB = 1024 * MIB

export interface PdfMachineMemory {
  totalBytes: number
  availableBytes?: number
  heapLimitBytes?: number
}

export interface PdfMemoryPolicy {
  ramGB: number
  maxInputBytes: number
  warnInputBytes: number
  maxOutputBytes: number
  maxCanvasPixels: number
}

/** A bounded working-set allowance, not a promise that every PDF has the same RAM cost. */
export function resolvePdfMemoryPolicy(machine?: PdfMachineMemory): PdfMemoryPolicy {
  const positive = (value: number | undefined, fallback: number): number =>
    Number.isFinite(value) && value! > 0 ? value! : fallback
  const total = positive(machine?.totalBytes, 8 * GIB)
  const heap = positive(machine?.heapLimitBytes, 4 * GIB)
  const available = positive(machine?.availableBytes, total / 2)
  const allowance = Math.min(total / 16, heap / 3, available / 3, GIB)
  const maxInputBytes = Math.max(32 * MIB, Math.floor(allowance / (16 * MIB)) * 16 * MIB)
  return {
    ramGB: Math.round(total / GIB),
    maxInputBytes,
    warnInputBytes: maxInputBytes / 2,
    maxOutputBytes: maxInputBytes,
    maxCanvasPixels: total < 6 * GIB ? 6_000_000 : total < 12 * GIB ? 12_000_000 : 24_000_000
  }
}
