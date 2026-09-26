import type { PrinterJob, PrinterJobTool, PrintHistoryEntry } from './jobTypes'

export function createPrintedJob(input: {
  existingJob?: PrinterJob
  projectId?: string
  tool: PrinterJobTool
  jobName: string
  pdfName: string
  pdfPath?: string
  printerName?: string
  localProjectPath?: string | null
}): PrinterJob {
  const now = new Date().toISOString()
  const printEntry: PrintHistoryEntry = {
    id: `print-${Date.now()}`,
    module: input.tool,
    jobName: input.jobName,
    printerName: input.printerName,
    printedAt: now,
    pdfName: input.pdfName,
    status: 'sent-to-printer'
  }
  const existingJob = input.existingJob

  if (existingJob) {
    return {
      ...existingJob,
      status: 'printed',
      updatedAt: now,
      localProjectPath: existingJob.localProjectPath ?? input.localProjectPath ?? undefined,
      exportPaths: input.pdfPath
        ? addUnique(existingJob.exportPaths, input.pdfPath)
        : existingJob.exportPaths,
      printHistory: [printEntry, ...(existingJob.printHistory ?? [])]
    }
  }

  return {
    id: input.projectId ?? `printed-${input.tool}-${Date.now()}`,
    tool: input.tool,
    customerName: '',
    phoneNumber: '',
    jobTitle: input.jobName,
    createdAt: now,
    updatedAt: now,
    status: 'printed',
    notes: 'Printed directly from My Printer App.',
    localProjectPath: input.localProjectPath ?? undefined,
    exportPaths: input.pdfPath ? [input.pdfPath] : [],
    printHistory: [printEntry],
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

function addUnique(items: string[], item: string): string[] {
  return items.includes(item) ? items : [item, ...items]
}
