import { useLanguage } from '@/i18n/useLanguage'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import type { CardPrintSide } from '../lib/printSetup'
import { useEffect, useId, useRef, useState } from 'react'
import {
  compareDriverPresets,
  type PrinterPreferencesApi,
  type PrinterSettingsSnapshot
} from '../../../../../shared/printer-preferences'
import {
  assignCardPrinterPreset,
  cardUsesDriverPreset,
  getCardPrinterPresetError,
  getCardPrinterPresetId,
  INHERIT_CARD_PRINTER
} from '../lib/printerPreset'

const inputClass =
  'h-[var(--ui-control-standard)] w-full min-w-0 rounded-[var(--ui-radius-md)] border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function CardPrintDialog({
  open,
  onOpenChange,
  hasFront,
  hasBack,
  side,
  copies,
  error,
  onSideChange,
  onCopiesChange,
  onContinue,
  api = window.printerApp?.printers
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  hasFront: boolean
  hasBack: boolean
  side: CardPrintSide
  copies: number
  error: string | null
  onSideChange: (side: CardPrintSide) => void
  onCopiesChange: (copies: number) => void
  onContinue: () => void
  api?: PrinterPreferencesApi
}): JSX.Element {
  const { t } = useLanguage()
  const errorId = useId()
  const [snapshot, setSnapshot] = useState<PrinterSettingsSnapshot | null>(null)
  const [presetId, setPresetId] = useState(INHERIT_CARD_PRINTER)
  const [pending, setPending] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const generation = useRef(0)
  const saving = useRef<Promise<void> | null>(null)
  useEffect(() => {
    const current = ++generation.current
    setLoaded(false)
    if (!open || !api) return
    setPending(true)
    setFailure(null)
    void (async () => {
      try {
        await saving.current
        const next = await api.get()
        if (current !== generation.current) return
        setSnapshot(next)
        setPresetId(getCardPrinterPresetId(next))
        setLoaded(true)
      } catch {
        if (current === generation.current)
          setFailure('Could not load printer presets. Close and reopen this dialog to retry.')
      } finally {
        if (current === generation.current) setPending(false)
      }
    })()
    return () => {
      generation.current++
    }
  }, [api, open])
  const choosePreset = (id: string): void => {
    if (!api || pending) return
    const current = ++generation.current
    setPending(true)
    setFailure(null)
    const operation = (async () => {
      try {
        // Read again so unrelated printing preferences changed elsewhere survive.
        const latest = await api.get()
        const next = await api.save(assignCardPrinterPreset(latest, id))
        if (current !== generation.current) return
        setSnapshot(next)
        setPresetId(getCardPrinterPresetId(next))
      } catch (cause) {
        if (current === generation.current)
          setFailure(
            cause instanceof Error
              ? cause.message
              : 'Could not save printer preset. Choose it again to retry.'
          )
      } finally {
        if (current === generation.current) setPending(false)
      }
    })()
    saving.current = operation
  }
  const presetError = failure ?? (snapshot ? getCardPrinterPresetError(snapshot, presetId) : null)
  const selectedPreset = snapshot?.presets.find((preset) => preset.id === presetId)
  const unavailablePreset =
    presetId !== INHERIT_CARD_PRINTER && !snapshot?.presets.some((preset) => preset.id === presetId)
  const blocked = Boolean(error || presetError || (api && (!loaded || pending)))

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{t('Print cards')}</AlertDialogTitle>
          <AlertDialogDescription className="sr-only">
            {t(
              api
                ? 'Choose a printer preset, sides and copies.'
                : 'Choose sides and copies before opening printer settings.'
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {api && (
          <label className="grid min-w-0 gap-2 text-sm font-medium">
            {t('Default printer preset')}
            <select
              className={inputClass}
              value={presetId}
              disabled={pending || !loaded}
              aria-busy={pending}
              aria-invalid={Boolean(presetError)}
              aria-describedby={presetError ? errorId : undefined}
              onChange={(event) => choosePreset(event.target.value)}
            >
              <option value={INHERIT_CARD_PRINTER}>
                {t(pending ? 'Loading printers…' : 'Use app printing settings')}
              </option>
              {unavailablePreset && (
                <option value={presetId} disabled>
                  {t('Unavailable saved preset')}
                </option>
              )}
              {Array.from(
                new Set(
                  [...(snapshot?.presets ?? [])]
                    .sort(compareDriverPresets)
                    .map((preset) => preset.printer)
                )
              ).map((printer) => (
                <optgroup key={printer} label={printer}>
                  {[...(snapshot?.presets ?? [])]
                    .filter((preset) => preset.printer === printer)
                    .sort(compareDriverPresets)
                    .map((preset) => (
                      <option
                        key={preset.id}
                        value={preset.id}
                        disabled={Boolean(
                          snapshot && getCardPrinterPresetError(snapshot, preset.id)
                        )}
                      >
                        {preset.name} · {preset.printer} · {preset.paper} ·{' '}
                        {t(preset.color ? 'Color' : 'Black & white')} · {preset.tray}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
            {selectedPreset ? (
              <span className="break-words text-xs font-normal text-muted-foreground">
                <bdi dir="auto">{selectedPreset.name}</bdi> ·{' '}
                <bdi dir="auto">{selectedPreset.printer}</bdi> · {selectedPreset.paper} ·{' '}
                {t(selectedPreset.color ? 'Color' : 'Black & white')} · {t('Tray')}:{' '}
                <bdi dir="auto">{selectedPreset.tray}</bdi>
              </span>
            ) : null}
          </label>
        )}
        <label className="grid gap-2 text-sm font-medium">
          {t('Side')}
          <select
            className={inputClass}
            value={side}
            onChange={(event) => onSideChange(event.target.value as CardPrintSide)}
          >
            <option value="front" disabled={!hasFront}>
              {t('Front only')}
            </option>
            <option value="back" disabled={!hasBack}>
              {t('Back only')}
            </option>
            <option value="both" disabled={!hasFront || !hasBack}>
              {t('Both sides')}
            </option>
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium">
          {t('Copies')}
          <input
            className={inputClass}
            type="number"
            min={1}
            max={999}
            step={1}
            value={Number.isFinite(copies) ? copies : ''}
            onChange={(event) =>
              onCopiesChange(event.target.value === '' ? NaN : Number(event.target.value))
            }
          />
        </label>
        {(error || presetError) && (
          <p id={errorId} role="alert" className="text-sm text-destructive">
            {t(error || presetError || '')}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
          <Button disabled={blocked} aria-busy={pending} onClick={onContinue}>
            {t(snapshot && cardUsesDriverPreset(snapshot) ? 'Print' : 'Printer settings')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
