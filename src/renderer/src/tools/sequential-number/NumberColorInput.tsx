import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'

/** Native color dialogs emit many input events while their selector is dragged. */
export function NumberColorInput({
  value,
  onCommit,
  className
}: {
  value: string
  onCommit: (color: string) => void
  className?: string
}): JSX.Element {
  const [draft, setDraft] = useState(value)
  const pending = useRef<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const commit = useRef(onCommit)
  commit.current = onCommit
  const flush = () => {
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = null
    const next = pending.current
    pending.current = null
    if (next !== null) commit.current(next)
  }
  useEffect(() => {
    if (pending.current === null) setDraft(value)
  }, [value])
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current)
      // Preserve a final choice when the selected position changes.
      if (pending.current !== null) commit.current(pending.current)
    },
    []
  )
  return (
    <input
      type="color"
      className={className}
      value={draft}
      onChange={(event) => {
        const next = event.target.value
        setDraft(next)
        pending.current = next
        if (timer.current !== null) clearTimeout(timer.current)
        timer.current = setTimeout(flush, 150)
      }}
      // Commit before a subsequent Save/Export click reads the project snapshot.
      onBlur={() => flushSync(flush)}
    />
  )
}
