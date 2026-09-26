import type { HardcoverProjectState } from '../types'

export const DEFAULT_SPINE_BACKGROUND_COLOR = '#ffffff'

export function resolveAutomaticSpineBackgroundColor(state: HardcoverProjectState): string {
  if (state.sourcePdf) return DEFAULT_SPINE_BACKGROUND_COLOR

  return normalizeHexColor(state.template.background, DEFAULT_SPINE_BACKGROUND_COLOR)
}

export function resolveSpineBackgroundColor(state: HardcoverProjectState): string {
  const automaticColor = resolveAutomaticSpineBackgroundColor(state)

  if (state.content.spine.spineColorMode !== 'custom') return automaticColor

  return normalizeHexColor(state.content.spine.spineBackgroundColor, automaticColor)
}

export function getSpineBackgroundFill(state: HardcoverProjectState): {
  color: string
  shouldDraw: boolean
} {
  const color = resolveSpineBackgroundColor(state)

  return {
    color,
    shouldDraw: state.content.spine.spineColorMode === 'custom' || Boolean(state.sourcePdf)
  }
}

export function normalizeHexColor(value: string | undefined, fallback: string): string {
  return parseHexColor(value) ?? parseHexColor(fallback) ?? DEFAULT_SPINE_BACKGROUND_COLOR
}

export function parseHexColor(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed) return undefined
  const short = /^#?([a-f\d])([a-f\d])([a-f\d])$/i.exec(trimmed)
  if (short) {
    return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toLowerCase()
  }
  const full = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(trimmed)
  if (!full) return undefined

  return `#${full[1]}${full[2]}${full[3]}`.toLowerCase()
}

export function hexToRgbChannels(hex: string): { red: number; green: number; blue: number } {
  const normalized = normalizeHexColor(hex, DEFAULT_SPINE_BACKGROUND_COLOR)

  return {
    red: parseInt(normalized.slice(1, 3), 16),
    green: parseInt(normalized.slice(3, 5), 16),
    blue: parseInt(normalized.slice(5, 7), 16)
  }
}

export function rgbChannelsToHex(red: number, green: number, blue: number): string {
  return `#${[red, green, blue]
    .map((channel) => clampRgb(channel).toString(16).padStart(2, '0'))
    .join('')}`
}

function clampRgb(value: number): number {
  return Math.min(255, Math.max(0, Math.round(Number.isFinite(value) ? value : 0)))
}
