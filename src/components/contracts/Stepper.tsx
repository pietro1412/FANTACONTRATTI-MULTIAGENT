/**
 * Compact contract stepper (mockup 08): − [value unit] + with Oswald value.
 * Thin wrapper that wires the existing increment/decrement handlers; the parent
 * keeps owning the domain constraints (disabled/min/max), this is presentation.
 */
export function Stepper({
  value,
  unit,
  tone = 'gold',
  onDecrement,
  onIncrement,
  decDisabled,
  incDisabled,
  decTitle,
  incTitle,
}: {
  value: number | string
  unit: string
  tone?: 'gold' | 'primary'
  onDecrement: () => void
  onIncrement: () => void
  decDisabled?: boolean
  incDisabled?: boolean
  decTitle?: string
  incTitle?: string
}) {
  const valueColor = tone === 'primary' ? 'text-primary-400' : 'text-accent-400'
  return (
    <div className="inline-flex items-stretch border border-surface-50 rounded-lg overflow-hidden bg-surface-300">
      <button
        type="button"
        onClick={onDecrement}
        disabled={decDisabled}
        title={decTitle}
        aria-label="Diminuisci"
        className="w-9 min-h-[44px] sm:min-h-0 sm:w-8 bg-surface-200 hover:bg-surface-100 text-white font-display text-lg leading-none disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >−</button>
      <div className="flex flex-col items-center justify-center min-w-[56px] px-2 py-1">
        <span className={`stat-number text-lg leading-none ${valueColor}`}>{value}</span>
        <span className="text-[8px] text-gray-500 uppercase tracking-[0.08em] mt-0.5">{unit}</span>
      </div>
      <button
        type="button"
        onClick={onIncrement}
        disabled={incDisabled}
        title={incTitle}
        aria-label="Aumenta"
        className="w-9 min-h-[44px] sm:min-h-0 sm:w-8 bg-surface-200 hover:bg-surface-100 text-white font-display text-lg leading-none disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >+</button>
    </div>
  )
}
