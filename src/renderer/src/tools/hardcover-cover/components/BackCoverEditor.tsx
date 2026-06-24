import type { BackCoverContent } from '../types'
import { EditorSection, TextAreaField, TextField } from './FrontCoverEditor'

export function BackCoverEditor({
  value,
  onChange
}: {
  value: BackCoverContent
  onChange: (patch: Partial<BackCoverContent>) => void
}): JSX.Element {
  return (
    <EditorSection title="Back cover">
      <TextAreaField
        label="Optional summary"
        value={value.summary}
        onChange={(summary) => onChange({ summary })}
      />
      <TextField
        label="Contact / school info"
        value={value.contactInfo}
        onChange={(contactInfo) => onChange({ contactInfo })}
      />
      <TextField
        label="QR code text or URL"
        value={value.qrText}
        onChange={(qrText) => onChange({ qrText })}
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={value.plain}
          onChange={(event) => onChange({ plain: event.target.checked })}
        />
        Plain back cover
      </label>
    </EditorSection>
  )
}
