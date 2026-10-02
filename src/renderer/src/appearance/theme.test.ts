import assert from 'node:assert/strict'

// Exercise real preference storage, cross-window events and OS theme changes.
const stored = new Map<string, string>([['my-printer-app.appearance.v1', 'dark']])
const mediaListeners = new Set<() => void>()
const storageListeners = new Set<(event: { key: string | null; newValue: string | null }) => void>()
let systemDark = false
let storageBlocked = false
const classes = new Set<string>()
const dataset: Record<string, string> = {}
const fakeWindow = {
  localStorage: {
    getItem: (key: string) => {
      if (storageBlocked) throw new Error('blocked')
      return stored.get(key) ?? null
    },
    setItem: (key: string, value: string) => {
      if (storageBlocked) throw new Error('blocked')
      stored.set(key, value)
    }
  },
  matchMedia: () => ({
    get matches() {
      return systemDark
    },
    addEventListener: (_: string, callback: () => void) => mediaListeners.add(callback)
  }),
  addEventListener: (
    _: string,
    callback: (event: { key: string | null; newValue: string | null }) => void
  ) => storageListeners.add(callback)
}
Object.defineProperty(globalThis, 'window', { value: fakeWindow, configurable: true })
Object.defineProperty(globalThis, 'document', {
  value: {
    documentElement: {
      dataset,
      classList: {
        toggle: (name: string, enabled: boolean) => {
          if (enabled) classes.add(name)
          else classes.delete(name)
        }
      }
    }
  },
  configurable: true
})

const theme = await import('./theme')
theme.initializeTheme()
assert.equal(dataset.theme, 'dark', 'Saved preference applies before React renders')
assert.equal(dataset.themePreference, 'dark')
assert.ok(classes.has('dark'))
theme.initializeTheme()
assert.equal(mediaListeners.size, 1, 'Initialization never duplicates the OS listener')

let notifications = 0
const unsubscribe = theme.subscribeTheme(() => notifications++)
theme.setThemePreference('light')
assert.equal(stored.get(theme.THEME_STORAGE_KEY), 'light')
assert.equal(dataset.theme, 'light')
assert.ok(!classes.has('dark'))
theme.setThemePreference('system')
systemDark = true
mediaListeners.forEach((listener) => listener())
assert.equal(dataset.theme, 'dark', 'System mode responds to Windows changes')
theme.setThemePreference('light')
systemDark = false
mediaListeners.forEach((listener) => listener())
assert.equal(dataset.theme, 'light', 'Explicit selection wins over OS changes')

storageListeners.forEach((listener) => listener({ key: theme.THEME_STORAGE_KEY, newValue: 'dark' }))
assert.equal(theme.getThemePreference(), 'dark', 'Another window can update the appearance')
assert.equal(dataset.theme, 'dark')
storageListeners.forEach((listener) => listener({ key: 'my-printer-app.jobs.v1', newValue: '[]' }))
assert.equal(dataset.theme, 'dark', 'Unrelated shop data never changes the theme')
storageListeners.forEach((listener) =>
  listener({ key: theme.THEME_STORAGE_KEY, newValue: 'unexpected' })
)
assert.equal(theme.getThemePreference(), 'system')
assert.equal(dataset.theme, 'light')

storageBlocked = true
assert.doesNotThrow(() => theme.setThemePreference('dark'))
assert.equal(dataset.theme, 'dark', 'A blocked store still allows a session theme')
assert.ok(notifications > 0)
unsubscribe()
const before = notifications
theme.setThemePreference('light')
assert.equal(notifications, before, 'Unmounted controls receive no updates')
assert.equal(theme.normalizeThemePreference(null), 'system')
assert.equal(theme.resolveTheme('system', true), 'dark')
console.log('Theme persistence, system preference, cross-window and storage fallback tests passed.')
