const unavailable = new Set<string>()

/** Preload and renderer can update before an existing Electron main process restarts. */
export async function optionalPdfNativeCall<T>(
  channel: string,
  invoke?: () => Promise<T>
): Promise<T | undefined> {
  if (!invoke || unavailable.has(channel)) return undefined
  try {
    return await invoke()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (/No handler registered for/i.test(message) && message.includes(channel)) {
      unavailable.add(channel)
      return undefined
    }
    throw error
  }
}
