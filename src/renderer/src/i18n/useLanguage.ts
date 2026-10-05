import { useSyncExternalStore } from 'react'
import { getLanguage, setLanguage, subscribeLanguage, translate } from './language'

export function useLanguage() {
  const language = useSyncExternalStore(subscribeLanguage, getLanguage, () => 'en' as const)
  return {
    language,
    direction: language === 'ar' ? ('rtl' as const) : ('ltr' as const),
    setLanguage,
    t: (text: string) => translate(text, language)
  }
}
