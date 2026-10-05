import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import type { HardcoverProjectState, SpineContent } from '../types'
import { getSpineDetectionSource } from '../lib/spineDetectionSource'
import {
  applyDetectedSpineText,
  SPINE_TEXT_FIELDS,
  type DetectedSpineText,
  type SpineTextField
} from '../lib/spineDetection'

export function useSpineAutoFill(
  state: HardcoverProjectState,
  setState: Dispatch<SetStateAction<HardcoverProjectState>>,
  defaultYear: string
): {
  detectingSpine: boolean
  spineDetectionMessage: string | null
  detectSpine: () => void
  markSpineEdited: (patch: Partial<SpineContent>) => void
  resetSpineDetection: () => void
} {
  const stateRef = useRef(state)
  stateRef.current = state
  const protectedFields = useRef(new Set<SpineTextField>())
  const previous = useRef<DetectedSpineText>({})
  const operation = useRef<AbortController>()
  const [detectingSpine, setDetecting] = useState(false)
  const [spineDetectionMessage, setMessage] = useState<string | null>(null)
  const key = getSpineDetectionSource(state.sourcePdf)?.key

  const run = useCallback(
    (force: boolean): void => {
      operation.current?.abort()
      const current = stateRef.current
      const input = getSpineDetectionSource(current.sourcePdf)
      if (!input || !current.sourcePdf) {
        setDetecting(false)
        setMessage('Import a front-cover PDF to auto-fill the spine.')
        return
      }
      const controller = new AbortController()
      operation.current = controller
      const baseline = { ...current.content.spine }
      const previousSnapshot = { ...previous.current }
      if (force) protectedFields.current.clear()
      const defaults = {
        studentName: 'Student Name',
        shortTitle: 'Graduation Project Title',
        year: defaultYear
      }
      setDetecting(true)
      setMessage(null)
      // Let the import UI finish before any text parsing/OCR starts.
      void (async () => {
        try {
          const { detectSpineFromPdf } = await import('../lib/detectSpineFromPdf')
          const detected = await detectSpineFromPdf(current.sourcePdf!, controller.signal)
          if (
            controller.signal.aborted ||
            getSpineDetectionSource(stateRef.current.sourcePdf)?.key !== input.key
          )
            return
          const protectedSnapshot = new Set(protectedFields.current)
          setState((latest) => {
            if (
              controller.signal.aborted ||
              getSpineDetectionSource(latest.sourcePdf)?.key !== input.key
            )
              return latest
            const spine = applyDetectedSpineText(
              latest.content.spine,
              baseline,
              detected,
              previousSnapshot,
              defaults,
              protectedSnapshot,
              force
            )
            return { ...latest, content: { ...latest.content, spine } }
          })
          previous.current = detected
          const missing = SPINE_TEXT_FIELDS.filter((field) => !detected[field])
          setMessage(
            missing.length
              ? 'Some cover details could not be identified reliably. Check the spine fields and enter any missing details.'
              : 'Spine details detected. You can edit the fields below.'
          )
        } catch (error) {
          if (!controller.signal.aborted) {
            // A failed read of a different cover must not retain another book's
            // automatically detected details. Manual edits stay protected.
            const protectedSnapshot = new Set(protectedFields.current)
            setState((latest) => {
              if (
                controller.signal.aborted ||
                getSpineDetectionSource(latest.sourcePdf)?.key !== input.key
              )
                return latest
              const spine = applyDetectedSpineText(
                latest.content.spine,
                baseline,
                {},
                previousSnapshot,
                defaults,
                protectedSnapshot
              )
              return { ...latest, content: { ...latest.content, spine } }
            })
            setMessage(
              error instanceof Error
                ? `Auto-fill could not finish: ${error.message}`
                : 'Could not read the front cover. You can enter the spine details manually.'
            )
          }
        } finally {
          if (operation.current === controller) setDetecting(false)
        }
      })()
    },
    [defaultYear, setState]
  )

  useEffect(() => {
    operation.current?.abort()
    setDetecting(false)
    setMessage(null)
    if (!key) return
    const timer = window.setTimeout(() => run(false), 350)
    return () => {
      window.clearTimeout(timer)
      operation.current?.abort()
    }
  }, [key, run])

  const markSpineEdited = useCallback((patch: Partial<SpineContent>): void => {
    for (const field of SPINE_TEXT_FIELDS)
      if (patch[field] !== undefined) protectedFields.current.add(field)
  }, [])
  const resetSpineDetection = useCallback((): void => {
    operation.current?.abort()
    protectedFields.current.clear()
    previous.current = {}
    setDetecting(false)
    setMessage(null)
  }, [])

  return {
    detectingSpine,
    spineDetectionMessage,
    detectSpine: () => run(true),
    markSpineEdited,
    resetSpineDetection
  }
}
