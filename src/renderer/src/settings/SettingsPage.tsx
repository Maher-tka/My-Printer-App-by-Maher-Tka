import { ArrowLeft, Database, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Empty } from '@/components/ui/empty'
import type { AppRoute } from '@/types/navigation'

interface SettingsPageProps {
  onNavigate: (route: AppRoute) => void
}

export function SettingsPage({ onNavigate }: SettingsPageProps): JSX.Element {
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
            <CardDescription>
              Placeholder for local workspace paths, printer presets, units, and
              shop defaults.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Empty
            icon={Database}
            title="No settings configured yet"
            description="Future preferences will stay local to this desktop app. No online login or cloud account is configured."
          />
        </CardContent>
      </Card>
    </div>
  )
}
