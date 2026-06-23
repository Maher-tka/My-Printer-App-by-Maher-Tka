import type { PointerEvent as ReactPointerEvent } from 'react'
import type { ArtworkTransform, EditorObject } from '../../types'

export type TransformHandle =
  | 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'rotate'

interface PieceEditorTransformBoxProps {
  objects: EditorObject[]
  scale: number
  onHandlePointerDown: (
    event: ReactPointerEvent<HTMLButtonElement>,
    handle: TransformHandle,
    bounds: ArtworkTransform
  ) => void
}

const handles: Array<{ handle: Exclude<TransformHandle, 'rotate'>; left: string; top: string; cursor: string }> = [
  { handle: 'nw', left: '0%', top: '0%', cursor: 'nwse-resize' },
  { handle: 'n', left: '50%', top: '0%', cursor: 'ns-resize' },
  { handle: 'ne', left: '100%', top: '0%', cursor: 'nesw-resize' },
  { handle: 'e', left: '100%', top: '50%', cursor: 'ew-resize' },
  { handle: 'se', left: '100%', top: '100%', cursor: 'nwse-resize' },
  { handle: 's', left: '50%', top: '100%', cursor: 'ns-resize' },
  { handle: 'sw', left: '0%', top: '100%', cursor: 'nesw-resize' },
  { handle: 'w', left: '0%', top: '50%', cursor: 'ew-resize' }
]

export function PieceEditorTransformBox({
  objects,
  scale,
  onHandlePointerDown
}: PieceEditorTransformBoxProps): JSX.Element | null {
  if (objects.length === 0 || objects.every((object) => object.locked)) return null
  const bounds = getSelectionBounds(objects)

  return (
    <div
      className="pointer-events-none absolute z-40 border border-primary"
      style={{
        left: bounds.xCm * scale,
        top: bounds.yCm * scale,
        width: bounds.widthCm * scale,
        height: bounds.heightCm * scale
      }}
    >
      <div className="absolute left-1/2 top-[-24px] h-6 border-l border-primary" />
      <button
        type="button"
        className="pointer-events-auto absolute left-1/2 top-[-30px] size-3 -translate-x-1/2 rounded-full border border-white bg-primary shadow"
        style={{ cursor: 'grab' }}
        aria-label="Rotate selection"
        onPointerDown={(event) => onHandlePointerDown(event, 'rotate', bounds)}
      />
      {handles.map(({ handle, left, top, cursor }) => (
        <button
          key={handle}
          type="button"
          className="pointer-events-auto absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-white bg-primary shadow"
          style={{ left, top, cursor }}
          aria-label={`Resize selection ${handle}`}
          onPointerDown={(event) => onHandlePointerDown(event, handle, bounds)}
        />
      ))}
    </div>
  )
}

export function getSelectionBounds(objects: EditorObject[]): ArtworkTransform {
  const left = Math.min(...objects.map((object) => object.transform.xCm))
  const top = Math.min(...objects.map((object) => object.transform.yCm))
  const right = Math.max(...objects.map((object) => object.transform.xCm + object.transform.widthCm))
  const bottom = Math.max(...objects.map((object) => object.transform.yCm + object.transform.heightCm))
  return { xCm: left, yCm: top, widthCm: right - left, heightCm: bottom - top, rotation: 0 }
}
