import { FilePlus2, FolderOpen, Import, Zap } from 'lucide-react'
import { LicenseStatusCard } from '@/app/LicenseStatusCard'
import { QuickActionList } from '@/app/QuickActionList'
import { RecentJobsTable } from '@/app/RecentJobsTable'
import { ToolCard } from '@/components/tool-card/ToolCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { printerTools } from '@/lib/app-data'
import type { AppRoute } from '@/types/navigation'

interface DashboardPageProps {
  onNavigate: (route: AppRoute) => void
}

const quickActions = [
  {
    label: 'New Booklet Project',
    description: 'Start a new booklet imposition project',
    icon: FilePlus2,
    route: 'booklet-montage' as const
  },
  {
    label: 'Open Saved Job',
    description: 'Browse and open local saved projects',
    icon: FolderOpen,
    route: 'dashboard' as const
  },
  {
    label: 'Import PDF',
    description: 'Import a PDF file to get started',
    icon: Import,
    route: 'booklet-montage' as const
  }
]

export function DashboardPage({ onNavigate }: DashboardPageProps): JSX.Element {
  return (
    <div className="mx-auto flex max-w-[1520px] flex-col gap-5">
      <LicenseStatusCard onActivate={() => onNavigate('license')} />

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {printerTools.map((tool) => (
          <ToolCard
            key={tool.id}
            tool={tool}
            onOpen={() => onNavigate(tool.route)}
          />
        ))}
      </section>

      <section className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,1fr)_520px]">
        <RecentJobsTable />
        <Card>
          <CardHeader className="flex-row items-center gap-3">
            <Zap className="size-5 text-primary" aria-hidden="true" />
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <QuickActionList actions={quickActions} onNavigate={onNavigate} />
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
