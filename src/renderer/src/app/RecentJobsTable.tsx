import { CheckCircle2, Clock3, FileText, MoreHorizontal, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { recentJobs } from '@/lib/app-data'
import type { JobStatus } from '@/types/jobs'

const statusConfig: Record<
  JobStatus,
  {
    variant: 'success' | 'warning' | 'destructive'
    icon: typeof CheckCircle2
  }
> = {
  Completed: { variant: 'success', icon: CheckCircle2 },
  'In Progress': { variant: 'warning', icon: Clock3 },
  Failed: { variant: 'destructive', icon: XCircle }
}

export function RecentJobsTable(): JSX.Element {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-3">
          <FileText className="size-5 text-muted-foreground" aria-hidden="true" />
          <CardTitle>Recent Jobs</CardTitle>
        </div>
        <Button variant="ghost" size="sm" type="button">
          View All
        </Button>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Job Name</TableHead>
              <TableHead>Tool</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {recentJobs.map((job) => {
              const StatusIcon = statusConfig[job.status].icon

              return (
                <TableRow key={job.id}>
                  <TableCell className="font-medium">{job.jobName}</TableCell>
                  <TableCell className="text-muted-foreground">{job.tool}</TableCell>
                  <TableCell className="text-muted-foreground">{job.date}</TableCell>
                  <TableCell>
                    <Badge
                      variant={statusConfig[job.status].variant}
                      className="gap-1.5"
                    >
                      <StatusIcon className="size-3.5" aria-hidden="true" />
                      {job.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      type="button"
                      aria-label={`More options for ${job.jobName}`}
                    >
                      <MoreHorizontal />
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
