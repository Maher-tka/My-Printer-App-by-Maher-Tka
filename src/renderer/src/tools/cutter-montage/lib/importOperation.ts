/** Keeps canceled or superseded PDF work from publishing stale results. */
export class ImportOperationGuard {
  private current: AbortController | null = null

  begin(): AbortController {
    this.cancel()
    const operation = new AbortController()
    this.current = operation
    return operation
  }

  isCurrent(operation: AbortController): boolean {
    return this.current === operation && !operation.signal.aborted
  }

  finish(operation: AbortController): boolean {
    if (!this.isCurrent(operation)) return false
    this.current = null
    return true
  }

  cancel(): void {
    this.current?.abort()
    this.current = null
  }
}
