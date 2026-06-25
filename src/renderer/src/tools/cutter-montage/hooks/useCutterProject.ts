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
  getSheetWarnings
} from '../lib/cutterLayout'
import { exportCutterEps } from '../lib/epsExport'
import { autoArrangePieces, createCutterId } from '../lib/nesting'
import {
  createPiecePresetFromSource,
  createPlacedPieceFromPreset,
  duplicatePiecePreset
} from '../lib/piecePresets'
import { exportCutterPdf } from '../lib/pdfCutExport'
import { exportCutterSvg } from '../lib/svgExport'
import { synchronizePieceEditorModel } from '../lib/editorObjects'
import { runCutterPreflight, type CutterPreflightReport } from '../lib/preflight'
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
  status: string
  error: string | null
  setMode: (mode: CutterMode) => void
  setLayers: Dispatch<SetStateAction<CutterLayerVisibility>>
  updateSheet: (patch: Partial<CutterSheetSettings>) => void
  importDesignFiles: (files: File[]) => Promise<void>
  updatePiece: (updatedPiece: PiecePreset) => void
  updatePieceQuantity: (pieceId: string, quantity: number) => void
  renamePiece: (pieceId: string, name: string) => void
  updatePieceRotationAllowed: (pieceId: string, rotationAllowed: boolean) => void
  duplicatePiece: (pieceId: string) => void
  deletePiece: (pieceId: string) => void
  editPiece: (pieceId: string) => void
  addPieceToSheet: (pieceId: string) => void
  runAutoArrange: () => void
  undoAutoArrange: () => void
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
  setExportMode: (mode: NonNullable<CutterExportSettings['mode']>) => void
  markPieceSaved: () => void
  clearProject: () => void
} {
  const [initialState] = useState(() =>
    initialProject ? deserializeCutterProjectPayload(initialProject.payload) : null
  )
  const [mode, setMode] = useState<CutterMode>(() => initialState?.mode ?? 'piece-editor')
  const [sheet, setSheet] = useState<CutterSheetSettings>(
    () => initialState?.sheet ?? DEFAULT_CUTTER_SHEET
  )
  const [sources, setSources] = useState<PieceSourceFile[]>(() => initialState?.sources ?? [])
  const [pieces, setPieces] = useState<PiecePreset[]>(
    () => initialState?.pieces.map((piece) => synchronizePieceEditorModel(piece)) ?? []
  )
  const [placedPieces, setPlacedPieces] = useState<PlacedPiece[]>(
    () => initialState?.placedPieces ?? []
  )
  const [layers, setLayers] = useState<CutterLayerVisibility>(
    () => initialState?.layers ?? defaultLayers
  )
  const [exportSettings, setExportSettings] = useState<CutterExportSettings>(
    () =>
      initialProject?.payload.exportSettings ?? {
        strokeName: normalizeSpotName(CUT_CONTOUR_NAME),
        includeArtwork: true,
        includeCutlines: true,
        mode: 'print-cut',
        preset: 'svg-illustrator'
      }
  )
  const [activePieceId, setActivePieceId] = useState<string | null>(
    () => initialState?.activePieceId ?? null
  )
  const [selectedPlacedIds, setSelectedPlacedIds] = useState<string[]>(
    () => initialState?.selectedPlacedIds ?? []
  )
  const [status, setStatus] = useState<string>(() =>
    initialProject
      ? `Opened ${initialProject.metadata.jobName}.`
      : 'Import artwork to prepare the first sticker piece.'
  )
  const [error, setError] = useState<string | null>(null)
  const sourcesRef = useRef<PieceSourceFile[]>([])
  const layoutBeforeAutoArrangeRef = useRef<PlacedPiece[] | null>(null)
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
    return () => {
      for (const source of sourcesRef.current) {
        URL.revokeObjectURL(source.previewUrl)
      }
    }
  }, [])

  const project = useMemo<CutterProject>(
    () => ({
      sheet,
      sources,
      pieces,
      placedPieces,
      layers,
      exportSettings
    }),
    [exportSettings, layers, pieces, placedPieces, sheet, sources]
  )
  const preflight = useMemo(() => runCutterPreflight(project), [project])
  const canExport = placedPieces.length > 0 && preflight.canExport

  const updateSheet = useCallback((patch: Partial<CutterSheetSettings>): void => {
    setSheet((current) => ({
      ...current,
      ...patch,
      widthCm: patch.widthCm !== undefined ? clampSheetWidth(patch.widthCm) : current.widthCm,
      heightCm: patch.heightCm !== undefined ? clampSheetHeight(patch.heightCm) : current.heightCm
    }))
  }, [])

  const importDesignFiles = useCallback(
    async (files: File[]): Promise<void> => {
      setError(null)
      const supportedFiles = files.filter(isSupportedDesignFile)

      if (supportedFiles.length !== files.length) {
        setError('Only PNG, JPG, and SVG artwork files are supported in this cutter MVP.')
        return
      }

      try {
        const importedSources: PieceSourceFile[] = []
        const importedPieces: PiecePreset[] = []

        for (const file of supportedFiles) {
          const bytes = new Uint8Array(await file.arrayBuffer())
          const mimeType = getDesignMimeType(file)
          const previewUrl = URL.createObjectURL(
            new Blob([bytesToArrayBuffer(bytes)], { type: mimeType })
          )
          const dimensions = await loadArtworkDimensions(previewUrl)
          const source: PieceSourceFile = {
            id: createCutterId('source'),
            fileName: file.name,
            displayName: file.name.replace(/\.[^.]+$/, ''),
            mimeType,
            bytes,
            previewUrl,
            naturalWidthPx: dimensions.width,
            naturalHeightPx: dimensions.height
          }

          importedSources.push(source)
          importedPieces.push(createPiecePresetFromSource(source, [...pieces, ...importedPieces]))
        }

        setSources((current) => [...current, ...importedSources])
        setPieces((current) => [...current, ...importedPieces])
        setActivePieceId(importedPieces[0]?.id ?? activePieceId)
        setMode('piece-editor')
        setStatus(`Imported ${importedPieces.length} editable piece preset(s).`)
      } catch (importError) {
        setError(getErrorMessage(importError))
      }
    },
    [activePieceId, pieces]
  )

  const updatePiece = useCallback((updatedPiece: PiecePreset): void => {
    const normalizedPiece = synchronizePieceEditorModel(updatedPiece)
    setPieces((current) =>
      current.map((piece) => (piece.id === normalizedPiece.id ? normalizedPiece : piece))
    )
    setPlacedPieces((current) =>
      current.map((placed) =>
        placed.presetId === normalizedPiece.id
          ? refreshPlacedFromPreset(placed, normalizedPiece)
          : placed
      )
    )
  }, [])

  const updatePieceQuantity = useCallback((pieceId: string, quantity: number): void => {
    setPieces((current) =>
      current.map((piece) =>
        piece.id === pieceId ? { ...piece, quantity: Math.max(1, Math.round(quantity)) } : piece
      )
    )
  }, [])

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
                URL.revokeObjectURL(source.previewUrl)
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

  const editPiece = useCallback((pieceId: string): void => {
    setActivePieceId(pieceId)
    setMode('piece-editor')
  }, [])

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

  const runAutoArrange = useCallback((): void => {
    if (pieces.length === 0) {
      setError('Import and prepare at least one piece before auto arrange.')
      return
    }

    layoutBeforeAutoArrangeRef.current = placedPieces
    const result = autoArrangePieces(pieces, sheet, placedPieces)

    setPlacedPieces(result.placedPieces)
    setSelectedPlacedIds(result.placedPieces[0] ? [result.placedPieces[0].id] : [])
    setMode('montage-sheet')
    setStatus(
      result.warning ??
        `Auto arranged ${result.placedCount} of ${result.requestedCount} piece(s). Used ${result.usedAreaPercent?.toFixed(1) ?? '0'}%; estimated waste ${result.wasteAreaPercent?.toFixed(1) ?? '100'}%.`
    )
    setError(result.warning ?? null)
  }, [pieces, placedPieces, sheet])

  const undoAutoArrange = useCallback((): void => {
    if (!layoutBeforeAutoArrangeRef.current) return
    setPlacedPieces(layoutBeforeAutoArrangeRef.current)
    layoutBeforeAutoArrangeRef.current = null
    setStatus('Restored the layout from before Auto Arrange.')
  }, [])

  const createTestMontage = useCallback((count = 100): void => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><circle cx="200" cy="200" r="180" fill="#2563eb"/><text x="200" y="220" text-anchor="middle" font-size="64" fill="white">TEST</text></svg>'
    const bytes = new TextEncoder().encode(svg)
    const previewUrl = URL.createObjectURL(new Blob([bytes], { type: 'image/svg+xml' }))
    const source: PieceSourceFile = {
      id: createCutterId('source'),
      fileName: 'test-sticker.svg',
      displayName: 'Test Sticker',
      mimeType: 'image/svg+xml',
      bytes,
      previewUrl,
      naturalWidthPx: 400,
      naturalHeightPx: 400
    }
    const piece = createPiecePresetFromSource(source, [])
    piece.quantity = Math.max(1, count)
    piece.displayName = count === 20 ? 'Ellipse Test Sticker' : 'Stress Test Sticker'
    setSources((current) => [...current, source])
    setPieces([piece])
    setActivePieceId(piece.id)
    const result = autoArrangePieces(
      [piece],
      { ...DEFAULT_CUTTER_SHEET, widthCm: 95, heightCm: 120 },
      []
    )
    setPlacedPieces(result.placedPieces)
    setMode('montage-sheet')
    setStatus(`Created a development test montage with ${result.placedCount} placed copies.`)
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
      current.map((placed) => (placed.id === pieceId ? { ...placed, xCm, yCm } : placed))
    )
  }, [])

  const resizePlacedPiece = useCallback(
    (pieceId: string, widthCm: number, heightCm: number): void => {
      setPlacedPieces((current) =>
        current.map((placed) => {
          if (placed.id !== pieceId || placed.locked) {
            return placed
          }

          return {
            ...placed,
            widthCm: Math.max(widthCm, 0.5),
            heightCm: Math.max(heightCm, 0.5)
          }
        })
      )
    },
    []
  )

  const duplicatePlacedPieces = useCallback(
    (pieceIds: string[]): void => {
      setPlacedPieces((current) => {
        const selected = current.filter((placed) => pieceIds.includes(placed.id))
        const duplicates = selected.map((placed) => ({
          ...placed,
          id: createCutterId('placed'),
          xCm: Math.min(placed.xCm + 1, Math.max(sheet.widthCm - placed.widthCm, 0)),
          yCm: Math.min(placed.yCm + 1, Math.max(sheet.heightCm - placed.heightCm, 0))
        }))

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

        return {
          ...placed,
          rotation: nextRotation,
          widthCm: placed.heightCm,
          heightCm: placed.widthCm
        }
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

          return {
            ...placed,
            xCm: clamp(placed.xCm + dxCm, 0, Math.max(sheet.widthCm - placed.widthCm, 0)),
            yCm: clamp(placed.yCm + dyCm, 0, Math.max(sheet.heightCm - placed.heightCm, 0))
          }
        })
      )
    },
    [selectedPlacedIds, sheet.heightCm, sheet.widthCm]
  )

  const alignSelected = useCallback(
    (command: AlignmentCommand): void => {
      if (selectedPlacedIds.length < 2) return
      setPlacedPieces((current) => alignPlacedPieces(current, selectedPlacedIds, command))
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

  const setExportMode = useCallback((mode: NonNullable<CutterExportSettings['mode']>): void => {
    setExportSettings((current) => ({
      ...current,
      mode,
      includeArtwork: mode !== 'cut-only',
      includeCutlines: mode !== 'print-only'
    }))
  }, [])

  const markPieceSaved = useCallback((): void => {
    setMode('montage-sheet')
    setStatus('Piece preset saved. Add it to the sheet or auto arrange the library.')
  }, [])

  const clearProject = useCallback((): void => {
    for (const source of sourcesRef.current) {
      URL.revokeObjectURL(source.previewUrl)
    }

    setMode('piece-editor')
    setSheet(DEFAULT_CUTTER_SHEET)
    setSources([])
    setPieces([])
    setPlacedPieces([])
    setLayers(defaultLayers)
    setExportSettings({
      strokeName: normalizeSpotName(CUT_CONTOUR_NAME),
      includeArtwork: true,
      includeCutlines: true,
      mode: 'print-cut',
      preset: 'svg-illustrator'
    })
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
    status,
    error,
    setMode,
    setLayers,
    updateSheet,
    importDesignFiles,
    updatePiece,
    updatePieceQuantity,
    renamePiece,
    updatePieceRotationAllowed,
    duplicatePiece,
    deletePiece,
    editPiece,
    addPieceToSheet,
    runAutoArrange,
    undoAutoArrange,
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
    setExportMode,
    markPieceSaved,
    clearProject
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

function refreshPlacedFromPreset(placed: PlacedPiece, piece: PiecePreset): PlacedPiece {
  const rotated = placed.rotation === 90 || placed.rotation === 270

  return {
    ...placed,
    sourceFileName: piece.sourceFileName,
    displayName: piece.displayName,
    widthCm: rotated ? piece.heightCm : piece.widthCm,
    heightCm: rotated ? piece.widthCm : piece.heightCm,
    locked: piece.locked || placed.locked,
    artworkTransform: { ...piece.artwork.transform },
    maskTransform: { ...piece.mask.transform },
    cutlineTransform: { ...piece.cutline.transform }
  }
}

function isSupportedDesignFile(file: File): boolean {
  return /image\/(png|jpeg|svg\+xml)/.test(file.type) || /\.(png|jpe?g|svg)$/i.test(file.name)
}

function getDesignMimeType(file: File): string {
  if (file.type) {
    return file.type
  }

  if (/\.svg$/i.test(file.name)) {
    return 'image/svg+xml'
  }

  return /\.png$/i.test(file.name) ? 'image/png' : 'image/jpeg'
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

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
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
