import { createCanceledError } from './memoryCleanup'

/** Document loading belongs to the source, independently of individual page renders. */
export class SharedPreviewDocumentCache<T extends { destroy(): Promise<void> }> {
  private documents = new Map<string, T>()
  private pending = new Map<string, Promise<T>>()
  private generation = 0

  get(key: string, load: () => Promise<T>): Promise<T> {
    const cached = this.documents.get(key)
    if (cached) return Promise.resolve(cached)
    const pending = this.pending.get(key)
    if (pending) return pending
    const generation = this.generation
    const promise = Promise.resolve()
      .then(load)
      .then(async (document) => {
        if (generation !== this.generation) {
          await document.destroy()
          throw createCanceledError('Preview cache was cleared.')
        }
        if (this.pending.get(key) === promise) this.pending.delete(key)
        this.documents.set(key, document)
        return document
      })
      .catch((error: unknown) => {
        if (this.pending.get(key) === promise) this.pending.delete(key)
        throw error
      })
    this.pending.set(key, promise)
    return promise
  }

  async clear(): Promise<void> {
    this.generation++
    const documents = [...this.documents.values()]
    this.documents.clear()
    this.pending.clear()
    await Promise.all(documents.map((document) => document.destroy()))
  }
}
