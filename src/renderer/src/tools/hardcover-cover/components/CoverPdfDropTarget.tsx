import { useRef, useState, type ReactNode } from 'react'
import { isFileDrag, type HardcoverPdfDropTarget } from '../lib/pdfDrop'

/** Extends the existing upload button with a file drop target; internal drags are ignored. */
export function CoverPdfDropTarget({
  target,
  disabled,
  onFiles,
  children
}: {
  target: HardcoverPdfDropTarget
  disabled: boolean
  onFiles: (files: File[], target: HardcoverPdfDropTarget) => void
  children: ReactNode
}): JSX.Element {
  const depth = useRef(0)
  const [hovered, setHovered] = useState(false)
  return (
    <div
      data-hardcover-pdf-drop={target}
      className={`rounded-[14px] border border-dashed p-1 transition-colors ${hovered && !disabled ? 'border-primary bg-primary/10 ring-2 ring-primary/30' : 'border-border/70'}`}
      onDragEnter={(event) => {
        if (!isFileDrag(event.dataTransfer)) return
        event.preventDefault()
        event.stopPropagation()
        depth.current++
        setHovered(true)
      }}
      onDragLeave={() => {
        depth.current = Math.max(0, depth.current - 1)
        if (!depth.current) setHovered(false)
      }}
      onDragOver={(event) => {
        if (!isFileDrag(event.dataTransfer)) return
        event.preventDefault()
        event.stopPropagation()
        event.dataTransfer.dropEffect = disabled ? 'none' : 'copy'
      }}
      onDrop={(event) => {
        if (!isFileDrag(event.dataTransfer)) return
        event.preventDefault()
        event.stopPropagation()
        depth.current = 0
        setHovered(false)
        onFiles(Array.from(event.dataTransfer.files), target)
      }}
    >
      {children}
    </div>
  )
}
