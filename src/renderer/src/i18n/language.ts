import { messages } from './messages'

export type AppLanguage = 'en' | 'fr' | 'ar'
export const LANGUAGE_STORAGE_KEY = 'my-printer-app.language.v1'
export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'Français' },
  { code: 'ar', name: 'العربية' }
] as const

export function normalizeLanguage(value: unknown): AppLanguage {
  return value === 'fr' || value === 'ar' ? value : 'en'
}

let language: AppLanguage = 'en'
let initialized = false
const listeners = new Set<() => void>()

function applyLanguage(): void {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = language
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
  }
  listeners.forEach((listener) => listener())
}

export function initializeLanguage(): void {
  if (initialized || typeof window === 'undefined') return
  initialized = true
  try {
    language = normalizeLanguage(window.localStorage.getItem(LANGUAGE_STORAGE_KEY))
  } catch {
    language = 'en'
  }
  window.addEventListener('storage', (event) => {
    if (event.key !== null && event.key !== LANGUAGE_STORAGE_KEY) return
    // Clearing storage restores the default language.
    language = normalizeLanguage(event.key === null ? null : event.newValue)
    applyLanguage()
  })
  applyLanguage()
}

export function setLanguage(value: AppLanguage): void {
  initializeLanguage()
  language = normalizeLanguage(value)
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
  } catch {
    // The selection still works for this session if storage is unavailable.
  }
  applyLanguage()
}

export function getLanguage(): AppLanguage {
  return language
}

export function subscribeLanguage(listener: () => void): () => void {
  initializeLanguage()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Only app-owned UI copy belongs here; never translate artwork or customer input. */
export function translate(text: string, locale: AppLanguage = language): string {
  if (locale === 'en') return text
  return messages[text]?.[locale] ?? text
}
