import type { FrontCoverContent } from '../types'

export function FrontCoverEditor({
  value,
  onChange
}: {
  value: FrontCoverContent
  onChange: (patch: Partial<FrontCoverContent>) => void
}): JSX.Element {
  return (
    <EditorSection title="Front cover">
      <TextField
        label="Student name"
        value={value.studentName}
        onChange={(studentName) => onChange({ studentName })}
      />
      <TextAreaField
        label="Project / mémoire title"
        value={value.title}
        onChange={(title) => onChange({ title })}
      />
      <TextField
        label="Degree / diploma"
        value={value.degree}
        onChange={(degree) => onChange({ degree })}
      />
      <TextField
        label="University / institute"
        value={value.university}
        onChange={(university) => onChange({ university })}
      />
      <TextField
        label="Department"
        value={value.department}
        onChange={(department) => onChange({ department })}
      />
      <TextField
        label="Supervisor"
        value={value.supervisor}
        onChange={(supervisor) => onChange({ supervisor })}
      />
      <TextField
        label="Academic year"
        value={value.academicYear}
        onChange={(academicYear) => onChange({ academicYear })}
      />
      <ImageField label="Logo" onChange={(logoDataUrl) => onChange({ logoDataUrl })} />
      <ImageField
        label="Background image"
        onChange={(backgroundDataUrl) => onChange({ backgroundDataUrl })}
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={value.showDecorativeLine}
          onChange={(event) => onChange({ showDecorativeLine: event.target.checked })}
        />
        Decorative line
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
    <section className="rounded-lg border bg-card p-4">
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
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <input
        className="rounded-md border bg-background px-3 py-2 text-sm text-foreground"
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
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <textarea
        className="min-h-20 rounded-md border bg-background px-3 py-2 text-sm text-foreground"
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
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
      {label}
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
