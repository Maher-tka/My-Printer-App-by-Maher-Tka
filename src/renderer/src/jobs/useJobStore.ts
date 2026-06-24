import { useCallback, useState } from 'react'
import { readStoredJobs, upsertStoredJob, writeStoredJobs } from './jobStorage'
import type { PrinterJob } from './jobTypes'

export function useJobStore(): {
  jobs: PrinterJob[]
  saveJob: (job: PrinterJob) => void
  deleteJob: (jobId: string) => void
  refreshJobs: () => void
} {
  const [jobs, setJobs] = useState<PrinterJob[]>(readStoredJobs)

  const saveJob = useCallback((job: PrinterJob): void => {
    setJobs(upsertStoredJob({ ...job, updatedAt: new Date().toISOString() }))
  }, [])

  const deleteJob = useCallback((jobId: string): void => {
    setJobs((current) => {
      const next = current.filter((job) => job.id !== jobId)
      writeStoredJobs(next)
      return next
    })
  }, [])

  const refreshJobs = useCallback((): void => setJobs(readStoredJobs()), [])

  return { jobs, saveJob, deleteJob, refreshJobs }
}
