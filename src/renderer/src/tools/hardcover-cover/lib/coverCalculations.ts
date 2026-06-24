import type { CoverDimensions, CoverSetup, CoverZone } from '../types'

export const DEFAULT_A4_COVER_SETUP: CoverSetup = {
  preset: 'a4',
  unit: 'cm',
  bookWidthMm: 210,
  bookHeightMm: 297,
  spineWidthMm: 20,
  wrap: { topMm: 20, rightMm: 20, bottomMm: 20, leftMm: 20 },
  hingeMm: 5,
  bleedMm: 0,
  paperWidthMm: 500,
  paperHeightMm: 350
}

export const DEFAULT_A5_COVER_SETUP: CoverSetup = {
  ...DEFAULT_A4_COVER_SETUP,
  preset: 'a5',
  bookWidthMm: 148,
  bookHeightMm: 210,
  spineWidthMm: 15,
  paperWidthMm: 350,
  paperHeightMm: 250
}

export function calculateCoverDimensions(setup: CoverSetup): CoverDimensions {
  const fullWidthMm =
    setup.wrap.leftMm +
    setup.bookWidthMm +
    setup.spineWidthMm +
    setup.bookWidthMm +
    setup.wrap.rightMm +
    setup.bleedMm * 2
  const fullHeightMm =
    setup.wrap.topMm + setup.bookHeightMm + setup.wrap.bottomMm + setup.bleedMm * 2
  const contentY = setup.bleedMm + setup.wrap.topMm
  const backX = setup.bleedMm + setup.wrap.leftMm
  const spineX = backX + setup.bookWidthMm
  const frontX = spineX + setup.spineWidthMm
  const safeInset = Math.max(setup.hingeMm, 3)
  const back = zone(backX, contentY, setup.bookWidthMm, setup.bookHeightMm)
  const spine = zone(spineX, contentY, setup.spineWidthMm, setup.bookHeightMm)
  const front = zone(frontX, contentY, setup.bookWidthMm, setup.bookHeightMm)
  const safeBack = insetZone(back, safeInset)
  const safeFront = insetZone(front, safeInset)
  const safeSpine = insetZone(spine, Math.min(safeInset, Math.max(setup.spineWidthMm / 4, 1)))
  const warnings: string[] = []

  if (setup.bookWidthMm <= 0 || setup.bookHeightMm <= 0 || setup.spineWidthMm <= 0) {
    warnings.push('Book width, height, and spine thickness must be greater than zero.')
  }
  if (setup.spineWidthMm < 8) {
    warnings.push('Spine is under 8 mm; readable spine text may not fit.')
  }
  if (Math.min(...Object.values(setup.wrap)) < 12) {
    warnings.push('One or more wrap margins are under 12 mm.')
  }
  if (fullWidthMm > setup.paperWidthMm || fullHeightMm > setup.paperHeightMm) {
    warnings.push('The generated cover exceeds the selected output paper size.')
  }

  return {
    fullWidthMm,
    fullHeightMm,
    orientation: fullWidthMm >= fullHeightMm ? 'landscape' : 'portrait',
    back,
    spine,
    front,
    safeBack,
    safeSpine,
    safeFront,
    warnings
  }
}

export function applyCoverPreset(current: CoverSetup, preset: CoverSetup['preset']): CoverSetup {
  if (preset === 'a4') return { ...DEFAULT_A4_COVER_SETUP, unit: current.unit }
  if (preset === 'a5') return { ...DEFAULT_A5_COVER_SETUP, unit: current.unit }
  return { ...current, preset: 'custom' }
}

function zone(xMm: number, yMm: number, widthMm: number, heightMm: number): CoverZone {
  return { xMm, yMm, widthMm, heightMm }
}

function insetZone(value: CoverZone, insetMm: number): CoverZone {
  return {
    xMm: value.xMm + insetMm,
    yMm: value.yMm + insetMm,
    widthMm: Math.max(0, value.widthMm - insetMm * 2),
    heightMm: Math.max(0, value.heightMm - insetMm * 2)
  }
}
