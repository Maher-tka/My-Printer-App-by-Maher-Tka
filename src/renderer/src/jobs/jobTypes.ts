export type PrinterJobTool = 'booklet' | 'cutter' | 'hardcover'

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
  thumbnailPreview?: string
  quote: JobQuote
}
