import { useEffect, useRef, useState } from 'react'

/** Keep the typing draft stable while applying every valid value immediately. */
export function LiveNumberInput({
  value,
  onValueChange,
  onRejectedValue,
  min,
  max,
  integer = false,
  precision = 3,
  disabled,
  ...props
}: {
  value: number
  onValueChange: (value: number) => number | boolean | void
  onRejectedValue?: () => void
  integer?: boolean
  precision?: number
} & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type' | 'min' | 'max'
> & {
    min?: number
    max?: number
  }): JSX.Element {
  const format = (number: number) => String(Number(number.toFixed(precision)))
  const [draft, setDraft] = useState(() => format(value))
  const focused = useRef(false)
  useEffect(() => {
    if (!focused.current || disabled) setDraft(format(value))
  }, [value, disabled, precision])
  return (
    <input
      {...props}
      type="number"
      min={min}
      max={max}
      disabled={disabled}
      value={draft}
      onFocus={() => {
        focused.current = true
      }}
      onChange={(event) => {
        const text = event.currentTarget.value
        setDraft(text)
        const number = Number(text)
        if (text.trim() !== '' && (number > (max ?? Infinity) || !Number.isFinite(number))) {
          onRejectedValue?.()
          setDraft(format(value))
          return
        }
        if (
          text.trim() === '' ||
          !Number.isFinite(number) ||
          (integer && !Number.isSafeInteger(number)) ||
          (min !== undefined && number < min) ||
          (max !== undefined && number > max)
        )
          return
        if (number !== value && onValueChange(number) === false) setDraft(format(value))
      }}
      onBlur={() => {
        focused.current = false
        setDraft(format(value))
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === 'Escape') {
          event.preventDefault()
          event.currentTarget.blur()
        }
      }}
    />
  )
}
