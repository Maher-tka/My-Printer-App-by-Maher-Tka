import { Copy, Download, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CoverTemplate } from '../types'
import { DEFAULT_COVER_TEMPLATES } from '../lib/coverTemplates'

export function CoverTemplatePanel({
  template,
  customTemplates,
  onChoose,
  onDuplicate,
  onReset,
  onChange,
  onSave
}: {
  template: CoverTemplate
  customTemplates: CoverTemplate[]
  onChoose: (id: string) => void
  onDuplicate: () => void
  onReset: () => void
  onChange: (patch: Partial<CoverTemplate>) => void
  onSave: () => void
}): JSX.Element {
  const templates = [...DEFAULT_COVER_TEMPLATES, ...customTemplates]
  return (
    <section className="rounded-lg border bg-card p-4">
      <h3 className="font-semibold">Cover templates</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Eight local-first styles plus your saved variants.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {templates.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`rounded-md border p-2 text-left text-xs ${item.id === template.id ? 'ring-2 ring-primary' : ''}`}
            onClick={() => onChoose(item.id)}
          >
            <span
              className="mb-2 block h-9 rounded"
              style={{
                background: `linear-gradient(135deg, ${item.background}, ${item.backgroundAccent})`
              }}
            />
            <span className="font-medium">{item.name}</span>
          </button>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs">
          Background
          <input
            type="color"
            value={template.background}
            onChange={(event) => onChange({ background: event.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          Accent
          <input
            type="color"
            value={template.backgroundAccent}
            onChange={(event) => onChange({ backgroundAccent: event.target.value })}
          />
        </label>
      </div>
      <div className="mt-3 flex gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onDuplicate}>
          <Copy />
          Duplicate
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onReset}>
          <RotateCcw />
          Reset
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onSave}>
          <Download />
          Save template file
        </Button>
      </div>
    </section>
  )
}
