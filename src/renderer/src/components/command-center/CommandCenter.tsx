import {
  Activity,
  BookOpenCheck,
  BriefcaseBusiness,
  FileImage,
  FolderOpen,
  Gauge,
  HeartPulse,
  Hash,
  Home,
  KeyRound,
  Search,
  Settings,
  Shapes,
  X
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { AppRoute } from '@/types/navigation'
import {
  findCustomerJobs,
  normalizeSearch,
  productionTasks,
  searchScore
} from '@/assistant/taskMatching'
import { useJobStore } from '@/jobs/useJobStore'
import { statusLabel } from '@/jobs/jobWorkflow'

interface CommandCenterProps {
  open: boolean
  activeRoute: AppRoute
  onOpenChange: (open: boolean) => void
  onNavigate: (route: AppRoute) => void
  onOpenProject: () => void
  onOpenImageFile: () => void
  onOpenJob: (jobId: string) => void
  isDeveloperMode?: boolean
}

interface CommandItem {
  id: string
  label: string
  description: string
  keywords: string
  icon: typeof Home
  route?: AppRoute
  action?: 'open-project' | 'open-image'
  developerOnly?: boolean
  jobId?: string
}

const commands: CommandItem[] = [
  {
    id: 'sequential-number',
    label: 'Sequential Number',
    description: 'Number tickets and invoices, ready to cut and stack',
    keywords: 'ticket invoice facture numbering serial batch duplex stub raffle',
    icon: Hash,
    route: 'sequential-number'
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    description: 'Return to the shop overview',
    keywords: 'home overview',
    icon: Home,
    route: 'dashboard'
  },
  {
    id: 'open-project',
    label: 'Open Saved Project',
    description: 'Choose a local .mpjob file',
    keywords: 'recent job file browse load',
    icon: FolderOpen,
    action: 'open-project'
  },
  {
    id: 'open-image',
    label: 'Open Image File',
    description: 'Edit PNG, JPG, or SVG artwork in Cutter Montage',
    keywords: 'image artwork png jpg jpeg svg cutter import',
    icon: FileImage,
    action: 'open-image'
  },
  {
    id: 'booklet',
    label: 'Booklet Montage',
    description: 'Impose and prepare booklet sheets',
    keywords: 'pdf imposition print',
    icon: BookOpenCheck,
    route: 'booklet-montage'
  },
  {
    id: 'hardcover',
    label: 'Hardcover Cover Sheet',
    description: 'Build a production-ready cover sheet',
    keywords: 'cover spine pdf board',
    icon: Gauge,
    route: 'hardcover-cover'
  },
  {
    id: 'cutter',
    label: 'Cutter Montage',
    description: 'Prepare plotter and cut-sheet layouts',
    keywords: 'cut plotter nesting pieces',
    icon: Shapes,
    route: 'cutter-montage'
  },
  {
    id: 'jobs',
    label: 'Shop Jobs',
    description: 'Review customer work and production history',
    keywords: 'customers quotes history',
    icon: BriefcaseBusiness,
    route: 'jobs'
  },
  {
    id: 'exports',
    label: 'Export Center',
    description: 'Find and reprint production files',
    keywords: 'pdf output history print',
    icon: Activity,
    route: 'exports'
  },
  {
    id: 'health',
    label: 'App Health',
    description: 'Inspect diagnostics and recovery status',
    keywords: 'errors autosave diagnostics recovery',
    icon: HeartPulse,
    route: 'app-health'
  },
  {
    id: 'license',
    label: 'License',
    description: 'Manage local activation',
    keywords: 'serial trial activation',
    icon: KeyRound,
    route: 'license'
  },
  {
    id: 'settings',
    label: 'Settings',
    description: 'Change local workspace preferences',
    keywords: 'preferences performance',
    icon: Settings,
    route: 'settings'
  },
  {
    id: 'quality',
    label: 'Quality Lab',
    description: 'Run development release checks',
    keywords: 'developer testing checks',
    icon: Activity,
    route: 'quality-lab',
    developerOnly: true
  }
]

export function CommandCenter({
  open,
  activeRoute,
  onOpenChange,
  onNavigate,
  onOpenProject,
  onOpenImageFile,
  onOpenJob,
  isDeveloperMode = false
}: CommandCenterProps): JSX.Element | null {
  const [query, setQuery] = useState('')
  const { jobs } = useJobStore()
  const [selectedIndex, setSelectedIndex] = useState(0)
  const dialogRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const filteredCommands = useMemo(() => {
    const available = commands.filter((command) => !command.developerOnly || isDeveloperMode)
    if (!query.trim()) return available
    const rankedCommands = available
      .map((command) => {
        const task = productionTasks.find((item) => item.route === command.route)
        const keywords = `${command.description} ${command.keywords} ${task?.keywords ?? ''}`
        const normalizedQuery = normalizeSearch(query)
        const exact =
          normalizedQuery.length > 0 &&
          normalizeSearch(`${command.label} ${keywords}`).includes(normalizedQuery)
        return { command, score: searchScore(query, command.label, keywords) + (exact ? 30 : 0) }
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
    // Customer records use literal tokens: never suggest a different person through fuzzy matching.
    const matchingJobs: CommandItem[] = findCustomerJobs(jobs, query)
      .slice(0, 8)
      .map((job) => ({
        id: `job-${job.id}`,
        jobId: job.id,
        label: job.jobTitle,
        description: `${job.customerName || 'No customer'} · ${statusLabel(job.status)}${job.deadline ? ` · Due ${job.deadline}` : ''}`,
        keywords: '',
        icon: BriefcaseBusiness
      }))
    return [...matchingJobs, ...rankedCommands.map(({ command }) => command)]
  }, [isDeveloperMode, query, jobs])

  useEffect(() => {
    if (!open) return
    setQuery('')
    setSelectedIndex(0)
    const previouslyFocused = document.activeElement as HTMLElement | null
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => {
      window.clearTimeout(timer)
      previouslyFocused?.focus()
    }
  }, [open])

  useEffect(() => {
    setSelectedIndex((current) => Math.min(current, Math.max(filteredCommands.length - 1, 0)))
  }, [filteredCommands.length])

  useEffect(() => {
    if (!open) return
    dialogRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [open, selectedIndex])

  const runCommand = (command: CommandItem): void => {
    onOpenChange(false)
    if (command.jobId) onOpenJob(command.jobId)
    else if (command.action === 'open-project') onOpenProject()
    else if (command.action === 'open-image') onOpenImageFile()
    else if (command.route) onNavigate(command.route)
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-slate-950/20 px-3 pt-[12vh]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onOpenChange(false)
      }}
    >
      <div
        ref={dialogRef}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation()
            onOpenChange(false)
          }
          if (event.key === 'Tab') {
            const controls = dialogRef.current?.querySelectorAll<HTMLElement>(
              'input, button:not([tabindex="-1"])'
            )
            if (!controls?.length) return
            const first = controls[0]
            const last = controls[controls.length - 1]
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault()
              last.focus()
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault()
              first.focus()
            }
          }
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Command Center"
        className="w-full max-w-2xl overflow-hidden rounded-[var(--ui-radius-xl)] border border-[var(--ui-border)] bg-popover shadow-elevated"
      >
        <div className="flex items-center gap-3 border-b px-4">
          <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            ref={inputRef}
            role="combobox"
            aria-label="Search tools and customer jobs"
            aria-autocomplete="list"
            aria-expanded="true"
            aria-controls="command-results"
            aria-activedescendant={
              filteredCommands[selectedIndex]
                ? 'command-' + filteredCommands[selectedIndex].id
                : undefined
            }
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setSelectedIndex(0)
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setSelectedIndex((index) =>
                  Math.max(0, Math.min(index + 1, filteredCommands.length - 1))
                )
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault()
                setSelectedIndex((index) => Math.max(index - 1, 0))
              }
              if (event.key === 'Enter' && filteredCommands[selectedIndex]) {
                event.preventDefault()
                event.stopPropagation()
                if (event.nativeEvent.isComposing || event.repeat) return
                runCommand(filteredCommands[selectedIndex])
              }
            }}
            placeholder="Describe a task, or find a customer / job…"
            className="h-12 min-w-0 flex-1 bg-transparent text-base font-medium outline-none placeholder:text-muted-foreground"
          />
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close Command Center"
          >
            <X className="size-4" />
          </button>
        </div>

        <div
          id="command-results"
          aria-label="Tools and customer jobs"
          className="max-h-[55vh] overflow-y-auto p-2"
          role="listbox"
        >
          {filteredCommands.map((command, index) => {
            const Icon = command.icon
            const isActive = command.route === activeRoute
            const isSelected = index === selectedIndex
            return (
              <button
                key={command.id}
                id={'command-' + command.id}
                tabIndex={-1}
                type="button"
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setSelectedIndex(index)}
                onClick={() => runCommand(command)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition ${
                  isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
                }`}
              >
                <span
                  className={`grid size-9 shrink-0 place-items-center rounded-lg ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                >
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    {command.label}
                    {command.jobId ? (
                      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        Job
                      </span>
                    ) : null}
                    {isActive ? (
                      <span className="rounded-full bg-success px-2 py-0.5 text-[10px] font-bold uppercase text-success-foreground">
                        Current
                      </span>
                    ) : null}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {command.description}
                  </span>
                </span>
                <span className="text-xs font-medium text-muted-foreground">↵</span>
              </button>
            )
          })}
          {filteredCommands.length === 0 ? (
            <div role="status" className="px-4 py-10 text-center text-sm text-muted-foreground">
              No match for “{query}”. Try a product name, customer name, or phone number.
            </div>
          ) : null}
        </div>
        <div className="flex items-center justify-between border-t bg-muted/40 px-4 py-2 text-[11px] font-medium text-muted-foreground">
          <span>↑↓ Navigate · Enter Open · Esc Close</span>
          <span>Command Center</span>
        </div>
      </div>
    </div>
  )
}
