import assert from 'node:assert/strict'
import { GIB, MIB, resolvePdfMemoryPolicy } from './pdf-memory.js'
import { pdfPickerOptions } from './pdf-files.js'

const profile = (gb: number) =>
  resolvePdfMemoryPolicy({
    totalBytes: gb * GIB,
    availableBytes: (gb * GIB) / 2,
    heapLimitBytes: 4 * GIB
  })
assert.equal(profile(4).maxInputBytes, 256 * MIB)
assert.equal(profile(8).maxInputBytes, 512 * MIB)
assert.equal(profile(16).maxInputBytes, GIB)
assert.equal(profile(32).maxInputBytes, GIB, 'Avoid unbounded JS buffer and parse working sets')
assert.equal(
  resolvePdfMemoryPolicy({ totalBytes: 8 * GIB, availableBytes: 512 * MIB }).maxInputBytes,
  160 * MIB
)
assert.ok(
  resolvePdfMemoryPolicy({ totalBytes: 16 * GIB, heapLimitBytes: 512 * MIB }).maxInputBytes <
    profile(16).maxInputBytes
)
assert.equal(
  resolvePdfMemoryPolicy({ totalBytes: NaN, availableBytes: -1 }).maxInputBytes,
  profile(8).maxInputBytes
)
assert.ok(profile(16).maxCanvasPixels > profile(4).maxCanvasPixels)
assert.deepEqual(pdfPickerOptions('merge').properties, ['openFile', 'multiSelections'])
assert.deepEqual(pdfPickerOptions('images').properties, ['openFile', 'multiSelections'])
assert.deepEqual(pdfPickerOptions('pdf').properties, ['openFile'])
assert.throws(() => pdfPickerOptions('__proto__' as 'pdf'), /Unsupported/)
console.log(
  'PDF memory budgets for 4/8/16/32 GB, memory pressure, heap constraints, and native multi-select options passed.'
)
