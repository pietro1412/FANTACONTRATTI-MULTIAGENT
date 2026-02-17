import { useMemo } from 'react'
import { type TeamData, getTeamBalance, getHealthStatus, HEALTH_COLORS } from './types'
import { Sparkline } from '../Sparkline'

interface TeamRankingProps {
  teams: TeamData[]
  hasFinancialDetails: boolean
  onTeamClick: (memberId: string) => void
}

export function TeamRanking({ teams, hasFinancialDetails, onTeamClick }: TeamRankingProps) {
  const ranked = useMemo(() => {
    return [...teams]
      .map(t => ({
        ...t,
        balance: getTeamBalance(t, hasFinancialDetails),
      }))
      .sort((a, b) => b.balance - a.balance)
  }, [teams, hasFinancialDetails])

  const avgBalance = ranked.length > 0
    ? ranked.reduce((s, t) => s + t.balance, 0) / ranked.length
    : 0

  const maxBalance = ranked.length > 0 ? Math.max(...ranked.map(t => Math.abs(t.balance)), 1) : 1

  return (
    <div className="bg-surface-300/50 rounded-lg p-3 md:p-4 border border-surface-50/10">
      <div className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wider mb-3">
        Ranking Bilancio (Budget - Ingaggi)
      </div>

      <div className="space-y-2">
        {ranked.map((team, idx) => {
          const health = getHealthStatus(team.balance)
          const barWidth = Math.abs(team.balance) / maxBalance * 100

          return (
            <button
              key={team.memberId}
              onClick={() => { onTeamClick(team.memberId); }}
              className="w-full flex items-center gap-2 md:gap-3 p-2 md:p-2.5 rounded-lg hover:bg-surface-100/30 transition-colors text-left"
            >
              <span className="text-xs md:text-sm text-gray-500 w-5 text-right font-medium">
                {idx + 1}.
              </span>

              <span className="text-xs md:text-sm text-white font-medium w-28 md:w-36 truncate">
                {team.teamName}
              </span>

              <div className="flex-1 h-5 md:h-6 bg-surface-100/30 rounded-full overflow-hidden relative">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    team.balance >= 0
                      ? 'bg-gradient-to-r from-primary-600/60 to-primary-400/60'
                      : 'bg-gradient-to-r from-danger-600/60 to-danger-400/60'
                  }`}
                  style={{ width: `${barWidth}%` }}
                />
                {/* Average line */}
                {avgBalance > 0 && (
                  <div
                    className="absolute top-0 bottom-0 w-px bg-gray-400/50"
                    style={{ left: `${(avgBalance / maxBalance) * 100}%` }}
                    title={`Media: ${Math.round(avgBalance)}M`}
                  />
                )}
              </div>

              <Sparkline
                data={team.players.map(p => p.salary).sort((a, b) => a - b)}
                width={40}
                height={16}
                className="hidden md:inline-block flex-shrink-0"
              />

              <span className={`text-xs md:text-sm font-bold w-16 text-right ${HEALTH_COLORS[health]}`}>
                {team.balance >= 0 ? '+' : ''}{team.balance}M
              </span>

              {health === 'critical' && (
                <span className="text-amber-400 text-xs" title="Situazione critica">!</span>
              )}
            </button>
          )
        })}
      </div>

      <div className="mt-3 pt-2 border-t border-surface-50/20 text-[10px] md:text-xs text-gray-500">
        Media lega: {Math.round(avgBalance)}M
      </div>
    </div>
  )
}
