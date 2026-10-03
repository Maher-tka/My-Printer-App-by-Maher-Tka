import { createFineCutHandoff } from '../lib/finecutHandoff'
import { createEditedArtwork, type ArtworkEditResult } from '../lib/applyArtworkEdit'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction
} from 'react'
import { deserializeCutterProjectPayload, type CutterProjectPayload } from '@/projects/projectFiles'
import type { PrinterProjectFile } from '@/types/projects'
import { CUT_CONTOUR_NAME, normalizeSpotName } from '../lib/colorSpot'
import {
  DEFAULT_CUTTER_SHEET,
  clampSheetHeight,
  clampSheetWidth,
  getSheetWarnings,
  normalizeCutterSheetSettings
} from '../lib/cutterLayout'
import { exportCutterProductionBatch } from '../lib/batchExport'
import { getPlacedProductionBounds } from '../lib/cutlineGenerator'
import { exportCutterEps } from '../lib/epsExport'
import {
  applyCutterExportPreset,
  getDefaultCutterExportSettings,
  getExportPresetForMode,
  normalizeCutterExportSettings,
  type CutterExportPresetId
} from '../lib/exportPresets'
import { autoArrangePieces, createCutterId, getPieceCapacityForTargetLength } from '../lib/nesting'
import {
  CUTTER_PIECE_MAX_DIMENSION_CM,
  CUTTER_PIECE_MIN_DIMENSION_CM,
  createPiecePresetFromSource,
  createPlacedPieceFromPreset,
  duplicatePiecePreset,
  refreshPlacedPieceFromPreset
} from '../lib/piecePresets'
import { exportCutterPdf } from '../lib/pdfCutExport'
import { exportCutterSvg } from '../lib/svgExport'
import { synchronizePieceEditorModel } from '../lib/editorObjects'
import { createStickerCutterAssets, type StickerSendOrder } from '../lib/stickerCutterAdapter'
import { runCutterPreflight, type CutterPreflightReport } from '../lib/preflight'
import type { CutterPdfImportSession } from '../lib/pdfImport'
import { ImportOperationGuard } from '../lib/importOperation'
import { getProductionSheetCount, MIN_PRODUCTION_SHEET_HEIGHT_CM } from '../lib/productionSheets'
import {
  bytesToArrayBuffer,
  bytesToDataUrl,
  getArtworkMimeType,
  hasPdfSignature,
  isPdfFile,
  isSupportedArtworkFile,
  isSvgFile,
  trimTransparentPng
} from '../lib/sourcePreview'
import type {
  CutterExportResult,
  CutterExportSettings,
  AlignmentCommand,
  CutterLayerVisibility,
  CutterMode,
  CutterProject,
  CutterSheetSettings,
  EditorObjectType,
  KeyObjectState,
  PiecePreset,
  PieceSourceFile,
  PlacedPiece
} from '../types'

const defaultLayers: CutterLayerVisibility = {
  artwork: true,
  cutlines: true
}
const NESTING_LAYOUT_AUDIT_VERSION = 2

export function migrateLegacyProductionLayout(
  pieces: PiecePreset[],
  placedPieces: PlacedPiece[],
  originalSheet: CutterSheetSettings
): { sheet: CutterSheetSettings; placedPieces: PlacedPiece[]; migrated: boolean } {
  const sheet = normalizeCutterSheetSettings(originalSheet)
  const hasLegacyShortSheet =
    !Number.isFinite(originalSheet.heightCm) ||
    originalSheet.heightCm < MIN_PRODUCTION_SHEET_HEIGHT_CM

  if (!hasLegacyShortSheet || pieces.length === 0 || placedPieces.length === 0) {
    return { sheet, placedPieces, migrated: false }
  }

  const result = autoArrangePieces(pieces, { ...sheet, preserveManualPositions: false }, [])

  return { sheet, placedPieces: result.placedPieces, migrated: true }
}

export function resizeCutterProductionLayout(
  pieces: PiecePreset[],
  _placedPieces: PlacedPiece[],
  currentSheet: CutterSheetSettings,
  heightCm: number
): {
  sheet: CutterSheetSettings
  pieces: PiecePreset[]
  placedPieces: PlacedPiece[]
  placedCount: number
  sheetCount: number
  warning: string | null
} {
  const sheet = normalizeCutterSheetSettings({
    ...currentSheet,
    heightCm: clampSheetHeight(heightCm),
    lengthMode: 'fixed'
  })
  const resizedPieces = pieces.map((piece) =>
    piece.orderMode === 'target-length'
      ? {
          ...piece,
          targetLengthCm: sheet.heightCm,
          quantity: Math.max(1, getPieceCapacityForTargetLength(piece, sheet, sheet.heightCm))
        }
      : piece
  )
  const result = autoArrangePieces(resizedPieces, { ...sheet, preserveManualPositions: false }, [])

  return {
    sheet,
    pieces: resizedPieces,
    placedPieces: result.placedPieces,
    placedCount: result.placedCount,
    sheetCount: result.sheetCount ?? 1,
    warning: result.warning ?? null
  }
}

export function useCutterProject(initialProject?: PrinterProjectFile<CutterProjectPayload>): {
  mode: CutterMode
  sheet: CutterSheetSettings
  sources: PieceSourceFile[]
  pieces: PiecePreset[]
  placedPieces: PlacedPiece[]
  layers: CutterLayerVisibility
  activePiece: PiecePreset | null
  activePieceId: string | null
  selectedPlacedIds: string[]
  selectedEditorObjects: EditorObjectType[]
  keyObject: KeyObjectState
  warnings: string[]
  preflight: CutterPreflightReport
  exportSettings: CutterExportSettings
  canExport: boolean
  fineCutBusy: boolean
  prepareFineCut: (sheetIndex: number) => Promise<void>
  status: string
  error: string | null
  pdfImportSession: CutterPdfImportSession | null
  isPdfImportBusy: boolean
  setMode: (mode: CutterMode) => void
  setLayers: Dispatch<SetStateAction<CutterLayerVisibility>>
  updateSheet: (patch: Partial<CutterSheetSettings>) => void
  resizeSheetHeight: (heightCm: number) => void
  importDesignFiles: (files: File[]) => Promise<void>
  addStickerResults: (orders: StickerSendOrder[], offsetMm: number) => void
  loadMorePdfPages: () => Promise<void>
  importSelectedPdfPages: (pageNumbers: number[]) => Promise<void>
  cancelPdfImport: () => void
  updatePiece: (updatedPiece: PiecePreset) => void
  applyArtworkEdit: (pieceId: string, result: ArtworkEditResult) => void
  updatePieceQuantity: (pieceId: string, quantity: number) => void
  updatePieceTargetLength: (pieceId: string, targetLengthCm: number) => boolean
  renamePiece: (pieceId: string, name: string) => void
  updatePieceRotationAllowed: (pieceId: string, rotationAllowed: boolean) => void
  duplicatePiece: (pieceId: string) => void
  deletePiece: (pieceId: string) => void
  editPiece: (pieceId: string) => void
  addPieceToSheet: (pieceId: string) => void
  addPiecesToSheet: (pieceIds: string[]) => void
  runAutoArrange: () => void
  runAutoArrangeForPieces: (pieceIds: string[]) => void
  undoAutoArrange: () => void
  deleteUnusedPieces: () => void
  createTestMontage: (count?: number) => void
  selectPlacedPiece: (pieceId: string, additive: boolean) => void
  movePlacedPiece: (pieceId: string, xCm: number, yCm: number) => void
  resizePlacedPiece: (pieceId: string, widthCm: number, heightCm: number) => void
  duplicatePlacedPieces: (pieceIds: string[]) => void
  deletePlacedPieces: (pieceIds: string[]) => void
  rotatePlacedPiece: (pieceId: string) => void
  togglePlacedLock: (pieceId: string) => void
  nudgeSelected: (dxCm: number, dyCm: number) => void
  alignSelected: (command: AlignmentCommand) => void
  handleExportSvg: () => Promise<void>
  handleExportPdf: () => Promise<void>
  handleExportEps: () => Promise<void>
  handleBatchExport: () => Promise<void>
  setExportMode: (mode: NonNullable<CutterExportSettings['mode']>) => void
  setExportSettings: (patch: Partial<CutterExportSettings>) => void
  applyExportPreset: (presetId: CutterExportPresetId) => void
  markPieceSaved: () => void
  clearProject: () => void
} {
  const [fineCutBusy, setFineCutBusy] = useState(false)
  const fineCutPending = useRef(false)
  const [initialState] = useState(() => {
    if (!initialProject) return null

    const restored = deserializeCutterProjectPayload(initialProject.payload)
    const normalizedPieces = restored.pieces.map((piece) => synchronizePieceEditorModel(piece))
    const piecesById = new Map(normalizedPieces.map((piece) => [piece.id, piece]))
    const refreshedPlacedPieces = restored.placedPieces.map((placed) => {
      const piece = piecesById.get(placed.presetId)
      return piece ? refreshPlacedPieceFromPreset(placed, piece) : placed
    })
    const migratedLayout = migrateLegacyProductionLayout(
      normalizedPieces,
      refreshedPlacedPieces,
      restored.sheet
    )

    return {
      ...restored,
      sheet: migratedLayout.sheet,
      pieces: normalizedPieces,
      placedPieces: migratedLayout.placedPieces,
      layoutMigrated: migratedLayout.migrated
    }
  })
  const [mode, setMode] = useState<CutterMode>(() => initialState?.mode ?? 'piece-editor')
  const [sheet, setSheet] = useState<CutterSheetSettings>(() =>
    normalizeCutterSheetSettings(initialState?.sheet ?? DEFAULT_CUTTER_SHEET)
  )
  const [sources, setSources] = useState<PieceSourceFile[]>(() => initialState?.sources ?? [])
  const [pieces, setPieces] = useState<PiecePreset[]>(() => initialState?.pieces ?? [])
  const [placedPieces, setPlacedPieces] = useState<PlacedPiece[]>(
    () => initialState?.placedPieces ?? []
  )
  const [layers, setLayers] = useState<CutterLayerVisibility>(
    () => initialState?.layers ?? defaultLayers
  )
  const [exportSettings, setExportSettings] = useState<CutterExportSettings>(() =>
    normalizeCutterExportSettings(
      initialProject?.payload.exportSettings,
      initialProject?.payload.sheet ?? DEFAULT_CUTTER_SHEET
    )
  )
  const [activePieceId, setActivePieceId] = useState<string | null>(
    () => initialState?.activePieceId ?? null
  )
  const [selectedPlacedIds, setSelectedPlacedIds] = useState<string[]>(
    () => initialState?.selectedPlacedIds ?? []
  )
  const [status, setStatus] = useState<string>(() =>
    initialProject
      ? initialState?.layoutMigrated
        ? `Opened ${initialProject.metadata.jobName} and repacked its legacy short sheets to the 1 m production default.`
        : `Opened ${initialProject.metadata.jobName}.`
      : 'Import artwork to prepare the first sticker piece.'
  )
  const [error, setError] = useState<string | null>(null)
  const [pdfImportSession, setPdfImportSession] = useState<CutterPdfImportSession | null>(null)
  const [isPdfImportBusy, setIsPdfImportBusy] = useState(false)
  const sourcesRef = useRef<PieceSourceFile[]>([])
  const sheetRef = useRef(sheet)
  const piecesRef = useRef(pieces)
  const placedPiecesRef = useRef(placedPieces)
  const repackWarningPieceIdsRef = useRef(new Set<string>())
  const pdfImportSessionRef = useRef<CutterPdfImportSession | null>(null)
  const pdfImportOperationsRef = useRef(new ImportOperationGuard())
  const fileImportOperationsRef = useRef(new ImportOperationGuard())
  const resourceCleanupTimerRef = useRef<number | null>(null)
  const pendingPdfFilesRef = useRef<File[]>([])
  const autoArrangeUndoSnapshotRef = useRef<AutoArrangeUndoSnapshot | null>(null)
  const layoutAuditVersionRef = useRef(0)
  const warnings = getSheetWarnings(sheet)
  const activePiece = pieces.find((piece) => piece.id === activePieceId) ?? null
  const { selectedEditorObjects, keyObject } = useMemo(
    () => getLegacyEditorState(activePiece, initialState),
    [activePiece, initialState]
  )

  useEffect(() => {
    sourcesRef.current = sources
  }, [sources])

  useEffect(() => {
    sheetRef.current = sheet
  }, [sheet])

  useEffect(() => {
    piecesRef.current = pieces
  }, [pieces])

  useEffect(() => {
    placedPiecesRef.current = placedPieces
  }, [placedPieces])

  useEffect(() => {
    if (
      layoutAuditVersionRef.current === NESTING_LAYOUT_AUDIT_VERSION ||
      pieces.length === 0 ||
      placedPieces.length === 0
    ) {
      return
    }

    layoutAuditVersionRef.current = NESTING_LAYOUT_AUDIT_VERSION
    if (sheet.preserveManualPositions) return

    const currentSheetCount = getProductionSheetCount(placedPieces)
    const compacted = resizeCutterProductionLayout(pieces, placedPieces, sheet, sheet.heightCm)
    if (compacted.sheetCount >= currentSheetCount) return

    sheetRef.current = compacted.sheet
    piecesRef.current = compacted.pieces
    placedPiecesRef.current = compacted.placedPieces
    setSheet(compacted.sheet)
    setPieces(compacted.pieces)
    setPlacedPieces(compacted.placedPieces)
    setSelectedPlacedIds(compacted.placedPieces[0] ? [compacted.placedPieces[0].id] : [])
    setStatus(
      `Automatically compacted a stale ${currentSheetCount}-sheet layout into ${compacted.sheetCount} properly filled sheet(s).`
    )
    setError(compacted.warning)
  }, [pieces, placedPieces, sheet])

  useEffect(() => {
    pdfImportSessionRef.current = pdfImportSession
  }, [pdfImportSession])

  useEffect(() => {
    if (resourceCleanupTimerRef.current !== null) {
      window.clearTimeout(resourceCleanupTimerRef.current)
      resourceCleanupTimerRef.current = null
    }

    return () => {
      fileImportOperationsRef.current.cancel()
      pdfImportOperationsRef.current.cancel()
      // React Strict Mode replays effects in development. Defer disposal so
      // the replayed setup can cancel it before revoking previews still in use.
      resourceCleanupTimerRef.current = window.setTimeout(() => {
        for (const source of sourcesRef.current) {
          revokePreviewUrl(source.previewUrl)
        }
        releasePdfImportSession(pdfImportSessionRef.current)
        resourceCleanupTimerRef.current = null
      }, 0)
    }
  }, [])

  const project = useMemo<CutterProject>(
    () => ({
      sheet,
      sources,
      pieces,
      placedPieces,
      layers,
      exportSettings,
      productionInfo: {
        jobName:
          initialProject?.metadata.jobName ??
          pieces[0]?.displayName ??
          sources[0]?.displayName ??
          'Untitled Cutter Job',
        appName: 'My Printer App by Maher Tka'
      }
    }),
    [exportSettings, initialProject?.metadata.jobName, layers, pieces, placedPieces, sheet, sources]
  )
  const preflight = useMemo(() => runCutterPreflight(project), [project])
  const canExport = placedPieces.length > 0 && preflight.canExport

  const applySheetHeightAndRepack = useCallback(
    (heightCm: number, baseSheet: CutterSheetSettings = sheetRef.current): void => {
      const targetLengthPieces = piecesRef.current.filter(
        (piece) => piece.orderMode === 'target-length'
      )
      const resized = resizeCutterProductionLayout(
        piecesRef.current,
        placedPiecesRef.current,
        baseSheet,
        heightCm
      )

      sheetRef.current = resized.sheet
      piecesRef.current = resized.pieces
      placedPiecesRef.current = resized.placedPieces
      setSheet(resized.sheet)
      setPieces(resized.pieces)
      setPlacedPieces(resized.placedPieces)
      setSelectedPlacedIds(resized.placedPieces[0] ? [resized.placedPieces[0].id] : [])
      setMode('montage-sheet')
      setStatus(
        targetLengthPieces.length > 0
          ? `Resized the sheet to ${resized.sheet.heightCm} cm, recalculated ${targetLengthPieces.length} material-length order(s), and arranged ${resized.placedCount} copies across ${resized.sheetCount} sheet(s).`
          : `Resized the sheet to ${resized.sheet.heightCm} cm and reflowed ${resized.placedCount} copies across ${resized.sheetCount} sheet(s).`
      )
      setError(resized.warning)
    },
    []
  )

  const updateSheet = useCallback(
    (patch: Partial<CutterSheetSettings>): void => {
      const current = sheetRef.current
      const normalized = normalizeCutterSheetSettings({
        ...current,
        ...patch,
        registrationMarks: patch.registrationMarks
          ? { ...current.registrationMarks!, ...patch.registrationMarks }
          : current.registrationMarks,
        productionLabel: patch.productionLabel
          ? { ...current.productionLabel!, ...patch.productionLabel }
          : current.productionLabel
      })
      const updatedSheet = {
        ...normalized,
        widthCm: patch.widthCm !== undefined ? clampSheetWidth(patch.widthCm) : current.widthCm,
        heightCm: patch.heightCm !== undefined ? clampSheetHeight(patch.heightCm) : current.heightCm
      }

      if (patch.heightCm !== undefined && piecesRef.current.length > 0) {
        applySheetHeightAndRepack(updatedSheet.heightCm, updatedSheet)
        return
      }

      sheetRef.current = updatedSheet
      setSheet(updatedSheet)
    },
    [applySheetHeightAndRepack]
  )

  const resizeSheetHeight = useCallback(
    (heightCm: number): void => {
      applySheetHeightAndRepack(heightCm, {
        ...sheetRef.current,
        lengthMode: 'fixed'
      })
    },
    [applySheetHeightAndRepack]
  )

  const openPdfImportSession = useCallback(async (file: File): Promise<void> => {
    const operations = pdfImportOperationsRef.current
    const operation = operations.begin()
    setError(null)
    setIsPdfImportBusy(true)

    try {
      const { loadCutterPdfImportSession } = await import('../lib/pdfImport')
      const session = await loadCutterPdfImportSession(file, operation.signal)
      if (!operations.isCurrent(operation)) {
        releasePdfImportSession(session)
        return
      }

      releasePdfImportSession(pdfImportSessionRef.current)
      pdfImportSessionRef.current = session
      setPdfImportSession(session)
      setStatus(
        `Choose PDF pages from ${file.name}. ${session.pageCount} page(s), first ${session.loadedPageCount} thumbnail(s) ready.`
      )
    } catch (importError) {
      if (operations.isCurrent(operation)) setError(getErrorMessage(importError))
    } finally {
      if (operations.finish(operation)) setIsPdfImportBusy(false)
    }
  }, [])

  const importArtworkFiles = useCallback(
    async (files: File[], operation: AbortController): Promise<number> => {
      const importedSources: PieceSourceFile[] = []
      const importedPieces: PiecePreset[] = []

      const previewUrls = new Set<string>()
      try {
        for (const file of files) {
          operation.signal.throwIfAborted()
          const bytes = new Uint8Array(await file.arrayBuffer())
          const mimeType = getArtworkMimeType(file)
          let previewUrl = URL.createObjectURL(
            new Blob([bytesToArrayBuffer(bytes)], { type: mimeType })
          )
          previewUrls.add(previewUrl)
          let artworkBytes = bytes
          let dimensions = await loadArtworkDimensions(previewUrl)

          if (mimeType === 'image/png') {
            const trimmed = await trimTransparentPng(bytes)
            if (trimmed) {
              URL.revokeObjectURL(previewUrl)
              artworkBytes = new Uint8Array(trimmed.bytes)
              previewUrl = URL.createObjectURL(
                new Blob([bytesToArrayBuffer(artworkBytes)], { type: mimeType })
              )
              previewUrls.add(previewUrl)
              dimensions = { width: trimmed.widthPx, height: trimmed.heightPx }
            }
          }

          const source: PieceSourceFile = {
            id: createCutterId('source'),
            sourceKind: isSvgFile(file) ? 'svg' : 'image',
            fileName: file.name,
            displayName: file.name.replace(/\.[^.]+$/, ''),
            originalFileName: file.name,
            mimeType,
            bytes: artworkBytes,
            previewUrl,
            previewDataUrl: isSvgFile(file) ? bytesToDataUrl(bytes, mimeType) : undefined,
            naturalWidthPx: dimensions.width,
            naturalHeightPx: dimensions.height
          }

          importedSources.push(source)
          importedPieces.push(createPiecePresetFromSource(source, [...pieces, ...importedPieces]))
        }

        operation.signal.throwIfAborted()
        setSources((current) => [...current, ...importedSources])
        setPieces((current) => [...current, ...importedPieces])
        setActivePieceId(importedPieces[0]?.id ?? activePieceId)

        return importedPieces.length
      } catch (error) {
        for (const url of previewUrls) revokePreviewUrl(url)
        throw error
      }
    },
    [activePieceId, pieces]
  )

  const importDesignFiles = useCallback(
    async (files: File[]): Promise<void> => {
      const operations = fileImportOperationsRef.current
      const operation = operations.begin()
      pdfImportOperationsRef.current.cancel()
      setIsPdfImportBusy(false)
      setError(null)
      try {
        const supportedArtworkFiles: File[] = []
        const pdfFiles: File[] = []

        for (const file of files) {
          const signatureBytes = new Uint8Array(await file.slice(0, 1024).arrayBuffer())
          if (!operations.isCurrent(operation)) return

          if (isPdfFile(file) || hasPdfSignature(signatureBytes)) {
            pdfFiles.push(file)
          } else if (isSupportedArtworkFile(file)) {
            supportedArtworkFiles.push(file)
          }
        }

        const supportedCount = supportedArtworkFiles.length + pdfFiles.length

        if (supportedCount !== files.length) {
          setError(
            'Import PNG, JPG, SVG, PDF, or PDF-compatible Illustrator (.ai) files for Cutter Montage.'
          )
          return
        }

        const importedArtworkCount =
          supportedArtworkFiles.length > 0
            ? await importArtworkFiles(supportedArtworkFiles, operation)
            : 0

        if (!operations.isCurrent(operation)) return
        if (pdfFiles.length > 0) {
          pendingPdfFilesRef.current = pdfFiles.slice(1)
          await openPdfImportSession(pdfFiles[0])
        } else if (importedArtworkCount > 0) {
          setMode('piece-editor')
          setStatus(
            `Imported ${importedArtworkCount} artwork piece preset(s) from ${supportedArtworkFiles.length} file(s).`
          )
        }
      } catch (importError) {
        if (operations.isCurrent(operation)) setError(getErrorMessage(importError))
      } finally {
        operations.finish(operation)
      }
    },
    [importArtworkFiles, openPdfImportSession]
  )

  const addStickerResults = useCallback((orders: StickerSendOrder[], offsetMm: number): void => {
    if (!orders.length) return
    const created = orders.map(({ result, quantity }) => {
      const assets = createStickerCutterAssets(result, offsetMm, piecesRef.current, quantity)
      piecesRef.current = [...piecesRef.current, assets.piece]
      return assets
    })
    sourcesRef.current = [...sourcesRef.current, ...created.map((item) => item.source)]
    setSources(sourcesRef.current)
    setPieces(piecesRef.current)
    setActivePieceId(created[0].piece.id)
    const arranged = autoArrangePieces(piecesRef.current, sheetRef.current, placedPiecesRef.current)
    placedPiecesRef.current = arranged.placedPieces
    setPlacedPieces(arranged.placedPieces)
    setError(arranged.warning ?? null)
    setStatus(
      `Sent ${created.length} sticker design(s) to Cutter Montage with separate Artwork and CutContour objects. ${arranged.placedCount} copies placed.`
    )
    setMode('montage-sheet')
  }, [])

  const loadMorePdfPages = useCallback(async (): Promise<void> => {
    const currentSession = pdfImportSessionRef.current
    if (!currentSession) return
    const operations = pdfImportOperationsRef.current
    const operation = operations.begin()
    setError(null)
    setIsPdfImportBusy(true)

    try {
      const { loadMoreCutterPdfPagePreviews } = await import('../lib/pdfImport')
      const nextSession = await loadMoreCutterPdfPagePreviews(currentSession, operation.signal)
      if (!operations.isCurrent(operation)) {
        releaseNewPdfPreviews(nextSession, currentSession)
        return
      }
      pdfImportSessionRef.current = nextSession
      setPdfImportSession(nextSession)
      setStatus(
        `Loaded ${nextSession.loadedPageCount} of ${nextSession.pageCount} PDF page thumbnail(s).`
      )
    } catch (importError) {
      if (operations.isCurrent(operation)) setError(getErrorMessage(importError))
    } finally {
      if (operations.finish(operation)) setIsPdfImportBusy(false)
    }
  }, [])

  const cancelPdfImport = useCallback((): void => {
    fileImportOperationsRef.current.cancel()
    pdfImportOperationsRef.current.cancel()
    releasePdfImportSession(pdfImportSessionRef.current)
    pdfImportSessionRef.current = null
    pendingPdfFilesRef.current = []
    setPdfImportSession(null)
    setIsPdfImportBusy(false)
    setStatus('PDF import canceled.')
  }, [])

  const importSelectedPdfPages = useCallback(
    async (pageNumbers: number[]): Promise<void> => {
      const currentSession = pdfImportSessionRef.current
      if (!currentSession) return
      const operations = pdfImportOperationsRef.current
      const operation = operations.begin()
      setError(null)
      setIsPdfImportBusy(true)

      try {
        const { createCutterPdfPageSources } = await import('../lib/pdfImport')
        const { session, sources: pdfSources } = await createCutterPdfPageSources(
          currentSession,
          pageNumbers,
          operation.signal
        )
        if (!operations.isCurrent(operation)) {
          releaseNewPdfPreviews(session, currentSession)
          return
        }
        const importedPieces: PiecePreset[] = []

        for (const source of pdfSources) {
          const piece = createPiecePresetFromSource(source, [
            ...piecesRef.current,
            ...importedPieces
          ])
          importedPieces.push({
            ...piece,
            pdfProductionMetadata: source.pdfProductionMetadata,
            pdfPageMetadata: source.pdfPageMetadata
          })
        }

        setSources((current) => [...current, ...pdfSources])
        setPieces((current) => [...current, ...importedPieces])
        setActivePieceId(importedPieces[0]?.id ?? activePieceId)
        setMode('piece-editor')
        setStatus(`Imported ${importedPieces.length} PDF page piece(s) from ${session.fileName}.`)
        releasePdfImportSession(session)
        pdfImportSessionRef.current = null
        setPdfImportSession(null)

        const nextPdfFile = pendingPdfFilesRef.current.shift()
        if (nextPdfFile) await openPdfImportSession(nextPdfFile)
      } catch (importError) {
        if (operations.isCurrent(operation)) setError(getErrorMessage(importError))
      } finally {
        if (operations.finish(operation)) setIsPdfImportBusy(false)
      }
    },
    [activePieceId, openPdfImportSession]
  )

  const updatePiece = useCallback(
    (updatedPiece: PiecePreset): void => {
      const result = reconcilePieceUpdate(
        piecesRef.current,
        placedPiecesRef.current,
        updatedPiece,
        sheet
      )

      // Advance the snapshots before scheduling React updates so a second editor
      // commit in the same event turn is based on the first commit, not on the
      // render that originally created this callback.
      piecesRef.current = result.pieces
      placedPiecesRef.current = result.placedPieces
      setPieces(result.pieces)
      setPlacedPieces(result.placedPieces)

      const retainedIds = new Set(result.placedPieces.map((placed) => placed.id))
      setSelectedPlacedIds((current) => current.filter((id) => retainedIds.has(id)))

      if (result.sizeChanged && result.arrangedCopyCount > 0) {
        if (result.lockedRetainedCopyCount > 0) {
          repackWarningPieceIdsRef.current.add(result.piece.id)
          setStatus(
            `Resized and auto-arranged ${result.arrangedCopyCount} ${result.arrangedCopyCount === 1 ? 'copy' : 'copies'}. Kept ${result.lockedRetainedCopyCount} locked ${result.lockedRetainedCopyCount === 1 ? 'copy' : 'copies'} in place; unlock and arrange again if needed.`
          )
        } else {
          repackWarningPieceIdsRef.current.delete(result.piece.id)
          setStatus(
            `Resized and auto-arranged all ${result.arrangedCopyCount} ${result.arrangedCopyCount === 1 ? 'copy' : 'copies'}.`
          )
        }
      } else if (result.quantityChanged) {
        setStatus(
          `Updated quantity to ${result.piece.quantity}. Preserved ${result.retainedCopyCount} arranged ${result.retainedCopyCount === 1 ? 'copy' : 'copies'}${result.addedCopyCount > 0 ? ` and placed ${result.addedCopyCount} new ${result.addedCopyCount === 1 ? 'copy' : 'copies'}` : ''}.`
        )
      }

      if (result.sizeChanged || result.quantityChanged) {
        setError(result.warning)
      }
    },
    [sheet]
  )

  const applyArtworkEdit = useCallback(
    (pieceId: string, result: ArtworkEditResult) => {
      const piece = piecesRef.current.find((item) => item.id === pieceId)
      if (!piece) return
      const edited = createEditedArtwork(piece, result, crypto.randomUUID())
      sourcesRef.current = [...sourcesRef.current, edited.source]
      setSources(sourcesRef.current)
      updatePiece(edited.piece)
      setStatus(`Updated background for ${piece.displayName}.`)
    },
    [updatePiece]
  )

  const updatePieceQuantity = useCallback(
    (pieceId: string, quantity: number): void => {
      const nextPieces = piecesRef.current.map((piece) =>
        piece.id === pieceId
          ? {
              ...piece,
              quantity: Math.max(1, Math.round(quantity)),
              orderMode: 'copies' as const
            }
          : piece
      )
      const hasTargetLengthOrder = nextPieces.some((piece) => piece.orderMode === 'target-length')
      const arrangementSheet = normalizeCutterSheetSettings({
        ...sheet,
        lengthMode: hasTargetLengthOrder ? 'fixed' : 'auto-trim-last'
      })
      const result = autoArrangePieces(nextPieces, arrangementSheet, [])
      piecesRef.current = nextPieces
      placedPiecesRef.current = result.placedPieces
      setSheet(arrangementSheet)
      setPieces(nextPieces)
      setPlacedPieces(result.placedPieces)
      setSelectedPlacedIds(result.placedPieces[0] ? [result.placedPieces[0].id] : [])
      setMode('montage-sheet')
      setStatus(
        `Placed ${result.placedCount} requested copy/copies across ${result.sheetCount ?? 1} production sheet(s).`
      )
      setError(result.warning ?? null)
    },
    [sheet]
  )

  const updatePieceTargetLength = useCallback(
    (pieceId: string, targetLengthCm: number): boolean => {
      const piece = piecesRef.current.find((candidate) => candidate.id === pieceId)
      if (!piece) return false

      const normalizedTargetLengthCm = clampSheetHeight(targetLengthCm)
      const arrangementSheet = normalizeCutterSheetSettings({
        ...sheet,
        heightCm: normalizedTargetLengthCm,
        lengthMode: 'fixed'
      })
      const quantity = getPieceCapacityForTargetLength(
        piece,
        arrangementSheet,
        normalizedTargetLengthCm
      )

      if (quantity < 1) {
        setError(`${piece.displayName} is too large for this target sheet length.`)
        return false
      }

      const nextPieces = piecesRef.current.map((candidate) =>
        candidate.id === pieceId
          ? {
              ...candidate,
              quantity,
              orderMode: 'target-length' as const,
              targetLengthCm: normalizedTargetLengthCm
            }
          : candidate
      )
      const result = autoArrangePieces(nextPieces, arrangementSheet, [])

      piecesRef.current = nextPieces
      placedPiecesRef.current = result.placedPieces
      setSheet(arrangementSheet)
      setPieces(nextPieces)
      setPlacedPieces(result.placedPieces)
      setSelectedPlacedIds(result.placedPieces[0] ? [result.placedPieces[0].id] : [])
      setMode('montage-sheet')
      setStatus(
        `Filled a ${Number((normalizedTargetLengthCm / 100).toFixed(2))} m target sheet with ${quantity} ${piece.displayName} copies.`
      )
      setError(result.warning ?? null)
      return true
    },
    [sheet]
  )

  const renamePiece = useCallback((pieceId: string, name: string): void => {
    const displayName = name.trim()
    if (!displayName) return
    setPieces((current) =>
      current.map((piece) => (piece.id === pieceId ? { ...piece, displayName } : piece))
    )
    setPlacedPieces((current) =>
      current.map((piece) => (piece.presetId === pieceId ? { ...piece, displayName } : piece))
    )
  }, [])

  const updatePieceRotationAllowed = useCallback(
    (pieceId: string, rotationAllowed: boolean): void => {
      setPieces((current) =>
        current.map((piece) => (piece.id === pieceId ? { ...piece, rotationAllowed } : piece))
      )
    },
    []
  )

  const duplicatePiece = useCallback((pieceId: string): void => {
    setPieces((current) => {
      const piece = current.find((candidate) => candidate.id === pieceId)

      if (!piece) {
        return current
      }

      const duplicate = duplicatePiecePreset(piece, current)
      setActivePieceId(duplicate.id)
      setMode('piece-editor')
      setStatus(`Duplicated ${piece.displayName}.`)
      return [...current, duplicate]
    })
  }, [])

  const deletePiece = useCallback(
    (pieceId: string): void => {
      setPieces((current) => {
        const nextPieces = current.filter((piece) => piece.id !== pieceId)
        const removed = current.find((piece) => piece.id === pieceId)

        if (removed && !nextPieces.some((piece) => piece.sourceId === removed.sourceId)) {
          setSources((currentSources) =>
            currentSources.filter((source) => {
              if (source.id === removed.sourceId) {
                revokePreviewUrl(source.previewUrl)
                return false
              }

              return true
            })
          )
        }

        return nextPieces
      })
      setPlacedPieces((current) => current.filter((placed) => placed.presetId !== pieceId))
      setSelectedPlacedIds((current) =>
        current.filter((id) => {
          const placed = placedPieces.find((candidate) => candidate.id === id)
          return placed?.presetId !== pieceId
        })
      )
      setActivePieceId((current) => (current === pieceId ? null : current))
      setStatus('Piece preset deleted.')
    },
    [placedPieces]
  )

  const editPiece = useCallback(
    (pieceId: string): void => {
      const piece = pieces.find((candidate) => candidate.id === pieceId)

      if (!piece) {
        setError('That artwork is no longer available. Import it again and retry.')
        return
      }

      setError(null)
      setActivePieceId(piece.id)
      setMode('piece-editor')
      setStatus(`Editing ${piece.displayName}.`)
    },
    [pieces]
  )

  const addPieceToSheet = useCallback(
    (pieceId: string): void => {
      const piece = pieces.find((candidate) => candidate.id === pieceId)

      if (!piece) {
        return
      }

      const copies: PlacedPiece[] = []
      const baseOffset = placedPieces.length * 0.35

      for (let index = 0; index < piece.quantity; index += 1) {
        copies.push(
          createPlacedPieceFromPreset(
            piece,
            Math.min(
              sheet.safeMarginCm + baseOffset + index * 0.25,
              Math.max(sheet.widthCm - piece.widthCm, 0)
            ),
            Math.min(
              sheet.safeMarginCm + baseOffset + index * 0.25,
              Math.max(sheet.heightCm - piece.heightCm, 0)
            )
          )
        )
      }

      setPlacedPieces((current) => [...current, ...copies])
      setSelectedPlacedIds(copies[0] ? [copies[0].id] : [])
      setMode('montage-sheet')
      setStatus(`Added ${copies.length} copy/copies of ${piece.displayName} to the sheet.`)
    },
    [pieces, placedPieces.length, sheet.heightCm, sheet.safeMarginCm, sheet.widthCm]
  )

  const addPiecesToSheet = useCallback(
    (pieceIds: string[]): void => {
      const selectedPieces = pieces.filter((piece) => pieceIds.includes(piece.id))

      if (selectedPieces.length === 0) {
        return
      }

      const copies: PlacedPiece[] = []
      let copyOffset = placedPieces.length * 0.35

      for (const piece of selectedPieces) {
        for (let index = 0; index < piece.quantity; index += 1) {
          copies.push(
            createPlacedPieceFromPreset(
              piece,
              Math.min(sheet.safeMarginCm + copyOffset, Math.max(sheet.widthCm - piece.widthCm, 0)),
              Math.min(
                sheet.safeMarginCm + copyOffset,
                Math.max(sheet.heightCm - piece.heightCm, 0)
              )
            )
          )
          copyOffset += 0.25
        }
      }

      setPlacedPieces((current) => [...current, ...copies])
      setSelectedPlacedIds(copies[0] ? [copies[0].id] : [])
      setMode('montage-sheet')
      setStatus(`Added ${copies.length} selected library piece(s) to the sheet.`)
    },
    [pieces, placedPieces.length, sheet.heightCm, sheet.safeMarginCm, sheet.widthCm]
  )

  const arrangePieces = useCallback(
    (targetPieces: PiecePreset[]): void => {
      if (targetPieces.length === 0) {
        setError('Choose at least one piece before auto arrange.')
        return
      }

      autoArrangeUndoSnapshotRef.current = createAutoArrangeUndoSnapshot(
        placedPieces,
        repackWarningPieceIdsRef.current,
        piecesRef.current,
        sheet
      )
      const targetPieceIds = targetPieces.map((piece) => piece.id)
      const targetPieceIdSet = new Set(targetPieceIds)
      const arrangementSheet = normalizeCutterSheetSettings(sheet)
      const existingCountByPreset = countPlacedPiecesByPreset(placedPieces)
      const arrangementPresets = piecesRef.current.map((piece) =>
        targetPieceIdSet.has(piece.id)
          ? (targetPieces.find((target) => target.id === piece.id) ?? piece)
          : { ...piece, quantity: existingCountByPreset.get(piece.id) ?? 0 }
      )
      const existingForArrangement = preparePlacedPiecesForExplicitArrange(
        placedPieces,
        targetPieceIdSet,
        arrangementSheet.preserveManualPositions
      )
      const result = autoArrangePieces(arrangementPresets, arrangementSheet, existingForArrangement)
      const arrangedPlacedPieces = restoreUnselectedPlacementLocks(
        result.placedPieces,
        placedPieces,
        targetPieceIdSet
      )
      const lockedWarningPieceIds = arrangementSheet.preserveManualPositions
        ? getLockedRepackWarningPieceIds(
            repackWarningPieceIdsRef.current,
            targetPieceIds,
            placedPieces
          )
        : new Set<string>()
      const lockedWarningMessage =
        lockedWarningPieceIds.size > 0
          ? `${lockedWarningPieceIds.size} resized ${lockedWarningPieceIds.size === 1 ? 'piece still has' : 'pieces still have'} locked copies that were kept in place. Unlock those copies and use Arrange Copies again.`
          : null

      placedPiecesRef.current = arrangedPlacedPieces
      setSheet(arrangementSheet)
      setPlacedPieces(arrangedPlacedPieces)
      setSelectedPlacedIds(arrangedPlacedPieces[0] ? [arrangedPlacedPieces[0].id] : [])
      setMode('montage-sheet')
      setStatus(
        [result.warning, lockedWarningMessage].filter(Boolean).join(' ') ||
          `Auto arranged ${result.placedCount} of ${result.requestedCount} piece(s) across ${result.sheetCount ?? 1} production sheet(s). Used ${result.usedAreaPercent?.toFixed(1) ?? '0'}%; estimated waste ${result.wasteAreaPercent?.toFixed(1) ?? '100'}%.`
      )
      setError(result.warning ?? null)
      repackWarningPieceIdsRef.current = clearArrangedRepackWarnings(
        repackWarningPieceIdsRef.current,
        targetPieceIds,
        lockedWarningPieceIds
      )
    },
    [placedPieces, sheet]
  )

  const runAutoArrange = useCallback((): void => {
    if (pieces.length === 0) {
      setError('Import and prepare at least one piece before auto arrange.')
      return
    }

    arrangePieces(pieces)
  }, [arrangePieces, pieces])

  const runAutoArrangeForPieces = useCallback(
    (pieceIds: string[]): void => {
      const selectedPieces = pieces.filter((piece) => pieceIds.includes(piece.id))

      arrangePieces(selectedPieces)
    },
    [arrangePieces, pieces]
  )

  const undoAutoArrange = useCallback((): void => {
    const snapshot = autoArrangeUndoSnapshotRef.current
    if (!snapshot) return
    if (!canRestoreAutoArrangeSnapshot(snapshot, piecesRef.current, sheetRef.current)) {
      autoArrangeUndoSnapshotRef.current = null
      setStatus(
        'The pieces or sheet changed since Auto Arrange. Arrange again to create a new undo point.'
      )
      return
    }

    setSelectedPlacedIds((current) =>
      current.filter((id) => snapshot.placedPieces.some((piece) => piece.id === id))
    )
    placedPiecesRef.current = snapshot.placedPieces
    setPlacedPieces(snapshot.placedPieces)
    repackWarningPieceIdsRef.current = new Set(snapshot.repackWarningPieceIds)
    autoArrangeUndoSnapshotRef.current = null
    setStatus(
      snapshot.repackWarningPieceIds.size > 0
        ? `Restored the layout from before Auto Arrange. ${snapshot.repackWarningPieceIds.size} piece ${snapshot.repackWarningPieceIds.size === 1 ? 'still needs' : 'pieces still need'} Arrange Copies to repack spacing.`
        : 'Restored the layout from before Auto Arrange.'
    )
  }, [])

  const deleteUnusedPieces = useCallback((): void => {
    const usedPieceIds = new Set(placedPieces.map((piece) => piece.presetId))

    setPieces((current) => {
      const nextPieces = current.filter((piece) => usedPieceIds.has(piece.id))
      const removedCount = current.length - nextPieces.length
      const retainedSourceIds = new Set(nextPieces.map((piece) => piece.sourceId))

      if (removedCount === 0) {
        setStatus('No unused library pieces to delete.')
        return current
      }

      setSources((currentSources) =>
        currentSources.filter((source) => {
          if (!retainedSourceIds.has(source.id)) {
            revokePreviewUrl(source.previewUrl)
            return false
          }

          return true
        })
      )
      setActivePieceId((currentActive) =>
        currentActive && nextPieces.some((piece) => piece.id === currentActive)
          ? currentActive
          : (nextPieces[0]?.id ?? null)
      )
      setStatus(`Deleted ${removedCount} unused library piece(s).`)

      return nextPieces
    })
  }, [placedPieces])

  const createTestMontage = useCallback((count = 100): void => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><circle cx="200" cy="200" r="180" fill="#2563eb"/><text x="200" y="220" text-anchor="middle" font-size="64" fill="white">TEST</text></svg>'
    const bytes = new TextEncoder().encode(svg)
    const previewUrl = URL.createObjectURL(new Blob([bytes], { type: 'image/svg+xml' }))
    const source: PieceSourceFile = {
      id: createCutterId('source'),
      sourceKind: 'svg',
      fileName: 'test-sticker.svg',
      displayName: 'Test Sticker',
      originalFileName: 'test-sticker.svg',
      mimeType: 'image/svg+xml',
      bytes,
      previewUrl,
      previewDataUrl: bytesToDataUrl(bytes, 'image/svg+xml'),
      naturalWidthPx: 400,
      naturalHeightPx: 400
    }
    const piece = createPiecePresetFromSource(source, [])
    piece.quantity = Math.max(1, count)
    piece.displayName = count === 20 ? 'Ellipse Test Sticker' : 'Stress Test Sticker'
    setSources((current) => [...current, source])
    setPieces([piece])
    piecesRef.current = [piece]
    setActivePieceId(piece.id)
    const result = autoArrangePieces([piece], DEFAULT_CUTTER_SHEET, [])
    setPlacedPieces(result.placedPieces)
    placedPiecesRef.current = result.placedPieces
    setMode('montage-sheet')
    setStatus(
      `Created a development test montage with ${result.placedCount} copies across ${result.sheetCount ?? 1} sheet(s).`
    )
  }, [])

  const selectPlacedPiece = useCallback((pieceId: string, additive: boolean): void => {
    setSelectedPlacedIds((current) => {
      if (!additive) {
        return [pieceId]
      }

      return current.includes(pieceId)
        ? current.filter((id) => id !== pieceId)
        : [...current, pieceId]
    })
  }, [])

  const movePlacedPiece = useCallback((pieceId: string, xCm: number, yCm: number): void => {
    setPlacedPieces((current) =>
      current.map((placed) =>
        placed.id === pieceId
          ? refreshPlacedPieceProductionBounds({ ...placed, xCm, yCm }, piecesRef.current)
          : placed
      )
    )
  }, [])

  const resizePlacedPiece = useCallback(
    (pieceId: string, widthCm: number, heightCm: number): void => {
      setPlacedPieces((current) =>
        current.map((placed) => {
          if (placed.id !== pieceId || placed.locked) {
            return placed
          }

          return resizePlacedPieceDimensions(placed, widthCm, heightCm, piecesRef.current)
        })
      )
    },
    []
  )

  const duplicatePlacedPieces = useCallback(
    (pieceIds: string[]): void => {
      setPlacedPieces((current) => {
        const selected = current.filter((placed) => pieceIds.includes(placed.id))
        const duplicates = selected.map((placed) =>
          refreshPlacedPieceProductionBounds(
            {
              ...placed,
              id: createCutterId('placed'),
              xCm: Math.min(placed.xCm + 1, Math.max(sheet.widthCm - placed.widthCm, 0)),
              yCm: Math.min(placed.yCm + 1, Math.max(sheet.heightCm - placed.heightCm, 0))
            },
            piecesRef.current
          )
        )

        setSelectedPlacedIds(duplicates.map((placed) => placed.id))
        setStatus(`Duplicated ${duplicates.length} placed piece(s).`)
        return [...current, ...duplicates]
      })
    },
    [sheet.heightCm, sheet.widthCm]
  )

  const deletePlacedPieces = useCallback((pieceIds: string[]): void => {
    setPlacedPieces((current) => current.filter((placed) => !pieceIds.includes(placed.id)))
    setSelectedPlacedIds([])
    setStatus(`Deleted ${pieceIds.length} placed piece(s) from the sheet.`)
  }, [])

  const rotatePlacedPiece = useCallback((pieceId: string): void => {
    setPlacedPieces((current) =>
      current.map((placed) => {
        if (placed.id !== pieceId || placed.locked) {
          return placed
        }

        const nextRotation = ((placed.rotation + 90) % 360) as PlacedPiece['rotation']

        return refreshPlacedPieceProductionBounds(
          {
            ...placed,
            rotation: nextRotation,
            widthCm: placed.heightCm,
            heightCm: placed.widthCm
          },
          piecesRef.current
        )
      })
    )
  }, [])

  const togglePlacedLock = useCallback((pieceId: string): void => {
    setPlacedPieces((current) =>
      current.map((placed) =>
        placed.id === pieceId ? { ...placed, locked: !placed.locked } : placed
      )
    )
  }, [])

  const nudgeSelected = useCallback(
    (dxCm: number, dyCm: number): void => {
      setPlacedPieces((current) =>
        current.map((placed) => {
          if (!selectedPlacedIds.includes(placed.id) || placed.locked) {
            return placed
          }

          return refreshPlacedPieceProductionBounds(
            {
              ...placed,
              xCm: clamp(placed.xCm + dxCm, 0, Math.max(sheet.widthCm - placed.widthCm, 0)),
              yCm: clamp(placed.yCm + dyCm, 0, Math.max(sheet.heightCm - placed.heightCm, 0))
            },
            piecesRef.current
          )
        })
      )
    },
    [selectedPlacedIds, sheet.heightCm, sheet.widthCm]
  )

  const alignSelected = useCallback(
    (command: AlignmentCommand): void => {
      if (selectedPlacedIds.length < 2) return
      setPlacedPieces((current) => {
        const aligned = alignPlacedPieces(current, selectedPlacedIds, command)

        return aligned.map((placed, index) =>
          placed === current[index]
            ? placed
            : refreshPlacedPieceProductionBounds(placed, piecesRef.current)
        )
      })
      setStatus(
        `Aligned ${selectedPlacedIds.length} placed pieces; the first selected piece stayed fixed.`
      )
    },
    [selectedPlacedIds]
  )

  const saveExport = useCallback(async (result: CutterExportResult): Promise<void> => {
    const extension = result.fileName.split('.').pop() ?? 'svg'

    if (window.printerApp?.saveFile) {
      const saveResult = await window.printerApp.saveFile({
        suggestedName: result.fileName,
        bytes: new Uint8Array(await result.blob.arrayBuffer()),
        filters: [{ name: extension.toUpperCase(), extensions: [extension] }]
      })

      if (saveResult.canceled) {
        setStatus('Export canceled.')
        return
      }

      if (!saveResult.ok) {
        throw new Error(saveResult.error ?? 'Could not save cutter export.')
      }

      setStatus(`Saved ${result.fileName}`)
      return
    }

    downloadBlob(result.blob, result.fileName)
    setStatus(`Downloaded ${result.fileName}`)
  }, [])

  const prepareFineCut = useCallback(
    async (sheetIndex: number): Promise<void> => {
      if (fineCutPending.current) return
      try {
        setError(null)
        if (!window.printerApp?.runtime?.prepareFineCutJob)
          throw new Error(
            'Open the desktop app on the work PC to prepare the Illustrator/FineCut job.'
          )
        if (!confirmPreflight(preflight)) return
        fineCutPending.current = true
        setFineCutBusy(true)
        setStatus('Preparing native Illustrator layers and print PDF...')
        const request = await createFineCutHandoff(project, sheetIndex)
        const result = await window.printerApp.runtime.prepareFineCutJob(request)
        if (!result.ok) throw new Error(result.error ?? 'Illustrator handoff failed.')
        setStatus(
          `Prepared in Illustrator. Use FineCut Plot / Detect Mark on the work PC. No cut sent. Files: ${result.folderPath}`
        )
      } catch (error) {
        setError(getErrorMessage(error))
      } finally {
        fineCutPending.current = false
        setFineCutBusy(false)
      }
    },
    [project, preflight]
  )

  const handleExportSvg = useCallback(async (): Promise<void> => {
    try {
      setError(null)
      if (!confirmPreflight(preflight)) return
      setStatus('Creating SVG export...')
      await saveExport(await exportCutterSvg(project))
    } catch (exportError) {
      setError(getErrorMessage(exportError))
    }
  }, [preflight, project, saveExport])

  const handleExportPdf = useCallback(async (): Promise<void> => {
    try {
      setError(null)
      if (!confirmPreflight(preflight)) return
      setStatus('Creating PDF export...')
      await saveExport(await exportCutterPdf(project))
    } catch (exportError) {
      setError(getErrorMessage(exportError))
    }
  }, [preflight, project, saveExport])

  const handleExportEps = useCallback(async (): Promise<void> => {
    try {
      setError(null)
      if (!confirmPreflight(preflight)) return
      setStatus('Creating EPS export...')
      await saveExport(exportCutterEps(project))
    } catch (exportError) {
      setError(getErrorMessage(exportError))
    }
  }, [preflight, project, saveExport])

  const handleBatchExport = useCallback(async (): Promise<void> => {
    try {
      setError(null)
      if (!confirmPreflight(preflight)) return
      setStatus('Creating production export folder...')
      const batch = await exportCutterProductionBatch(project, preflight)

      if (window.printerApp?.selectOutputFolder && window.printerApp.writeFilesToFolder) {
        const folder = await window.printerApp.selectOutputFolder()

        if (folder.canceled) {
          setStatus('Batch export canceled.')
          return
        }

        if (!folder.ok || !folder.folderPath) {
          throw new Error(folder.error ?? 'Could not choose an output folder.')
        }

        const files = await Promise.all(
          batch.files.map(async (file) => ({
            fileName: file.fileName,
            bytes: new Uint8Array(await file.blob.arrayBuffer())
          }))
        )
        const result = await window.printerApp.writeFilesToFolder(folder.folderPath, files)

        if (!result.ok) {
          throw new Error(result.error ?? 'Could not write production export files.')
        }

        setStatus(`Exported ${batch.files.length} production file(s) to ${batch.folderName}.`)
        return
      }

      for (const file of batch.files) {
        downloadBlob(file.blob, file.fileName.replace(/[\\/]+/g, '_'))
      }

      setStatus(`Downloaded ${batch.files.length} production file(s).`)
    } catch (exportError) {
      setError(getErrorMessage(exportError))
    }
  }, [preflight, project])

  const setExportMode = useCallback((mode: NonNullable<CutterExportSettings['mode']>): void => {
    setExportSettings((current) => ({
      ...current,
      mode,
      preset: getExportPresetForMode(mode),
      includeArtwork: mode !== 'cut-only' && mode !== 'test-cut',
      includeCutlines: mode !== 'print-only'
    }))
  }, [])

  const updateExportSettings = useCallback((patch: Partial<CutterExportSettings>): void => {
    setExportSettings((current) => ({
      ...current,
      ...patch,
      strokeName:
        patch.strokeName !== undefined ? normalizeSpotName(patch.strokeName) : current.strokeName
    }))
  }, [])

  const applyExportPreset = useCallback(
    (presetId: CutterExportPresetId): void => {
      const result = applyCutterExportPreset(presetId, sheet)

      setExportSettings(result.exportSettings)
      updateSheet(result.sheetPatch)
      setStatus(`Applied ${presetId.replace(/-/g, ' ')} export preset.`)
    },
    [sheet, updateSheet]
  )

  const markPieceSaved = useCallback((): void => {
    setMode('montage-sheet')
    if (activePieceId && repackWarningPieceIdsRef.current.has(activePieceId)) {
      const copyCount = placedPiecesRef.current.reduce(
        (count, placed) => count + Number(placed.presetId === activePieceId),
        0
      )
      setStatus(
        `Piece preset saved. Updated ${copyCount} arranged ${copyCount === 1 ? 'copy' : 'copies'}. Review the montage and use Arrange Copies to repack spacing.`
      )
      return
    }

    setStatus('Piece preset saved. Add it to the sheet or auto arrange the library.')
  }, [activePieceId])

  const clearProject = useCallback((): void => {
    fileImportOperationsRef.current.cancel()
    pdfImportOperationsRef.current.cancel()
    releasePdfImportSession(pdfImportSessionRef.current)
    pdfImportSessionRef.current = null
    pendingPdfFilesRef.current = []
    setPdfImportSession(null)
    setIsPdfImportBusy(false)
    for (const source of sourcesRef.current) {
      revokePreviewUrl(source.previewUrl)
    }

    setMode('piece-editor')
    sheetRef.current = DEFAULT_CUTTER_SHEET
    setSheet(DEFAULT_CUTTER_SHEET)
    setSources([])
    setPieces([])
    setPlacedPieces([])
    piecesRef.current = []
    placedPiecesRef.current = []
    repackWarningPieceIdsRef.current.clear()
    autoArrangeUndoSnapshotRef.current = null
    setLayers(defaultLayers)
    setExportSettings(getDefaultCutterExportSettings())
    setActivePieceId(null)
    setSelectedPlacedIds([])
    setStatus('Started a new cutter project. Import artwork to begin.')
    setError(null)
  }, [])

  return {
    mode,
    sheet,
    sources,
    pieces,
    placedPieces,
    layers,
    activePiece,
    activePieceId,
    selectedPlacedIds,
    selectedEditorObjects,
    keyObject,
    warnings,
    preflight,
    exportSettings,
    canExport,
    fineCutBusy,
    prepareFineCut,
    status,
    error,
    pdfImportSession,
    isPdfImportBusy,
    setMode,
    setLayers,
    updateSheet,
    resizeSheetHeight,
    importDesignFiles,
    addStickerResults,
    loadMorePdfPages,
    importSelectedPdfPages,
    cancelPdfImport,
    updatePiece,
    applyArtworkEdit,
    updatePieceQuantity,
    updatePieceTargetLength,
    renamePiece,
    updatePieceRotationAllowed,
    duplicatePiece,
    deletePiece,
    editPiece,
    addPieceToSheet,
    addPiecesToSheet,
    runAutoArrange,
    runAutoArrangeForPieces,
    undoAutoArrange,
    deleteUnusedPieces,
    createTestMontage,
    selectPlacedPiece,
    movePlacedPiece,
    resizePlacedPiece,
    duplicatePlacedPieces,
    deletePlacedPieces,
    rotatePlacedPiece,
    togglePlacedLock,
    nudgeSelected,
    alignSelected,
    handleExportSvg,
    handleExportPdf,
    handleExportEps,
    handleBatchExport,
    setExportMode,
    setExportSettings: updateExportSettings,
    applyExportPreset,
    markPieceSaved,
    clearProject
  }
}

export function reconcilePieceUpdate(
  currentPieces: PiecePreset[],
  currentPlacedPieces: PlacedPiece[],
  updatedPiece: PiecePreset,
  sheet: CutterSheetSettings
): {
  piece: PiecePreset
  pieces: PiecePreset[]
  placedPieces: PlacedPiece[]
  quantityChanged: boolean
  sizeChanged: boolean
  arrangedCopyCount: number
  retainedCopyCount: number
  lockedRetainedCopyCount: number
  addedCopyCount: number
  removedCopyCount: number
  warning: string | null
} {
  const piece = synchronizePieceEditorModel(updatedPiece)
  const previousPiece = currentPieces.find((candidate) => candidate.id === piece.id)
  const quantityChanged = previousPiece !== undefined && previousPiece.quantity !== piece.quantity
  const sizeChanged = previousPiece !== undefined && hasPieceSizeChanged(previousPiece, piece)
  const pieces = currentPieces.map((candidate) => (candidate.id === piece.id ? piece : candidate))
  const previousCopyCount = currentPlacedPieces.reduce(
    (count, placed) => count + Number(placed.presetId === piece.id),
    0
  )
  let retainedCopyCount = 0
  let lockedRetainedCopyCount = 0

  // Quantity-only edits retain existing placements deterministically. A size
  // edit retains only intentionally locked copies; unlocked copies are removed
  // here and recreated below so stale spacing cannot strand copies on later
  // sheets or leave the resized montage overlapping.
  const retainedPlacedPieces = currentPlacedPieces.flatMap((placed) => {
    if (placed.presetId !== piece.id) return [placed]
    if (retainedCopyCount >= piece.quantity) return []
    if (sizeChanged && !placed.locked) return []

    retainedCopyCount += 1
    if (placed.locked) lockedRetainedCopyCount += 1
    return [refreshPlacedPieceFromPreset(placed, piece)]
  })

  let placedPieces = retainedPlacedPieces
  let warning: string | null = null

  if (sizeChanged || (quantityChanged && retainedCopyCount < piece.quantity)) {
    const retainedCountByPreset = new Map<string, number>()
    for (const placed of retainedPlacedPieces) {
      retainedCountByPreset.set(
        placed.presetId,
        (retainedCountByPreset.get(placed.presetId) ?? 0) + 1
      )
    }

    // Existing copies from every preset participate as collision obstacles,
    // but only the edited preset receives missing copies. Other quantities are
    // pinned to their retained montage counts for this focused reconciliation.
    const arrangementPieces = pieces.map((candidate) => ({
      ...candidate,
      quantity:
        candidate.id === piece.id ? piece.quantity : (retainedCountByPreset.get(candidate.id) ?? 0)
    }))
    const result = autoArrangePieces(
      arrangementPieces,
      { ...sheet, preserveManualPositions: true },
      retainedPlacedPieces
    )

    placedPieces = result.placedPieces
    warning = result.warning ?? null
  }

  const arrangedCopyCount = placedPieces.reduce(
    (count, placed) => count + Number(placed.presetId === piece.id),
    0
  )

  return {
    piece,
    pieces,
    placedPieces,
    quantityChanged,
    sizeChanged,
    arrangedCopyCount,
    retainedCopyCount,
    lockedRetainedCopyCount,
    addedCopyCount: Math.max(0, arrangedCopyCount - retainedCopyCount),
    removedCopyCount: Math.max(0, previousCopyCount - retainedCopyCount),
    warning
  }
}

export interface AutoArrangeUndoSnapshot {
  placedPieces: PlacedPiece[]
  repackWarningPieceIds: ReadonlySet<string>
  pieces?: readonly PiecePreset[]
  sheetSignature?: string
}

/**
 * Clicking Arrange Copies is an explicit request to rebuild the selected
 * presets. Unselected models receive temporary sheet locks so Arrange selected
 * cannot remove them. Artwork/mask locks live in the preset model and are
 * never changed here.
 */
export function preparePlacedPiecesForExplicitArrange(
  placedPieces: readonly PlacedPiece[],
  targetPieceIds: ReadonlySet<string>,
  preserveManualPositions: boolean
): PlacedPiece[] {
  if (preserveManualPositions) return [...placedPieces]

  return placedPieces.map((placed) =>
    targetPieceIds.has(placed.presetId) ? { ...placed, locked: false } : { ...placed, locked: true }
  )
}

function countPlacedPiecesByPreset(placedPieces: readonly PlacedPiece[]): Map<string, number> {
  const counts = new Map<string, number>()

  for (const placed of placedPieces) {
    counts.set(placed.presetId, (counts.get(placed.presetId) ?? 0) + 1)
  }

  return counts
}

/** Restore temporary sheet locks applied only to protect unselected models during arrangement. */
export function restoreUnselectedPlacementLocks(
  arrangedPieces: readonly PlacedPiece[],
  previousPieces: readonly PlacedPiece[],
  targetPieceIds: ReadonlySet<string>
): PlacedPiece[] {
  const previousLockById = new Map(previousPieces.map((piece) => [piece.id, piece.locked]))

  return arrangedPieces.map((placed) => {
    if (targetPieceIds.has(placed.presetId) || !previousLockById.has(placed.id)) return placed
    return { ...placed, locked: previousLockById.get(placed.id) ?? placed.locked }
  })
}

export function createAutoArrangeUndoSnapshot(
  placedPieces: readonly PlacedPiece[],
  repackWarningPieceIds: ReadonlySet<string>,
  pieces?: readonly PiecePreset[],
  sheet?: CutterSheetSettings
): AutoArrangeUndoSnapshot {
  return {
    placedPieces: [...placedPieces],
    repackWarningPieceIds: new Set(repackWarningPieceIds),
    pieces,
    sheetSignature: sheet ? JSON.stringify(normalizeCutterSheetSettings(sheet)) : undefined
  }
}

export function canRestoreAutoArrangeSnapshot(
  snapshot: AutoArrangeUndoSnapshot,
  pieces: readonly PiecePreset[],
  sheet: CutterSheetSettings
): boolean {
  return (
    snapshot.pieces === pieces &&
    snapshot.sheetSignature === JSON.stringify(normalizeCutterSheetSettings(sheet))
  )
}

export function clearArrangedRepackWarnings(
  repackWarningPieceIds: ReadonlySet<string>,
  arrangedPieceIds: readonly string[],
  retainedWarningPieceIds: ReadonlySet<string> = new Set()
): Set<string> {
  const remainingWarnings = new Set(repackWarningPieceIds)

  for (const pieceId of arrangedPieceIds) {
    if (!retainedWarningPieceIds.has(pieceId)) remainingWarnings.delete(pieceId)
  }

  return remainingWarnings
}

export function getLockedRepackWarningPieceIds(
  repackWarningPieceIds: ReadonlySet<string>,
  targetPieceIds: readonly string[],
  placedPieces: readonly PlacedPiece[]
): Set<string> {
  const targetIds = new Set(targetPieceIds)
  const lockedWarningPieceIds = new Set<string>()

  for (const placed of placedPieces) {
    if (
      placed.locked &&
      targetIds.has(placed.presetId) &&
      repackWarningPieceIds.has(placed.presetId)
    ) {
      lockedWarningPieceIds.add(placed.presetId)
    }
  }

  return lockedWarningPieceIds
}

export function resizePlacedPieceDimensions(
  placed: PlacedPiece,
  widthCm: number,
  heightCm: number,
  presets: readonly PiecePreset[]
): PlacedPiece {
  const resized: PlacedPiece = {
    ...placed,
    widthCm: clampPlacedPieceDimension(widthCm, placed.widthCm),
    heightCm: clampPlacedPieceDimension(heightCm, placed.heightCm)
  }

  return refreshPlacedPieceProductionBounds(resized, presets)
}

function clampPlacedPieceDimension(value: number, fallback: number): number {
  const finiteValue = Number.isFinite(value) ? value : fallback
  return Math.min(
    Math.max(finiteValue, CUTTER_PIECE_MIN_DIMENSION_CM),
    CUTTER_PIECE_MAX_DIMENSION_CM
  )
}

/**
 * Recalculate a placed piece's cached production footprint after any geometry
 * mutation. If its preset is unavailable, discard the cache so downstream
 * production sizing and export code cannot trust stale coordinates.
 */
export function refreshPlacedPieceProductionBounds(
  placed: PlacedPiece,
  presets: readonly PiecePreset[]
): PlacedPiece {
  const preset = presets.find((candidate) => candidate.id === placed.presetId)

  if (!preset) {
    const { productionBoundsCm: _staleBounds, ...withoutStaleBounds } = placed
    return withoutStaleBounds
  }

  return {
    ...placed,
    productionBoundsCm: getPlacedProductionBounds(placed, preset)
  }
}

function confirmPreflight(preflight: CutterPreflightReport): boolean {
  if (!preflight.canExport) return false
  if (preflight.issues.length === 0) return true
  return window.confirm(
    `Preflight found ${preflight.issues.length} issue(s):\n\n${preflight.issues.map((item) => `• ${item.message}`).join('\n')}\n\nContinue export anyway?`
  )
}

function getLegacyEditorState(
  piece: PiecePreset | null,
  fallback: {
    selectedEditorObjects: EditorObjectType[]
    keyObject: KeyObjectState
  } | null
): { selectedEditorObjects: EditorObjectType[]; keyObject: KeyObjectState } {
  if (!piece) {
    return {
      selectedEditorObjects: fallback?.selectedEditorObjects ?? [],
      keyObject: fallback?.keyObject ?? { object: null }
    }
  }

  const selectedIds = new Set(piece.selectedObjectIds)
  const selectedEditorObjects = Array.from(
    new Set(
      piece.objects.filter((object) => selectedIds.has(object.id)).map((object) => object.type)
    )
  )
  const key = piece.objects.find(
    (object) => object.id === piece.keyObjectId && selectedIds.has(object.id)
  )

  return {
    selectedEditorObjects,
    keyObject: { object: key?.type ?? null, objectId: key?.id }
  }
}

function hasPieceSizeChanged(previous: PiecePreset, next: PiecePreset): boolean {
  return (
    hasDimensionChanged(previous.widthCm, next.widthCm) ||
    hasDimensionChanged(previous.heightCm, next.heightCm)
  )
}

function hasDimensionChanged(previous: number, next: number): boolean {
  if (!Number.isFinite(previous) || !Number.isFinite(next)) {
    return !Object.is(previous, next)
  }

  const tolerance = Math.max(Math.abs(previous), Math.abs(next), 1) * 1e-9
  return Math.abs(previous - next) > tolerance
}

function releasePdfImportSession(session: CutterPdfImportSession | null): void {
  if (!session) return

  for (const page of session.pages) {
    revokePreviewUrl(page.thumbnailUrl)
  }
}

function revokePreviewUrl(url: string | undefined): void {
  if (url?.startsWith('blob:')) {
    URL.revokeObjectURL(url)
  }
}

function loadArtworkDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const image = new Image()

    image.onload = () => {
      resolve({
        width: image.naturalWidth || 800,
        height: image.naturalHeight || 800
      })
    }
    image.onerror = () => resolve({ width: 800, height: 800 })
    image.src = url
  })
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = fileName
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 500)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function alignPlacedPieces(
  pieces: PlacedPiece[],
  selectedIds: string[],
  command: AlignmentCommand
): PlacedPiece[] {
  const selected = pieces.filter((piece) => selectedIds.includes(piece.id))
  const key = pieces.find((piece) => piece.id === selectedIds[0])
  if (!key || selected.length < 2) return pieces
  if (command === 'distribute-horizontal' || command === 'distribute-vertical') {
    const horizontal = command === 'distribute-horizontal'
    const sorted = [...selected].sort((a, b) => (horizontal ? a.xCm - b.xCm : a.yCm - b.yCm))
    const first = sorted[0]
    const last = sorted[sorted.length - 1]
    const start = horizontal ? first.xCm : first.yCm
    const end = horizontal ? last.xCm : last.yCm
    const step = (end - start) / Math.max(sorted.length - 1, 1)
    const positions = new Map(sorted.map((piece, index) => [piece.id, start + step * index]))
    return pieces.map((piece) =>
      !positions.has(piece.id) || piece.locked
        ? piece
        : horizontal
          ? { ...piece, xCm: positions.get(piece.id)! }
          : { ...piece, yCm: positions.get(piece.id)! }
    )
  }
  return pieces.map((piece) => {
    if (!selectedIds.includes(piece.id) || piece.id === key.id || piece.locked) return piece
    if (command === 'left') return { ...piece, xCm: key.xCm }
    if (command === 'right') return { ...piece, xCm: key.xCm + key.widthCm - piece.widthCm }
    if (command === 'center-horizontal')
      return { ...piece, xCm: key.xCm + (key.widthCm - piece.widthCm) / 2 }
    if (command === 'top') return { ...piece, yCm: key.yCm }
    if (command === 'bottom') return { ...piece, yCm: key.yCm + key.heightCm - piece.heightCm }
    return { ...piece, yCm: key.yCm + (key.heightCm - piece.heightCm) / 2 }
  })
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong in Cutter Montage.'
}

// A superseded task may share old thumbnails with the still-active session.
// Only its newly-created thumbnails belong to this discarded result.
function releaseNewPdfPreviews(
  next: CutterPdfImportSession,
  previous: CutterPdfImportSession
): void {
  const existingUrls = new Set(previous.pages.map((page) => page.thumbnailUrl))
  releasePdfImportSession({
    ...next,
    pages: next.pages.filter((page) => !existingUrls.has(page.thumbnailUrl))
  })
}
