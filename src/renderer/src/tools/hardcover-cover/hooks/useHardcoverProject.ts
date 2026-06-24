import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction
} from 'react'
import type { HardcoverProjectPayload } from '@/projects/projectFiles'
import { calculateCoverDimensions, DEFAULT_A4_COVER_SETUP } from '../lib/coverCalculations'
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
  HardcoverProjectState,
  QuoteBreakdown,
  QuoteSummary,
  SpineContent
} from '../types'

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
      ? structuredClone(initialProject)
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
    if (!state.content.front.studentName.trim()) next.push('Student name is missing.')
    if (!state.content.front.title.trim()) next.push('Project title is missing.')
    return next
  }, [
    dimensions.warnings,
    spineLayout.warning,
    state.content.front.studentName,
    state.content.front.title
  ])
  const checklist = useMemo(
    () => [
      { label: 'Book width entered', passed: state.setup.bookWidthMm > 0 },
      { label: 'Book height entered', passed: state.setup.bookHeightMm > 0 },
      { label: 'Spine thickness entered', passed: state.setup.spineWidthMm > 0 },
      {
        label: 'Wrap margin is at least 12 mm',
        passed: Math.min(...Object.values(state.setup.wrap)) >= 12
      },
      { label: 'Spine text fits safe area', passed: spineLayout.fits },
      {
        label: 'Export size fits paper',
        passed: !dimensions.warnings.some((warning) => warning.includes('paper size'))
      },
      {
        label: 'Guides hidden for final print',
        passed:
          state.exportSettings.mode !== 'print-final' ||
          (!state.exportSettings.includeSafeZones && !state.showGuides)
      }
    ],
    [
      dimensions.warnings,
      spineLayout.fits,
      state.exportSettings.includeSafeZones,
      state.exportSettings.mode,
      state.setup,
      state.showGuides
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
      patchState((current) => ({ ...current, setup: { ...current.setup, ...patch } })),
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
    (patch: Partial<FrontCoverContent>) => updateContent('front', patch),
    [updateContent]
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
  return {
    setup: structuredClone(DEFAULT_A4_COVER_SETUP),
    content: {
      front: {
        studentName: 'Student Name',
        title: 'Graduation Project Title',
        degree: 'Master Degree',
        university: 'University / Institute',
        department: 'Department',
        supervisor: 'Supervisor',
        academicYear: '2025-2026',
        showDecorativeLine: true,
        direction: 'auto'
      },
      spine: {
        studentName: 'Student Name',
        shortTitle: 'Graduation Project',
        year: '2026',
        universityInitials: '',
        direction: 'bottom-to-top',
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
      includeCropMarks: true,
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

function readCustomTemplates(): CoverTemplate[] {
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
