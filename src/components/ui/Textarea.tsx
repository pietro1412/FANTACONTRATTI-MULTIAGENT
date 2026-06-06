import { forwardRef, useId, useState, type TextareaHTMLAttributes } from 'react'

type TextareaState = 'default' | 'error' | 'success'
type TextareaSize = 'sm' | 'md' | 'lg'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  success?: string
  helperText?: string
  showCharCount?: boolean
  state?: TextareaState
  textareaSize?: TextareaSize
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      error,
      success,
      helperText,
      showCharCount = false,
      state: explicitState,
      textareaSize = 'md',
      className = '',
      id,
      maxLength,
      value,
      defaultValue,
      onChange,
      rows = 4,
      ...props
    },
    ref
  ) => {
    const generatedId = useId()
    const textareaId = id || props.name || generatedId
    const [internalValue, setInternalValue] = useState(defaultValue?.toString() || '')

    // Determine the actual value (controlled or uncontrolled)
    const actualValue = value !== undefined ? value.toString() : internalValue
    const charCount = actualValue.length

    // Handle change for character counting in uncontrolled mode
    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (value === undefined) {
        setInternalValue(e.target.value)
      }
      onChange?.(e)
    }

    // Determine state: explicit > error > success > default
    const computedState: TextareaState = explicitState || (error ? 'error' : success ? 'success' : 'default')

    const baseStyles = `
      w-full bg-surface-300 border-2 rounded-lg resize-y
      text-gray-100 placeholder-gray-500
      transition-all duration-200 ease-out
      focus:outline-none
    `.replace(/\s+/g, ' ').trim()

    const sizeStyles: Record<TextareaSize, string> = {
      sm: 'px-3 py-2 text-sm',
      md: 'px-4 py-3 text-base',
      lg: 'px-5 py-4 text-lg',
    }

    const labelSizeStyles: Record<TextareaSize, string> = {
      sm: 'text-xs mb-1.5',
      md: 'text-sm mb-2',
      lg: 'text-base mb-2.5',
    }

    const stateStyles: Record<TextareaState, string> = {
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

    const messageStyles = {
      error: 'text-danger-400',
      success: 'text-secondary-400',
      helper: 'text-gray-400',
    }

    // Message to display
    const message = error || success || helperText
    const messageType = error ? 'error' : success ? 'success' : 'helper'

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={textareaId}
            className={`block font-semibold text-gray-300 uppercase tracking-wide ${labelSizeStyles[textareaSize]}`}
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          className={`${baseStyles} ${sizeStyles[textareaSize]} ${stateStyles[computedState]} ${className}`}
          maxLength={maxLength}
          value={value}
          defaultValue={value === undefined ? defaultValue : undefined}
          onChange={handleChange}
          aria-invalid={computedState === 'error'}
          aria-describedby={message ? `${textareaId}-message` : undefined}
          {...props}
        />
        <div className="flex items-start justify-between gap-2">
          {message ? (
            <p
              id={`${textareaId}-message`}
              className={`mt-2 text-sm font-medium ${messageStyles[messageType]}`}
              role={computedState === 'error' ? 'alert' : undefined}
            >
              {message}
            </p>
          ) : (
            <span />
          )}
          {showCharCount && maxLength && (
            <span
              className={`mt-2 text-xs font-medium shrink-0 ${charCount >= maxLength ? 'text-danger-400' : 'text-gray-400'}`}
              aria-live="polite"
            >
              {charCount}/{maxLength}
            </span>
          )}
        </div>
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'

export default Textarea
