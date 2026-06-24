export const MM_PER_CM = 10
export const POINTS_PER_INCH = 72
export const MM_PER_INCH = 25.4

export function cmToMm(value: number): number {
  return value * MM_PER_CM
}

export function mmToCm(value: number): number {
  return value / MM_PER_CM
}

export function mmToPoints(value: number): number {
  return (value / MM_PER_INCH) * POINTS_PER_INCH
}

export function pointsToMm(value: number): number {
  return (value / POINTS_PER_INCH) * MM_PER_INCH
}

export function formatMeasurement(valueMm: number, unit: 'mm' | 'cm'): string {
  return unit === 'cm' ? `${trimNumber(mmToCm(valueMm))} cm` : `${trimNumber(valueMm)} mm`
}

export function toMillimeters(value: number, unit: 'mm' | 'cm'): number {
  return unit === 'cm' ? cmToMm(value) : value
}

export function fromMillimeters(value: number, unit: 'mm' | 'cm'): number {
  return unit === 'cm' ? mmToCm(value) : value
}

function trimNumber(value: number): string {
  return Number(value.toFixed(2)).toString()
}
