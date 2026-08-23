import { getTeamLogo } from '@/utils/teamLogos'

export interface TeamLogoProps {
  team: string
  /** Tailwind size classes for the wrapper (default sm: w-6 h-6). */
  size?: 'xs' | 'sm' | 'md'
  className?: string
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
export function TeamLogo({ team, size = 'sm', className = '' }: TeamLogoProps) {
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
