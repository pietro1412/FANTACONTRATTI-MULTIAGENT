import { memo } from 'react'
import { CircularTimer } from './CircularTimer'
import type { RubataStateType, ProgressStats } from '../../types/rubata.types'

export interface RubataStateBarProps {
  rubataState: RubataStateType
  timerDisplay: number | null
  timerTotal: number
  isPusherConnected: boolean
  progressStats: ProgressStats | null
}

interface StateBadgeConfig {
  label: string
  icon: string
  bgColor: string
}

function getStateConfig(state: RubataStateType): StateBadgeConfig {
  switch (state) {
    case 'READY_CHECK': return { label: 'PRONTI?', icon: '🔔', bgColor: 'bg-primary-500/20' }
    case 'PREVIEW': return { label: 'PREVIEW', icon: '👁️', bgColor: 'bg-indigo-500/20' }
    case 'OFFERING': return { label: 'OFFERTA', icon: '⏳', bgColor: 'bg-warning-500/20' }
    case 'AUCTION_READY_CHECK': return { label: 'RUBATA!', icon: '🎯', bgColor: 'bg-warning-500/20' }
    case 'AUCTION': return { label: 'ASTA', icon: '🔥', bgColor: 'bg-danger-500/20' }
    case 'PENDING_ACK': return { label: 'CONFERMA', icon: '✋', bgColor: 'bg-primary-500/20' }
    case 'PAUSED': return { label: 'PAUSA', icon: '⏸️', bgColor: 'bg-gray-500/20' }
    case 'WAITING': return { label: 'ATTESA', icon: '⏹️', bgColor: 'bg-primary-500/20' }
    case 'COMPLETED': return { label: 'COMPLETATA', icon: '✅', bgColor: 'bg-secondary-500/20' }
    default: return { label: '—', icon: '', bgColor: 'bg-surface-300' }
  }
}

export const RubataStateBar = memo(function RubataStateBar({
  rubataState,
  timerDisplay,
  timerTotal,
  isPusherConnected,
  progressStats,
}: RubataStateBarProps) {
  const config = getStateConfig(rubataState)

  return (
    <div
      className={`flex items-center gap-2 sm:gap-3 px-3 py-2 rounded-lg ${config.bgColor} transition-colors duration-300`}
      key={rubataState}
    >
      {/* State icon + label */}
      <div className="flex items-center gap-1.5">
        <span className="text-base">{config.icon}</span>
        <span className="text-sm font-bold text-white uppercase tracking-wide">{config.label}</span>
      </div>

      {/* Separator */}
      <div className="w-px h-5 bg-surface-50/20" />

      {/* Timer */}
      {timerDisplay !== null && (
        <CircularTimer seconds={timerDisplay} totalSeconds={timerTotal} size="sm" />
      )}

      {/* Separator */}
      {timerDisplay !== null && <div className="w-px h-5 bg-surface-50/20 hidden sm:block" />}

      {/* Progress */}
      {progressStats && (
        <span className="text-xs text-gray-300 font-mono">
          📊 {progressStats.currentIndex + 1}/{progressStats.totalPlayers}
        </span>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* LIVE indicator */}
      <div className="flex items-center gap-1">
        <div className={`w-2 h-2 rounded-full ${isPusherConnected ? 'bg-secondary-400' : 'bg-danger-400 animate-pulse'}`} />
        <span className={`text-[10px] uppercase tracking-wider font-medium ${isPusherConnected ? 'text-secondary-400' : 'text-danger-400'}`}>
          {isPusherConnected ? 'LIVE' : 'OFF'}
        </span>
      </div>
    </div>
  )
})
