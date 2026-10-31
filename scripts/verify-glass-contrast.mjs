import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

// Check conservative backdrop extremes, including the frame and dark-mode sheen.
// Production artwork is deliberately outside the interface color system.
const css = await readFile(
  new URL('../src/renderer/src/design-system/tokens.css', import.meta.url),
  'utf8'
)
const light = css.match(/:root\s*\{([^}]+)\}/s)?.[1]
const dark = css.match(/:root\.dark,\s*:root\[data-theme='dark'\]\s*\{([^}]+)\}/s)?.[1]
assert.ok(light && dark, 'Light and dark token blocks are required')

function token(block, name) {
  const value = block.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1]?.trim()
  assert.ok(value, `Missing ${name}`)
  return value
}

function color(value) {
  const hex = value.match(/^#([\da-f]{6})$/i)
  if (hex) return [...Buffer.from(hex[1], 'hex'), 1]
  const rgb = value.match(/^rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\s*\)$/i)
  if (rgb) return rgb.slice(1).map(Number)
  const hsl = value.match(/^(\d+)\s+(\d+)%\s+(\d+)%$/)
  assert.ok(hsl, `Unsupported color ${value}`)
  const h = Number(hsl[1]) / 360,
    s = Number(hsl[2]) / 100,
    l = Number(hsl[3]) / 100
  const a = s * Math.min(l, 1 - l)
  const channel = (n) => {
    const k = (n + h * 12) % 12
    return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))
  }
  return [channel(0), channel(8), channel(4), 1]
}

function overlay(front, back) {
  return front.slice(0, 3).map((v, i) => v * front[3] + back[i] * (1 - front[3]))
}

function luminance(rgb) {
  return rgb.slice(0, 3).reduce((sum, value, i) => {
    const channel = value / 255
    const linear = channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    return sum + linear * [0.2126, 0.7152, 0.0722][i]
  }, 0)
}

function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((first, second) => second - first)
  return (x + 0.05) / (y + 0.05)
}

for (const [name, block] of [
  ['light', light],
  ['dark', dark]
]) {
  const read = (key) => color(token(block, key))
  const isDark = name === 'dark'
  const base = read(isDark ? 'ui-shell-highlight' : 'ui-shell-tint')
  const reflected = isDark ? overlay(read('ui-shell-reflection'), base) : base
  let backdrop = overlay(read('ui-shell-frame'), reflected)
  if (isDark) backdrop = overlay(read('ui-shell-sheen'), backdrop)
  for (const key of [
    'ui-text-secondary',
    'ui-text-muted',
    'ui-accent',
    'muted-foreground',
    'primary'
  ]) {
    const ratio = contrast(read(key), backdrop)
    assert.ok(ratio >= 4.5, `${name} ${key}: ${ratio.toFixed(2)}:1 against glass backdrop`)
    console.log(`${name} ${key}: ${ratio.toFixed(2)}:1`)
  }
  const control = overlay(read('ui-glass-control'), backdrop)
  const edge = contrast(read('ui-control-border'), control)
  assert.ok(edge >= 3, `${name} control edge: ${edge.toFixed(2)}:1`)
  console.log(`${name} control edge: ${edge.toFixed(2)}:1`)
}
