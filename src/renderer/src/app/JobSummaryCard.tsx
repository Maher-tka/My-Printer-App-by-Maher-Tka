import { CalendarClock, CheckCircle2, Clock3 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useJobStore } from '@/jobs/useJobStore'
import type { AppRoute } from '@/types/navigation'

export function JobSummaryCard({
  onNavigate
}: {
  onNavigate: (route: AppRoute) => void
}): JSX.Element {
  const { jobs } = useJobStore()
  const now = Date.now()
  const endOfWeek = now + 7 * 24 * 60 * 60 * 1000
  const today = new Date().toISOString().slice(0, 10)
  const counts = {
    today: jobs.filter((job) => job.deadline === today).length,
    week: jobs.filter((job) => {
      const deadline = Date.parse(job.deadline ?? '')
      return Number.isFinite(deadline) && deadline >= now && deadline <= endOfWeek
    }).length,
    approval: jobs.filter((job) => job.status === 'waiting-customer-approval').length,
    ready: jobs.filter((job) => job.status === 'ready-to-print').length
  }
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle>Shop Queue</CardTitle>
        <button
          type="button"
          className="text-sm font-medium text-primary hover:underline"
          onClick={() => onNavigate('jobs')}
        >
          Open jobs
        </button>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Summary icon={CalendarClock} label="Due today" value={counts.today} />
        <Summary icon={Clock3} label="This week" value={counts.week} />
        <Summary icon={Clock3} label="Waiting approval" value={counts.approval} />
        <Summary icon={CheckCircle2} label="Ready to print" value={counts.ready} />
      </CardContent>
    </Card>
  )
}

function Summary({
  icon: Icon,
  label,
  value
}: {
  icon: typeof CalendarClock
  label: string
  value: number
}): JSX.Element {
  return (
    <div className="rounded-lg border bg-muted/25 p-4">
      <Icon className="size-5 text-primary" />
      <p className="mt-3 text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}
