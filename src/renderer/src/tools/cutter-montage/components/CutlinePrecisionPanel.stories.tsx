import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { CutlinePrecisionPanel } from './CutlinePrecisionPanel'
import { createPiecePresetFromSource } from '../lib/piecePresets'
import {
  makeClippingMaskAndCutlineFromSelection,
  synchronizePieceEditorModel
} from '../lib/editorObjects'
import type { EditorObject } from '../types'

const meta = {
  title: 'Workflows/Cutter cut edge precision',
  parameters: { layout: 'padded' }
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

function Example({
  locked = false,
  customPath = false,
  compact = false
}: {
  locked?: boolean
  customPath?: boolean
  compact?: boolean
}) {
  const [piece, setPiece] = useState(() => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 10 10"><rect width="10" height="10" fill="white"/><circle cx="5" cy="5" r="2.4" fill="#405f8a"/></svg>'
    const base = createPiecePresetFromSource(
      {
        id: 'precision-example',
        sourceKind: 'image',
        fileName: 'sticker.svg',
        displayName: 'Sticker',
        mimeType: 'image/svg+xml',
        bytes: new TextEncoder().encode(svg),
        previewUrl: 'data:image/svg+xml,' + encodeURIComponent(svg),
        naturalWidthPx: 800,
        naturalHeightPx: 800
      },
      []
    )
    const cutline: EditorObject = {
      id: 'example-cut',
      type: 'cutline',
      role: 'cutline',
      shapeType: customPath ? 'path' : 'ellipse',
      name: 'CutContour',
      visible: true,
      locked: false,
      exportEnabled: true,
      offsetMm: 0,
      strokeName: 'CutContour',
      strokeColor: '#ff00ff',
      strokeWidthPt: 0.25,
      pathData: customPath ? 'M .5 0 L 1 .5 L .5 1 L 0 .5 Z' : undefined,
      transform: { xCm: 2.5, yCm: 2.5, widthCm: 5, heightCm: 5, rotation: 0 }
    }
    const masked = makeClippingMaskAndCutlineFromSelection(
      synchronizePieceEditorModel({
        ...base,
        objects: [...base.objects, cutline],
        cutlineObjectId: cutline.id
      }),
      [base.artworkObjectId!, cutline.id]
    )
    return synchronizePieceEditorModel({
      ...masked,
      objects: masked.objects.map((object) =>
        object.id === cutline.id ? { ...object, locked } : object
      )
    })
  })
  return (
    <div className={compact ? 'max-w-xs' : 'max-w-5xl'}>
      <CutlinePrecisionPanel
        layout={compact ? 'sidebar' : 'workspace'}
        piece={piece}
        onPieceChange={setPiece}
      />
    </div>
  )
}

export const Workspace: Story = { render: () => <Example /> }
export const LockedContour: Story = { render: () => <Example locked /> }
export const CustomPath: Story = { render: () => <Example customPath /> }
export const Sidebar: Story = { render: () => <Example compact /> }
