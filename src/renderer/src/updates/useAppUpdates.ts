import { useCallback, useEffect, useState } from 'react'
import type { AppUpdateActionResult, AppUpdateSnapshot } from '../../../shared/update-types'

const unavailableState: AppUpdateSnapshot = {
  enabled: false,
  status: 'disabled',
  currentVersion: '0.2.5',
  message: 'Automatic updates are available in the installed app.'
}

export function useAppUpdates(): {
  state: AppUpdateSnapshot
  isLoading: boolean
  isChecking: boolean
  checkForUpdates: () => Promise<AppUpdateActionResult>
  installUpdate: () => Promise<AppUpdateActionResult>
} {
  const [state, setState] = useState<AppUpdateSnapshot>(unavailableState)
  const [isLoading, setIsLoading] = useState(Boolean(window.printerApp?.updates))

  useEffect(() => {
    let active = true
    const updates = window.printerApp?.updates

    if (!updates) return undefined

    let receivedEvent = false
    const unsubscribe = updates.onStateChanged((nextState) => {
      receivedEvent = true
      if (active) {
        setState(nextState)
        setIsLoading(false)
      }
    })
    void updates
      .getState()
      .then((nextState) => {
        if (active && !receivedEvent) setState(nextState)
      })
      .catch(() => {
        // A failed bridge request must not prevent the workspace from opening.
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const checkForUpdates = useCallback(async (): Promise<AppUpdateActionResult> => {
    const updates = window.printerApp?.updates
    if (!updates) return { ok: false, state, error: state.message }
    const result = await updates.check()
    setState(result.state)
    return result
  }, [state])

  const installUpdate = useCallback(async (): Promise<AppUpdateActionResult> => {
    const updates = window.printerApp?.updates
    if (!updates) return { ok: false, state, error: state.message }
    const result = await updates.install()
    setState(result.state)
    return result
  }, [state])

  return {
    state,
    isLoading,
    isChecking: state.status === 'checking',
    checkForUpdates,
    installUpdate
  }
}
