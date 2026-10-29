import { useLanguage } from '@/i18n/useLanguage'
import { Input } from '@/components/ui/input'
import { ToolSettingsTabs } from '../shared/ToolSettingsTabs'
import type { PdfOptions, PdfToolId } from './model'

export function PdfToolSettings({
  id,
  options,
  onChange,
  disabled
}: {
  id: PdfToolId
  options: PdfOptions
  onChange: (options: PdfOptions) => void
  disabled: boolean
}): JSX.Element {
  const { t } = useLanguage()
  const selectClass =
    'h-9 w-full rounded-[var(--ui-radius-md)] border border-input bg-background px-3 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
  const change = <K extends keyof PdfOptions>(key: K, value: PdfOptions[K]): void =>
    onChange({ ...options, [key]: value })
  const range = (
    <label className="block space-y-2 text-xs font-medium">
      {t('Pages')}
      <Input
        value={options.ranges}
        placeholder={t('All pages · e.g. 1-3, 5')}
        onChange={(event) => change('ranges', event.target.value)}
        aria-describedby="pdf-range-help"
      />
      <span id="pdf-range-help" className="block font-normal text-muted-foreground">
        {t(
          id === 'split'
            ? 'Each comma-separated range becomes a separate PDF.'
            : 'Leave empty to include all pages.'
        )}
      </span>
    </label>
  )
  const setup = (
    <>
      {id === 'split' && (
        <>
          <label className="block space-y-2 text-xs font-medium">
            {t('Split mode')}
            <select
              className={selectClass}
              value={options.splitMode}
              onChange={(event) =>
                change('splitMode', event.target.value as PdfOptions['splitMode'])
              }
            >
              <option value="ranges">{t('Custom ranges')}</option>
              <option value="every">{t('One PDF per page')}</option>
            </select>
          </label>
          {options.splitMode === 'ranges' && range}
        </>
      )}
      {id === 'compress' && (
        <>
          <label className="block space-y-2 text-xs font-medium">
            {t('Compression')}
            <select
              className={selectClass}
              value={options.compression}
              onChange={(event) =>
                change('compression', event.target.value as PdfOptions['compression'])
              }
            >
              <option value="lossless">{t('Lossless')}</option>
              <option value="balanced">{t('Balanced · flattened')}</option>
              <option value="small">{t('Smallest · flattened')}</option>
            </select>
          </label>
          <p className="text-xs text-muted-foreground">
            {t(
              options.compression === 'lossless'
                ? 'Keeps text, vectors, and links. Already optimized files may stay the same size.'
                : 'Turns pages into images. Text selection, forms, and links will be lost.'
            )}
          </p>
        </>
      )}
      {['pdf-word', 'pdf-powerpoint'].includes(id) && (
        <>
          <label className="block space-y-2 text-xs font-medium">
            {t('Conversion mode')}
            <select
              className={selectClass}
              value={options.officeMode}
              onChange={(event) =>
                change('officeMode', event.target.value as PdfOptions['officeMode'])
              }
            >
              <option value="appearance">{t('Preserve appearance')}</option>
              <option value="text">{t('Editable text')}</option>
            </select>
          </label>
          <p className="text-xs text-muted-foreground">
            {t(
              options.officeMode === 'appearance'
                ? 'Each page becomes an image in the Office file. Text is not editable.'
                : 'Extracts selectable text. Fonts, complex layouts, and images are not preserved; no OCR.'
            )}
          </p>
          {range}
        </>
      )}
      {id === 'pdf-excel' && (
        <>
          {range}
          <p className="text-xs text-muted-foreground">
            {t(
              'Extracts selectable text into rows and columns, with one worksheet per page. Review table alignment. Scanned pages require OCR.'
            )}
          </p>
        </>
      )}
      {id === 'pdf-jpg' && (
        <>
          {range}
          <label className="block space-y-2 text-xs font-medium">
            {t('Resolution')}
            <select
              className={selectClass}
              value={options.dpi}
              onChange={(event) => change('dpi', Number(event.target.value))}
            >
              <option value={72}>72 DPI</option>
              <option value={150}>150 DPI</option>
              <option value={300}>300 DPI</option>
            </select>
          </label>
          <p className="text-xs text-muted-foreground">
            {t(
              'One JPG per selected page, delivered in a ZIP file. Large pages are scaled to this PC’s memory budget.'
            )}
          </p>
        </>
      )}
      {id === 'jpg-pdf' && (
        <>
          <label className="block space-y-2 text-xs font-medium">
            {t('Page size')}
            <select
              className={selectClass}
              value={options.paper}
              onChange={(event) => change('paper', event.target.value as PdfOptions['paper'])}
            >
              <option value="A4">A4</option>
              <option value="Letter">Letter</option>
              <option value="Fit">{t('Fit image')}</option>
            </select>
          </label>
          {options.paper !== 'Fit' && (
            <label className="block space-y-2 text-xs font-medium">
              {t('Orientation')}
              <select
                className={selectClass}
                value={options.orientation}
                onChange={(event) =>
                  change('orientation', event.target.value as PdfOptions['orientation'])
                }
              >
                <option value="portrait">{t('Portrait')}</option>
                <option value="landscape">{t('Landscape')}</option>
              </select>
            </label>
          )}
          <label className="block space-y-2 text-xs font-medium">
            {t('Margins (mm)')}
            <Input
              type="number"
              min={0}
              max={50}
              value={options.margin}
              onChange={(event) =>
                change('margin', Math.max(0, Math.min(50, Number(event.target.value))))
              }
            />
          </label>
          <label className="block space-y-2 text-xs font-medium">
            {t('Image placement')}
            <select
              className={selectClass}
              value={options.imageFit}
              onChange={(event) => change('imageFit', event.target.value as PdfOptions['imageFit'])}
            >
              <option value="contain">{t('Fit · keep whole image')}</option>
              <option value="cover">{t('Fill · crop edges')}</option>
            </select>
          </label>
        </>
      )}
      {id === 'merge' && (
        <p className="text-xs text-muted-foreground">
          {t('Arrange files in the order you want. All pages from each file are included.')}
        </p>
      )}
      {id.endsWith('-pdf') && id !== 'jpg-pdf' && (
        <p className="text-xs text-muted-foreground">
          {t(
            'Uses the document’s saved layout and print settings. Original files are kept unchanged.'
          )}
        </p>
      )}
      {id === 'edit' && (
        <p className="text-xs text-muted-foreground">
          {t(
            'Add text, images, shapes, or highlights. Added elements are flattened on export; original PDF content is preserved.'
          )}
        </p>
      )}
    </>
  )
  return (
    <fieldset disabled={disabled} className="min-w-0">
      <ToolSettingsTabs
        label="PDF settings"
        advanced={
          <div className="space-y-3 text-xs text-muted-foreground">
            <p>{t('Files are processed locally on this computer.')}</p>
            <p>
              {t(
                'Encrypted PDFs must be unlocked before import. Digital signatures may become invalid after editing.'
              )}
            </p>
            {['pdf-word', 'pdf-powerpoint'].includes(id) && options.officeMode === 'appearance' && (
              <label className="block space-y-2 font-medium">
                {t('Resolution')}
                <select
                  className={selectClass}
                  value={options.dpi}
                  onChange={(event) => change('dpi', Number(event.target.value))}
                >
                  <option value={72}>72 DPI</option>
                  <option value={150}>150 DPI</option>
                  <option value={300}>300 DPI</option>
                </select>
              </label>
            )}
          </div>
        }
      >
        {setup}
      </ToolSettingsTabs>
    </fieldset>
  )
}
