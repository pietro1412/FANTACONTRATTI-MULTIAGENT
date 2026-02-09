import { type TeamData, type HealthStatus, getHealthStatus, getTeamBalance, HEALTH_COLORS, HEALTH_BG_COLORS, HEALTH_LABELS } from './types'

interface HealthIndicatorProps {
  teams: TeamData[]
  hasFinancialDetails: boolean
  giniIndex: number
}

export function HealthIndicator({ teams, hasFinancialDetails, giniIndex }: HealthIndicatorProps) {
  const grouped: Record<HealthStatus, TeamData[]> = { good: [], warning: [], critical: [] }

  for (const team of teams) {
    const balance = getTeamBalance(team, hasFinancialDetails)
    const status = getHealthStatus(balance)
    grouped[status].push(team)
  }

  const giniLabel = giniIndex < 0.2
    ? 'molto equa'
    : giniIndex < 0.35
      ? 'equa'
      : giniIndex < 0.5
        ? 'moderata'
        : 'concentrata'

  return (
    <div className="bg-surface-300/50 rounded-lg p-3 md:p-4 border border-surface-50/10">
      <div className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wider mb-3">Salute Finanziaria</div>

      <div className="space-y-2">
        {(['good', 'warning', 'critical'] as const).map(status => (
          <div key={status} className="flex items-center gap-2">
            <span className={`inline-block w-2 h-2 rounded-full ${HEALTH_BG_COLORS[status]} ${HEALTH_COLORS[status]}`} style={{ boxShadow: `0 0 4px currentColor` }} />
            <span className={`text-xs md:text-sm font-medium ${HEALTH_COLORS[status]}`}>
              {grouped[status].length}
            </span>
            <span className="text-[10px] md:text-xs text-gray-500">
              {grouped[status].length === 1 ? 'squadra' : 'squadre'} {HEALTH_LABELS[status]}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-surface-50/20">
        <div className="flex items-center justify-between">
          <span className="text-[10px] md:text-xs text-gray-500">Indice Gini</span>
          <span className="text-xs md:text-sm text-white font-medium">{giniIndex.toFixed(2)}</span>
        </div>
        <div className="text-[10px] text-gray-500 mt-0.5">distribuzione {giniLabel}</div>
      </div>
    </div>
  )
}

// Compact inline version for mobile
export function HealthIndicatorCompact({ teams, hasFinancialDetails }: Omit<HealthIndicatorProps, 'giniIndex'>) {
  let good = 0, warning = 0, critical = 0
  for (const team of teams) {
    const balance = getTeamBalance(team, hasFinancialDetails)
    const status = getHealthStatus(balance)
    if (status === 'good') good++
    else if (status === 'warning') warning++
    else critical++
  }

  return (
    <div className="bg-surface-300/50 rounded-lg p-3 border border-surface-50/10">
      <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Salute Finanziaria</div>
      <div className="flex items-center gap-3 text-xs">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-400" />
          <span className="text-green-400 font-medium">{good} OK</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span className="text-amber-400 font-medium">{warning} Warn</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-danger-400" />
          <span className="text-danger-400 font-medium">{critical} KO</span>
        </span>
      </div>
    </div>
  )
}
