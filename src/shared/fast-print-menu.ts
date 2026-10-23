import {
  FAST_PRINT_COUNTS,
  type FastPrintPreset,
  type FastPrintPagesPerSheet
} from './fast-print.js'
import {
  emptyPrinterPreferences,
  fastPrintOptionId,
  preferredProfile,
  compareDriverPresets,
  type PrinterPreferences
} from './printer-preferences.js'

export interface FastPrintDevice {
  name: string
  papers: string[]
  color: boolean
  isDefault?: boolean
  duplex?: boolean
}
export interface FastPrintSavedStock {
  id: string
  name: string
  printer: string
  paper: 'A4' | 'A3'
  defaultBypassFaceUp?: boolean
  savedAt?: string
  sortOrder?: number
}

export function defaultFastPrintStock(
  stocks: FastPrintSavedStock[],
  printer: string,
  paper: 'A4' | 'A3'
) {
  return stocks
    .filter(
      (stock) =>
        stock.printer === printer && stock.paper === paper && stock.defaultBypassFaceUp === true
    )
    .sort((a, b) => (b.savedAt ?? '').localeCompare(a.savedAt ?? '') || a.id.localeCompare(b.id))[0]
}
export interface FastPrintChoice {
  label: string
  enabled?: boolean
  children?: FastPrintChoice[]
  preset?: FastPrintPreset
  action?: 'manage' | 'refresh' | 'cancel'
}

export function createFastPrintChoices(
  devices: FastPrintDevice[],
  stocks: FastPrintSavedStock[],
  preferences: PrinterPreferences = emptyPrinterPreferences()
): FastPrintChoice[] {
  function variants(
    device: FastPrintDevice,
    paper: 'A4' | 'A3',
    profileId?: string,
    usePreferences = false
  ): FastPrintChoice[] {
    function profileFor(pagesPerSheet: FastPrintPagesPerSheet, color: boolean, mode?: 'id-card') {
      const id = usePreferences
        ? (preferredProfile(
            preferences,
            device.name,
            fastPrintOptionId({ paper, color, pagesPerSheet, mode })
          ) ?? profileId)
        : profileId
      return id ? { profileId: id } : {}
    }
    return [...(device.color ? [true] : []), false].map((color) => ({
      label: color ? 'Color' : 'Black && white',
      children: [
        ...FAST_PRINT_COUNTS.map((pagesPerSheet) => ({
          label: `Print — ${pagesPerSheet} page${pagesPerSheet === 1 ? '' : 's'} per sheet`,
          preset: {
            printer: device.name,
            paper,
            color,
            pagesPerSheet,
            ...profileFor(pagesPerSheet, color)
          }
        })),
        {
          label: 'ID card — 9 cm…',
          preset: {
            printer: device.name,
            paper,
            color,
            pagesPerSheet: 1,
            mode: 'id-card',
            duplex: device.duplex === true,
            ...profileFor(1, color, 'id-card')
          }
        }
      ]
    }))
  }
  const choices: FastPrintChoice[] = [...devices]
    .sort(
      (a, b) =>
        Number(b.name === preferences.defaultPrinter) -
          Number(a.name === preferences.defaultPrinter) ||
        Number(Boolean(b.isDefault)) - Number(Boolean(a.isDefault)) ||
        a.name.localeCompare(b.name)
    )
    .filter((device) => device.papers.some((paper) => paper === 'A4' || paper === 'A3'))
    .map((device) => {
      const saved = stocks
        .filter((stock) => stock.printer === device.name && device.papers.includes(stock.paper))
        .sort(compareDriverPresets)
      const children: FastPrintChoice[] = saved.length
        ? [
            {
              label: 'Saved paper && tray presets',
              children: saved.map((stock) => ({
                label: stock.name.replace(/&/g, '&&'),
                children: variants(device, stock.paper, stock.id)
              }))
            }
          ]
        : []
      if (device.color && device.papers.includes('A4')) {
        const profileId = defaultFastPrintStock(stocks, device.name, 'A4')?.id
        children.unshift({
          label: 'Polaroid',
          children: ([8, 9] as const).map((count) => ({
            label: `${count} PIC`,
            preset: {
              printer: device.name,
              paper: 'A4',
              color: true,
              pagesPerSheet: 1,
              mode: count === 8 ? 'polaroid-8' : 'polaroid-9',
              ...((preferredProfile(preferences, device.name, `polaroid-${count}`) ?? profileId)
                ? {
                    profileId:
                      preferredProfile(preferences, device.name, `polaroid-${count}`) ?? profileId
                  }
                : {})
            }
          }))
        })
      }
      for (const paper of ['A4', 'A3'] as const) {
        if (device.papers.includes(paper))
          children.push({
            label: paper,
            children: variants(
              device,
              paper,
              defaultFastPrintStock(stocks, device.name, paper)?.id,
              true
            )
          })
      }
      return {
        label:
          device.name.replace(/&/g, '&&') +
          (device.name === preferences.defaultPrinter
            ? ' (preferred)'
            : device.isDefault
              ? ' (default)'
              : ''),
        children
      }
    })
  if (!choices.length) choices.push({ label: 'No compatible printers found', enabled: false })
  choices.push(
    { label: 'Manage printer presets…', action: 'manage' },
    { label: 'Refresh printer list', action: 'refresh' },
    { label: 'Cancel', action: 'cancel' }
  )
  return choices
}
