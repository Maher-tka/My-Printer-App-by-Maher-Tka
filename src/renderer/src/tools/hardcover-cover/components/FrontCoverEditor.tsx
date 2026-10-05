import { useLanguage } from '@/i18n/useLanguage'
import type { FrontCoverContent } from '../types'

export function FrontCoverEditor({
  value,
  onChange
}: {
  value: FrontCoverContent
  onChange: (patch: Partial<FrontCoverContent>) => void
}): JSX.Element {
  const { t } = useLanguage()

  return (
    <EditorSection title={t('Front cover')}>
      <TextField
        label={t('Student name')}
        value={value.studentName}
        onChange={(studentName) => onChange({ studentName })}
      />
      <TextAreaField
        label={t('Project / mémoire title')}
        value={value.title}
        onChange={(title) => onChange({ title })}
      />
      <TextField
        label={t('Degree / diploma')}
        value={value.degree}
        onChange={(degree) => onChange({ degree })}
      />
      <TextField
        label={t('University / institute')}
        value={value.university}
        onChange={(university) => onChange({ university })}
      />
      <TextField
        label={t('Department')}
        value={value.department}
        onChange={(department) => onChange({ department })}
      />
      <TextField
        label={t('Supervisor')}
        value={value.supervisor}
        onChange={(supervisor) => onChange({ supervisor })}
      />
      <TextField
        label={t('Academic year')}
        value={value.academicYear}
        onChange={(academicYear) => onChange({ academicYear })}
      />
      <ImageField label={t('Logo')} onChange={(logoDataUrl) => onChange({ logoDataUrl })} />
      <ImageField
        label={t('Background image')}
        onChange={(backgroundDataUrl) => onChange({ backgroundDataUrl })}
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={value.showDecorativeLine}
          onChange={(event) => onChange({ showDecorativeLine: event.target.checked })}
        />
        {t('Decorative line')}
      </label>
    </EditorSection>
  )
}

export function EditorSection({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <section className="rounded-[18px] border border-border/70 bg-card p-4">
      <h3 className="font-semibold">{title}</h3>
      <div className="mt-3 flex flex-col gap-3">{children}</div>
    </section>
  )
}
export function TextField({
  label,
  value,
  onChange
}: {
  label: string
  value: string
  onChange: (value: string) => void
}): JSX.Element {
  const { t } = useLanguage()

  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
      {t(label)}
      <input
        className="h-9 rounded-[14px] border border-input bg-background px-3 text-[13px] text-foreground"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}
export function TextAreaField({
  label,
  value,
  onChange
}: {
  label: string
  value: string
  onChange: (value: string) => void
}): JSX.Element {
  const { t } = useLanguage()

  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
      {t(label)}
      <textarea
        className="min-h-20 rounded-[14px] border border-input bg-background px-3 text-[13px] text-foreground"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}
function ImageField({
  label,
  onChange
}: {
  label: string
  onChange: (dataUrl: string | undefined) => void
}): JSX.Element {
  const { t } = useLanguage()

  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
      {t(label)}
      <input
        className="text-xs"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(event) => void readImage(event.target.files?.[0]).then(onChange)}
      />
    </label>
  )
}
async function readImage(file: File | undefined): Promise<string | undefined> {
  if (!file) return undefined
  if (file.size > 4_000_000) throw new Error('Use an image smaller than 4 MB.')
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
