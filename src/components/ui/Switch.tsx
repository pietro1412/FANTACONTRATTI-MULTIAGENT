import { useId } from 'react'

export interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  /** Accessible label (sr-only when no visible label is provided next to the switch). */
  label?: string
}

/**
 * Token-only toggle switch (off = border, on = secondary).
 * Touch target >= 44px via the wrapping button's padding, while the visible
 * track stays compact (46x26). role="switch" + aria-checked for a11y.
 */
export function Switch({ checked, onChange, disabled = false, label }: SwitchProps) {
  const id = useId()

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-labelledby={label ? undefined : `${id}-label`}
      disabled={disabled}
      onClick={() => { if (!disabled) onChange(!checked) }}
      className={`relative inline-flex items-center justify-center p-2.5 -m-2.5 rounded-full flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/50 ${
        disabled ? 'cursor-not-allowed' : 'cursor-pointer'
      }`}
    >
      <span
        className={`relative block w-[46px] h-[26px] rounded-full transition-colors duration-150 ${
          checked ? 'bg-secondary-500' : 'bg-surface-50/40'
        } ${disabled ? 'opacity-40' : ''}`}
      >
        <span
          className={`absolute top-[3px] left-[3px] w-5 h-5 rounded-full bg-white transition-transform duration-150 ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </span>
    </button>
  )
}
