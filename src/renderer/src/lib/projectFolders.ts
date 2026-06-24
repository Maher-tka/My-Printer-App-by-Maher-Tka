import { safeFileName } from './fileNaming'

export interface ProjectFolderPlan {
  root: string
  source: string
  project: string
  export: string
  preview: string
  invoice: string
}

export function createProjectFolderPlan(
  date: Date,
  customerName: string,
  jobTitle: string
): ProjectFolderPlan {
  const day = date.toISOString().slice(0, 10)
  const root = `${day}_${safeFileName(customerName, 'Customer')}_${safeFileName(jobTitle, 'Job')}`
  return {
    root,
    source: `${root}/source`,
    project: `${root}/project`,
    export: `${root}/export`,
    preview: `${root}/preview`,
    invoice: `${root}/invoice`
  }
}
