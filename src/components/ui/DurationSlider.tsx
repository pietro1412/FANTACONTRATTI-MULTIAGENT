import { type HTMLAttributes } from 'react'

interface DurationSliderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  disabled?: boolean
  disabledMessage?: string
  showLabels?: boolean
  className?: string
}

/**
 * Visual slider for contract duration (1-4 years)
 * More intuitive than a number input
 */
export function DurationSlider({
  value,
  onChange,
  min = 1,
  max = 4,
  disabled = false,
  disabledMessage,
  showLabels = true,
  className = '',
  ...props
}: DurationSliderProps) {
  const handleChange = (newValue: number) => {
    if (disabled) return
    const clamped = Math.max(min, Math.min(max, newValue))
    onChange(clamped)
  }

  // Generate year marks
  const marks = []
  for (let i = min; i <= max; i++) {
    marks.push(i)
  }

  // Calculate filled percentage
  const fillPercentage = ((value - min) / (max - min)) * 100

  return (
    <div className={`${className}`} {...props}>
      {/* Slider track */}
      <div className="relative pt-2 pb-4">
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => handleChange(parseInt(e.target.value))}
          disabled={disabled}
          className="w-full h-2 bg-surface-300 rounded-full appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 accent-primary-500"
          style={{
            background: disabled
              ? undefined
              : `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${fillPercentage}%, #1a1c20 ${fillPercentage}%, #1a1c20 100%)`,
          }}
        />

        {/* Year labels */}
        {showLabels && (
          <div className="flex justify-between mt-2">
            {marks.map((mark) => (
              <button
                key={mark}
                onClick={() => handleChange(mark)}
                disabled={disabled}
                className={`text-xs font-medium transition-colors ${
                  value === mark
                    ? 'text-primary-400'
                    : 'text-gray-500 hover:text-gray-300'
                } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
              >
                {mark} {mark === 1 ? 'anno' : 'anni'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Current value display */}
      <div className="text-center mt-1">
        <span className="text-2xl font-bold text-white stat-number">{value}</span>
        <span className="text-sm text-gray-400 ml-1">{value === 1 ? 'anno' : 'anni'}</span>
      </div>

      {/* Disabled message */}
      {disabled && disabledMessage && (
        <p className="text-xs text-gray-500 text-center mt-1">{disabledMessage}</p>
      )}
    </div>
  )
}

/**
 * Compact version for table cells
 */
export function DurationSliderCompact({
  value,
  onChange,
  min = 1,
  max = 4,
  disabled = false,
  canDecrease = true,
}: {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  disabled?: boolean
  canDecrease?: boolean
}) {
  const handleChange = (newValue: number) => {
    if (disabled) return
    const clamped = Math.max(min, Math.min(max, newValue))
    onChange(clamped)
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => handleChange(value - 1)}
        disabled={disabled || value <= min || (!canDecrease && value <= min)}
        className="w-8 h-8 flex items-center justify-center rounded bg-surface-300 text-white font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-surface-100 transition-colors min-h-[44px]"
        aria-label="Riduci durata"
      >
        −
      </button>
      <div className="w-12 h-8 flex items-center justify-center bg-surface-300 text-white font-medium rounded min-h-[44px]">
        {value}s
      </div>
      <button
        onClick={() => handleChange(value + 1)}
        disabled={disabled || value >= max}
        className="w-8 h-8 flex items-center justify-center rounded bg-surface-300 text-white font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-surface-100 transition-colors min-h-[44px]"
        aria-label="Aumenta durata"
      >
        +
      </button>
    </div>
  )
}

export default DurationSlider
