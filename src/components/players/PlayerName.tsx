import { useState } from 'react'
import { PlayerStatsModal, type PlayerInfo } from '@/components/PlayerStatsModal'

export interface PlayerNameProps {
  /** Player to display and open in the stats modal (reuses PlayerInfo). */
  player: PlayerInfo
  /** League id — enables the "Carriera Lega" tab in the modal. */
  leagueId?: string
  /** League SerieAPlayer id — falls back to player.leaguePlayerId. */
  leaguePlayerId?: string
  /** Extra classes on the clickable name button. */
  className?: string
  /**
   * Truncate the name to a single line. Default false (Axiom 2: no truncation
   * by default). Pass true only in dense rows that explicitly need it.
   */
  truncate?: boolean
}

/**
 * Axiom 7: a player's name is always clickable and opens PlayerStatsModal.
 *
 * Self-contained: keeps its own open state and renders the modal internally
 * (only when open), so the name works anywhere without the host page wiring up
 * modal state. Rendered as an accessible <button> with a focus ring.
 */
export function PlayerName({
  player,
  leagueId,
  leaguePlayerId,
  className = '',
  truncate = false,
}: PlayerNameProps) {
  const [isOpen, setIsOpen] = useState(false)

  const effectiveLeaguePlayerId = leaguePlayerId ?? player.leaguePlayerId

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen(true)
        }}
        title={player.name}
        className={`font-display font-bold text-left text-white hover:text-primary-400 transition-colors rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 focus-visible:ring-offset-surface-200 ${
          truncate ? 'truncate block max-w-full' : ''
        } ${className}`}
      >
        {player.name}
      </button>
      {isOpen && (
        <PlayerStatsModal
          isOpen={isOpen}
          onClose={() => { setIsOpen(false) }}
          player={player}
          leagueId={leagueId}
          leaguePlayerId={effectiveLeaguePlayerId}
        />
      )}
    </>
  )
}

export default PlayerName
