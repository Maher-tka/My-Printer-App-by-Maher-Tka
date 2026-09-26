import type { CutterProject } from '../types'
import { DEFAULT_CUTTER_SHEET } from './cutterLayout'
import { exportCutterEps } from './epsExport'
import { createMimakiJobManifest } from './mimakiJobPackage'
import { getRegistrationMarks, getRegistrationMarksSvgMarkup } from './registrationMarks'
import { exportCutterSvg } from './svgExport'

async function run(): Promise<void> {
  const project: CutterProject = {
    sheet: {
      ...DEFAULT_CUTTER_SHEET,
      widthCm: 20,
      heightCm: 30,
      lengthMode: 'fixed'
    },
    sources: [],
    pieces: [],
    placedPieces: [],
    layers: { artwork: true, cutlines: true },
    exportSettings: {
      strokeName: 'CutContour',
      includeArtwork: true,
      includeCutlines: true,
      includeRegistrationMarks: true,
      includeProductionLabel: false,
      mode: 'print-cut',
      preset: 'mimaki-cutcontour-svg'
    },
    productionInfo: {
      appName: 'My Printer App by Maher Tka',
      targetCutterProfileId: 'mimaki-cg-130ar',
      targetCutterLabel: 'Mimaki CG-130AR',
      integrationMode: 'offline-mimaki-package'
    }
  }

  const marks = getRegistrationMarks(project)
  expectEqual(marks.length, 5, 'four Type 1 corners plus one direction triangle')
  expectEqual(
    marks.map((mark) => mark.position),
    ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'direction'],
    'Mimaki mark positions'
  )
  expectEqual(marks[0]?.sizeMm, 10, 'shop-tested arm length')
  expectEqual(marks[0]?.strokeWidthMm, 1, 'shop-tested line width')

  const markup = getRegistrationMarksSvgMarkup(project)
  expect(markup.includes('M 0 10 H 10 V 0'), 'top-left L geometry matches FineCut sample')
  expect(markup.includes('stroke-width="1mm"'), 'Type 1 paths use a 1 mm stroke')
  expectEqual(countMatches(markup, 'data-mimaki-mark="type-1"'), 4, 'four L paths')
  expectEqual(countMatches(markup, 'data-mimaki-mark="direction"'), 1, 'one direction mark')

  const markedSvg = await (await exportCutterSvg(project)).blob.text()
  expect(markedSvg.includes('data-mimaki-mark="type-1"'), 'print-cut SVG contains marks')

  const cutOnlySvg = await (
    await exportCutterSvg({
      ...project,
      exportSettings: {
        ...project.exportSettings,
        includeArtwork: false,
        includeRegistrationMarks: false,
        mode: 'cut-only',
        preset: 'svg-eps-cut-only'
      }
    })
  ).blob.text()
  expect(!cutOnlySvg.includes('data-registration-mark='), 'cut-only SVG excludes all marks')

  const eps = await exportCutterEps(project).blob.text()
  expect(!eps.includes('0 0 0 setrgbcolor'), 'EPS knife output excludes black registration paths')

  const manifest = createMimakiJobManifest(project, [
    {
      printPdf: '01_Mimaki_Marked_Print_Layout_01_PRINT_1_COPY.pdf',
      printCutSvg: '02_Mimaki_PrintCut_Layout_01_PRINT_1_COPY.svg',
      cutSvg: '03_CutOnly_CutContour_Layout_01_RUN_1_CUT_PASS.svg',
      cutEps: '04_CutOnly_CutContour_Layout_01_RUN_1_CUT_PASS.eps',
      previewPdf: '05_Customer_Preview_Layout_01_PRINT_1_COPY.pdf'
    }
  ])
  expectEqual(manifest.schemaVersion, 2, 'repeat-aware manifest schema')
  expectEqual(manifest.workflow.illustratorRequired, false, 'manifest removes Illustrator')
  expectEqual(manifest.workflow.marksArePrintOnly, true, 'manifest keeps marks out of knife paths')
  expectEqual(
    manifest.workflow.identicalSheetsCollapsed,
    true,
    'manifest declares identical layout collapsing'
  )
  expectEqual(manifest.sheets[0]?.printCopies, 1, 'manifest records print repetition count')
  expectEqual(manifest.sheets[0]?.cutPasses, 1, 'manifest records matching cut repetition count')
  expectEqual(manifest.sheets[0]?.marks.length, 5, 'manifest records all sheet marks')
  expectEqual(manifest.registration.detectionMode, '4-point', 'manifest requests 4-point detection')

  console.log('Mimaki registration package tests passed.')
}

function countMatches(value: string, pattern: string): number {
  return value.split(pattern).length - 1
}

function expect(condition: boolean, label: string): asserts condition {
  if (!condition) throw new Error(label)
}

function expectEqual(actual: unknown, expected: unknown, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

void run()
