import type { Meta, StoryObj } from '@storybook/react-vite'
import { useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { JobList } from './JobList'
import { JobsWorkspaceHeader, type JobsView } from './JobsWorkspaceHeader'
import type { PrinterJob, PrinterJobStatus } from './jobTypes'

const meta = {
  title: 'Workspaces/Shop jobs',
  parameters: {
    layout: 'fullscreen'
  },
  decorators: [
    (Story) => (
      <div className="min-h-screen bg-background p-6 text-foreground">
        <Story />
      </div>
    )
  ]
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const sampleJobs: PrinterJob[] = [
  createSampleJob({
    id: 'job-1',
    jobTitle: 'Wedding invitation set',
    customerName: 'Amira Ben Salah',
    phoneNumber: '+216 20 123 456',
    status: 'ready-to-print',
    tool: 'cutter',
    deadline: todayKey(),
    remainingAmount: 180
  }),
  createSampleJob({
    id: 'job-2',
    jobTitle: 'School yearbooks',
    customerName: 'El Manar School',
    phoneNumber: '+216 71 555 010',
    status: 'printing',
    tool: 'booklet',
    deadline: '2025-01-01',
    remainingAmount: 420
  }),
  createSampleJob({
    id: 'job-3',
    jobTitle: 'Graduation hardcover albums',
    customerName: 'Studio Lumière',
    phoneNumber: '+216 98 444 220',
    status: 'waiting-customer-approval',
    tool: 'hardcover',
    remainingAmount: 250
  })
]

export const WorkspaceNavigation: Story = {
  render: () => <HeaderPreview />
}

export const SearchableJobList: Story = {
  render: () => <JobListPreview />
}

function HeaderPreview(): JSX.Element {
  const [view, setView] = useState<JobsView>('board')
  return (
    <div className="mx-auto max-w-[1400px]">
      <JobsWorkspaceHeader
        view={view}
        onViewChange={setView}
        jobCount={12}
        dueTodayCount={2}
        overdueCount={1}
      />
    </div>
  )
}

function JobListPreview(): JSX.Element {
  const [jobs, setJobs] = useState(sampleJobs)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | PrinterJobStatus>('all')
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return jobs.filter(
      (job) =>
        (status === 'all' || job.status === status) &&
        (!needle ||
          `${job.jobTitle} ${job.customerName} ${job.phoneNumber}`.toLowerCase().includes(needle))
    )
  }, [jobs, query, status])

  return (
    <Card className="mx-auto max-w-[1000px]">
      <CardContent className="pt-6">
        <JobList
          jobs={filtered}
          query={query}
          status={status}
          onQueryChange={setQuery}
          onStatusChange={setStatus}
          onEdit={() => undefined}
          onDelete={(job) => setJobs((current) => current.filter((item) => item.id !== job.id))}
        />
      </CardContent>
    </Card>
  )
}

function createSampleJob({
  id,
  jobTitle,
  customerName,
  phoneNumber,
  status,
  tool,
  deadline,
  remainingAmount
}: {
  id: string
  jobTitle: string
  customerName: string
  phoneNumber: string
  status: PrinterJobStatus
  tool: PrinterJob['tool']
  deadline?: string
  remainingAmount: number
}): PrinterJob {
  const now = new Date().toISOString()
  return {
    id,
    jobTitle,
    customerName,
    phoneNumber,
    status,
    tool,
    deadline,
    createdAt: now,
    updatedAt: now,
    notes: '',
    exportPaths: [],
    quote: {
      materialCost: 0,
      printCost: 0,
      finishingCost: 0,
      designCost: 0,
      quantity: 1,
      discount: 0,
      finalPrice: remainingAmount,
      depositPaid: 0,
      remainingAmount
    }
  }
}

function todayKey(): string {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
