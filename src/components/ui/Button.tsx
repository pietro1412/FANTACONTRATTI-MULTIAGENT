import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'accent'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  isLoading?: boolean
  loadingText?: string
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  fullWidth?: boolean
  children: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      loadingText,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles = `
      inline-flex items-center justify-center font-semibold rounded-lg
      transition-all duration-200 ease-out
      transform hover:scale-[1.02] active:scale-[0.98]
      disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:active:scale-100
      focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-dark-100
    `.replace(/\s+/g, ' ').trim()

    const variants = {
      primary: `
        bg-gradient-to-r from-primary-500 to-primary-600 text-white
        hover:from-primary-400 hover:to-primary-500
        shadow-lg shadow-primary-500/25 hover:shadow-xl hover:shadow-primary-500/30
        focus-visible:ring-primary-400
      `.replace(/\s+/g, ' ').trim(),
      secondary: `
        bg-gradient-to-r from-secondary-600 to-secondary-700 text-white
        hover:from-secondary-500 hover:to-secondary-600
        shadow-lg shadow-secondary-500/25 hover:shadow-xl hover:shadow-secondary-500/30
        focus-visible:ring-secondary-400
      `.replace(/\s+/g, ' ').trim(),
      danger: `
        bg-gradient-to-r from-danger-500 to-danger-600 text-white
        hover:from-danger-400 hover:to-danger-500
        shadow-lg shadow-danger-500/25 hover:shadow-xl hover:shadow-danger-500/30
        focus-visible:ring-danger-400
      `.replace(/\s+/g, ' ').trim(),
      ghost: `
        bg-transparent text-gray-300
        hover:bg-surface-200 hover:text-white
        focus-visible:ring-gray-400
      `.replace(/\s+/g, ' ').trim(),
      outline: `
        bg-transparent border-2 border-primary-500/50 text-primary-400
        hover:bg-primary-500/10 hover:border-primary-400 hover:text-primary-300
        focus-visible:ring-primary-400
      `.replace(/\s+/g, ' ').trim(),
      accent: `
        bg-gradient-to-r from-accent-500 to-accent-600 text-dark-900 font-bold
        hover:from-accent-400 hover:to-accent-500
        shadow-lg shadow-accent-500/25 hover:shadow-xl hover:shadow-accent-500/30
        focus-visible:ring-accent-400
      `.replace(/\s+/g, ' ').trim(),
    }

    // Touch-friendly sizes with minimum 44x44px touch targets (Apple/Google accessibility standard)
    const sizes = {
      sm: 'px-4 py-2 text-sm gap-1.5 min-h-[44px] min-w-[44px]',
      md: 'px-5 py-2.5 text-base gap-2 min-h-[48px]',
      lg: 'px-6 py-3 text-lg gap-2.5 min-h-[52px]',
      xl: 'px-8 py-4 text-xl gap-3 min-h-[56px]',
    }

    const spinnerSizes = {
      sm: 'h-4 w-4',
      md: 'h-5 w-5',
      lg: 'h-6 w-6',
      xl: 'h-7 w-7',
    }

    const widthClass = fullWidth ? 'w-full' : ''

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${widthClass} ${className}`}
        disabled={disabled || isLoading}
        aria-busy={isLoading}
        aria-disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <>
            <svg
              className={`animate-spin ${spinnerSizes[size]}`}
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>{loadingText || 'Caricamento...'}</span>
          </>
        ) : (
          <>
            {leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
          </>
        )}
      </button>
    )
  }
)

Button.displayName = 'Button'

// Keep default export for backward compatibility
export default Button
