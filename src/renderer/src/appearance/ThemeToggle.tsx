import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from './useTheme'

export function ThemeToggle({ dashboard = false }: { dashboard?: boolean }): JSX.Element {
  const { resolved, setPreference } = useTheme()
  const label = resolved === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      className={dashboard ? 'dashboard-header-icon' : 'rounded-full'}
      aria-label={label}
      title={label}
      onClick={() => setPreference(resolved === 'dark' ? 'light' : 'dark')}
    >
      {resolved === 'dark' ? (
        <Sun className="size-4" aria-hidden="true" />
      ) : (
        <Moon className="size-4" aria-hidden="true" />
      )}
    </Button>
  )
}
