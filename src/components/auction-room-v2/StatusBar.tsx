import type { MarketProgress, Membership, MyRosterSlots } from '../../types/auctionroom.types'
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
  myRosterSlots?: MyRosterSlots | null
  onPauseAuction?: () => void
  onExit?: () => void
  isAdmin: boolean
  teamInitial?: string
  onRequestPause?: () => void
  pauseRequest?: { username: string; type: string } | null
  dismissPauseRequest?: () => void
}

function computeMaxBid(budget: number, myRosterSlots: MyRosterSlots | null | undefined): number | null {
  if (!myRosterSlots) return null
  const slots = myRosterSlots.slots
  const emptySlots = (['P', 'D', 'C', 'A'] as const).reduce(
    (sum, pos) => sum + (slots[pos].total - slots[pos].filled), 0
  )
  const monteIngaggi = (['P', 'D', 'C', 'A'] as const).reduce(
    (sum, pos) => sum + slots[pos].players.reduce((s, p) => s + (p.contract?.salary || 0), 0), 0
  )
  const bilancio = budget - monteIngaggi
  return Math.max(0, bilancio - (emptySlots * 2))
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
  myRosterSlots,
  onPauseAuction,
  onExit,
  isAdmin,
  teamInitial = 'FC',
  onRequestPause,
  pauseRequest,
  dismissPauseRequest,
}: StatusBarProps) {
  const budget = membership?.currentBudget || 0
  const maxBid = computeMaxBid(budget, myRosterSlots)

  return (
    <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap min-h-[64px]">
      {/* Team Logo Circle + Title */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-lg shadow-sky-500/20 flex-shrink-0">
          {teamInitial}
        </div>
        <div className="flex flex-col">
          <h1 className="text-sm sm:text-base font-black text-white tracking-wide leading-tight">
            ASTA LIVE <span className="hidden sm:inline">PROFESSIONAL</span>
          </h1>
          <div className="flex items-center gap-2 mt-0.5">
            {/* Connection dot */}
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isConnected ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`} />
            {!isConnected && <span className="text-sm text-yellow-400">{connectionStatus}</span>}
            {/* Turn info */}
            {currentTurnManager && (
              <span className="text-sm text-gray-400">
                {isMyTurn ? (
                  <span className="text-accent-400 font-bold">IL TUO TURNO</span>
                ) : (
                  <>Turno di: <strong className="text-smrimary-400">{currentTurnManager.username}</strong></>
                )}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Position progress pills (desktop) */}
      {isPrimoMercato && marketProgress && (
        <div className="hidden sm:flex items-center gap-1 ml-2">
          {marketProgress.roleSequence.map(role => (
            <span
              key={role}
              className={`px-1.5 py-0.5 rounded text-sm font-bold border ${
                role === marketProgress.currentRole
                  ? POSITION_FILTER_COLORS[role] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                  : 'bg-slate-800/50 text-gray-500 border-white/5'
              }`}
            >
              {(POSITION_NAMES[role] || role).slice(0, 3)}
            </span>
          ))}
          <span className="text-sm text-gray-400 ml-1 font-mono">
            {marketProgress.filledSlots}/{marketProgress.totalSlots}
          </span>
        </div>
      )}

      {/* Budget + Max Bid + Actions — pushed right */}
      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        {/* Budget */}
        <div className="flex flex-col items-end">
          <span className="text-sm text-gray-500 uppercase tracking-wider font-semibold leading-none">Budget</span>
          <span className="text-sml sm:text-2xl font-mono font-black gradient-text-gold leading-tight">{budget}</span>
        </div>

        {/* Max Bid Box */}
        {maxBid !== null && (
          <>
            <div className="w-px h-8 bg-white/10 hidden sm:block" />
            <div className="border border-sky-500/40 bg-sky-500/10 rounded-lg px-2.5 py-1.5 flex flex-col items-center">
              <span className="text-sm text-sky-300 uppercase font-semibold leading-none">Offerta Max</span>
              <span className={`text-lg font-mono font-bold leading-tight ${
                maxBid <= 10 ? 'text-red-400' : maxBid <= 50 ? 'text-amber-400' : 'text-sky-400'
              }`}>{maxBid}</span>
            </div>
          </>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5">
          {isAdmin && onPauseAuction && (
            <button
              onClick={onPauseAuction}
              className="p-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25 transition-colors"
              title="Pausa Asta"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </button>
          )}
          {!isAdmin && onRequestPause && (
            <button
              onClick={onRequestPause}
              className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400/70 hover:bg-amber-500/20 hover:text-amber-400 transition-colors"
              title="Richiedi Pausa"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </button>
          )}
          {onExit && (
            <button
              onClick={onExit}
              className="p-2 rounded-lg bg-slate-700/50 border border-white/10 text-gray-400 hover:text-white hover:bg-slate-700/80 transition-colors"
              title="Esci dalla sala"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Pause Request Notification (admin only) */}
      {isAdmin && pauseRequest && (
        <div className="mt-2 flex items-center justify-between gap-3 rounded-lg bg-amber-500/15 border border-amber-500/30 px-4 py-2 animate-pulse">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="text-sm text-amber-300 font-medium">
              <strong>{pauseRequest.username}</strong> ha richiesto una pausa
            </span>
          </div>
          <div className="flex items-center gap-2">
            {onPauseAuction && (
              <button
                onClick={() => { onPauseAuction(); dismissPauseRequest?.() }}
                className="px-3 py-1 text-sm font-bold rounded-lg bg-amber-500/30 text-amber-300 hover:bg-amber-500/50 transition-colors"
              >
                Pausa
              </button>
            )}
            <button
              onClick={dismissPauseRequest}
              className="px-2 py-1 text-sm rounded-lg text-gray-400 hover:text-white transition-colors"
            >
              Ignora
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
