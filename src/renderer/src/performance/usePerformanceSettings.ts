import { useSyncExternalStore } from 'react'
import {
  getPerformanceSettingsSnapshot,
  setPerformancePreset,
  subscribePerformanceSettings
} from './performanceSettings'
import type { PerformancePresetId, PerformanceSettings } from './performanceTypes'

export function usePerformanceSettings(): {
  settings: PerformanceSettings
  preset: PerformancePresetId
  setPreset: (preset: PerformancePresetId) => void
} {
  const settings = useSyncExternalStore(
    subscribePerformanceSettings,
    getPerformanceSettingsSnapshot,
    getPerformanceSettingsSnapshot
  )

  return {
    settings,
    preset: settings.preset,
    setPreset: setPerformancePreset
  }
}
