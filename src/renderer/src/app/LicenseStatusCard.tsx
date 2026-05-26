import { KeyRound, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface LicenseStatusCardProps {
  onActivate: () => void
}

export function LicenseStatusCard({
  onActivate
}: LicenseStatusCardProps): JSX.Element {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-6 p-5">
        <div className="flex items-center gap-5">
          <div className="grid size-[72px] place-items-center rounded-lg bg-primary/10 text-primary">
            <ShieldCheck className="size-10" aria-hidden="true" />
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-muted-foreground">
              License Status
            </p>
            <p className="text-xl font-bold">
              Current Plan: <span className="text-primary">Trial</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Trial period ends in <span className="font-semibold text-primary">14 days</span>
            </p>
          </div>
        </div>
        <Button size="lg" onClick={onActivate} type="button">
          <KeyRound data-icon="inline-start" />
          Activate Serial Key
        </Button>
      </CardContent>
    </Card>
  )
}
