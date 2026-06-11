import { useMemo } from 'react'
import { type TeamData, getTeamBalance } from './types'

interface TeamRankingProps {
  teams: TeamData[]
  hasFinancialDetails: boolean
  onTeamClick: (memberId: string) => void
  myTeamId?: string
}

export function TeamRanking({ teams, hasFinancialDetails, onTeamClick, myTeamId }: TeamRankingProps) {
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
    <div className="rounded-2xl border border-surface-50/60 bg-surface-200 py-1">
      {ranked.map((team, idx) => {
        const isMe = team.memberId === myTeamId
        const barWidth = Math.abs(team.balance) / maxBalance * 100
        const isNegative = team.balance < 0

        return (
          <button
            key={team.memberId}
            onClick={() => { onTeamClick(team.memberId); }}
            className={`grid w-full grid-cols-[28px_minmax(80px,128px)_1fr_72px] items-center gap-2.5 px-3 py-2.5 text-left transition-colors md:gap-3.5 md:px-5 ${
              idx > 0 ? 'border-t border-surface-50/40' : ''
            } ${
              isMe
                ? 'border-l-[3px] border-l-accent-500 bg-gradient-to-r from-accent-500/10 to-transparent pl-[9px] md:pl-[17px]'
                : 'hover:bg-surface-100/30'
            }`}
          >
            <span className="text-center font-mono text-xs font-bold text-gray-500">{idx + 1}</span>

            <span className="flex items-center gap-2 truncate text-[13px] font-bold text-white">
              <span className="truncate">{team.teamName}</span>
              {isMe && (
                <span className="flex-shrink-0 rounded-md bg-accent-500 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-surface-500">
                  Tu
                </span>
              )}
            </span>

            <span className="relative block h-3.5 overflow-hidden rounded-full bg-surface-300">
              <span
                className={`block h-full rounded-full transition-all duration-500 ${
                  isNegative
                    ? 'bg-gradient-to-r from-danger-600 to-danger-400'
                    : isMe
                      ? 'progress-gradient'
                      : 'bg-gradient-to-r from-primary-600 to-primary-500'
                }`}
                style={{ width: `${barWidth}%` }}
              />
              {/* Average marker */}
              {avgBalance > 0 && (
                <span
                  className="absolute bottom-0 top-0 w-px bg-gray-400/50"
                  style={{ left: `${(avgBalance / maxBalance) * 100}%` }}
                  title={`Media: ${Math.round(avgBalance)}M`}
                />
              )}
            </span>

            <span className={`text-right font-mono text-sm font-bold ${
              isNegative ? 'text-danger-400' : isMe ? 'text-accent-400' : 'text-white'
            }`}>
              {team.balance}
              <span className="text-[11px] font-medium text-gray-500"> M</span>
            </span>
          </button>
        )
      })}

      <div className="mx-3 mt-1 border-t border-surface-50/40 px-0 py-2 text-[11px] text-gray-500 md:mx-5">
        Media lega: {Math.round(avgBalance)}M
      </div>
    </div>
  )
}
