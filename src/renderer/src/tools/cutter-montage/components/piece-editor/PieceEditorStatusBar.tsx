import type { EditorTool, PiecePreset } from '../../types'

export function PieceEditorStatusBar({
  piece,
  tool,
  zoom
}: {
  piece: PiecePreset
  tool: EditorTool
  zoom: number
}): JSX.Element {
  const mask = piece.clippingMaskEnabled
  const cutline = Boolean(
    piece.cutlineObjectId &&
    piece.objects.some((object) => object.id === piece.cutlineObjectId && object.visible)
  )
  return (
    <div
      className="mt-1 flex h-6 shrink-0 items-center gap-3 overflow-hidden whitespace-nowrap px-1 text-[11px] text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      <span>{getToolLabel(tool)}</span>
      <span>{Math.round(zoom * 100)}%</span>
      <span>{piece.selectedObjectIds.length} selected</span>
      {mask && (
        <span>{piece.maskEditingEnabled ? 'Editing clipping group' : 'Clipping group'}</span>
      )}
      <span>{cutline ? 'CutContour visible' : 'No visible CutContour'}</span>
    </div>
  )
}

function getToolLabel(tool: EditorTool): string {
  switch (tool) {
    case 'select':
      return 'Select'
    case 'pan':
      return 'Move'
    case 'rectangle':
      return 'Rectangle'
    case 'rounded-rectangle':
      return 'Rounded rectangle'
    case 'ellipse':
      return 'Ellipse'
    case 'line':
      return 'Draw path'
    default:
      return 'Select'
  }
}
