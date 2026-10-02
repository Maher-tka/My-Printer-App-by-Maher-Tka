import { useCallback, useEffect, useState } from 'react'
import type { AppUpdateActionResult, AppUpdateSnapshot } from '../../../shared/update-types'

const unavailableState: AppUpdateSnapshot = {
  enabled: false,
  status: 'disabled',
  currentVersion: '0.2.1',
  message: 'Automatic updates are available in the installed app.'
}

export function useAppUpdates(): {
  state: AppUpdateSnapshot
  isChecking: boolean
  checkForUpdates: () => Promise<AppUpdateActionResult>
  installUpdate: () => Promise<AppUpdateActionResult>
} {
  const [state, setState] = useState<AppUpdateSnapshot>(unavailableState)

  useEffect(() => {
    let active = true
    const updates = window.printerApp?.updates

    if (!updates) return undefined

    void updates.getState().then((nextState) => {
      if (active) setState(nextState)
    })

    const unsubscribe = updates.onStateChanged((nextState) => {
      if (active) setState(nextState)
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
    isChecking: state.status === 'checking',
    checkForUpdates,
    installUpdate
  }
}
