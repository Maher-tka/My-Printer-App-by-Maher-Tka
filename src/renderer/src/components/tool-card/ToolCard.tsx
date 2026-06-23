import {
  BookOpen,
  ExternalLink,
  Lock,
  PenLine,
  ShieldCheck,
  SquareStack
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { PrinterTool } from '@/types/tools'

interface ToolCardProps {
  tool: PrinterTool
  onOpen: () => void
  isCheckingLicense?: boolean
  isLicenseLocked?: boolean
  licenseReason?: string | null
  onManageLicense?: () => void
}

const iconByToolId = {
  'booklet-montage': BookOpen,
  'hardcover-cover': SquareStack,
  'cutter-montage': PenLine
}

const accentClasses: Record<PrinterTool['accent'], string> = {
  blue: 'bg-primary/10 text-primary',
  violet: 'bg-violet-100 text-violet-700',
  green: 'bg-emerald-100 text-emerald-700'
}

export function ToolCard({
  tool,
  onOpen,
  isCheckingLicense = false,
  isLicenseLocked = false,
  licenseReason,
  onManageLicense
}: ToolCardProps): JSX.Element {
  const Icon = iconByToolId[tool.id as keyof typeof iconByToolId]
  const isActive = tool.status === 'active' || tool.status === 'mvp'
  const canOpen = isActive && !isCheckingLicense && !isLicenseLocked
  const canManageLicense = isActive && isLicenseLocked && Boolean(onManageLicense)
  const isButtonDisabled = !isActive || isCheckingLicense || (!canOpen && !canManageLicense)
  const ButtonIcon = isCheckingLicense
    ? ShieldCheck
    : isLicenseLocked
      ? Lock
      : isActive
        ? ExternalLink
        : Lock
  const buttonLabel = getToolButtonLabel({
    isActive,
    isCheckingLicense,
    isLicenseLocked
  })

  return (
    <Card
      className={cn(
        'flex min-h-[218px] flex-col shadow-panel transition',
        isActive ? 'hover:-translate-y-0.5' : 'opacity-95'
      )}
    >
      <CardHeader className="flex-row items-start justify-between gap-4 p-5">
        <div className="flex items-start gap-4">
          <div
            className={cn(
              'grid size-16 shrink-0 place-items-center rounded-lg',
              accentClasses[tool.accent]
            )}
          >
            <Icon className="size-8" aria-hidden="true" />
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <CardTitle className="leading-6">{tool.title}</CardTitle>
            <p className="text-sm leading-6 text-muted-foreground">
              {tool.description}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {tool.status !== 'active' && (
            <Badge variant={tool.accent === 'green' ? 'success' : 'secondary'}>
              {tool.status === 'mvp' ? 'MVP Beta' : 'Coming Soon'}
            </Badge>
          )}
          {isActive && isLicenseLocked && (
            <Badge variant="warning">{licenseReason ?? 'License Required'}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="mt-auto px-5 pb-4 pt-0">
        <div className="h-px bg-border" />
      </CardContent>
      <CardFooter className="px-5 pb-5 pt-0">
        <Button
          className="w-full"
          variant={canOpen ? 'default' : 'secondary'}
          disabled={isButtonDisabled}
          onClick={canManageLicense ? onManageLicense : onOpen}
          type="button"
        >
          <ButtonIcon data-icon="inline-start" />
          {buttonLabel}
        </Button>
      </CardFooter>
    </Card>
  )
}

function getToolButtonLabel({
  isActive,
  isCheckingLicense,
  isLicenseLocked
}: {
  isActive: boolean
  isCheckingLicense: boolean
  isLicenseLocked: boolean
}): string {
  if (!isActive) {
    return 'Coming Soon'
  }

  if (isCheckingLicense) {
    return 'Checking License'
  }

  if (isLicenseLocked) {
    return 'Activate License'
  }

  return 'Open Tool'
}
