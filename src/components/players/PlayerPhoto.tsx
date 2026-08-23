import { POSITION_GRADIENTS } from '@/components/ui/PositionBadge'
import { getPlayerPhotoUrl } from '@/utils/player-images'

export interface PlayerPhotoProps {
  apiFootballId?: number | null
  name: string
  position: string
  /** Tailwind size class for the wrapper (default sm: w-8 h-8). */
  size?: 'xs' | 'sm' | 'md'
  className?: string
  /**
   * Overlay a small role-letter (P/D/C/A) badge in the bottom-right corner.
   * With a real photo the position-tinted fallback tile (which normally
   * doubles as the role indicator) is no longer visible, so the role — the
   * single most important piece of player info per CLAUDE.md Assioma 6 —
   * needs an explicit badge instead. Off by default to keep existing call
   * sites (which don't need it, e.g. compact photo strips) unchanged.
   */
  showRoleBadge?: boolean
}

const SIZES = {
  xs: 'w-7 h-7 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
} as const

const ROLE_BADGE_SIZES = {
  xs: 'w-3.5 h-3.5 text-[7px]',
  sm: 'w-4 h-4 text-[8px]',
  md: 'w-[18px] h-[18px] text-[9px]',
} as const

/**
 * Round player photo (API-Football) with a graceful uniform fallback: a position-tinted
 * tile with a person icon (no photo). Consolidates the previously duplicated photo +
 * onError logic in AllPlayers and PlayerStats for the Giocatori cluster.
 */
export function PlayerPhoto({ apiFootballId, name, position, size = 'sm', className = '', showRoleBadge = false }: PlayerPhotoProps) {
  const url = getPlayerPhotoUrl(apiFootballId)
  const gradient = POSITION_GRADIENTS[position] ?? 'from-gray-500 to-gray-600'
  const roleBadgeTone = position === 'P' ? 'text-black' : 'text-white'

  return (
    <span className={`relative inline-flex flex-shrink-0 ${SIZES[size]} ${className}`}>
      {url ? (
        <img
          src={url}
          alt={name}
          className="w-full h-full rounded-full object-cover bg-surface-100 border border-surface-50"
          onError={(e) => {
            const img = e.target as HTMLImageElement
            img.style.display = 'none'
            const fallback = img.nextElementSibling as HTMLElement | null
            if (fallback) fallback.style.display = 'flex'
          }}
        />
      ) : null}
      <span
        aria-hidden="true"
        className={`w-full h-full rounded-full bg-gradient-to-br ${gradient} items-center justify-center text-white ${
          url ? 'hidden' : 'flex'
        }`}
      >
        <svg className="w-1/2 h-1/2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="4" />
          <path d="M4.5 20c.6-4 4-6.5 7.5-6.5s6.9 2.5 7.5 6.5" />
        </svg>
      </span>
      {showRoleBadge && (
        <span
          aria-hidden="true"
          className={`absolute -bottom-1 -right-1 flex items-center justify-center rounded-full ring-2 ring-surface-200 bg-gradient-to-br ${gradient} ${ROLE_BADGE_SIZES[size]} font-display font-bold ${roleBadgeTone}`}
        >
          {position}
        </span>
      )}
    </span>
  )
}

export default PlayerPhoto
