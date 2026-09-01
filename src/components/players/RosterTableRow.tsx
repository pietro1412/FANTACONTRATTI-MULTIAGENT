import { PlayerPhoto } from './PlayerPhoto'
import { TeamLogo } from '@/components/ui/TeamLogo'
import { Monogram } from '@/components/ui/Monogram'
import { Tag } from '@/components/contracts/shared'
import { formatSeasonStats, toSeasonStatsInput, NOT_DISPONIBILE, getAgeColor } from '@/utils/stat-format'
import { isOutOfSerieA, getExitReasonLabel } from '@/components/PlayerStatsModal'
import { getExitReasonTag, type FantacalcioSeasonStats, type RosterEntry, type RosterRowStatus } from './types'

export interface RosterTableRowProps {
  entry: RosterEntry
  onPlayerClick: () => void
  /** Free-agent/owner status column — Rose omits it (always "in rosa"). */
  status?: RosterRowStatus
  /** Serie A listino quotation column — Rose omits it (not relevant there). */
  showQuotation?: boolean
}

const CREDIT_UNIT = 'M'

/** Base grid (Rose: identity + age + 4 contract fields + stats). */
export const ROSTER_ROW_GRID_BASE = 'grid-cols-[1.3fr_60px_88px_64px_88px_92px_100px]'
/** Extended grid with age + status + quotation columns ("Tutti i giocatori" tab). */
export const ROSTER_ROW_GRID_EXTRA = 'grid-cols-[0.95fr_60px_92px_56px_88px_64px_88px_92px_100px]'
/**
 * Shared column gap for both grids above — kept as one constant so the header
 * row (RoseGiocatori) and the data rows never drift apart. Wider than the
 * previous gap-2.5 (10px) to give tight neighboring columns (e.g. Età →
 * Stato) visible breathing room instead of reading as glued together.
 */
export const ROSTER_ROW_GAP = 'gap-3.5'

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="micro-label text-[7.5px] leading-none text-gray-700">{label}</div>
      <div className="stat-number text-[12px] text-gray-600 leading-tight mt-0.5">{value}</div>
    </div>
  )
}

/** Season mini-stats (PR/G/A/VT), collapsed into a single muted note when all 4 are ND. */
function SeasonStats({ fc }: { fc: FantacalcioSeasonStats | null | undefined }) {
  const stats = formatSeasonStats(toSeasonStatsInput(fc))

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
 * Single desktop roster row (cockpit grid). Columns: player identity, age,
 * salary, duration, clause, rubata cost (clause + salary), season mini-stats.
 * The persistent column header (RoseGiocatori) is the sole label source for
 * the age/financial values — Axiom 9 is satisfied structurally by the header
 * instead of a per-cell label (see CLAUDE.md §Assiomi UI/UX, punto 9).
 * Rubata is the most decision-relevant figure, rendered larger in accent gold.
 * The role (Axiom 6's top-priority field) is carried by the role badge
 * overlaid on the player photo, since the photo replaces the position-tinted
 * fallback tile that used to convey it on its own.
 */
export function RosterTableRow({ entry, onPlayerClick, status, showQuotation }: RosterTableRowProps) {
  const { player, contract } = entry
  const clause = contract?.rescissionClause ?? null
  const rubata = clause !== null && contract ? clause + contract.salary : null
  const hasExtra = status !== undefined || showQuotation
  const exitLabel = getExitReasonLabel(player)

  return (
    <div className={`grid ${hasExtra ? ROSTER_ROW_GRID_EXTRA : ROSTER_ROW_GRID_BASE} ${ROSTER_ROW_GAP} items-center px-4 py-[11px] border-b border-surface-50/10 hover:bg-surface-100/60 transition-colors`}>
      {/* Player identity: photo (with role badge) + team crest, same size, then name alone */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <PlayerPhoto apiFootballId={player.apiFootballId} name={player.name} position={player.position} size="sm" showRoleBadge />
          <TeamLogo team={player.team} size="md" outOfSerieA={isOutOfSerieA(player)} />
        </div>
        <button
          type="button"
          onClick={onPlayerClick}
          className="font-display font-bold text-[13px] text-white leading-tight truncate block text-left min-w-0 flex-1 hover:text-primary-400 transition-colors"
        >
          {player.name}
        </button>
        {isOutOfSerieA(player) && (
          <span
            className="flex-shrink-0 micro-label text-[8px] text-warning-400 border border-warning-500/40 rounded px-1.5 py-0.5"
            title={`Fuori Serie A${exitLabel ? ` · ${exitLabel}` : ''}`}
          >
            Fuori Serie A
          </span>
        )}
      </div>

      {/* Age — own column (Axiom 6) */}
      <div className="text-right">
        <span
          className={`stat-number text-sm ${getAgeColor(player.age)}`}
          aria-label={player.age != null ? `Età ${player.age} anni` : 'Età non disponibile'}
        >
          {player.age != null ? player.age : NOT_DISPONIBILE}
        </span>
      </div>

      {/* Status (free agent / owner) — "Tutti i giocatori" tab only */}
      {status !== undefined && (
        <div className="min-w-0">
          {status.free ? (
            (() => {
              const exitTag = getExitReasonTag(status.exitReason)
              return exitTag ? (
                <Tag tone={exitTag.tone}>{exitTag.label}</Tag>
              ) : (
                <span className="inline-flex font-mono text-[9.5px] font-bold tracking-[0.06em] text-secondary-400 bg-secondary-500/10 border border-secondary-500/35 rounded-full px-2.5 py-0.5">
                  LIBERO
                </span>
              )
            })()
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
      <SeasonStats fc={player.fantacalcioStats} />
    </div>
  )
}

export default RosterTableRow
