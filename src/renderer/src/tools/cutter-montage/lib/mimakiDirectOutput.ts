import type { CutterProject } from '../types'
import { TARGET_CUTTER_PROFILE } from './cutterDeviceProfile'
import { getProductionSheetProject } from './productionSheets'
import { getRegistrationMarks } from './registrationMarks'

export type MimakiTransportMode = 'simulation' | 'official-sdk'

export interface MimakiDirectOutputConfig {
  enabled: boolean
  transportMode: MimakiTransportMode
  sdkAccessConfirmed: boolean
  sdkLicenseAccepted: boolean
  cg130arCoverageConfirmed: boolean
  hardwareValidated: boolean
}

export interface MimakiSheetJobPlan {
  targetProfileId: string
  targetModel: 'CG-130AR'
  sheetIndex: number
  widthCm: number
  heightCm: number
  copyCount: number
  presetIds: string[]
  containsGeneratedRegistrationMarks: boolean
}

export interface SimulatedMimakiResult {
  mode: 'simulation'
  sentToDevice: false
  plan: MimakiSheetJobPlan
}

export const DEFAULT_MIMAKI_DIRECT_OUTPUT_CONFIG: MimakiDirectOutputConfig = {
  enabled: false,
  transportMode: 'simulation',
  sdkAccessConfirmed: false,
  sdkLicenseAccepted: false,
  cg130arCoverageConfirmed: false,
  hardwareValidated: false
}

export function createMimakiSheetJobPlan(
  project: CutterProject,
  sheetIndex: number
): MimakiSheetJobPlan {
  const sheetProject = getProductionSheetProject(project, sheetIndex)

  if (
    sheetProject.sheet.widthCm > TARGET_CUTTER_PROFILE.applicationSheetMaxWidthCm ||
    sheetProject.sheet.heightCm > TARGET_CUTTER_PROFILE.applicationSheetMaxHeightCm
  ) {
    throw new Error(
      `The selected sheet exceeds the configured ${TARGET_CUTTER_PROFILE.applicationSheetMaxWidthCm} x ${TARGET_CUTTER_PROFILE.applicationSheetMaxHeightCm} cm application limit.`
    )
  }

  return {
    targetProfileId: TARGET_CUTTER_PROFILE.id,
    targetModel: 'CG-130AR',
    sheetIndex,
    widthCm: sheetProject.sheet.widthCm,
    heightCm: sheetProject.sheet.heightCm,
    copyCount: sheetProject.placedPieces.length,
    presetIds: [...new Set(sheetProject.placedPieces.map((piece) => piece.presetId))],
    containsGeneratedRegistrationMarks: getRegistrationMarks(sheetProject).length > 0
  }
}

export function simulateMimakiDirectOutput(
  project: CutterProject,
  sheetIndex: number
): SimulatedMimakiResult {
  return {
    mode: 'simulation',
    sentToDevice: false,
    plan: createMimakiSheetJobPlan(project, sheetIndex)
  }
}

export function assertOfficialMimakiOutputAvailable(config: MimakiDirectOutputConfig): void {
  const ready =
    config.enabled &&
    config.transportMode === 'official-sdk' &&
    config.sdkAccessConfirmed &&
    config.sdkLicenseAccepted &&
    config.cg130arCoverageConfirmed &&
    config.hardwareValidated

  if (!ready) {
    throw new Error(
      'Direct CG-130AR output is locked until the official Mimaki SDK, license, model coverage, configuration, and physical hardware validation are confirmed.'
    )
  }
}
