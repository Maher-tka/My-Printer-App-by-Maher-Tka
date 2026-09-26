import type { ExportHistoryEntry, ShopBackupRendererData } from './release-types.js'

export function remapRestoredProjectPaths(
  data: ShopBackupRendererData,
  paths: ReadonlyMap<string, string>
): ShopBackupRendererData {
  return {
    ...data,
    jobs: data.jobs.map((job) => {
      if (!job || typeof job !== 'object' || Array.isArray(job)) return job
      const record = job as Record<string, unknown>
      const original = record.localProjectPath
      const restored = typeof original === 'string' ? paths.get(original) : undefined
      return restored ? { ...record, localProjectPath: restored } : job
    })
  }
}

export function mergeRestoredExportHistory(
  restored: ExportHistoryEntry[],
  existing: ExportHistoryEntry[],
  limit: number
): ExportHistoryEntry[] {
  const byId = new Map<string, ExportHistoryEntry>()
  for (const entry of [...restored, ...existing]) byId.set(entry.id, entry)
  return [...byId.values()]
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
    .slice(0, limit)
}
