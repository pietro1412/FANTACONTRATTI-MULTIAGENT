import { useState, useRef, useCallback, useEffect } from 'react'

/**
 * Themed, digitable amount control (Stadium Nights). Generalizes the BudgetStepper
 * pattern from the trades deal room: the value is freely typable (click the number →
 * edit → commit on blur/Enter) and the optional − / + buttons support long-press to
 * ramp. Built for arbitrary, large amounts (prizes/indemnities can be 120M, 200M…):
 * there is NO default max cap.
 *
 * The parent keeps owning the persistence (onChange = commit, same as before): each
 * commit emits the new clamped value and the caller saves it.
 */

type AmountStepperTone = 'neutral' | 'accent' | 'primary'

interface AmountStepperProps {
  value: number
  /** Commit handler. Fires on +/−, and on blur/Enter when typing. */
  onChange: (value: number) => void
  min?: number
  /** Optional upper bound. Omit for arbitrary large amounts (default: no cap). */
  max?: number
  step?: number
  /** Suffix rendered after the value when not editing (e.g. "M"). */
  unit?: string
  tone?: AmountStepperTone
  size?: 'sm' | 'md'
  /** Dims the control and blocks interaction (e.g. while saving). */
  disabled?: boolean
  className?: string
  'aria-label'?: string
}

const TONE_STYLES: Record<AmountStepperTone, { border: string; value: string; bg: string }> = {
  neutral: { border: 'border-surface-50/30', value: 'text-white', bg: 'bg-surface-300' },
  accent: { border: 'border-accent-500/30', value: 'text-accent-300', bg: 'bg-accent-500/[0.05]' },
  primary: { border: 'border-primary-500/30', value: 'text-primary-300', bg: 'bg-primary-500/[0.05]' },
}

const SIZE_STYLES = {
  sm: { btn: 'w-9 min-h-[44px] sm:min-h-[36px] sm:w-8', field: 'min-w-[52px] h-[36px] text-base' },
  md: { btn: 'w-10 min-h-[44px]', field: 'min-w-[64px] h-[44px] text-lg' },
}

function useLongPress(callback: () => void, delay = 400, interval = 80) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stop = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (intervalRef.current) clearInterval(intervalRef.current)
    timerRef.current = null
    intervalRef.current = null
  }, [])

  const start = useCallback(() => {
    timerRef.current = setTimeout(() => {
      intervalRef.current = setInterval(callback, interval)
    }, delay)
  }, [callback, delay, interval])

  useEffect(() => stop, [stop])

  return { onMouseDown: start, onMouseUp: stop, onMouseLeave: stop, onTouchStart: start, onTouchEnd: stop }
}

export function AmountStepper({
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  unit,
  tone = 'neutral',
  size = 'sm',
  disabled = false,
  className = '',
  'aria-label': ariaLabel,
}: AmountStepperProps) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const colors = TONE_STYLES[tone]
  const sz = SIZE_STYLES[size]

  const clamp = useCallback(
    (n: number) => {
      const lower = Math.max(min, n)
      return max != null ? Math.min(max, lower) : lower
    },
    [min, max]
  )

  const decrement = useCallback(() => { onChange(clamp(value - step)) }, [onChange, clamp, value, step])
  const increment = useCallback(() => { onChange(clamp(value + step)) }, [onChange, clamp, value, step])
  const longPressDown = useLongPress(decrement)
  const longPressUp = useLongPress(increment)

  function commitEdit() {
    const num = parseInt(editValue, 10)
    if (!isNaN(num)) {
      onChange(clamp(num))
    }
    setEditing(false)
  }

  const isMinDisabled = disabled || value <= min
  const isMaxDisabled = disabled || (max != null && value >= max)

  return (
    <div className={`inline-flex items-center ${disabled ? 'opacity-50 pointer-events-none' : ''} ${className}`}>
      <button
        type="button"
        onClick={decrement}
        disabled={isMinDisabled}
        {...longPressDown}
        className={`${sz.btn} bg-surface-200 border ${colors.border} rounded-l-lg text-white font-bold leading-none disabled:opacity-30 disabled:cursor-not-allowed hover:bg-surface-100 transition-colors flex items-center justify-center`}
        aria-label="Diminuisci"
      >
        −
      </button>
      {editing ? (
        <input
          type="number"
          autoFocus
          value={editValue}
          onChange={e => { setEditValue(e.target.value) }}
          onBlur={commitEdit}
          onKeyDown={e => { if (e.key === 'Enter') commitEdit() }}
          aria-label={ariaLabel}
          className={`${sz.field} bg-surface-300 border-y ${colors.border} text-center stat-number text-white outline-none px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
        />
      ) : (
        <button
          type="button"
          onClick={() => { setEditValue(String(value)); setEditing(true) }}
          aria-label={ariaLabel}
          className={`${sz.field} px-2 ${colors.bg} border-y ${colors.border} ${colors.value} flex items-center justify-center gap-0.5 stat-number cursor-text tabular-nums`}
        >
          {value}
          {unit && <span className="text-[0.7em] text-gray-500">{unit}</span>}
        </button>
      )}
      <button
        type="button"
        onClick={increment}
        disabled={isMaxDisabled}
        {...longPressUp}
        className={`${sz.btn} bg-surface-200 border ${colors.border} rounded-r-lg text-white font-bold leading-none disabled:opacity-30 disabled:cursor-not-allowed hover:bg-surface-100 transition-colors flex items-center justify-center`}
        aria-label="Aumenta"
      >
        +
      </button>
    </div>
  )
}
