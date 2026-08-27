import { PlayerPhoto } from './PlayerPhoto'
import { TeamLogo } from '@/components/ui/TeamLogo'
import { PlayerName } from './PlayerName'
import { isOutOfSerieA, getExitReasonLabel, type PlayerInfo } from '@/components/PlayerStatsModal'

export interface PlayerMediaNameProps {
  /** Player to display (reuses PlayerInfo, passed through to the stats modal). */
  player: PlayerInfo
  /** League id — enables the "Carriera Lega" tab in the modal. */
  leagueId?: string
  /** League SerieAPlayer id — falls back to player.leaguePlayerId. */
  leaguePlayerId?: string
  size?: 'xs' | 'sm' | 'md'
  className?: string
  /** Truncate the name to a single line (Axiom 2: off by default). */
  truncate?: boolean
}

/**
 * Foto giocatore + logo squadra + nome cliccabile, in riga compatta per contesti
 * densi (tabelle, liste) — Assiomi 6 (gerarchia informativa) e 7 (nome sempre
 * cliccabile). Compone PlayerPhoto + TeamLogo + PlayerName, non ne duplica la
 * logica: unico punto da aggiornare se lo stile dell'identità giocatore cambia.
 */
export function PlayerMediaName({ player, leagueId, leaguePlayerId, size = 'sm', className = '', truncate = false }: PlayerMediaNameProps) {
  const exitLabel = getExitReasonLabel(player)
  return (
    <span className={`inline-flex items-center gap-1.5 min-w-0 ${className}`}>
      <PlayerPhoto apiFootballId={player.apiFootballId} name={player.name} position={player.position} size={size} showRoleBadge />
      <TeamLogo team={player.team} size={size === 'xs' ? 'xs' : 'sm'} outOfSerieA={isOutOfSerieA(player)} />
      <PlayerName player={player} leagueId={leagueId} leaguePlayerId={leaguePlayerId} truncate={truncate} className="text-sm" />
      {isOutOfSerieA(player) && (
        <span className="text-[10px] font-medium text-warning-400 whitespace-nowrap">
          Fuori Serie A{exitLabel ? ` · ${exitLabel}` : ''}
        </span>
      )}
    </span>
  )
}

export default PlayerMediaName
