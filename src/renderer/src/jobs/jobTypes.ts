export type PrinterJobTool = 'booklet' | 'cutter' | 'hardcover' | 'sequential'

export interface JobOpenRequest {
  jobId: string
  requestId: number
}

export type PrinterJobStatus =
  | 'draft'
  | 'waiting-customer-approval'
  | 'ready-to-print'
  | 'printing'
  | 'printed'
  | 'delivered'
  | 'canceled'

export interface JobQuote {
  materialCost: number
  printCost: number
  finishingCost: number
  designCost: number
  cuttingCost?: number
  bindingCost?: number
  designFee?: number
  quantity: number
  discount: number
  finalPrice: number
  depositPaid: number
  remainingAmount: number
}

export interface PrinterJob {
  id: string
  customerId?: string
  tool: PrinterJobTool
  customerName: string
  phoneNumber: string
  jobTitle: string
  createdAt: string
  updatedAt: string
  status: PrinterJobStatus
  deadline?: string
  notes: string
  localProjectPath?: string
  exportPaths: string[]
  printHistory?: PrintHistoryEntry[]
  thumbnailPreview?: string
  quote: JobQuote
}

export interface PrintHistoryEntry {
  id: string
  module: PrinterJobTool
  jobName: string
  printerName?: string
  printedAt: string
  pdfName: string
  status: 'printed' | 'sent-to-printer'
}
