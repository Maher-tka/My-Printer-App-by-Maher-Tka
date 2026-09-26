import type { CutterProject } from '../types'
import { TARGET_CUTTER_LABEL, TARGET_CUTTER_PROFILE } from './cutterDeviceProfile'
import { getProductionSheetLayoutGroups } from './productionSheetGroups'
import { getProductionSheetProject } from './productionSheets'
import {
  getRegistrationMarks,
  MIMAKI_DIRECTION_MARK_HEIGHT_MM,
  MIMAKI_DIRECTION_MARK_WIDTH_MM,
  MIMAKI_TYPE_1_STROKE_MM
} from './registrationMarks'

export interface MimakiPackageSheetFiles {
  layeredPdf?: string
  printPdf: string
  printCutSvg: string
  cutSvg: string
  cutEps: string
  previewPdf: string
}

export interface MimakiJobManifest {
  schemaVersion: 2
  generatedBy: string
  targetCutter: {
    profileId: string
    model: string
  }
  workflow: {
    kind: 'offline-mimaki-package'
    illustratorRequired: false
    cutterConnectionRequiredDuringExport: false
    marksArePrintOnly: true
    identicalSheetsCollapsed: true
  }
  registration: {
    standard: 'Mimaki Type 1'
    detectionMode: '4-point'
    armLengthMm: number
    lineWidthMm: number
    directionTriangleMm: { width: number; height: number }
  }
  sheets: Array<{
    layoutNumber: number
    sourceSheetNumbers: number[]
    printCopies: number
    cutPasses: number
    widthMm: number
    heightMm: number
    copiesPerSheet: number
    totalCopies: number
    marks: Array<{
      id: string
      position: string
      xMm: number
      yMm: number
      widthMm: number
      heightMm: number
    }>
    files: MimakiPackageSheetFiles
  }>
}

export function createMimakiJobManifest(
  project: CutterProject,
  filesByLayout: MimakiPackageSheetFiles[]
): MimakiJobManifest {
  const layoutGroups = getProductionSheetLayoutGroups(project)
  const configuredArmLengthMm = project.sheet.registrationMarks?.sizeMm ?? 10

  return {
    schemaVersion: 2,
    generatedBy: project.productionInfo?.appName ?? 'My Printer App by Maher Tka',
    targetCutter: {
      profileId: TARGET_CUTTER_PROFILE.id,
      model: project.productionInfo?.targetCutterLabel ?? TARGET_CUTTER_LABEL
    },
    workflow: {
      kind: 'offline-mimaki-package',
      illustratorRequired: false,
      cutterConnectionRequiredDuringExport: false,
      marksArePrintOnly: true,
      identicalSheetsCollapsed: true
    },
    registration: {
      standard: 'Mimaki Type 1',
      detectionMode: '4-point',
      armLengthMm: configuredArmLengthMm,
      lineWidthMm: MIMAKI_TYPE_1_STROKE_MM,
      directionTriangleMm: {
        width: MIMAKI_DIRECTION_MARK_WIDTH_MM,
        height: MIMAKI_DIRECTION_MARK_HEIGHT_MM
      }
    },
    sheets: layoutGroups.map((group, layoutIndex) => {
      const sheetProject = getProductionSheetProject(project, group.templateSheetIndex)
      const marks = getRegistrationMarks(sheetProject)

      return {
        layoutNumber: layoutIndex + 1,
        sourceSheetNumbers: group.sheetIndices.map((sheetIndex) => sheetIndex + 1),
        printCopies: group.repeatCount,
        cutPasses: group.repeatCount,
        widthMm: sheetProject.sheet.widthCm * 10,
        heightMm: sheetProject.sheet.heightCm * 10,
        copiesPerSheet: group.copiesPerSheet,
        totalCopies: group.totalCopies,
        marks: marks.map((mark) => ({
          id: mark.id,
          position: mark.position,
          xMm: mark.xMm,
          yMm: mark.yMm,
          widthMm: mark.boundsCm.widthCm * 10,
          heightMm: mark.boundsCm.heightCm * 10
        })),
        files: filesByLayout[layoutIndex]!
      }
    })
  }
}

export function manifestToBytes(manifest: MimakiJobManifest): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(manifest, null, 2)}\n`)
}
