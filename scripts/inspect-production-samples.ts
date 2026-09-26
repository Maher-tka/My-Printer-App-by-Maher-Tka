import { readdir, readFile, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { extname, relative, resolve } from 'node:path'
import process from 'node:process'

const SAMPLE_ROOT_ENV = 'PRINTER_PRODUCTION_SAMPLES_DIR'
const PDF_SIGNATURE = '%PDF-'
const PDF_EXTENSIONS = new Set(['.pdf', '.ai'])
const MILLIMETERS_PER_POINT = 25.4 / 72

type OutputFormat = 'text' | 'json'
type SourceKind = 'pdf' | 'pdf-compatible-ai'
type Classification =
  | 'likely-print-and-cut'
  | 'artwork-only'
  | 'book-interior'
  | 'already-imposed'
  | 'ambiguous'

interface CliOptions {
  folder?: string
  format: OutputFormat
}

interface PdfLoadingTaskLike {
  promise: Promise<PdfDocumentLike>
  destroy(): Promise<void>
}

interface PdfDocumentLike {
  numPages: number
  getMetadata(): Promise<{ info?: Record<string, unknown> }>
  getOptionalContentConfig(): Promise<OptionalContentConfigLike>
  getPage(pageNumber: number): Promise<PdfPageLike>
  destroy(): Promise<void>
}

interface PdfPageLike {
  view: number[]
  rotate?: number
  userUnit?: number
  cleanup(): void
}

interface PdfJsModuleLike {
  getDocument(options: {
    data: Uint8Array
    stopAtErrors?: boolean
    disableWorker?: boolean
  }): PdfLoadingTaskLike
}

interface OptionalContentGroupLike {
  name?: unknown
  visible?: unknown
  intent?: unknown
}

interface OptionalContentConfigLike {
  getOrder(): unknown
  getGroup(id: string): OptionalContentGroupLike | undefined
}

interface PdfLibRectangleLike {
  x: number
  y: number
  width: number
  height: number
}

interface PdfLibPageLike {
  getMediaBox(): PdfLibRectangleLike
  getCropBox(): PdfLibRectangleLike
  getTrimBox(): PdfLibRectangleLike
  getBleedBox(): PdfLibRectangleLike
  getArtBox(): PdfLibRectangleLike
  getRotation(): { angle: number }
}

interface PdfLibDocumentLike {
  getPages(): PdfLibPageLike[]
  getTitle(): string | undefined
  getCreator(): string | undefined
  getProducer(): string | undefined
}

interface PdfLibModuleLike {
  PDFDocument: {
    load(
      data: Uint8Array,
      options?: {
        updateMetadata?: boolean
        throwOnInvalidObject?: boolean
      }
    ): Promise<PdfLibDocumentLike>
  }
}

interface ParserLibraries {
  pdfjs: PdfJsModuleLike
  pdfLib: PdfLibModuleLike
}

interface Box {
  x: number
  y: number
  width: number
  height: number
  widthMm: number
  heightMm: number
}

interface PageBoxes {
  media: Box | null
  crop: Box | null
  trim: Box | null
  bleed: Box | null
  art: Box | null
}

interface PhysicalDimensions {
  sourceBox: 'media'
  widthPt: number
  heightPt: number
  widthMm: number
  heightMm: number
  widthIn: number
  heightIn: number
  uniformAcrossPages: boolean
}

interface PageInspection {
  pageNumber: number
  rotation: number
  userUnit: number
  boxes: PageBoxes
  boxSource: 'pdf-lib' | 'pdfjs-view-fallback'
  physicalDimensions: {
    widthPt: number | null
    heightPt: number | null
    widthMm: number | null
    heightMm: number | null
  }
}

interface OcgLayer {
  name: string
  defaultOn: boolean | null
  intent: string[]
}

interface SpotColorant {
  name: string
  kind: 'Separation' | 'DeviceN'
  isRegistrationMark: boolean
  isCutContourCandidate: boolean
}

interface KnownProductionSignals {
  hiddenCalque2: boolean
  calque2LayerDetected: boolean
  registrationMarkLayer: boolean
  registrationMarkColorants: string[]
  cutContourColorants: string[]
  mimakiColorantsAreNotCutContour: boolean
}

interface EncryptionInspection {
  status: 'encrypted' | 'not-encrypted' | 'unknown'
  filter: string | null
}

interface SampleInspection {
  relativePath: string
  sourceKind: SourceKind
  fileSizeBytes: number
  fileSize: string
  pageCount: number | null
  physicalDimensions: PhysicalDimensions | null
  pages: PageInspection[]
  creator: string | null
  producer: string | null
  title: string | null
  encryption: EncryptionInspection
  ocgLayers: OcgLayer[]
  spotColorants: SpotColorant[]
  knownProductionSignals: KnownProductionSignals
  classification: Classification
  classificationReasons: string[]
  parseStatus: 'parsed' | 'partial' | 'failed'
  errors: string[]
  warnings: string[]
}

interface SkippedFile {
  relativePath: string
  fileSizeBytes: number
  fileSize: string
  reason: string
}

interface InspectionReport {
  readOnly: true
  root: string
  environmentVariable: string
  inspectedAt: string
  parser: {
    pdfjs: string
    pdfLib: string
  }
  inspectedFileCount: number
  skippedFileCount: number
  failedFileCount: number
  classifications: Record<Classification, number>
  files: SampleInspection[]
  skippedFiles: SkippedFile[]
}

interface RawPdfSignals {
  encryptionDetected: boolean
  spotColorants: SpotColorant[]
  layerNames: string[]
}

interface PdfJsInspection {
  pageCount: number
  metadata: Record<string, unknown>
  layers: OcgLayer[]
  pageViews: Array<{ view: number[]; rotation: number; userUnit: number }>
}

interface PdfLibInspection {
  pageCount: number
  metadata: {
    title: string | null
    creator: string | null
    producer: string | null
  }
  pages: PdfLibPageLike[]
}

interface CandidateFile {
  filePath: string
  extension: string
  sourceKind: SourceKind
}

function parseCliArgs(args: string[]): CliOptions & { help?: boolean } {
  let folder: string | undefined
  let format: OutputFormat = 'text'
  let help = false

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]

    if (argument === '--help' || argument === '-h') {
      help = true
      continue
    }

    if (argument === '--json' || argument === '--format=json') {
      format = 'json'
      continue
    }

    if (argument === '--text' || argument === '--format=text') {
      format = 'text'
      continue
    }

    if (argument === '--format') {
      const value = args[index + 1]
      if (value !== 'json' && value !== 'text') {
        throw new Error('The --format value must be either json or text.')
      }
      format = value
      index += 1
      continue
    }

    if (argument.startsWith('-')) {
      throw new Error(`Unknown option: ${argument}`)
    }

    if (folder) {
      throw new Error('Provide one folder path only.')
    }
    folder = argument
  }

  return { folder, format, help }
}

function printUsage(): void {
  console.log(`Usage:
  npx tsx scripts/inspect-production-samples.ts <folder> [--json]

The folder may also be supplied through ${SAMPLE_ROOT_ENV}.

The inspector recursively reads PDF files and PDF-compatible Illustrator .ai files.
It never copies, rewrites, exports, or deletes source files.`)
}

async function loadParserLibraries(): Promise<ParserLibraries> {
  try {
    const pdfjs = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as unknown as PdfJsModuleLike
    const pdfLib = (await import('pdf-lib')) as unknown as PdfLibModuleLike
    return { pdfjs, pdfLib }
  } catch (error) {
    throw new Error(
      `PDF parsing dependencies are unavailable. Run npm install in the project root and retry. ` +
        `This inspector requires the existing pdfjs-dist and pdf-lib packages. ${describeError(error)}`
    )
  }
}

async function collectCandidateFiles(root: string): Promise<{
  candidates: CandidateFile[]
  skippedFiles: SkippedFile[]
}> {
  const candidates: CandidateFile[] = []
  const skippedFiles: SkippedFile[] = []

  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true })
    entries.sort((first, second) =>
      first.name.localeCompare(second.name, undefined, { sensitivity: 'base' })
    )

    for (const entry of entries) {
      const filePath = resolve(directory, entry.name)

      if (entry.isDirectory()) {
        await visit(filePath)
        continue
      }

      if (!entry.isFile()) continue

      const extension = extname(entry.name).toLowerCase()
      if (!PDF_EXTENSIONS.has(extension)) continue

      const fileStats = await stat(filePath)
      const relativePath = relative(root, filePath) || entry.name
      const fileSize = formatBytes(fileStats.size)

      if (extension === '.ai') {
        const header = await readFile(filePath, { encoding: 'latin1' }).then((text) =>
          text.slice(0, 1024)
        )
        if (!header.includes(PDF_SIGNATURE)) {
          skippedFiles.push({
            relativePath,
            fileSizeBytes: fileStats.size,
            fileSize,
            reason: 'The .ai file is not PDF-compatible (no %PDF- signature in its header).'
          })
          continue
        }
      }

      candidates.push({
        filePath,
        extension,
        sourceKind: extension === '.ai' ? 'pdf-compatible-ai' : 'pdf'
      })
    }
  }

  await visit(root)
  return { candidates, skippedFiles }
}

async function inspectCandidate(
  root: string,
  candidate: CandidateFile,
  libraries: ParserLibraries
): Promise<SampleInspection> {
  const fileStats = await stat(candidate.filePath)
  const relativePath = relative(root, candidate.filePath) || candidate.filePath
  const fileBytes = await readFile(candidate.filePath)
  const bytes = new Uint8Array(fileBytes.buffer, fileBytes.byteOffset, fileBytes.byteLength)
  const rawText = fileBytes.toString('latin1')
  const rawSignals = scanRawPdfSignals(rawText)
  const errors: string[] = []
  const warnings: string[] = []

  let pdfJsInspection: PdfJsInspection | undefined
  try {
    pdfJsInspection = await inspectWithPdfJs(bytes, libraries.pdfjs)
  } catch (error) {
    errors.push(`PDF.js: ${describeError(error)}`)
  }

  let pdfLibInspection: PdfLibInspection | undefined
  try {
    pdfLibInspection = await inspectWithPdfLib(fileBytes, libraries.pdfLib)
  } catch (error) {
    errors.push(`pdf-lib: ${describeError(error)}`)
  }

  const pageCount = pdfJsInspection?.pageCount ?? pdfLibInspection?.pageCount ?? null
  if (
    pdfJsInspection &&
    pdfLibInspection &&
    pdfJsInspection.pageCount !== pdfLibInspection.pageCount
  ) {
    warnings.push(
      `PDF.js reported ${pdfJsInspection.pageCount} pages while pdf-lib reported ${pdfLibInspection.pageCount}.`
    )
  }

  const pages = buildPageInspections(
    pageCount,
    pdfLibInspection?.pages ?? [],
    pdfJsInspection?.pageViews ?? []
  )
  const physicalDimensions = createPhysicalDimensions(pages)
  const ocgLayers = mergeLayerSources(pdfJsInspection?.layers ?? [], rawSignals.layerNames)
  const spotColorants = rawSignals.spotColorants
  const knownProductionSignals = createKnownProductionSignals(ocgLayers, spotColorants)
  const classification = classifySample({
    relativePath,
    pageCount,
    physicalDimensions,
    ocgLayers,
    spotColorants,
    knownProductionSignals
  })
  const metadata = pdfJsInspection?.metadata ?? {}
  const pdfLibMetadata = pdfLibInspection?.metadata
  const creator = firstString(metadata.Creator, metadata.creator) ?? pdfLibMetadata?.creator ?? null
  const producer =
    firstString(metadata.Producer, metadata.producer) ?? pdfLibMetadata?.producer ?? null
  const title = firstString(metadata.Title, metadata.title) ?? pdfLibMetadata?.title ?? null
  const encryptionFilter =
    firstString(metadata.EncryptFilterName, metadata.encryptFilterName) ?? null
  const encrypted = rawSignals.encryptionDetected || encryptionFilter !== null
  const parseStatus =
    pdfJsInspection && pdfLibInspection
      ? 'parsed'
      : pdfJsInspection || pdfLibInspection
        ? 'partial'
        : 'failed'

  if (parseStatus !== 'parsed') {
    warnings.push(
      'At least one PDF parser could not read this file; missing fields are reported as unknown.'
    )
  }

  return {
    relativePath,
    sourceKind: candidate.sourceKind,
    fileSizeBytes: fileStats.size,
    fileSize: formatBytes(fileStats.size),
    pageCount,
    physicalDimensions,
    pages,
    creator,
    producer,
    title,
    encryption: {
      status: encrypted ? 'encrypted' : parseStatus === 'failed' ? 'unknown' : 'not-encrypted',
      filter: encryptionFilter
    },
    ocgLayers,
    spotColorants,
    knownProductionSignals,
    classification: classification.label,
    classificationReasons: classification.reasons,
    parseStatus,
    errors,
    warnings
  }
}

async function inspectWithPdfJs(
  bytes: Uint8Array,
  pdfjs: PdfJsModuleLike
): Promise<PdfJsInspection> {
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    stopAtErrors: false,
    disableWorker: true
  })
  let pdf: PdfDocumentLike | undefined

  try {
    pdf = await loadingTask.promise
    const metadata = (await pdf.getMetadata()).info ?? {}
    const layers = await readOptionalContentLayers(pdf)
    const pageViews: PdfJsInspection['pageViews'] = []

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber)
      try {
        pageViews.push({
          view: Array.isArray(page.view) ? page.view : [],
          rotation: normalizeRotation(page.rotate ?? 0),
          userUnit: finiteOr(page.userUnit, 1)
        })
      } finally {
        page.cleanup()
      }
    }

    return { pageCount: pdf.numPages, metadata, layers, pageViews }
  } finally {
    await pdf?.destroy()
  }
}

async function readOptionalContentLayers(pdf: PdfDocumentLike): Promise<OcgLayer[]> {
  try {
    const config = await pdf.getOptionalContentConfig()
    const ids = flattenOrder(config.getOrder())
    const layers: OcgLayer[] = []

    for (const id of ids) {
      const group = config.getGroup(id)
      const name = typeof group?.name === 'string' ? group.name : ''
      if (!name) continue

      layers.push({
        name,
        defaultOn: typeof group?.visible === 'boolean' ? group.visible : null,
        intent: normalizeIntent(group?.intent)
      })
    }

    return dedupeLayers(layers)
  } catch {
    return []
  }
}

async function inspectWithPdfLib(
  bytes: Uint8Array,
  pdfLib: PdfLibModuleLike
): Promise<PdfLibInspection> {
  const document = await pdfLib.PDFDocument.load(bytes, {
    updateMetadata: false,
    throwOnInvalidObject: false
  })
  const pages = document.getPages()

  return {
    pageCount: pages.length,
    metadata: {
      title: document.getTitle() ?? null,
      creator: document.getCreator() ?? null,
      producer: document.getProducer() ?? null
    },
    pages
  }
}

function scanRawPdfSignals(rawText: string): RawPdfSignals {
  const spotColorants: SpotColorant[] = []
  const separationPattern = /\/Separation\s*\/([^\s()[\]<>/]+)/g
  const deviceNPattern = /\/DeviceN\s*\[([^\]]{0,4096})\]/g

  for (const match of rawText.matchAll(separationPattern)) {
    addSpotColorant(spotColorants, decodePdfName(match[1]), 'Separation')
  }

  for (const match of rawText.matchAll(deviceNPattern)) {
    const names = match[1].matchAll(/\/([^\s()[\]<>/]+)/g)
    for (const nameMatch of names) {
      addSpotColorant(spotColorants, decodePdfName(nameMatch[1]), 'DeviceN')
    }
  }

  return {
    encryptionDetected: /\/Encrypt(?:\s|<|\[)/.test(rawText),
    spotColorants,
    layerNames: extractRawOcgLayerNames(rawText)
  }
}

function addSpotColorant(
  spotColorants: SpotColorant[],
  rawName: string,
  kind: SpotColorant['kind']
): void {
  const name = rawName.trim()
  if (!name) return

  const normalized = normalizeSignalName(name)
  const isRegistrationMark = normalized === 'mimakifcrm' || normalized === 'mimakifcrmdir'
  const isCutContourCandidate =
    normalized === 'cutcontour' || normalized === 'cutline' || normalized === 'cutcontourline'

  if (
    spotColorants.some(
      (colorant) => colorant.kind === kind && normalizeSignalName(colorant.name) === normalized
    )
  ) {
    return
  }

  spotColorants.push({ name, kind, isRegistrationMark, isCutContourCandidate })
}

function extractRawOcgLayerNames(rawText: string): string[] {
  const names: string[] = []
  const pattern = /\/Name\s*(\((?:\\.|[^)])*\)|<[0-9a-fA-F\s]+>|\/[^\s()[\]<>/]+)\s*\/Type\s*\/OCG/g

  for (const match of rawText.matchAll(pattern)) {
    const token = match[1]
    const decoded = token.startsWith('(')
      ? decodePdfLiteral(token.slice(1, -1))
      : token.startsWith('<')
        ? decodePdfHex(token.slice(1, -1))
        : decodePdfName(token.slice(1))

    if (decoded) names.push(decoded)
  }

  return [...new Map(names.map((name) => [normalizeSignalName(name), name])).values()]
}

function mergeLayerSources(pdfJsLayers: OcgLayer[], rawLayerNames: string[]): OcgLayer[] {
  if (pdfJsLayers.length > 0) return pdfJsLayers
  return rawLayerNames.map((name) => ({ name, defaultOn: null, intent: [] }))
}

function createKnownProductionSignals(
  layers: OcgLayer[],
  colorants: SpotColorant[]
): KnownProductionSignals {
  const hiddenCalque2 = layers.some(
    (layer) => normalizeSignalName(layer.name) === 'calque 2' && layer.defaultOn === false
  )
  const calque2LayerDetected = layers.some(
    (layer) => normalizeSignalName(layer.name) === 'calque 2'
  )
  const registrationMarkLayer = layers.some(
    (layer) => normalizeSignalName(layer.name) === 'fc registermark layer1'
  )
  const registrationMarkColorants = colorants
    .filter((colorant) => colorant.isRegistrationMark)
    .map((colorant) => colorant.name)
  const cutContourColorants = colorants
    .filter((colorant) => colorant.isCutContourCandidate && !colorant.isRegistrationMark)
    .map((colorant) => colorant.name)

  return {
    hiddenCalque2,
    calque2LayerDetected,
    registrationMarkLayer,
    registrationMarkColorants,
    cutContourColorants,
    mimakiColorantsAreNotCutContour: registrationMarkColorants.length > 0
  }
}

function classifySample(input: {
  relativePath: string
  pageCount: number | null
  physicalDimensions: PhysicalDimensions | null
  ocgLayers: OcgLayer[]
  spotColorants: SpotColorant[]
  knownProductionSignals: KnownProductionSignals
}): { label: Classification; reasons: string[] } {
  const normalizedPath = normalizeSignalName(input.relativePath)
  const pageCount = input.pageCount ?? 0
  const maximumDimension = input.physicalDimensions
    ? Math.max(input.physicalDimensions.widthMm, input.physicalDimensions.heightMm)
    : 0
  const largeSheet = maximumDimension >= 600
  const imposedNameCue =
    /montage|planche|impression.*decoupe|1m.*(?:vinyle|brillant)|(?:vinyle).*1m|booklet|impose/.test(
      normalizedPath
    )
  const bookNameCue =
    /book|livre|rapport|memoire|etude|these|thesis|pfe|chart 3|interior|interieur/.test(
      normalizedPath
    )
  const hasCutContour = input.knownProductionSignals.cutContourColorants.length > 0
  const hasMimakiRegistration = input.knownProductionSignals.registrationMarkColorants.length > 0
  const hasProductionLayers =
    input.knownProductionSignals.registrationMarkLayer ||
    input.knownProductionSignals.hiddenCalque2 ||
    input.knownProductionSignals.calque2LayerDetected
  const alreadyImposed = imposedNameCue && (largeSheet || pageCount <= 16)
  const likelyPrintAndCut =
    !alreadyImposed &&
    (hasCutContour ||
      (hasMimakiRegistration && input.knownProductionSignals.registrationMarkLayer) ||
      (input.knownProductionSignals.hiddenCalque2 && hasMimakiRegistration))
  const bookInterior =
    !alreadyImposed &&
    pageCount >= 12 &&
    (bookNameCue || looksLikeCommonBookPage(input.physicalDimensions))

  const reasons: string[] = []
  if (imposedNameCue) reasons.push('The path contains a montage/planche/imposition cue.')
  if (largeSheet) reasons.push('The first-page media size is at least 600 mm on its longest side.')
  if (input.knownProductionSignals.hiddenCalque2) {
    reasons.push('The optional-content layer Calque 2 is present and default-off.')
  } else if (input.knownProductionSignals.calque2LayerDetected) {
    reasons.push(
      'The optional-content layer Calque 2 is present; its default visibility is unknown.'
    )
  }
  if (input.knownProductionSignals.registrationMarkLayer) {
    reasons.push('FC RegisterMark Layer1 is present.')
  }
  if (hasMimakiRegistration) {
    reasons.push(
      `Mimaki registration-mark separation(s) detected: ${input.knownProductionSignals.registrationMarkColorants.join(', ')}. ` +
        'These are not treated as CutContour.'
    )
  }
  if (hasCutContour) {
    reasons.push(
      `Explicit CutContour-like separation(s) detected: ${input.knownProductionSignals.cutContourColorants.join(', ')}.`
    )
  }
  if (bookInterior)
    reasons.push(`The file has ${pageCount} pages and matches book/interior naming or dimensions.`)
  if (!bookInterior && bookNameCue && pageCount > 0) {
    reasons.push(
      'Book-like naming was found, but the page count or dimensions were not sufficient for book-interior classification.'
    )
  }

  if (alreadyImposed) return { label: 'already-imposed', reasons }
  if (likelyPrintAndCut) return { label: 'likely-print-and-cut', reasons }
  if (bookInterior) return { label: 'book-interior', reasons }

  if (
    pageCount === 1 &&
    !imposedNameCue &&
    !hasMimakiRegistration &&
    !hasProductionLayers &&
    !hasCutContour
  ) {
    reasons.push('One page with no confirmed production layer or cut-color signal was found.')
    return { label: 'artwork-only', reasons }
  }

  reasons.push('The available metadata does not support a stronger classification.')
  return { label: 'ambiguous', reasons }
}

function buildPageInspections(
  pageCount: number | null,
  pdfLibPages: PdfLibPageLike[],
  pdfJsPageViews: PdfJsInspection['pageViews']
): PageInspection[] {
  const count = Math.max(pageCount ?? 0, pdfLibPages.length, pdfJsPageViews.length)
  const pages: PageInspection[] = []

  for (let index = 0; index < count; index += 1) {
    const pdfLibPage = pdfLibPages[index]
    const pdfJsPage = pdfJsPageViews[index]
    const boxes = pdfLibPage
      ? readPdfLibBoxes(pdfLibPage)
      : readPdfJsViewBoxes(pdfJsPage?.view ?? [])
    const boxSource = pdfLibPage ? 'pdf-lib' : 'pdfjs-view-fallback'
    const media = boxes.media
    const rotation = pdfLibPage
      ? normalizeRotation(pdfLibPage.getRotation().angle)
      : normalizeRotation(pdfJsPage?.rotation ?? 0)
    const userUnit = finiteOr(pdfJsPage?.userUnit, 1)
    const widthPt = media ? media.width * userUnit : null
    const heightPt = media ? media.height * userUnit : null

    pages.push({
      pageNumber: index + 1,
      rotation,
      userUnit,
      boxes,
      boxSource,
      physicalDimensions: {
        widthPt: roundNullable(widthPt),
        heightPt: roundNullable(heightPt),
        widthMm: widthPt === null ? null : round(widthPt * MILLIMETERS_PER_POINT),
        heightMm: heightPt === null ? null : round(heightPt * MILLIMETERS_PER_POINT)
      }
    })
  }

  return pages
}

function readPdfLibBoxes(page: PdfLibPageLike): PageBoxes {
  return {
    media: toBox(page.getMediaBox()),
    crop: toBox(page.getCropBox()),
    trim: toBox(page.getTrimBox()),
    bleed: toBox(page.getBleedBox()),
    art: toBox(page.getArtBox())
  }
}

function readPdfJsViewBoxes(view: number[]): PageBoxes {
  if (view.length < 4) {
    return { media: null, crop: null, trim: null, bleed: null, art: null }
  }

  const [x1, y1, x2, y2] = view
  return {
    media: toBox({ x: x1, y: y1, width: x2 - x1, height: y2 - y1 }),
    crop: null,
    trim: null,
    bleed: null,
    art: null
  }
}

function toBox(rectangle: PdfLibRectangleLike): Box | null {
  if (
    !Number.isFinite(rectangle.x) ||
    !Number.isFinite(rectangle.y) ||
    !Number.isFinite(rectangle.width) ||
    !Number.isFinite(rectangle.height)
  ) {
    return null
  }

  return {
    x: round(rectangle.x),
    y: round(rectangle.y),
    width: round(rectangle.width),
    height: round(rectangle.height),
    widthMm: round(rectangle.width * MILLIMETERS_PER_POINT),
    heightMm: round(rectangle.height * MILLIMETERS_PER_POINT)
  }
}

function createPhysicalDimensions(pages: PageInspection[]): PhysicalDimensions | null {
  const first = pages[0]?.boxes.media
  if (!first) return null

  const uniqueSizes = new Set(
    pages
      .map((page) => page.boxes.media)
      .filter((box): box is Box => Boolean(box))
      .map((box) => `${round(box.width)}x${round(box.height)}`)
  )
  const widthPt = first.width
  const heightPt = first.height

  return {
    sourceBox: 'media',
    widthPt: round(widthPt),
    heightPt: round(heightPt),
    widthMm: round(widthPt * MILLIMETERS_PER_POINT),
    heightMm: round(heightPt * MILLIMETERS_PER_POINT),
    widthIn: round(widthPt / 72),
    heightIn: round(heightPt / 72),
    uniformAcrossPages: uniqueSizes.size <= 1
  }
}

function looksLikeCommonBookPage(dimensions: PhysicalDimensions | null): boolean {
  if (!dimensions) return false
  const sides = [dimensions.widthMm, dimensions.heightMm].sort((first, second) => first - second)
  return (
    (Math.abs(sides[0] - 148) <= 12 && Math.abs(sides[1] - 210) <= 15) ||
    (Math.abs(sides[0] - 210) <= 15 && Math.abs(sides[1] - 297) <= 18) ||
    (Math.abs(sides[0] - 200) <= 15 && Math.abs(sides[1] - 200) <= 15)
  )
}

function flattenOrder(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap((item) => flattenOrder(item))
  return []
}

function normalizeIntent(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string')
  return []
}

function dedupeLayers(layers: OcgLayer[]): OcgLayer[] {
  return [...new Map(layers.map((layer) => [normalizeSignalName(layer.name), layer])).values()]
}

function normalizeSignalName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function decodePdfName(value: string): string {
  return value.replace(/#([0-9a-fA-F]{2})/g, (_match, hex: string) =>
    String.fromCharCode(Number.parseInt(hex, 16))
  )
}

function decodePdfHex(value: string): string {
  const compact = value.replace(/\s+/g, '')
  let decoded = ''
  for (let index = 0; index + 1 < compact.length; index += 2) {
    decoded += String.fromCharCode(Number.parseInt(compact.slice(index, index + 2), 16))
  }
  return decoded
}

function decodePdfLiteral(value: string): string {
  return value
    .replace(/\\([\\()])/g, '$1')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\([0-7]{1,3})/g, (_match, octal: string) =>
      String.fromCharCode(Number.parseInt(octal, 8))
    )
}

function firstString(...values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === 'string' && value.length > 0)
}

function finiteOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function normalizeRotation(value: number): number {
  const rotation = Math.round(value) % 360
  return rotation < 0 ? rotation + 360 : rotation
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000
}

function roundNullable(value: number | null): number | null {
  return value === null ? null : round(value)
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${round(bytes / 1024)} KiB`
  if (bytes < 1024 ** 3) return `${round(bytes / 1024 ** 2)} MiB`
  return `${round(bytes / 1024 ** 3)} GiB`
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.name && error.name !== 'Error' ? `${error.name}: ${error.message}` : error.message
  }
  return String(error)
}

function formatDimensions(dimensions: PhysicalDimensions | null): string {
  if (!dimensions) return 'unknown size'
  return `${dimensions.widthMm} × ${dimensions.heightMm} mm`
}

function formatBox(box: Box | null): string {
  return box ? `${box.widthMm} × ${box.heightMm} mm` : 'unknown'
}

function printReadable(report: InspectionReport): void {
  console.log('Production sample inspection (read-only)')
  console.log(`Root: ${report.root}`)
  console.log(
    `Inspected: ${report.inspectedFileCount} | skipped: ${report.skippedFileCount} | parser failures: ${report.failedFileCount}`
  )
  console.log(
    `Classifications: ${Object.entries(report.classifications)
      .map(([label, count]) => `${label}=${count}`)
      .join(' | ')}`
  )
  console.log('')

  for (const file of report.files) {
    const layers = file.ocgLayers.length
      ? file.ocgLayers
          .map(
            (layer) =>
              `${layer.name}=${layer.defaultOn === null ? '?' : layer.defaultOn ? 'on' : 'off'}`
          )
          .join(', ')
      : 'none'
    const spots = file.spotColorants.length
      ? file.spotColorants.map((colorant) => `${colorant.kind}:${colorant.name}`).join(', ')
      : 'none'

    console.log(
      `[${file.classification}] ${file.relativePath} | ${file.sourceKind} | ${file.fileSize} | ${file.pageCount ?? '?'} page(s) | ${formatDimensions(file.physicalDimensions)}`
    )
    console.log(
      `  boxes: media=${formatBox(file.pages[0]?.boxes.media ?? null)}, crop=${formatBox(file.pages[0]?.boxes.crop ?? null)}, trim=${formatBox(file.pages[0]?.boxes.trim ?? null)}, bleed=${formatBox(file.pages[0]?.boxes.bleed ?? null)}, art=${formatBox(file.pages[0]?.boxes.art ?? null)}`
    )
    console.log(
      `  metadata: creator=${file.creator ?? 'unknown'}, producer=${file.producer ?? 'unknown'}, encryption=${file.encryption.status}${file.encryption.filter ? ` (${file.encryption.filter})` : ''}`
    )
    console.log(`  OCG: ${layers}`)
    console.log(`  colorants: ${spots}`)
    if (file.errors.length > 0) console.log(`  errors: ${file.errors.join(' | ')}`)
  }

  if (report.skippedFiles.length > 0) {
    console.log('')
    console.log('Skipped files:')
    for (const file of report.skippedFiles) {
      console.log(`  ${file.relativePath} | ${file.reason}`)
    }
  }
}

async function inspectFolder(root: string, libraries: ParserLibraries): Promise<InspectionReport> {
  const { candidates, skippedFiles } = await collectCandidateFiles(root)
  const files: SampleInspection[] = []

  for (const candidate of candidates) {
    files.push(await inspectCandidate(root, candidate, libraries))
  }

  const classifications: Record<Classification, number> = {
    'likely-print-and-cut': 0,
    'artwork-only': 0,
    'book-interior': 0,
    'already-imposed': 0,
    ambiguous: 0
  }
  for (const file of files) classifications[file.classification] += 1

  return {
    readOnly: true,
    root,
    environmentVariable: SAMPLE_ROOT_ENV,
    inspectedAt: new Date().toISOString(),
    parser: { pdfjs: 'pdfjs-dist', pdfLib: 'pdf-lib' },
    inspectedFileCount: files.length,
    skippedFileCount: skippedFiles.length,
    failedFileCount: files.filter((file) => file.parseStatus === 'failed').length,
    classifications,
    files,
    skippedFiles
  }
}

async function main(): Promise<void> {
  const options = parseCliArgs(process.argv.slice(2))
  if (options.help) {
    printUsage()
    return
  }

  const folder = options.folder ?? process.env[SAMPLE_ROOT_ENV]
  if (!folder) {
    printUsage()
    throw new Error(`Provide a folder path or set ${SAMPLE_ROOT_ENV}.`)
  }

  const root = resolve(folder)
  const rootStats = await stat(root)
  if (!rootStats.isDirectory()) throw new Error(`Not a directory: ${root}`)

  const libraries = await loadParserLibraries()
  const report = await inspectFolder(root, libraries)
  if (options.format === 'json') {
    console.log(JSON.stringify(report, null, 2))
  } else {
    printReadable(report)
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : ''
if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) {
  main().catch((error: unknown) => {
    console.error(`Production sample inspection failed: ${describeError(error)}`)
    process.exitCode = 1
  })
}
