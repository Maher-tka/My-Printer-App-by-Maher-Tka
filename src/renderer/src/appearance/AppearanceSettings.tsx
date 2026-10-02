import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from './useTheme'
import { normalizeThemePreference } from './theme'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'

export function AppearanceSettings(): JSX.Element {
  const { preference, resolved, setPreference } = useTheme()
  const Icon = preference === 'system' ? Monitor : resolved === 'dark' ? Moon : Sun
  return (
    <section aria-labelledby="appearance-title">
      <p className="mb-2 text-xs font-medium text-muted-foreground">Appearance</p>
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground">
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h3 id="appearance-title" className="font-semibold">
              Color theme
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Light, dark, or follow Windows. Print artwork keeps its original colors.
            </p>
          </div>
        </div>
        <Select
          value={preference}
          onValueChange={(value) => setPreference(normalizeThemePreference(value))}
        >
          <SelectTrigger className="w-44" aria-label="Color theme">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="light">Light</SelectItem>
            <SelectItem value="dark">Dark</SelectItem>
            <SelectItem value="system">System</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </section>
  )
}
