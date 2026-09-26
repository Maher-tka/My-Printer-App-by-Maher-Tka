import type { FastPrintPreset } from './fast-print.js'

export interface FastPrintDevice {
  name: string
  papers: string[]
  color: boolean
  isDefault?: boolean
}
export interface FastPrintSavedStock {
  id: string
  name: string
  printer: string
  paper: 'A4' | 'A3'
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
  stocks: FastPrintSavedStock[]
): FastPrintChoice[] {
  function variants(
    device: FastPrintDevice,
    paper: 'A4' | 'A3',
    profileId?: string
  ): FastPrintChoice[] {
    return [false, ...(device.color ? [true] : [])].map((color) => ({
      label: color ? 'Color' : 'Black && white',
      children: ([1, 2, 4] as const).map((pagesPerSheet) => ({
        label: `Print — ${pagesPerSheet} page${pagesPerSheet === 1 ? '' : 's'} per sheet`,
        preset: {
          printer: device.name,
          paper,
          color,
          pagesPerSheet,
          ...(profileId ? { profileId } : {})
        }
      }))
    }))
  }
  const choices: FastPrintChoice[] = [...devices]
    .sort(
      (a, b) =>
        Number(Boolean(b.isDefault)) - Number(Boolean(a.isDefault)) || a.name.localeCompare(b.name)
    )
    .filter((device) => device.papers.some((paper) => paper === 'A4' || paper === 'A3'))
    .map((device) => {
      const saved = stocks.filter(
        (stock) => stock.printer === device.name && device.papers.includes(stock.paper)
      )
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
      for (const paper of ['A4', 'A3'] as const) {
        if (device.papers.includes(paper))
          children.push({ label: paper, children: variants(device, paper) })
      }
      return {
        label: device.name.replace(/&/g, '&&') + (device.isDefault ? ' (default)' : ''),
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
