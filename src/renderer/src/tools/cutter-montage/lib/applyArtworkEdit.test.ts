import assert from 'node:assert/strict'
import { createPiecePresetFromSource } from './piecePresets'
import { createEditedArtwork } from './applyArtworkEdit'
import { synchronizePieceEditorModel } from './editorObjects'
const source = {
  id: 'original',
  fileName: 'design.png',
  displayName: 'Design',
  mimeType: 'image/png',
  bytes: new Uint8Array([1, 2]),
  previewUrl: 'original.png',
  naturalWidthPx: 100,
  naturalHeightPx: 80
}
const piece = createPiecePresetFromSource(source, [])
const result = {
  bytes: new Uint8Array([3, 4]),
  previewDataUrl: 'data:image/png;base64,AwQ=',
  widthPx: 100,
  heightPx: 80
}
const edited = createEditedArtwork(piece, result, 'edited')
assert.equal(piece.sourceId, 'original', 'original sticker remains unchanged')
assert.equal(edited.source.bytes, result.bytes, 'exports use the edited PNG bytes')
assert.equal(edited.piece.artwork.sourceId, 'edited')
assert.equal(edited.piece.objects.find((object) => object.role === 'artwork')?.sourceId, 'edited')
assert.deepEqual(
  edited.piece.artwork.transform,
  piece.artwork.transform,
  'background edits preserve artwork placement'
)
assert.deepEqual(edited.piece.mask, piece.mask, 'background edits preserve mask')
assert.deepEqual(edited.piece.cutline, piece.cutline, 'background edits preserve cutline')
assert.equal(synchronizePieceEditorModel(edited.piece).sourceId, 'edited')
assert.equal(edited.piece.quantity, piece.quantity)
console.log('Independent artwork edit tests passed.')
