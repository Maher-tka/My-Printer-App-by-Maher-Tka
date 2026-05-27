import { ArrowLeft } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { usePerformanceSettings } from '@/performance/usePerformanceSettings'
import type { AppRoute } from '@/types/navigation'
import { ArtboardCanvas } from './components/ArtboardCanvas'
import { CutterToolbar } from './components/CutterToolbar'
import { ExportCutterPanel } from './components/ExportCutterPanel'
import { LayerVisibilityControls } from './components/LayerVisibilityControls'
import { PieceEditor } from './components/PieceEditor'
import { PieceLibraryPanel } from './components/PieceLibraryPanel'
import { CUT_CONTOUR_NAME, normalizeSpotName } from './lib/colorSpot'
import {
  DEFAULT_CUTTER_SHEET,
  clampSheetHeight,
  clampSheetWidth,
  getSheetWarnings
} from './lib/cutterLayout'
import { exportCutterEps } from './lib/epsExport'
import {
  alignPieceObjects,
  centerArtworkToCutline,
  centerCutlineToArtwork
} from './lib/alignment'
import { autoArrangePieces, createCutterId } from './lib/nesting'
import { createPiecePresetFromSource, createPlacedPieceFromPreset, duplicatePiecePreset } from './lib/piecePresets'
import { exportCutterPdf } from './lib/pdfCutExport'
import { exportCutterSvg } from './lib/svgExport'
import type {
  AlignmentCommand,
  CutterExportResult,
  CutterLayerVisibility,
  CutterMode,
  CutterProject,
  CutterSheetSettings,
  EditorObjectType,
  KeyObjectState,
  PiecePreset,
  PieceSourceFile,
  PlacedPiece
} from './types'

interface CutterMontagePageProps {
  onNavigate: (route: AppRoute) => void
}

const defaultLayers: CutterLayerVisibility = {
  artwork: true,
  cutlines: true
}

export function CutterMontagePage({
  onNavigate
}: CutterMontagePageProps): JSX.Element {
  const { settings: performanceSettings } = usePerformanceSettings()
  const [mode, setMode] = useState<CutterMode>('piece-editor')
  const [sheet, setSheet] = useState<CutterSheetSettings>(DEFAULT_CUTTER_SHEET)
  const [sources, setSources] = useState<PieceSourceFile[]>([])
  const [pieces, setPieces] = useState<PiecePreset[]>([])
  const [placedPieces, setPlacedPieces] = useState<PlacedPiece[]>([])
  const [layers, setLayers] = useState<CutterLayerVisibility>(defaultLayers)
  const [activePieceId, setActivePieceId] = useState<string | null>(null)
  const [selectedPlacedIds, setSelectedPlacedIds] = useState<string[]>([])
  const [selectedEditorObjects, setSelectedEditorObjects] = useState<EditorObjectType[]>([
    'artwork',
    'cutline'
  ])
  const [keyObject, setKeyObject] = useState<KeyObjectState>({ object: 'cutline' })
  const [status, setStatus] = useState<string>('Import artwork to prepare the first sticker piece.')
  const [error, setError] = useState<string | null>(null)
  const sourcesRef = useRef<PieceSourceFile[]>([])
  const warnings = getSheetWarnings(sheet)
  const canExport = placedPieces.length > 0
  const activePiece = pieces.find((piece) => piece.id === activePieceId) ?? null

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
      exportSettings: {
        strokeName: normalizeSpotName(CUT_CONTOUR_NAME),
        includeArtwork: layers.artwork,
        includeCutlines: layers.cutlines
      }
    }),
    [layers, pieces, placedPieces, sheet, sources]
  )

  const updateSheet = useCallback((patch: Partial<CutterSheetSettings>): void => {
    setSheet((current) => ({
      ...current,
      ...patch,
      widthCm: patch.widthCm !== undefined ? clampSheetWidth(patch.widthCm) : current.widthCm,
      heightCm:
        patch.heightCm !== undefined ? clampSheetHeight(patch.heightCm) : current.heightCm
    }))
  }, [])

  const importDesignFiles = useCallback(async (files: File[]): Promise<void> => {
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
        const previewUrl = URL.createObjectURL(new Blob([bytesToArrayBuffer(bytes)], { type: mimeType }))
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
  }, [activePieceId, pieces])

  const updatePiece = useCallback((updatedPiece: PiecePreset): void => {
    setPieces((current) =>
      current.map((piece) => (piece.id === updatedPiece.id ? updatedPiece : piece))
    )
    setPlacedPieces((current) =>
      current.map((placed) =>
        placed.presetId === updatedPiece.id
          ? refreshPlacedFromPreset(placed, updatedPiece)
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

  const updatePieceRotationAllowed = useCallback((pieceId: string, rotationAllowed: boolean): void => {
    setPieces((current) =>
      current.map((piece) =>
        piece.id === pieceId ? { ...piece, rotationAllowed } : piece
      )
    )
  }, [])

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

  const deletePiece = useCallback((pieceId: string): void => {
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
    setSelectedPlacedIds((current) => current.filter((id) => {
      const placed = placedPieces.find((candidate) => candidate.id === id)
      return placed?.presetId !== pieceId
    }))
    setActivePieceId((current) => (current === pieceId ? null : current))
    setStatus('Piece preset deleted.')
  }, [placedPieces])

  const editPiece = useCallback((pieceId: string): void => {
    setActivePieceId(pieceId)
    setSelectedEditorObjects(['artwork', 'cutline'])
    setKeyObject({ object: 'cutline' })
    setMode('piece-editor')
  }, [])

  const addPieceToSheet = useCallback((pieceId: string): void => {
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
          Math.min(sheet.safeMarginCm + baseOffset + index * 0.25, Math.max(sheet.widthCm - piece.widthCm, 0)),
          Math.min(sheet.safeMarginCm + baseOffset + index * 0.25, Math.max(sheet.heightCm - piece.heightCm, 0))
        )
      )
    }

    setPlacedPieces((current) => [...current, ...copies])
    setSelectedPlacedIds(copies[0] ? [copies[0].id] : [])
    setMode('montage-sheet')
    setStatus(`Added ${copies.length} copy/copies of ${piece.displayName} to the sheet.`)
  }, [pieces, placedPieces.length, sheet.heightCm, sheet.safeMarginCm, sheet.widthCm])

  const runAutoArrange = useCallback((): void => {
    if (pieces.length === 0) {
      setError('Import and prepare at least one piece before auto arrange.')
      return
    }

    const result = autoArrangePieces(pieces, sheet, placedPieces)

    setPlacedPieces(result.placedPieces)
    setSelectedPlacedIds(result.placedPieces[0] ? [result.placedPieces[0].id] : [])
    setMode('montage-sheet')
    setStatus(
      result.warning ??
        `Auto arranged ${result.placedCount} of ${result.requestedCount} piece(s). Used height: ${result.usedHeightCm.toFixed(1)} cm.`
    )
    setError(result.warning ?? null)
  }, [pieces, placedPieces, sheet])

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

  const resizePlacedPiece = useCallback((pieceId: string, widthCm: number, heightCm: number): void => {
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
  }, [])

  const duplicatePlacedPieces = useCallback((pieceIds: string[]): void => {
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
  }, [sheet.heightCm, sheet.widthCm])

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

  const nudgeSelected = useCallback((dxCm: number, dyCm: number): void => {
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
  }, [selectedPlacedIds, sheet.heightCm, sheet.widthCm])

  const alignActivePiece = useCallback((command: AlignmentCommand): void => {
    if (!activePiece) {
      return
    }

    updatePiece(alignPieceObjects(activePiece, selectedEditorObjects, keyObject, command))
  }, [activePiece, keyObject, selectedEditorObjects, updatePiece])

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
      setStatus('Creating SVG export...')
      await saveExport(await exportCutterSvg(project))
    } catch (exportError) {
      setError(getErrorMessage(exportError))
    }
  }, [project, saveExport])

  const handleExportPdf = useCallback(async (): Promise<void> => {
    try {
      setError(null)
      setStatus('Creating PDF export...')
      await saveExport(await exportCutterPdf(project))
    } catch (exportError) {
      setError(getErrorMessage(exportError))
    }
  }, [project, saveExport])

  const handleExportEps = useCallback(async (): Promise<void> => {
    try {
      setError(null)
      setStatus('Creating EPS export...')
      await saveExport(exportCutterEps(project))
    } catch (exportError) {
      setError(getErrorMessage(exportError))
    }
  }, [project, saveExport])

  return (
    <div className="mx-auto flex max-w-[1680px] flex-col gap-5">
      <Button
        variant="ghost"
        className="w-fit"
        onClick={() => onNavigate('dashboard')}
        type="button"
      >
        <ArrowLeft data-icon="inline-start" />
        Back to Dashboard
      </Button>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4 pb-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-xl">Cutter Layer + Big Sheet Montage</CardTitle>
              <Badge variant="warning">MVP Beta</Badge>
            </div>
            <CardDescription>
              Prepare editable sticker pieces, align vector CutContour paths, then arrange them on a real-size roll sheet.
            </CardDescription>
          </div>
          <Badge variant="secondary">{performanceSettings.label}</Badge>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <CutterToolbar
            mode={mode}
            settings={sheet}
            warnings={warnings}
            hasPieces={pieces.length > 0}
            onModeChange={setMode}
            onSettingsChange={updateSheet}
            onAutoArrange={runAutoArrange}
          />

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm font-medium text-destructive">
              {error}
            </div>
          )}

          <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            {status}
          </div>

          <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[340px_minmax(0,1fr)]">
            <aside className="flex flex-col gap-4">
              <PieceLibraryPanel
                pieces={pieces}
                activePieceId={activePieceId}
                onImport={importDesignFiles}
                onEditPiece={editPiece}
                onDuplicatePiece={duplicatePiece}
                onDeletePiece={deletePiece}
                onAddToSheet={addPieceToSheet}
                onPieceQuantityChange={updatePieceQuantity}
                onPieceRotationAllowedChange={updatePieceRotationAllowed}
              />
              <LayerVisibilityControls
                layers={layers}
                settings={sheet}
                onLayerChange={(patch) => setLayers((current) => ({ ...current, ...patch }))}
                onSettingsChange={updateSheet}
              />
              <ExportCutterPanel
                canExport={canExport}
                onExportSvg={handleExportSvg}
                onExportPdf={handleExportPdf}
                onExportEps={handleExportEps}
              />
            </aside>

            {mode === 'piece-editor' ? (
              <PieceEditor
                piece={activePiece}
                selectedObjects={selectedEditorObjects}
                keyObject={keyObject}
                onPieceChange={updatePiece}
                onSelectedObjectsChange={setSelectedEditorObjects}
                onSetKeyObject={(object) => setKeyObject({ object })}
                onAlign={alignActivePiece}
                onCenterArtworkToCutline={() => activePiece && updatePiece(centerArtworkToCutline(activePiece))}
                onCenterCutlineToArtwork={() => activePiece && updatePiece(centerCutlineToArtwork(activePiece))}
                onSave={() => {
                  setMode('montage-sheet')
                  setStatus('Piece preset saved. Add it to the sheet or auto arrange the library.')
                }}
                onDuplicate={() => activePiece && duplicatePiece(activePiece.id)}
              />
            ) : (
              <ArtboardCanvas
                settings={sheet}
                pieces={pieces}
                placedPieces={placedPieces}
                selectedPieceIds={selectedPlacedIds}
                layers={layers}
                onHeightChange={(heightCm) => updateSheet({ heightCm })}
                onSelectPiece={selectPlacedPiece}
                onMovePiece={movePlacedPiece}
                onResizePiece={resizePlacedPiece}
                onDuplicatePieces={duplicatePlacedPieces}
                onDeletePieces={deletePlacedPieces}
                onRotatePiece={rotatePlacedPiece}
                onToggleLock={togglePlacedLock}
                onNudgeSelected={nudgeSelected}
              />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
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
    cutlineTransform: { ...piece.cutline.transform }
  }
}

function isSupportedDesignFile(file: File): boolean {
  return (
    /image\/(png|jpeg|svg\+xml)/.test(file.type) ||
    /\.(png|jpe?g|svg)$/i.test(file.name)
  )
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

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong in Cutter Montage.'
}
