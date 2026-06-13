// Indicatore di fase unico per l'Hub Lega: fonde la progressione macro
// (Pre-mercato → Primo Mercato → Mercato Ricorrente) con la sequenza delle fasi
// del mercato ricorrente quando è in corso. Sostituisce PhaseStepper + PhaseCalendar.

interface PhaseIndicatorProps {
  leagueStatus: string
  sessions: Array<{ type: string; status: string; currentPhase: string }>
}

type StepState = 'done' | 'current' | 'future'

interface Step {
  key: string
  label: string
  state: StepState
  /** Etichetta nel dot: numero, ✓ (done) o ● (current). */
  marker: string
}

// Ordine canonico delle fasi del mercato ricorrente (vedi MERCATO_RICORRENTE in CLAUDE.md).
const RECURRENT_PHASES: { key: string; label: string }[] = [
  { key: 'OFFERTE_PRE_RINNOVO', label: 'Scambi' },
  { key: 'PREMI', label: 'Premi' },
  { key: 'CONTRATTI', label: 'Contratti' },
  { key: 'RUBATA', label: 'Rubata' },
  { key: 'ASTA_SVINCOLATI', label: 'Svincolati' },
  { key: 'OFFERTE_POST_ASTA_SVINCOLATI', label: 'Post-asta' },
]

function buildSteps(leagueStatus: string, sessions: PhaseIndicatorProps['sessions']): Step[] {
  const firstMarketDone = sessions.some(s => s.type === 'PRIMO_MERCATO' && s.status === 'COMPLETED')
  const activeSession = sessions.find(s => s.status === 'ACTIVE') ?? null

  // Macro step 1-2: Pre-mercato e Primo Mercato
  const isDraft = leagueStatus === 'DRAFT'
  const firstMarketActive = activeSession?.type === 'PRIMO_MERCATO'

  const preState: StepState = isDraft ? 'current' : 'done'
  const firstMarketState: StepState = firstMarketActive ? 'current' : firstMarketDone ? 'done' : isDraft ? 'future' : 'current'

  const steps: Step[] = [
    { key: 'PRE', label: 'Pre-mercato', state: preState, marker: preState === 'done' ? '✓' : preState === 'current' ? '●' : '1' },
    {
      key: 'PRIMO',
      label: '1° Mercato',
      state: firstMarketState,
      marker: firstMarketState === 'done' ? '✓' : firstMarketState === 'current' ? '●' : '2',
    },
  ]

  // Fasi del mercato ricorrente: mostrate solo quando il primo mercato è concluso
  // (o quando è già attivo un mercato ricorrente).
  const recurrentActive = activeSession && activeSession.type !== 'PRIMO_MERCATO'
  if (firstMarketDone || recurrentActive) {
    const currentIdx = recurrentActive
      ? RECURRENT_PHASES.findIndex(p => p.key === activeSession.currentPhase)
      : -1
    RECURRENT_PHASES.forEach((p, i) => {
      let state: StepState
      if (currentIdx === -1) {
        // Mercato ricorrente non ancora avviato: tutte future
        state = 'future'
      } else if (i < currentIdx) {
        state = 'done'
      } else if (i === currentIdx) {
        state = 'current'
      } else {
        state = 'future'
      }
      steps.push({
        key: p.key,
        label: p.label,
        state,
        marker: state === 'done' ? '✓' : state === 'current' ? '●' : String(i + 3),
      })
    })
  }

  return steps
}

const DOT_CLASSES: Record<StepState, string> = {
  done: 'bg-secondary-500 text-[#06200f]',
  current: 'bg-[#0a0a0b] text-accent-400',
  future: 'bg-surface-100 text-gray-500',
}

const STEP_CLASSES: Record<StepState, string> = {
  done: 'text-secondary-400',
  current: 'bg-accent-400 text-[#0a0a0b] font-bold rounded-lg',
  future: 'text-gray-500',
}

export function PhaseIndicator({ leagueStatus, sessions }: PhaseIndicatorProps) {
  const steps = buildSteps(leagueStatus, sessions)

  return (
    <div
      className="flex items-stretch gap-0.5 bg-surface-200 border border-surface-50/20 rounded-xl p-1 overflow-x-auto scrollbar-hide"
      role="list"
      aria-label="Avanzamento fasi della lega"
    >
      {steps.map((step) => (
        <div
          key={step.key}
          role="listitem"
          aria-current={step.state === 'current' ? 'step' : undefined}
          className={`flex-1 min-w-max flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold whitespace-nowrap transition-colors ${STEP_CLASSES[step.state]}`}
        >
          <span
            className={`stat-number w-4 h-4 rounded-full flex items-center justify-center text-[9px] flex-shrink-0 ${DOT_CLASSES[step.state]}`}
            aria-hidden="true"
          >
            {step.marker}
          </span>
          {step.label}
        </div>
      ))}
    </div>
  )
}
