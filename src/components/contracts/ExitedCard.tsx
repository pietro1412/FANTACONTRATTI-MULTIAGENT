import { RoleBadge, TeamLogo, type ContractPlayer } from './shared'

export interface ExitedCardProps {
  player: ContractPlayer
  exitReason: string | null | undefined
  salary: number
  duration: number
  indemnityCompensation: number
  decision: 'KEEP' | 'RELEASE' | undefined
  inContrattiPhase: boolean
  isConsolidated: boolean
  onKeep: () => void
  onRelease: () => void
  onViewStats: () => void
}

/**
 * KEEP / RELEASE card for an exited player (estero / retrocesso). Decided cards
 * stay marked; the indemnity (only when you keep an estero) is shown in danger.
 */
export function ExitedCard({
  player,
  exitReason,
  salary,
  duration,
  indemnityCompensation,
  decision,
  inContrattiPhase,
  isConsolidated,
  onKeep,
  onRelease,
  onViewStats,
}: ExitedCardProps) {
  const isEstero = exitReason === 'ESTERO'
  const reasonTone = isEstero ? 'text-accent-400 border-accent-500/40' : 'text-primary-400 border-primary-500/40'
  const decided = decision != null

  return (
    <div
      className={`bg-surface-300 border rounded-xl p-3.5 ${
        decision === 'KEEP'
          ? 'border-secondary-500/45'
          : decision === 'RELEASE'
            ? 'border-danger-500/45 opacity-85'
            : 'border-surface-50'
      }`}
    >
      <div className="flex items-center gap-2.5 mb-3">
        <RoleBadge position={player.position} />
        <div className="w-6 h-6 bg-white rounded p-0.5 flex-shrink-0">
          <TeamLogo team={player.team} />
        </div>
        <div className="flex-1 min-w-0">
          <button
            type="button"
            onClick={onViewStats}
            className="font-display font-bold text-sm text-primary-400 hover:text-primary-300 truncate cursor-pointer transition-colors text-left max-w-full"
          >
            {player.name}
          </button>
          <div className="text-[10.5px] text-gray-500">{player.team}</div>
        </div>
        {decided ? (
          <span className={`font-mono text-[10px] font-bold ${decision === 'KEEP' ? 'text-secondary-400' : 'text-danger-400'}`}>
            {decision === 'KEEP' ? '✓ TENUTO' : '✓ RILASCIATO'}
          </span>
        ) : (
          <span className={`font-mono text-[9px] font-bold rounded px-1.5 py-0.5 border ${reasonTone}`}>
            {isEstero ? 'ESTERO' : 'RETROCESSO'}
          </span>
        )}
      </div>

      <div className="flex gap-5 mb-3">
        <div>
          <div className="micro-label">Contratto</div>
          <div className="stat-number text-base text-white">{salary}×{duration}</div>
        </div>
        <div>
          <div className="micro-label">{isEstero ? 'Indennizzo se tieni' : 'Rilascio'}</div>
          <div className={`stat-number text-base ${isEstero ? 'text-danger-400' : 'text-gray-400'}`}>
            {isEstero ? `${indemnityCompensation}M` : 'gratuito'}
          </div>
        </div>
      </div>

      {inContrattiPhase && !isConsolidated && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onKeep}
            className={`flex-1 font-display font-bold text-sm rounded-lg py-2 border transition-all ${
              decision === 'KEEP'
                ? 'text-dark-300 bg-secondary-500 border-secondary-500'
                : 'text-secondary-400 border-secondary-500/45 bg-secondary-500/[0.08] hover:bg-secondary-500/15'
            }`}
          >
            {decision === 'KEEP' ? 'Tenuto' : 'Tieni'}
          </button>
          <button
            type="button"
            onClick={onRelease}
            className={`flex-1 font-display font-bold text-sm rounded-lg py-2 border transition-all ${
              decision === 'RELEASE'
                ? 'text-white bg-danger-500 border-danger-500'
                : 'text-danger-400 border-danger-500/40 bg-danger-500/[0.06] hover:bg-danger-500/15'
            }`}
          >
            {decision === 'RELEASE' ? 'Rilasciato' : 'Rilascia'}
          </button>
        </div>
      )}
    </div>
  )
}
