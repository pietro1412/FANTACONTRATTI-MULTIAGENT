import type { MarketProgress } from '../../types/auctionroom.types'
import { POSITION_GRADIENTS, POSITION_NAMES } from '../ui/PositionBadge'

interface WaitingPanelProps {
  currentTurnManager: { username: string } | null
  marketProgress: MarketProgress | null
}

export function WaitingPanel({ currentTurnManager, marketProgress }: WaitingPanelProps) {
  const currentRole = marketProgress?.currentRole || ''
  const posGradient = POSITION_GRADIENTS[currentRole] || 'from-gray-500 to-gray-600'
  const posName = POSITION_NAMES[currentRole] || currentRole

  return (
    <div className="mb-6">
      {/* Mystery card — mimics BiddingPanel layout */}
      <div className="lg:grid lg:grid-cols-2 lg:gap-4 space-y-4 lg:space-y-0">
        {/* Left: Mystery Player Card */}
        <div className="relative rounded-xl border border-white/10 bg-slate-800/40 overflow-hidden p-5">
          <div className="flex items-center gap-4">
            {/* Mystery photo */}
            <div className={`w-20 h-20 rounded-xl bg-gradient-to-br ${posGradient} flex items-center justify-center flex-shrink-0 opacity-60`}>
              <span className="text-4xl font-black text-white/80">?</span>
            </div>
            {/* Mystery info */}
            <div className="flex-1 min-w-0 space-y-2">
              <div className="h-5 bg-white/5 rounded-lg w-3/4 animate-pulse" />
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-white/5 rounded animate-pulse" />
                <div className="h-3.5 bg-white/5 rounded w-1/2 animate-pulse" />
              </div>
              {/* Position badge */}
              {currentRole && (
                <span className={`inline-block text-sms font-bold px-2.5 py-1 rounded bg-gradient-to-r ${posGradient} text-white opacity-70`}>
                  {posName}
                </span>
              )}
            </div>
          </div>
          {/* Shimmer overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent animate-shimmer pointer-events-none" />
        </div>

        {/* Right: Waiting Price Box */}
        <div className="flex flex-col items-center justify-center">
          <div className="relative rounded-xl p-5 text-center w-full border-2 border-white/10 bg-gradient-to-br from-slate-800/50 to-slate-900/80 overflow-hidden">
            <p className="text-sm text-gray-500 uppercase tracking-wider font-bold mb-2">Prossima Offerta</p>
            <p className="text-smxl lg:text-smxl font-mono font-black text-white/10 mb-3 select-none">
              ?
            </p>
            {currentTurnManager && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-500/10 border border-primary-500/30">
                <span className="w-2 h-2 rounded-full bg-primary-400 animate-pulse" />
                <span className="text-sm text-gray-400">
                  Turno di <strong className="text-smrimary-400">{currentTurnManager.username}</strong>
                </span>
              </div>
            )}
            {/* Shimmer */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent animate-shimmer pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Waiting message */}
      {marketProgress && (
        <div className="mt-3 text-center">
          <p className="text-sms text-gray-500">
            In attesa della nomina per il reparto <span className="font-bold text-gray-400">{posName}</span>
            {' '}({marketProgress.filledSlots}/{marketProgress.totalSlots} slot completati)
          </p>
        </div>
      )}
    </div>
  )
}
