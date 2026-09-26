import {
  BriefcaseBusiness,
  CalendarDays,
  Columns3,
  List,
  UsersRound,
  type LucideIcon
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

export type JobsView = 'list' | 'board' | 'calendar' | 'customers'

const views: Array<{ id: JobsView; label: string; icon: LucideIcon }> = [
  { id: 'board', label: 'Board', icon: Columns3 },
  { id: 'list', label: 'List', icon: List },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'customers', label: 'Customers', icon: UsersRound }
]

interface JobsWorkspaceHeaderProps {
  view: JobsView
  onViewChange: (view: JobsView) => void
  jobCount: number
  overdueCount: number
  dueTodayCount: number
}

export function JobsWorkspaceHeader({
  view,
  onViewChange,
  jobCount,
  overdueCount,
  dueTodayCount
}: JobsWorkspaceHeaderProps): JSX.Element {
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between lg:p-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <BriefcaseBusiness className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold">Shop workflow</h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge variant="outline">{jobCount} jobs</Badge>
              <Badge variant={dueTodayCount > 0 ? 'warning' : 'secondary'}>
                {dueTodayCount} due today
              </Badge>
              <Badge variant={overdueCount > 0 ? 'destructive' : 'secondary'}>
                {overdueCount} overdue
              </Badge>
            </div>
          </div>
        </div>

        <Tabs value={view} onValueChange={(value) => onViewChange(value as JobsView)}>
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 lg:w-auto lg:grid-cols-4">
            {views.map(({ id, label, icon: Icon }) => (
              <TabsTrigger key={id} value={id} className="h-9 gap-2 px-3">
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </CardContent>
    </Card>
  )
}
