import { type HTMLAttributes, type JSX } from 'react'

type Position = 'P' | 'D' | 'C' | 'A'
type BadgeSize = 'xs' | 'sm' | 'md' | 'lg'

interface PositionBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  position: Position | string
  size?: BadgeSize
  showIcon?: boolean
  showLabel?: boolean
  className?: string
}

// Position configuration with colors and accessibility icons
const POSITION_CONFIG: Record<Position, {
  label: string
  shortLabel: string
  colors: string
  icon: JSX.Element
}> = {
  P: {
    label: 'Portiere',
    shortLabel: 'P',
    colors: 'bg-gradient-to-r from-amber-500 to-amber-600 text-black',
    // Glove icon (circle shape for accessibility)
    icon: (
      <svg className="w-full h-full" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="12" r="10" />
      </svg>
    ),
  },
  D: {
    label: 'Difensore',
    shortLabel: 'D',
    colors: 'bg-gradient-to-r from-blue-500 to-blue-600 text-white',
    // Shield icon (square shape for accessibility)
    icon: (
      <svg className="w-full h-full" viewBox="0 0 24 24" fill="currentColor">
        <rect x="4" y="4" width="16" height="16" rx="2" />
      </svg>
    ),
  },
  C: {
    label: 'Centrocampista',
    shortLabel: 'C',
    colors: 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white',
    // Gear/hexagon icon for accessibility
    icon: (
      <svg className="w-full h-full" viewBox="0 0 24 24" fill="currentColor">
        <polygon points="12,2 22,8.5 22,15.5 12,22 2,15.5 2,8.5" />
      </svg>
    ),
  },
  A: {
    label: 'Attaccante',
    shortLabel: 'A',
    colors: 'bg-gradient-to-r from-red-500 to-red-600 text-white',
    // Lightning/triangle icon for accessibility
    icon: (
      <svg className="w-full h-full" viewBox="0 0 24 24" fill="currentColor">
        <polygon points="12,2 22,22 2,22" />
      </svg>
    ),
  },
}

// Size configurations
const SIZE_CONFIG: Record<BadgeSize, {
  badge: string
  icon: string
  text: string
}> = {
  xs: {
    badge: 'px-1.5 py-0.5 gap-0.5',
    icon: 'w-2.5 h-2.5',
    text: 'text-[10px]',
  },
  sm: {
    badge: 'px-2 py-0.5 gap-1',
    icon: 'w-3 h-3',
    text: 'text-xs',
  },
  md: {
    badge: 'px-2.5 py-1 gap-1.5',
    icon: 'w-3.5 h-3.5',
    text: 'text-sm',
  },
  lg: {
    badge: 'px-3 py-1.5 gap-2',
    icon: 'w-4 h-4',
    text: 'text-base',
  },
}

/**
 * Position badge component with accessible icons for colorblind users
 * Each position has a unique shape in addition to color:
 * - P (Portiere): Circle
 * - D (Difensore): Square/Shield
 * - C (Centrocampista): Hexagon
 * - A (Attaccante): Triangle
 */
export function PositionBadge({
  position,
  size = 'sm',
  showIcon = true,
  showLabel = true,
  className = '',
  ...props
}: PositionBadgeProps) {
  const normalizedPosition = position?.toUpperCase() as Position
  const config = POSITION_CONFIG[normalizedPosition]
  const sizeConfig = SIZE_CONFIG[size]

  if (!config) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-full font-bold bg-gray-500 text-white ${sizeConfig.badge} ${sizeConfig.text} ${className}`}
        {...props}
      >
        {position}
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-bold ${config.colors} ${sizeConfig.badge} ${sizeConfig.text} ${className}`}
      title={config.label}
      role="img"
      aria-label={config.label}
      {...props}
    >
      {showIcon && (
        <span className={`${sizeConfig.icon} opacity-80`} aria-hidden="true">
          {config.icon}
        </span>
      )}
      {showLabel && <span>{config.shortLabel}</span>}
    </span>
  )
}

/**
 * Returns position colors for custom usage
 */
export function getPositionColors(position: Position | string): string {
  const normalizedPosition = position?.toUpperCase() as Position
  return POSITION_CONFIG[normalizedPosition]?.colors || 'bg-gray-500 text-white'
}

/**
 * Returns position full label
 */
export function getPositionLabel(position: Position | string): string {
  const normalizedPosition = position?.toUpperCase() as Position
  return POSITION_CONFIG[normalizedPosition]?.label || position
}

// Position constants for reuse
export const POSITIONS = ['P', 'D', 'C', 'A'] as const
export const POSITION_NAMES: Record<Position, string> = {
  P: 'Portiere',
  D: 'Difensore',
  C: 'Centrocampista',
  A: 'Attaccante',
}

export default PositionBadge
