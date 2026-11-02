import assert from 'node:assert/strict'

const stored = new Map([['my-printer-app.appearance.v1', 'dark']])
const storageListeners: Array<(event: { key: string; newValue: string }) => void> = []
const dataset: Record<string, string> = {}
const classes = new Set<string>()
Object.defineProperty(globalThis, 'window', {
  value: {
    localStorage: {
      getItem: (key: string) => stored.get(key),
      setItem: (key: string, value: string) => stored.set(key, value)
    },
    matchMedia: () => ({ matches: true, addEventListener: () => undefined }),
    addEventListener: (
      _name: string,
      callback: (event: { key: string; newValue: string }) => void
    ) => storageListeners.push(callback)
  },
  configurable: true
})
Object.defineProperty(globalThis, 'document', {
  value: {
    documentElement: {
      dataset,
      classList: {
        toggle: (name: string, value: boolean) => (value ? classes.add(name) : classes.delete(name))
      }
    }
  },
  configurable: true
})
const theme = await import('./theme')
theme.initializeTheme('light')
assert.equal(dataset.theme, 'light')
assert.equal(stored.get(theme.THEME_STORAGE_KEY), 'dark')
storageListeners.forEach((listener) => listener({ key: theme.THEME_STORAGE_KEY, newValue: 'dark' }))
assert.equal(dataset.theme, 'light', 'Other windows cannot override the ID review session')
assert.equal(stored.get(theme.THEME_STORAGE_KEY), 'dark', 'The main app preference remains intact')
console.log('ID review appearance override stays local to the session.')
