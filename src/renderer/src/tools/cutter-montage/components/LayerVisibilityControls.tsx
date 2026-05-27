import type { CutterLayerVisibility, CutterSheetSettings } from '../types'

interface LayerVisibilityControlsProps {
  layers: CutterLayerVisibility
  settings: CutterSheetSettings
  onLayerChange: (layers: Partial<CutterLayerVisibility>) => void
  onSettingsChange: (settings: Partial<CutterSheetSettings>) => void
}

export function LayerVisibilityControls({
  layers,
  settings,
  onLayerChange,
  onSettingsChange
}: LayerVisibilityControlsProps): JSX.Element {
  return (
    <section className="rounded-lg border bg-card p-4">
      <h3 className="font-semibold">View Layers</h3>
      <div className="mt-3 flex flex-col gap-2 text-sm">
        <LayerToggle label="Artwork" checked={layers.artwork} onChange={(artwork) => onLayerChange({ artwork })} />
        <LayerToggle label="Cutlines" checked={layers.cutlines} onChange={(cutlines) => onLayerChange({ cutlines })} />
        <LayerToggle label="Grid" checked={settings.showGrid} onChange={(showGrid) => onSettingsChange({ showGrid })} />
        <LayerToggle label="Snap to grid" checked={settings.snapToGrid} onChange={(snapToGrid) => onSettingsChange({ snapToGrid })} />
      </div>
    </section>
  )
}

function LayerToggle({
  label,
  checked,
  onChange
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}): JSX.Element {
  return (
    <label className="flex items-center justify-between gap-3 rounded-md border bg-muted/20 px-3 py-2">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  )
}
