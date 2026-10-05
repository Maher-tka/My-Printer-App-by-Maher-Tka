import assert from 'node:assert/strict'
import { messages } from './messages'

const stored = new Map<string, string>([['my-printer-app.language.v1', 'fr']])
const storageListeners = new Set<(event: { key: string | null; newValue: string | null }) => void>()
let blocked = false
const root = { lang: '', dir: '' }
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    localStorage: {
      getItem(key: string) {
        if (blocked) throw new Error('Storage blocked')
        return stored.get(key) ?? null
      },
      setItem(key: string, value: string) {
        if (blocked) throw new Error('Storage blocked')
        stored.set(key, value)
      }
    },
    addEventListener(
      _: string,
      listener: (event: { key: string | null; newValue: string | null }) => void
    ) {
      storageListeners.add(listener)
    }
  }
})
Object.defineProperty(globalThis, 'document', {
  configurable: true,
  value: { documentElement: root }
})

const language = await import('./language')
language.initializeLanguage()
assert.equal(language.getLanguage(), 'fr', 'Restore the saved preference before rendering')
assert.equal(root.lang, 'fr')
assert.equal(root.dir, 'ltr')
assert.equal(language.translate('Settings'), 'Paramètres')
language.initializeLanguage()
assert.equal(storageListeners.size, 1, 'Initialization is idempotent')

let notifications = 0
const unsubscribe = language.subscribeLanguage(() => notifications++)
language.setLanguage('ar')
assert.equal(root.lang, 'ar')
assert.equal(root.dir, 'rtl')
assert.equal(stored.get(language.LANGUAGE_STORAGE_KEY), 'ar')
assert.equal(language.translate('Settings'), 'الإعدادات')
assert.equal(language.translate('Customer artwork.pdf'), 'Customer artwork.pdf')
assert.equal(language.translate('Settings', 'en'), 'Settings')

storageListeners.forEach((listener) => listener({ key: 'shop.jobs', newValue: '[]' }))
assert.equal(language.getLanguage(), 'ar', 'Shop data never changes the selected language')
storageListeners.forEach((listener) =>
  listener({ key: language.LANGUAGE_STORAGE_KEY, newValue: 'fr' })
)
assert.equal(language.getLanguage(), 'fr', 'Language changes synchronize across windows')
storageListeners.forEach((listener) => listener({ key: null, newValue: null }))
assert.equal(language.getLanguage(), 'en', 'Clearing storage restores English')
assert.equal(root.dir, 'ltr', 'Leaving Arabic resets direction')

blocked = true
assert.doesNotThrow(() => language.setLanguage('ar'))
assert.equal(root.dir, 'rtl', 'Language works for the session with storage blocked')
assert.ok(notifications > 0)
unsubscribe()
const before = notifications
language.setLanguage('en')
assert.equal(notifications, before)
assert.equal(language.normalizeLanguage('de'), 'en')
assert.equal(language.normalizeLanguage(null), 'en')
assert.equal(language.normalizeLanguage('fr'), 'fr')
for (const [key, value] of Object.entries(messages)) {
  assert.ok(value.fr.trim(), `Missing French translation for ${key}`)
  assert.match(value.ar, /[\u0600-\u06ff]/u, `Missing Arabic translation for ${key}`)
}
console.log(
  `Language persistence, RTL, window synchronization, fallback and ${Object.keys(messages).length} translations passed.`
)
