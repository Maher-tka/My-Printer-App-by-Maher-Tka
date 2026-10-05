import { useLanguage } from '@/i18n/useLanguage'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getDeadlineState, localDateKey } from './jobWorkflow'
import type { PrinterJob } from './jobTypes'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function JobCalendar({
  jobs,
  month,
  onMonthChange,
  onEdit
}: {
  jobs: PrinterJob[]
  month: Date
  onMonthChange: (month: Date) => void
  onEdit: (job: PrinterJob) => void
}): JSX.Element {
  const { t } = useLanguage()

  const [expandedDays, setExpandedDays] = useState<Set<string>>(() => new Set())
  const monthKey = `${month.getFullYear()}-${month.getMonth()}`
  const days = useMemo(() => getCalendarDays(month), [monthKey])
  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        month: 'long',
        year: 'numeric'
      }).format(month),
    [monthKey]
  )
  const todayKey = localDateKey(new Date())
  const jobsByDeadline = useMemo(() => {
    const index = new Map<string, PrinterJob[]>()
    for (const job of jobs) {
      if (!job.deadline) continue
      const entries = index.get(job.deadline)
      if (entries) entries.push(job)
      else index.set(job.deadline, [job])
    }
    return index
  }, [jobs])

  const moveMonth = (amount: number): void => {
    onMonthChange(new Date(month.getFullYear(), month.getMonth() + amount, 1))
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Previous month"
          onClick={() => moveMonth(-1)}
        >
          <ChevronLeft />
        </Button>
        <div className="text-center">
          <h3 className="font-semibold">{monthLabel}</h3>
          <button
            type="button"
            className="text-xs text-primary hover:underline"
            onClick={() => onMonthChange(new Date())}
          >
            {t('Return to today')}
          </button>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Next month"
          onClick={() => moveMonth(1)}
        >
          <ChevronRight />
        </Button>
      </div>
      <div className="overflow-x-auto" role="region" aria-label="Deadline calendar" tabIndex={0}>
        <div className="grid min-w-[630px] grid-cols-7 gap-px overflow-hidden rounded-xl border bg-border">
          {WEEKDAYS.map((day) => (
            <div key={day} className="bg-muted px-2 py-2 text-center text-xs font-semibold">
              {day}
            </div>
          ))}
          {days.map(({ date, inMonth }) => {
            const dateKey = localDateKey(date)
            const dayJobs = jobsByDeadline.get(dateKey) ?? []
            const expanded = expandedDays.has(dateKey)
            const isToday = dateKey === todayKey
            return (
              <div
                key={dateKey}
                className={cn(
                  'min-h-28 bg-background p-2',
                  !inMonth && 'bg-muted/35 text-muted-foreground'
                )}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={cn(
                      'grid size-6 place-items-center rounded-full text-xs',
                      isToday && 'bg-primary font-bold text-primary-foreground'
                    )}
                  >
                    {date.getDate()}
                  </span>
                  {dayJobs.length > 0 ? <Badge variant="secondary">{dayJobs.length}</Badge> : null}
                </div>
                <div className="flex flex-col gap-1">
                  {dayJobs.slice(0, expanded ? undefined : 3).map((job) => (
                    <button
                      key={job.id}
                      type="button"
                      onClick={() => onEdit(job)}
                      className={cn(
                        'truncate rounded border bg-card px-1.5 py-1 text-left text-[11px] font-medium hover:border-primary',
                        getDeadlineState(job, todayKey) === 'overdue' &&
                          'border-destructive/50 bg-destructive/5 text-destructive'
                      )}
                      title={`${job.jobTitle} — ${job.customerName}`}
                    >
                      {job.jobTitle}
                    </button>
                  ))}
                  {dayJobs.length > 3 ? (
                    <button
                      type="button"
                      className="text-left text-[11px] font-medium text-primary hover:underline"
                      aria-expanded={expanded}
                      aria-label={`${expanded ? 'Show fewer' : 'Show all'} jobs for ${dateKey}`}
                      onClick={() =>
                        setExpandedDays((current) => {
                          const next = new Set(current)
                          if (next.has(dateKey)) next.delete(dateKey)
                          else next.add(dateKey)
                          return next
                        })
                      }
                    >
                      {expanded ? 'Show fewer' : `+${dayJobs.length - 3} more`}
                    </button>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function getCalendarDays(month: Date): Array<{ date: Date; inMonth: boolean }> {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const mondayOffset = (first.getDay() + 6) % 7
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - mondayOffset)
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index)
    return { date, inMonth: date.getMonth() === month.getMonth() }
  })
}
