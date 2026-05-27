export function cmToMm(cm: number): number {
  return cm * 10
}

export function mmToCm(mm: number): number {
  return mm / 10
}

export function cmToPoints(cm: number): number {
  return (cm * 72) / 2.54
}

export function mmToPoints(mm: number): number {
  return (mm * 72) / 25.4
}

export function roundToStep(value: number, step: number): number {
  if (step <= 0) {
    return value
  }

  return Math.round(value / step) * step
}

export function formatCm(value: number): string {
  return `${trimNumber(value)} cm`
}

export function trimNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}
