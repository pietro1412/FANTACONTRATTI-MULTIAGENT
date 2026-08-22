import { PlayerRoleBadge } from './PlayerRoleBadge'
import { TeamLogo } from '@/components/ui/TeamLogo'
import { Monogram } from '@/components/ui/Monogram'
import { formatStat, NOT_DISPONIBILE } from '@/utils/stat-format'
import type { RosterEntry, RosterRowStatus } from './types'

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

/**
 * Mobile roster card (Rose / Giocatori cluster). Shown in normal flow below lg;
 * the desktop cockpit table uses RosterTableRow.
 * Financial data rendered as a 4-column cockpit grid (salary/duration/clause/
 * rubata) with rubata — the most decision-relevant figure — in accent gold.
 */
export function RosterPlayerCard({ entry, onPlayerClick, status, showQuotation }: RosterPlayerCardProps) {
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
            className="font-display font-bold text-white text-sm break-words block hover:text-primary-400 transition-colors text-left w-full"
          >
            {player.name}
          </button>
          <div className="flex items-center gap-1.5 text-[11px] text-gray-500 mt-0.5 flex-wrap">
            <TeamLogo team={player.team} size="xs" />
            <span className="break-words">{player.team}</span>
            <span className="font-mono">· {player.age != null ? `${player.age} anni` : NOT_DISPONIBILE}</span>
            {showQuotation && <span className="font-mono">· Quot {player.quotation}</span>}
            <span className="ml-auto font-mono text-[10px] text-gray-500">
              {formatStat(cs?.appearances)}P {formatStat(cs?.totalGoals)}G {formatStat(cs?.totalAssists)}A
            </span>
          </div>
          {status !== undefined && (
            <div className="mt-1">
              {status.free ? (
                <span className="inline-flex font-mono text-[9px] font-bold tracking-[0.06em] text-secondary-400 bg-secondary-500/10 border border-secondary-500/35 rounded-full px-2 py-0.5">
                  LIBERO
                </span>
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

      {contract ? (
        <div className="grid grid-cols-4 gap-2">
          <ContractStat label="Ing" value={`${contract.salary}${CREDIT_UNIT}`} tone="text-white" />
          <ContractStat label="Dur" value={`${contract.duration} s`} tone="text-white" />
          <ContractStat label="Cls" value={clause !== null ? `${clause}${CREDIT_UNIT}` : '-'} tone="text-white" />
          <ContractStat label="Rub" value={rubata !== null ? `${rubata}${CREDIT_UNIT}` : '-'} tone="text-accent-400" />
        </div>
      ) : (
        <div className="text-center text-gray-500 text-xs py-1">Nessun contratto</div>
      )}
    </div>
  )
}

export default RosterPlayerCard
