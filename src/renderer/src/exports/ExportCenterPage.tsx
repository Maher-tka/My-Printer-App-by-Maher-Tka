import { Clipboard, ExternalLink, FolderOpen, RefreshCw, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { AppRoute } from '@/types/navigation'
import type { ExportHistoryEntry } from '../../../shared/release-types'

export function ExportCenterPage({
  onNavigate
}: {
  onNavigate: (route: AppRoute) => void
}): JSX.Element {
  const [entries, setEntries] = useState<ExportHistoryEntry[]>([])
  const load = useCallback(
    async () => setEntries((await window.printerApp?.runtime.listExports()) ?? []),
    []
  )
  useEffect(() => {
    void load()
  }, [load])
  return (
    <div className="mx-auto max-w-[1400px]">
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Export Center</CardTitle>
            <CardDescription>
              Local export history. Customer artwork is never copied into this log.
            </CardDescription>
          </div>
          <Button type="button" variant="outline" onClick={() => void load()}>
            <RefreshCw data-icon="inline-start" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {entries.length === 0 && (
            <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
              No exports recorded yet.
            </p>
          )}
          {entries.map((entry) => (
            <article key={entry.id} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{entry.projectName}</h3>
                    <Badge
                      variant={
                        entry.status === 'success'
                          ? 'success'
                          : entry.status === 'failed'
                            ? 'destructive'
                            : 'secondary'
                      }
                    >
                      {entry.status}
                    </Badge>
                    <Badge variant="outline">{entry.exportType}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {entry.toolType} · {new Date(entry.timestamp).toLocaleString()} ·{' '}
                    {entry.warningsCount} warning(s)
                  </p>
                  <p className="mt-2 break-all text-xs text-muted-foreground">
                    {entry.filePath ?? entry.error ?? 'No path recorded'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {entry.filePath && (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void window.printerApp?.runtime.openPath(entry.filePath!)}
                      >
                        <ExternalLink />
                        Open File
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void window.printerApp?.runtime.openParentFolder(entry.filePath!)
                        }
                      >
                        <FolderOpen />
                        Open Folder
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void navigator.clipboard.writeText(entry.filePath!)}
                      >
                        <Clipboard />
                        Copy Path
                      </Button>
                    </>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onNavigate(toolRoute(entry.toolType))}
                  >
                    <RotateCcw />
                    Re-export
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function toolRoute(tool: string): AppRoute {
  const value = tool.toLowerCase()
  if (value.includes('cutter')) return 'cutter-montage'
  if (value.includes('hardcover')) return 'hardcover-cover'
  return 'booklet-montage'
}
