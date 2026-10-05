import { useLanguage } from '@/i18n/useLanguage'
import type { ReactNode } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function ToolSettingsTabs({
  label,
  children,
  advanced,
  direction: directionOverride
}: {
  label: string
  children: ReactNode
  advanced: ReactNode
  direction?: 'ltr' | 'rtl'
}): JSX.Element {
  const { t, direction } = useLanguage()

  return (
    <Tabs defaultValue="setup" dir={directionOverride ?? direction} className="w-full min-w-0">
      <TabsList className="grid w-full grid-cols-2" aria-label={t(label)}>
        <TabsTrigger value="setup">{t('Setup')}</TabsTrigger>
        <TabsTrigger value="advanced">{t('Advanced')}</TabsTrigger>
      </TabsList>
      <TabsContent value="setup" className="mt-4 space-y-4">
        {children}
      </TabsContent>
      <TabsContent value="advanced" className="mt-4 space-y-4">
        {advanced}
      </TabsContent>
    </Tabs>
  )
}
