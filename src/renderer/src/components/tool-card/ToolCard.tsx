import { BookOpen, ExternalLink, Lock, PenLine, SquareStack } from 'lucide-react'
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

export function ToolCard({ tool, onOpen }: ToolCardProps): JSX.Element {
  const Icon = iconByToolId[tool.id as keyof typeof iconByToolId]
  const isActive = tool.status === 'active'

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
        {!isActive && (
          <Badge variant={tool.accent === 'green' ? 'success' : 'secondary'}>
            Coming Soon
          </Badge>
        )}
      </CardHeader>
      <CardContent className="mt-auto px-5 pb-4 pt-0">
        <div className="h-px bg-border" />
      </CardContent>
      <CardFooter className="px-5 pb-5 pt-0">
        <Button
          className="w-full"
          variant={isActive ? 'default' : 'secondary'}
          disabled={!isActive}
          onClick={onOpen}
          type="button"
        >
          {isActive ? (
            <ExternalLink data-icon="inline-start" />
          ) : (
            <Lock data-icon="inline-start" />
          )}
          {isActive ? 'Open Tool' : 'Coming Soon'}
        </Button>
      </CardFooter>
    </Card>
  )
}
