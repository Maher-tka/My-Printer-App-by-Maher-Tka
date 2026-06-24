export interface RgbColor {
  r: number
  g: number
  b: number
}

export interface CmykColor {
  c: number
  m: number
  y: number
  k: number
}

export const DEFAULT_SOLID_FILL_HEX = '#FFFFFF'

export function getSolidFillHex(colorHex?: string): string {
  return normalizeHex(colorHex ?? DEFAULT_SOLID_FILL_HEX) ?? DEFAULT_SOLID_FILL_HEX
}

export function hexToRgb(hex: string): RgbColor | null {
  const normalized = normalizeHex(hex)

  if (!normalized) {
    return null
  }

  const value = normalized.slice(1)

  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16)
  }
}

export function rgbToHex(rgb: RgbColor): string {
  return `#${toHexByte(rgb.r)}${toHexByte(rgb.g)}${toHexByte(rgb.b)}`.toUpperCase()
}

export function rgbToCmyk(rgb: RgbColor): CmykColor {
  const r = clampByte(rgb.r) / 255
  const g = clampByte(rgb.g) / 255
  const b = clampByte(rgb.b) / 255
  const k = 1 - Math.max(r, g, b)

  if (k >= 1) {
    return { c: 0, m: 0, y: 0, k: 100 }
  }

  return {
    c: Math.round(((1 - r - k) / (1 - k)) * 100),
    m: Math.round(((1 - g - k) / (1 - k)) * 100),
    y: Math.round(((1 - b - k) / (1 - k)) * 100),
    k: Math.round(k * 100)
  }
}

export function cmykToRgb(cmyk: CmykColor): RgbColor {
  const c = clampPercent(cmyk.c) / 100
  const m = clampPercent(cmyk.m) / 100
  const y = clampPercent(cmyk.y) / 100
  const k = clampPercent(cmyk.k) / 100

  return {
    r: Math.round(255 * (1 - c) * (1 - k)),
    g: Math.round(255 * (1 - m) * (1 - k)),
    b: Math.round(255 * (1 - y) * (1 - k))
  }
}

export function normalizeHex(hex: string): string | null {
  const trimmed = hex.trim()
  const value = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed

  if (/^[0-9a-fA-F]{3}$/.test(value)) {
    return `#${value
      .split('')
      .map((part) => part + part)
      .join('')}`.toUpperCase()
  }

  if (/^[0-9a-fA-F]{6}$/.test(value)) {
    return `#${value}`.toUpperCase()
  }

  return null
}

export function getReadableTextColor(hex: string): '#0F172A' | '#FFFFFF' {
  const rgb = hexToRgb(hex)

  if (!rgb) {
    return '#0F172A'
  }

  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255

  return luminance > 0.62 ? '#0F172A' : '#FFFFFF'
}

function toHexByte(value: number): string {
  return clampByte(value).toString(16).padStart(2, '0')
}

function clampByte(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)))
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)))
}
