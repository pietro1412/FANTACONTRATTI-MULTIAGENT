import { POSITION_GRADIENTS } from '@/components/ui/PositionBadge'

export interface PlayerRoleBadgeProps {
  position: string
  size?: 'sm' | 'md'
  className?: string
}

const DIMS = {
  sm: 'w-7 h-7 text-[11px]',
  md: 'w-8 h-8 text-xs',
} as const

/**
 * Square role tile (P/D/C/A) used by the Rose / Giocatori cluster rows, matching
 * the cockpit mockup. Reuses the domain position gradients from PositionBadge
 * (gold/blue/green/red are admitted domain colors). For pill/icon contexts use
 * PositionBadge instead.
 */
export function PlayerRoleBadge({ position, size = 'md', className = '' }: PlayerRoleBadgeProps) {
  const gradient = POSITION_GRADIENTS[position] ?? 'from-gray-500 to-gray-600'
  const textTone = position === 'P' ? 'text-black' : 'text-white'
  return (
    <span
      className={`${DIMS[size]} flex items-center justify-center rounded-lg flex-shrink-0 bg-gradient-to-br ${gradient} font-display font-bold ${textTone} ${className}`}
      title={position}
    >
      {position}
    </span>
  )
}

export default PlayerRoleBadge
