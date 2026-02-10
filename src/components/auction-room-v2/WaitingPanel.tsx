import type { MarketProgress } from '../../types/auctionroom.types'
import { POSITION_GRADIENTS } from '../ui/PositionBadge'

interface WaitingPanelProps {
  currentTurnManager: { username: string } | null
  marketProgress: MarketProgress | null
}

export function WaitingPanel({ currentTurnManager, marketProgress }: WaitingPanelProps) {
  return (
    <div className="text-center py-10">
      {marketProgress && (
        <div className={`w-16 h-16 mx-auto rounded-full bg-gradient-to-br ${POSITION_GRADIENTS[marketProgress.currentRole as keyof typeof POSITION_GRADIENTS] || 'from-gray-500 to-gray-600'} flex items-center justify-center text-2xl font-bold text-white mb-4`}>
          {marketProgress.currentRole}
        </div>
      )}
      <p className="text-gray-400 mb-1">In attesa...</p>
      {currentTurnManager && (
        <p className="text-sm text-gray-500">
          Turno di <strong className="text-primary-400">{currentTurnManager.username}</strong>
        </p>
      )}
    </div>
  )
}
