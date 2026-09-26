import { generateBookletSheets } from './bookletImposition'
import {
  DEFAULT_CREEP_SETTINGS,
  calculateEstimatedTotalCreep,
  calculateSheetCount,
  calculateSheetCreep,
  calculateTotalCreep,
  getCreepTranslation,
  getSimpleCreepToggleSettings,
  getSheetCreepMm,
  getSlotCreepTranslationMm,
  normalizeCreepSettings
} from './creepCompensation'

function expectClose(actual: number, expected: number, label: string): void {
  if (!Number.isFinite(actual) || Math.abs(actual - expected) > 1e-9) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`)
  }
}

function expectEqual(actual: unknown, expected: unknown, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

expectClose(calculateSheetCreep(0, 1, 1.2), 0, 'one-sheet booklet has no creep')
expectClose(calculateSheetCreep(0, 12, 1.1), 0, 'outermost sheet has no creep')
expectClose(calculateSheetCreep(11, 12, 1.1), 1.1, 'innermost sheet gets total creep')
expectClose(calculateSheetCreep(5, 12, 1.1), 0.5, 'middle sheet is proportional')
expectClose(
  getCreepTranslation({
    pageSide: 'left',
    spinePosition: 'between-pages',
    creepAmountMm: 0.85
  }),
  0.85,
  'left imposed slot moves right toward spine'
)
const simpleEnabled = getSimpleCreepToggleSettings(DEFAULT_CREEP_SETTINGS, true, 12)
expectEqual(
  [
    simpleEnabled.enabled,
    simpleEnabled.mode,
    simpleEnabled.measuredTotalCreepMm,
    simpleEnabled.showOverlay
  ],
  [true, 'measured', 1.2, true],
  'simple checkbox enables a visible measured fallback and overlay'
)
expectEqual(
  getSimpleCreepToggleSettings(simpleEnabled, false, 12).enabled,
  false,
  'simple checkbox disables creep'
)
expectClose(
  getCreepTranslation({
    pageSide: 'right',
    spinePosition: 'between-pages',
    creepAmountMm: 0.85
  }),
  -0.85,
  'right imposed slot moves left toward spine'
)
expectClose(
  calculateTotalCreep({ ...DEFAULT_CREEP_SETTINGS, measuredTotalCreepMm: 1.2 }, 12),
  0,
  'disabled creep produces zero total'
)

const invalid = normalizeCreepSettings({
  enabled: true,
  mode: 'automatic',
  measuredTotalCreepMm: Number.NaN,
  paperCaliperMm: Number.NaN,
  calibrationMultiplier: Number.NaN,
  manualTotalCreepMm: Number.POSITIVE_INFINITY,
  distribution: 'linear',
  showOverlay: true,
  paperPresets: []
})
expectEqual(
  [
    invalid.measuredTotalCreepMm,
    invalid.paperCaliperMm,
    invalid.calibrationMultiplier,
    invalid.manualTotalCreepMm
  ],
  [0, 0, 1, 0],
  'invalid values normalize safely'
)
expectClose(calculateSheetCreep(Number.NaN, Number.NaN, Number.NaN), 0, 'invalid math is finite')
expectClose(
  calculateEstimatedTotalCreep(12, 0.105, 1),
  1.155,
  'automatic estimate uses nested sheet count and paper caliper'
)
expectEqual(calculateSheetCount(46), 12, '46 source pages pad to 12 physical sheets')

const sheets = generateBookletSheets(
  Array.from({ length: 48 }, (_, index) => index + 1),
  'rtl'
)
const enabledMeasured = {
  ...DEFAULT_CREEP_SETTINGS,
  enabled: true,
  measuredTotalCreepMm: 1.1
}
expectClose(
  getSheetCreepMm(sheets[6].front, enabledMeasured),
  getSheetCreepMm(sheets[6].back, enabledMeasured),
  'front and back of a physical sheet share creep magnitude'
)
expectEqual(
  [
    getSlotCreepTranslationMm(sheets[6].front, 'left', enabledMeasured) > 0,
    getSlotCreepTranslationMm(sheets[6].front, 'right', enabledMeasured) < 0
  ],
  [true, true],
  'RTL still uses imposed left/right geometry'
)

console.log(
  'Creep compensation tests passed: sheet counts, linear distribution, directions, RTL geometry, automatic estimation, disabled and invalid states.'
)
