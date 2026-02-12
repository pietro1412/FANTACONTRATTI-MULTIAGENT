import type { TeamData } from '../finance/types'
import { getTeamBalance, getHealthStatus } from '../finance/types'

interface ManagerCardProps {
  team: TeamData
  isSelected: boolean
  hasFinancialDetails: boolean
  onClick: () => void
}

const HEALTH_DOT: Record<string, string> = {
  good: 'bg-green-400',
  warning: 'bg-amber-400',
  critical: 'bg-red-400',
}

const AVATAR_COLORS = [
  'from-primary-500 to-primary-700',
  'from-accent-500 to-accent-700',
  'from-secondary-500 to-secondary-700',
  'from-amber-500 to-amber-700',
  'from-purple-500 to-purple-700',
  'from-pink-500 to-pink-700',
  'from-teal-500 to-teal-700',
]

function getAvatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]!
}

const POS_COLORS: Record<string, string> = {
  P: 'bg-amber-500/60',
  D: 'bg-blue-500/60',
  C: 'bg-emerald-500/60',
  A: 'bg-red-500/60',
}

export function ManagerCard({ team, isSelected, hasFinancialDetails, onClick }: ManagerCardProps) {
  const balance = getTeamBalance(team, hasFinancialDetails)
  const health = getHealthStatus(balance)
  const dist = team.positionDistribution
  const total = dist.P + dist.D + dist.C + dist.A || 1

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-xl border transition-all hover:border-primary-500/50 hover:bg-surface-200/60 hover:shadow-md hover:shadow-primary-500/5 ${
        isSelected
          ? 'border-primary-500 bg-primary-500/10 shadow-lg shadow-primary-500/10'
          : 'border-surface-50/20 bg-surface-300/50'
      }`}
    >
      {/* Row 1: avatar + name + health dot */}
      <div className="flex items-center gap-2.5 mb-2">
        <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${getAvatarColor(team.username)} flex items-center justify-center flex-shrink-0`}>
          <span className="text-white font-bold text-sm">{team.username[0]?.toUpperCase()}</span>
        </div>
        <span className="text-sm font-semibold text-white truncate flex-1">{team.username}</span>
        <div className={`w-3 h-3 rounded-full ${HEALTH_DOT[health]} flex-shrink-0`} title={health} />
      </div>

      {/* Row 2: key metrics */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm mb-2">
        <div className="flex justify-between">
          <span className="text-gray-400">Budget</span>
          <span className="text-primary-400 font-medium font-mono">{team.budget}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Ingaggi</span>
          <span className="text-accent-400 font-medium font-mono">{team.annualContractCost}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Bilancio</span>
          <span className={`font-semibold font-mono ${balance < 0 ? 'text-red-400' : balance < 100 ? 'text-amber-400' : 'text-green-400'}`}>
            {balance >= 0 ? '+' : ''}{balance}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Rosa</span>
          <span className="text-white font-medium font-mono">{team.slotCount}/{team.maxSlots}</span>
        </div>
      </div>

      {/* Row 3: mini position bar */}
      <div className="flex h-2.5 rounded-full overflow-hidden bg-surface-100/30">
        {(['P', 'D', 'C', 'A'] as const).map(pos => {
          const pct = (dist[pos] / total) * 100
          if (pct === 0) return null
          return <div key={pos} className={`${POS_COLORS[pos]} transition-all`} style={{ width: `${pct}%` }} />
        })}
      </div>
      <div className="flex gap-2 mt-1 text-xs text-gray-400">
        {(['P', 'D', 'C', 'A'] as const).map(pos => (
          <span key={pos}>{pos}:<span className="font-mono">{dist[pos]}</span></span>
        ))}
      </div>
    </button>
  )
}
