import { ArrowLeftRight } from 'lucide-react'
import { PlayerRoleBadge } from './PlayerRoleBadge'
import { TeamLogo } from '@/components/ui/TeamLogo'
import { formatStat, NOT_DISPONIBILE } from '@/utils/stat-format'
import type { RosterEntry } from './types'

export interface RosterTableRowProps {
  entry: RosterEntry
  onPlayerClick: () => void
  /** Se presente, mostra il bottone "Proponi scambio" (visibile solo in fase Offerte/Scambi). */
  onProposeTrade?: () => void
}

const CREDIT_UNIT = 'M'

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <div className="micro-label text-[8px] leading-none">{label}</div>
      <div className="stat-number text-[13px] text-gray-300 leading-tight mt-0.5">{value}</div>
    </div>
  )
}

function FinancialValue({
  label,
  ariaLabel,
  value,
  tone = 'text-white',
}: {
  label: string
  ariaLabel: string
  value: string
  tone?: string
}) {
  return (
    <div className="text-right">
      <div className="micro-label text-[8px] leading-none text-gray-500">{label}</div>
      <div className={`stat-number text-[14px] leading-tight mt-0.5 ${tone}`} aria-label={ariaLabel}>{value}</div>
    </div>
  )
}

/**
 * Single desktop roster row (cockpit grid). Columns: player identity, salary,
 * duration, clause, rubata cost (clause + salary), season mini-stats.
 * Financial values always carry identifying labels (Axiom 9); rubata is the
 * most decision-relevant figure, rendered in accent gold.
 */
export function RosterTableRow({ entry, onPlayerClick, onProposeTrade }: RosterTableRowProps) {
  const { player, contract } = entry
  const clause = contract?.rescissionClause ?? null
  const rubata = clause !== null && contract ? clause + contract.salary : null
  const cs = player.computedStats

  return (
    <div className="grid grid-cols-[1.4fr_80px_64px_80px_80px_120px] gap-2.5 items-center px-4 py-2.5 border-b border-surface-50/10 hover:bg-surface-100/60 transition-colors">
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
            <span className="text-gray-600 font-mono">
              · {player.age != null ? `${player.age} anni` : NOT_DISPONIBILE}
            </span>
          </div>
        </div>
        {onProposeTrade && (
          <button
            type="button"
            onClick={onProposeTrade}
            className="ml-auto flex-shrink-0 w-7 h-7 rounded-lg bg-surface-300 border border-surface-50 text-gray-400 hover:text-secondary-400 hover:border-secondary-500/40 flex items-center justify-center transition-colors"
            title="Proponi scambio"
            aria-label={`Proponi scambio per ${player.name}`}
          >
            <ArrowLeftRight size={13} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Salary */}
      <FinancialValue
        label="Ing"
        ariaLabel={contract ? `Ingaggio ${contract.salary}M` : 'Nessun ingaggio'}
        value={contract ? `${contract.salary}${CREDIT_UNIT}` : '-'}
        tone={contract ? 'text-white' : 'text-gray-500'}
      />

      {/* Duration */}
      <FinancialValue
        label="Dur"
        ariaLabel={contract ? `Durata ${contract.duration} s` : 'Nessuna durata'}
        value={contract ? `${contract.duration} s` : '-'}
        tone={contract ? 'text-white' : 'text-gray-500'}
      />

      {/* Clause */}
      <FinancialValue
        label="Cls"
        ariaLabel={clause !== null ? `Clausola ${clause}M` : 'Nessuna clausola'}
        value={clause !== null ? `${clause}${CREDIT_UNIT}` : '-'}
        tone={clause !== null ? 'text-white' : 'text-gray-500'}
      />

      {/* Rubata cost (clause + salary) — most decision-relevant figure */}
      <FinancialValue
        label="Rub"
        ariaLabel={rubata !== null ? `Prezzo rubata ${rubata}M` : 'Nessun prezzo rubata'}
        value={rubata !== null ? `${rubata}${CREDIT_UNIT}` : '-'}
        tone={rubata !== null ? 'text-accent-400' : 'text-gray-500'}
      />

      {/* Season mini-stats */}
      <div className="flex gap-2.5 justify-end">
        <MiniStat label="PR" value={formatStat(cs?.appearances)} />
        <MiniStat label="G" value={formatStat(cs?.totalGoals)} />
        <MiniStat label="A" value={formatStat(cs?.totalAssists)} />
        <MiniStat label="VT" value={formatStat(cs?.avgRating, { decimals: 1 })} />
      </div>
    </div>
  )
}

export default RosterTableRow
