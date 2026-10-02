export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'
export const THEME_STORAGE_KEY = 'my-printer-app.appearance.v1'

export function normalizeThemePreference(value: unknown): ThemePreference {
  return value === 'light' || value === 'dark' ? value : 'system'
}

export function resolveTheme(preference: ThemePreference, systemDark: boolean): ResolvedTheme {
  return preference === 'system' ? (systemDark ? 'dark' : 'light') : preference
}

let preference: ThemePreference = 'system'
let resolved: ResolvedTheme = 'light'
let initialized = false
let media: MediaQueryList | null = null
const listeners = new Set<() => void>()

function applyTheme(): void {
  resolved = resolveTheme(preference, media?.matches ?? false)
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = resolved
    document.documentElement.dataset.themePreference = preference
    document.documentElement.classList.toggle('dark', resolved === 'dark')
  }
  listeners.forEach((listener) => listener())
}

export function initializeTheme(): void {
  if (initialized || typeof window === 'undefined') return
  initialized = true
  try {
    preference = normalizeThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY))
  } catch {
    preference = 'system'
  }
  media = window.matchMedia('(prefers-color-scheme: dark)')
  media.addEventListener('change', () => {
    if (preference === 'system') applyTheme()
  })
  window.addEventListener('storage', (event) => {
    if (event.key !== null && event.key !== THEME_STORAGE_KEY) return
    preference = normalizeThemePreference(event.newValue)
    applyTheme()
  })
  applyTheme()
}

export function setThemePreference(value: ThemePreference): void {
  initializeTheme()
  preference = normalizeThemePreference(value)
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    /* Keep the theme usable for this session when storage is unavailable. */
  }
  applyTheme()
}

export function getThemePreference(): ThemePreference {
  return preference
}
export function getResolvedTheme(): ResolvedTheme {
  return resolved
}
export function subscribeTheme(listener: () => void): () => void {
  initializeTheme()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
