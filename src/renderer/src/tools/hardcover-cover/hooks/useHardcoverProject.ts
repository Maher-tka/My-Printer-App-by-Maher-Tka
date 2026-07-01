import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction
} from 'react'
import type { HardcoverProjectPayload } from '@/projects/projectFiles'
import {
  applyProductionPresetToSetup,
  calculateCoverDimensions,
  createProductionPresetFromSetup,
  createSetupFromProductionPreset,
  DEFAULT_HARDCOVER_PRODUCTION_PRESET,
  normalizeCoverSetup
} from '../lib/coverCalculations'
import {
  DEFAULT_COVER_TEMPLATES,
  duplicateCoverTemplate,
  getCoverTemplate
} from '../lib/coverTemplates'
import { calculateSpineTextLayout } from '../lib/spineTextLayout'
import type {
  BackCoverContent,
  BatchStudent,
  CoverContent,
  CoverSetup,
  CoverTemplate,
  FrontCoverContent,
  HardcoverExportSettings,
  HardcoverJobDetails,
  HardcoverPdfSource,
  HardcoverProductionPreset,
  HardcoverProjectState,
  QuoteBreakdown,
  QuoteSummary,
  SpineContent
} from '../types'

const PRODUCTION_PRESET_STORAGE_KEY = 'my-printer-app.hardcover-production-preset.v1'
const DEFAULT_STUDENT_NAME = 'Student Name'
const DEFAULT_PROJECT_TITLE = 'Graduation Project Title'
const LEGACY_DEFAULT_SPINE_TITLE = 'Graduation Project'

export function useHardcoverProject(initialProject?: HardcoverProjectPayload): {
  state: HardcoverProjectState
  setState: Dispatch<SetStateAction<HardcoverProjectState>>
  dimensions: ReturnType<typeof calculateCoverDimensions>
  spineLayout: ReturnType<typeof calculateSpineTextLayout>
  warnings: string[]
  quote: QuoteSummary
  checklist: Array<{ label: string; passed: boolean }>
  updateSetup: (patch: Partial<CoverSetup>) => void
  updateFront: (patch: Partial<FrontCoverContent>) => void
  updateSpine: (patch: Partial<SpineContent>) => void
  updateBack: (patch: Partial<BackCoverContent>) => void
  updateExportSettings: (patch: Partial<HardcoverExportSettings>) => void
  importSourcePdf: (file: File) => Promise<void>
  selectSourcePdfFrontPage: (pageNumber: number) => Promise<void>
  selectSourcePdfBackPage: (pageNumber: number) => Promise<void>
  setSourcePdfBackCoverEnabled: (enabled: boolean) => Promise<void>
  loadSourcePdfPagePreviews: (startPage: number, count?: number) => Promise<void>
  updateSourcePdfFitMode: (fitMode: HardcoverPdfSource['fitMode']) => void
  saveProductionPreset: () => void
  updateProductionPreset: () => void
  resetProductionPreset: () => void
  updateJob: (patch: Partial<HardcoverJobDetails>) => void
  updateQuote: (patch: Partial<QuoteBreakdown>) => void
  chooseTemplate: (templateId: string) => void
  duplicateTemplate: () => void
  resetTemplate: () => void
  updateTemplate: (patch: Partial<CoverTemplate>) => void
  addBatchStudent: () => void
  updateBatchStudent: (id: string, patch: Partial<BatchStudent>) => void
  removeBatchStudent: (id: string) => void
  importBatchCsv: (csv: string) => number
  clearProject: () => void
} {
  const [state, setState] = useState<HardcoverProjectState>(() => {
    const initial = initialProject
      ? normalizeHardcoverProject(structuredClone(initialProject))
      : createDefaultHardcoverProject()
    const storedTemplates = readCustomTemplates()
    return { ...initial, customTemplates: mergeTemplates(initial.customTemplates, storedTemplates) }
  })
  const dimensions = useMemo(() => calculateCoverDimensions(state.setup), [state.setup])
  const spineLayout = useMemo(
    () =>
      calculateSpineTextLayout(
        state.content.spine,
        state.setup.spineWidthMm,
        dimensions.spine.heightMm - state.setup.hingeMm * 2
      ),
    [dimensions.spine.heightMm, state.content.spine, state.setup.hingeMm, state.setup.spineWidthMm]
  )
  const quote = useMemo(() => calculateQuote(state.job.quote), [state.job.quote])
  const warnings = useMemo(() => {
    const next = [...dimensions.warnings]
    if (spineLayout.warning) next.push(spineLayout.warning)
    if (!state.sourcePdf) next.push('Upload a memoire PDF before exporting the production sheet.')
    if (state.sourcePdf && !state.sourcePdf.bytes)
      next.push('The saved PDF source is missing. Upload the memoire PDF again before exporting.')
    if (!state.content.front.studentName.trim()) next.push('Student name is missing.')
    if (!state.content.front.title.trim()) next.push('Project title is missing.')
    return next
  }, [
    dimensions.warnings,
    spineLayout.warning,
    state.sourcePdf,
    state.content.front.studentName,
    state.content.front.title
  ])
  const checklist = useMemo(
    () => [
      { label: 'Source PDF loaded', passed: Boolean(state.sourcePdf?.bytes) },
      { label: 'Board width entered', passed: state.setup.boardWidthMm > 0 },
      { label: 'Board height entered', passed: state.setup.boardHeightMm > 0 },
      { label: 'Spine thickness entered', passed: state.setup.spineWidthMm > 0 },
      {
        label: 'Binding bands entered',
        passed: state.setup.leftBandWidthMm >= 0 && state.setup.rightBandWidthMm >= 0
      },
      { label: 'Spine text fits safe area', passed: spineLayout.fits },
      {
        label: 'Structure fits printer sheet',
        passed: !dimensions.warnings.some((warning) => warning.includes('printer sheet'))
      },
      {
        label: 'Crop marks off by default',
        passed: !state.exportSettings.includeCropMarks
      },
      {
        label: 'Only edge marks for binding',
        passed:
          state.exportSettings.mode !== 'print-final' ||
          (!state.exportSettings.includeFoldLines && !state.exportSettings.includeSafeZones)
      }
    ],
    [
      dimensions.warnings,
      spineLayout.fits,
      state.sourcePdf,
      state.exportSettings.includeCropMarks,
      state.exportSettings.includeFoldLines,
      state.exportSettings.includeSafeZones,
      state.exportSettings.mode,
      state.setup
    ]
  )

  useEffect(() => {
    window.localStorage.setItem(
      'my-printer-app.cover-templates.v1',
      JSON.stringify(state.customTemplates)
    )
  }, [state.customTemplates])

  const patchState = useCallback(
    (updater: (current: HardcoverProjectState) => HardcoverProjectState): void => setState(updater),
    []
  )
  const updateSetup = useCallback(
    (patch: Partial<CoverSetup>) =>
      patchState((current) => ({
        ...current,
        setup: applySetupPatch(current.setup, patch)
      })),
    [patchState]
  )
  const updateContent = useCallback(
    <K extends keyof CoverContent>(key: K, patch: Partial<CoverContent[K]>): void =>
      patchState((current) => ({
        ...current,
        content: { ...current.content, [key]: { ...current.content[key], ...patch } }
      })),
    [patchState]
  )
  const updateFront = useCallback(
    (patch: Partial<FrontCoverContent>) =>
      patchState((current) => {
        const nextFront = { ...current.content.front, ...patch }
        const nextSpine = { ...current.content.spine }

        if (patch.studentName !== undefined && shouldSyncSpineStudentName(current)) {
          nextSpine.studentName = patch.studentName
        }
        if (patch.title !== undefined && shouldSyncSpineTitle(current)) {
          nextSpine.shortTitle = patch.title
        }

        return {
          ...current,
          content: {
            ...current.content,
            front: nextFront,
            spine: nextSpine
          }
        }
      }),
    [patchState]
  )
  const updateSpine = useCallback(
    (patch: Partial<SpineContent>) => updateContent('spine', patch),
    [updateContent]
  )
  const updateBack = useCallback(
    (patch: Partial<BackCoverContent>) => updateContent('back', patch),
    [updateContent]
  )
  const updateExportSettings = useCallback(
    (patch: Partial<HardcoverExportSettings>) =>
      patchState((current) => ({
        ...current,
        exportSettings: { ...current.exportSettings, ...patch }
      })),
    [patchState]
  )
  const importSourcePdf = useCallback(
    async (file: File): Promise<void> => {
      const { importHardcoverPdfSource } = await import('../lib/sourcePdf')
      const sourcePdf = await importHardcoverPdfSource(file)
      patchState((current) => ({ ...current, sourcePdf }))
    },
    [patchState]
  )
  const selectSourcePdfFrontPage = useCallback(
    async (pageNumber: number): Promise<void> => {
      const currentSource = state.sourcePdf
      if (!currentSource) throw new Error('Upload a memoire PDF first.')
      const { selectHardcoverPdfFrontPage } = await import('../lib/sourcePdf')
      const sourcePdf = await selectHardcoverPdfFrontPage(currentSource, pageNumber)
      patchState((current) => ({ ...current, sourcePdf }))
    },
    [patchState, state.sourcePdf]
  )
  const selectSourcePdfBackPage = useCallback(
    async (pageNumber: number): Promise<void> => {
      const currentSource = state.sourcePdf
      if (!currentSource) throw new Error('Upload a memoire PDF first.')
      const { selectHardcoverPdfBackPage } = await import('../lib/sourcePdf')
      const sourcePdf = await selectHardcoverPdfBackPage(currentSource, pageNumber)
      patchState((current) => ({ ...current, sourcePdf }))
    },
    [patchState, state.sourcePdf]
  )
  const setSourcePdfBackCoverEnabled = useCallback(
    async (enabled: boolean): Promise<void> => {
      const currentSource = state.sourcePdf
      if (!currentSource) throw new Error('Upload a memoire PDF first.')
      const { setHardcoverPdfBackCoverEnabled } = await import('../lib/sourcePdf')
      const sourcePdf = await setHardcoverPdfBackCoverEnabled(currentSource, enabled)
      patchState((current) => ({ ...current, sourcePdf }))
    },
    [patchState, state.sourcePdf]
  )
  const loadSourcePdfPagePreviews = useCallback(
    async (startPage: number, count?: number): Promise<void> => {
      const currentSource = state.sourcePdf
      if (!currentSource) throw new Error('Upload a memoire PDF first.')
      const { loadHardcoverPdfPagePreviews } = await import('../lib/sourcePdf')
      const sourcePdf = await loadHardcoverPdfPagePreviews(currentSource, startPage, count)
      patchState((current) => ({ ...current, sourcePdf }))
    },
    [patchState, state.sourcePdf]
  )
  const updateSourcePdfFitMode = useCallback(
    (fitMode: HardcoverPdfSource['fitMode']): void =>
      patchState((current) =>
        current.sourcePdf
          ? {
              ...current,
              sourcePdf: {
                ...current.sourcePdf,
                fitMode
              }
            }
          : current
      ),
    [patchState]
  )
  const saveProductionPreset = useCallback((): void => {
    patchState((current) => {
      const productionPreset = createPresetFromState(current)
      writeProductionPreset(productionPreset)

      return { ...current, productionPreset }
    })
  }, [patchState])
  const updateProductionPreset = useCallback((): void => {
    patchState((current) => {
      const productionPreset = createPresetFromState(current, current.productionPreset)
      writeProductionPreset(productionPreset)

      return { ...current, productionPreset }
    })
  }, [patchState])
  const resetProductionPreset = useCallback((): void => {
    writeProductionPreset(DEFAULT_HARDCOVER_PRODUCTION_PRESET)
    patchState((current) => ({
      ...current,
      productionPreset: DEFAULT_HARDCOVER_PRODUCTION_PRESET,
      setup: applyProductionPresetToSetup(current.setup, DEFAULT_HARDCOVER_PRODUCTION_PRESET),
      exportSettings: {
        ...current.exportSettings,
        includeCropMarks: DEFAULT_HARDCOVER_PRODUCTION_PRESET.cropMarks
      }
    }))
  }, [patchState])
  const updateJob = useCallback(
    (patch: Partial<HardcoverJobDetails>) =>
      patchState((current) => ({ ...current, job: { ...current.job, ...patch } })),
    [patchState]
  )
  const updateQuote = useCallback(
    (patch: Partial<QuoteBreakdown>) =>
      patchState((current) => ({
        ...current,
        job: { ...current.job, quote: { ...current.job.quote, ...patch } }
      })),
    [patchState]
  )

  const chooseTemplate = useCallback(
    (templateId: string): void =>
      patchState((current) => ({
        ...current,
        template:
          current.customTemplates.find((template) => template.id === templateId) ??
          getCoverTemplate(templateId)
      })),
    [patchState]
  )
  const duplicateTemplate = useCallback(
    (): void =>
      patchState((current) => {
        const duplicate = duplicateCoverTemplate(current.template)
        return {
          ...current,
          template: duplicate,
          customTemplates: [...current.customTemplates, duplicate]
        }
      }),
    [patchState]
  )
  const resetTemplate = useCallback(
    (): void =>
      patchState((current) => ({ ...current, template: getCoverTemplate(current.template.id) })),
    [patchState]
  )
  const updateTemplate = useCallback(
    (patch: Partial<CoverTemplate>): void =>
      patchState((current) => {
        const template = { ...current.template, ...patch, isCustom: true }
        return {
          ...current,
          template,
          customTemplates: [
            ...current.customTemplates.filter((item) => item.id !== template.id),
            template
          ]
        }
      }),
    [patchState]
  )

  const addBatchStudent = useCallback(
    (): void =>
      patchState((current) => ({
        ...current,
        batchStudents: [...current.batchStudents, createBatchStudent(current.batchStudents.length)]
      })),
    [patchState]
  )
  const updateBatchStudent = useCallback(
    (id: string, patch: Partial<BatchStudent>): void =>
      patchState((current) => ({
        ...current,
        batchStudents: current.batchStudents.map((student) =>
          student.id === id ? { ...student, ...patch } : student
        )
      })),
    [patchState]
  )
  const removeBatchStudent = useCallback(
    (id: string): void =>
      patchState((current) => ({
        ...current,
        batchStudents: current.batchStudents.filter((student) => student.id !== id)
      })),
    [patchState]
  )
  const importBatchCsv = useCallback(
    (csv: string): number => {
      const students = parseBatchCsv(csv)
      if (students.length > 0)
        patchState((current) => ({
          ...current,
          batchStudents: [...current.batchStudents, ...students]
        }))
      return students.length
    },
    [patchState]
  )
  const clearProject = useCallback((): void => setState(createDefaultHardcoverProject()), [])

  return {
    state,
    setState,
    dimensions,
    spineLayout,
    warnings,
    quote,
    checklist,
    updateSetup,
    updateFront,
    updateSpine,
    updateBack,
    updateExportSettings,
    importSourcePdf,
    selectSourcePdfFrontPage,
    selectSourcePdfBackPage,
    setSourcePdfBackCoverEnabled,
    loadSourcePdfPagePreviews,
    updateSourcePdfFitMode,
    saveProductionPreset,
    updateProductionPreset,
    resetProductionPreset,
    updateJob,
    updateQuote,
    chooseTemplate,
    duplicateTemplate,
    resetTemplate,
    updateTemplate,
    addBatchStudent,
    updateBatchStudent,
    removeBatchStudent,
    importBatchCsv,
    clearProject
  }
}

export function createDefaultHardcoverProject(): HardcoverProjectState {
  const productionPreset = readProductionPreset()
  const setup = createSetupFromProductionPreset(productionPreset, 'a4')
  const academicYear = getCurrentAcademicYear()

  return {
    setup,
    sourcePdf: undefined,
    productionPreset,
    content: {
      front: {
        studentName: DEFAULT_STUDENT_NAME,
        title: DEFAULT_PROJECT_TITLE,
        degree: 'Master Degree',
        university: 'University / Institute',
        department: 'Department',
        supervisor: 'Supervisor',
        academicYear,
        showDecorativeLine: true,
        direction: 'auto'
      },
      spine: {
        studentName: DEFAULT_STUDENT_NAME,
        shortTitle: DEFAULT_PROJECT_TITLE,
        year: academicYear,
        universityInitials: '',
        direction: 'top-to-bottom',
        autoFit: true,
        fontSizePt: 14
      },
      back: { summary: '', contactInfo: '', qrText: '', plain: false, direction: 'auto' }
    },
    template: DEFAULT_COVER_TEMPLATES[0],
    customTemplates: [],
    batchStudents: [],
    exportSettings: {
      mode: 'print-final',
      includeFoldLines: false,
      includeCropMarks: productionPreset.cropMarks,
      includeSafeZones: false,
      imageQuality: 'balanced'
    },
    viewMode: 'layout',
    mockupMode: 'flat',
    showGuides: true,
    showSafeZones: true,
    snapToGuides: true,
    zoom: 1,
    job: {
      customerName: '',
      phoneNumber: '',
      jobTitle: 'Hardcover Cover',
      notes: '',
      status: 'draft',
      quote: {
        materialCost: 0,
        printCost: 0,
        finishingCost: 0,
        designCost: 0,
        quantity: 1,
        discount: 0,
        depositPaid: 0
      }
    }
  }
}

export function getCurrentAcademicYear(date = new Date()): string {
  const year = date.getFullYear()

  return `${year - 1}/${year}`
}

export function calculateQuote(quote: QuoteBreakdown): QuoteSummary {
  const quantity = Math.max(1, quote.quantity)
  const subtotal =
    Math.max(0, quote.materialCost + quote.printCost + quote.finishingCost + quote.designCost) *
    quantity
  const finalPrice = Math.max(0, subtotal - Math.max(0, quote.discount))
  return {
    ...quote,
    quantity,
    subtotal,
    finalPrice,
    remaining: Math.max(0, finalPrice - Math.max(0, quote.depositPaid))
  }
}

export function parseBatchCsv(csv: string): BatchStudent[] {
  const rows = csv
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim())
  if (rows.length < 2) return []
  const headers = splitCsvRow(rows[0]).map((header) => header.trim())
  return rows.slice(1).map((row, index) => {
    const values = splitCsvRow(row)
    const value = (name: string): string => values[headers.indexOf(name)]?.trim() ?? ''
    return {
      id: `student-${Date.now().toString(36)}-${index}`,
      studentName: value('studentName'),
      title: value('title'),
      year: value('year'),
      department: value('department'),
      supervisor: value('supervisor'),
      spineTitle: value('spineTitle')
    }
  })
}

function splitCsvRow(row: string): string[] {
  const values: string[] = []
  let current = ''
  let quoted = false
  for (let index = 0; index < row.length; index += 1) {
    const char = row[index]
    if (char === '"' && row[index + 1] === '"') {
      current += '"'
      index += 1
    } else if (char === '"') quoted = !quoted
    else if (char === ',' && !quoted) {
      values.push(current)
      current = ''
    } else current += char
  }
  values.push(current)
  return values
}

function createBatchStudent(index: number): BatchStudent {
  return {
    id: `student-${Date.now().toString(36)}-${index}`,
    studentName: '',
    title: '',
    year: '',
    department: '',
    supervisor: '',
    spineTitle: ''
  }
}

function normalizeHardcoverProject(project: HardcoverProjectState): HardcoverProjectState {
  const fallback = createDefaultHardcoverProject()
  const setup = normalizeCoverSetup({ ...fallback.setup, ...project.setup })
  const exportSettings = {
    ...fallback.exportSettings,
    ...project.exportSettings
  }
  const productionPreset =
    project.productionPreset ??
    createProductionPresetFromSetup(
      setup,
      exportSettings.includeCropMarks,
      fallback.productionPreset
    )

  const front = { ...fallback.content.front, ...project.content?.front }
  const spine = { ...fallback.content.spine, ...project.content?.spine }

  if (!project.content?.spine?.shortTitle || spine.shortTitle === LEGACY_DEFAULT_SPINE_TITLE) {
    spine.shortTitle = front.title
  }
  if (!project.content?.spine?.year) {
    spine.year = fallback.content.spine.year
  }

  return {
    ...fallback,
    ...project,
    setup,
    sourcePdf: normalizePdfSource(project.sourcePdf),
    productionPreset,
    content: {
      front,
      spine,
      back: { ...fallback.content.back, ...project.content?.back }
    },
    exportSettings: {
      ...exportSettings,
      includeCropMarks: exportSettings.includeCropMarks ?? productionPreset.cropMarks
    },
    job: {
      ...fallback.job,
      ...project.job,
      quote: { ...fallback.job.quote, ...project.job?.quote }
    }
  }
}

function normalizePdfSource(
  source: HardcoverPdfSource | undefined
): HardcoverPdfSource | undefined {
  if (!source?.fileName) return undefined
  const pageCount = Math.max(0, Number(source.pageCount) || 0)
  const frontPageNumber = Math.min(
    Math.max(1, Number(source.frontPageNumber) || 1),
    Math.max(1, pageCount)
  )
  const backCoverEnabled = Boolean(source.backCoverEnabled)
  const backPageNumber =
    backCoverEnabled && source.backPageNumber !== undefined
      ? Math.min(Math.max(1, Number(source.backPageNumber) || 1), Math.max(1, pageCount))
      : undefined

  return {
    fileName: source.fileName,
    filePath: source.filePath,
    pageCount,
    frontPageNumber,
    backCoverEnabled,
    backPageNumber,
    frontPageRotation: source.frontPageRotation,
    backPageRotation: backCoverEnabled ? source.backPageRotation : undefined,
    fitMode: source.fitMode === 'fill' ? 'fill' : 'fit',
    thumbnailDataUrl: source.thumbnailDataUrl,
    backThumbnailDataUrl: backCoverEnabled ? source.backThumbnailDataUrl : undefined,
    pagePreviews: Array.isArray(source.pagePreviews)
      ? source.pagePreviews.filter(
          (preview) =>
            preview &&
            Number.isInteger(preview.pageNumber) &&
            preview.pageNumber >= 1 &&
            preview.pageNumber <= Math.max(1, pageCount) &&
            typeof preview.thumbnailDataUrl === 'string'
        )
      : [],
    ...(source.bytes instanceof Uint8Array ? { bytes: source.bytes } : {})
  }
}

function applySetupPatch(current: CoverSetup, patch: Partial<CoverSetup>): CoverSetup {
  const next = normalizeCoverSetup({ ...current, ...patch })
  const boardWidthMm = patch.boardWidthMm ?? patch.bookWidthMm
  const boardHeightMm = patch.boardHeightMm ?? patch.bookHeightMm

  if (boardWidthMm !== undefined) {
    next.boardWidthMm = boardWidthMm
    next.bookWidthMm = boardWidthMm
    next.preset = 'custom'
  }
  if (boardHeightMm !== undefined) {
    next.boardHeightMm = boardHeightMm
    next.bookHeightMm = boardHeightMm
    next.preset = 'custom'
  }
  if (
    patch.spineWidthMm !== undefined ||
    patch.leftBandWidthMm !== undefined ||
    patch.rightBandWidthMm !== undefined ||
    patch.paperWidthMm !== undefined ||
    patch.paperHeightMm !== undefined ||
    patch.markLengthMm !== undefined
  ) {
    next.preset = 'custom'
  }
  if (patch.useSameBandWidth) {
    next.rightBandWidthMm = next.leftBandWidthMm
  } else if (current.useSameBandWidth && patch.leftBandWidthMm !== undefined) {
    next.rightBandWidthMm = patch.leftBandWidthMm
  } else if (current.useSameBandWidth && patch.rightBandWidthMm !== undefined) {
    next.leftBandWidthMm = patch.rightBandWidthMm
  }

  return next
}

function shouldSyncSpineStudentName(state: HardcoverProjectState): boolean {
  const spineStudentName = state.content.spine.studentName.trim()
  const frontStudentName = state.content.front.studentName.trim()

  return (
    !spineStudentName ||
    spineStudentName === DEFAULT_STUDENT_NAME ||
    spineStudentName === frontStudentName
  )
}

function shouldSyncSpineTitle(state: HardcoverProjectState): boolean {
  const spineTitle = state.content.spine.shortTitle.trim()
  const frontTitle = state.content.front.title.trim()

  return (
    !spineTitle ||
    spineTitle === LEGACY_DEFAULT_SPINE_TITLE ||
    spineTitle === DEFAULT_PROJECT_TITLE ||
    spineTitle === frontTitle
  )
}

function createPresetFromState(
  state: HardcoverProjectState,
  base: HardcoverProductionPreset = DEFAULT_HARDCOVER_PRODUCTION_PRESET
): HardcoverProductionPreset {
  return createProductionPresetFromSetup(state.setup, state.exportSettings.includeCropMarks, base)
}

export function readProductionPreset(): HardcoverProductionPreset {
  if (typeof window === 'undefined') return DEFAULT_HARDCOVER_PRODUCTION_PRESET

  try {
    const parsed: unknown = JSON.parse(
      window.localStorage.getItem(PRODUCTION_PRESET_STORAGE_KEY) ?? 'null'
    )

    return normalizeProductionPreset(parsed)
  } catch {
    return DEFAULT_HARDCOVER_PRODUCTION_PRESET
  }
}

export function writeProductionPreset(preset: HardcoverProductionPreset): void {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(PRODUCTION_PRESET_STORAGE_KEY, JSON.stringify(preset))
  } catch {
    // The preset is a convenience; the current project state remains usable.
  }
}

function normalizeProductionPreset(value: unknown): HardcoverProductionPreset {
  if (!value || typeof value !== 'object') return DEFAULT_HARDCOVER_PRODUCTION_PRESET
  const candidate = value as Partial<HardcoverProductionPreset>

  return {
    ...DEFAULT_HARDCOVER_PRODUCTION_PRESET,
    ...candidate,
    id: candidate.id || DEFAULT_HARDCOVER_PRODUCTION_PRESET.id,
    name: candidate.name || DEFAULT_HARDCOVER_PRODUCTION_PRESET.name,
    defaultDirection: candidate.defaultDirection === 'rtl' ? 'rtl' : 'ltr',
    paperWidthMm: positive(
      candidate.paperWidthMm,
      DEFAULT_HARDCOVER_PRODUCTION_PRESET.paperWidthMm
    ),
    paperHeightMm: positive(
      candidate.paperHeightMm,
      DEFAULT_HARDCOVER_PRODUCTION_PRESET.paperHeightMm
    ),
    boardWidthMm: positive(
      candidate.boardWidthMm,
      DEFAULT_HARDCOVER_PRODUCTION_PRESET.boardWidthMm
    ),
    boardHeightMm: positive(
      candidate.boardHeightMm,
      DEFAULT_HARDCOVER_PRODUCTION_PRESET.boardHeightMm
    ),
    spineWidthMm: positive(
      candidate.spineWidthMm,
      DEFAULT_HARDCOVER_PRODUCTION_PRESET.spineWidthMm
    ),
    leftBandWidthMm: positive(
      candidate.leftBandWidthMm,
      DEFAULT_HARDCOVER_PRODUCTION_PRESET.leftBandWidthMm,
      true
    ),
    rightBandWidthMm: positive(
      candidate.rightBandWidthMm,
      DEFAULT_HARDCOVER_PRODUCTION_PRESET.rightBandWidthMm,
      true
    ),
    markLengthMm: positive(
      candidate.markLengthMm,
      DEFAULT_HARDCOVER_PRODUCTION_PRESET.markLengthMm
    ),
    centerOnSheet: candidate.centerOnSheet ?? DEFAULT_HARDCOVER_PRODUCTION_PRESET.centerOnSheet,
    cropMarks: candidate.cropMarks ?? DEFAULT_HARDCOVER_PRODUCTION_PRESET.cropMarks
  }
}

function positive(value: unknown, fallback: number, allowZero = false): number {
  return typeof value === 'number' && Number.isFinite(value) && (allowZero ? value >= 0 : value > 0)
    ? value
    : fallback
}

function readCustomTemplates(): CoverTemplate[] {
  if (typeof window === 'undefined') return []

  try {
    const value: unknown = JSON.parse(
      window.localStorage.getItem('my-printer-app.cover-templates.v1') ?? '[]'
    )
    return Array.isArray(value)
      ? (value as CoverTemplate[]).filter(
          (item) => item && typeof item.id === 'string' && typeof item.name === 'string'
        )
      : []
  } catch {
    return []
  }
}

function mergeTemplates(primary: CoverTemplate[], secondary: CoverTemplate[]): CoverTemplate[] {
  return [
    ...primary,
    ...secondary.filter((candidate) => !primary.some((item) => item.id === candidate.id))
  ]
}
