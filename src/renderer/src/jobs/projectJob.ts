import type { PrinterJob, PrinterJobTool } from './jobTypes'

export function createProjectPrinterJob(input: {
  id: string
  tool: PrinterJobTool
  title: string
  filePath: string
  createdAt: string
}): PrinterJob {
  return {
    id: input.id,
    tool: input.tool,
    customerName: '',
    phoneNumber: '',
    jobTitle: input.title,
    createdAt: input.createdAt,
    updatedAt: new Date().toISOString(),
    status: 'draft',
    notes: 'Created from a saved project. Add customer, deadline, and quote in Shop Jobs.',
    localProjectPath: input.filePath,
    exportPaths: [],
    quote: {
      materialCost: 0,
      printCost: 0,
      finishingCost: 0,
      designCost: 0,
      cuttingCost: 0,
      bindingCost: 0,
      designFee: 0,
      quantity: 1,
      discount: 0,
      finalPrice: 0,
      depositPaid: 0,
      remainingAmount: 0
    }
  }
}
