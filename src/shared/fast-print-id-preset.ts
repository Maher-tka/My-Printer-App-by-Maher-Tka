import type { FastPrintPreset, FastPrintPrinter, IdPrinterSelection } from './fast-print.js'
import type { DriverPresetSummary } from './printer-preferences.js'
import type { IdPrintDraft } from './fast-print-id.js'

/** Start ID jobs in automatic duplex, unless returning to an explicit choice. */
export function idReviewDuplex(canDuplex: boolean, previous?: boolean): boolean {
  return canDuplex && (previous ?? true)
}

/** Restore the review choice only for its printer; a newly selected device gets its default. */
export function initialIdReviewDuplex(
  canDuplex: boolean,
  printer: string,
  draft?: Pick<IdPrintDraft, 'printer' | 'duplex'>
): boolean {
  return idReviewDuplex(
    canDuplex,
    draft && (!draft.printer || draft.printer === printer) ? draft.duplex : undefined
  )
}

/** Resolve the configured ID default across printers, failing visibly if it disappeared. */
export function selectDefaultIdPreset(
  current: FastPrintPreset,
  id: string,
  profiles: DriverPresetSummary[],
  devices: FastPrintPrinter[]
): IdPrinterSelection {
  const profile = profiles.find((item) => item.id === id)
  const device = profile && devices.find((item) => item.name === profile.printer)
  if (!profile || !profile.usable || !device)
    throw new Error(
      'The default ID printer preset is unavailable. Choose another preset in printing settings.'
    )
  return selectIdDriverPreset(
    { ...current, printer: profile.printer, duplex: undefined },
    profile,
    device
  )
}

/** Apply a resolved driver snapshot without changing ID artwork or sheet settings. */
export function selectIdDriverPreset(
  current: FastPrintPreset,
  profile: Pick<
    DriverPresetSummary,
    'id' | 'name' | 'printer' | 'paper' | 'color' | 'landscape' | 'duplex'
  >,
  device: FastPrintPrinter
): IdPrinterSelection {
  if (
    current.mode !== 'id-card' ||
    profile.printer !== current.printer ||
    device.name !== current.printer
  )
    throw new Error('This preset belongs to another printer.')
  if (
    !/^[a-f0-9]{32}$/.test(profile.id) ||
    !['A4', 'A3'].includes(profile.paper) ||
    !device.papers.includes(profile.paper)
  )
    throw new Error('This printer does not support the preset paper.')
  if (profile.color && !device.color) throw new Error('This printer does not support color.')
  const profileDuplex = ['Vertical', 'Horizontal'].includes(profile.duplex)
  if (profileDuplex && !device.duplex)
    throw new Error('This printer does not support automatic duplex.')
  return {
    preset: {
      ...current,
      profileId: profile.id,
      profileName: profile.name,
      paper: profile.paper as 'A4' | 'A3',
      color: profile.color,
      landscape: profile.landscape,
      // The ID two-sided choice belongs to the job; a stock preset may be simplex.
      duplex: idReviewDuplex(device.duplex === true, current.duplex)
    },
    canColor: device.color,
    canDuplex: device.duplex === true
  }
}
