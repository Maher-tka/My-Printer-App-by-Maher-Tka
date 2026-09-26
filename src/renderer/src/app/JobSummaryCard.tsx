import { ArrowUpRight, CalendarClock, CheckCircle2, Clock3, Layers3 } from 'lucide-react'
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
  const { jobs } = useJobStore()
  const today = localDateKey(new Date())
  const lastDay = new Date()
  lastDay.setDate(lastDay.getDate() + 6)
  const endOfWeek = localDateKey(lastDay)
  const activeJobs = jobs.filter((job) => job.status !== 'delivered' && job.status !== 'canceled')
  const counts = {
    today: activeJobs.filter((job) => job.deadline === today).length,
    week: activeJobs.filter(
      (job) => job.deadline && job.deadline >= today && job.deadline <= endOfWeek
    ).length,
    approval: activeJobs.filter((job) => job.status === 'waiting-customer-approval').length,
    ready: activeJobs.filter((job) => job.status === 'ready-to-print').length
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="grid grid-cols-2 p-0 lg:grid-cols-[260px_repeat(4,minmax(0,1fr))]">
        <button
          type="button"
          className="group col-span-2 flex min-h-24 lg:col-span-1 items-center justify-between gap-4 border-b bg-slate-950 px-5 py-4 text-left text-white transition hover:bg-slate-900 lg:border-b-0 lg:border-r"
          onClick={() => onNavigate('jobs')}
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-300">
              Live shop queue
            </p>
            <p className="mt-2 text-lg font-bold">
              {activeJobs.length} active {activeJobs.length === 1 ? 'job' : 'jobs'}
            </p>
            <p className="mt-1 text-xs text-slate-400">Open production tracking</p>
          </div>
          <ArrowUpRight className="size-5 text-slate-400 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white" />
        </button>
        <Summary icon={CalendarClock} label="Due today" value={counts.today} tone="blue" />
        <Summary icon={Clock3} label="Next 7 days" value={counts.week} tone="violet" />
        <Summary icon={Layers3} label="Waiting approval" value={counts.approval} tone="amber" />
        <Summary icon={CheckCircle2} label="Ready to print" value={counts.ready} tone="emerald" />
      </CardContent>
    </Card>
  )
}

const tones = {
  blue: 'bg-blue-500/10 text-blue-600',
  violet: 'bg-violet-500/10 text-violet-600',
  amber: 'bg-amber-500/10 text-amber-600',
  emerald: 'bg-emerald-500/10 text-emerald-600'
}

function Summary({
  icon: Icon,
  label,
  value,
  tone
}: {
  icon: typeof CalendarClock
  label: string
  value: number
  tone: keyof typeof tones
}): JSX.Element {
  return (
    <div className="flex min-h-28 items-center gap-3 border-b px-4 py-4 last:border-b-0 sm:px-5 lg:border-b-0 lg:border-r lg:last:border-r-0">
      <div className={cn('grid size-10 shrink-0 place-items-center rounded-xl', tones[tone])}>
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <div>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        <p className="mt-0.5 text-xs font-medium text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}
