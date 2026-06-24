import { Plus, Trash2, Upload } from 'lucide-react'
import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import type { BatchStudent } from '../types'

export function BatchStudentsPanel({
  students,
  progress,
  onAdd,
  onChange,
  onRemove,
  onImportCsv,
  onPreview
}: {
  students: BatchStudent[]
  progress: string | null
  onAdd: () => void
  onChange: (id: string, patch: Partial<BatchStudent>) => void
  onRemove: (id: string) => void
  onImportCsv: (csv: string) => void
  onPreview: (student: BatchStudent) => void
}): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Batch students</h3>
          <p className="text-sm text-muted-foreground">
            CSV columns: studentName,title,year,department,supervisor,spineTitle
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => inputRef.current?.click()}
          >
            <Upload />
            Import CSV
          </Button>
          <Button type="button" size="sm" onClick={onAdd}>
            <Plus />
            Add student
          </Button>
        </div>
      </div>
      {progress && (
        <div className="mt-3 rounded-md bg-primary/10 px-3 py-2 text-sm font-medium">
          {progress}
        </div>
      )}
      <div className="mt-3 flex max-h-96 flex-col gap-3 overflow-auto">
        {students.length === 0 ? (
          <div className="rounded-md border border-dashed p-5 text-center text-sm text-muted-foreground">
            Add students manually or import a CSV file.
          </div>
        ) : (
          students.map((student, index) => (
            <div
              key={student.id}
              className="grid grid-cols-1 gap-2 rounded-md border p-3 md:grid-cols-3"
            >
              <input
                className="rounded border bg-background px-2 py-1.5 text-sm"
                placeholder="Student name"
                value={student.studentName}
                onChange={(event) => onChange(student.id, { studentName: event.target.value })}
              />
              <input
                className="rounded border bg-background px-2 py-1.5 text-sm md:col-span-2"
                placeholder="Title"
                value={student.title}
                onChange={(event) => onChange(student.id, { title: event.target.value })}
              />
              <input
                className="rounded border bg-background px-2 py-1.5 text-sm"
                placeholder="Year"
                value={student.year}
                onChange={(event) => onChange(student.id, { year: event.target.value })}
              />
              <input
                className="rounded border bg-background px-2 py-1.5 text-sm"
                placeholder="Department"
                value={student.department}
                onChange={(event) => onChange(student.id, { department: event.target.value })}
              />
              <input
                className="rounded border bg-background px-2 py-1.5 text-sm"
                placeholder="Spine short title"
                value={student.spineTitle}
                onChange={(event) => onChange(student.id, { spineTitle: event.target.value })}
              />
              <div className="flex gap-2 md:col-span-3">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onPreview(student)}
                >
                  Preview {index + 1}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => onRemove(student.id)}
                >
                  <Trash2 />
                  Remove
                </Button>
              </div>
              {(!student.studentName || !student.title) && (
                <p className="text-xs text-destructive md:col-span-3">
                  Student name and title are required before batch export.
                </p>
              )}
            </div>
          ))
        )}
      </div>
      <input
        ref={inputRef}
        className="hidden"
        type="file"
        accept=".csv,text/csv"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void file.text().then(onImportCsv)
          event.currentTarget.value = ''
        }}
      />
    </section>
  )
}
