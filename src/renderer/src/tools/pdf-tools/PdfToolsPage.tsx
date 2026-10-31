import { useEffect, useRef, useState, type DragEvent } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ArrowRight,
  CheckCircle2,
  FileText,
  Files,
  Search,
  ArrowDownAZ,
  ShieldCheck,
  X,
  LoaderCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ActionButton } from '@/components/ui/action-button'
import { ClearButton } from '@/components/ui/clear-button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { useLanguage } from '@/i18n/useLanguage'
import { cn } from '@/lib/utils'
import { ToolHeader } from '../shared/ToolHeader'
import type { AppRoute } from '@/types/navigation'
import type { OfficePdfCapabilities } from '../../../../shared/pdf-office'
import {
  PDF_TOOLS,
  PDF_CATEGORIES,
  DEFAULT_PDF_OPTIONS,
  OFFICE_PDF_KIND,
  fileStem,
  formatBytes,
  validatePdfFiles,
  parsePageGroups,
  type PdfCategory,
  type PdfInput,
  type PdfOutput,
  type PdfTool,
  type PdfToolId
} from './model'
import { inspectPdf, runPdfTool } from './conversions'
import { PdfToolSettings } from './PdfToolSettings'
import { PdfEditor, type PdfEditorHandle } from './PdfEditor'
import { PdfOutputPreview } from './PdfOutputPreview'
import { getPdfMemoryPolicy, refreshPdfMemoryPolicy } from './memoryPolicy'
import { optionalPdfNativeCall } from './nativePdfBridge'
import type { PdfPickerKind } from '../../../../shared/pdf-files'
import './pdf-tools.css'

interface PdfImportSource {
  name: string
  size: number
  loadBytes: () => Promise<Uint8Array>
}
const browserFileSource = (file: File): PdfImportSource => ({
  name: file.name,
  size: file.size,
  loadBytes: async () => new Uint8Array(await file.arrayBuffer())
})

export function PdfToolsPage({
  onNavigate
}: {
  onNavigate: (route: AppRoute) => void
}): JSX.Element {
  const { t, direction } = useLanguage()
  const [toolId, setToolId] = useState<PdfToolId | null>(null),
    [showGallery, setShowGallery] = useState(true)
  const [pendingTool, setPendingTool] = useState<PdfToolId | null>(null)
  const [category, setCategory] = useState<PdfCategory>('All tools'),
    [query, setQuery] = useState('')
  const [inputs, setInputs] = useState<PdfInput[]>([]),
    [options, setOptions] = useState(DEFAULT_PDF_OPTIONS)
  const [output, setOutput] = useState<PdfOutput | null>(null),
    [busy, setBusy] = useState(false),
    [saving, setSaving] = useState(false)
  const [error, setError] = useState(''),
    [status, setStatus] = useState(''),
    [dragging, setDragging] = useState(false)
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)
  const [memoryPolicy, setMemoryPolicy] = useState(getPdfMemoryPolicy)
  const [importIssues, setImportIssues] = useState<string[]>([])
  const [picking, setPicking] = useState(false)
  const [activity, setActivity] = useState<'import' | 'process' | 'print'>('process')
  const [capabilities, setCapabilities] = useState<OfficePdfCapabilities | null>(null)
  const fileInput = useRef<HTMLInputElement>(null),
    controller = useRef<AbortController | null>(null),
    editor = useRef<PdfEditorHandle>(null)
  const inputsRef = useRef(inputs)
  inputsRef.current = inputs
  const busyRef = useRef(false)
  const returnFocus = useRef<HTMLElement | null>(null)
  const tool = PDF_TOOLS.find((tool) => tool.id === toolId)
  const officeKind =
    toolId && toolId in OFFICE_PDF_KIND
      ? OFFICE_PDF_KIND[toolId as keyof typeof OFFICE_PDF_KIND]
      : null
  const officeUnavailable = Boolean(
    officeKind && capabilities && !capabilities[officeKind] && !capabilities.libreOffice
  )
  const filtered = PDF_TOOLS.filter(
    (tool) =>
      (category === 'All tools' || category === tool.category) &&
      `${t(tool.title)} ${tool.title}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase().trim())
  )
  const totalBytes = inputs.reduce((sum, input) => sum + input.bytes.length, 0)
  const totalPages = inputs.reduce((sum, input) => sum + (input.pages ?? 0), 0)
  let validation = ''
  if (toolId === 'merge' && inputs.length < 2) validation = 'Add at least two PDF files to merge.'
  try {
    if (
      inputs[0]?.pages &&
      ['split', 'pdf-word', 'pdf-powerpoint', 'pdf-excel', 'pdf-jpg'].includes(toolId ?? '') &&
      !(toolId === 'split' && options.splitMode === 'every')
    )
      parsePageGroups(options.ranges, inputs[0].pages)
  } catch (error) {
    validation = (error as Error).message
  }
  const canRun =
    inputs.length > 0 &&
    !validation &&
    !officeUnavailable &&
    !busy &&
    !picking &&
    !saving &&
    (!officeKind || Boolean(capabilities))

  useEffect(() => {
    let current = true
    const api = window.printerApp?.pdf
    void refreshPdfMemoryPolicy(api?.machineMemory).then((policy) => {
      if (current) setMemoryPolicy(policy)
    })
    if (api)
      void api
        .officeCapabilities()
        .then((value) => {
          if (current) setCapabilities(value)
        })
        .catch(() => {
          if (current)
            setCapabilities({ word: false, powerpoint: false, excel: false, libreOffice: false })
        })
    else setCapabilities({ word: false, powerpoint: false, excel: false, libreOffice: false })
    return () => {
      current = false
    }
  }, [])
  useEffect(
    () => () => {
      controller.current?.abort()
      inputsRef.current.forEach((input) => {
        if (input.thumbnail) URL.revokeObjectURL(input.thumbnail)
      })
    },
    []
  )

  const invalidate = (): void => {
    setOutput(null)
    setStatus('')
    setError('')
  }
  const clear = (): void => {
    inputs.forEach((input) => {
      if (input.thumbnail) URL.revokeObjectURL(input.thumbnail)
    })
    setInputs([])
    setImportIssues([])
    invalidate()
    setProgress(null)
  }
  const choose = (id: PdfToolId): void => {
    if (inputs.length && id !== toolId) {
      returnFocus.current = document.activeElement as HTMLElement
      setPendingTool(id)
      return
    }
    if (id !== toolId) {
      clear()
      setOptions(DEFAULT_PDF_OPTIONS)
    }
    setToolId(id)
    setShowGallery(false)
  }
  const importFiles = async (files: PdfImportSource[]): Promise<void> => {
    if (!tool || busyRef.current) return
    const abort = new AbortController(),
      imported: PdfInput[] = []
    const issues: string[] = []
    let canceled = false
    try {
      busyRef.current = true
      setActivity('import')
      setBusy(true)
      setError('')
      setStatus('')
      setProgress({ current: 0, total: files.length })
      controller.current = abort
      const valid = files.filter((file) => {
        try {
          validatePdfFiles(tool, [file])
          return true
        } catch (error) {
          issues.push(`${file.name}: ${t((error as Error).message)}`)
          return false
        }
      })
      if (!valid.length) {
        setImportIssues(issues)
        return
      }
      validatePdfFiles(tool, valid, tool.multiple ? totalBytes : 0)
      for (const [index, file] of valid.entries()) {
        abort.signal.throwIfAborted()
        try {
          let input: PdfInput = {
            id: crypto.randomUUID(),
            name: file.name,
            bytes: await file.loadBytes()
          }
          if (tool.accept === '.pdf') input = await inspectPdf(input, abort.signal)
          else if (tool.id === 'jpg-pdf') {
            const blob = new Blob([new Uint8Array(input.bytes)], {
              type: file.name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'
            })
            const image = await createImageBitmap(blob, { resizeWidth: 240 })
            const canvas = document.createElement('canvas')
            try {
              canvas.width = image.width
              canvas.height = image.height
              canvas.getContext('2d')!.drawImage(image, 0, 0)
              const thumbnail = await new Promise<Blob>((resolve, reject) =>
                canvas.toBlob(
                  (value) =>
                    value ? resolve(value) : reject(new Error('Could not render this page.')),
                  'image/jpeg',
                  0.7
                )
              )
              input.thumbnail = URL.createObjectURL(thumbnail)
            } finally {
              image.close()
              canvas.width = 0
              canvas.height = 0
            }
          }
          imported.push(input)
        } catch (error) {
          if (abort.signal.aborted) throw error
          issues.push(`${file.name}: ${t((error as Error).message)}`)
        }
        setProgress({ current: index + 1, total: files.length })
      }
    } catch (error) {
      if (!abort.signal.aborted) setError((error as Error).message)
      else canceled = true
    } finally {
      if (imported.length) {
        if (!tool.multiple)
          inputs.forEach((input) => {
            if (input.thumbnail) URL.revokeObjectURL(input.thumbnail)
          })
        setInputs(tool.multiple ? [...inputs, ...imported] : imported)
        setOutput(null)
      }
      setImportIssues(issues)
      if (canceled) setStatus('Import stopped. Completed files were kept.')
      else if (imported.length)
        setStatus(
          t('Imported {count} of {total} files.')
            .replace('{count}', String(imported.length))
            .replace('{total}', String(files.length))
        )
      busyRef.current = false
      setBusy(false)
      setProgress(null)
      controller.current = null
    }
  }
  const pickFiles = async (): Promise<void> => {
    if (!tool || picking || busy || saving) return
    const api = window.printerApp?.pdf
    if (!api?.selectFiles) {
      fileInput.current?.click()
      return
    }
    setPicking(true)
    setError('')
    try {
      setMemoryPolicy(await refreshPdfMemoryPolicy(api.machineMemory))
      const kind: PdfPickerKind =
        tool.id === 'merge' ? 'merge' : tool.id === 'jpg-pdf' ? 'images' : (officeKind ?? 'pdf')
      const result = await optionalPdfNativeCall('pdf:select-files', () => api.selectFiles(kind))
      if (!result) {
        fileInput.current?.click()
        return
      }
      if (result.ok)
        await importFiles(
          result.files.map((file) => ({
            ...file,
            loadBytes: async () => {
              const loaded = await api.readSelectedFile(file.id)
              if (!loaded.ok) throw new Error(loaded.error)
              return loaded.bytes
            }
          }))
        )
      else if (!result.canceled) setError(result.error || 'Could not open the file picker.')
    } catch (error) {
      setError((error as Error).message)
    } finally {
      setPicking(false)
    }
  }
  const run = async (): Promise<void> => {
    if (!tool || !canRun || busyRef.current) return
    const abort = new AbortController()
    controller.current = abort
    busyRef.current = true
    setActivity('process')
    setBusy(true)
    setError('')
    setStatus('')
    setProgress(null)
    try {
      let result: PdfOutput
      if (officeKind) {
        const api = window.printerApp?.pdf
        if (!api) throw new Error('Office conversion is available in the desktop app.')
        const converted = await api.convertOffice({
          kind: officeKind,
          fileName: inputs[0].name,
          bytes: inputs[0].bytes
        })
        if (!converted.ok) throw new Error(converted.error)
        result = {
          name: `${fileStem(inputs[0].name)}.pdf`,
          bytes: converted.bytes,
          mime: 'application/pdf'
        }
      } else if (toolId === 'edit') {
        if (!editor.current) throw new Error('Preparing preview…')
        result = {
          name: `${fileStem(inputs[0].name)}-edited.pdf`,
          bytes: await editor.current.exportPdf(abort.signal),
          mime: 'application/pdf'
        }
      } else
        result = await runPdfTool(
          tool.id,
          inputs,
          options,
          (current, total) => setProgress({ current, total }),
          abort.signal
        )
      abort.signal.throwIfAborted()
      setOutput(result)
    } catch (error) {
      if (abort.signal.aborted) setStatus('Operation canceled.')
      else setError((error as Error).message)
    } finally {
      busyRef.current = false
      setBusy(false)
      setProgress(null)
      controller.current = null
    }
  }
  const save = async (): Promise<void> => {
    if (!output || saving) return
    setSaving(true)
    setError('')
    setStatus('')
    try {
      if (window.printerApp) {
        const extension = output.name.split('.').pop()!
        const result = await window.printerApp.saveFile({
          suggestedName: output.name,
          bytes: output.bytes,
          filters: [{ name: extension.toUpperCase(), extensions: [extension] }]
        })
        if (!result.ok && !result.canceled)
          throw new Error(result.error || 'Could not save the output file.')
        if (result.ok) setStatus('File saved.')
      } else {
        const url = URL.createObjectURL(
            new Blob([new Uint8Array(output.bytes)], { type: output.mime })
          ),
          link = document.createElement('a')
        link.href = url
        link.download = output.name
        link.click()
        setTimeout(() => URL.revokeObjectURL(url), 10_000)
        setStatus('Download started.')
      }
    } catch (error) {
      setError((error as Error).message)
    } finally {
      setSaving(false)
    }
  }
  const print = async (): Promise<void> => {
    if (!output || !window.printerApp || busy) return
    setBusy(true)
    setActivity('print')
    setError('')
    try {
      const result = await window.printerApp.printPdf({
        bytes: output.bytes,
        suggestedName: output.name,
        silent: false
      })
      if (!result.ok && !result.canceled) throw new Error(result.error || 'Printing failed.')
      setStatus(result.ok ? 'Sent to printer.' : 'Print canceled.')
    } catch (error) {
      setError((error as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const move = (index: number, delta: number): void => {
    const next = [...inputs]
    ;[next[index], next[index + delta]] = [next[index + delta], next[index]]
    setInputs(next)
    invalidate()
  }
  const drop = (event: DragEvent): void => {
    event.preventDefault()
    setDragging(false)
    event.stopPropagation()
    if (!busy && !saving && !picking)
      void importFiles(Array.from(event.dataTransfer.files).map(browserFileSource))
  }

  return (
    <div className="pdf-tools space-y-4" dir={direction}>
      {showGallery && (
        <>
          <ToolHeader
            title="PDF Tools"
            onBack={() => onNavigate('dashboard')}
            backLabel="Dashboard"
          />
          <section className="pdf-hub-panel">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="pdf-hub-mark">
                  <Files aria-hidden="true" />
                </div>
                <span className="font-medium tabular-nums">
                  {PDF_TOOLS.length} {t('tools')}
                </span>
              </div>
              <label className="relative w-full sm:w-72">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground rtl:left-auto rtl:right-3"
                />
                <Input
                  className="ps-9"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t('Search PDF tools')}
                  aria-label={t('Search PDF tools')}
                />
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-2" aria-label={t('PDF tool categories')}>
              {PDF_CATEGORIES.map((item) => (
                <Button
                  key={item}
                  type="button"
                  size="sm"
                  variant={category === item ? 'selected' : 'ghost'}
                  aria-pressed={category === item}
                  onClick={() => setCategory(item)}
                >
                  {t(item)}
                </Button>
              ))}
            </div>
          </section>
          <div className="pdf-tool-grid">
            {filtered.map((item) => (
              <PdfToolCard
                key={item.id}
                tool={item}
                onClick={() => choose(item.id)}
                selected={toolId === item.id && inputs.length > 0}
              />
            ))}
          </div>
          {!filtered.length && (
            <div className="pdf-hub-panel py-12 text-center text-muted-foreground" role="status">
              {t('No matching PDF tools.')}
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setQuery('')
                  setCategory('All tools')
                }}
              >
                {t('Reset search')}
              </Button>
            </div>
          )}
          <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
            <ShieldCheck className="size-4" aria-hidden="true" />
            {t('Files stay on this computer')}
          </div>
        </>
      )}
      {tool && (
        <div className={cn('space-y-4', showGallery && 'hidden')}>
          <ToolHeader
            title={tool.title}
            onBack={() => setShowGallery(true)}
            backDisabled={busy || saving || picking}
            backLabel="PDF Tools"
            actions={
              <ClearButton onClear={clear} disabled={busy || saving || picking || !inputs.length} />
            }
            output={
              output ? (
                <ActionButton
                  action="save"
                  variant={output.mime === 'application/pdf' ? 'outline' : 'default'}
                  isBusy={saving}
                  disabled={busy}
                  onClick={() => void save()}
                >
                  {t('Save file')}
                </ActionButton>
              ) : (
                <ActionButton
                  action="export"
                  variant="default"
                  isBusy={busy}
                  busyLabel="Processing…"
                  disabled={!canRun}
                  onClick={() => void run()}
                >
                  {t(tool.action)}
                </ActionButton>
              )
            }
            print={
              output?.mime === 'application/pdf'
                ? { disabled: busy || saving, onPrint: () => void print(), isBusy: busy }
                : undefined
            }
          />
          <input
            ref={fileInput}
            type="file"
            hidden
            key={tool.id}
            accept={tool.accept === '.pdf' ? 'application/pdf,.pdf' : tool.accept}
            multiple={tool.multiple === true}
            onChange={(event) => {
              const files = Array.from(event.target.files ?? [])
              event.target.value = ''
              if (files.length) void importFiles(files.map(browserFileSource))
            }}
          />
          {officeUnavailable && (
            <div className="pdf-hub-panel border-warning text-sm" role="status">
              {t('Install Microsoft Office or LibreOffice to convert Office files locally.')}
            </div>
          )}
          {error && (
            <div
              className="rounded-[var(--ui-radius-md)] border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
              role="alert"
            >
              {t(error)}
            </div>
          )}
          {status && (
            <p role="status" className="px-1 text-sm text-muted-foreground">
              {t(status)}
            </p>
          )}
          {importIssues.length > 0 && (
            <div
              role="status"
              className="rounded-[var(--ui-radius-md)] border border-[var(--ui-warning)] bg-warning p-3 text-warning-foreground"
            >
              <p className="font-medium">{t('Some files could not be imported')}</p>
              <ul className="mt-2 space-y-1 text-xs">
                {importIssues.map((issue, index) => (
                  <li key={index} className="break-all" dir="auto">
                    {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {busy && (
            <div
              className="pdf-hub-panel flex flex-wrap items-center gap-3"
              role="status"
              aria-live="polite"
            >
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              <span>
                {t(
                  activity === 'import'
                    ? 'Importing files…'
                    : activity === 'print'
                      ? 'Preparing print…'
                      : 'Processing…'
                )}
              </span>
              {progress && (
                <span className="tabular-nums text-muted-foreground">
                  {progress.current} / {progress.total}
                </span>
              )}
              {(activity === 'import' || (activity === 'process' && !officeKind)) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="ms-auto"
                  onClick={() => controller.current?.abort()}
                >
                  {t('Cancel')}
                </Button>
              )}
            </div>
          )}
          <div className="pdf-workspace-grid">
            <section
              className={cn('pdf-hub-panel min-w-0', dragging && 'pdf-dropzone-active')}
              onDragOver={(event) => {
                if (event.dataTransfer.types.includes('Files')) {
                  event.preventDefault()
                  event.stopPropagation()
                  if (!busy && !saving) setDragging(true)
                }
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false)
              }}
              onDrop={drop}
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-semibold">{t('Files')}</h2>
                <div className="flex flex-wrap gap-2">
                  {tool.multiple && inputs.length > 1 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy || saving || picking}
                      onClick={() => {
                        setInputs(
                          [...inputs].sort((a, b) =>
                            a.name.localeCompare(b.name, undefined, { numeric: true })
                          )
                        )
                        invalidate()
                      }}
                    >
                      <ArrowDownAZ />
                      {t('Sort by name')}
                    </Button>
                  )}
                  <ActionButton
                    action="import"
                    variant={inputs.length ? 'outline' : 'default'}
                    disabled={busy || saving || picking}
                    onClick={() => void pickFiles()}
                  >
                    {t(
                      tool.multiple && inputs.length
                        ? 'Add files'
                        : tool.accept === '.pdf'
                          ? tool.multiple
                            ? 'Import PDFs'
                            : 'Import PDF'
                          : 'Import files'
                    )}
                  </ActionButton>
                </div>
              </div>
              {!inputs.length ? (
                <div
                  className={cn('pdf-dropzone', dragging && 'pdf-dropzone-active')}
                  onDragOver={(event) => {
                    event.preventDefault()
                    if (!busy) setDragging(true)
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={drop}
                >
                  <tool.icon
                    className="size-10 text-primary"
                    strokeWidth={1.4}
                    aria-hidden="true"
                  />
                  <p className="font-medium">{t('Drop files here')}</p>
                  <p className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{tool.accept.replace(/\./g, '').replace(/,/g, ' / ').toUpperCase()}</span>
                    <span>
                      {formatBytes(memoryPolicy.maxInputBytes)} {t('total')}
                    </span>
                  </p>
                </div>
              ) : (
                <>
                  <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      {inputs.length} {t('files')}
                    </span>
                    {totalPages > 0 && (
                      <span>
                        {totalPages} {t('pages')}
                      </span>
                    )}
                    <span>{formatBytes(totalBytes)}</span>
                  </div>
                  <ol className="space-y-2">
                    {inputs.map((input, index) => (
                      <li key={input.id} className="pdf-file-row">
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        {input.thumbnail ? (
                          <img
                            src={input.thumbnail}
                            alt=""
                            className="h-16 w-12 shrink-0 rounded object-contain bg-muted"
                          />
                        ) : (
                          <FileText
                            className="mx-2 size-8 shrink-0 text-primary"
                            aria-hidden="true"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="break-all text-sm font-medium" dir="auto">
                            {input.name}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {input.pages ? `${input.pages} ${t('pages')} · ` : ''}
                            {formatBytes(input.bytes.length)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {tool.multiple && (
                            <>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`${t('Move up')}: ${input.name}`}
                                disabled={busy || saving || index === 0}
                                onClick={() => move(index, -1)}
                              >
                                <ArrowUp />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`${t('Move down')}: ${input.name}`}
                                disabled={busy || saving || index === inputs.length - 1}
                                onClick={() => move(index, 1)}
                              >
                                <ArrowDown />
                              </Button>
                            </>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`${t('Remove file')}: ${input.name}`}
                            disabled={busy || saving}
                            onClick={() => {
                              if (input.thumbnail) URL.revokeObjectURL(input.thumbnail)
                              setInputs(inputs.filter((item) => item.id !== input.id))
                              invalidate()
                            }}
                          >
                            <X />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ol>
                </>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                {t('Automatic memory limit')}:{' '}
                <bdi dir="ltr">{formatBytes(memoryPolicy.maxInputBytes)}</bdi> ·{' '}
                <bdi dir="ltr">{memoryPolicy.ramGB} GB</bdi> {t('RAM')}
                {tool.multiple && (
                  <> · {t('Select several files with Ctrl or Shift, or drop them together.')}</>
                )}
              </p>
              {totalBytes >= memoryPolicy.warnInputBytes && (
                <p role="status" className="mt-2 text-xs text-[var(--ui-warning)]">
                  {t(
                    'Large files use more memory while processing. Keep other heavy apps closed; you can cancel processing.'
                  )}
                </p>
              )}
              {toolId === 'edit' && inputs[0] && (
                <div className="mt-4 border-t border-border pt-4">
                  <PdfEditor
                    key={inputs[0].id}
                    ref={editor}
                    input={inputs[0]}
                    disabled={busy || saving}
                    onChanged={invalidate}
                  />
                </div>
              )}
              {validation && inputs.length > 0 && (
                <p className="mt-3 text-xs text-destructive" role="status">
                  {t(validation)}
                </p>
              )}
            </section>
            <aside className="space-y-4">
              <section className="pdf-hub-panel">
                <h2 className="mb-4 font-semibold">{t('Settings')}</h2>
                <PdfToolSettings
                  id={tool.id}
                  options={options}
                  onChange={(next) => {
                    setOptions(next)
                    invalidate()
                  }}
                  disabled={busy || saving}
                />
              </section>
              {output && (
                <section className="pdf-hub-panel space-y-3" role="status">
                  <div className="flex items-center gap-2 font-semibold">
                    <CheckCircle2 className="size-5 text-[var(--ui-success)]" />
                    {t('Ready')}
                  </div>
                  <p className="break-all text-sm" dir="auto">
                    {output.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(output.bytes.length)}
                    {toolId === 'compress' && (
                      <>
                        {' '}
                        · {Math.max(
                          0,
                          Math.round((1 - output.bytes.length / totalBytes) * 100)
                        )}% {t('smaller')}
                      </>
                    )}
                  </p>
                  {toolId === 'compress' && output.bytes.length >= totalBytes && (
                    <p className="text-xs text-muted-foreground">
                      {t('This PDF is already optimized. The original size was kept.')}
                    </p>
                  )}
                  {output.mime === 'application/pdf' && (
                    <PdfOutputPreview key={output.name} output={output} />
                  )}
                </section>
              )}
              <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
                <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
                {t('Files stay on this computer')}
              </div>
            </aside>
          </div>
        </div>
      )}
      <AlertDialog
        open={pendingTool !== null}
        onOpenChange={(open) => {
          if (!open) setPendingTool(null)
        }}
      >
        <AlertDialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            const previous = returnFocus.current
            if (previous?.isConnected && previous.getClientRects().length)
              previous.focus({ preventScroll: true })
            else
              document
                .querySelector<HTMLButtonElement>(
                  '.pdf-tools [data-tool-header] button:not(:disabled)'
                )
                ?.focus({ preventScroll: true })
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Switch PDF tool?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('Current files and edits will be cleared. Original and saved files are kept.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                clear()
                setOptions(DEFAULT_PDF_OPTIONS)
                setToolId(pendingTool)
                setPendingTool(null)
                setShowGallery(false)
              }}
            >
              {t('Switch tool')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function PdfToolCard({
  tool,
  onClick,
  selected
}: {
  tool: PdfTool
  onClick: () => void
  selected: boolean
}): JSX.Element {
  const { t } = useLanguage(),
    Icon = tool.icon
  return (
    <button type="button" className="pdf-tool-card" onClick={onClick}>
      <span className="pdf-card-icon">
        <Icon aria-hidden="true" strokeWidth={1.6} />
      </span>
      <span className="pdf-card-title">{t(tool.title)}</span>
      <span className="pdf-card-meta" dir="ltr">
        <span>
          {tool.accept === '.pdf'
            ? 'PDF'
            : tool.accept.replace(/\./g, '').replace(/,/g, ' / ').toUpperCase()}
        </span>
        <ArrowRight aria-hidden="true" data-physical-direction />
        <span>{tool.extension.toUpperCase()}</span>
      </span>
      {selected && <span className="pdf-card-status">{t('In progress')}</span>}
    </button>
  )
}
