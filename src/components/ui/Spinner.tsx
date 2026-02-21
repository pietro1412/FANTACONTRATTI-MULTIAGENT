import { forwardRef, type HTMLAttributes } from 'react'

type SpinnerSize = 'sm' | 'md' | 'lg' | 'xl'
type SpinnerColor = 'primary' | 'white' | 'danger' | 'accent'

interface SpinnerProps extends HTMLAttributes<HTMLDivElement> {
  size?: SpinnerSize
  color?: SpinnerColor
  className?: string
}

const SIZE_MAP: Record<SpinnerSize, string> = {
  sm: 'w-4 h-4 border-2',
  md: 'w-8 h-8 border-3',
  lg: 'w-12 h-12 border-4',
  xl: 'w-16 h-16 border-4',
}

const COLOR_MAP: Record<SpinnerColor, string> = {
  primary: 'border-primary-500/30 border-t-primary-500',
  white: 'border-white/30 border-t-white',
  danger: 'border-danger-500/30 border-t-danger-500',
  accent: 'border-accent-500/30 border-t-accent-500',
}

export const Spinner = forwardRef<HTMLDivElement, SpinnerProps>(
  ({ size = 'md', color = 'primary', className = '', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`${SIZE_MAP[size]} ${COLOR_MAP[color]} rounded-full animate-spin ${className}`}
        role="status"
        aria-label="Caricamento"
        {...props}
      >
        <span className="sr-only">Caricamento...</span>
      </div>
    )
  }
)

Spinner.displayName = 'Spinner'

export default Spinner
