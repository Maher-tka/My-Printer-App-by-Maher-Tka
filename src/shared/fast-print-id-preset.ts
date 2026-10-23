import type { FastPrintPreset, FastPrintPrinter, IdPrinterSelection } from './fast-print.js'
import type { DriverPresetSummary } from './printer-preferences.js'

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
  const duplex = ['Vertical', 'Horizontal'].includes(profile.duplex)
  if (duplex && !device.duplex) throw new Error('This printer does not support automatic duplex.')
  return {
    preset: {
      ...current,
      profileId: profile.id,
      profileName: profile.name,
      paper: profile.paper as 'A4' | 'A3',
      color: profile.color,
      landscape: profile.landscape,
      duplex
    },
    canColor: device.color,
    canDuplex: device.duplex === true
  }
}
