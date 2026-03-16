import { RubataStateBar } from './RubataStateBar'
import type {
  BoardData,
  RubataStateType,
  ProgressStats,
} from '../../types/rubata.types'

interface RubataActionBarProps {
  rubataState: RubataStateType
  timerDisplay: number | null
  timerTotal: number
  isPusherConnected: boolean
  progressStats: ProgressStats | null
  boardData: BoardData | null
}

export function RubataActionBar({
  rubataState,
  timerDisplay,
  timerTotal,
  isPusherConnected,
  progressStats,
  boardData,
}: RubataActionBarProps) {
  return (
    <div className="sticky top-16 z-20 bg-surface-200/95 backdrop-blur-sm border border-surface-50/20 rounded-xl mb-3 shadow-lg">
      {/* RubataStateBar: state icon + timer + progress + LIVE */}
      <div className="px-2 py-1.5">
        <RubataStateBar
          rubataState={rubataState}
          timerDisplay={timerDisplay}
          timerTotal={timerTotal}
          isPusherConnected={isPusherConnected}
          progressStats={progressStats}
        />
      </div>

      {/* Paused timer info */}
      {rubataState === 'PAUSED' && boardData?.pausedRemainingSeconds != null && (
        <div className="px-3 pb-2 text-xs text-warning-400">
          ⏸️ {boardData.pausedRemainingSeconds}s rimanenti — {boardData.pausedFromState === 'AUCTION' ? 'Asta' : 'Offerta'}
        </div>
      )}
    </div>
  )
}
