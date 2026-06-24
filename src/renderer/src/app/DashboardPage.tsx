import { FilePlus2, FolderOpen, Import, Zap } from 'lucide-react'
import { useRef, useState } from 'react'
import { LicenseStatusCard } from '@/app/LicenseStatusCard'
import { QuickActionList } from '@/app/QuickActionList'
import { RecentJobsTable } from '@/app/RecentJobsTable'
import { PdfFilePickerInput } from '@/components/file-input/PdfFilePickerInput'
import { ToolCard } from '@/components/tool-card/ToolCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getToolAccessState } from '@/licensing/tool-access'
import { printerTools } from '@/lib/app-data'
import type { AppRoute } from '@/types/navigation'
import type { PrinterAppProjectResult } from '@/types/projects'
import type { LicenseSnapshot } from '../../../shared/licensing-types'

interface DashboardPageProps {
  licenseState: LicenseSnapshot | null
  isLicenseLoading: boolean
  licenseError: string | null
  onNavigate: (route: AppRoute) => void
  onOpenProject: (filePath?: string | null) => Promise<PrinterAppProjectResult>
  onImportBookletPdf: (files: File[]) => void
}

export function DashboardPage({
  licenseState,
  isLicenseLoading,
  licenseError,
  onNavigate,
  onOpenProject,
  onImportBookletPdf
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
      description: 'Browse and open a local .mpjob project',
      icon: FolderOpen,
      onClick: () => void openSavedProject()
    },
    {
      label: 'Import PDF',
      description: 'Import a PDF file to get started',
      icon: Import,
      onClick: () => openBookletPdfPicker()
    }
  ]
  const navigateToTool = (route: AppRoute): void => onNavigate(route)

  return (
    <div className="mx-auto flex max-w-[1520px] flex-col gap-5">
      <LicenseStatusCard
        licenseState={licenseState}
        isLoading={isLicenseLoading}
        error={licenseError}
        onActivate={() => onNavigate('license')}
      />

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {printerTools.map((tool) => {
          const access = getToolAccessState(tool, licenseState, isLicenseLoading)

          return (
            <ToolCard
              key={tool.id}
              tool={tool}
              onOpen={() => navigateToTool(tool.route)}
              {...access}
            />
          )
        })}
      </section>

      <section className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,1fr)_520px]">
        <RecentJobsTable onOpenProject={onOpenProject} />
        <Card>
          <CardHeader className="flex-row items-center gap-3">
            <Zap className="size-5 text-primary" aria-hidden="true" />
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            {projectOpenError && (
              <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {projectOpenError}
              </div>
            )}
            <QuickActionList actions={quickActions} onNavigate={navigateToTool} />
            <PdfFilePickerInput ref={pdfInputRef} onFilesSelected={onImportBookletPdf} />
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
