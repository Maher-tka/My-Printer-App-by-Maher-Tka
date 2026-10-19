import assert from 'node:assert/strict'
import { isFileDropTool, toolDropFormats, validateToolFileDrop } from './toolFileDrop'

const file = (name: string, content = 'artwork') => new File([content], name)
for (const route of Object.keys(toolDropFormats) as (keyof typeof toolDropFormats)[]) {
  assert.equal(isFileDropTool(route), true)
  assert.equal(validateToolFileDrop(route, [file('artwork.PDF')]), null)
  assert.ok(validateToolFileDrop(route, []))
  assert.ok(validateToolFileDrop(route, [file('artwork.pdf', '')]))
  assert.ok(validateToolFileDrop(route, [file('artwork.pdf'), file('document.docx')]))
}
assert.equal(isFileDropTool('settings'), false)
assert.equal(isFileDropTool('dashboard'), false)
assert.equal(validateToolFileDrop('card-montage', [file('front.png'), file('back.jpg')]), null)
assert.equal(validateToolFileDrop('card-montage', [file('front.pdf'), file('back.png')]), null)
assert.ok(
  validateToolFileDrop('card-montage', [file('one.png'), file('two.png'), file('three.png')])
)
assert.ok(validateToolFileDrop('sequential-number', [file('front.png'), file('back.png')]))
assert.equal(validateToolFileDrop('card-montage', [file('design.EPS')]), null)
assert.ok(validateToolFileDrop('sequential-number', [file('design.ai')]))
assert.ok(validateToolFileDrop('hardcover-cover', [file('design.png')]))
assert.ok(validateToolFileDrop('hardcover-cover', [file('one.pdf'), file('two.pdf')]))
assert.equal(validateToolFileDrop('hardcover-cover', [file('back.pdf'), file('front.pdf')]), null)
assert.equal(validateToolFileDrop('booklet-montage', [file('pages.pdf'), file('photo.JPG')]), null)
assert.equal(validateToolFileDrop('cutter-montage', [file('cut.svg'), file('design.ai')]), null)
assert.ok(validateToolFileDrop('cutter-montage', [file('photo.webp')]))
console.log('Tool sidebar file-drop validation passed.')
