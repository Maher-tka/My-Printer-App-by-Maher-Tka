import { useCallback, useEffect, useRef, useState } from 'react'
import {
  isFileDrag,
  planHardcoverPdfDrop,
  type HardcoverPdfDropImport,
  type HardcoverPdfDropTarget
} from '../lib/pdfDrop'
import { markHardcoverPdfImportTarget } from '../lib/sourcePdf'

export function useHardcoverPdfDrop(
  onImport: (file: File) => Promise<void>,
  disabled = false
): {
  importingPdf: boolean
  pdfDropMessage: string | null
  importPdfFile: (file: File) => Promise<void>
  dropPdfFiles: (files: File[], target?: HardcoverPdfDropTarget) => void
  runSourceOperation: <T>(operation: () => Promise<T>) => Promise<T>
} {
  const importing = useRef(false)
  const mounted = useRef(true)
  const [importingPdf, setImporting] = useState(false)
  const [pdfDropMessage, setMessage] = useState<string | null>(null)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const runSourceOperation = useCallback(
    async <T>(operation: () => Promise<T>): Promise<T> => {
      if (importing.current || disabled)
        throw new Error('Wait for the current operation to finish before importing another PDF.')
      importing.current = true
      setImporting(true)
      try {
        return await operation()
      } finally {
        importing.current = false
        if (mounted.current) setImporting(false)
      }
    },
    [disabled]
  )

  const run = useCallback(
    (imports: HardcoverPdfDropImport[], dropped: boolean): Promise<void> =>
      runSourceOperation(async () => {
        setMessage(dropped ? 'Reading dropped PDF…' : null)
        let completed = 0
        try {
          for (const item of imports) {
            if (item.target) markHardcoverPdfImportTarget(item.file, item.target)
            await onImport(item.file)
            completed++
            if (!mounted.current) return
          }
          if (dropped && mounted.current)
            setMessage(
              imports.length === 2
                ? 'Front and back PDFs loaded. Review the cover pages and spine text.'
                : `${imports[0].target === 'back' ? 'Back cover' : imports[0].target === 'single' ? 'Book' : 'Front cover'} PDF loaded.`
            )
        } catch (error) {
          if (dropped && mounted.current)
            setMessage(
              `${completed ? 'Front cover loaded; the back PDF could not be loaded. ' : ''}${error instanceof Error ? error.message : 'Could not read the dropped PDF.'}`
            )
          throw error
        }
      }),
    [onImport, runSourceOperation]
  )

  const importPdfFile = useCallback((file: File) => run([{ file }], false), [run])
  const dropPdfFiles = useCallback(
    (files: File[], target?: HardcoverPdfDropTarget): void => {
      try {
        if (importing.current || disabled)
          throw new Error('Wait for the current operation to finish before dropping another PDF.')
        const imports = planHardcoverPdfDrop(files, target)
        void run(imports, true).catch(() => {
          /* The visible status reports import failures. */
        })
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Could not read the dropped files.')
      }
    },
    [disabled, run]
  )

  useEffect(() => {
    const dragOver = (event: DragEvent): void => {
      if (!event.dataTransfer || !isFileDrag(event.dataTransfer)) return
      event.preventDefault()
      event.dataTransfer.dropEffect = importing.current || disabled ? 'none' : 'copy'
    }
    const drop = (event: DragEvent): void => {
      if (!event.dataTransfer || !isFileDrag(event.dataTransfer) || event.defaultPrevented) return
      event.preventDefault()
      dropPdfFiles(Array.from(event.dataTransfer.files))
    }
    window.addEventListener('dragover', dragOver)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragover', dragOver)
      window.removeEventListener('drop', drop)
    }
  }, [disabled, dropPdfFiles])

  return { importingPdf, pdfDropMessage, importPdfFile, dropPdfFiles, runSourceOperation }
}
