import assert from 'node:assert/strict'
import { PDFDocument } from 'pdf-lib'
import { createDefaultHardcoverProject } from '../hooks/useHardcoverProject'
import { exportHardcoverBatchPdf, exportHardcoverPdf } from './hardcoverExportPdf'
import { buildHardcoverSvg } from './hardcoverExportSvg'
import { mmToPoints } from './units'

const state = createDefaultHardcoverProject()
state.exportSettings.mode = 'production-guide'
state.exportSettings.includeFoldLines = true
state.exportSettings.includeSafeZones = true

const exported = await exportHardcoverPdf(state)
const document = await PDFDocument.load(exported.bytes)
assert.equal(document.getPageCount(), 1, 'single cover export has one page')
const page = document.getPage(0)
assert.ok(Math.abs(page.getWidth() - mmToPoints(480)) < 0.01, 'PDF width is exactly 480 mm')
assert.ok(Math.abs(page.getHeight() - mmToPoints(337)) < 0.01, 'PDF height is exactly 337 mm')

const students = Array.from({ length: 3 }, (_, index) => ({
  id: `student-${index}`,
  studentName: `Student ${index + 1}`,
  title: `Project ${index + 1}`,
  year: '2026',
  department: 'Printing',
  supervisor: 'Supervisor',
  spineTitle: `Project ${index + 1}`
}))
const batch = await PDFDocument.load(await exportHardcoverBatchPdf(state, students))
assert.equal(batch.getPageCount(), 3, 'combined batch export has one page per student')

const svg = buildHardcoverSvg(state)
assert.match(svg, /width="480mm" height="337mm" viewBox="0 0 480 337"/)
assert.match(svg, /id="Artwork"/)
assert.match(svg, /id="ProductionGuides"/)
assert.match(svg, /id="SafeZones"/)

console.log('Hardcover PDF, SVG, and batch export tests passed.')
