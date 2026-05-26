export type JobStatus = 'Completed' | 'In Progress' | 'Failed'

export interface RecentJob {
  id: string
  jobName: string
  tool: string
  date: string
  status: JobStatus
}
