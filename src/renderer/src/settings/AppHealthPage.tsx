import {
  Activity,
  ArrowLeft,
  Database,
  Download,
  FolderOpen,
  RefreshCw,
  Trash2,
  Wrench
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { PerformanceSettings } from '@/performance/performanceTypes'
import type { AppRoute } from '@/types/navigation'
import type { LicenseSnapshot } from '../../../shared/licensing-types'
import type { AppHealthSnapshot } from '../../../shared/release-types'

export function AppHealthPage({
  license,
  performance,
  isDeveloperMode,
  onResetLicense,
  onNavigate
}: {
  license: LicenseSnapshot | null
  performance: PerformanceSettings
  isDeveloperMode: boolean
  onResetLicense: () => Promise<void>
  onNavigate: (route: AppRoute) => void
}): JSX.Element {
  const [health, setHealth] = useState<AppHealthSnapshot | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const isAvailable = Boolean(window.printerApp?.runtime)

  const runAction = async (action: () => Promise<unknown>): Promise<void> => {
    setIsBusy(true)
    setMessage(null)
    try {
      const result = await action()
      if (typeof result === 'string' && result) setMessage(result)
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'The action could not be completed. Please try again.'
      )
    } finally {
      setIsBusy(false)
    }
  }

  const refresh = useCallback(async (): Promise<void> => {
    setIsLoading(true)
    try {
      if (!window.printerApp?.runtime) return
      setHealth(await window.printerApp.runtime.getHealth())
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Could not read app health. Try refreshing.'
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const exportReport = async (): Promise<void> => {
    const result = await window.printerApp?.runtime.exportDiagnosticReport({
      licenseStatus: license?.statusLabel ?? 'Unavailable',
      licensePlan: license?.planLabel ?? 'Unavailable',
      performancePreset: performance.label,
      memoryMode: performance.preset === 'low-end' ? 'conservative' : performance.preset
    })
    if (result?.ok) setMessage(`Diagnostic report saved to ${result.filePath}`)
    else if (!result?.canceled) setMessage(result?.error ?? 'Could not export diagnostic report.')
  }

  const clearCache = async (): Promise<void> => {
    const result = await window.printerApp?.runtime.clearTemporaryCache()
    setMessage(result?.message ?? result?.error ?? 'Cache request finished.')
    await refresh()
  }

  return (
    <div className="workspace-shell mx-auto flex max-w-[1300px] flex-col gap-5">
      <Button
        variant="ghost"
        className="w-fit"
        onClick={() => onNavigate('settings')}
        type="button"
      >
        <ArrowLeft data-icon="inline-start" />
        Back to Settings
      </Button>
      <Card className="overflow-hidden">
        <CardHeader className="flex-row items-start justify-between gap-4 border-b bg-muted/25">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="text-primary" />
              App Health
            </CardTitle>
            <CardDescription>
              Release, storage, licensing, exports, and performance diagnostics.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={!isAvailable || isLoading || isBusy}
            onClick={() => void runAction(refresh)}
          >
            <RefreshCw
              data-icon="inline-start"
              className={isLoading ? 'animate-spin' : undefined}
            />
            {isLoading ? 'Refreshing…' : 'Refresh'}
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {!health ? (
            <p className="text-sm text-muted-foreground">Reading local app health…</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <HealthStat label="App version" value={health.appVersion} />
                <HealthStat label="Electron" value={health.electronVersion} />
                <HealthStat label="Platform" value={`${health.platform} ${health.architecture}`} />
                <HealthStat
                  label="Build"
                  value={health.isPackaged ? 'Installed package' : 'Development'}
                />
                <HealthStat label="License" value={license?.statusLabel ?? 'Unavailable'} />
                <HealthStat label="Performance" value={performance.label} />
                <HealthStat label="Recent jobs" value={String(health.recentJobsCount)} />
                <HealthStat label="Recent exports" value={String(health.recentExportsCount)} />
              </div>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <PathRow label="Project data folder" value={health.appDataPath} />
                <PathRow label="Autosaves" value={health.autosavePath} />
                <PathRow
                  label="Last export"
                  value={health.lastExportPath ?? 'No export recorded'}
                />
                <PathRow
                  label="Last error"
                  value={health.lastError ?? 'No runtime error recorded'}
                />
              </div>
              <div>
                <p className="mb-2 text-sm font-medium">Available tools</p>
                <div className="flex flex-wrap gap-2">
                  {health.availableTools.map((tool) => (
                    <Badge key={tool} variant="secondary">
                      {tool}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}
          {message && (
            <p
              className="break-words rounded-md bg-muted p-3 text-sm"
              role="status"
              aria-live="polite"
            >
              {message}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={!isAvailable || isBusy}
              onClick={() =>
                void runAction(async () => window.printerApp?.runtime.openAppDataFolder())
              }
            >
              <FolderOpen data-icon="inline-start" />
              Open App Data Folder
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!isAvailable || isBusy}
              onClick={() => void runAction(exportReport)}
            >
              <Download data-icon="inline-start" />
              Export Diagnostic Report
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!isAvailable || isBusy}
              onClick={() => void runAction(clearCache)}
            >
              <Trash2 data-icon="inline-start" />
              Clear Temporary Cache
            </Button>
            {isDeveloperMode && (
              <Button
                type="button"
                variant="outline"
                disabled={!isAvailable || isBusy}
                onClick={() => void runAction(onResetLicense)}
              >
                <Wrench data-icon="inline-start" />
                Reset Local Trial / License
              </Button>
            )}
            {isDeveloperMode && (
              <Button
                type="button"
                variant="outline"
                disabled={!isAvailable || isBusy}
                onClick={() =>
                  void runAction(async () => {
                    const result =
                      await window.printerApp?.runtime.createQualityFixtures('test-projects')
                    setMessage(
                      result?.ok
                        ? `Test fixture created in ${result.folderPath}`
                        : (result?.error ?? 'Could not create test fixture.')
                    )
                  })
                }
              >
                <Database data-icon="inline-start" />
                Create Test Projects
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function HealthStat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-xl border bg-muted/25 p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-semibold" title={value}>
        {value}
      </p>
    </div>
  )
}
function PathRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-xl border bg-muted/15 p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 break-all text-sm">{value}</p>
    </div>
  )
}
