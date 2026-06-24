import { LockKeyhole, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface ToolAccessOverlayProps {
  toolName: string
  isChecking: boolean
  reason: string | null
  onBack: () => void
  onManageLicense: () => void
}

export function ToolAccessOverlay({
  toolName,
  isChecking,
  reason,
  onBack,
  onManageLicense
}: ToolAccessOverlayProps): JSX.Element {
  const Icon = isChecking ? ShieldCheck : LockKeyhole

  return (
    <div className="mx-auto grid min-h-[620px] max-w-[1680px] place-items-center rounded-xl border bg-muted/40 p-6">
      <Card className="w-full max-w-xl shadow-panel">
        <CardHeader className="items-center text-center">
          <div className="mb-2 grid size-14 place-items-center rounded-full bg-amber-100 text-amber-700">
            <Icon className="size-7" aria-hidden="true" />
          </div>
          <CardTitle>{isChecking ? 'Checking local license' : `${toolName} is locked`}</CardTitle>
          <CardDescription>
            {isChecking
              ? 'The local license check is still in progress.'
              : `${reason ?? 'A valid license is required'}. Your project stays on this tool and unlocks immediately after activation.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap justify-center gap-3">
          <Button type="button" variant="outline" onClick={onBack}>
            Back to Dashboard
          </Button>
          <Button type="button" onClick={onManageLicense} disabled={isChecking}>
            Manage License
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
