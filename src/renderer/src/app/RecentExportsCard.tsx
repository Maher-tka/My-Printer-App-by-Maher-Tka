import { ExternalLink, History } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { AppRoute } from '@/types/navigation'
import type { ExportHistoryEntry } from '../../../shared/release-types'

export function RecentExportsCard({
  onNavigate
}: {
  onNavigate: (route: AppRoute) => void
}): JSX.Element {
  const [exports, setExports] = useState<ExportHistoryEntry[]>([])
  useEffect(() => {
    void window.printerApp?.runtime.listExports().then((items) => setExports(items.slice(0, 5)))
  }, [])
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center justify-between gap-3 border-b bg-muted/25 px-5 py-4">
        <CardTitle className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
            <History className="size-4" aria-hidden="true" />
          </span>
          Recent Exports
        </CardTitle>
        <Button type="button" variant="ghost" size="sm" onClick={() => onNavigate('exports')}>
          View all
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 p-5">
        {exports.length === 0 && (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Exports saved by any tool will appear here.
          </p>
        )}
        {exports.map((entry) => (
          <div
            key={entry.id}
            className="flex items-center justify-between gap-3 rounded-xl border bg-muted/15 p-3 transition-colors hover:bg-accent/35"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{entry.projectName}</p>
              <p className="truncate text-xs text-muted-foreground">
                {entry.exportType} · {new Date(entry.timestamp).toLocaleString()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={entry.status === 'success' ? 'success' : 'secondary'}>
                {entry.status}
              </Badge>
              {entry.filePath && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void window.printerApp?.runtime.openPath(entry.filePath!)}
                >
                  <ExternalLink />
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
