import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { SpineContent, SpineTextLayout } from '../types'
import { EditorSection, TextField } from './FrontCoverEditor'

export function SpineEditor({
  value,
  layout,
  onChange,
  onUseFrontTitle
}: {
  value: SpineContent
  layout: SpineTextLayout
  onChange: (patch: Partial<SpineContent>) => void
  onUseFrontTitle: () => void
}): JSX.Element {
  return (
    <EditorSection title="Spine editor">
      <TextField
        label="Academic year - top of spine"
        value={value.year}
        onChange={(year) => onChange({ year })}
      />
      <TextField
        label="Title / mémoire title - middle of spine"
        value={value.shortTitle}
        onChange={(shortTitle) => onChange({ shortTitle })}
      />
      <TextField
        label="Student name - bottom of spine"
        value={value.studentName}
        onChange={(studentName) => onChange({ studentName })}
      />
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        Text direction
        <select
          className="rounded-md border bg-background px-3 py-2 text-sm"
          value={value.direction}
          onChange={(event) =>
            onChange({ direction: event.target.value as SpineContent['direction'] })
          }
        >
          <option value="top-to-bottom">Top to bottom</option>
          <option value="bottom-to-top">Bottom to top</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={value.autoFit}
          onChange={(event) => onChange({ autoFit: event.target.checked })}
        />
        Auto-fit text to spine
      </label>
      {!value.autoFit && (
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Font size
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
        <Badge variant="secondary">{layout.fontSizePt} pt</Badge>
      </div>
      {layout.warning && <p className="text-xs text-warning-foreground">{layout.warning}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onUseFrontTitle}>
          Use main title
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
          Rotate direction
        </Button>
      </div>
    </EditorSection>
  )
}
