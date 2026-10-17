/** Renderer snapshots are cloned by the context bridge and replaced on edits. */
export function createOutputAutosave<T extends object>(save: (snapshot: T) => Promise<unknown>) {
  const saved = new WeakMap<T, Promise<void>>()
  return (snapshot: T): Promise<void> => {
    const existing = saved.get(snapshot)
    if (existing) return existing
    const pending = Promise.resolve()
      .then(() => save(snapshot))
      .then((result) => {
        if (result && typeof result === 'object' && 'ok' in result && result.ok === false) {
          saved.delete(snapshot)
        }
      })
      .catch((error) => {
        saved.delete(snapshot)
        throw error
      })
    saved.set(snapshot, pending)
    return pending
  }
}
