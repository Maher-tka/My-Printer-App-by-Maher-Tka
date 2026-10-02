import { useCallback, useEffect, useState } from 'react'
import type { RecentJob } from '@/types/projects'

export function useDashboardProjects(): {
  projects: RecentJob[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
} {
  const [projects, setProjects] = useState<RecentJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const result = await window.printerApp?.listRecentProjects()
      if (result?.ok) setProjects(result.jobs ?? [])
      else if (result && !result.ok)
        setError(result.error ?? 'Recent projects could not be loaded.')
    } catch {
      setError('Recent projects could not be loaded. Please refresh.')
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    void refresh()
  }, [refresh])
  return { projects, loading, error, refresh }
}
