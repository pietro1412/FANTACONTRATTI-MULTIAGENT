interface PhaseStepperProps {
  leagueStatus: string
  sessions: Array<{ type: string; status: string }>
}

type Phase = 'PRE_STAGIONE' | 'PRIMO_MERCATO' | 'MERCATO_RICORRENTE'

const STEPS: { key: Phase; label: string; shortLabel: string }[] = [
  { key: 'PRE_STAGIONE', label: 'Pre-Stagione', shortLabel: 'Pre' },
  { key: 'PRIMO_MERCATO', label: 'Primo Mercato', shortLabel: '1° Merc.' },
  { key: 'MERCATO_RICORRENTE', label: 'Mercato Ricorrente', shortLabel: 'Ric.' },
]

function derivePhase(leagueStatus: string, sessions: Array<{ type: string; status: string }>): Phase {
  if (leagueStatus === 'DRAFT') return 'PRE_STAGIONE'
  const firstMarketDone = sessions.some(s => s.type === 'PRIMO_MERCATO' && s.status === 'COMPLETED')
  return firstMarketDone ? 'MERCATO_RICORRENTE' : 'PRIMO_MERCATO'
}

export function PhaseStepper({ leagueStatus, sessions }: PhaseStepperProps) {
  const currentPhase = derivePhase(leagueStatus, sessions)
  const currentIdx = STEPS.findIndex(s => s.key === currentPhase)

  return (
    <div className="flex items-center gap-0 overflow-x-auto scrollbar-hide">
      {STEPS.map((step, i) => {
        const isActive = i === currentIdx
        const isDone = i < currentIdx
        return (
          <div key={step.key} className="flex items-center flex-shrink-0">
            {i > 0 && (
              <div className={`w-6 sm:w-10 h-0.5 ${isDone ? 'bg-primary-500' : 'bg-surface-50/30'}`} />
            )}
            <div className="flex items-center gap-1.5">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                isActive ? 'bg-primary-500 text-white ring-2 ring-primary-500/30' :
                isDone ? 'bg-primary-500/30 text-primary-300' :
                'bg-surface-50/20 text-gray-500'
              }`}>
                {isDone ? '\u2713' : i + 1}
              </div>
              <span className={`text-xs font-medium whitespace-nowrap ${
                isActive ? 'text-primary-400' : isDone ? 'text-gray-400' : 'text-gray-600'
              }`}>
                <span className="hidden sm:inline">{step.label}</span>
                <span className="sm:hidden">{step.shortLabel}</span>
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
