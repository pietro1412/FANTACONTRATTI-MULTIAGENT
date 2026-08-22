import { PlayerRoleBadge } from './PlayerRoleBadge'
import { TeamLogo } from '@/components/ui/TeamLogo'
import { Monogram } from '@/components/ui/Monogram'
import { formatStat, NOT_DISPONIBILE } from '@/utils/stat-format'
import type { RosterEntry, RosterRowStatus } from './types'

export interface RosterTableRowProps {
  entry: RosterEntry
  onPlayerClick: () => void
  /** Free-agent/owner status column — Rose omits it (always "in rosa"). */
  status?: RosterRowStatus
  /** Serie A listino quotation column — Rose omits it (not relevant there). */
  showQuotation?: boolean
}

const CREDIT_UNIT = 'M'

/** Base grid (Rose: identity + 4 contract fields + stats). */
export const ROSTER_ROW_GRID_BASE = 'grid-cols-[1.4fr_80px_64px_80px_80px_120px]'
/** Extended grid with status + quotation columns ("Tutti i giocatori" tab). */
export const ROSTER_ROW_GRID_EXTRA = 'grid-cols-[1.05fr_92px_56px_80px_64px_80px_80px_120px]'

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
export function RosterTableRow({ entry, onPlayerClick, status, showQuotation }: RosterTableRowProps) {
  const { player, contract } = entry
  const clause = contract?.rescissionClause ?? null
  const rubata = clause !== null && contract ? clause + contract.salary : null
  const cs = player.computedStats
  const hasExtra = status !== undefined || showQuotation

  return (
    <div className={`grid ${hasExtra ? ROSTER_ROW_GRID_EXTRA : ROSTER_ROW_GRID_BASE} gap-2.5 items-center px-4 py-2.5 border-b border-surface-50/10 hover:bg-surface-100/60 transition-colors`}>
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
      </div>

      {/* Status (free agent / owner) — "Tutti i giocatori" tab only */}
      {status !== undefined && (
        <div className="min-w-0">
          {status.free ? (
            <span className="inline-flex font-mono text-[9.5px] font-bold tracking-[0.06em] text-secondary-400 bg-secondary-500/10 border border-secondary-500/35 rounded-full px-2.5 py-0.5">
              LIBERO
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-300 min-w-0">
              <Monogram name={status.ownerName} size="xs" />
              <span className="truncate">{status.ownerName}</span>
            </span>
          )}
        </div>
      )}

      {/* Quotation (listino Serie A) — "Tutti i giocatori" tab only */}
      {showQuotation && (
        <div className="text-right">
          <span className="stat-number text-base text-white">{player.quotation}</span>
        </div>
      )}

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
