/**
 * LayoutA.tsx - Split Screen Focus
 *
 * Caratteristiche:
 * - Timer GIGANTE sempre visibile in alto
 * - Area asta 60% + Sidebar info 40%
 * - Classifica budget in tempo reale
 * - Slot sempre visibili con indicatore ruolo attivo
 *
 * Creato il: 24/01/2026
 */

import { AuctionTimer } from '../AuctionTimer'
import { getTeamLogo } from '../../utils/teamLogos'
import { getPlayerPhotoUrl } from '../../utils/player-images'
import {
  AuctionLayoutProps,
  POSITION_NAMES,
  POSITION_BG,
  POSITION_COLORS
} from './types'
import { AdminControlsPanel } from './AdminControlsPanel'

export function LayoutA({
  auction,
  timeLeft,
  timerSetting,
  isTimerExpired,
  membership,
  isAdmin,
  isMyTurn,
  isUserWinning,
  currentUsername,
  managersStatus,
  currentTurnManager,
  myRosterSlots,
  marketProgress,
  bidAmount,
  setBidAmount,
  onPlaceBid,
  isConnected,
  connectionStatus,
  onSelectManager,
  onCloseAuction,
  // Nomination props
  players,
  searchQuery,
  onSearchChange,
  onNominatePlayer,
  // Admin Controls
  onUpdateTimer,
  onBotNominate,
  onBotConfirmNomination,
  onBotBid,
  onForceAllReady,
  onForceAcknowledgeAll,
  onCompleteAllSlots,
  onResetFirstMarket
}: AuctionLayoutProps) {

  // Calcola budget speso
  const getBudgetSpent = (roster: AuctionLayoutProps['managersStatus']['managers'][0]['roster']) => {
    return roster.reduce((sum, r) => sum + (r.acquisitionPrice || 0), 0)
  }

  // Ordina manager per budget
  const sortedManagersByBudget = managersStatus?.managers
    ? [...managersStatus.managers].sort((a, b) => b.currentBudget - a.currentBudget)
    : []

  // STATO: Attesa nomination
  if (!auction) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* AREA PRINCIPALE */}
        <div className="lg:col-span-3 space-y-4">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary-500/20 to-accent-500/20 rounded-xl p-4 border border-primary-500/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🎯</span>
                <div>
                  <h2 className="text-xl font-bold text-white">Layout Split Focus</h2>
                  <p className="text-sm text-gray-400">In attesa della prossima nomination</p>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs ${isConnected ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                {isConnected ? '● Live' : connectionStatus}
              </span>
            </div>
          </div>

          {/* Info turno */}
          <div className="bg-surface-200 rounded-xl p-6 border border-surface-50/20 text-center">
            <div className="text-6xl mb-4">⏳</div>
            {currentTurnManager && (
              <p className="text-lg text-gray-400">
                Turno di: <strong className="text-primary-400">{currentTurnManager.username}</strong>
              </p>
            )}
            {isMyTurn && (
              <div className="mt-3 px-4 py-2 bg-accent-500/20 rounded-lg inline-block">
                <span className="text-accent-400 font-bold">È il tuo turno!</span>
              </div>
            )}
          </div>

          {/* Lista giocatori per nomination */}
          {isMyTurn && players && onNominatePlayer && (
            <div className="bg-surface-200 rounded-xl border-2 border-primary-500/50 overflow-hidden">
              <div className="px-4 py-3 bg-primary-500/10 border-b border-primary-500/30">
                <span className="font-bold text-primary-400">🎯 Nomina un Giocatore</span>
              </div>
              <div className="p-3">
                {onSearchChange && (
                  <input
                    type="text"
                    placeholder="Cerca giocatore..."
                    value={searchQuery || ''}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="w-full px-3 py-2 mb-3 bg-surface-300 border border-surface-50/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary-500"
                  />
                )}
                <div className="max-h-[40vh] overflow-y-auto space-y-1">
                  {players.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">Nessun giocatore disponibile</p>
                  ) : players.slice(0, 30).map(player => (
                    <button
                      key={player.id}
                      onClick={() => onNominatePlayer(player.id)}
                      className="w-full flex items-center p-3 rounded-lg bg-surface-300 hover:bg-primary-500/20 border border-transparent hover:border-primary-500/30 transition-all text-left"
                    >
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white mr-3 ${POSITION_COLORS[player.position]?.split(' ')[0] || 'bg-gray-500'}`}>
                        {player.position}
                      </span>
                      <div className="flex-1">
                        <p className="font-medium text-white">{player.name}</p>
                        <p className="text-xs text-gray-400">{player.team}</p>
                      </div>
                      {player.quotation && <span className="text-sm text-gray-500">Q{player.quotation}</span>}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* SIDEBAR */}
        <div className="lg:col-span-2 space-y-4">
          {/* Budget */}
          <div className="bg-surface-200 rounded-xl p-4 border border-surface-50/20">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Il tuo Budget</p>
            <p className="text-3xl font-bold text-accent-400">{membership?.currentBudget || 0}</p>
          </div>

          {/* Classifica budget */}
          <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
            <div className="px-4 py-2 bg-surface-300/50 border-b border-surface-50/20">
              <span className="text-sm font-bold text-white">Classifica Budget</span>
            </div>
            <div className="divide-y divide-surface-50/10 max-h-64 overflow-y-auto">
              {sortedManagersByBudget.map((m, idx) => (
                <div key={m.id} className={`px-4 py-2 flex items-center justify-between ${m.id === managersStatus?.myId ? 'bg-primary-500/10' : ''}`}>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-surface-300 flex items-center justify-center text-xs text-gray-400">{idx + 1}</span>
                    <span className={`w-2 h-2 rounded-full ${m.isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="text-sm text-white">{m.username}</span>
                  </div>
                  <span className="font-bold text-accent-400">{m.currentBudget}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      {/* AREA ASTA - 60% */}
      <div className="lg:col-span-3 space-y-4">
        {/* TIMER GIGANTE */}
        <div className="bg-surface-200 rounded-2xl p-6 border border-surface-50/20">
          <AuctionTimer
            timeLeft={timeLeft}
            totalSeconds={timerSetting}
            className="w-full"
          />
        </div>

        {/* CARD GIOCATORE */}
        <div className="bg-gradient-to-br from-surface-200 to-surface-300 rounded-2xl p-6 border border-surface-50/20">
          <div className="flex items-center gap-6">
            {/* Player Photo */}
            <div className="relative flex-shrink-0">
              {auction.player.apiFootballId ? (
                <img
                  src={getPlayerPhotoUrl(auction.player.apiFootballId)}
                  alt={auction.player.name}
                  className="w-24 h-24 rounded-2xl object-cover bg-surface-300 border-2 border-surface-50/20 shadow-xl"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none'
                    const fallback = (e.target as HTMLImageElement).nextElementSibling as HTMLElement
                    if (fallback) fallback.style.display = 'flex'
                  }}
                />
              ) : null}
              <div
                className={`w-24 h-24 rounded-2xl bg-gradient-to-br ${POSITION_COLORS[auction.player.position]} items-center justify-center text-white font-bold text-3xl shadow-xl ${auction.player.apiFootballId ? 'hidden' : 'flex'}`}
              >
                {auction.player.position}
              </div>
              {/* Team logo badge */}
              <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-white rounded-xl flex items-center justify-center p-1 shadow-lg border border-surface-50/20">
                <img
                  src={getTeamLogo(auction.player.team)}
                  alt={auction.player.team}
                  className="w-full h-full object-contain"
                />
              </div>
            </div>

            {/* Info giocatore */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${POSITION_BG[auction.player.position]}`}>
                  {POSITION_NAMES[auction.player.position]}
                </span>
                {auction.player.quotation && (
                  <span className="text-accent-400 font-bold">Q: {auction.player.quotation}</span>
                )}
              </div>
              <h2 className="text-3xl font-black text-white mb-1">{auction.player.name}</h2>
              <p className="text-gray-400">{auction.player.team}</p>
            </div>
          </div>
        </div>

        {/* OFFERTA CORRENTE */}
        <div className="bg-gradient-to-r from-primary-900/50 to-primary-800/50 rounded-2xl p-6 border-2 border-primary-500/30">
          <div className="text-center">
            <p className="text-primary-400 text-sm uppercase tracking-wider mb-2">Offerta Corrente</p>
            <p className="text-7xl font-black text-white mb-2">{auction.currentPrice}</p>
            {auction.bids.length > 0 && auction.bids[0] && (
              <p className={`text-lg ${auction.bids[0].bidder.user.username === currentUsername ? 'text-green-400 font-bold' : 'text-gray-400'}`}>
                di {auction.bids[0].bidder.user.username}
                {auction.bids[0].bidder.user.username === currentUsername && ' (TU!)'}
              </p>
            )}
          </div>
        </div>

        {/* CONTROLLI OFFERTA */}
        <div className="bg-surface-200 rounded-2xl p-4 border border-surface-50/20">
          {/* Preset intelligenti */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            {[1, 5, 10, 0].map((increment, i) => {
              const value = increment === 0
                ? membership?.currentBudget || 0
                : auction.currentPrice + increment
              const label = increment === 0 ? 'MAX' : `${value}`
              const disabled = isTimerExpired || (membership?.currentBudget || 0) < value

              return (
                <button
                  key={i}
                  onClick={() => setBidAmount(String(value))}
                  disabled={disabled}
                  className={`py-3 rounded-xl font-bold text-lg transition-all ${
                    disabled
                      ? 'bg-surface-400/50 text-gray-600 cursor-not-allowed'
                      : increment === 0
                        ? 'bg-accent-500 text-dark-900 hover:bg-accent-400'
                        : 'bg-primary-500/20 text-primary-400 border border-primary-500/30 hover:bg-primary-500/30'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {/* Input e pulsante */}
          <div className="flex gap-3">
            <div className="flex-1 flex items-center gap-2 bg-surface-300 rounded-xl px-4">
              <button
                onClick={() => setBidAmount(String(Math.max(auction.currentPrice + 1, parseInt(bidAmount || '0') - 1)))}
                disabled={isTimerExpired}
                className="w-10 h-10 flex items-center justify-center text-2xl text-white hover:text-primary-400 disabled:text-gray-600"
              >
                −
              </button>
              <input
                type="number"
                value={bidAmount}
                onChange={e => setBidAmount(e.target.value)}
                disabled={isTimerExpired}
                className="flex-1 bg-transparent text-center text-2xl font-bold text-white py-3 outline-none"
                placeholder="..."
              />
              <button
                onClick={() => setBidAmount(String(parseInt(bidAmount || '0') + 1))}
                disabled={isTimerExpired}
                className="w-10 h-10 flex items-center justify-center text-2xl text-white hover:text-primary-400 disabled:text-gray-600"
              >
                +
              </button>
            </div>
            <button
              onClick={onPlaceBid}
              disabled={isTimerExpired || !membership || (membership.currentBudget < (parseInt(bidAmount) || 0))}
              className={`px-8 py-4 rounded-xl font-black text-xl transition-all ${
                isTimerExpired
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-primary-500 to-primary-600 text-white hover:from-primary-400 hover:to-primary-500 shadow-lg shadow-primary-500/30'
              }`}
            >
              {isTimerExpired ? 'SCADUTO' : '🔨 OFFRI!'}
            </button>
          </div>

          {/* Budget reminder */}
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-gray-500">Il tuo budget:</span>
            <span className="font-bold text-accent-400">{membership?.currentBudget || 0}</span>
          </div>
        </div>
      </div>

      {/* SIDEBAR - 40% */}
      <div className="lg:col-span-2 space-y-4">
        {/* CLASSIFICA BUDGET */}
        <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
          <div className="p-3 border-b border-surface-50/20 bg-gradient-to-r from-accent-500/10 to-transparent">
            <h3 className="font-bold text-white flex items-center gap-2">
              <span>📊</span> Classifica Budget
            </h3>
          </div>
          <div className="divide-y divide-surface-50/10">
            {sortedManagersByBudget.map((m, index) => {
              const isMe = m.id === managersStatus?.myId
              const isWinning = auction.bids[0]?.bidder.user.username === m.username
              const budgetSpent = getBudgetSpent(m.roster)

              return (
                <div
                  key={m.id}
                  className={`px-3 py-2 flex items-center gap-3 ${isMe ? 'bg-primary-500/10' : ''}`}
                >
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    index === 0 ? 'bg-yellow-500 text-dark-900' :
                    index === 1 ? 'bg-gray-400 text-dark-900' :
                    index === 2 ? 'bg-amber-700 text-white' :
                    'bg-surface-300 text-gray-400'
                  }`}>
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`truncate ${isMe ? 'text-primary-400 font-bold' : 'text-gray-200'}`}>
                        {m.username}
                      </span>
                      {isMe && <span className="text-xs text-primary-300">◀</span>}
                      {isWinning && <span className="text-xs text-green-400">🏆</span>}
                    </div>
                    <div className="text-xs text-gray-500">
                      Speso: {budgetSpent}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`font-mono font-bold ${
                      m.currentBudget > 300 ? 'text-green-400' :
                      m.currentBudget > 100 ? 'text-yellow-400' :
                      'text-red-400'
                    }`}>
                      {m.currentBudget}
                    </span>
                    <span
                      className={`ml-1 w-2 h-2 rounded-full inline-block ${
                        m.isConnected ? 'bg-green-500' : 'bg-red-500'
                      }`}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* I TUOI SLOT */}
        <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
          <div className="p-3 border-b border-surface-50/20">
            <h3 className="font-bold text-white flex items-center gap-2">
              <span>📋</span> I Tuoi Slot
            </h3>
          </div>
          <div className="p-3">
            <div className="grid grid-cols-4 gap-2">
              {myRosterSlots && (['P', 'D', 'C', 'A'] as const).map(pos => {
                const slot = myRosterSlots.slots[pos]
                const isCurrent = myRosterSlots.currentRole === pos
                const isComplete = slot.filled >= slot.total

                return (
                  <div
                    key={pos}
                    className={`p-3 rounded-xl text-center ${
                      isCurrent ? 'bg-primary-500/20 border-2 border-primary-500' :
                      isComplete ? 'bg-green-500/10 border border-green-500/30' :
                      'bg-surface-300'
                    }`}
                  >
                    <div className={`w-8 h-8 mx-auto rounded-full bg-gradient-to-br ${POSITION_COLORS[pos]} flex items-center justify-center text-white font-bold text-sm mb-1`}>
                      {pos}
                    </div>
                    <div className={`font-bold ${isComplete ? 'text-green-400' : 'text-white'}`}>
                      {slot.filled}/{slot.total}
                    </div>
                    {isCurrent && <div className="text-[10px] text-primary-400 mt-1">ATTIVO</div>}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* STORICO OFFERTE COMPATTO */}
        {auction.bids.length > 0 && (
          <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
            <div className="p-3 border-b border-surface-50/20">
              <h3 className="font-bold text-white flex items-center gap-2">
                <span>📜</span> Ultime Offerte
              </h3>
            </div>
            <div className="max-h-40 overflow-y-auto">
              {auction.bids.slice(0, 5).map((bid, index) => (
                <div
                  key={bid.id}
                  className={`px-3 py-2 flex items-center justify-between text-sm ${
                    index === 0 ? 'bg-primary-500/10' : ''
                  }`}
                >
                  <span className={index === 0 ? 'text-primary-400 font-bold' : 'text-gray-400'}>
                    {bid.bidder.user.username}
                  </span>
                  <span className={`font-mono font-bold ${index === 0 ? 'text-white' : 'text-gray-500'}`}>
                    {bid.amount}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Admin Controls Panel */}
      {isAdmin && (
        <div className="mt-4">
          <AdminControlsPanel
            isAdmin={isAdmin}
            timerSetting={timerSetting}
            hasAuction={!!auction}
            onUpdateTimer={onUpdateTimer}
            onBotNominate={onBotNominate}
            onBotConfirmNomination={onBotConfirmNomination}
            onBotBid={onBotBid}
            onForceAllReady={onForceAllReady}
            onForceAcknowledgeAll={onForceAcknowledgeAll}
            onCompleteAllSlots={onCompleteAllSlots}
            onResetFirstMarket={onResetFirstMarket}
          />
        </div>
      )}
    </div>
  )
}

export default LayoutA
