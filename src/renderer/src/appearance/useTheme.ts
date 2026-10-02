import { useSyncExternalStore } from 'react'
import { getResolvedTheme, getThemePreference, setThemePreference, subscribeTheme } from './theme'

export function useTheme() {
  const preference = useSyncExternalStore(
    subscribeTheme,
    getThemePreference,
    () => 'system' as const
  )
  const resolved = useSyncExternalStore(subscribeTheme, getResolvedTheme, () => 'light' as const)
  return { preference, resolved, setPreference: setThemePreference }
}
