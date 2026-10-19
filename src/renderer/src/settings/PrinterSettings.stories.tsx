import type { Meta, StoryObj } from '@storybook/react-vite'
import { PrinterSettings } from './PrinterSettings'
import {
  emptyPrinterPreferences,
  type PrinterPreferencesApi,
  type PrinterSettingsSnapshot
} from '../../../shared/printer-preferences'

const konica = 'Konica C4065',
  epson = 'EPSON WorkForce Pro WF-C878RDWF'
export function printerSettingsFixture(empty = false): PrinterPreferencesApi {
  let snapshot: PrinterSettingsSnapshot = {
    preferences: emptyPrinterPreferences(),
    devices: empty
      ? []
      : [
          { name: konica, papers: ['A4', 'A3'], color: true, isDefault: true, duplex: true },
          { name: epson, papers: ['A4', 'A3'], color: true, duplex: true }
        ],
    presets: empty
      ? []
      : [
          {
            id: 'a'.repeat(32),
            name: 'A4 — 350 gsm — Bypass — Face up',
            printer: konica,
            paper: 'A4',
            color: true,
            landscape: false,
            tray: 'Bypass',
            duplex: 'Simplex',
            copies: 1,
            paperWidthMm: 210,
            paperHeightMm: 297,
            savedAt: '2026-10-18T10:00:00Z',
            usable: true
          },
          {
            id: 'b'.repeat(32),
            name: 'A3 — 80 gsm — Tray 2',
            printer: konica,
            paper: 'A3',
            color: false,
            landscape: true,
            tray: 'Tray 2',
            duplex: 'Vertical',
            copies: 1,
            paperWidthMm: 297,
            paperHeightMm: 420,
            savedAt: '2026-10-18T10:00:00Z',
            usable: true
          },
          {
            id: 'c'.repeat(32),
            name: 'A4 — Photo paper — Rear tray',
            printer: epson,
            paper: 'A4',
            color: true,
            landscape: false,
            tray: 'Rear tray',
            duplex: 'Simplex',
            copies: 1,
            paperWidthMm: 210,
            paperHeightMm: 297,
            savedAt: '2026-10-18T10:00:00Z',
            usable: true
          }
        ]
  }
  return {
    get: async () => structuredClone(snapshot),
    save: async (preferences) => {
      snapshot = { ...snapshot, preferences }
      return structuredClone(snapshot)
    },
    capture: async (request) => {
      const item = {
        ...snapshot.presets[0],
        id: request.id ?? crypto.randomUUID().replace(/-/g, ''),
        printer: request.printer,
        name: request.name,
        savedAt: new Date().toISOString()
      }
      snapshot.presets = [...snapshot.presets.filter((p) => p.id !== item.id), item]
      return { snapshot: structuredClone(snapshot) }
    },
    remove: async (id) => {
      snapshot.presets = snapshot.presets.filter((p) => p.id !== id)
      for (const assignments of Object.values(snapshot.preferences.profiles))
        for (const [key, value] of Object.entries(assignments))
          if (value === id) delete assignments[key]
      return structuredClone(snapshot)
    }
  }
}
const populated = printerSettingsFixture(),
  empty = printerSettingsFixture(true)
const meta = {
  title: 'Settings/Printing',
  component: PrinterSettings,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-[900px] rounded-[var(--ui-radius-lg)] border bg-card p-6">
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof PrinterSettings>
export default meta
type Story = StoryObj<typeof meta>
export const Populated: Story = { args: { api: populated } }
export const Empty: Story = { args: { api: empty } }
export const Loading: Story = { args: { api: { ...empty, get: () => new Promise(() => {}) } } }
export const Unavailable: Story = {
  args: {
    api: {
      ...empty,
      get: async () => {
        throw new Error('Driver presets are available on Windows.')
      }
    }
  }
}
