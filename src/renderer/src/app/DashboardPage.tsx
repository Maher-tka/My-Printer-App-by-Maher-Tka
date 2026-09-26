import { ArrowRight, FileImage, FilePlus2, FolderOpen, Import, Sparkles, Zap } from 'lucide-react'
import { useRef, useState } from 'react'
import { JobSummaryCard } from '@/app/JobSummaryCard'
import { QuickActionList } from '@/app/QuickActionList'
import { RecentExportsCard } from '@/app/RecentExportsCard'
import { RecentJobsTable } from '@/app/RecentJobsTable'
import { PdfFilePickerInput } from '@/components/file-input/PdfFilePickerInput'
import { ToolCard } from '@/components/tool-card/ToolCard'
import { Badge } from '@/components/ui/badge'
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
    <div className="mx-auto flex max-w-[1580px] flex-col gap-7">
      <section className="relative overflow-hidden rounded-[1.6rem] border border-blue-400/20 bg-[linear-gradient(120deg,#0b1933_0%,#112b59_52%,#164cb0_100%)] p-5 text-white shadow-elevated sm:p-6">
        <div className="pointer-events-none absolute -right-24 -top-32 size-96 rounded-full bg-blue-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 left-1/3 size-80 rounded-full bg-violet-500/15 blur-3xl" />

        <div className="relative flex flex-wrap items-center justify-between gap-5">
          <div className="max-w-3xl">
            <Badge className="border-white/15 bg-white/10 text-blue-50 shadow-sm" variant="outline">
              <Sparkles className="mr-1.5 size-3.5" aria-hidden="true" />
              Print production, organized
            </Badge>
            <h2 className="mt-3 text-2xl font-bold leading-tight tracking-[-0.03em] sm:text-3xl">
              What are we printing today?
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100/80">
              Prepare booklets, covers, cut layouts, and sequentially numbered tickets.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button
                type="button"
                size="lg"
                className="rounded-xl bg-white text-slate-950 shadow-lg shadow-blue-950/25 hover:bg-blue-50"
                onClick={() => onNavigate('booklet-montage')}
              >
                <FilePlus2 aria-hidden="true" />
                New booklet
                <ArrowRight aria-hidden="true" />
              </Button>
              <Button
                type="button"
                size="lg"
                variant="outline"
                className="rounded-xl border-white/20 bg-white/5 text-white shadow-none hover:bg-white/12 hover:text-white"
                onClick={() => void openSavedProject()}
              >
                <FolderOpen aria-hidden="true" />
                Open saved project
              </Button>
            </div>
          </div>
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

      <JobSummaryCard onNavigate={onNavigate} />

      <section className="flex flex-col gap-4">
        <SectionHeading
          eyebrow="Production suite"
          title="Choose your workspace"
          description="Purpose-built tools that keep print preparation accurate and repeatable."
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
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

      <section className="flex flex-col gap-4">
        <SectionHeading
          eyebrow="Daily operations"
          title="Continue where you left off"
          description="Open recent project files or jump directly into a common action."
        />
        <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,1fr)_520px]">
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
  eyebrow,
  title,
  description
}: {
  eyebrow: string
  title: string
  description: string
}): JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
      <div className="flex flex-col gap-1 lg:flex-row lg:items-end lg:justify-between">
        <h2 className="text-xl font-bold tracking-[-0.025em] sm:text-2xl">{title}</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}
