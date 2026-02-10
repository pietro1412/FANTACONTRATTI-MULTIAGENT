import type { MarketProgress, Membership } from '../../types/auctionroom.types'
import { PhaseIndicator } from './PhaseIndicator'
import { POSITION_FILTER_COLORS, POSITION_NAMES } from '../ui/PositionBadge'
import type { AuctionPhase } from './types'

interface StatusBarProps {
  isConnected: boolean
  connectionStatus: string
  currentTurnManager: { username: string } | null
  isMyTurn: boolean
  marketProgress: MarketProgress | null
  isPrimoMercato: boolean
  membership: Membership | null
  currentPhase: AuctionPhase
}

export function StatusBar({
  isConnected,
  connectionStatus,
  currentTurnManager,
  isMyTurn,
  marketProgress,
  isPrimoMercato,
  membership,
  currentPhase,
}: StatusBarProps) {
  return (
    <div className="bg-surface-200 rounded-xl border border-surface-50/20 px-3 py-2 flex items-center gap-3 flex-wrap">
      {/* Connection */}
      <div className={`flex items-center gap-1.5 text-xs ${isConnected ? 'text-green-400' : 'text-yellow-400'}`}>
        <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`} />
        <span className="hidden sm:inline">{isConnected ? 'Live' : connectionStatus}</span>
      </div>

      <div className="w-px h-4 bg-surface-50/20" />

      {/* Turn */}
      {currentTurnManager && (
        <>
          <div className="text-xs">
            {isMyTurn ? (
              <span className="font-bold text-accent-400">IL TUO TURNO</span>
            ) : (
              <span className="text-gray-300">
                Turno: <strong className="text-primary-400">{currentTurnManager.username}</strong>
              </span>
            )}
          </div>
          <div className="w-px h-4 bg-surface-50/20" />
        </>
      )}

      {/* Phase Indicator */}
      <PhaseIndicator currentPhase={currentPhase} compact />

      {/* Position progress pills */}
      {isPrimoMercato && marketProgress && (
        <>
          <div className="w-px h-4 bg-surface-50/20 hidden sm:block" />
          <div className="hidden sm:flex items-center gap-1">
            {marketProgress.roleSequence.map(role => (
              <span
                key={role}
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                  role === marketProgress.currentRole
                    ? POSITION_FILTER_COLORS[role as keyof typeof POSITION_FILTER_COLORS] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                    : 'bg-surface-300 text-gray-500 border-surface-50/20'
                }`}
              >
                {(POSITION_NAMES[role as keyof typeof POSITION_NAMES] || role).slice(0, 3)}
              </span>
            ))}
            <span className="text-[10px] text-gray-400 ml-1">
              {marketProgress.filledSlots}/{marketProgress.totalSlots}
            </span>
          </div>
        </>
      )}

      {/* Budget - always visible */}
      <div className="ml-auto flex items-center gap-1.5">
        <span className="text-[10px] text-gray-400 uppercase hidden sm:inline">Budget</span>
        <span className="text-sm font-bold gradient-text-gold">{membership?.currentBudget || 0}</span>
      </div>
    </div>
  )
}
