import { ArrowRight, BookOpen, Hash, Lock, PenLine, ShieldCheck, SquareStack } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { PrinterTool } from '@/types/tools'

interface ToolCardProps {
  tool: PrinterTool
  onOpen: () => void
  isCheckingLicense?: boolean
  isLicenseLocked?: boolean
  licenseReason?: string | null
}

const iconByToolId = {
  'sequential-number': Hash,
  'booklet-montage': BookOpen,
  'hardcover-cover': SquareStack,
  'cutter-montage': PenLine
}

const toolPresentation = {
  'sequential-number': {
    surface: 'from-cyan-500/12 via-cyan-500/5 to-transparent',
    icon: 'bg-cyan-700 text-white shadow-cyan-600/25',
    line: 'from-cyan-400 to-cyan-700',
    capabilities: ['Sequential numbers', 'Cut & stack', 'Front & back']
  },
  'booklet-montage': {
    surface: 'from-blue-500/12 via-blue-500/5 to-transparent',
    icon: 'bg-blue-600 text-white shadow-blue-600/25',
    line: 'from-blue-400 to-blue-700',
    capabilities: ['PDF imposition', 'Print preview', 'Production export']
  },
  'hardcover-cover': {
    surface: 'from-violet-500/12 via-violet-500/5 to-transparent',
    icon: 'bg-violet-600 text-white shadow-violet-600/25',
    line: 'from-violet-400 to-violet-700',
    capabilities: ['Cover layout', 'Spine fitting', 'Batch students']
  },
  'cutter-montage': {
    surface: 'from-emerald-500/12 via-emerald-500/5 to-transparent',
    icon: 'bg-emerald-600 text-white shadow-emerald-600/25',
    line: 'from-emerald-400 to-emerald-700',
    capabilities: ['CutContour', 'Auto nesting', 'Mimaki marks']
  }
}

export function ToolCard({
  tool,
  onOpen,
  isCheckingLicense = false,
  isLicenseLocked = false,
  licenseReason
}: ToolCardProps): JSX.Element {
  const Icon = iconByToolId[tool.id as keyof typeof iconByToolId]
  const presentation = toolPresentation[tool.id as keyof typeof toolPresentation]
  const isActive = tool.status === 'active' || tool.status === 'mvp'
  const canOpen = isActive && !isCheckingLicense
  const buttonLabel = getToolButtonLabel({ isActive, isCheckingLicense, isLicenseLocked })

  return (
    <Card
      className={cn(
        'group relative flex min-h-[300px] flex-col overflow-hidden transition duration-300',
        isActive
          ? 'hover:-translate-y-1 hover:border-primary/20 hover:shadow-elevated'
          : 'opacity-95'
      )}
    >
      <div className={cn('absolute inset-x-0 top-0 h-1 bg-gradient-to-r', presentation.line)} />
      <div
        className={cn(
          'pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80',
          presentation.surface
        )}
      />

      <CardHeader className="relative flex-row items-start justify-between gap-4 p-6 pb-4">
        <div
          className={cn(
            'grid size-14 shrink-0 place-items-center rounded-2xl shadow-lg ring-1 ring-white/50 transition-transform duration-300 group-hover:scale-105',
            presentation.icon
          )}
        >
          <Icon className="size-7" aria-hidden="true" />
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {tool.status === 'mvp' ? <Badge variant="warning">MVP Beta</Badge> : null}
          {isActive && isLicenseLocked ? (
            <Badge variant="warning">{licenseReason ?? 'License required'}</Badge>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="relative flex flex-1 flex-col px-6 pb-5 pt-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          Production module
        </p>
        <CardTitle className="mt-2 text-xl leading-7 tracking-[-0.02em]">{tool.title}</CardTitle>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{tool.description}</p>

        <div className="mt-auto flex flex-wrap gap-2 pt-5">
          {presentation.capabilities.map((capability) => (
            <span
              key={capability}
              className="rounded-full border bg-card/75 px-2.5 py-1 text-[11px] font-medium text-muted-foreground shadow-sm"
            >
              {capability}
            </span>
          ))}
        </div>
      </CardContent>

      <CardFooter className="relative border-t border-border/70 bg-card/60 px-6 py-4">
        <Button
          className="w-full justify-between rounded-xl"
          variant={canOpen && !isLicenseLocked ? 'default' : 'secondary'}
          disabled={!canOpen}
          onClick={onOpen}
          aria-label={buttonLabel + ' — ' + tool.shortTitle}
          type="button"
        >
          <span className="flex items-center gap-2">
            {isCheckingLicense ? (
              <ShieldCheck aria-hidden="true" />
            ) : isLicenseLocked || !isActive ? (
              <Lock aria-hidden="true" />
            ) : (
              <Icon aria-hidden="true" />
            )}
            {buttonLabel}
          </span>
          <ArrowRight aria-hidden="true" />
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
  if (!isActive) return 'Coming soon'
  if (isCheckingLicense) return 'Checking access'
  if (isLicenseLocked) return 'View locked tool'
  return 'Open workspace'
}
