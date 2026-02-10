import { Button } from '../ui/Button'
import { POSITION_COLORS } from '../../types/rubata.types'
import type {
  BoardData,
  BoardPlayer,
  RubataPreference,
  RubataStateType,
  ReadyStatus,
  ProgressStats,
} from '../../types/rubata.types'

interface RubataTimerPanelProps {
  rubataState: RubataStateType
  currentPlayer: BoardPlayer | null
  currentPlayerPreference: RubataPreference | undefined | null
  myMemberId: string | undefined
  timerDisplay: number | null
  isPusherConnected: boolean
  progressStats: ProgressStats | null
  canMakeOffer: boolean | '' | null | undefined
  isAdmin: boolean
  isSubmitting: boolean
  boardData: BoardData | null
  // Admin inline controls
  onStartRubata: () => void
  onResume: () => void
  onPause: () => void
  onGoBack: () => void
  onAdvance: () => void
  onCloseAuction: () => void
  // Player actions
  onMakeOffer: () => void
}

export function RubataTimerPanel({
  rubataState,
  currentPlayer,
  currentPlayerPreference,
  myMemberId,
  timerDisplay,
  isPusherConnected,
  progressStats,
  canMakeOffer,
  isAdmin,
  isSubmitting,
  boardData,
  onStartRubata,
  onResume,
  onPause,
  onGoBack,
  onAdvance,
  onCloseAuction,
  onMakeOffer,
}: RubataTimerPanelProps) {
  return (
    <div className="mb-6 bg-surface-200 rounded-2xl border-2 border-primary-500/50 overflow-hidden sticky top-16 z-20 lg:relative lg:top-0">
      <div className="p-5 bg-primary-500/10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Current Player Info */}
          <div className="flex items-center gap-4">
            {currentPlayer ? (
              <>
                <div className={`w-12 h-12 rounded-full ${POSITION_COLORS[currentPlayer.playerPosition]} border flex items-center justify-center font-bold text-lg`}>
                  {currentPlayer.playerPosition}
                </div>
                <div>
                  <p className="text-xl font-bold text-white">{currentPlayer.playerName}</p>
                  <p className="text-gray-400">{currentPlayer.playerTeam} • {currentPlayer.ownerUsername}</p>
                </div>
                <div className="ml-4 text-right">
                  <p className="text-2xl font-bold text-primary-400">{currentPlayer.rubataPrice}M</p>
                  <p className="text-xs text-gray-500">prezzo rubata</p>
                </div>
                {/* My strategy indicator for current player */}
                {currentPlayerPreference && currentPlayer.memberId !== myMemberId && (
                  <div className="ml-4 px-3 py-2 bg-indigo-500/20 border border-indigo-500/40 rounded-lg">
                    <p className="text-[10px] text-indigo-300 uppercase mb-1">La tua strategia</p>
                    <div className="flex items-center gap-2 text-sm">
                      {currentPlayerPreference.isWatchlist && <span title="Watchlist">⭐</span>}
                      {currentPlayerPreference.isAutoPass && <span title="Auto-pass">🚫</span>}
                      {currentPlayerPreference.priority && (
                        <span className="text-purple-400">{'★'.repeat(currentPlayerPreference.priority)}</span>
                      )}
                      {currentPlayerPreference.maxBid && (
                        <span className="text-blue-400">Max: {currentPlayerPreference.maxBid}M</span>
                      )}
                      {currentPlayerPreference.notes && (
                        <span className="text-gray-400 truncate max-w-[100px]" title={currentPlayerPreference.notes}>📝</span>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-gray-400">Nessun giocatore in esame</p>
            )}
          </div>

          {/* Timer */}
          <div className="flex items-center gap-4">
            {/* Pusher Connection Indicator */}
            <div className="flex items-center gap-1" title={isPusherConnected ? 'Real-time connesso' : 'Real-time disconnesso'}>
              <div className={`w-2 h-2 rounded-full ${isPusherConnected ? 'bg-secondary-400' : 'bg-danger-400 animate-pulse'}`} />
              <span className={`text-[10px] uppercase tracking-wider ${isPusherConnected ? 'text-secondary-400' : 'text-danger-400'}`}>
                {isPusherConnected ? 'LIVE' : 'OFFLINE'}
              </span>
            </div>
            {timerDisplay !== null && (
              <div className={`text-4xl font-mono font-bold ${timerDisplay <= 5 ? 'text-danger-400 animate-pulse' : timerDisplay <= 10 ? 'text-warning-400' : 'text-white'}`}>
                {timerDisplay}s
              </div>
            )}
            <div className="text-center">
              <span className={`px-4 py-2 rounded-full font-bold text-sm ${
                rubataState === 'READY_CHECK' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40' :
                rubataState === 'PREVIEW' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/40' :
                rubataState === 'OFFERING' ? 'bg-warning-500/20 text-warning-400 border border-warning-500/40' :
                rubataState === 'AUCTION_READY_CHECK' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40 animate-pulse' :
                rubataState === 'AUCTION' ? 'bg-danger-500/20 text-danger-400 border border-danger-500/40 animate-pulse' :
                rubataState === 'PENDING_ACK' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40' :
                rubataState === 'PAUSED' ? 'bg-gray-500/20 text-gray-400 border border-gray-500/40' :
                rubataState === 'WAITING' ? 'bg-primary-500/20 text-primary-400 border border-primary-500/40' :
                rubataState === 'COMPLETED' ? 'bg-secondary-500/20 text-secondary-400 border border-secondary-500/40' :
                'bg-surface-300 text-gray-400'
              }`}>
                {rubataState === 'READY_CHECK' ? '🔔 PRONTI?' :
                 rubataState === 'PREVIEW' ? '👁️ PREVIEW' :
                 rubataState === 'OFFERING' ? '⏳ OFFERTA' :
                 rubataState === 'AUCTION_READY_CHECK' ? '🎯 RUBATA!' :
                 rubataState === 'AUCTION' ? '🔥 ASTA' :
                 rubataState === 'PENDING_ACK' ? '✋ CONFERMA' :
                 rubataState === 'PAUSED' ? '⏸️ PAUSA' :
                 rubataState === 'WAITING' ? '⏹️ IN ATTESA' :
                 rubataState === 'COMPLETED' ? '✅ COMPLETATA' :
                 'SCONOSCIUTO'}
              </span>
              {/* Progress counters */}
              {progressStats && (
                <div className="flex flex-wrap gap-2 mt-2 text-xs">
                  {progressStats.managerProgress && (
                    <span className="px-2 py-0.5 bg-primary-500/20 rounded text-primary-400">
                      👤 {progressStats.managerProgress.username}: {progressStats.managerProgress.processed}/{progressStats.managerProgress.total}
                    </span>
                  )}
                  <span className="px-2 py-0.5 bg-accent-500/20 rounded text-accent-400">
                    📊 Totale: {progressStats.currentIndex + 1}/{progressStats.totalPlayers}
                  </span>
                  <span className="px-2 py-0.5 bg-warning-500/20 rounded text-warning-400">
                    ⏳ Rimangono: {progressStats.remaining}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Admin Controls */}
        {isAdmin && (
          <div className="mt-4 flex flex-wrap gap-2">
            {(rubataState === 'WAITING' || rubataState === 'PREVIEW') && (
              <Button onClick={onStartRubata} disabled={isSubmitting}>
                ▶️ Avvia Rubata
              </Button>
            )}
            {rubataState === 'PAUSED' && (
              <Button onClick={onResume} disabled={isSubmitting}>
                🔔 Richiedi Pronti per Riprendere
              </Button>
            )}
            {(rubataState === 'OFFERING' || rubataState === 'AUCTION') && (
              <>
                <Button onClick={onPause} disabled={isSubmitting} variant="outline">
                  ⏸️ Pausa
                </Button>
                <Button onClick={onGoBack} disabled={isSubmitting || boardData?.currentIndex === 0} variant="outline">
                  ⏮️ Indietro
                </Button>
                {rubataState === 'OFFERING' && (
                  <Button onClick={onAdvance} disabled={isSubmitting} variant="outline">
                    ⏭️ Avanti
                  </Button>
                )}
                {rubataState === 'AUCTION' && (
                  <Button onClick={onCloseAuction} disabled={isSubmitting}>
                    ✅ Chiudi Asta
                  </Button>
                )}
              </>
            )}
          </div>
        )}

        {/* Player Actions - tutti i manager possono fare offerte */}
        {rubataState === 'OFFERING' && canMakeOffer && (
          <div className="mt-4">
            <Button onClick={onMakeOffer} disabled={isSubmitting} className="w-full md:w-auto">
              🎯 VOGLIO RUBARE! ({currentPlayer?.rubataPrice}M)
            </Button>
          </div>
        )}

        {/* Strategy Info - Inline section below "Voglio Rubare" */}
        {currentPlayer && currentPlayerPreference &&
         currentPlayer.memberId !== myMemberId &&
         (currentPlayerPreference.maxBid || currentPlayerPreference.priority || currentPlayerPreference.notes) && (
          <div className="mt-4 bg-gradient-to-r from-indigo-900/50 to-purple-900/50 rounded-xl border border-indigo-500/40 overflow-hidden">
            <div className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🎯</span>
                <span className="font-bold text-indigo-300 text-sm">LA TUA STRATEGIA</span>
              </div>
              <div className="flex flex-wrap gap-3 items-center">
                {currentPlayerPreference.maxBid && (
                  <div className="bg-black/20 rounded-lg px-3 py-1.5">
                    <span className="text-[10px] text-indigo-300 uppercase mr-1">Max:</span>
                    <span className="font-bold text-blue-400">{currentPlayerPreference.maxBid}M</span>
                  </div>
                )}
                {currentPlayerPreference.priority && (
                  <div className="bg-black/20 rounded-lg px-3 py-1.5">
                    <span className="text-[10px] text-indigo-300 uppercase mr-1">Priorita:</span>
                    <span className="text-purple-400">{'★'.repeat(currentPlayerPreference.priority)}</span>
                  </div>
                )}
                {currentPlayerPreference.notes && (
                  <div className="bg-black/20 rounded-lg px-3 py-1.5 flex-1 min-w-0">
                    <span className="text-[10px] text-indigo-300 uppercase mr-1">Note:</span>
                    <span className="text-gray-300 text-sm">{currentPlayerPreference.notes}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
