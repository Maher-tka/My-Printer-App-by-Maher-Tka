import { useCallback, useEffect, useMemo, useState } from 'react'
import type { LicenseActivationResult, LicenseSnapshot } from '../../../shared/licensing-types'

interface LicenseStateController {
  state: LicenseSnapshot | null
  isDeveloperMode: boolean
  isLoading: boolean
  isActivating: boolean
  error: string | null
  activationMessage: string | null
  refresh: () => Promise<void>
  activateSerial: (serialKey: string) => Promise<LicenseActivationResult>
  resetLocal: () => Promise<void>
}

const TICK_MS = 1000
const IS_DEVELOPER_TEST_MODE = import.meta.env.DEV && import.meta.env.VITE_DEV_UNLOCK_ALL === 'true'

export function useLicenseState(): LicenseStateController {
  const [snapshot, setSnapshot] = useState<LicenseSnapshot | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isActivating, setIsActivating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activationMessage, setActivationMessage] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const refresh = useCallback(async (): Promise<void> => {
    if (!window.printerApp?.license) {
      setError('Local license service is not available in this window.')
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)
      const nextSnapshot = await window.printerApp.license.getState()
      setSnapshot(nextSnapshot)
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTick((currentTick) => currentTick + 1)
    }, TICK_MS)

    return () => {
      window.clearInterval(timer)
    }
  }, [])

  const state = useMemo(() => {
    const liveSnapshot = snapshot ? getLiveLicenseSnapshot(snapshot) : null
    return IS_DEVELOPER_TEST_MODE ? createDeveloperLicenseSnapshot(liveSnapshot) : liveSnapshot
  }, [snapshot, tick])

  const activateSerial = useCallback(
    async (serialKey: string): Promise<LicenseActivationResult> => {
      if (!window.printerApp?.license) {
        const missingServiceResult = {
          ok: false,
          state: state ?? createUnavailableLicenseSnapshot(),
          error: 'Local license service is not available in this window.'
        }

        setError(missingServiceResult.error)
        return missingServiceResult
      }

      try {
        setIsActivating(true)
        setError(null)
        setActivationMessage(null)
        const result = await window.printerApp.license.activateSerial(serialKey)
        setSnapshot(result.state)

        if (result.ok) {
          setActivationMessage(result.message ?? 'Serial key activated locally.')
        } else {
          setError(result.error ?? 'Serial key could not be activated.')
        }

        return result
      } catch (requestError) {
        const message = getErrorMessage(requestError)
        setError(message)

        return {
          ok: false,
          state: state ?? createUnavailableLicenseSnapshot(),
          error: message
        }
      } finally {
        setIsActivating(false)
      }
    },
    [state]
  )

  const resetLocal = useCallback(async (): Promise<void> => {
    if (!IS_DEVELOPER_TEST_MODE || !window.printerApp?.license.resetLocal) return
    try {
      setIsLoading(true)
      setError(null)
      setActivationMessage(null)
      setSnapshot(await window.printerApp.license.resetLocal())
      setActivationMessage('Local license and trial data reset for development testing.')
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setIsLoading(false)
    }
  }, [])

  return {
    state,
    isDeveloperMode: IS_DEVELOPER_TEST_MODE,
    isLoading,
    isActivating,
    error,
    activationMessage,
    refresh,
    activateSerial,
    resetLocal
  }
}

function createDeveloperLicenseSnapshot(snapshot: LicenseSnapshot | null): LicenseSnapshot {
  const now = new Date().toISOString()
  const base = snapshot ?? createUnavailableLicenseSnapshot()

  return {
    ...base,
    mode: 'activated',
    plan: 'shop',
    planLabel: 'Developer Test Mode',
    statusLabel: 'Developer Test Mode',
    features: ['paid-tools', 'batch-exports'],
    canUsePaidTools: true,
    checkedAt: now,
    clockWarning: undefined,
    integrityWarning: undefined
  }
}

function getLiveLicenseSnapshot(snapshot: LicenseSnapshot): LicenseSnapshot {
  if (snapshot.mode === 'activated') {
    return snapshot
  }

  const checkedAtMs = new Date(snapshot.checkedAt).getTime()
  const elapsedMs = Number.isFinite(checkedAtMs) ? Math.max(0, Date.now() - checkedAtMs) : 0
  const remainingMs = Math.max(0, snapshot.trial.remainingMs - elapsedMs)
  const isExpired = remainingMs <= 0

  return {
    ...snapshot,
    mode: isExpired ? 'expired' : snapshot.mode,
    statusLabel: isExpired ? 'Trial expired' : snapshot.statusLabel,
    features: isExpired ? [] : snapshot.features,
    canUsePaidTools: isExpired ? false : snapshot.canUsePaidTools,
    trial: {
      ...snapshot.trial,
      remainingMs,
      isExpired
    }
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Something went wrong while reading the local license.'
}

function createUnavailableLicenseSnapshot(): LicenseSnapshot {
  const now = new Date().toISOString()

  return {
    installationId: 'unavailable',
    machineCode: 'UNAVAILABLE',
    mode: 'expired',
    plan: 'trial',
    planLabel: 'Trial',
    statusLabel: 'License service unavailable',
    features: [],
    canUsePaidTools: false,
    trial: {
      startedAt: now,
      endsAt: now,
      remainingMs: 0,
      isExpired: true
    },
    checkedAt: now,
    storageMode: 'browser-local-storage',
    integrityWarning: 'The Electron license bridge is not available.'
  }
}
