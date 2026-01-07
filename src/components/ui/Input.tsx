import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react'

type InputState = 'default' | 'error' | 'success'
type InputSize = 'sm' | 'md' | 'lg'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  success?: string
  helperText?: string
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  showCharCount?: boolean
  state?: InputState
  inputSize?: InputSize
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      success,
      helperText,
      leftIcon,
      rightIcon,
      showCharCount = false,
      state: explicitState,
      inputSize = 'md',
      className = '',
      id,
      maxLength,
      value,
      defaultValue,
      onChange,
      ...props
    },
    ref
  ) => {
    const generatedId = useId()
    const inputId = id || props.name || generatedId
    const [internalValue, setInternalValue] = useState(defaultValue?.toString() || '')

    // Determine the actual value (controlled or uncontrolled)
    const actualValue = value !== undefined ? value.toString() : internalValue
    const charCount = actualValue.length

    // Handle change for character counting in uncontrolled mode
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (value === undefined) {
        setInternalValue(e.target.value)
      }
      onChange?.(e)
    }

    // Determine state: explicit > error > success > default
    const computedState: InputState = explicitState || (error ? 'error' : success ? 'success' : 'default')

    const baseInputStyles = `
      w-full bg-surface-300 border-2 rounded-lg
      text-gray-100 placeholder-gray-500
      transition-all duration-200 ease-out
      focus:outline-none
    `.replace(/\s+/g, ' ').trim()

    const sizeStyles: Record<InputSize, string> = {
      sm: 'px-3 py-2 text-sm',
      md: 'px-4 py-3 text-base',
      lg: 'px-5 py-4 text-lg',
    }

    const labelSizeStyles: Record<InputSize, string> = {
      sm: 'text-xs mb-1.5',
      md: 'text-sm mb-2',
      lg: 'text-base mb-2.5',
    }

    const stateStyles: Record<InputState, string> = {
      default: `
        border-surface-50/30
        focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500
        hover:border-surface-50/50
      `.replace(/\s+/g, ' ').trim(),
      error: `
        border-danger-500
        focus:ring-2 focus:ring-danger-500/50 focus:border-danger-500
        animate-shake
      `.replace(/\s+/g, ' ').trim(),
      success: `
        border-secondary-500
        focus:ring-2 focus:ring-secondary-500/50 focus:border-secondary-500
      `.replace(/\s+/g, ' ').trim(),
    }

    const iconSizes: Record<InputSize, { position: string; size: string }> = {
      sm: { position: 'left-2.5', size: 'w-4 h-4' },
      md: { position: 'left-3', size: 'w-5 h-5' },
      lg: { position: 'left-4', size: 'w-6 h-6' },
    }

    const iconPaddingSizes: Record<InputSize, { left: string; right: string }> = {
      sm: { left: 'pl-9', right: 'pr-12' },
      md: { left: 'pl-11', right: 'pr-16' },
      lg: { left: 'pl-14', right: 'pr-20' },
    }

    const iconPadding = {
      left: leftIcon ? iconPaddingSizes[inputSize].left : '',
      right: rightIcon || (showCharCount && maxLength) ? iconPaddingSizes[inputSize].right : '',
    }

    const messageStyles = {
      error: 'text-danger-400',
      success: 'text-secondary-400',
      helper: 'text-gray-500',
    }

    // Message to display
    const message = error || success || helperText
    const messageType = error ? 'error' : success ? 'success' : 'helper'

    // Success check icon for success state
    const SuccessIcon = () => (
      <svg
        className={`${iconSizes[inputSize].size} text-secondary-500`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    )

    // Determine the right icon to show
    const getRightIcon = () => {
      if (showCharCount && maxLength) {
        return null // Character counter is shown instead
      }
      if (computedState === 'success' && !rightIcon) {
        return <SuccessIcon />
      }
      return rightIcon
    }

    const displayedRightIcon = getRightIcon()

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className={`block font-semibold text-gray-300 uppercase tracking-wide ${labelSizeStyles[inputSize]}`}
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className={`absolute ${iconSizes[inputSize].position} top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none`}>
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`${baseInputStyles} ${sizeStyles[inputSize]} ${stateStyles[computedState]} ${iconPadding.left} ${iconPadding.right} ${className}`}
            maxLength={maxLength}
            value={value}
            defaultValue={value === undefined ? defaultValue : undefined}
            onChange={handleChange}
            aria-invalid={computedState === 'error'}
            aria-describedby={message ? `${inputId}-message` : undefined}
            {...props}
          />
          {displayedRightIcon && (
            <div className={`absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none`}>
              {displayedRightIcon}
            </div>
          )}
          {showCharCount && maxLength && (
            <div
              className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium ${
                charCount >= maxLength ? 'text-danger-400' : 'text-gray-500'
              }`}
              aria-live="polite"
            >
              {charCount}/{maxLength}
            </div>
          )}
        </div>
        {message && (
          <p
            id={`${inputId}-message`}
            className={`mt-2 text-sm font-medium ${messageStyles[messageType]}`}
            role={computedState === 'error' ? 'alert' : undefined}
          >
            {message}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

// Default export for backward compatibility
export default Input
