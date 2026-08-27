import { getTeamLogo } from '@/utils/teamLogos'

export interface TeamLogoProps {
  team: string
  /** Tailwind size classes for the wrapper (default sm: w-6 h-6). */
  size?: 'xs' | 'sm' | 'md'
  className?: string
  /**
   * True se il giocatore non è più in nessuna squadra di Serie A
   * (PlayerListStatus.NOT_IN_LIST) — a prescindere dal fatto che il motivo
   * specifico (RITIRATO/RETROCESSO/ESTERO) sia già stato categorizzato o
   * meno. Quando true, lo stemma reale (che potrebbe essere stantio: `team`
   * si aggiorna solo al re-import quotazioni) è sostituito da un'icona
   * neutra "fuori Serie A" — mai lo stemma di una squadra a cui il
   * giocatore potrebbe non appartenere più davvero.
   */
  outOfSerieA?: boolean
}

const SIZES = {
  xs: 'w-4 h-4',
  sm: 'w-6 h-6',
  md: 'w-8 h-8',
} as const

/**
 * Single shared Serie A team logo (consolidates the previous duplicated
 * implementations in Rose, Contracts and rubata). Renders the crest on a
 * fixed near-white tile — never a theme dark surface — so every crest stays
 * legible regardless of its own colors (dark crests like Juventus' black
 * stripes disappear against dark surfaces otherwise). No glassmorphism, and
 * hides itself gracefully when the logo fails to load.
 */
export function TeamLogo({ team, size = 'sm', className = '', outOfSerieA }: TeamLogoProps) {
  if (outOfSerieA) {
    return (
      <span
        className={`${SIZES[size]} flex items-center justify-center rounded bg-surface-100 border border-warning-500/40 text-warning-400 flex-shrink-0 ${className}`}
        title="Fuori Serie A"
        aria-label="Fuori Serie A"
      >
        <span aria-hidden="true" className="leading-none">⊘</span>
      </span>
    )
  }

  return (
    <span
      className={`${SIZES[size]} flex items-center justify-center rounded bg-gray-50 p-0.5 flex-shrink-0 ${className}`}
    >
      <img
        src={getTeamLogo(team)}
        alt={team}
        className="w-full h-full object-contain"
        onError={(e) => {
          ;(e.target as HTMLImageElement).style.display = 'none'
        }}
      />
    </span>
  )
}

export default TeamLogo
