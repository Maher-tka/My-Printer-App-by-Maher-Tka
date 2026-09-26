import type { CutterProject } from '../types'
import { DEFAULT_CUTTER_SHEET } from './cutterLayout'
import {
  assertOfficialMimakiOutputAvailable,
  DEFAULT_MIMAKI_DIRECT_OUTPUT_CONFIG,
  simulateMimakiDirectOutput
} from './mimakiDirectOutput'

const project: CutterProject = {
  sheet: DEFAULT_CUTTER_SHEET,
  sources: [],
  pieces: [],
  placedPieces: [],
  layers: { artwork: true, cutlines: true },
  exportSettings: {
    strokeName: 'CutContour',
    includeArtwork: true,
    includeCutlines: true,
    includeRegistrationMarks: false,
    mode: 'print-cut'
  }
}

const simulation = simulateMimakiDirectOutput(project, 0)
expectEqual(simulation.sentToDevice, false, 'simulation never contacts a cutter')
expectEqual(simulation.plan.targetModel, 'CG-130AR', 'simulation targets CG-130AR')
expectEqual(
  simulation.plan.containsGeneratedRegistrationMarks,
  true,
  'offline plan includes the app-generated Mimaki marks'
)
expect(simulation.plan.widthCm <= 96, 'simulation preserves the 96 cm sheet limit')

let realOutputBlocked = false
try {
  assertOfficialMimakiOutputAvailable(DEFAULT_MIMAKI_DIRECT_OUTPUT_CONFIG)
} catch {
  realOutputBlocked = true
}
expect(realOutputBlocked, 'real output remains locked without official SDK and hardware validation')

console.log('Mimaki direct-output scaffold tests passed.')

function expect(condition: boolean, label: string): asserts condition {
  if (!condition) throw new Error(label)
}

function expectEqual(actual: unknown, expected: unknown, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}
