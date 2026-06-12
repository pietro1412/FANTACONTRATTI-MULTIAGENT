import { memo } from 'react'
import { TimerDisplay } from '@/components/ui/TimerDisplay'
import type { RubataStateType, ProgressStats } from '../../types/rubata.types'

export interface RubataStateBarProps {
  rubataState: RubataStateType
  timerDisplay: number | null
  isPusherConnected: boolean
  progressStats: ProgressStats | null
}

interface StateConfig {
  label: string
  sub?: string
  dotColor: string
}

function getStateConfig(state: RubataStateType): StateConfig {
  switch (state) {
    case 'READY_CHECK': return { label: 'RUBATA · PRONTI?', dotColor: 'bg-primary-400' }
    case 'PREVIEW': return { label: 'RUBATA · ANTEPRIMA', dotColor: 'bg-primary-400' }
    case 'OFFERING': return { label: 'FASE RUBATA · OFFERTA', dotColor: 'bg-accent-400' }
    case 'AUCTION_READY_CHECK': return { label: 'RUBATA · ASTA IN ARRIVO', dotColor: 'bg-warning-400' }
    case 'AUCTION': return { label: 'FASE RUBATA · ASTA', dotColor: 'bg-danger-400' }
    case 'PENDING_ACK': return { label: 'RUBATA · CONFERMA', dotColor: 'bg-primary-400' }
    case 'PAUSED': return { label: 'RUBATA · IN PAUSA', dotColor: 'bg-gray-400' }
    case 'WAITING': return { label: 'RUBATA · IN ATTESA', dotColor: 'bg-primary-400' }
    case 'COMPLETED': return { label: 'RUBATA · COMPLETATA', dotColor: 'bg-secondary-400' }
    default: return { label: 'RUBATA', dotColor: 'bg-gray-500' }
  }
}

/**
 * Barra di stato unificata (mockup v2): fase + turno a sinistra,
 * timer grande al centro, progresso board a destra.
 * Assorbe stepper e timer duplicati.
 */
export const RubataStateBar = memo(function RubataStateBar({
  rubataState,
  timerDisplay,
  isPusherConnected,
  progressStats,
}: RubataStateBarProps) {
  const config = getStateConfig(rubataState)
  const timerLabel = rubataState === 'AUCTION' ? 'per rilanciare' : 'per decidere'
  const isLive = rubataState === 'OFFERING' || rubataState === 'AUCTION'

  const progressPct = progressStats && progressStats.totalPlayers > 0
    ? Math.min(100, Math.round(((progressStats.currentIndex + 1) / progressStats.totalPlayers) * 100))
    : 0

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-surface-300 border border-surface-50/20">
      {/* Phase + turn */}
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className={`flex-shrink-0 ${
              isLive
                ? `dot-live ${rubataState === 'AUCTION' ? 'bg-danger-400 shadow-[0_0_8px_theme(colors.danger.400)] animate-pulse' : ''}`
                : `w-2 h-2 rounded-full ${config.dotColor}`
            }`}
          />
          <span className="text-[13px] sm:text-[15px] font-display font-bold text-white uppercase tracking-wide truncate">
            {config.label}
          </span>
        </div>
        {progressStats?.managerProgress && (
          <span className="text-[11px] text-gray-400 truncate">
            Turno di <b className="text-gray-200 font-semibold">{progressStats.managerProgress.username}</b>
            {' · '}{progressStats.managerProgress.processed}/{progressStats.managerProgress.total}
          </span>
        )}
      </div>

      {/* Timer di fase — pillola piatta condivisa (P1, 40px) */}
      {timerDisplay !== null && (
        <div className="flex items-center gap-2 flex-shrink-0">
          <TimerDisplay seconds={timerDisplay} size={40} variant="flat" />
          <span className="hidden sm:block text-[10px] text-gray-500 uppercase tracking-wider max-w-[64px] leading-snug">{timerLabel}</span>
        </div>
      )}

      {/* Board progress + live */}
      <div className="flex flex-col items-end gap-1 flex-shrink-0 min-w-[88px]">
        <div className="flex items-center gap-2">
          {progressStats && (
            <span className="text-xs font-mono font-semibold text-gray-200">
              {progressStats.currentIndex + 1}<span className="text-gray-500"> / {progressStats.totalPlayers}</span>
            </span>
          )}
          <span
            className={`w-2 h-2 rounded-full ${isPusherConnected ? 'bg-secondary-400' : 'bg-danger-400 animate-pulse'}`}
            title={isPusherConnected ? 'Connesso' : 'Disconnesso'}
          />
        </div>
        {progressStats && (
          <div className="w-20 sm:w-28 h-1 rounded-full bg-surface-50 overflow-hidden">
            <div
              className="h-full rounded-full progress-gradient transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        )}
      </div>
    </div>
  )
})
