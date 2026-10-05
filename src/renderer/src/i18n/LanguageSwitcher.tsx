import { Languages } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { LANGUAGES, normalizeLanguage } from './language'
import { useLanguage } from './useLanguage'

export function LanguageSwitcher({ dashboard = false }: { dashboard?: boolean }): JSX.Element {
  const { language, direction, setLanguage, t } = useLanguage()
  return (
    <Select
      value={language}
      onValueChange={(value) => setLanguage(normalizeLanguage(value))}
      dir={direction}
    >
      <SelectTrigger
        aria-label={t('App language')}
        title={t('App language')}
        className={
          dashboard
            ? 'h-9 w-auto gap-2 rounded-full border-0 bg-transparent px-3 text-xs shadow-none hover:bg-accent/60'
            : 'h-9 w-auto gap-2 rounded-full bg-transparent px-3 text-xs'
        }
      >
        <Languages className="size-4 shrink-0" aria-hidden="true" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {LANGUAGES.map(({ code, name }) => (
          <SelectItem key={code} value={code}>
            <span lang={code} dir={code === 'ar' ? 'rtl' : 'ltr'}>
              {name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
