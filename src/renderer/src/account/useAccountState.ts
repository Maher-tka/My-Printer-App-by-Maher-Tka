import { useCallback, useEffect, useRef, useState } from 'react'
import { ACCESS_REFRESH_MS } from '../../../shared/cloud-access'
import type {
  AccountMutationResult,
  AccountSnapshot,
  CreateAccountRequest,
  SignInRequest
} from '../../../shared/account-types'

interface AccountStateController {
  state: AccountSnapshot | null
  isLoading: boolean
  isSubmitting: boolean
  error: string | null
  refresh: () => Promise<void>
  createAccount: (request: CreateAccountRequest) => Promise<AccountMutationResult>
  signIn: (request: SignInRequest) => Promise<AccountMutationResult>
  signOut: () => Promise<AccountMutationResult>
  signInGoogle: () => Promise<AccountMutationResult>
}

export function useAccountState(): AccountStateController {
  const [state, setState] = useState<AccountSnapshot | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const initialized = useRef(false)

  const refresh = useCallback(async (): Promise<void> => {
    if (!window.printerApp?.account) {
      setError('The account service is not available in this window.')
      setIsLoading(false)
      return
    }

    try {
      if (!initialized.current) setIsLoading(true)
      setError(null)
      setState(await window.printerApp.account.getState())
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      initialized.current = true
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => void refresh(), ACCESS_REFRESH_MS)
    const onFocus = (): void => {
      void refresh()
    }
    window.addEventListener('focus', onFocus)
    window.addEventListener('online', onFocus)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('online', onFocus)
    }
  }, [refresh])

  const createAccount = useCallback(
    async (request: CreateAccountRequest) => {
      if (!window.printerApp?.account) {
        return getUnavailableResult(state)
      }

      return runMutation(
        () => window.printerApp!.account.create(request),
        setState,
        setError,
        setIsSubmitting
      )
    },
    [state]
  )

  const signIn = useCallback(
    async (request: SignInRequest) => {
      if (!window.printerApp?.account) {
        return getUnavailableResult(state)
      }

      return runMutation(
        () => window.printerApp!.account.signIn(request),
        setState,
        setError,
        setIsSubmitting
      )
    },
    [state]
  )

  const signOut = useCallback(async () => {
    if (!window.printerApp?.account) {
      return getUnavailableResult(state)
    }

    return runMutation(
      () => window.printerApp!.account.signOut(),
      setState,
      setError,
      setIsSubmitting
    )
  }, [state])

  const signInGoogle = useCallback(async () => {
    if (!window.printerApp?.account) return getUnavailableResult(state)
    return runMutation(
      () => window.printerApp!.account.signInGoogle(),
      setState,
      setError,
      setIsSubmitting
    )
  }, [state])

  return {
    state,
    isLoading,
    isSubmitting,
    error,
    refresh,
    createAccount,
    signIn,
    signOut,
    signInGoogle
  }
}

async function runMutation(
  operation: () => Promise<AccountMutationResult>,
  setState: (state: AccountSnapshot) => void,
  setError: (error: string | null) => void,
  setIsSubmitting: (isSubmitting: boolean) => void
): Promise<AccountMutationResult> {
  try {
    setIsSubmitting(true)
    setError(null)
    const result = await operation()
    setState(result.state)

    if (!result.ok) {
      setError(result.error ?? 'The account request could not be completed.')
    }

    return result
  } catch (requestError) {
    const message = getErrorMessage(requestError)
    setError(message)
    return {
      ok: false,
      state: createSignedOutSnapshot(),
      error: message
    }
  } finally {
    setIsSubmitting(false)
  }
}

function getUnavailableResult(state: AccountSnapshot | null): AccountMutationResult {
  const fallbackState = state ?? createSignedOutSnapshot()
  return {
    ok: false,
    state: fallbackState,
    error: 'The account service is not available in this window.'
  }
}

function createSignedOutSnapshot(): AccountSnapshot {
  return {
    status: 'signed-out',
    accountExists: false,
    storageMode: 'electron-user-data'
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong with the account request.'
}
