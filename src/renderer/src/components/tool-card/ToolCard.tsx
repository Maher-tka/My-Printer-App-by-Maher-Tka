import { ArrowUpRight, BookOpen, Hash, Lock, PenLine, SquareStack } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { PrinterTool } from '@/types/tools'

interface ToolCardProps {
  tool: PrinterTool
  onOpen: () => void
  isCheckingLicense?: boolean
  isLicenseLocked?: boolean
  licenseReason?: string | null
}

const presentations = {
  'booklet-montage': {
    icon: BookOpen,
    title: 'Booklet Montage',
    detail: 'Impose, arrange, and preview your pages.',
    color: 'text-sky-700',
    surface: 'bg-sky-50',
    tag: 'PDF · Images · 3D preview'
  },
  'hardcover-cover': {
    icon: SquareStack,
    title: 'Hardcover Cover',
    detail: 'Build a cover with a perfectly fitted spine.',
    color: 'text-violet-700',
    surface: 'bg-violet-50',
    tag: 'Cover · Spine · Wrap guides'
  },
  'cutter-montage': {
    icon: PenLine,
    title: 'Cutter Montage',
    detail: 'Prepare artwork, cut lines, and sheet layouts.',
    color: 'text-emerald-700',
    surface: 'bg-emerald-50',
    tag: 'AI stickers · CutContour · Nesting'
  },
  'sequential-number': {
    icon: Hash,
    title: 'Sequential Number',
    detail: 'Number tickets and forms, ready to cut & stack.',
    color: 'text-amber-700',
    surface: 'bg-amber-50',
    tag: 'Tickets · Duplex · Cut & stack'
  }
}

export function ToolCard({
  tool,
  onOpen,
  isCheckingLicense = false,
  isLicenseLocked = false,
  licenseReason
}: ToolCardProps): JSX.Element {
  const p = presentations[tool.id as keyof typeof presentations]
  const Icon = p.icon
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
      onClick={onOpen}
      disabled={!active || isCheckingLicense}
      aria-label={`${label} — ${tool.shortTitle}`}
      className="group flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card text-left shadow-panel transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <div
        className={cn(
          'tool-preview relative flex h-[108px] w-full items-center justify-center border-b',
          p.surface,
          p.color
        )}
      >
        <ToolIllustration id={tool.id} />
        {tool.status === 'mvp' && (
          <Badge variant="outline" className="absolute right-3 top-3 bg-card/90 text-[10px]">
            Beta
          </Badge>
        )}
      </div>
      <div className="flex w-full flex-1 flex-col p-4">
        <div className="flex items-center gap-2">
          <Icon className={cn('size-4 shrink-0', p.color)} aria-hidden="true" />
          <h3 className="text-[15px] font-semibold tracking-tight">{p.title}</h3>
          <ArrowUpRight
            className="ml-auto size-4 shrink-0 text-muted-foreground group-hover:text-primary"
            aria-hidden="true"
          />
        </div>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">{p.detail}</p>
        <p className="mt-auto pt-3 text-[10px] font-medium text-muted-foreground">
          {isLicenseLocked ? (
            <span className="flex items-center gap-1.5 text-amber-800">
              <Lock className="size-3" aria-hidden="true" />
              {licenseReason ?? 'License required'}
            </span>
          ) : isCheckingLicense ? (
            'Checking access…'
          ) : !active ? (
            'Coming soon'
          ) : (
            p.tag
          )}
        </p>
      </div>
    </button>
  )
}

/** Local illustrations of each tool's output. No downloads or animation. */
function ToolIllustration({ id }: { id: string }): JSX.Element {
  return (
    <svg
      viewBox="0 0 240 108"
      className="h-full w-full max-w-[260px]"
      fill="none"
      aria-hidden="true"
    >
      {id === 'booklet-montage' ? (
        <>
          <path d="M62 29h126v66H62z" fill="currentColor" opacity=".09" />
          <rect
            x="54"
            y="19"
            width="130"
            height="70"
            rx="3"
            fill="white"
            stroke="currentColor"
            strokeOpacity=".3"
          />
          <path d="M119 19v70" stroke="currentColor" strokeDasharray="3 3" strokeOpacity=".4" />
          <rect x="63" y="28" width="47" height="34" rx="2" fill="currentColor" opacity=".17" />
          <rect x="128" y="28" width="47" height="19" rx="2" fill="currentColor" opacity=".55" />
          <path
            d="M64 70h36m-36 5h26m38-21h45m-45 6h39m-39 6h45m-45 6h32"
            stroke="currentColor"
            strokeOpacity=".3"
            strokeWidth="2"
          />
          <path
            d="M48 19h-6m12-6V7m130 6V7m6 12h6M48 89h-6m12 6v6m130-6v6m6-12h6"
            stroke="currentColor"
            strokeOpacity=".5"
          />
        </>
      ) : id === 'hardcover-cover' ? (
        <>
          <rect x="49" y="17" width="142" height="77" rx="2" fill="currentColor" opacity=".08" />
          <rect
            x="56"
            y="23"
            width="128"
            height="65"
            rx="2"
            fill="white"
            stroke="currentColor"
            strokeOpacity=".3"
          />
          <rect x="111" y="23" width="16" height="65" fill="currentColor" opacity=".8" />
          <rect x="134" y="30" width="42" height="51" rx="1" fill="currentColor" opacity=".14" />
          <circle cx="155" cy="45" r="8" stroke="currentColor" strokeOpacity=".5" />
          <path
            d="M140 62h30m-25 5h20M65 39h35m-35 6h30m-30 6h35m-35 6h21"
            stroke="currentColor"
            strokeOpacity=".4"
            strokeWidth="2"
          />
          <path
            d="M111 12v85m16-85v85"
            stroke="currentColor"
            strokeOpacity=".35"
            strokeDasharray="3 3"
          />
        </>
      ) : id === 'cutter-montage' ? (
        <>
          <rect
            x="57"
            y="12"
            width="126"
            height="85"
            rx="2"
            fill="white"
            stroke="currentColor"
            strokeOpacity=".25"
          />
          <path
            d="M65 26v-6h6m98 0h6v6M65 83v6h6m98 0h6v-6"
            stroke="currentColor"
            strokeWidth="2"
          />
          {[0, 1, 2].map((i) => (
            <g key={i} transform={`translate(${i * 34} 0)`}>
              <circle cx="85" cy="40" r="12" fill="currentColor" opacity=".14" />
              <circle
                cx="85"
                cy="40"
                r="14"
                stroke="currentColor"
                strokeOpacity=".6"
                strokeDasharray="2 2"
              />
              <rect x="73" y="64" width="24" height="16" rx="5" fill="currentColor" opacity=".55" />
              <rect
                x="71"
                y="62"
                width="28"
                height="20"
                rx="7"
                stroke="currentColor"
                strokeOpacity=".6"
                strokeDasharray="2 2"
              />
            </g>
          ))}
        </>
      ) : (
        <>
          {[0, 1, 2].map((i) => (
            <g key={i} transform={`translate(${i * 6} ${i * -6})`}>
              <rect
                x="49"
                y="35"
                width="127"
                height="51"
                rx="4"
                fill="white"
                stroke="currentColor"
                strokeOpacity=".35"
              />
              <path d="M143 35v51" stroke="currentColor" strokeOpacity=".4" strokeDasharray="3 3" />
              <rect x="59" y="46" width="31" height="6" rx="1" fill="currentColor" opacity=".2" />
              <path
                d="M59 71h56m-56 5h36"
                stroke="currentColor"
                strokeOpacity=".2"
                strokeWidth="2"
              />
              <text
                x="104"
                y="62"
                fill="currentColor"
                fontFamily="monospace"
                fontSize="16"
                fontWeight="700"
              >
                00{i + 1}
              </text>
              <text x="151" y="63" fill="currentColor" fontFamily="monospace" fontSize="9">
                0{i + 1}
              </text>
            </g>
          ))}
        </>
      )}
    </svg>
  )
}
