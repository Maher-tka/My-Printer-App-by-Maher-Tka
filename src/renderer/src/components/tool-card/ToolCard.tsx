import { useLanguage } from '@/i18n/useLanguage'
import {
  ArrowUpRight,
  BookOpen,
  CreditCard,
  Hash,
  Lock,
  PenLine,
  LoaderCircle,
  SquareStack
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PrinterTool } from '@/types/tools'

interface ToolCardProps {
  tool: PrinterTool
  onOpen: () => void
  isCheckingLicense?: boolean
  isLicenseLocked?: boolean
  licenseReason?: string | null
}
const icons = {
  'card-montage': CreditCard,
  'sequential-number': Hash,
  'booklet-montage': BookOpen,
  'hardcover-cover': SquareStack,
  'cutter-montage': PenLine
}

export function ToolCard({
  tool,
  onOpen,
  isCheckingLicense = false,
  isLicenseLocked = false,
  licenseReason
}: ToolCardProps): JSX.Element {
  const { t } = useLanguage()

  const Icon = icons[tool.id as keyof typeof icons] ?? FileIcon
  const active = tool.status === 'active' || tool.status === 'mvp'
  const label = !active
    ? 'Coming soon'
    : isCheckingLicense
      ? 'Checking access'
      : isLicenseLocked
        ? 'View locked tool'
        : 'Open workspace'
  return (
    <button
      type="button"
      disabled={!active || isCheckingLicense}
      onClick={onOpen}
      aria-label={label + ' — ' + tool.shortTitle}
      title={isLicenseLocked ? (licenseReason ?? 'License required') : tool.title}
      className={cn(
        'group flex w-full items-start gap-3 rounded-[var(--ui-radius-lg)] border border-[var(--ui-border)] bg-card/55 p-4 text-left transition-colors ui-transition hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-55'
      )}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-primary">
        <Icon className="size-[18px]" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold">{t(tool.shortTitle)}</span>
        {tool.status === 'mvp' && (
          <span className="mt-1 block text-[11px] text-muted-foreground">Beta</span>
        )}
      </span>
      <span className="mt-1.5 text-primary/70">
        {isCheckingLicense ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        ) : isLicenseLocked ? (
          <Lock className="size-4" aria-hidden="true" />
        ) : (
          <ArrowUpRight className="size-4" aria-hidden="true" />
        )}
      </span>
    </button>
  )
}
const FileIcon = BookOpen
