import { Button } from '../ui/Button'
import { RubataStepper } from './RubataStepper'
import type {
  BoardData,
  BoardPlayer,
  RubataStateType,
  ProgressStats,
} from '../../types/rubata.types'

interface RubataActionBarProps {
  rubataState: RubataStateType
  timerDisplay: number | null
  isPusherConnected: boolean
  progressStats: ProgressStats | null
  boardData: BoardData | null
  canMakeOffer: boolean | '' | null | undefined
  currentPlayer: BoardPlayer | null
  isSubmitting: boolean
  onMakeOffer: () => void
}

function getStateBadge(state: RubataStateType): { label: string; classes: string } {
  switch (state) {
    case 'READY_CHECK': return { label: '🔔 PRONTI?', classes: 'bg-blue-500/20 text-blue-400 border-blue-500/40' }
    case 'PREVIEW': return { label: '👁️ PREVIEW', classes: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/40' }
    case 'OFFERING': return { label: '⏳ OFFERTA', classes: 'bg-warning-500/20 text-warning-400 border-warning-500/40' }
    case 'AUCTION_READY_CHECK': return { label: '🎯 RUBATA!', classes: 'bg-orange-500/20 text-orange-400 border-orange-500/40 animate-pulse' }
    case 'AUCTION': return { label: '🔥 ASTA', classes: 'bg-danger-500/20 text-danger-400 border-danger-500/40 animate-pulse' }
    case 'PENDING_ACK': return { label: '✋ CONFERMA', classes: 'bg-purple-500/20 text-purple-400 border-purple-500/40' }
    case 'PAUSED': return { label: '⏸️ PAUSA', classes: 'bg-gray-500/20 text-gray-400 border-gray-500/40' }
    case 'WAITING': return { label: '⏹️ ATTESA', classes: 'bg-primary-500/20 text-primary-400 border-primary-500/40' }
    case 'COMPLETED': return { label: '✅ COMPLETATA', classes: 'bg-secondary-500/20 text-secondary-400 border-secondary-500/40' }
    default: return { label: '—', classes: 'bg-surface-300 text-gray-400' }
  }
}

function getTimerColor(seconds: number): string {
  if (seconds > 10) return 'text-secondary-400'
  if (seconds > 5) return 'text-warning-400'
  return 'text-danger-400'
}

export function RubataActionBar({
  rubataState,
  timerDisplay,
  isPusherConnected,
  progressStats,
  boardData,
  canMakeOffer,
  currentPlayer,
  isSubmitting,
  onMakeOffer,
}: RubataActionBarProps) {
  const badge = getStateBadge(rubataState)

  return (
    <div className="sticky top-16 z-20 bg-surface-200/95 backdrop-blur-sm border border-surface-50/20 rounded-xl mb-3 shadow-lg">
      {/* Row 1: stepper dots | state badge | timer | LIVE | progress */}
      <div className="flex items-center gap-2 px-3 py-2.5 flex-wrap">
        {/* Stepper dots */}
        <RubataStepper currentState={rubataState} compact />

        {/* Separator */}
        <div className="w-px h-5 bg-surface-50/20 hidden sm:block" />

        {/* State badge */}
        <span className={`px-2.5 py-1 rounded-full font-bold text-xs border ${badge.classes}`}>
          {badge.label}
        </span>

        {/* Timer */}
        {timerDisplay !== null && (
          <span className={`font-mono font-bold text-lg tabular-nums ${getTimerColor(timerDisplay)} ${timerDisplay <= 5 ? 'animate-pulse' : ''}`}>
            {timerDisplay}s
          </span>
        )}

        {/* Separator */}
        <div className="w-px h-5 bg-surface-50/20 hidden sm:block" />

        {/* LIVE indicator */}
        <div className="flex items-center gap-1" title={isPusherConnected ? 'Real-time connesso' : 'Real-time disconnesso'}>
          <div className={`w-2 h-2 rounded-full ${isPusherConnected ? 'bg-secondary-400' : 'bg-danger-400 animate-pulse'}`} />
          <span className={`text-[10px] uppercase tracking-wider font-medium ${isPusherConnected ? 'text-secondary-400' : 'text-danger-400'}`}>
            {isPusherConnected ? 'LIVE' : 'OFF'}
          </span>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Progress stats - desktop */}
        {progressStats && (
          <div className="hidden sm:flex items-center gap-2 text-xs">
            <span className="px-2 py-0.5 bg-accent-500/20 rounded text-accent-400">
              📊 {progressStats.currentIndex + 1}/{progressStats.totalPlayers}
            </span>
            {progressStats.managerProgress && (
              <span className="px-2 py-0.5 bg-primary-500/20 rounded text-primary-400">
                👤 {progressStats.managerProgress.username}: {progressStats.managerProgress.processed}/{progressStats.managerProgress.total}
              </span>
            )}
          </div>
        )}

        {/* Progress stats - mobile compact */}
        {progressStats && (
          <span className="sm:hidden text-xs px-2 py-0.5 bg-accent-500/20 rounded text-accent-400">
            {progressStats.currentIndex + 1}/{progressStats.totalPlayers}
          </span>
        )}
      </div>

      {/* Row 2: VOGLIO RUBARE button - mobile only, during OFFERING */}
      {rubataState === 'OFFERING' && canMakeOffer && currentPlayer && (
        <div className="md:hidden px-3 pb-2.5">
          <Button
            onClick={onMakeOffer}
            disabled={isSubmitting}
            variant="accent"
            className="w-full text-base py-2.5"
          >
            🎯 VOGLIO RUBARE! ({currentPlayer.rubataPrice}M)
          </Button>
        </div>
      )}

      {/* Paused timer info */}
      {rubataState === 'PAUSED' && boardData?.pausedRemainingSeconds != null && (
        <div className="px-3 pb-2 text-xs text-yellow-400">
          ⏸️ {boardData.pausedRemainingSeconds}s rimanenti — {boardData.pausedFromState === 'AUCTION' ? 'Asta' : 'Offerta'}
        </div>
      )}
    </div>
  )
}
