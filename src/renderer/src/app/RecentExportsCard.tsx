import { useLanguage } from '@/i18n/useLanguage'
import { ArrowDownToLine, ArrowUpRight, ExternalLink } from 'lucide-react'
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
  const { t } = useLanguage()

  const [exports, setExports] = useState<ExportHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    const load = async (): Promise<void> => {
      try {
        const items = await window.printerApp?.runtime.listExports()
        if (active) setExports((items ?? []).slice(0, 5))
      } catch {
        if (active) setError('Could not load export history. Open all exports to try again.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [])
  return (
    <Card className="h-full overflow-hidden rounded-2xl border-border/70 shadow-none">
      <CardHeader className="flex-row items-center justify-between gap-3 px-5 pb-4 pt-6 sm:px-6">
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {t('Made & ready')}
          </p>
          <CardTitle className="text-base font-semibold">{t('Recent exports')}</CardTitle>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-primary"
          onClick={() => onNavigate('exports')}
        >
          {t('View all')} <ArrowUpRight className="size-3.5" />
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-0 px-5 pb-6 pt-0 sm:px-6">
        {loading ? (
          <p role="status" className="py-8 text-center text-sm text-muted-foreground">
            {t('Loading exports…')}
          </p>
        ) : error ? (
          <p
            role="alert"
            className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive"
          >
            {error}
          </p>
        ) : exports.length === 0 ? (
          <div className="flex min-h-40 items-center gap-4 rounded-xl border border-border/60 bg-muted/20 p-5">
            <span className="grid size-11 shrink-0 place-items-center rounded-full border border-primary/15 bg-card text-primary/70">
              <ArrowDownToLine className="size-5" strokeWidth={1.5} aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-medium">{t('The finishing touch.')}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {t('Your exported files will gather here, ready for their next step.')}
              </p>
            </div>
          </div>
        ) : (
          exports.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between gap-3 border-b border-border/60 py-4 last:border-b-0"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent/60 text-primary">
                <ArrowDownToLine className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{entry.projectName}</p>
                <p className="mt-1 truncate text-[11px] text-muted-foreground">
                  {entry.exportType} · {new Date(entry.timestamp).toLocaleString()}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Badge
                  variant={entry.status === 'success' ? 'success' : 'secondary'}
                  className="text-[10px]"
                >
                  {entry.status}
                </Badge>
                {entry.filePath && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground"
                    aria-label={`Open export ${entry.projectName}`}
                    title={`Open ${entry.projectName}`}
                    onClick={() => void window.printerApp?.runtime.openPath(entry.filePath!)}
                  >
                    <ExternalLink className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
