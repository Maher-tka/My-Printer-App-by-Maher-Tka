import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { PlacedPieceItem } from './PlacedPieceItem'
import { createPiecePresetFromSource, createPlacedPieceFromPreset } from '../lib/piecePresets'
import {
  makeClippingMaskAndCutlineFromSelection,
  synchronizePieceEditorModel
} from '../lib/editorObjects'
import { getPlacedProductionBounds } from '../lib/cutlineGenerator'
import type { EditorObject } from '../types'

const source = createPiecePresetFromSource(
  {
    id: 'preview-source',
    sourceKind: 'image',
    fileName: 'Large source with a cropped sticker.jpg',
    displayName: 'Cropped sticker',
    mimeType: 'image/jpeg',
    bytes: new Uint8Array(),
    previewUrl: 'blob:preview',
    naturalWidthPx: 1440,
    naturalHeightPx: 960
  },
  []
)
const cut: EditorObject = {
  id: 'preview-cut',
  type: 'cutline',
  role: 'cutline',
  shapeType: 'rectangle',
  name: 'CutContour',
  visible: true,
  locked: false,
  exportEnabled: true,
  offsetMm: 0,
  transform: { xCm: 6.5, yCm: 3.5, widthCm: 5, heightCm: 3, rotation: 0 }
}
const withCut = synchronizePieceEditorModel({
  ...source,
  objects: [...source.objects, cut],
  cutlineObjectId: cut.id
})
const piece = makeClippingMaskAndCutlineFromSelection(withCut, [source.artworkObjectId!, cut.id])
const snapshot = JSON.stringify(piece)
for (const rotation of [0, 90, 180, 270] as const) {
  const placed = createPlacedPieceFromPreset(piece, 10, 12, rotation)
  const bounds = getPlacedProductionBounds(placed, piece)
  const html = renderToStaticMarkup(
    <PlacedPieceItem
      piece={piece}
      placed={placed}
      scale={20}
      selected
      layers={{ artwork: true, cutlines: true }}
      sheetWidthCm={96}
      sheetHeightCm={100}
      snapStepCm={0.5}
      onSelect={() => {}}
      onMove={() => {}}
    />
  )
  const rootStyle = html.match(/^<div[^>]*style="([^"]+)"/)?.[1]
  assert.ok(rootStyle)
  assert.ok(
    rootStyle.includes(`width:${bounds.widthCm * 20}px`),
    'selection width follows cropped production bounds'
  )
  assert.ok(
    rootStyle.includes(`height:${bounds.heightCm * 20}px`),
    'selection height follows cropped production bounds'
  )
  assert.ok(
    rootStyle.includes(`translate3d(${bounds.xCm * 20}px, ${bounds.yCm * 20}px, 0)`),
    'hit target starts at the visible sticker'
  )
  assert.ok(!html.includes('<button'), 'editing commands stay in the canvas toolbar')
  assert.ok(html.includes('<clipPath'), 'artwork retains its clipping mask')
  assert.ok(html.includes('z-20'), 'selection renders above unselected copies')
}
assert.equal(
  JSON.stringify(piece),
  snapshot,
  'preview bounds do not modify artwork or production geometry'
)
console.log('Placed sticker preview bounds, quarter-turn masks and toolbar ownership passed.')
