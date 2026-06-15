import { PositionBadge } from '@/components/ui/PositionBadge'
import { TeamLogo } from '@/components/ui/TeamLogo'
import { ContractInline } from '@/components/ui/ContractInline'
import { PlayerName } from '@/components/players/PlayerName'
import { formatStat, NOT_DISPONIBILE } from '@/utils/stat-format'
import type { PlayerInfo } from '@/components/PlayerStatsModal'

export interface PlayerIdentityContract {
  salary: number
  /** Duration in semesters. */
  duration: number
  clause?: number | null
  rubataPrice?: number | null
}

export interface PlayerIdentitySeasonStats {
  appearances?: number | null
  goals?: number | null
  assists?: number | null
  avgRating?: number | null
}

export interface PlayerIdentityProps {
  /** Player info (reuses PlayerInfo: name, team, position, age, …). */
  player: PlayerInfo
  /** League id — forwarded to PlayerName/modal for the "Carriera Lega" tab. */
  leagueId?: string
  /** League SerieAPlayer id — falls back to player.leaguePlayerId. */
  leaguePlayerId?: string
  /** Contract block (Axiom 6: ingaggio/durata/clausola/rubata). */
  contract?: PlayerIdentityContract | null
  /** Season stats block (Axiom 6). 'ND' when a value is missing. */
  stats?: PlayerIdentitySeasonStats | null
  /** Show the contract block. Default true. */
  showContract?: boolean
  /** Show the stats block. Default true. */
  showStats?: boolean
  /** Show the age. Default true. */
  showAge?: boolean
  /**
   * Layout hint: 'row' (inline, tables) or 'card' (stacked). Default 'row'.
   * Does NOT impose a page grid — exposes the pieces in the right order.
   */
  layout?: 'row' | 'card'
  /** Extra classes on the wrapper. */
  className?: string
}

/**
 * Axioms 6 + 4: composes a player's identity enforcing the importance
 * hierarchy — role → name → team → age (N.D.) → contract (ingaggio/durata/
 * clausola/rubata) → stats (ND). Always uses the shared sub-components
 * (PositionBadge, PlayerName, ContractInline, formatStat) — no duplicated
 * markup. Pages place this block; it does not own a grid layout.
 */
export function PlayerIdentity({
  player,
  leagueId,
  leaguePlayerId,
  contract,
  stats,
  showContract = true,
  showStats = true,
  showAge = true,
  layout = 'row',
  className = '',
}: PlayerIdentityProps) {
  const isCard = layout === 'card'
  const inlineVariant = isCard ? 'compact' : 'full'

  return (
    <div className={`flex ${isCard ? 'flex-col gap-1.5' : 'items-center gap-2.5'} min-w-0 ${className}`}>
      {/* 1. Role + 2. Name + 3. Team + 4. Age */}
      <div className={`flex items-center gap-2.5 min-w-0 ${isCard ? 'w-full' : ''}`}>
        <PositionBadge position={player.position} size="sm" />
        <div className="min-w-0">
          <PlayerName
            player={player}
            leagueId={leagueId}
            leaguePlayerId={leaguePlayerId}
            truncate={!isCard}
            className="text-[13px]"
          />
          <div className="flex items-center gap-1.5 text-[11px] text-gray-500 mt-0.5 min-w-0">
            <TeamLogo team={player.team} size="xs" />
            <span className="truncate">{player.team}</span>
            {showAge && (
              <span className="ml-1 font-mono">
                {player.age != null ? `${player.age} anni` : NOT_DISPONIBILE}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 5. Contract: ingaggio → durata → clausola → prezzo rubata */}
      {showContract && contract && (
        <ContractInline
          salary={contract.salary}
          duration={contract.duration}
          clause={contract.clause}
          rubataPrice={contract.rubataPrice}
          variant={inlineVariant}
          className={isCard ? '' : 'shrink-0'}
        />
      )}

      {/* 6. Stats: ND when missing */}
      {showStats && stats && (
        <div className="flex items-baseline gap-3 text-[11px]">
          <Stat label="PR" value={formatStat(stats.appearances)} />
          <Stat label="G" value={formatStat(stats.goals)} />
          <Stat label="A" value={formatStat(stats.assists)} />
          <Stat label="VT" value={formatStat(stats.avgRating, { decimals: 1 })} />
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-1" title={`${label} ${value}`}>
      <span className="micro-label text-[8px] text-gray-500">{label}</span>
      <span className="font-mono text-gray-300">{value}</span>
    </span>
  )
}

export default PlayerIdentity
