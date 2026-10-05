import { useLanguage } from '@/i18n/useLanguage'
import { ArrowUpRight, CalendarClock, CheckCircle2, Clock3, Layers3 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { localDateKey } from '@/jobs/jobWorkflow'
import { useJobStore } from '@/jobs/useJobStore'
import { cn } from '@/lib/utils'
import type { AppRoute } from '@/types/navigation'

export function JobSummaryCard({
  onNavigate
}: {
  onNavigate: (route: AppRoute) => void
}): JSX.Element {
  const { t } = useLanguage()

  const { jobs } = useJobStore()
  const [today, setToday] = useState(() => localDateKey(new Date()))
  useEffect(() => {
    const update = (): void => setToday(localDateKey(new Date()))
    const timer = window.setInterval(update, 30_000)
    window.addEventListener('focus', update)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', update)
    }
  }, [])
  const activeJobs = jobs.filter((job) => job.status !== 'delivered' && job.status !== 'canceled')
  const metrics = [
    {
      label: 'Due today',
      value: activeJobs.filter((job) => job.deadline === today).length,
      icon: CalendarClock
    },
    {
      label: 'Overdue',
      value: activeJobs.filter((job) => job.deadline && job.deadline < today).length,
      icon: Clock3
    },
    {
      label: 'Awaiting approval',
      value: activeJobs.filter((job) => job.status === 'waiting-customer-approval').length,
      icon: Layers3
    },
    {
      label: 'Ready to print',
      value: activeJobs.filter((job) => job.status === 'ready-to-print').length,
      icon: CheckCircle2
    }
  ]

  return (
    <Card className="overflow-hidden rounded-2xl border-border/70 shadow-none">
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {t('Production status')}
        </p>
        <button
          type="button"
          onClick={() => onNavigate('jobs')}
          className="group flex items-center gap-1.5 rounded text-xs font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {activeJobs.length} active {activeJobs.length === 1 ? 'job' : 'jobs'}
          <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </button>
      </div>
      <CardContent className="grid grid-cols-2 p-0 sm:grid-cols-4">
        {metrics.map(({ label, value, icon: Icon }, index) => (
          <button
            key={label}
            type="button"
            onClick={() => onNavigate('jobs')}
            className={cn(
              'group flex min-h-20 flex-col items-start justify-center gap-2 border-border/60 px-5 py-3 text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
              index < 2 && 'border-b sm:border-b-0',
              index % 2 === 0 && 'border-r',
              index === 1 && 'sm:border-r'
            )}
          >
            <div className="flex w-full items-center justify-between gap-2">
              <span
                className={cn(
                  'text-2xl font-medium tabular-nums tracking-[-0.03em]',
                  label === 'Overdue' && value > 0 ? 'text-destructive' : 'text-foreground'
                )}
              >
                {value.toString().padStart(2, '0')}
              </span>
              <Icon
                className={cn(
                  'size-[18px]',
                  label === 'Overdue' && value > 0 ? 'text-destructive' : 'text-primary/60'
                )}
                aria-hidden="true"
              />
            </div>
            <span className="text-xs text-muted-foreground">{t(label)}</span>
          </button>
        ))}
      </CardContent>
    </Card>
  )
}
