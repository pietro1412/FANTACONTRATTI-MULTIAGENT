import type { AuctionPhase } from './types'
import { PHASE_COLORS } from './types'

interface PhaseIndicatorProps {
  currentPhase: AuctionPhase
  compact?: boolean
}

const PHASE_ORDER: AuctionPhase[] = ['nomination', 'readyCheck', 'bidding', 'acknowledgment']

export function PhaseIndicator({ currentPhase, compact }: PhaseIndicatorProps) {
  if (currentPhase === 'waiting') {
    return (
      <div className="flex items-center gap-1">
        {PHASE_ORDER.map(phase => (
          <span key={phase} className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface-300 text-gray-500 border border-surface-50/20">
            {compact ? PHASE_COLORS[phase].label.charAt(0) : PHASE_COLORS[phase].label}
          </span>
        ))}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1">
      {PHASE_ORDER.map(phase => {
        const active = phase === currentPhase
        const colors = PHASE_COLORS[phase]
        return (
          <span
            key={phase}
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all ${
              active
                ? `${colors.bg} ${colors.text} ${colors.border}`
                : 'bg-surface-300 text-gray-500 border-surface-50/20'
            }`}
          >
            {compact ? colors.label.charAt(0) : colors.label}
          </span>
        )
      })}
    </div>
  )
}
