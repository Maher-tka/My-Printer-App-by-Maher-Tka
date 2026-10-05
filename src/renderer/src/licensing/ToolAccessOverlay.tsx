import { useLanguage } from '@/i18n/useLanguage'
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
  const { t } = useLanguage()

  const Icon = isChecking ? ShieldCheck : LockKeyhole

  return (
    <div className="mx-auto grid min-h-[620px] max-w-[1680px] place-items-center rounded-3xl border bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.12),_transparent_55%),hsl(var(--muted)/0.45)] p-6">
      <Card className="w-full max-w-xl shadow-elevated">
        <CardHeader className="items-center text-center">
          <div className="mb-2 grid size-14 place-items-center rounded-full bg-amber-100 text-amber-700">
            <Icon className="size-7" aria-hidden="true" />
          </div>
          <CardTitle>{isChecking ? t('Checking access') : `${toolName} is locked`}</CardTitle>
          <CardDescription>
            {isChecking
              ? 'The access check is still in progress.'
              : `${reason ?? 'Active access is required'}. Your saved projects remain available when access is restored.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap justify-center gap-3">
          <Button type="button" variant="outline" onClick={onBack}>
            {t('Back to Dashboard')}
          </Button>
          <Button type="button" onClick={onManageLicense} disabled={isChecking}>
            {t('Manage Subscription')}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
