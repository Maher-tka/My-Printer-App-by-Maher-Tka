import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/i18n/useLanguage'
import { renderPdfPage, withPdf } from './conversions'
import type { PdfOutput } from './model'
import { MIB } from '../../../../shared/pdf-memory'

export function PdfOutputPreview({ output }: { output: PdfOutput }): JSX.Element {
  const { t } = useLanguage()
  const [page, setPage] = useState(0),
    [count, setCount] = useState(1)
  const [url, setUrl] = useState(''),
    [error, setError] = useState('')
  const [enabled, setEnabled] = useState(output.bytes.length < 32 * MIB)
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    let thumbnail = ''
    setUrl('')
    setError('')
    void withPdf(
      output.bytes,
      async (pdf) => {
        setCount(pdf.numPages)
        const rendered = await renderPdfPage(pdf, page, 36, controller.signal)
        if (controller.signal.aborted) return
        thumbnail = URL.createObjectURL(
          new Blob([new Uint8Array(rendered.bytes)], { type: 'image/jpeg' })
        )
        setUrl(thumbnail)
      },
      controller.signal
    ).catch((error) => {
      if (!controller.signal.aborted) setError(String(error.message ?? error))
    })
    return () => {
      controller.abort()
      if (thumbnail) URL.revokeObjectURL(thumbnail)
    }
  }, [output, page, enabled])
  if (!enabled)
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setEnabled(true)}>
        {t('Preview PDF')}
      </Button>
    )
  return (
    <div className="space-y-2">
      {output.bytes.length >= 32 * MIB && (
        <Button type="button" variant="ghost" size="sm" onClick={() => setEnabled(false)}>
          {t('Close preview')}
        </Button>
      )}
      {url ? (
        <img
          className="mx-auto max-h-72 max-w-full rounded border border-border object-contain"
          src={url}
          alt={t('Output preview')}
        />
      ) : (
        <p className="text-xs text-muted-foreground" role="status">
          {t(error || 'Preparing preview…')}
        </p>
      )}
      {count > 1 && (
        <div className="flex items-center justify-center gap-2" dir="ltr">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t('Previous output page')}
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft />
          </Button>
          <span className="text-xs tabular-nums">
            {page + 1} / {count}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t('Next output page')}
            disabled={page + 1 >= count}
            onClick={() => setPage(page + 1)}
          >
            <ChevronRight />
          </Button>
        </div>
      )}
    </div>
  )
}
