import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
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
import { DEFAULT_SPINE_BACKGROUND_COLOR, normalizeHexColor } from '../lib/spineBackground'
import { normalizePdfPagePosition } from '../lib/pdfPosition'
import { calculateSpineTextLayout, syncSpineAutoFitFontSize } from '../lib/spineTextLayout'
import { useSpineAutoFill } from './useSpineAutoFill'
import {
  consumeHardcoverPdfImportTarget,
  hasHardcoverPdfSourceBytes,
  importHardcoverPdfCoverSource,
  importHardcoverPdfSource,
  loadHardcoverPdfPagePreviews,
  releaseHardcoverPdfCoverSourceRuntime,
  releaseHardcoverPdfSourceRuntime,
  selectHardcoverPdfBackPage,
  selectHardcoverPdfFrontPage,
  setHardcoverPdfBackCoverEnabled,
  updateHardcoverSeparatePdfSource
} from '../lib/sourcePdf'
import type {
  BackCoverContent,
  BatchStudent,
  CoverContent,
  CoverSetup,
  CoverTemplate,
  HardcoverPdfCoverSource,
  FrontCoverContent,
  HardcoverPdfCoverTarget,
  HardcoverPdfPagePosition,
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
  detectingSpine: boolean
  spineDetectionMessage: string | null
  detectSpine: () => void
  resetSpineAutoFill: () => void
  updateBack: (patch: Partial<BackCoverContent>) => void
  updateExportSettings: (patch: Partial<HardcoverExportSettings>) => void
  importSourcePdf: (file: File) => Promise<void>
  selectSourcePdfFrontPage: (pageNumber: number) => Promise<void>
  selectSourcePdfBackPage: (pageNumber: number) => Promise<void>
  setSourcePdfBackCoverEnabled: (enabled: boolean) => Promise<void>
  loadSourcePdfPagePreviews: (
    startPage: number,
    count?: number,
    target?: HardcoverPdfCoverTarget
  ) => Promise<void>
  updateSourcePdfFitMode: (
    fitMode: HardcoverPdfSource['fitMode'],
    target?: HardcoverPdfCoverTarget
  ) => void
  updateSourcePdfPosition: (
    position: HardcoverPdfPagePosition,
    target?: HardcoverPdfCoverTarget
  ) => void
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
  clearProject: (keepSettings?: boolean) => void
} {
  const [state, setState] = useState<HardcoverProjectState>(() => {
    const initial = initialProject
      ? normalizeHardcoverProject(structuredClone(initialProject))
      : createDefaultHardcoverProject()
    const storedTemplates = readCustomTemplates()
    return { ...initial, customTemplates: mergeTemplates(initial.customTemplates, storedTemplates) }
  })
  const sourceRuntimeRef = useRef<HardcoverPdfSource | undefined>(undefined)
  const sourceMountedRef = useRef(true)
  const spineDetection = useSpineAutoFill(state, setState, getCurrentAcademicYear())
  const sourceReady = useMemo(
    () => (state.sourcePdf ? hasHardcoverPdfSourceBytes(state.sourcePdf) : false),
    [state.sourcePdf]
  )

  useEffect(() => {
    sourceRuntimeRef.current = state.sourcePdf
  }, [state.sourcePdf])

  useEffect(() => {
    sourceMountedRef.current = true
    return () => {
      sourceMountedRef.current = false
      releaseHardcoverPdfSourceRuntime(sourceRuntimeRef.current)
    }
  }, [])

  const dimensions = useMemo(() => calculateCoverDimensions(state.setup), [state.setup])
  const spineLayout = useMemo(
    () =>
      calculateSpineTextLayout(
        state.content.spine,
        state.setup.spineWidthMm,
        dimensions.spine.heightMm - state.setup.hingeMm * 2
      ),
    [
      dimensions.spine.heightMm,
      state.content.spine.autoFit,
      state.content.spine.fontSizePt,
      state.content.spine.shortTitle,
      state.content.spine.studentName,
      state.content.spine.year,
      state.setup.hingeMm,
      state.setup.spineWidthMm
    ]
  )

  useEffect(() => {
    if (!state.content.spine.autoFit) return

    setState((current) => {
      if (!current.content.spine.autoFit) return current

      const currentDimensions = calculateCoverDimensions(current.setup)
      const currentLayout = calculateSpineTextLayout(
        current.content.spine,
        current.setup.spineWidthMm,
        currentDimensions.spine.heightMm - current.setup.hingeMm * 2
      )
      const nextSpine = syncSpineAutoFitFontSize(current.content.spine, currentLayout)

      if (nextSpine === current.content.spine) return current

      return {
        ...current,
        content: {
          ...current.content,
          spine: nextSpine
        }
      }
    })
  }, [spineLayout.fontSizePt, state.content.spine.autoFit])

  const quote = useMemo(() => calculateQuote(state.job.quote), [state.job.quote])
  const warnings = useMemo(() => {
    const next = [...dimensions.warnings]
    if (spineLayout.warning) next.push(spineLayout.warning)
    if (!state.sourcePdf) next.push('Upload a memoire PDF before exporting the production sheet.')
    if (state.sourcePdf && !sourceReady)
      next.push(
        state.sourcePdf.sourceMode === 'separate'
          ? 'One or more independent cover PDFs are missing. Upload the front and back sources again before exporting.'
          : 'The saved PDF source is missing. Upload the memoire PDF again before exporting.'
      )
    if (!state.content.front.studentName.trim()) next.push('Student name is missing.')
    if (!state.content.front.title.trim()) next.push('Project title is missing.')
    return next
  }, [
    dimensions.warnings,
    spineLayout.warning,
    state.sourcePdf,
    sourceReady,
    state.content.front.studentName,
    state.content.front.title
  ])
  const checklist = useMemo(
    () => [
      { label: 'Source PDF loaded', passed: sourceReady },
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
      sourceReady,
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
    (patch: Partial<SpineContent>) => {
      spineDetection.markSpineEdited(patch)
      updateContent('spine', patch)
    },
    [spineDetection.markSpineEdited, updateContent]
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
      const target = consumeHardcoverPdfImportTarget(file)

      if (target === 'single') {
        const sourcePdf = await importHardcoverPdfSource(file)
        if (!sourceMountedRef.current) {
          releaseHardcoverPdfSourceRuntime(sourcePdf)
          return
        }
        patchState((current) => {
          releaseHardcoverPdfSourceRuntime(current.sourcePdf)
          return { ...current, sourcePdf }
        })
        return
      }

      const coverSource = await importHardcoverPdfCoverSource(file)
      if (!sourceMountedRef.current) {
        releaseHardcoverPdfCoverSourceRuntime(coverSource)
        return
      }
      patchState((current) => {
        const previousCover =
          target === 'front' ? current.sourcePdf?.frontSource : current.sourcePdf?.backSource
        if (previousCover) releaseHardcoverPdfCoverSourceRuntime(previousCover)

        return {
          ...current,
          sourcePdf: updateHardcoverSeparatePdfSource(current.sourcePdf, target, coverSource)
        }
      })
    },
    [patchState]
  )
  const selectSourcePdfFrontPage = useCallback(
    async (pageNumber: number): Promise<void> => {
      const currentSource = state.sourcePdf
      if (!currentSource) throw new Error('Upload a memoire PDF first.')
      const sourcePdf = await selectHardcoverPdfFrontPage(currentSource, pageNumber)
      patchState((current) => ({ ...current, sourcePdf }))
    },
    [patchState, state.sourcePdf]
  )
  const selectSourcePdfBackPage = useCallback(
    async (pageNumber: number): Promise<void> => {
      const currentSource = state.sourcePdf
      if (!currentSource) throw new Error('Upload a memoire PDF first.')
      const sourcePdf = await selectHardcoverPdfBackPage(currentSource, pageNumber)
      patchState((current) => ({ ...current, sourcePdf }))
    },
    [patchState, state.sourcePdf]
  )
  const setSourcePdfBackCoverEnabled = useCallback(
    async (enabled: boolean): Promise<void> => {
      const currentSource = state.sourcePdf
      if (!currentSource) throw new Error('Upload a memoire PDF first.')
      const sourcePdf = await setHardcoverPdfBackCoverEnabled(currentSource, enabled)
      patchState((current) => ({ ...current, sourcePdf }))
    },
    [patchState, state.sourcePdf]
  )
  const loadSourcePdfPagePreviews = useCallback(
    async (
      startPage: number,
      count?: number,
      target: HardcoverPdfCoverTarget = 'front'
    ): Promise<void> => {
      const currentSource = state.sourcePdf
      if (!currentSource) throw new Error('Upload a memoire PDF first.')
      const sourcePdf = await loadHardcoverPdfPagePreviews(currentSource, startPage, count, target)
      patchState((current) => ({ ...current, sourcePdf }))
    },
    [patchState, state.sourcePdf]
  )
  const updateSourcePdfFitMode = useCallback(
    (fitMode: HardcoverPdfSource['fitMode'], target: HardcoverPdfCoverTarget = 'front'): void =>
      patchState((current) =>
        current.sourcePdf
          ? {
              ...current,
              sourcePdf: {
                ...current.sourcePdf,
                fitMode:
                  current.sourcePdf.sourceMode === 'separate' && target === 'back'
                    ? current.sourcePdf.fitMode
                    : fitMode,
                frontSource:
                  current.sourcePdf.sourceMode === 'separate' && target === 'front'
                    ? current.sourcePdf.frontSource
                      ? { ...current.sourcePdf.frontSource, fitMode }
                      : undefined
                    : current.sourcePdf.frontSource,
                backSource:
                  current.sourcePdf.sourceMode === 'separate' && target === 'back'
                    ? current.sourcePdf.backSource
                      ? { ...current.sourcePdf.backSource, fitMode }
                      : undefined
                    : current.sourcePdf.backSource
              }
            }
          : current
      ),
    [patchState]
  )
  const updateSourcePdfPosition = useCallback(
    (position: HardcoverPdfPagePosition, target: HardcoverPdfCoverTarget = 'front'): void =>
      patchState((current) => {
        if (!current.sourcePdf) return current

        const normalizedPosition = normalizePdfPagePosition(position)
        const separate =
          current.sourcePdf.sourceMode === 'separate' ||
          Boolean(current.sourcePdf.frontSource || current.sourcePdf.backSource)

        return {
          ...current,
          sourcePdf: {
            ...current.sourcePdf,
            frontPosition:
              !separate && target === 'front'
                ? normalizedPosition
                : current.sourcePdf.frontPosition,
            backPosition:
              !separate && target === 'back' ? normalizedPosition : current.sourcePdf.backPosition,
            frontSource:
              separate && target === 'front' && current.sourcePdf.frontSource
                ? { ...current.sourcePdf.frontSource, position: normalizedPosition }
                : current.sourcePdf.frontSource,
            backSource:
              separate && target === 'back' && current.sourcePdf.backSource
                ? { ...current.sourcePdf.backSource, position: normalizedPosition }
                : current.sourcePdf.backSource
          }
        }
      }),
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
  const clearProject = useCallback(
    (keepSettings = false): void => {
      spineDetection.resetSpineDetection()
      releaseHardcoverPdfSourceRuntime(sourceRuntimeRef.current)
      sourceRuntimeRef.current = undefined
      if (!keepSettings) {
        setState(createDefaultHardcoverProject())
        return
      }
      setState((current) => ({
        ...current,
        sourcePdf: undefined,
        batchStudents: [],
        content: {
          front: {
            ...current.content.front,
            studentName: '',
            title: '',
            degree: '',
            university: '',
            department: '',
            supervisor: '',
            academicYear: '',
            logoDataUrl: undefined,
            backgroundDataUrl: undefined
          },
          spine: {
            ...current.content.spine,
            studentName: '',
            shortTitle: '',
            year: '',
            universityInitials: ''
          },
          back: {
            ...current.content.back,
            summary: '',
            contactInfo: '',
            qrText: '',
            logoDataUrl: undefined
          }
        }
      }))
    },
    [spineDetection.resetSpineDetection]
  )

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
    detectingSpine: spineDetection.detectingSpine,
    spineDetectionMessage: spineDetection.spineDetectionMessage,
    detectSpine: spineDetection.detectSpine,
    resetSpineAutoFill: spineDetection.resetSpineDetection,
    updateBack,
    updateExportSettings,
    importSourcePdf,
    selectSourcePdfFrontPage,
    selectSourcePdfBackPage,
    setSourcePdfBackCoverEnabled,
    loadSourcePdfPagePreviews,
    updateSourcePdfFitMode,
    updateSourcePdfPosition,
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
        fontSizePt: 14,
        spineColorMode: 'auto',
        spineBackgroundColor: DEFAULT_SPINE_BACKGROUND_COLOR
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
        depositPaid: 0,
        totalPrice: 0
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
  const itemizedSubtotal =
    Math.max(0, quote.materialCost + quote.printCost + quote.finishingCost + quote.designCost) *
    quantity
  const directTotal =
    typeof quote.totalPrice === 'number' && Number.isFinite(quote.totalPrice)
      ? Math.max(0, quote.totalPrice)
      : undefined
  const legacyFinalPrice = Math.max(0, itemizedSubtotal - Math.max(0, quote.discount))
  const finalPrice = directTotal ?? legacyFinalPrice
  return {
    ...quote,
    quantity,
    subtotal: finalPrice,
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
  spine.spineColorMode = project.content?.spine?.spineColorMode === 'custom' ? 'custom' : 'auto'
  spine.spineBackgroundColor = normalizeHexColor(
    project.content?.spine?.spineBackgroundColor,
    fallback.content.spine.spineBackgroundColor
  )

  if (!project.content?.spine?.shortTitle || spine.shortTitle === LEGACY_DEFAULT_SPINE_TITLE) {
    spine.shortTitle = front.title
  }
  if (!project.content?.spine?.year) {
    spine.year = fallback.content.spine.year
  }

  const incomingQuote = project.job?.quote
  const normalizedQuote: QuoteBreakdown = { ...fallback.job.quote, ...incomingQuote }
  if (incomingQuote && incomingQuote.totalPrice === undefined) {
    normalizedQuote.totalPrice = calculateQuote({
      ...normalizedQuote,
      totalPrice: undefined
    }).finalPrice
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
      quote: normalizedQuote
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
  const frontSource = normalizePdfCoverSource(source.frontSource)
  const backSource = normalizePdfCoverSource(source.backSource)
  const separate = source.sourceMode === 'separate' || Boolean(frontSource || backSource)
  const normalizedFrontPageNumber = separate ? (frontSource?.pageNumber ?? 1) : frontPageNumber
  const normalizedBackPageNumber = separate
    ? backCoverEnabled
      ? backSource?.pageNumber
      : undefined
    : backPageNumber

  return {
    fileName: source.fileName,
    filePath: source.filePath,
    pageCount,
    frontPageNumber: normalizedFrontPageNumber,
    backCoverEnabled: separate ? Boolean(backSource && backCoverEnabled) : backCoverEnabled,
    backPageNumber: normalizedBackPageNumber,
    frontPageRotation: separate ? frontSource?.rotation : source.frontPageRotation,
    backPageRotation: separate
      ? backSource?.rotation
      : backCoverEnabled
        ? source.backPageRotation
        : undefined,
    fitMode: source.fitMode === 'fill' ? 'fill' : 'fit',
    frontPosition: normalizePdfPagePosition(
      separate ? frontSource?.position : source.frontPosition
    ),
    backPosition: normalizePdfPagePosition(separate ? backSource?.position : source.backPosition),
    thumbnailDataUrl: source.thumbnailDataUrl,
    backThumbnailDataUrl: separate
      ? backSource?.thumbnailDataUrl
      : backCoverEnabled
        ? source.backThumbnailDataUrl
        : undefined,
    frontPageGeometry: separate ? frontSource?.pageGeometry : source.frontPageGeometry,
    backPageGeometry: separate
      ? backSource?.pageGeometry
      : backCoverEnabled
        ? source.backPageGeometry
        : undefined,
    ...(separate
      ? {
          sourceMode: 'separate' as const,
          frontSource,
          backSource
        }
      : {}),
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

function normalizePdfCoverSource(
  source: HardcoverPdfCoverSource | undefined
): HardcoverPdfCoverSource | undefined {
  if (!source?.fileName || !source.sourceId) return undefined
  const pageCount = Math.max(0, Number(source.pageCount) || 0)

  return {
    sourceId: source.sourceId,
    fileName: source.fileName,
    filePath: source.filePath,
    pageCount,
    pageNumber: Math.min(Math.max(1, Number(source.pageNumber) || 1), Math.max(1, pageCount)),
    rotation: Number.isFinite(source.rotation) ? source.rotation : undefined,
    fitMode: source.fitMode === 'fill' ? 'fill' : 'fit',
    position: normalizePdfPagePosition(source.position),
    thumbnailDataUrl: source.thumbnailDataUrl,
    pageGeometry: source.pageGeometry,
    pagePreviews: Array.isArray(source.pagePreviews)
      ? source.pagePreviews.filter(
          (preview) =>
            preview &&
            Number.isInteger(preview.pageNumber) &&
            preview.pageNumber >= 1 &&
            preview.pageNumber <= Math.max(1, pageCount) &&
            typeof preview.thumbnailDataUrl === 'string'
        )
      : []
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
