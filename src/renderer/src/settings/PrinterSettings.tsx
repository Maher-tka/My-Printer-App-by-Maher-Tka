import { useEffect, useRef, useState, type ReactNode } from 'react'
import { LoaderCircle, PencilLine, Plus, RefreshCw, Settings2, Trash2 } from 'lucide-react'
import { useLanguage } from '@/i18n/useLanguage'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldLabel } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog'
import {
  PRINTING_OPTIONS,
  preferredProfile,
  compareDriverPresets,
  type PrinterPreferencesApi,
  type PrinterSettingsSnapshot,
  type PrinterPreferences
} from '../../../shared/printer-preferences'

export function PrinterSettings({
  api = window.printerApp?.printers
}: {
  api?: PrinterPreferencesApi
}): JSX.Element {
  const { t } = useLanguage()
  const nameInput = useRef<HTMLInputElement>(null)
  const [snapshot, setSnapshot] = useState<PrinterSettingsSnapshot>()
  const [printer, setPrinter] = useState('')
  const [profileId, setProfileId] = useState('new')
  const [name, setName] = useState('')
  const [optionId, setOptionId] = useState('polaroid-8')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const current = snapshot?.presets.find((p) => p.id === profileId)
  const option = PRINTING_OPTIONS.find((p) => p.id === optionId)!
  const presets = (snapshot?.presets.filter((p) => p.printer === printer) ?? []).sort(
    compareDriverPresets
  )
  const savedPresets = [...(snapshot?.presets ?? [])].sort(compareDriverPresets)
  const assignedId = snapshot
    ? preferredProfile(snapshot.preferences, printer, optionId)
    : undefined
  const assignedPreset = snapshot?.presets.find((p) => p.id === assignedId)
  const installed = Boolean(snapshot?.devices.some((p) => p.name === printer))
  const printerNames = Array.from(
    new Set([
      ...(snapshot?.devices.map((p) => p.name) ?? []),
      ...(snapshot?.presets.map((p) => p.printer) ?? []),
      ...(snapshot?.preferences.defaultPrinter ? [snapshot.preferences.defaultPrinter] : []),
      ...Object.keys(snapshot?.preferences.profiles ?? {}),
      ...Object.values(snapshot?.preferences.optionPrinters ?? {})
    ])
  )
  function accept(next: PrinterSettingsSnapshot) {
    setSnapshot(next)
    if (profileId !== 'new' && !next.presets.some((p) => p.id === profileId)) {
      setProfileId('new')
      setName('')
    }
    setPrinter(
      (previous) =>
        previous ||
        next.preferences.defaultPrinter ||
        next.devices.find((p) => p.isDefault)?.name ||
        next.devices[0]?.name ||
        ''
    )
  }
  async function perform(task: () => Promise<void>) {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await task()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Printing settings could not be saved.')
    } finally {
      setBusy(false)
    }
  }
  async function refresh() {
    if (api) await perform(async () => accept(await api.get()))
  }
  useEffect(() => {
    let canceled = false
    setBusy(true)
    if (!api) {
      setBusy(false)
      return
    }
    api
      .get()
      .then((next) => {
        if (!canceled) accept(next)
      })
      .catch((failure) => {
        if (!canceled) setError(failure.message)
      })
      .finally(() => {
        if (!canceled) setBusy(false)
      })
    return () => {
      canceled = true
    }
  }, [api])
  async function save(change: (preferences: PrinterPreferences) => void) {
    if (!api || !snapshot) return
    const next = structuredClone(snapshot.preferences)
    change(next)
    await perform(async () => {
      accept(await api.save(next))
      setMessage('Printing preferences saved.')
    })
  }
  function chooseProfile(id: string) {
    const profile = snapshot?.presets.find((p) => p.id === id)
    setProfileId(id)
    setName(profile?.name ?? '')
    if (profile) setPrinter(profile.printer)
    setError('')
    setMessage('')
    requestAnimationFrame(() => nameInput.current?.focus())
  }
  const field = (label: string, children: ReactNode) => (
    <Field>
      <FieldLabel>{t(label)}</FieldLabel>
      {children}
    </Field>
  )
  const choices = (
    value: string,
    onChange: (value: string) => void,
    label: string,
    items: Array<{ value: string; label: string; disabled?: boolean }>,
    disabled = false
  ) => (
    <Select value={value} onValueChange={onChange} disabled={busy || disabled}>
      <SelectTrigger aria-label={t(label)} className="min-w-0">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value} disabled={item.disabled}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
  if (!api) return <p role="status">{t('Open the desktop app to manage printer drivers.')}</p>
  return (
    <div className="space-y-6" aria-busy={busy} data-printer-settings>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">{t('Printing settings')}</h2>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => void refresh()}
        >
          <RefreshCw aria-hidden="true" />
          {t('Refresh printers')}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {t(error)}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="text-sm text-muted-foreground">
          {t(message)}
        </p>
      ) : null}
      {!snapshot && busy ? (
        <div role="status" className="flex items-center gap-2">
          <LoaderCircle className="size-4 animate-spin" />
          {t('Loading printers…')}
        </div>
      ) : null}
      {snapshot ? (
        <>
          <section className="space-y-4" aria-label={t('Default printer')}>
            {field(
              'Default printer',
              choices(
                snapshot.preferences.defaultPrinter ?? 'windows',
                (value) =>
                  void save((p) => {
                    p.defaultPrinter = value === 'windows' ? null : value
                  }),
                'Default printer',
                [
                  { value: 'windows', label: t('Use Windows default printer') },
                  ...printerNames.map((value) => ({ value, label: value }))
                ]
              )
            )}
          </section>
          <section className="space-y-4 border-t pt-5" aria-label={t('Driver presets')}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-semibold">{t('Driver presets')}</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => chooseProfile('new')}
              >
                <Plus aria-hidden="true" />
                {t('New preset')}
              </Button>
            </div>
            {savedPresets.length ? (
              <ul
                className="max-h-80 divide-y overflow-y-auto overscroll-contain rounded-[var(--ui-radius-md)] border"
                aria-label={t('Saved driver presets')}
              >
                {savedPresets.map((profile) => (
                  <li
                    key={profile.id}
                    className={`flex min-w-0 items-start justify-between gap-4 p-4 ${profile.id === profileId ? 'bg-primary/10' : ''}`}
                    data-driver-preset={profile.id}
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="break-words font-medium">{profile.name}</div>
                      <div className="break-words text-sm text-muted-foreground">
                        {profile.printer}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>{profile.paper}</span>
                        <span>{t(profile.color ? 'Color' : 'Black & white')}</span>
                        <span>
                          {t(
                            profile.duplex === 'Simplex'
                              ? 'Single-sided'
                              : profile.duplex === 'Vertical'
                                ? 'Long-edge duplex'
                                : profile.duplex === 'Horizontal'
                                  ? 'Short-edge duplex'
                                  : profile.duplex
                          )}
                        </span>
                        <span>
                          {t('Tray')}: {profile.tray}
                        </span>
                      </div>
                      {!profile.usable ? (
                        <p className="text-xs text-destructive">{t('Preset needs attention')}</p>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      variant={profile.id === profileId ? 'selected' : 'outline'}
                      size="sm"
                      className="shrink-0"
                      disabled={busy}
                      aria-label={`${t('Edit preset')}: ${profile.name}`}
                      aria-pressed={profile.id === profileId}
                      aria-controls="printer-preset-editor"
                      onClick={() => chooseProfile(profile.id)}
                    >
                      <PencilLine aria-hidden="true" />
                      {t('Edit')}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p role="status" className="text-sm text-muted-foreground">
                {t('No saved driver presets. Choose New preset to create one.')}
              </p>
            )}
            <div
              id="printer-preset-editor"
              className="space-y-4"
              role="group"
              aria-label={t(current ? 'Edit preset' : 'New driver preset')}
            >
              <h4 className="font-medium">{t(current ? 'Edit preset' : 'New driver preset')}</h4>
              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                {field(
                  'Printer',
                  choices(
                    printer,
                    (value) => {
                      setPrinter(value)
                      chooseProfile('new')
                    },
                    'Printer',
                    printerNames.map((value) => ({ value, label: value })),
                    Boolean(current)
                  )
                )}
                {field(
                  'Preset name',
                  <Input
                    ref={nameInput}
                    aria-label={t('Preset name')}
                    value={name}
                    disabled={busy}
                    maxLength={100}
                    onChange={(event) => setName(event.target.value)}
                  />
                )}
              </div>
              {current ? (
                <div
                  className="rounded-[var(--ui-radius-md)] border bg-secondary/40 p-3 text-sm"
                  role="status"
                >
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <span>{current.paper}</span>
                    {current.paperWidthMm && current.paperHeightMm ? (
                      <span dir="ltr">
                        {current.paperWidthMm.toFixed(1)} × {current.paperHeightMm.toFixed(1)} mm
                      </span>
                    ) : null}
                    {current.copies ? (
                      <span>
                        {t('Copies')}: {current.copies}
                      </span>
                    ) : null}
                    <span>{t(current.color ? 'Color' : 'Black & white')}</span>
                    <span>
                      {t('Tray')}: {current.tray}
                    </span>
                    <span>
                      {t('Duplex')}:{' '}
                      {t(
                        current.duplex === 'Simplex'
                          ? 'Single-sided'
                          : current.duplex === 'Vertical'
                            ? 'Long-edge duplex'
                            : current.duplex === 'Horizontal'
                              ? 'Short-edge duplex'
                              : current.duplex
                      )}
                    </span>
                  </div>
                  {current.error ? (
                    <p className="mt-2 text-destructive">{t(current.error)}</p>
                  ) : null}
                </div>
              ) : null}
              {!snapshot.devices.length ? (
                <p role="status" className="text-sm text-muted-foreground">
                  {t('No installed printers found. Install a printer driver, then refresh.')}
                </p>
              ) : null}
              {snapshot.devices.length > 0 && printer && !installed ? (
                <p role="status" className="text-sm text-destructive">
                  {t('This printer is unavailable. Install its driver, then refresh.')}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={busy || !installed || !name.trim()}
                  aria-busy={busy}
                  onClick={() =>
                    void perform(async () => {
                      const result = await api.capture({
                        printer,
                        name,
                        ...(current ? { id: current.id } : {})
                      })
                      if (result.snapshot) {
                        accept(result.snapshot)
                        const captured = current
                          ? result.snapshot.presets.find((p) => p.id === current.id)
                          : result.snapshot.presets
                              .filter((p) => p.printer === printer && p.name === name.trim())
                              .sort((a, b) => b.savedAt.localeCompare(a.savedAt))[0]
                        if (captured) {
                          setProfileId(captured.id)
                          setName(captured.name)
                        }
                        setMessage('Driver preset saved.')
                      }
                    })
                  }
                >
                  {busy ? (
                    <LoaderCircle className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Settings2 aria-hidden="true" />
                  )}
                  {t(current ? 'Update driver preset' : 'Capture and save driver settings')}
                </Button>
                {current ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button type="button" variant="outline" disabled={busy}>
                        <Trash2 aria-hidden="true" />
                        {t('Delete preset')}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t('Delete driver preset?')}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {current.name}.{' '}
                          {t(
                            'Its print-option assignments will be cleared. Saved projects and artwork are unchanged.'
                          )}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                          className={buttonVariants({ variant: 'destructive' })}
                          onClick={() =>
                            void perform(async () => {
                              accept(await api.remove(current.id))
                              chooseProfile('new')
                              setMessage('Driver preset deleted.')
                              requestAnimationFrame(() => nameInput.current?.focus())
                            })
                          }
                        >
                          {t('Delete')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                {t(
                  'In the driver dialog, choose paper, tray, weight and finishing, then confirm. The full settings are saved for this printer.'
                )}
              </p>
            </div>
          </section>
          <section className="space-y-4 border-t pt-5" aria-label={t('Print options')}>
            <h3 className="font-semibold">{t('Print options')}</h3>
            {field(
              'Printing option',
              choices(
                optionId,
                setOptionId,
                'Printing option',
                PRINTING_OPTIONS.map((p) => ({ value: p.id, label: t(p.label) }))
              )
            )}
            {optionId.startsWith('tool:') || optionId === 'app-print'
              ? field(
                  'Preferred printer for this option',
                  choices(
                    snapshot.preferences.optionPrinters[optionId] ?? 'inherit',
                    (value) => {
                      void save((p) => {
                        if (value === 'inherit') delete p.optionPrinters[optionId]
                        else p.optionPrinters[optionId] = value
                      })
                      if (value !== 'inherit') {
                        setPrinter(value)
                        chooseProfile('new')
                      }
                    },
                    'Preferred printer for this option',
                    [
                      { value: 'inherit', label: t('Use app default printer') },
                      ...printerNames.map((value) => ({ value, label: value }))
                    ]
                  )
                )
              : null}
            {field(
              'Driver preset for selected printer',
              choices(
                preferredProfile(snapshot.preferences, printer, optionId) ?? 'driver-default',
                (value) =>
                  void save((p) => {
                    const assignments = { ...(p.profiles[printer] ?? {}) }
                    if (value === 'driver-default') delete assignments[optionId]
                    else assignments[optionId] = value
                    p.profiles = { ...p.profiles, [printer]: assignments }
                  }),
                'Driver preset for selected printer',
                [
                  { value: 'driver-default', label: t('Use paper / driver defaults') },
                  ...presets
                    .filter((p) => !option.paper || p.paper === option.paper)
                    .map((p) => ({ value: p.id, label: p.name, disabled: !p.usable }))
                ]
              )
            )}
            {assignedId &&
            (!assignedPreset?.usable || (option.paper && assignedPreset.paper !== option.paper)) ? (
              <p role="alert" className="text-sm text-destructive">
                {t(
                  'The assigned driver preset needs attention. Recapture it or choose another preset.'
                )}
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              {printer}. {t('Each printer remembers its own preset for this option.')}
            </p>
            {option.paper ? (
              <p className="text-xs text-muted-foreground">
                {t(
                  'This layout controls paper size, color and orientation. The saved driver preset supplies tray, stock and finishing.'
                )}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t(
                  'Saved driver presets print PDFs at actual size, up to 300 DPI. The PDF and preset paper sizes must match.'
                )}
              </p>
            )}
          </section>
        </>
      ) : null}
    </div>
  )
}
