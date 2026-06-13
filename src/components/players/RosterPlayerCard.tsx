import { PlayerRoleBadge } from './PlayerRoleBadge'
import { TeamLogo } from '@/components/ui/TeamLogo'
import { getDurationColor } from '@/components/contracts/shared'
import type { RosterEntry } from './types'

export interface RosterPlayerCardProps {
  entry: RosterEntry
  onPlayerClick: () => void
}

function ContractStat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="bg-surface-300/60 rounded-lg p-1.5 text-center">
      <div className="micro-label text-[8px] leading-none">{label}</div>
      <div className={`stat-number text-sm mt-0.5 ${tone}`}>{value}</div>
    </div>
  )
}

/**
 * Mobile roster card (Rose / Giocatori cluster). Shown in normal flow below lg;
 * the desktop cockpit table uses RosterTableRow.
 */
export function RosterPlayerCard({ entry, onPlayerClick }: RosterPlayerCardProps) {
  const { player, contract } = entry
  const clause = contract?.rescissionClause ?? null
  const rubata = clause !== null && contract ? clause + contract.salary : null
  const cs = player.computedStats

  return (
    <div className="bg-surface-300/40 rounded-xl p-3 border border-surface-50/10">
      <div className="flex items-center gap-2.5 mb-2">
        <PlayerRoleBadge position={player.position} />
        <div className="flex-1 min-w-0 leading-tight">
          <button
            type="button"
            onClick={onPlayerClick}
            className="font-display font-bold text-white text-sm truncate block hover:text-primary-400 transition-colors text-left w-full"
          >
            {player.name}
          </button>
          <div className="flex items-center gap-1.5 text-[11px] text-gray-500 mt-0.5">
            <TeamLogo team={player.team} size="xs" />
            <span className="truncate">{player.team}</span>
            {cs && cs.appearances > 0 && (
              <span className="ml-auto font-mono text-[10px] text-gray-500">
                {cs.appearances}P {cs.totalGoals}G {cs.totalAssists}A
              </span>
            )}
          </div>
        </div>
      </div>

      {contract ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <ContractStat label="Ing" value={`${contract.salary}M`} tone="text-accent-400" />
          <ContractStat label="Dur" value={`${contract.duration}s`} tone={getDurationColor(contract.duration)} />
          <ContractStat label="Cls" value={clause !== null ? `${clause}M` : '-'} tone="text-white" />
          <ContractStat label="Rub" value={rubata !== null ? `${rubata}M` : '-'} tone="text-gray-300" />
        </div>
      ) : (
        <div className="text-center text-gray-500 text-xs py-1">Nessun contratto</div>
      )}
    </div>
  )
}

export default RosterPlayerCard
