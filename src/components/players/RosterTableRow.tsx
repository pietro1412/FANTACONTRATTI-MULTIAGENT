import { PlayerRoleBadge } from './PlayerRoleBadge'
import { TeamLogo } from '@/components/ui/TeamLogo'
import { Monogram } from '@/components/ui/Monogram'
import { formatSeasonStats, NOT_DISPONIBILE } from '@/utils/stat-format'
import type { ComputedSeasonStats, RosterEntry, RosterRowStatus } from './types'

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
export const ROSTER_ROW_GRID_BASE = 'grid-cols-[1.35fr_88px_64px_88px_92px_100px]'
/** Extended grid with status + quotation columns ("Tutti i giocatori" tab). */
export const ROSTER_ROW_GRID_EXTRA = 'grid-cols-[1.0fr_92px_56px_88px_64px_88px_92px_100px]'

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="micro-label text-[7.5px] leading-none text-gray-700">{label}</div>
      <div className="stat-number text-[12px] text-gray-600 leading-tight mt-0.5">{value}</div>
    </div>
  )
}

/** Season mini-stats (PR/G/A/VT), collapsed into a single muted note when all 4 are ND. */
function SeasonStats({ cs }: { cs: ComputedSeasonStats | null | undefined }) {
  const stats = formatSeasonStats(cs)

  if (stats.allMissing) {
    return (
      <div className="flex justify-end">
        <span className="font-mono text-[9px] text-gray-700">stats non sync.</span>
      </div>
    )
  }

  return (
    <div className="flex gap-2 justify-end">
      <MiniStat label="PR" value={stats.appearances} />
      <MiniStat label="G" value={stats.goals} />
      <MiniStat label="A" value={stats.assists} />
      <MiniStat label="VT" value={stats.rating} />
    </div>
  )
}

function FinancialValue({
  ariaLabel,
  value,
  tone = 'text-white',
  emphasis = false,
}: {
  ariaLabel: string
  value: string
  tone?: string
  emphasis?: boolean
}) {
  return (
    <div className="text-right">
      <div
        className={`stat-number ${emphasis ? 'text-[18px]' : 'text-[17px]'} leading-tight ${tone}`}
        aria-label={ariaLabel}
      >
        {value}
      </div>
    </div>
  )
}

/**
 * Single desktop roster row (cockpit grid). Columns: player identity, salary,
 * duration, clause, rubata cost (clause + salary), season mini-stats.
 * The persistent column header (RoseGiocatori) is the sole label source for
 * the financial values — Axiom 9 is satisfied structurally by the header
 * instead of a per-cell label (see CLAUDE.md §Assiomi UI/UX, punto 9).
 * Rubata is the most decision-relevant figure, rendered larger in accent gold.
 */
export function RosterTableRow({ entry, onPlayerClick, status, showQuotation }: RosterTableRowProps) {
  const { player, contract } = entry
  const clause = contract?.rescissionClause ?? null
  const rubata = clause !== null && contract ? clause + contract.salary : null
  const hasExtra = status !== undefined || showQuotation

  return (
    <div className={`grid ${hasExtra ? ROSTER_ROW_GRID_EXTRA : ROSTER_ROW_GRID_BASE} gap-2.5 items-center px-4 py-[11px] border-b border-surface-50/10 hover:bg-surface-100/60 transition-colors`}>
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
        ariaLabel={contract ? `Ingaggio ${contract.salary}M` : 'Nessun ingaggio'}
        value={contract ? `${contract.salary}${CREDIT_UNIT}` : '-'}
        tone={contract ? 'text-white' : 'text-gray-500'}
      />

      {/* Duration */}
      <FinancialValue
        ariaLabel={contract ? `Durata ${contract.duration} s` : 'Nessuna durata'}
        value={contract ? `${contract.duration} s` : '-'}
        tone={contract ? 'text-white' : 'text-gray-500'}
      />

      {/* Clause */}
      <FinancialValue
        ariaLabel={clause !== null ? `Clausola ${clause}M` : 'Nessuna clausola'}
        value={clause !== null ? `${clause}${CREDIT_UNIT}` : '-'}
        tone={clause !== null ? 'text-white' : 'text-gray-500'}
      />

      {/* Rubata cost (clause + salary) — most decision-relevant figure */}
      <FinancialValue
        ariaLabel={rubata !== null ? `Prezzo rubata ${rubata}M` : 'Nessun prezzo rubata'}
        value={rubata !== null ? `${rubata}${CREDIT_UNIT}` : '-'}
        tone={rubata !== null ? 'text-accent-400' : 'text-gray-500'}
        emphasis
      />

      {/* Season mini-stats */}
      <SeasonStats cs={player.computedStats} />
    </div>
  )
}

export default RosterTableRow
