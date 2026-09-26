import { FileImage, FilePlus2, FolderOpen, Import, Zap } from 'lucide-react'
import { useRef, useState } from 'react'
import { JobSummaryCard } from '@/app/JobSummaryCard'
import { QuickActionList } from '@/app/QuickActionList'
import { RecentExportsCard } from '@/app/RecentExportsCard'
import { RecentJobsTable } from '@/app/RecentJobsTable'
import { PdfFilePickerInput } from '@/components/file-input/PdfFilePickerInput'
import { ToolCard } from '@/components/tool-card/ToolCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getToolAccessState } from '@/licensing/tool-access'
import { printerTools } from '@/lib/app-data'
import type { AppRoute } from '@/types/navigation'
import type { PrinterAppProjectResult } from '@/types/projects'
import type { LicenseSnapshot } from '../../../shared/licensing-types'

interface DashboardPageProps {
  licenseState: LicenseSnapshot | null
  isLicenseLoading: boolean
  onNavigate: (route: AppRoute) => void
  onOpenProject: (filePath?: string | null) => Promise<PrinterAppProjectResult>
  onImportBookletPdf: (files: File[]) => void
  onOpenImageFile: () => void
}

export function DashboardPage({
  licenseState,
  isLicenseLoading,
  onNavigate,
  onOpenProject,
  onImportBookletPdf,
  onOpenImageFile
}: DashboardPageProps): JSX.Element {
  const [projectOpenError, setProjectOpenError] = useState<string | null>(null)
  const pdfInputRef = useRef<HTMLInputElement>(null)

  const openSavedProject = async (): Promise<void> => {
    setProjectOpenError(null)
    const result = await onOpenProject()

    if (!result.ok && !result.canceled) {
      setProjectOpenError(result.error ?? 'Could not open that project.')
    }
  }

  const openBookletPdfPicker = (): void => {
    if (!licenseState?.canUsePaidTools) {
      onNavigate('booklet-montage')
      return
    }

    pdfInputRef.current?.click()
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
      description: 'Browse and open a local My Printer project',
      icon: FolderOpen,
      onClick: () => void openSavedProject()
    },
    {
      label: 'Import PDF',
      description: 'Import a PDF directly into Booklet Montage',
      icon: Import,
      onClick: openBookletPdfPicker
    },
    {
      label: 'Open Artwork',
      description: 'Send artwork to the Cutter workspace',
      icon: FileImage,
      onClick: onOpenImageFile
    }
  ]

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-6">
      <section className="flex flex-wrap items-center justify-between gap-4 py-1">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
            Your production desk
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-[30px]">
            Ready for the next job.
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose a tool, prepare your artwork, and make it print-ready.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void openSavedProject()}>
            <FolderOpen aria-hidden="true" /> Open project
          </Button>
          <Button type="button" onClick={openBookletPdfPicker}>
            <Import aria-hidden="true" /> Import PDF
          </Button>
        </div>
      </section>

      {projectOpenError ? (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm font-medium text-destructive"
        >
          {projectOpenError}
        </div>
      ) : null}

      <section className="flex flex-col gap-4">
        <SectionHeading
          title="Production tools"
          description="From source artwork to the finished sheet."
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {printerTools.map((tool) => {
            const access = getToolAccessState(tool, licenseState, isLicenseLoading)

            return (
              <ToolCard
                key={tool.id}
                tool={tool}
                onOpen={() => onNavigate(tool.route)}
                {...access}
              />
            )
          })}
        </div>
      </section>

      <JobSummaryCard onNavigate={onNavigate} />

      <section className="flex flex-col gap-4">
        <SectionHeading
          title="Pick up where you left off"
          description="Your saved work and everyday shortcuts."
        />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
          <RecentJobsTable onOpenProject={onOpenProject} />
          <Card className="overflow-hidden">
            <CardHeader className="flex-row items-center gap-3 border-b bg-muted/25 px-5 py-4">
              <div className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <Zap className="size-4" aria-hidden="true" />
              </div>
              <CardTitle>Quick actions</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <QuickActionList actions={quickActions} onNavigate={onNavigate} />
              <PdfFilePickerInput ref={pdfInputRef} onFilesSelected={onImportBookletPdf} />
            </CardContent>
          </Card>
        </div>
      </section>

      <RecentExportsCard onNavigate={onNavigate} />
    </div>
  )
}

function SectionHeading({
  title,
  description
}: {
  title: string
  description: string
}): JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-col gap-1 lg:flex-row lg:items-end lg:justify-between">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        <p className="max-w-2xl text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}
