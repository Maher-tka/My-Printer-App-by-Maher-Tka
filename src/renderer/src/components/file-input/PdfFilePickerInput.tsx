import { forwardRef } from 'react'

interface PdfFilePickerInputProps {
  onFilesSelected: (files: File[]) => void
}

export const PdfFilePickerInput = forwardRef<
  HTMLInputElement,
  PdfFilePickerInputProps
>(function PdfFilePickerInput({ onFilesSelected }, ref): JSX.Element {
  return (
    <input
      ref={ref}
      className="hidden"
      type="file"
      accept="application/pdf,.pdf"
      multiple
      onChange={(event) => {
        onFilesSelected(Array.from(event.target.files ?? []))
        event.currentTarget.value = ''
      }}
    />
  )
})
