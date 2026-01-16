import { cn } from '../../lib/utils'

interface NumberStepperProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  label?: string
  error?: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
  showValue?: boolean
}

export function NumberStepper({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  error,
  className,
  size = 'md',
  showValue = true,
}: NumberStepperProps) {
  const handleDecrement = () => {
    const newValue = value - step
    if (newValue >= min) {
      onChange(newValue)
    }
  }

  const handleIncrement = () => {
    const newValue = value + step
    if (newValue <= max) {
      onChange(newValue)
    }
  }

  const isMinDisabled = value <= min
  const isMaxDisabled = value >= max

  const sizeClasses = {
    sm: {
      button: 'w-8 h-8 text-lg',
      value: 'text-lg min-w-[3rem]',
      container: 'gap-2',
    },
    md: {
      button: 'w-10 h-10 text-xl',
      value: 'text-xl min-w-[4rem]',
      container: 'gap-3',
    },
    lg: {
      button: 'w-12 h-12 text-2xl',
      value: 'text-2xl min-w-[5rem]',
      container: 'gap-4',
    },
  }

  return (
    <div className={cn('', className)}>
      {label && (
        <label className="block text-sm font-semibold text-gray-300 mb-2 uppercase tracking-wide">
          {label}
        </label>
      )}

      <div className={cn('flex items-center justify-center', sizeClasses[size].container)}>
        {/* Decrement Button */}
        <button
          type="button"
          onClick={handleDecrement}
          disabled={isMinDisabled}
          className={cn(
            'flex items-center justify-center rounded-lg font-bold transition-all duration-200',
            'bg-surface-300 border-2 border-surface-50/30 text-gray-300',
            'hover:bg-primary-600 hover:border-primary-500 hover:text-white',
            'active:scale-95',
            'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-surface-300 disabled:hover:border-surface-50/30 disabled:hover:text-gray-300',
            sizeClasses[size].button
          )}
          aria-label="Diminuisci"
        >
          −
        </button>

        {/* Value Display */}
        {showValue && (
          <span
            className={cn(
              'font-bold text-white text-center tabular-nums',
              sizeClasses[size].value
            )}
          >
            {value}
          </span>
        )}

        {/* Increment Button */}
        <button
          type="button"
          onClick={handleIncrement}
          disabled={isMaxDisabled}
          className={cn(
            'flex items-center justify-center rounded-lg font-bold transition-all duration-200',
            'bg-surface-300 border-2 border-surface-50/30 text-gray-300',
            'hover:bg-primary-600 hover:border-primary-500 hover:text-white',
            'active:scale-95',
            'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-surface-300 disabled:hover:border-surface-50/30 disabled:hover:text-gray-300',
            sizeClasses[size].button
          )}
          aria-label="Aumenta"
        >
          +
        </button>
      </div>

      {error && (
        <p className="mt-2 text-sm text-danger-400 text-center">{error}</p>
      )}
    </div>
  )
}
