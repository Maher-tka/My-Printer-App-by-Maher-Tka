import assert from 'node:assert/strict'
import { getPathBounds, type PathBounds } from './pathBounds'

function expectBounds(path: string, expected: PathBounds, tolerance = 1e-8): void {
  const actual = getPathBounds(path)
  assert.ok(actual)
  for (const key of ['x', 'y', 'width', 'height'] as const)
    assert.ok(
      Math.abs(actual[key] - expected[key]) < tolerance,
      `${path}: ${key} ${actual[key]} != ${expected[key]}`
    )
}
expectBounds('M .2 .3 L .8 .3 L .8 .7 L .2 .7 Z', { x: 0.2, y: 0.3, width: 0.6, height: 0.4 })
expectBounds('M .2 .3 h .6 v .4 h -.6 z', { x: 0.2, y: 0.3, width: 0.6, height: 0.4 })
expectBounds('M 0 0 Z M .2 .3 L .8 .3 L .8 .7 Z', { x: 0.2, y: 0.3, width: 0.6, height: 0.4 })
expectBounds('M .1 .2 H .3 V .4 H .1 Z M .7 .6 H .9 V .8 H .7 Z', {
  x: 0.1,
  y: 0.2,
  width: 0.8,
  height: 0.6
})
expectBounds('M 0 .5 C 0 1.5 1 1.5 1 .5 Z', { x: 0, y: 0.5, width: 1, height: 0.75 })
expectBounds('M 0 .5 Q .5 1.5 1 .5 Z', { x: 0, y: 0.5, width: 1, height: 0.5 })
expectBounds(
  'M .2 .5 A .3 .3 0 1 0 .8 .5 A .3 .3 0 1 0 .2 .5 Z',
  { x: 0.2, y: 0.2, width: 0.6, height: 0.6 },
  0.0001
)
assert.equal(getPathBounds('M 0 0'), null)
assert.equal(getPathBounds('M 0 0 L 1 0 Z'), null)
assert.equal(getPathBounds('invalid'), null)
console.log('Cut-contour bounds: polygons, subpaths, relative commands and curve extrema passed.')
