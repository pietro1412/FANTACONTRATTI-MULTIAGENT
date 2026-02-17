interface PhaseCalendarProps {
  sessions: Array<{
    type: string
    status: string
    currentPhase: string
    phaseStartedAt: string | null
  }>
}

const PRIMO_MERCATO_PHASES = [
  { key: 'ASTA_LIBERA', label: 'Asta', icon: '🔨' },
  { key: 'PREMI', label: 'Premi', icon: '🏆' },
  { key: 'OFFERTE_PRE_RINNOVO', label: 'Offerte', icon: '🔄' },
  { key: 'CONTRATTI', label: 'Contratti', icon: '📝' },
  { key: 'RUBATA', label: 'Rubata', icon: '🎯' },
  { key: 'ASTA_SVINCOLATI', label: 'Svincolati', icon: '📋' },
  { key: 'OFFERTE_POST_ASTA_SVINCOLATI', label: 'Post-Asta', icon: '🔄' },
]

const MERCATO_RICORRENTE_PHASES = [
  { key: 'OFFERTE_PRE_RINNOVO', label: 'Offerte', icon: '🔄' },
  { key: 'CONTRATTI', label: 'Contratti', icon: '📝' },
  { key: 'RUBATA', label: 'Rubata', icon: '🎯' },
  { key: 'ASTA_SVINCOLATI', label: 'Svincolati', icon: '📋' },
  { key: 'OFFERTE_POST_ASTA_SVINCOLATI', label: 'Post-Asta', icon: '🔄' },
]

export function PhaseCalendar({ sessions }: PhaseCalendarProps) {
  const activeSession = sessions.find(s => s.status === 'ACTIVE')
  if (!activeSession) return null

  const phases = activeSession.type === 'PRIMO_MERCATO' ? PRIMO_MERCATO_PHASES : MERCATO_RICORRENTE_PHASES
  const currentIdx = phases.findIndex(p => p.key === activeSession.currentPhase)

  return (
    <div className="mt-3 overflow-x-auto scrollbar-hide">
      <div className="flex items-center gap-0 min-w-max">
        {phases.map((phase, i) => {
          const isCurrent = i === currentIdx
          const isDone = i < currentIdx
          const isFuture = i > currentIdx

          return (
            <div key={phase.key} className="flex items-center">
              {i > 0 && (
                <div className={`w-4 sm:w-6 h-0.5 flex-shrink-0 ${
                  isDone ? 'bg-secondary-500' : isCurrent ? 'bg-primary-500' : 'bg-surface-50/20'
                }`} />
              )}
              <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] sm:text-xs whitespace-nowrap transition-all ${
                isCurrent
                  ? 'bg-primary-500/20 border border-primary-500/40 text-primary-300 font-semibold'
                  : isDone
                    ? 'text-gray-400'
                    : 'text-gray-500'
              }`}>
                <span className={`${isFuture ? 'opacity-40' : ''}`}>{phase.icon}</span>
                <span>{phase.label}</span>
                {isDone && <span className="text-secondary-400 ml-0.5">✓</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
