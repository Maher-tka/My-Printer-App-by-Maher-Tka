import { ArrowLeft, KeyRound, ShieldCheck } from 'lucide-react'
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

interface LicensePageProps {
  onNavigate: (route: AppRoute) => void
}

export function LicensePage({ onNavigate }: LicensePageProps): JSX.Element {
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
        <CardHeader>
          <CardTitle className="text-xl">License Status</CardTitle>
          <CardDescription>
            Local activation skeleton. No payment, cloud login, or membership
            integration is connected.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-lg border bg-muted/35 p-4">
              <p className="text-sm text-muted-foreground">Current Plan</p>
              <p className="mt-2 text-2xl font-bold text-primary">Trial</p>
            </div>
            <div className="rounded-lg border bg-muted/35 p-4">
              <p className="text-sm text-muted-foreground">Trial Remaining</p>
              <p className="mt-2 text-2xl font-bold">14 days</p>
            </div>
            <div className="rounded-lg border bg-muted/35 p-4">
              <p className="text-sm text-muted-foreground">Activation Mode</p>
              <p className="mt-2 text-2xl font-bold">Local</p>
            </div>
          </div>
          <Button className="w-fit" type="button">
            <KeyRound data-icon="inline-start" />
            Activate Serial Key
          </Button>
          <Empty
            icon={ShieldCheck}
            title="Membership placeholder"
            description="Membership data will be shown here only after local licensing rules are added."
          />
        </CardContent>
      </Card>
    </div>
  )
}
