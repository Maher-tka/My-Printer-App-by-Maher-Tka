import { useEffect, useRef } from 'react'
import type { ToolFileDropProps } from './toolFileDrop'

/** Wait for lazy mounting/StrictMode and existing work before consuming a drop once. */
export function useDroppedToolFiles(
  { droppedFileImport, onDroppedFileImportConsumed }: ToolFileDropProps,
  busy: boolean,
  importFiles: (files: File[]) => Promise<void> | void
): void {
  const handledId = useRef<number | null>(null)
  const importer = useRef(importFiles)
  importer.current = importFiles
  useEffect(() => {
    if (!droppedFileImport || busy || handledId.current === droppedFileImport.id) return
    const timer = window.setTimeout(() => {
      handledId.current = droppedFileImport.id
      void Promise.resolve()
        .then(() => importer.current(droppedFileImport.files))
        .then(
          () => onDroppedFileImportConsumed?.(droppedFileImport.id),
          (error: unknown) =>
            onDroppedFileImportConsumed?.(
              droppedFileImport.id,
              error instanceof Error ? error.message : 'Could not read the dropped files.'
            )
        )
    }, 0)
    return () => window.clearTimeout(timer)
  }, [busy, droppedFileImport, onDroppedFileImportConsumed])
}
