import { POSITION_GRADIENTS } from '@/components/ui/PositionBadge'
import { getPlayerPhotoUrl } from '@/utils/player-images'

export interface PlayerPhotoProps {
  apiFootballId?: number | null
  name: string
  position: string
  /** Tailwind size class for the wrapper (default sm: w-8 h-8). */
  size?: 'xs' | 'sm' | 'md'
  className?: string
}

const SIZES = {
  xs: 'w-7 h-7 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
} as const

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map(part => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?'
  )
}

/**
 * Round player photo (API-Football) with a graceful fallback to a position-tinted
 * monogram tile. Consolidates the previously duplicated photo + onError logic in
 * AllPlayers and PlayerStats for the Giocatori cluster.
 */
export function PlayerPhoto({ apiFootballId, name, position, size = 'sm', className = '' }: PlayerPhotoProps) {
  const url = getPlayerPhotoUrl(apiFootballId)
  const gradient = POSITION_GRADIENTS[position] ?? 'from-gray-500 to-gray-600'

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
        className={`w-full h-full rounded-full bg-gradient-to-br ${gradient} items-center justify-center font-display font-bold text-white ${
          url ? 'hidden' : 'flex'
        }`}
      >
        {initials(name)}
      </span>
    </span>
  )
}

export default PlayerPhoto
