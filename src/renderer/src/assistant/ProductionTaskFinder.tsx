import { useLanguage } from '@/i18n/useLanguage'
import { ArrowRight, Search, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { findProductionTasks } from './taskMatching'
import type { AppRoute } from '@/types/navigation'

export function TaskFinder({ onNavigate }: { onNavigate: (route: AppRoute) => void }): JSX.Element {
  const { t } = useLanguage()

  const [query, setQuery] = useState('')
  const suggestions = query.trim() ? findProductionTasks(query) : []
  return (
    <section
      aria-labelledby="task-finder-title"
      className="h-full rounded-[var(--ui-radius-xl)] border border-[var(--ui-border)] bg-[var(--ui-surface)] p-5"
    >
      <div className="mb-2 flex items-center gap-2 text-primary">
        <Sparkles className="size-3.5" aria-hidden="true" />
        <span className="text-xs font-medium">{t('Task guide')}</span>
      </div>
      <h2 id="task-finder-title" className="text-base font-semibold">
        {t('Find the right tool')}
      </h2>
      <div className="relative mt-4">
        <Search
          className="pointer-events-none absolute left-3 top-2.5 size-4 text-primary/60"
          aria-hidden="true"
        />
        <Input
          aria-label="Describe your print task"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('What would you like to make?')}
          className="pl-9"
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2" aria-label="Example tasks">
        {[
          '500 raffle tickets',
          'Stickers and labels',
          'A folded booklet',
          'Couverture mémoire'
        ].map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => setQuery(example)}
            className="rounded-full border border-primary/15 bg-card/50 px-3 py-1.5 text-[11px] text-primary transition hover:border-primary/40 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {example}
          </button>
        ))}
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="px-2 text-xs font-medium text-primary underline underline-offset-4"
          >
            {t('Clear')}
          </button>
        )}
      </div>
      <p role="status" className="sr-only">
        {suggestions.length} suggested workspaces
      </p>
      {!query.trim() ? null : suggestions.length ? (
        <div className="mt-5 grid gap-3">
          {suggestions.map((task) => (
            <article
              key={task.route}
              className="flex flex-col rounded-xl border border-primary/15 bg-card p-4"
            >
              <h3 className="text-sm font-semibold">{task.title}</h3>
              {query.trim() && (
                <ol className="mb-2 mt-3 list-inside list-decimal space-y-1 text-xs leading-5 text-muted-foreground">
                  {task.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              )}
              <Button
                type="button"
                variant="ghost"
                className="mt-auto w-fit px-0 pt-3 text-primary hover:bg-transparent"
                onClick={() => onNavigate(task.route)}
              >
                {t('Open workspace')} <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-5 rounded-xl bg-muted p-4 text-sm text-muted-foreground">
          No matching workflow yet. Try a product name such as booklet, sticker, cover, or invoice,
          or choose a workspace from the dashboard.
        </p>
      )}
    </section>
  )
}
