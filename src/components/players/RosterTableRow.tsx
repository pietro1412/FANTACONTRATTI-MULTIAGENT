import { PlayerRoleBadge } from './PlayerRoleBadge'
import { TeamLogo } from '@/components/ui/TeamLogo'
import type { RosterEntry } from './types'

export interface RosterTableRowProps {
  entry: RosterEntry
  onPlayerClick: () => void
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <div className="micro-label text-[8px] leading-none">{label}</div>
      <div className="stat-number text-[13px] text-gray-300 leading-tight mt-0.5">{value}</div>
    </div>
  )
}

/**
 * Single desktop roster row (cockpit grid). Columns: player identity, salary ×
 * duration, clause, rubata cost, season mini-stats. Presentational only — the
 * page owns filtering/sorting and passes the click handler.
 */
export function RosterTableRow({ entry, onPlayerClick }: RosterTableRowProps) {
  const { player, contract } = entry
  const clause = contract?.rescissionClause ?? null
  const rubata = clause !== null && contract ? clause + contract.salary : null
  const cs = player.computedStats

  return (
    <div className="grid grid-cols-[1.6fr_88px_96px_80px_150px] gap-2.5 items-center px-4 py-2.5 border-b border-surface-50/10 hover:bg-surface-100/60 transition-colors">
      {/* Player identity */}
      <div className="flex items-center gap-2.5 min-w-0">
        <PlayerRoleBadge position={player.position} />
        <div className="min-w-0">
          <button
            type="button"
            onClick={onPlayerClick}
            className="font-display font-bold text-[13px] text-white leading-tight truncate block text-left max-w-full hover:text-primary-400 transition-colors"
          >
            {player.name}
          </button>
          <div className="flex items-center gap-1.5 text-[10px] text-gray-500 mt-0.5 min-w-0">
            <TeamLogo team={player.team} size="xs" />
            <span className="truncate">{player.team}</span>
          </div>
        </div>
      </div>

      {/* Salary × duration */}
      <div className="text-right">
        {contract ? (
          <>
            <span className="stat-number text-base text-accent-400">{contract.salary}M</span>
            <div className="font-mono text-[9px] text-gray-500">×{contract.duration} sem</div>
          </>
        ) : (
          <span className="text-gray-500">-</span>
        )}
      </div>

      {/* Clause */}
      <div className="text-right">
        {clause !== null ? (
          <span className="stat-number text-base text-white">{clause}</span>
        ) : (
          <span className="text-gray-500">-</span>
        )}
      </div>

      {/* Rubata */}
      <div className="text-right">
        {rubata !== null ? (
          <span className="stat-number text-base text-gray-400">{rubata}</span>
        ) : (
          <span className="text-gray-500">-</span>
        )}
      </div>

      {/* Season mini-stats */}
      <div className="flex gap-2.5 justify-end">
        <MiniStat label="PR" value={cs?.appearances ?? '-'} />
        <MiniStat label="G" value={cs?.totalGoals ?? '-'} />
        <MiniStat label="A" value={cs?.totalAssists ?? '-'} />
        <MiniStat label="VT" value={cs?.avgRating != null ? cs.avgRating.toFixed(1) : '-'} />
      </div>
    </div>
  )
}

export default RosterTableRow
