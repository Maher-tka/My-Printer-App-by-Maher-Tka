import { useLanguage } from '@/i18n/useLanguage'
import { AlertTriangle, KeyRound, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  formatDateTime,
  getLicenseSummary,
  getLicenseTone,
  getPlanDisplayName
} from '@/licensing/license-format'
import type { LicenseSnapshot } from '../../../shared/licensing-types'

interface LicenseStatusCardProps {
  licenseState: LicenseSnapshot | null
  isLoading: boolean
  error: string | null
  onActivate: () => void
}

export function LicenseStatusCard({
  licenseState,
  isLoading,
  error,
  onActivate
}: LicenseStatusCardProps): JSX.Element {
  const { t } = useLanguage()

  const tone = getLicenseTone(licenseState)
  const isExpired = licenseState?.mode === 'expired'
  const Icon = error || isExpired ? AlertTriangle : ShieldCheck
  const planLabel = licenseState
    ? getPlanDisplayName(licenseState.mode, licenseState.planLabel)
    : 'Checking'

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-6 p-5">
        <div className="flex items-center gap-5">
          <div className="grid size-[72px] place-items-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-10" aria-hidden="true" />
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-muted-foreground">{t('Access Status')}</p>
              <Badge variant={tone}>
                {isLoading && !licenseState
                  ? t('Checking')
                  : (licenseState?.statusLabel ?? 'Unavailable')}
              </Badge>
            </div>
            <p className="text-xl font-bold">
              {t('Current Plan:')} <span className="text-primary">{planLabel}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              {error ? error : getLicenseSummary(licenseState)}
            </p>
            {licenseState && (
              <p className="text-xs text-muted-foreground">
                {t('Trial ends')} {formatDateTime(licenseState.trial.endsAt)}
              </p>
            )}
          </div>
        </div>
        <Button
          size="lg"
          variant={licenseState?.mode === 'activated' ? 'outline' : 'default'}
          onClick={onActivate}
          type="button"
        >
          <KeyRound data-icon="inline-start" />
          {licenseState?.mode === 'activated' ? t('Manage Subscription') : 'Activate Subscription'}
        </Button>
      </CardContent>
    </Card>
  )
}
