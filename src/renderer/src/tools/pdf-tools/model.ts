import {
  Combine,
  Scissors,
  Minimize2,
  FileText,
  Presentation,
  Sheet,
  FilePenLine,
  Images,
  FileImage,
  type LucideIcon
} from 'lucide-react'
import { getPdfMemoryPolicy } from './memoryPolicy'

export type PdfToolId =
  | 'merge'
  | 'split'
  | 'compress'
  | 'pdf-word'
  | 'pdf-powerpoint'
  | 'pdf-excel'
  | 'word-pdf'
  | 'powerpoint-pdf'
  | 'excel-pdf'
  | 'edit'
  | 'pdf-jpg'
  | 'jpg-pdf'
export type PdfCategory =
  | 'All tools'
  | 'Organize'
  | 'Optimize'
  | 'Convert from PDF'
  | 'Convert to PDF'
  | 'Edit'
export interface PdfTool {
  id: PdfToolId
  title: string
  category: PdfCategory
  icon: LucideIcon
  accept: string
  multiple?: boolean
  action: string
  extension: string
}
export const PDF_CATEGORIES: PdfCategory[] = [
  'All tools',
  'Organize',
  'Optimize',
  'Convert from PDF',
  'Convert to PDF',
  'Edit'
]
export const PDF_TOOLS: PdfTool[] = [
  {
    id: 'merge',
    title: 'Merge PDF',
    category: 'Organize',
    icon: Combine,
    accept: '.pdf',
    multiple: true,
    action: 'Merge PDF',
    extension: 'pdf'
  },
  {
    id: 'split',
    title: 'Split PDF',
    category: 'Organize',
    icon: Scissors,
    accept: '.pdf',
    action: 'Split PDF',
    extension: 'zip'
  },
  {
    id: 'compress',
    title: 'Compress PDF',
    category: 'Optimize',
    icon: Minimize2,
    accept: '.pdf',
    action: 'Compress PDF',
    extension: 'pdf'
  },
  {
    id: 'pdf-word',
    title: 'PDF to Word',
    category: 'Convert from PDF',
    icon: FileText,
    accept: '.pdf',
    action: 'Convert to Word',
    extension: 'docx'
  },
  {
    id: 'pdf-powerpoint',
    title: 'PDF to PowerPoint',
    category: 'Convert from PDF',
    icon: Presentation,
    accept: '.pdf',
    action: 'Convert to PowerPoint',
    extension: 'pptx'
  },
  {
    id: 'pdf-excel',
    title: 'PDF to Excel',
    category: 'Convert from PDF',
    icon: Sheet,
    accept: '.pdf',
    action: 'Convert to Excel',
    extension: 'xlsx'
  },
  {
    id: 'word-pdf',
    title: 'Word to PDF',
    category: 'Convert to PDF',
    icon: FileText,
    accept: '.doc,.docx',
    action: 'Convert to PDF',
    extension: 'pdf'
  },
  {
    id: 'powerpoint-pdf',
    title: 'PowerPoint to PDF',
    category: 'Convert to PDF',
    icon: Presentation,
    accept: '.ppt,.pptx',
    action: 'Convert to PDF',
    extension: 'pdf'
  },
  {
    id: 'excel-pdf',
    title: 'Excel to PDF',
    category: 'Convert to PDF',
    icon: Sheet,
    accept: '.xls,.xlsx',
    action: 'Convert to PDF',
    extension: 'pdf'
  },
  {
    id: 'edit',
    title: 'Edit PDF',
    category: 'Edit',
    icon: FilePenLine,
    accept: '.pdf',
    action: 'Export PDF',
    extension: 'pdf'
  },
  {
    id: 'pdf-jpg',
    title: 'PDF to JPG',
    category: 'Convert from PDF',
    icon: Images,
    accept: '.pdf',
    action: 'Convert to JPG',
    extension: 'zip'
  },
  {
    id: 'jpg-pdf',
    title: 'JPG to PDF',
    category: 'Convert to PDF',
    icon: FileImage,
    accept: '.jpg,.jpeg,.png',
    multiple: true,
    action: 'Convert to PDF',
    extension: 'pdf'
  }
]

export interface PdfInput {
  id: string
  name: string
  bytes: Uint8Array
  pages?: number
  thumbnail?: string
}
export interface PdfOutput {
  name: string
  bytes: Uint8Array
  mime: string
}
export interface PdfOptions {
  ranges: string
  splitMode: 'ranges' | 'every'
  compression: 'lossless' | 'balanced' | 'small'
  dpi: number
  officeMode: 'appearance' | 'text'
  paper: 'A4' | 'Letter' | 'Fit'
  orientation: 'portrait' | 'landscape'
  margin: number
  imageFit: 'contain' | 'cover'
}
export const DEFAULT_PDF_OPTIONS: PdfOptions = {
  ranges: '',
  splitMode: 'ranges',
  compression: 'lossless',
  dpi: 150,
  officeMode: 'appearance',
  paper: 'A4',
  orientation: 'portrait',
  margin: 10,
  imageFit: 'contain'
}
export const OFFICE_PDF_KIND = {
  'word-pdf': 'word',
  'powerpoint-pdf': 'powerpoint',
  'excel-pdf': 'excel'
} as const

export function fileStem(name: string): string {
  return (
    name
      .replace(/\.[^.]+$/, '')
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
      .slice(0, 100) || 'document'
  )
}
export function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** Each comma-separated group becomes one output. Repeated pages are intentional. */
export function parsePageGroups(value: string, count: number): number[][] {
  if (!Number.isInteger(count) || count < 1) throw new Error('The PDF has no pages.')
  if (!value.trim()) return [Array.from({ length: count }, (_, index) => index)]
  return value.split(',').map((part) => {
    const match = /^\s*(\d+)\s*(?:-\s*(\d+)\s*)?$/.exec(part)
    if (!match) throw new Error('Use page numbers or ranges, for example 1-3, 5, 7-9.')
    const first = Number(match[1]),
      last = Number(match[2] ?? match[1])
    if (first < 1 || last < first || last > count)
      throw new Error('A page range is outside this document or in reverse order.')
    return Array.from({ length: last - first + 1 }, (_, index) => first - 1 + index)
  })
}

export function validatePdfFiles(
  tool: PdfTool,
  files: Array<{ name: string; size: number }>,
  existingBytes = 0
): void {
  if (!tool.multiple && files.length !== 1) throw new Error('Choose one file for this tool.')
  const extensions = tool.accept.split(',')
  if (
    !files.length ||
    files.some(
      (file) => !extensions.some((extension) => file.name.toLowerCase().endsWith(extension))
    )
  )
    throw new Error('This file type is not supported by the selected tool.')
  if (files.some((file) => !file.size)) throw new Error('The selected file is empty.')
  if (
    existingBytes + files.reduce((sum, file) => sum + file.size, 0) >
    getPdfMemoryPolicy().maxInputBytes
  )
    throw new Error(
      'These files exceed the current memory limit. Close other apps or import fewer files.'
    )
}
