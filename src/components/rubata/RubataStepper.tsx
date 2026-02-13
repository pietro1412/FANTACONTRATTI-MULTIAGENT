type RubataState = 'WAITING' | 'PREVIEW' | 'READY_CHECK' | 'OFFERING' | 'AUCTION_READY_CHECK' | 'AUCTION' | 'PENDING_ACK' | 'PAUSED' | 'COMPLETED' | null

interface RubataStepperProps {
  currentState: RubataState
  className?: string
}

const STEPS = [
  { key: 'WAITING', label: 'Attesa', shortLabel: 'Att.', icon: '⏹️', color: 'primary' },
  { key: 'PREVIEW', label: 'Preview', shortLabel: 'Prev.', icon: '👁️', color: 'indigo' },
  { key: 'READY_CHECK', label: 'Pronti?', shortLabel: 'Pronti', icon: '🔔', color: 'blue' },
  { key: 'OFFERING', label: 'Offerta', shortLabel: 'Off.', icon: '⏳', color: 'warning' },
  { key: 'AUCTION', label: 'Asta', shortLabel: 'Asta', icon: '🔥', color: 'danger' },
  { key: 'PENDING_ACK', label: 'Conferma', shortLabel: 'Conf.', icon: '✋', color: 'purple' },
] as const

// Map from AUCTION_READY_CHECK to AUCTION step (it's a sub-step before auction)
function getEffectiveStep(state: RubataState): string {
  if (state === 'AUCTION_READY_CHECK') return 'AUCTION'
  if (state === 'PAUSED') return 'OFFERING' // Paused during offering
  return state || 'WAITING'
}

function getStepIndex(state: RubataState): number {
  const effective = getEffectiveStep(state)
  const idx = STEPS.findIndex(s => s.key === effective)
  return idx >= 0 ? idx : 0
}

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  primary: { bg: 'bg-primary-500/20', border: 'border-primary-500', text: 'text-primary-400', dot: 'bg-primary-500' },
  indigo: { bg: 'bg-indigo-500/20', border: 'border-indigo-500', text: 'text-indigo-400', dot: 'bg-indigo-500' },
  blue: { bg: 'bg-blue-500/20', border: 'border-blue-500', text: 'text-blue-400', dot: 'bg-blue-500' },
  warning: { bg: 'bg-warning-500/20', border: 'border-warning-500', text: 'text-warning-400', dot: 'bg-warning-500' },
  danger: { bg: 'bg-danger-500/20', border: 'border-danger-500', text: 'text-danger-400', dot: 'bg-danger-500' },
  purple: { bg: 'bg-purple-500/20', border: 'border-purple-500', text: 'text-purple-400', dot: 'bg-purple-500' },
}

export function RubataStepper({ currentState, className = '' }: RubataStepperProps) {
  if (currentState === 'COMPLETED') {
    return (
      <div className={`flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-secondary-500/20 border border-secondary-500/40 ${className}`}>
        <span>✅</span>
        <span className="text-secondary-400 font-bold text-sm">Rubata Completata</span>
      </div>
    )
  }

  const activeIndex = getStepIndex(currentState)

  return (
    <div className={`${className}`}>
      {/* Desktop: full stepper */}
      <div className="hidden md:flex items-center gap-1">
        {STEPS.map((step, i) => {
          const isActive = i === activeIndex
          const isCompleted = i < activeIndex
          const colors = COLOR_MAP[step.color]

          return (
            <div key={step.key} className="flex items-center">
              {/* Step */}
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                isActive
                  ? `${colors.bg} ${colors.text} border ${colors.border}/40 shadow-sm`
                  : isCompleted
                    ? 'bg-surface-300/50 text-gray-500 line-through'
                    : 'bg-surface-300/30 text-gray-600'
              }`}>
                <span className="text-sm">{isActive ? step.icon : isCompleted ? '✓' : '○'}</span>
                <span>{step.label}</span>
              </div>
              {/* Connector */}
              {i < STEPS.length - 1 && (
                <div className={`w-4 h-0.5 mx-0.5 ${
                  i < activeIndex ? 'bg-gray-600' : 'bg-surface-300/30'
                }`} />
              )}
            </div>
          )
        })}
      </div>

      {/* Mobile: compact dots + current label */}
      <div className="flex md:hidden items-center gap-2 px-3 py-2 rounded-xl bg-surface-200 border border-surface-50/20">
        <div className="flex items-center gap-1">
          {STEPS.map((step, i) => {
            const isActive = i === activeIndex
            const isCompleted = i < activeIndex
            const colors = COLOR_MAP[step.color]

            return (
              <div
                key={step.key}
                className={`rounded-full transition-all ${
                  isActive
                    ? `w-3 h-3 ${colors.dot} shadow-lg animate-pulse`
                    : isCompleted
                      ? 'w-2 h-2 bg-gray-500'
                      : 'w-2 h-2 bg-surface-300'
                }`}
              />
            )
          })}
        </div>
        <div className="flex items-center gap-1.5 text-sm">
          <span>{STEPS[activeIndex]?.icon}</span>
          <span className={`font-bold ${COLOR_MAP[STEPS[activeIndex]?.color]?.text || 'text-gray-400'}`}>
            {STEPS[activeIndex]?.label || currentState}
          </span>
          <span className="text-gray-600 text-xs">({activeIndex + 1}/{STEPS.length})</span>
        </div>
      </div>
    </div>
  )
}

export default RubataStepper
