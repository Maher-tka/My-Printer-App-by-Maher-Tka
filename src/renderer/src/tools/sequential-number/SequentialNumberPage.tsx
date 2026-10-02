import { NumberColorInput } from './NumberColorInput'
import { NumberDesignEditor } from './NumberDesignEditor'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  Hash,
  Layers,
  Plus,
  RotateCw,
  Trash2,
  Upload
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProjectFileActions } from '@/projects/ProjectFileActions'
import type { AppRoute } from '@/types/navigation'
import type {
  ActiveProjectSession,
  OpenedPrinterProject,
  PrinterAppProjectResult,
  ProjectMetadata
} from '@/types/projects'
import type { UnsavedChangesAction } from '../../../../shared/project-types'
import type { NumberArtwork, NumberPosition, SequentialProject, SequentialSettings } from './types'
import {
  createDefaultSequentialProject,
  formatSequenceNumber,
  positionLabel,
  getNumberSlots,
  getGutterCutLines,
  GUTTER_LINE_WIDTH_MM,
  getSequentialLayout
} from './lib/layout'
import { loadNumberArtwork, changeNumberArtworkPage } from './lib/artwork'
import { createSequentialProjectFile } from './lib/project'
import { exportSequentialPdf } from './lib/exportPdf'

interface Props {
  onNavigate: (route: AppRoute) => void
  openedProject?: OpenedPrinterProject<SequentialProject> | null
  onOpenProject: (filePath?: string | null) => Promise<PrinterAppProjectResult>
  onProjectSessionChange: (session: ActiveProjectSession | null) => void
  onConfirmUnsavedChanges: (action: UnsavedChangesAction) => Promise<boolean>
}
const inputClass =
  'h-9 w-full rounded-[14px] border border-input bg-background px-3 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
function Field({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  return (
    <label className="grid min-w-0 gap-1.5 text-xs font-medium text-muted-foreground">
      {label}
      {children}
    </label>
  )
}
function Numeric({
  label,
  value,
  onChange,
  min = 0,
  max,
  step = 1
}: {
  label: string
  value: number
  onChange: (n: number) => void
  min?: number
  max?: number
  step?: number
}): JSX.Element {
  return (
    <Field label={label}>
      <input
        className={inputClass}
        type="number"
        value={Number.isFinite(value) ? value : ''}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
      />
    </Field>
  )
}
function Card({
  step,
  title,
  children
}: {
  step: string
  title: string
  children: ReactNode
}): JSX.Element {
  return (
    <section className="rounded-[18px] border border-border/70 bg-card p-4">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
        <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-xs text-primary">
          {step}
        </span>
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  )
}
const errorText = (error: unknown): string =>
  error instanceof Error ? error.message : 'Something went wrong. Please try again.'

export function SequentialNumberPage({
  onNavigate,
  openedProject,
  onOpenProject,
  onProjectSessionChange,
  onConfirmUnsavedChanges
}: Props): JSX.Element {
  const [project, setProject] = useState<SequentialProject>(
    () => openedProject?.project.payload ?? createDefaultSequentialProject()
  )
  const [filePath, setFilePath] = useState(openedProject?.filePath ?? null)
  const [metadata, setMetadata] = useState<ProjectMetadata | null>(
    () => openedProject?.project.metadata ?? createSequentialProjectFile(project).metadata
  )
  const [savedKey, setSavedKey] = useState(() => JSON.stringify(project))
  const [busy, setBusy] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [sheetIndex, setSheetIndex] = useState(0)
  const [side, setSide] = useState<'front' | 'back'>('front')
  const [selectedPosition, setSelectedPosition] = useState(project.positions[0]?.id ?? '')
  const abortRef = useRef<AbortController | null>(null)
  const [workspaceTab, setWorkspaceTab] = useState<'sheet' | 'design'>('sheet')
  const operationRef = useRef(0)
  const settings = project.settings
  const stateKey = useMemo(() => JSON.stringify(project), [project])
  const dirty = stateKey !== savedKey
  const layout = useMemo(() => getSequentialLayout(settings), [settings])
  const safeSheet = Math.min(sheetIndex, Math.max(0, layout.sheetCount - 1))
  const slots = useMemo(
    () => (layout.errors.length ? [] : getNumberSlots(settings, safeSheet, side)),
    [settings, safeSheet, side, layout.errors.length]
  )
  const errors = [
    ...layout.errors,
    ...(!project.front ? ['Add your front design to export.'] : []),
    ...(settings.backMode === 'artwork' && !project.back
      ? ['Add a back design or choose a blank back.']
      : []),
    ...(!project.positions.length ? ['Add at least one number position.'] : []),
    ...project.positions.flatMap((position, index) =>
      !Number.isFinite(position.fontSizePt) ||
      position.fontSizePt < 4 ||
      position.fontSizePt > 200 ||
      position.xMm < 0 ||
      position.xMm > settings.ticketWidthMm ||
      position.yMm < 0 ||
      position.yMm > settings.ticketHeightMm
        ? [`Position ${index + 1}: use a 4–200 pt font and coordinates inside the item.`]
        : []
    )
  ]
  const patchSettings = (patch: Partial<SequentialSettings>): void =>
    setProject((p) => ({ ...p, settings: { ...p.settings, ...patch } }))
  const patchPosition = (id: string, patch: Partial<NumberPosition>): void =>
    setProject((p) => ({
      ...p,
      positions: p.positions.map((position) =>
        position.id === id ? { ...position, ...patch } : position
      )
    }))
  const snapshot = useCallback(
    () => createSequentialProjectFile(project, metadata ?? undefined),
    [project, metadata]
  )
  const save = useCallback(
    async (saveAs = false): Promise<boolean> => {
      if (!window.printerApp?.saveProject) {
        setMessage('Open the desktop app to save an editable project.')
        return false
      }
      setBusy(true)
      try {
        const file = snapshot()
        const result = await window.printerApp.saveProject({
          suggestedName: `${project.name || 'Sequential Number'}.myprinter-sequential.json`,
          filePath: saveAs ? null : filePath,
          project: file
        })
        if (result.canceled) {
          setMessage('Save canceled.')
          return false
        }
        if (!result.ok || !result.filePath)
          throw new Error(result.error || 'Could not save project.')
        setFilePath(result.filePath)
        setMetadata(file.metadata)
        setSavedKey(stateKey)
        setMessage('Project saved.')
        return true
      } catch (error) {
        setMessage(errorText(error))
        return false
      } finally {
        setBusy(false)
      }
    },
    [snapshot, filePath, project.name, stateKey]
  )
  useEffect(() => {
    onProjectSessionChange({
      isDirty: dirty,
      projectName: project.name || 'Sequential Number',
      filePath,
      snapshot: snapshot(),
      save: () => save(),
      preflight: {
        warningsCount: layout.warnings.length,
        preflightStatus: errors.length ? 'errors' : layout.warnings.length ? 'warnings' : 'passed'
      }
    })
  }, [
    dirty,
    project.name,
    filePath,
    snapshot,
    save,
    layout.warnings.length,
    errors.length,
    onProjectSessionChange
  ])
  useEffect(
    () => () => {
      abortRef.current?.abort()
      operationRef.current += 1
      onProjectSessionChange(null)
    },
    [onProjectSessionChange]
  )
  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        if (!busy) void save(event.shiftKey)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [save, busy])
  const importArtwork = async (file: File, target: 'front' | 'back'): Promise<void> => {
    const operation = ++operationRef.current
    setBusy(true)
    setMessage('Reading design…')
    try {
      const artwork = await loadNumberArtwork(file)
      if (operation !== operationRef.current) return
      setProject((p) => ({
        ...p,
        [target]: artwork,
        settings:
          target === 'front' && !p.front
            ? {
                ...p.settings,
                ticketWidthMm: Math.round(artwork.widthMm * 100) / 100,
                ticketHeightMm: Math.round(artwork.heightMm * 100) / 100
              }
            : p.settings
      }))
      setMessage(`Loaded ${artwork.name}. Check the finished item size below.`)
    } catch (error) {
      if (operation === operationRef.current) setMessage(errorText(error))
    } finally {
      if (operation === operationRef.current) setBusy(false)
    }
  }
  const changePage = async (
    artwork: NumberArtwork,
    page: number,
    target: 'front' | 'back'
  ): Promise<void> => {
    const operation = ++operationRef.current
    setBusy(true)
    try {
      const changed = await changeNumberArtworkPage(artwork, page)
      if (operation !== operationRef.current) return
      setProject((p) => ({ ...p, [target]: changed }))
    } catch (error) {
      if (operation === operationRef.current) setMessage(errorText(error))
    } finally {
      if (operation === operationRef.current) setBusy(false)
    }
  }
  const runExport = async (): Promise<void> => {
    setBusy(true)
    setExporting(true)
    setMessage('Creating numbered PDF…')
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const bytes = await exportSequentialPdf(project, {
        signal: controller.signal,
        onProgress: (done, total) => setMessage(`Creating numbered PDF… ${done} / ${total} pages`)
      })
      if (controller.signal.aborted) throw new Error('Export canceled.')
      const name = `${project.name.trim() || 'Sequential Number'}.pdf`
      if (window.printerApp?.saveFile) {
        const result = await window.printerApp.saveFile({
          suggestedName: name,
          bytes,
          filters: [{ name: 'PDF document', extensions: ['pdf'] }]
        })
        if (result.canceled) {
          setMessage('Export save canceled.')
          return
        }
        if (!result.ok) throw new Error(result.error || 'Could not save PDF.')
      } else {
        const url = URL.createObjectURL(
          new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
        )
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = name
        anchor.click()
        setTimeout(() => URL.revokeObjectURL(url), 30000)
      }
      setMessage(
        `Exported ${layout.pdfPageCount} PDF pages for ${settings.quantity} numbered items.`
      )
    } catch (error) {
      setMessage(controller.signal.aborted ? 'Export canceled.' : errorText(error))
    } finally {
      setBusy(false)
      setExporting(false)
      abortRef.current = null
    }
  }
  const artworkPicker = (target: 'front' | 'back'): JSX.Element => {
    const artwork = project[target]
    return (
      <div className="space-y-2">
        <label
          className={`flex cursor-pointer items-center gap-3 rounded-xl border border-dashed p-4 hover:bg-muted/40 ${busy ? 'pointer-events-none opacity-60' : ''}`}
        >
          <Upload className="size-5 shrink-0 text-primary" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">
              {artwork?.name ?? `Upload ${target} design`}
            </span>
            <span className="text-xs text-muted-foreground">
              PDF, PNG or JPEG · click to {artwork ? 'replace' : 'browse'}
            </span>
          </span>
          <input
            aria-label={`Upload ${target} design`}
            className="sr-only"
            type="file"
            accept="application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void importArtwork(file, target)
              event.target.value = ''
            }}
          />
        </label>
        {artwork && artwork.pageCount > 1 && (
          <Field label={`${target === 'front' ? 'Front' : 'Back'} PDF page`}>
            <select
              className={inputClass}
              value={artwork.pageNumber}
              disabled={busy}
              onChange={(e) => void changePage(artwork, Number(e.target.value), target)}
            >
              {Array.from({ length: artwork.pageCount }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  Page {i + 1} of {artwork.pageCount}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>
    )
  }
  return (
    <div className="workspace-shell sequential-workspace mx-auto max-w-[1880px] space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" onClick={() => onNavigate('dashboard')}>
            <ArrowLeft className="mr-2 size-4" />
            All tools
          </Button>
          <h1 className="mt-2 flex items-center gap-3 text-2xl font-semibold tracking-tight">
            <span className="rounded-xl bg-primary/10 p-2 text-primary">
              <Hash className="size-6" />
            </span>
            Sequential Number
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Number tickets, invoices, vouchers and forms. Ready to print, cut and collect.
          </p>
        </div>
        <ProjectFileActions
          filePath={filePath}
          isBusy={busy}
          isDirty={dirty}
          message={message}
          onOpen={() => {
            void onOpenProject()
              .then((result) => {
                if (!result.ok && !result.canceled)
                  setMessage(result.error || 'Could not open project.')
              })
              .catch((error) => setMessage(errorText(error)))
          }}
          onSave={() => void save()}
          onSaveAs={() => void save(true)}
        />
      </header>
      <div className="grid items-start gap-4 lg:grid-cols-[300px_minmax(0,1fr)] 2xl:grid-cols-[340px_minmax(0,1fr)]">
        <fieldset
          disabled={busy}
          aria-label="Numbering setup"
          className="min-w-0 space-y-4 disabled:opacity-70 lg:sticky lg:top-4 lg:max-h-[calc(100vh-180px)] lg:overflow-y-auto"
        >
          <Card step="1" title="Your design">
            <Field label="Project name">
              <input
                className={inputClass}
                value={project.name}
                onChange={(e) => setProject((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Summer raffle"
              />
            </Field>
            {artworkPicker('front')}
            <Field label="Back side">
              <select
                className={inputClass}
                value={settings.backMode}
                onChange={(e) => {
                  patchSettings({ backMode: e.target.value as SequentialSettings['backMode'] })
                  setSide('front')
                }}
              >
                <option value="none">Single-sided · no back page</option>
                <option value="blank">Double-sided · blank back</option>
                <option value="artwork">Double-sided · back design</option>
              </select>
            </Field>
            {settings.backMode === 'artwork' && (
              <>
                {artworkPicker('back')}
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={settings.numberBack}
                    onChange={(e) => patchSettings({ numberBack: e.target.checked })}
                  />
                  Repeat the same number on the back
                </label>
              </>
            )}
            {settings.backMode !== 'none' && (
              <Field label="Printer duplex setting">
                <select
                  className={inputClass}
                  value={settings.duplexFlip}
                  onChange={(e) =>
                    patchSettings({
                      duplexFlip: e.target.value as SequentialSettings['duplexFlip']
                    })
                  }
                >
                  <option value="long-edge">Flip on long edge</option>
                  <option value="short-edge">Flip on short edge</option>
                </select>
              </Field>
            )}
          </Card>
          <Card step="2" title="Sheet & finished item">
            <div className="flex gap-2">
              {(['a4', 'a3', 'custom'] as const).map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  className="flex-1"
                  variant={settings.sheetPreset === preset ? 'default' : 'outline'}
                  onClick={() =>
                    patchSettings({
                      sheetPreset: preset,
                      ...(preset === 'a4'
                        ? { sheetWidthMm: 210, sheetHeightMm: 297 }
                        : preset === 'a3'
                          ? { sheetWidthMm: 297, sheetHeightMm: 420 }
                          : {})
                    })
                  }
                >
                  {preset === 'custom' ? 'Custom' : preset.toUpperCase()}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Numeric
                label="Sheet width (mm)"
                value={settings.sheetWidthMm}
                min={1}
                onChange={(v) => patchSettings({ sheetPreset: 'custom', sheetWidthMm: v })}
              />
              <Numeric
                label="Sheet height (mm)"
                value={settings.sheetHeightMm}
                min={1}
                onChange={(v) => patchSettings({ sheetPreset: 'custom', sheetHeightMm: v })}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                patchSettings({
                  sheetWidthMm: settings.sheetHeightMm,
                  sheetHeightMm: settings.sheetWidthMm
                })
              }
            >
              <RotateCw className="mr-2 size-4" />
              Rotate sheet
            </Button>
            <div className="grid grid-cols-2 gap-3">
              <Numeric
                label="Item width (mm)"
                value={settings.ticketWidthMm}
                min={1}
                step={0.1}
                onChange={(v) => patchSettings({ ticketWidthMm: v })}
              />
              <Numeric
                label="Item height (mm)"
                value={settings.ticketHeightMm}
                min={1}
                step={0.1}
                onChange={(v) => patchSettings({ ticketHeightMm: v })}
              />
              <Numeric
                label="Sheet margin (mm)"
                value={settings.marginMm}
                step={0.1}
                onChange={(v) => patchSettings({ marginMm: v })}
              />
              <Numeric
                label="Gap between items (mm)"
                value={settings.gapMm}
                step={0.1}
                onChange={(v) => patchSettings({ gapMm: v })}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.cropMarks}
                onChange={(e) => patchSettings({ cropMarks: e.target.checked })}
              />
              Corner crop marks (outside tickets)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.gutterCutLines ?? false}
                onChange={(e) => patchSettings({ gutterCutLines: e.target.checked })}
              />
              Cutting lines on first page only (0.25 pt)
            </label>
            {settings.gutterCutLines && (
              <Field label="Cutting-line color">
                <NumberColorInput
                  className={`${inputClass} p-1`}
                  value={settings.cuttingLineColor ?? '#000000'}
                  onCommit={(color) => patchSettings({ cuttingLineColor: color })}
                />
                <span>
                  First PDF page only. Lines stay in the center of the gaps. Minimum gap: 0.1 mm.
                </span>
              </Field>
            )}
            <p className="text-xs text-muted-foreground">
              Artwork fits inside the finished item size without stretching. Image sizes start at
              300 DPI; confirm the finished dimensions.
            </p>
          </Card>
          <Card step="3" title="Number sequence">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start number (zeros allowed)">
                <input
                  className={inputClass}
                  inputMode="numeric"
                  value={String(settings.startNumber).padStart(settings.digits, '0')}
                  onChange={(e) => {
                    const value = e.target.value
                    if (/^\d{0,12}$/.test(value))
                      patchSettings({
                        startNumber: Number(value),
                        digits: Math.max(1, value.length)
                      })
                  }}
                />
              </Field>
              <Numeric
                label="Quantity of items"
                value={settings.quantity}
                min={1}
                onChange={(v) => patchSettings({ quantity: v })}
              />
              <Numeric
                label="Increase by"
                value={settings.increment}
                min={1}
                onChange={(v) => patchSettings({ increment: v })}
              />
              <Numeric
                label="Digits (pad with leading zeros)"
                value={settings.digits}
                min={1}
                max={12}
                onChange={(v) => patchSettings({ digits: v })}
              />
              <Field label="Fixed text before number">
                <input
                  className={inputClass}
                  value={settings.prefix}
                  onChange={(e) => patchSettings({ prefix: e.target.value })}
                  placeholder="INV-"
                />
              </Field>
              <Field label="Fixed text after number">
                <input
                  className={inputClass}
                  value={settings.suffix}
                  onChange={(e) => patchSettings({ suffix: e.target.value })}
                  placeholder="Optional"
                />
              </Field>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-sm tabular-nums">
              {formatSequenceNumber(settings, 0)}{' '}
              <span className="px-2 text-muted-foreground">→</span>{' '}
              {formatSequenceNumber(settings, Math.max(0, settings.quantity - 1))}
            </div>
          </Card>
          <Card step="4" title="Choose how you will collect the numbers">
            <div className="grid gap-2">
              {(
                [
                  {
                    id: 'sheet',
                    title: 'Across each sheet',
                    subtitle: 'Read left to right, then the next row.',
                    numbers: [1, 2, 3, 4]
                  },
                  {
                    id: 'stack',
                    title: 'Cut & stack',
                    subtitle: 'Next number on the next physical sheet.',
                    numbers: [1, 4, 7, 10]
                  }
                ] as const
              ).map((choice) => (
                <button
                  key={choice.id}
                  type="button"
                  disabled={busy}
                  aria-pressed={settings.order === choice.id}
                  className={`rounded-[14px] border p-3 text-left transition-colors ${settings.order === choice.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'}`}
                  onClick={() => patchSettings({ order: choice.id })}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <div
                      aria-hidden="true"
                      className="grid w-16 shrink-0 grid-cols-2 gap-1 rounded-md border bg-background p-1.5"
                    >
                      {choice.numbers.map((n) => (
                        <span
                          key={n}
                          className="rounded border bg-muted/50 text-center text-xs leading-6"
                        >
                          {n}
                        </span>
                      ))}
                    </div>
                    <span className="font-semibold">{choice.title}</span>
                  </div>
                  <p className="text-xs leading-5 text-muted-foreground">{choice.subtitle}</p>
                </button>
              ))}
            </div>
            <p className="rounded-lg bg-muted/50 p-3 text-xs leading-5">
              {settings.order === 'stack'
                ? 'Keep physical sheets in ascending order, with sheet 1 on top. Cut the stack, then collect piles from left to right, top to bottom. Each pile continues where the previous one ends.'
                : 'Numbers continue across the front of each sheet, from left to right and top to bottom.'}
              {settings.backMode !== 'none' &&
                ' Back pages never consume a number: PDF pages 1–2 are sheet 1 front/back, pages 3–4 are sheet 2 front/back.'}
            </p>
          </Card>
        </fieldset>
        <div className="min-w-0 space-y-4">
          <div
            className="flex items-center gap-2 rounded-[18px] border border-border/70 bg-card p-2"
            aria-label="Numbering workspace views"
          >
            <Button
              type="button"
              variant={workspaceTab === 'sheet' ? 'default' : 'ghost'}
              aria-pressed={workspaceTab === 'sheet'}
              onClick={() => setWorkspaceTab('sheet')}
            >
              Sheet preview
            </Button>
            <Button
              type="button"
              variant={workspaceTab === 'design' ? 'default' : 'ghost'}
              aria-pressed={workspaceTab === 'design'}
              onClick={() => setWorkspaceTab('design')}
            >
              Numbers &amp; fixed text
            </Button>
          </div>

          {workspaceTab === 'design' && (
            <Card step="5" title="Place numbers and fixed text">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="max-w-md text-xs leading-5 text-muted-foreground">
                  Select and drag a number or fixed label. Use X/Y for exact positioning. Fixed text
                  stays the same on every ticket.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy || project.positions.length >= 20}
                  onClick={() => {
                    const id = crypto.randomUUID()
                    setProject((p) => ({
                      ...p,
                      positions: [
                        ...p.positions,
                        {
                          id,
                          xMm: Math.min(10, settings.ticketWidthMm / 2),
                          yMm: Math.min(10, settings.ticketHeightMm / 2),
                          fontSizePt: 12,
                          color: '#000000',
                          align: 'left'
                        }
                      ]
                    }))
                    setSelectedPosition(id)
                  }}
                >
                  <Plus className="mr-2 size-4" />
                  Add number
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={busy || project.positions.length >= 20}
                onClick={() => {
                  const id = crypto.randomUUID()
                  setProject((p) => ({
                    ...p,
                    positions: [
                      ...p.positions,
                      {
                        id,
                        kind: 'text',
                        text: 'Fixed text',
                        xMm: Math.min(10, settings.ticketWidthMm / 2),
                        yMm: Math.min(20, settings.ticketHeightMm / 2),
                        fontSizePt: 12,
                        color: '#000000',
                        align: 'left'
                      }
                    ]
                  }))
                  setSelectedPosition(id)
                }}
              >
                Add fixed text
              </Button>
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
                <NumberDesignEditor
                  key={project.front?.name ?? 'blank'}
                  project={project}
                  selected={selectedPosition}
                  onSelect={setSelectedPosition}
                  disabled={busy}
                  onChange={(positions) => setProject((p) => ({ ...p, positions }))}
                />
                <fieldset disabled={busy} className="space-y-3">
                  <Field label="Number position">
                    <select
                      className={inputClass}
                      value={selectedPosition}
                      onChange={(e) => setSelectedPosition(e.target.value)}
                    >
                      {project.positions.map((pos, i) => (
                        <option key={pos.id} value={pos.id}>
                          {pos.kind === 'text' ? 'Fixed text' : 'Number'} {i + 1}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {project.positions
                    .filter((pos) => pos.id === selectedPosition)
                    .map((pos) => (
                      <div key={pos.id} className="space-y-3">
                        {pos.kind === 'text' && (
                          <Field label="Fixed text (same on every item)">
                            <input
                              className={inputClass}
                              maxLength={200}
                              value={pos.text ?? ''}
                              onChange={(e) => patchPosition(pos.id, { text: e.target.value })}
                            />
                            <span>English letters, numbers and symbols; up to 200 characters.</span>
                          </Field>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                          <Numeric
                            label="X (mm)"
                            value={pos.xMm}
                            max={settings.ticketWidthMm}
                            step={0.1}
                            onChange={(v) => patchPosition(pos.id, { xMm: v })}
                          />
                          <Numeric
                            label="Y (mm)"
                            value={pos.yMm}
                            max={settings.ticketHeightMm}
                            step={0.1}
                            onChange={(v) => patchPosition(pos.id, { yMm: v })}
                          />
                          <Numeric
                            label="Font size (pt)"
                            value={pos.fontSizePt}
                            min={4}
                            max={200}
                            step={0.5}
                            onChange={(v) => patchPosition(pos.id, { fontSizePt: v })}
                          />
                          <Field label="Color">
                            <NumberColorInput
                              className={`${inputClass} p-1`}
                              value={pos.color}
                              onCommit={(color) => patchPosition(pos.id, { color })}
                            />
                          </Field>
                        </div>
                        <Field label="Text alignment">
                          <select
                            className={inputClass}
                            value={pos.align}
                            onChange={(e) =>
                              patchPosition(pos.id, {
                                align: e.target.value as NumberPosition['align']
                              })
                            }
                          >
                            <option value="left">Left</option>
                            <option value="center">Center</option>
                            <option value="right">Right</option>
                          </select>
                        </Field>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={project.positions.length < 2}
                          onClick={() => {
                            setProject((p) => ({
                              ...p,
                              positions: p.positions.filter((item) => item.id !== pos.id)
                            }))
                            setSelectedPosition(
                              project.positions.find((item) => item.id !== pos.id)?.id ?? ''
                            )
                          }}
                        >
                          <Trash2 className="mr-2 size-4" />
                          Remove position
                        </Button>
                      </div>
                    ))}
                </fieldset>
              </div>
            </Card>
          )}
          {workspaceTab === 'sheet' && (
            <section className="overflow-hidden rounded-[18px] border border-border/70 bg-card">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
                <div>
                  <h2 className="flex items-center gap-2 font-semibold">
                    <Layers className="size-4" />
                    Sheet preview
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {layout.capacity} items per sheet · {layout.sheetCount} physical sheets ·{' '}
                    {layout.pdfPageCount} PDF pages
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Previous sheet"
                    disabled={safeSheet === 0}
                    onClick={() => setSheetIndex(safeSheet - 1)}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <span className="text-xs tabular-nums">
                    Sheet {layout.sheetCount ? safeSheet + 1 : 0} / {layout.sheetCount}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Next sheet"
                    disabled={safeSheet >= layout.sheetCount - 1}
                    onClick={() => setSheetIndex(safeSheet + 1)}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between px-5 pt-4">
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={side === 'front' ? 'default' : 'outline'}
                    onClick={() => setSide('front')}
                  >
                    Front
                  </Button>
                  {settings.backMode !== 'none' && (
                    <Button
                      size="sm"
                      variant={side === 'back' ? 'default' : 'outline'}
                      onClick={() => setSide('back')}
                    >
                      Back
                    </Button>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  PDF page{' '}
                  {safeSheet * (settings.backMode === 'none' ? 1 : 2) + (side === 'back' ? 2 : 1)}
                </span>
              </div>
              <div className="m-4 flex max-h-[calc(100vh-360px)] min-h-80 justify-center overflow-auto rounded-[14px] bg-muted/50 p-4">
                <svg
                  role="img"
                  aria-label={`${side} of sheet ${safeSheet + 1}`}
                  viewBox={`0 0 ${Math.max(1, settings.sheetWidthMm)} ${Math.max(1, settings.sheetHeightMm)}`}
                  className="h-auto max-w-full shrink-0 bg-white shadow-sm"
                  style={{
                    width: `${(550 * Math.max(1, settings.sheetWidthMm)) / Math.max(1, settings.sheetHeightMm)}px`,
                    aspectRatio: `${Math.max(1, settings.sheetWidthMm)} / ${Math.max(1, settings.sheetHeightMm)}`
                  }}
                >
                  {(side === 'back' && settings.backMode === 'blank' ? [] : slots).map((slot) => (
                    <g key={slot.slotIndex}>
                      <rect
                        x={slot.xMm}
                        y={slot.yMm}
                        width={settings.ticketWidthMm}
                        height={settings.ticketHeightMm}
                        fill="white"
                        stroke="#cbd5e1"
                        strokeWidth="0.15"
                      />
                      {slot.sequenceIndex !== null && (
                        <>
                          {(side === 'front'
                            ? project.front
                            : settings.backMode === 'artwork'
                              ? project.back
                              : null
                          )?.previewDataUrl && (
                            <image
                              href={
                                (side === 'front' ? project.front : project.back)!.previewDataUrl
                              }
                              x={slot.xMm}
                              y={slot.yMm}
                              width={settings.ticketWidthMm}
                              height={settings.ticketHeightMm}
                              preserveAspectRatio="xMidYMid meet"
                            />
                          )}
                          {(side === 'front' ||
                            (settings.backMode === 'artwork' && settings.numberBack)) &&
                            project.positions.map((pos) => (
                              <text
                                key={pos.id}
                                x={slot.xMm + pos.xMm}
                                y={slot.yMm + pos.yMm + ((pos.fontSizePt * 25.4) / 72) * 0.718}
                                textAnchor={
                                  pos.align === 'center'
                                    ? 'middle'
                                    : pos.align === 'right'
                                      ? 'end'
                                      : 'start'
                                }
                                fontFamily="Helvetica, Arial, sans-serif"
                                fontSize={(pos.fontSizePt * 25.4) / 72}
                                fill={pos.color}
                              >
                                {positionLabel(pos, slot.label ?? '')}
                              </text>
                            ))}
                        </>
                      )}
                    </g>
                  ))}
                  {safeSheet === 0 &&
                    side === 'front' &&
                    getGutterCutLines(settings, slots).map((line, index) => (
                      <line
                        key={`gutter-${index}`}
                        x1={line.x1}
                        y1={line.y1}
                        x2={line.x2}
                        y2={line.y2}
                        stroke={settings.cuttingLineColor ?? '#000000'}
                        strokeWidth={GUTTER_LINE_WIDTH_MM}
                      />
                    ))}
                </svg>
              </div>
              <p className="px-5 pb-4 text-xs text-muted-foreground">
                Gray outlines show item positions in this preview. Empty slots remain unprinted.
              </p>
              <div className="space-y-3 border-t p-5">
                {message && (
                  <p role="status" className="rounded-lg bg-muted/50 p-3 text-sm">
                    {message}
                  </p>
                )}
                {errors.length > 0 && (
                  <ul className="space-y-1 rounded-lg bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                    {errors.map((error, i) => (
                      <li key={i}>{error}</li>
                    ))}
                  </ul>
                )}
                {layout.warnings.length > 0 && (
                  <ul className="space-y-1 text-xs text-amber-700">
                    {layout.warnings.map((warning, i) => (
                      <li key={i}>{warning}</li>
                    ))}
                  </ul>
                )}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    Print at actual size (100%).
                    {settings.backMode !== 'none' && ` Use duplex ${settings.duplexFlip} printing.`}
                  </p>
                  {exporting ? (
                    <Button variant="outline" onClick={() => abortRef.current?.abort()}>
                      Cancel export
                    </Button>
                  ) : (
                    <Button disabled={busy || errors.length > 0} onClick={() => void runExport()}>
                      <Download className="mr-2 size-4" />
                      Export numbered PDF
                    </Button>
                  )}
                </div>
              </div>
            </section>
          )}
          <Button
            variant="ghost"
            disabled={busy}
            onClick={async () => {
              if (!(await onConfirmUnsavedChanges('new-project'))) return
              const fresh = createDefaultSequentialProject()
              setProject(fresh)
              setSavedKey(JSON.stringify(fresh))
              setFilePath(null)
              setMetadata(createSequentialProjectFile(fresh).metadata)
              setSelectedPosition(fresh.positions[0]?.id ?? '')
              setSheetIndex(0)
              setSide('front')
              setMessage('Started a new numbering project.')
            }}
          >
            Start new project
          </Button>
        </div>
      </div>
    </div>
  )
}
