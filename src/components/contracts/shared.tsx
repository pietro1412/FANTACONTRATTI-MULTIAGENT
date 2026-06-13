import { POSITION_COLORS } from '@/components/ui/PositionBadge'
import { getTeamLogo } from '@/utils/teamLogos'
import { getPlayerPhotoUrl } from '@/utils/player-images'

// ===== Domain types shared across the contracts cockpit views =====

export interface ComputedSeasonStats {
  season: string
  appearances: number
  totalMinutes: number
  avgRating: number | null
  totalGoals: number
  totalAssists: number
  startingXI: number
  matchesInSquad: number
}

export interface ContractPlayer {
  id: string
  name: string
  team: string
  position: string
  listStatus?: string
  exitReason?: string
  age?: number | null
  apiFootballId?: number | null
  computedStats?: ComputedSeasonStats | null
}

// ===== Visual helpers =====

export function getRoleStyle(position: string) {
  const colors = POSITION_COLORS[position]
  return colors || { bg: 'bg-gradient-to-r from-gray-500 to-gray-600', text: 'text-white', border: '' }
}

// Duration color (issue #202): 1s urgent, 2s warning, 3s primary, 4s long-term
export function getDurationColor(duration: number): string {
  switch (duration) {
    case 1: return 'text-danger-400'
    case 2: return 'text-warning-400'
    case 3: return 'text-primary-400'
    case 4: return 'text-secondary-400'
    default: return 'text-gray-400'
  }
}

// Age color (issue #206): younger is better
export function getAgeColor(age: number | null | undefined): string {
  if (age === null || age === undefined) return 'text-gray-500'
  if (age < 20) return 'text-secondary-400 font-bold'
  if (age < 25) return 'text-secondary-400'
  if (age < 30) return 'text-warning-400'
  if (age < 35) return 'text-warning-500'
  return 'text-danger-400'
}

// Role accent text color for labels/legends (the on-badge text color is dark by
// contrast, so it is not suitable outside the badge).
export function getRoleAccentText(position: string): string {
  switch (position) {
    case 'P': return 'text-accent-400'
    case 'D': return 'text-primary-400'
    case 'C': return 'text-secondary-400'
    case 'A': return 'text-danger-400'
    default: return 'text-gray-400'
  }
}

export const DURATION_MULTIPLIERS: Record<number, number> = { 4: 11, 3: 9, 2: 7, 1: 3 }

export const MAX_ROSTER_SIZE = 29

// ===== Small presentational primitives =====

export function TeamLogo({ team, className = 'w-6 h-6 object-contain' }: { team: string; className?: string }) {
  return (
    <img
      src={getTeamLogo(team)}
      alt={team}
      className={className}
      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
    />
  )
}

export function RoleBadge({ position, size = 'md' }: { position: string; size?: 'sm' | 'md' }) {
  const style = getRoleStyle(position)
  const dim = size === 'sm' ? 'w-7 h-7 text-[11px]' : 'w-8 h-8 text-xs'
  return (
    <div className={`${dim} flex items-center justify-center rounded-lg flex-shrink-0 ${style.bg}`}>
      <span className={`font-display font-bold ${style.text}`}>{position}</span>
    </div>
  )
}

/**
 * Player identity cell: optional photo, role badge, team logo, name (clickable),
 * and an optional sub-line (age / rating / tags). Reused by mobile cards and
 * desktop rows to remove the largest mobile/desktop duplication.
 */
export function PlayerCell({
  player,
  onClick,
  nameClassName = 'text-primary-400 hover:text-primary-300',
  showPhoto = true,
  sub,
  trailing,
}: {
  player: ContractPlayer
  onClick?: () => void
  nameClassName?: string
  showPhoto?: boolean
  sub?: React.ReactNode
  trailing?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      {showPhoto && player.apiFootballId ? (
        <img
          src={getPlayerPhotoUrl(player.apiFootballId)}
          alt={player.name}
          className="w-7 h-7 rounded-full object-cover bg-surface-300 flex-shrink-0"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      ) : null}
      <RoleBadge position={player.position} />
      <div className="w-6 h-6 bg-white rounded p-0.5 flex-shrink-0 hidden sm:block">
        <TeamLogo team={player.team} />
      </div>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={onClick}
          className={`font-display font-bold text-sm leading-tight cursor-pointer transition-colors truncate text-left max-w-full ${nameClassName}`}
        >
          {player.name}
        </button>
        {sub && <div className="text-[10.5px] text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">{sub}</div>}
      </div>
      {trailing}
    </div>
  )
}

// Pill tag (SPALMABILE / RIALZO / SCAMBIO / etc.)
export function Tag({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode
  tone?: 'primary' | 'secondary' | 'accent' | 'danger' | 'warning' | 'neutral'
}) {
  const tones: Record<'primary' | 'secondary' | 'accent' | 'danger' | 'warning' | 'neutral', string> = {
    primary: 'text-primary-400 border-primary-500/45',
    secondary: 'text-secondary-400 border-secondary-500/45 bg-secondary-500/10',
    accent: 'text-accent-400 border-accent-500/45',
    danger: 'text-danger-400 border-danger-500/45',
    warning: 'text-warning-400 border-warning-500/45',
    neutral: 'text-gray-400 border-surface-50/40',
  }
  return (
    <span className={`font-mono text-[8.5px] font-bold rounded px-1.5 py-0.5 tracking-[0.04em] border ${tones[tone]}`}>
      {children}
    </span>
  )
}
