import { useLanguage } from '@/i18n/useLanguage'
import type { BackCoverContent } from '../types'
import { EditorSection, TextAreaField, TextField } from './FrontCoverEditor'

export function BackCoverEditor({
  value,
  onChange
}: {
  value: BackCoverContent
  onChange: (patch: Partial<BackCoverContent>) => void
}): JSX.Element {
  const { t } = useLanguage()

  return (
    <EditorSection title={t('Back cover')}>
      <TextAreaField
        label={t('Optional summary')}
        value={value.summary}
        onChange={(summary) => onChange({ summary })}
      />
      <TextField
        label={t('Contact / school info')}
        value={value.contactInfo}
        onChange={(contactInfo) => onChange({ contactInfo })}
      />
      <TextField
        label={t('QR code text or URL')}
        value={value.qrText}
        onChange={(qrText) => onChange({ qrText })}
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={value.plain}
          onChange={(event) => onChange({ plain: event.target.checked })}
        />
        {t('Plain back cover')}
      </label>
    </EditorSection>
  )
}
