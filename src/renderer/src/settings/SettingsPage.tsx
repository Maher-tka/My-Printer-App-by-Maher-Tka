import { ArrowLeft, Gauge, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PERFORMANCE_PRESETS } from '@/performance/performanceSettings'
import { usePerformanceSettings } from '@/performance/usePerformanceSettings'
import type { PerformancePresetId } from '@/performance/performanceTypes'
import type { AppRoute } from '@/types/navigation'

interface SettingsPageProps {
  onNavigate: (route: AppRoute) => void
}

export function SettingsPage({ onNavigate }: SettingsPageProps): JSX.Element {
  const { settings, preset, setPreset } = usePerformanceSettings()

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-6">
      <Button
        variant="ghost"
        className="w-fit"
        onClick={() => onNavigate('dashboard')}
        type="button"
      >
        <ArrowLeft data-icon="inline-start" />
        Back to Dashboard
      </Button>

      <Card>
        <CardHeader className="flex-row items-center gap-3">
          <Settings className="size-6 text-primary" aria-hidden="true" />
          <div className="flex flex-col gap-1.5">
            <CardTitle className="text-xl">Settings</CardTitle>
            <CardDescription>Local workspace preferences for this desktop app.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <section className="rounded-lg border bg-muted/25 p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <div className="grid size-11 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Gauge aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">Performance</h3>
                    <Badge variant="secondary">{settings.label}</Badge>
                  </div>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                    Use Low-end PC mode for older printer-shop computers. This setting controls
                    preview size, render batching, animations, and memory cleanup.
                  </p>
                </div>
              </div>
              <label className="flex min-w-[220px] flex-col gap-1 text-xs font-medium text-muted-foreground">
                Performance mode
                <select
                  className="h-10 rounded-md border bg-background px-3 text-sm text-foreground"
                  value={preset}
                  onChange={(event) => setPreset(event.target.value as PerformancePresetId)}
                >
                  {Object.values(PERFORMANCE_PRESETS).map((option) => (
                    <option key={option.preset} value={option.preset}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
              {Object.values(PERFORMANCE_PRESETS).map((option) => (
                <button
                  key={option.preset}
                  type="button"
                  className={`rounded-lg border bg-card p-4 text-left shadow-sm transition ${
                    option.preset === preset ? 'border-primary ring-2 ring-primary/15' : ''
                  }`}
                  onClick={() => setPreset(option.preset)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{option.label}</span>
                    {option.preset === preset && <Badge>Active</Badge>}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {option.description}
                  </p>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Render concurrency: {option.render.renderConcurrency}
                  </p>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-lg border bg-card p-4">
            <h3 className="font-semibold">Local-first workspace</h3>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Printer presets, folders, and shop defaults will stay on this computer. No cloud login
              or payment integration is configured.
            </p>
          </section>
        </CardContent>
      </Card>
    </div>
  )
}
