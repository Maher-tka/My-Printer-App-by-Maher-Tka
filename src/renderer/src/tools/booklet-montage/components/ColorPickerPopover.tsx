import { Pipette, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  cmykToRgb,
  hexToRgb,
  normalizeHex,
  rgbToCmyk,
  rgbToHex,
  type CmykColor,
  type RgbColor
} from '../lib/colorUtils'
import { emptySheetSwatches } from '../lib/sheetLayoutState'

declare global {
  interface Window {
    EyeDropper?: new () => {
      open: () => Promise<{ sRGBHex: string }>
    }
  }
}

interface ColorPickerPopoverProps {
  colorHex: string
  recentColors: string[]
  title?: string
  description?: string
  placement?: 'floating' | 'static'
  onChange: (colorHex: string) => void
  onClose: () => void
}

export function ColorPickerPopover({
  colorHex,
  recentColors,
  title = 'Sheet color',
  description = 'RGB display, CMYK approximate',
  placement = 'floating',
  onChange,
  onClose
}: ColorPickerPopoverProps): JSX.Element {
  const normalizedColor = normalizeHex(colorHex) ?? '#FFFFFF'
  const rgb = hexToRgb(normalizedColor) ?? { r: 255, g: 255, b: 255 }
  const cmyk = rgbToCmyk(rgb)
  const [hexDraft, setHexDraft] = useState(normalizedColor)
  const [eyedropperMessage, setEyedropperMessage] = useState<string | null>(null)
  const eyedropperSupported = typeof window !== 'undefined' && Boolean(window.EyeDropper)

  useEffect(() => {
    setHexDraft(normalizedColor)
  }, [normalizedColor])

  return (
    <div
      data-no-drag="true"
      className={`z-40 w-[330px] max-w-[calc(100vw-2rem)] rounded-lg border bg-white p-4 text-slate-950 shadow-2xl ${
        placement === 'floating' ? 'absolute right-3 top-12' : 'relative'
      }`}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
        <Button type="button" size="icon" variant="ghost" title="Close color picker" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-3">
        <label
          className="grid h-24 cursor-pointer place-items-center rounded-md border shadow-inner"
          style={{ backgroundColor: normalizedColor }}
          title="Pick visual color"
        >
          <input
            className="h-full w-full cursor-pointer opacity-0"
            type="color"
            value={normalizedColor}
            onChange={(event) => commitColor(event.target.value, onChange)}
          />
        </label>

        <div className="grid gap-2">
          <label className="grid gap-1 text-xs font-medium text-slate-600">
            HEX
            <input
              className="h-9 rounded-md border px-2 text-sm text-slate-950"
              value={hexDraft}
              onChange={(event) => setHexDraft(event.target.value)}
              onBlur={() => commitColor(hexDraft, onChange)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  commitColor(hexDraft, onChange)
                }
              }}
            />
          </label>
          <Button
            type="button"
            variant="outline"
            className="justify-start"
            onClick={async () => {
              if (!eyedropperSupported || !window.EyeDropper) {
                setEyedropperMessage('Eyedropper not supported on this system')
                return
              }

              try {
                const result = await new window.EyeDropper().open()
                commitColor(result.sRGBHex, onChange)
                setEyedropperMessage(null)
              } catch {
                setEyedropperMessage('Eyedropper canceled')
              }
            }}
          >
            <Pipette data-icon="inline-start" />
            Eyedropper
          </Button>
          {!eyedropperSupported && (
            <p className="text-xs text-slate-500">Eyedropper not supported on this system</p>
          )}
          {eyedropperMessage && <p className="text-xs text-slate-500">{eyedropperMessage}</p>}
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        <RgbInputs rgb={rgb} onChange={(nextRgb) => commitColor(rgbToHex(nextRgb), onChange)} />
        <CmykInputs
          cmyk={cmyk}
          onChange={(nextCmyk) => commitColor(rgbToHex(cmykToRgb(nextCmyk)), onChange)}
        />
      </div>

      <SwatchRow title="Swatches" colors={emptySheetSwatches} onChange={onChange} />
      {recentColors.length > 0 && (
        <SwatchRow title="Recent" colors={recentColors} onChange={onChange} />
      )}
    </div>
  )
}

function RgbInputs({
  rgb,
  onChange
}: {
  rgb: RgbColor
  onChange: (rgb: RgbColor) => void
}): JSX.Element {
  return (
    <div className="grid grid-cols-3 gap-2">
      {(['r', 'g', 'b'] as const).map((channel) => (
        <NumberField
          key={channel}
          label={channel.toUpperCase()}
          value={rgb[channel]}
          max={255}
          onChange={(value) => onChange({ ...rgb, [channel]: value })}
        />
      ))}
    </div>
  )
}

function CmykInputs({
  cmyk,
  onChange
}: {
  cmyk: CmykColor
  onChange: (cmyk: CmykColor) => void
}): JSX.Element {
  return (
    <div className="grid grid-cols-4 gap-2">
      {(['c', 'm', 'y', 'k'] as const).map((channel) => (
        <NumberField
          key={channel}
          label={`${channel.toUpperCase()}%`}
          value={cmyk[channel]}
          max={100}
          onChange={(value) => onChange({ ...cmyk, [channel]: value })}
        />
      ))}
    </div>
  )
}

function NumberField({
  label,
  value,
  max,
  onChange
}: {
  label: string
  value: number
  max: number
  onChange: (value: number) => void
}): JSX.Element {
  return (
    <label className="grid gap-1 text-xs font-medium text-slate-600">
      {label}
      <input
        className="h-8 rounded-md border px-2 text-sm text-slate-950"
        type="number"
        min={0}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

function SwatchRow({
  title,
  colors,
  onChange
}: {
  title: string
  colors: string[]
  onChange: (colorHex: string) => void
}): JSX.Element {
  return (
    <div className="mt-4">
      <p className="mb-2 text-xs font-semibold uppercase text-slate-500">{title}</p>
      <div className="flex flex-wrap gap-2">
        {colors.map((color) => (
          <button
            key={color}
            type="button"
            className="h-7 w-7 rounded border shadow-inner"
            style={{ backgroundColor: color }}
            title={color}
            onClick={() => commitColor(color, onChange)}
          />
        ))}
      </div>
    </div>
  )
}

function commitColor(colorHex: string, onChange: (colorHex: string) => void): void {
  const normalized = normalizeHex(colorHex)

  if (normalized) {
    onChange(normalized)
  }
}
