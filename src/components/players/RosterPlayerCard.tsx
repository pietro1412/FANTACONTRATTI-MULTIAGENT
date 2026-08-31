import { PlayerPhoto } from './PlayerPhoto'
import { TeamLogo } from '@/components/ui/TeamLogo'
import { Monogram } from '@/components/ui/Monogram'
import { Tag } from '@/components/contracts/shared'
import { formatSeasonStats, NOT_DISPONIBILE } from '@/utils/stat-format'
import { isOutOfSerieA, getExitReasonLabel } from '@/components/PlayerStatsModal'
import { getExitReasonTag, type ComputedSeasonStats, type RosterEntry, type RosterRowStatus } from './types'

export interface RosterPlayerCardProps {
  entry: RosterEntry
  onPlayerClick: () => void
  /** Free-agent/owner status badge — Rose omits it (always "in rosa"). */
  status?: RosterRowStatus
  /** Serie A listino quotation, shown inline with team/age — Rose omits it. */
  showQuotation?: boolean
}

const CREDIT_UNIT = 'M'

function ContractStat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="bg-surface-300/60 rounded-lg p-1.5 text-center">
      <div className="micro-label text-[8px] leading-none">{label}</div>
      <div className={`stat-number text-sm mt-0.5 ${tone}`}>{value}</div>
    </div>
  )
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center flex-1">
      <div className="micro-label text-[7.5px] leading-none text-gray-700">{label}</div>
      <div className="stat-number text-[12px] text-gray-600 mt-0.5">{value}</div>
    </div>
  )
}

/**
 * Season mini-stats (PR/G/A/VT) in a dedicated strip below the contract grid
 * (kept out of the identity row, where they used to run together unspaced —
 * e.g. "NDPNDGNDA" — when data was missing). Collapses into a single muted
 * note when all 4 are ND, mirroring RosterTableRow on desktop.
 */
function SeasonStatsStrip({ cs }: { cs: ComputedSeasonStats | null | undefined }) {
  const stats = formatSeasonStats(cs)

  return (
    <div className="flex mt-2 pt-2 border-t border-dashed border-surface-50/30">
      {stats.allMissing ? (
        <span className="mx-auto font-mono text-[9px] text-gray-700">Statistiche non sincronizzate</span>
      ) : (
        <div className="flex justify-between w-full">
          <StatCell label="PR" value={stats.appearances} />
          <StatCell label="G" value={stats.goals} />
          <StatCell label="A" value={stats.assists} />
          <StatCell label="VT" value={stats.rating} />
        </div>
      )}
    </div>
  )
}

/**
 * Mobile roster card (Rose / Giocatori cluster). Shown in normal flow below lg;
 * the desktop cockpit table uses RosterTableRow.
 * Financial data rendered as a 5-column cockpit grid (age/salary/duration/
 * clause/rubata) with rubata — the most decision-relevant figure — in accent
 * gold. Age sits first, ahead of the contract fields (Axiom 6 ordering), and
 * always shows even for entries without a contract (free agents).
 * The contract grid keeps its per-cell labels (Axiom 9 in full: no persistent
 * header sits above a card in a scrolled/virtualized list).
 */
export function RosterPlayerCard({ entry, onPlayerClick, status, showQuotation }: RosterPlayerCardProps) {
  const { player, contract } = entry
  const clause = contract?.rescissionClause ?? null
  const rubata = clause !== null && contract ? clause + contract.salary : null
  const exitLabel = getExitReasonLabel(player)

  return (
    <div className="bg-surface-300/40 rounded-xl p-3 border border-surface-50/10">
      <div className="flex items-center gap-2.5 mb-2">
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <PlayerPhoto apiFootballId={player.apiFootballId} name={player.name} position={player.position} size="sm" showRoleBadge />
          <TeamLogo team={player.team} size="md" outOfSerieA={isOutOfSerieA(player)} />
        </div>
        <div className="flex-1 min-w-0 leading-tight">
          <button
            type="button"
            onClick={onPlayerClick}
            className="font-display font-bold text-white text-sm break-words block hover:text-primary-400 transition-colors text-left w-full"
          >
            {player.name}
          </button>
          {isOutOfSerieA(player) && (
            <div className="text-[11px] text-warning-400 font-medium mt-0.5">
              Fuori Serie A{exitLabel ? ` · ${exitLabel}` : ''}
            </div>
          )}
          {showQuotation && (
            <div className="text-[11px] text-gray-500 font-mono mt-0.5">Quot {player.quotation}</div>
          )}
          {status !== undefined && (
            <div className="mt-1">
              {status.free ? (
                (() => {
                  const exitTag = getExitReasonTag(status.exitReason)
                  return exitTag ? (
                    <Tag tone={exitTag.tone}>{exitTag.label}</Tag>
                  ) : (
                    <span className="inline-flex font-mono text-[9px] font-bold tracking-[0.06em] text-secondary-400 bg-secondary-500/10 border border-secondary-500/35 rounded-full px-2 py-0.5">
                      LIBERO
                    </span>
                  )
                })()
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[10.5px] text-gray-300">
                  <Monogram name={status.ownerName} size="xs" />
                  <span className="truncate">{status.ownerName}</span>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2">
        <ContractStat label="Età" value={player.age != null ? `${player.age}` : NOT_DISPONIBILE} tone="text-gray-300" />
        {contract ? (
          <>
            <ContractStat label="Ing" value={`${contract.salary}${CREDIT_UNIT}`} tone="text-white" />
            <ContractStat label="Dur" value={`${contract.duration} s`} tone="text-white" />
            <ContractStat label="Cls" value={clause !== null ? `${clause}${CREDIT_UNIT}` : '-'} tone="text-white" />
            <ContractStat label="Rub" value={rubata !== null ? `${rubata}${CREDIT_UNIT}` : '-'} tone="text-accent-400" />
          </>
        ) : (
          <div className="col-span-4 flex items-center justify-center text-gray-500 text-xs">Nessun contratto</div>
        )}
      </div>

      <SeasonStatsStrip cs={player.computedStats} />
    </div>
  )
}

export default RosterPlayerCard
