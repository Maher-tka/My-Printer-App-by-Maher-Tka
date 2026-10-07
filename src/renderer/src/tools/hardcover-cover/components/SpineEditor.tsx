import { useLanguage } from '@/i18n/useLanguage'
import { useEffect, useState } from 'react'
import { Loader2, Pipette, ScanText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { SpineContent, SpineTextLayout } from '../types'
import {
  DEFAULT_SPINE_BACKGROUND_COLOR,
  hexToRgbChannels,
  normalizeHexColor,
  parseHexColor,
  rgbChannelsToHex
} from '../lib/spineBackground'
import { EditorSection, TextAreaField, TextField } from './FrontCoverEditor'

export function SpineEditor({
  value,
  layout,
  automaticSpineColor,
  onChange,
  onUseFrontTitle,
  onDetectSpine,
  detectingSpine = false,
  detectionMessage
}: {
  value: SpineContent
  layout: SpineTextLayout
  automaticSpineColor: string
  onChange: (patch: Partial<SpineContent>) => void
  onUseFrontTitle: () => void
  onDetectSpine?: () => void
  detectingSpine?: boolean
  detectionMessage?: string | null
}): JSX.Element {
  const { t } = useLanguage()

  const customMode = value.spineColorMode === 'custom'
  const storedCustomColor = normalizeHexColor(value.spineBackgroundColor, automaticSpineColor)
  const activeColor = customMode
    ? storedCustomColor
    : normalizeHexColor(automaticSpineColor, DEFAULT_SPINE_BACKGROUND_COLOR)
  const largestFontSize = Math.max(
    layout.fontSizePt,
    ...layout.items.map((item) => item.fontSizePt)
  )
  const fontSizeLabel =
    largestFontSize === layout.fontSizePt
      ? `${layout.fontSizePt}`
      : `${layout.fontSizePt}–${largestFontSize}`

  return (
    <>
      <EditorSection title={t('Spine editor')}>
        <TextField
          label={t('Academic year - top of spine')}
          value={value.year}
          onChange={(year) => onChange({ year })}
        />
        <TextAreaField
          label={t('Title / mémoire title - middle of spine')}
          value={value.shortTitle}
          onChange={(shortTitle) => onChange({ shortTitle })}
        />
        <TextField
          label={t('Student name - bottom of spine')}
          value={value.studentName}
          onChange={(studentName) => onChange({ studentName })}
        />
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          {t('Text direction')}
          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={value.direction}
            onChange={(event) =>
              onChange({ direction: event.target.value as SpineContent['direction'] })
            }
          >
            <option value="top-to-bottom">{t('Top to bottom')}</option>
            <option value="bottom-to-top">{t('Bottom to top')}</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={value.autoFit}
            onChange={(event) => onChange({ autoFit: event.target.checked })}
          />
          {t('Auto-fit text to spine')}
        </label>
        {!value.autoFit && (
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            {t('Font size')}
            <input
              className="rounded-md border bg-background px-3 py-2 text-sm"
              type="number"
              min={6}
              max={36}
              value={value.fontSizePt}
              onChange={(event) => onChange({ fontSizePt: Number(event.target.value) })}
            />
          </label>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={layout.fits ? 'success' : 'warning'}>
            {layout.fits ? 'Spine text fits' : 'Needs attention'}
          </Badge>
          <Badge variant="secondary">
            {value.autoFit ? 'Auto size' : 'Manual size'} · {fontSizeLabel} pt
          </Badge>
        </div>
        {layout.warning && <p className="text-xs text-warning-foreground">{layout.warning}</p>}
        <div className="flex flex-wrap gap-2">
          {onDetectSpine && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={detectingSpine}
              onClick={onDetectSpine}
            >
              {detectingSpine ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ScanText className="mr-2 h-4 w-4" />
              )}
              {detectingSpine ? 'Reading front cover…' : 'Auto-fill from front cover'}
            </Button>
          )}
          <Button type="button" size="sm" variant="outline" onClick={onUseFrontTitle}>
            {t('Use main title')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              onChange({
                direction: value.direction === 'bottom-to-top' ? 'top-to-bottom' : 'bottom-to-top'
              })
            }
          >
            {t('Rotate direction')}
          </Button>
        </div>
        {detectionMessage && (
          <p role="status" className="text-xs text-muted-foreground">
            {detectionMessage}
          </p>
        )}
      </EditorSection>
      <SpineBackgroundSection
        activeColor={activeColor}
        automaticSpineColor={automaticSpineColor}
        customMode={customMode}
        storedCustomColor={storedCustomColor}
        onChange={onChange}
      />
    </>
  )
}

function SpineBackgroundSection({
  activeColor,
  automaticSpineColor,
  customMode,
  storedCustomColor,
  onChange
}: {
  activeColor: string
  automaticSpineColor: string
  customMode: boolean
  storedCustomColor: string
  onChange: (patch: Partial<SpineContent>) => void
}): JSX.Element {
  const { t } = useLanguage()

  const [hexDraft, setHexDraft] = useState(activeColor.toUpperCase())
  const [pickMessage, setPickMessage] = useState<string | null>(null)
  const rgb = hexToRgbChannels(activeColor)

  useEffect(() => {
    setHexDraft(activeColor.toUpperCase())
  }, [activeColor])

  const setMode = (mode: SpineContent['spineColorMode']): void => {
    onChange({
      spineColorMode: mode,
      spineBackgroundColor:
        mode === 'custom'
          ? normalizeHexColor(customMode ? storedCustomColor : activeColor, automaticSpineColor)
          : normalizeHexColor(storedCustomColor, DEFAULT_SPINE_BACKGROUND_COLOR)
    })
  }
  const setCustomColor = (color: string): void => {
    onChange({
      spineColorMode: 'custom',
      spineBackgroundColor: normalizeHexColor(color, activeColor)
    })
  }
  const pickFromDesign = async (): Promise<void> => {
    const EyeDropper = getEyeDropper()

    if (!EyeDropper) {
      setPickMessage('Pick from design is unavailable in this app window.')
      return
    }

    try {
      const result = await new EyeDropper().open()
      const pickedColor = normalizeHexColor(result.sRGBHex, activeColor)
      setCustomColor(pickedColor)
      setPickMessage(`Picked ${pickedColor.toUpperCase()}`)
    } catch (error) {
      setPickMessage(isAbortError(error) ? 'Pick canceled.' : 'Could not pick that color.')
    }
  }

  return (
    <EditorSection title={t('Spine background')}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={customMode ? 'secondary' : 'success'}>
          {customMode ? 'Custom color' : 'Automatic matching'}
        </Badge>
        <Badge variant="secondary">
          {customMode ? activeColor.toUpperCase() : automaticSpineColor.toUpperCase()}
        </Badge>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={!customMode}
          onChange={(event) => setMode(event.target.checked ? 'auto' : 'custom')}
        />
        Match cover/background automatically
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={customMode}
          onChange={(event) => setMode(event.target.checked ? 'custom' : 'auto')}
        />
        {t('Use custom spine color')}
      </label>
      <div className="grid grid-cols-1 gap-3 rounded-md border bg-muted/30 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          {t('Color swatch')}
          <input
            className="h-10 w-full rounded-md border bg-background p-1 disabled:opacity-60"
            type="color"
            value={activeColor}
            disabled={!customMode}
            onChange={(event) => setCustomColor(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Hex
          <input
            className="h-9 rounded-[14px] border border-input bg-background px-3 text-[13px] text-foreground disabled:opacity-60"
            value={hexDraft}
            disabled={!customMode}
            onBlur={() => setHexDraft(activeColor.toUpperCase())}
            onChange={(event) => {
              const nextDraft = event.target.value
              const parsed = parseHexColor(nextDraft)
              setHexDraft(nextDraft)
              if (parsed) setCustomColor(parsed)
            }}
          />
        </label>
        <div className="min-w-0 sm:col-span-2">
          <p className="mb-1 text-xs font-medium text-muted-foreground">RGB</p>
          <div className="grid grid-cols-3 gap-2">
            <RgbInput
              label="R"
              value={rgb.red}
              disabled={!customMode}
              onChange={(red) => setCustomColor(rgbChannelsToHex(red, rgb.green, rgb.blue))}
            />
            <RgbInput
              label="G"
              value={rgb.green}
              disabled={!customMode}
              onChange={(green) => setCustomColor(rgbChannelsToHex(rgb.red, green, rgb.blue))}
            />
            <RgbInput
              label="B"
              value={rgb.blue}
              disabled={!customMode}
              onChange={(blue) => setCustomColor(rgbChannelsToHex(rgb.red, rgb.green, blue))}
            />
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!customMode}
          onClick={() => void pickFromDesign()}
        >
          <Pipette />
          {t('Pick from design')}
        </Button>
        {pickMessage && <span className="text-xs text-muted-foreground">{pickMessage}</span>}
      </div>
    </EditorSection>
  )
}

function RgbInput({
  label,
  value,
  disabled,
  onChange
}: {
  label: string
  value: number
  disabled: boolean
  onChange: (value: number) => void
}): JSX.Element {
  const { t } = useLanguage()

  return (
    <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground">
      {t(label)}
      <input
        className="min-w-0 rounded-md border bg-background px-2 py-2 text-sm text-foreground disabled:opacity-60"
        type="number"
        min={0}
        max={255}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

type EyeDropperConstructor = new () => {
  open: () => Promise<{ sRGBHex: string }>
}

function getEyeDropper(): EyeDropperConstructor | undefined {
  return (window as Window & { EyeDropper?: EyeDropperConstructor }).EyeDropper
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}
