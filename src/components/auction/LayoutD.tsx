/**
 * LayoutD.tsx - Best Mix
 *
 * Combinazione delle migliori caratteristiche di tutti i layout:
 * - Da A: Timer prominente, classifica budget
 * - Da B: Barra stato compatta, UI mobile-friendly
 * - Da C: Storico offerte real-time, indicatori chi sta vincendo
 *
 * Caratteristiche uniche:
 * - Timer circolare GRANDE sempre visibile
 * - Prezzo e controlli offerta ottimizzati
 * - Panel manager con indicatori live
 * - Responsive design mobile-first
 *
 * Creato il: 24/01/2026
 */

import { useState } from 'react'
import { AuctionTimer } from '../AuctionTimer'
import { getTeamLogo } from '../../utils/teamLogos'
import { getPlayerPhotoUrl } from '../../utils/player-images'
import {
  AuctionLayoutProps,
  POSITION_NAMES,
  POSITION_BG,
  POSITION_COLORS,
  ManagerData
} from './types'
import { AdminControlsPanel } from './AdminControlsPanel'

export function LayoutD({
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

  const [showManagers, setShowManagers] = useState(false)

  // Calcola budget speso
  const getBudgetSpent = (roster: ManagerData['roster']) => {
    return roster.reduce((sum, r) => sum + (r.acquisitionPrice || 0), 0)
  }

  const winningBidder = auction?.bids[0]?.bidder.user.username
  const currentSlot = myRosterSlots?.currentRole || 'P'

  // Ordina manager per budget per la mini-classifica
  const topManagers = managersStatus?.managers
    ? [...managersStatus.managers]
        .sort((a, b) => b.currentBudget - a.currentBudget)
        .slice(0, 3)
    : []

  // STATO: Attesa nomination
  if (!auction) {
    return (
      <div className="space-y-4">
        {/* Header Best Mix */}
        <div className="bg-gradient-to-r from-surface-200 via-accent-500/10 to-surface-200 rounded-xl p-4 border border-surface-50/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⭐</span>
              <div>
                <span className="font-bold text-white">Best Mix</span>
                <span className="text-sm text-gray-400 ml-2">In attesa nomination</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xl font-bold text-accent-400">{membership?.currentBudget || 0}</span>
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-yellow-500'}`} />
            </div>
          </div>
        </div>

        {/* Main area */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Attesa */}
          <div className="bg-surface-200 rounded-xl border border-surface-50/20 p-8 text-center">
            <div className="relative inline-block mb-4">
              <div className="w-24 h-24 rounded-full border-4 border-surface-50/20 flex items-center justify-center">
                <span className="text-5xl animate-bounce">⏳</span>
              </div>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">In Attesa</h2>
            {currentTurnManager && (
              <p className="text-gray-400">Turno di <strong className="text-primary-400">{currentTurnManager.username}</strong></p>
            )}
            {isMyTurn && (
              <div className="mt-4 px-6 py-2 bg-accent-500 text-dark-900 rounded-lg inline-block font-bold">
                È il tuo turno!
              </div>
            )}
          </div>

          {/* Mini classifica */}
          <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
            <div className="px-4 py-2 bg-surface-300/50 border-b border-surface-50/20">
              <span className="font-bold text-white">🏆 Top Budget</span>
            </div>
            <div className="divide-y divide-surface-50/10">
              {topManagers.map((m, idx) => (
                <div key={m.id} className={`px-4 py-3 flex items-center justify-between ${m.id === managersStatus?.myId ? 'bg-primary-500/10' : ''}`}>
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center text-xs font-bold text-white">
                      {idx + 1}
                    </span>
                    <span className={`w-2 h-2 rounded-full ${m.isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="text-white">{m.username}</span>
                  </div>
                  <span className="font-bold text-accent-400">{m.currentBudget}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Lista giocatori */}
        {isMyTurn && players && onNominatePlayer && (
          <div className="bg-surface-200 rounded-xl border-2 border-primary-500/50 overflow-hidden">
            <div className="px-4 py-3 bg-primary-500/10 flex items-center justify-between">
              <span className="font-bold text-primary-400">🎯 Nomina un Giocatore</span>
              {onSearchChange && (
                <input
                  type="text"
                  placeholder="Cerca giocatore..."
                  value={searchQuery || ''}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="px-3 py-1 bg-surface-300 border border-surface-50/30 rounded-lg text-white placeholder-gray-500 w-56"
                />
              )}
            </div>
            <div className="p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[45vh] overflow-y-auto">
              {players.slice(0, 30).map(player => (
                <button
                  key={player.id}
                  onClick={() => onNominatePlayer(player.id)}
                  className="flex items-center p-3 rounded-lg bg-surface-300 hover:bg-primary-500/20 border border-transparent hover:border-primary-500/30 transition-all text-left"
                >
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white mr-3 ${POSITION_COLORS[player.position]?.split(' ')[0] || 'bg-gray-500'}`}>
                    {player.position}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white truncate">{player.name}</p>
                    <p className="text-xs text-gray-400 truncate">{player.team}</p>
                  </div>
                  {player.quotation && <span className="text-sm text-gray-500">Q{player.quotation}</span>}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* === HERO SECTION: Timer + Giocatore + Prezzo === */}
      <div className="bg-gradient-to-br from-surface-200 via-surface-300 to-surface-200 rounded-2xl border border-surface-50/20 overflow-hidden">
        {/* Top bar con info rapide */}
        <div className="px-4 py-2 bg-surface-400/30 border-b border-surface-50/20 flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <span className={`px-2 py-1 rounded font-bold ${isConnected ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
              {isConnected ? '🟢 Live' : '🟡 ' + connectionStatus}
            </span>
            {isMyTurn && (
              <span className="px-3 py-1 bg-accent-500 text-dark-900 rounded-full font-bold animate-pulse">
                🎯 TUO TURNO!
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-400">Budget:</span>
            <span className="font-mono font-bold text-accent-400 text-lg">{membership?.currentBudget || 0}</span>
          </div>
        </div>

        {/* Main content */}
        <div className="p-4 lg:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* TIMER */}
            <div className="lg:col-span-1 flex items-center justify-center">
              <AuctionTimer
                timeLeft={timeLeft}
                totalSeconds={timerSetting}
                className="w-full max-w-[200px]"
              />
            </div>

            {/* GIOCATORE + PREZZO */}
            <div className="lg:col-span-2">
              <div className="flex flex-col lg:flex-row items-center gap-4 lg:gap-6">
                {/* Logo squadra */}
                <div className="w-24 h-24 lg:w-28 lg:h-28 bg-white rounded-2xl flex items-center justify-center p-3 shadow-xl flex-shrink-0">
                  <img
                    src={getTeamLogo(auction.player.team)}
                    alt={auction.player.team}
                    className="w-full h-full object-contain"
                  />
                </div>

                {/* Info giocatore */}
                <div className="flex-1 text-center lg:text-left">
                  <div className="flex items-center justify-center lg:justify-start gap-2 mb-1">
                    <span className={`px-3 py-1 rounded-full text-sm font-bold ${POSITION_BG[auction.player.position]}`}>
                      {POSITION_NAMES[auction.player.position]}
                    </span>
                    {auction.player.quotation && (
                      <span className="text-accent-400 text-sm font-bold">Q:{auction.player.quotation}</span>
                    )}
                  </div>
                  <h1 className="text-2xl lg:text-3xl font-black text-white">{auction.player.name}</h1>
                  <p className="text-gray-400">{auction.player.team}</p>
                </div>

                {/* Prezzo corrente - BIG */}
                <div className="bg-gradient-to-br from-primary-500/20 to-primary-600/10 rounded-xl p-4 lg:p-6 border border-primary-500/30 text-center min-w-[160px]">
                  <p className="text-xs text-primary-400 uppercase tracking-wider mb-1">Offerta</p>
                  <p className="text-5xl lg:text-6xl font-black text-white">{auction.currentPrice}</p>
                  {winningBidder && (
                    <p className={`text-sm mt-1 ${winningBidder === currentUsername ? 'text-green-400 font-bold' : 'text-gray-400'}`}>
                      {winningBidder === currentUsername ? '🏆 Stai vincendo!' : `di ${winningBidder}`}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* === CONTROLLI OFFERTA === */}
      <div className="bg-surface-200 rounded-xl border border-surface-50/20 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Quick buttons */}
          <div className="flex gap-2 lg:gap-3">
            {[1, 5, 10, 20].map(inc => {
              const value = auction.currentPrice + inc
              const canAfford = (membership?.currentBudget || 0) >= value
              return (
                <button
                  key={inc}
                  onClick={() => setBidAmount(String(value))}
                  disabled={isTimerExpired || !canAfford}
                  className={`flex-1 lg:flex-none lg:w-16 py-3 rounded-xl font-bold transition-all ${
                    canAfford && !isTimerExpired
                      ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30 hover:bg-primary-500/30'
                      : 'bg-surface-400/50 text-gray-600 cursor-not-allowed'
                  }`}
                >
                  +{inc}
                </button>
              )
            })}
            <button
              onClick={() => setBidAmount(String(membership?.currentBudget || 0))}
              disabled={isTimerExpired}
              className="flex-1 lg:flex-none lg:w-20 py-3 rounded-xl font-bold bg-accent-500 text-dark-900 disabled:opacity-50"
            >
              MAX
            </button>
          </div>

          {/* Input + Submit */}
          <div className="flex-1 flex gap-2">
            <div className="flex-1 flex items-center bg-surface-300 rounded-xl overflow-hidden">
              <button
                onClick={() => setBidAmount(String(Math.max(auction.currentPrice + 1, parseInt(bidAmount || '0') - 1)))}
                disabled={isTimerExpired}
                className="w-12 h-full text-white text-xl font-bold hover:bg-surface-200 transition-colors"
              >
                −
              </button>
              <input
                type="number"
                inputMode="decimal"
                value={bidAmount}
                onChange={e => setBidAmount(e.target.value)}
                disabled={isTimerExpired}
                className="flex-1 bg-transparent text-center text-2xl font-bold text-white py-3 outline-none"
                placeholder="..."
              />
              <button
                onClick={() => setBidAmount(String(parseInt(bidAmount || '0') + 1))}
                disabled={isTimerExpired}
                className="w-12 h-full text-white text-xl font-bold hover:bg-surface-200 transition-colors"
              >
                +
              </button>
            </div>
            <button
              onClick={onPlaceBid}
              disabled={isTimerExpired || !membership || (membership.currentBudget < (parseInt(bidAmount) || 0))}
              className={`px-8 lg:px-12 py-3 rounded-xl font-black text-xl transition-all ${
                isTimerExpired
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-primary-500 to-primary-600 text-white hover:from-primary-400 hover:to-primary-500 shadow-lg shadow-primary-500/30 active:scale-95'
              }`}
            >
              {isTimerExpired ? '⏱️ SCADUTO' : '🔨 OFFRI!'}
            </button>
          </div>
        </div>
      </div>

      {/* === GRID INFERIORE === */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* STORICO OFFERTE */}
        <div className="lg:col-span-1 bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
          <div className="p-3 border-b border-surface-50/20">
            <h3 className="font-bold text-white text-sm">📜 Ultime Offerte</h3>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {auction.bids.slice(0, 8).map((bid, index) => {
              const isMe = bid.bidder.user.username === currentUsername
              const prevBid = auction.bids[index + 1]
              const increment = prevBid ? bid.amount - prevBid.amount : bid.amount - auction.basePrice

              return (
                <div
                  key={bid.id}
                  className={`px-3 py-2 flex items-center justify-between border-b border-surface-50/10 last:border-0 ${
                    index === 0 ? 'bg-primary-500/10' : ''
                  }`}
                >
                  <span className={`text-sm ${isMe ? 'text-primary-400 font-bold' : index === 0 ? 'text-white' : 'text-gray-400'}`}>
                    {bid.bidder.user.username}
                    {isMe && ' ◀'}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-green-400">+{increment}</span>
                    <span className="font-mono font-bold text-white">{bid.amount}</span>
                  </div>
                </div>
              )
            })}
            {auction.bids.length === 0 && (
              <div className="p-4 text-center text-gray-500 text-sm">
                Nessuna offerta - Base: {auction.basePrice}
              </div>
            )}
          </div>
        </div>

        {/* I MIEI SLOT */}
        <div className="lg:col-span-1 bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
          <div className="p-3 border-b border-surface-50/20">
            <h3 className="font-bold text-white text-sm">📋 I Miei Slot</h3>
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
                    className={`p-2 rounded-lg text-center transition-all ${
                      isCurrent ? 'bg-primary-500/20 ring-2 ring-primary-500 scale-105' :
                      isComplete ? 'bg-green-500/10' :
                      'bg-surface-300'
                    }`}
                  >
                    <div className={`w-6 h-6 mx-auto rounded-full bg-gradient-to-br ${POSITION_COLORS[pos]} flex items-center justify-center text-white font-bold text-xs mb-1`}>
                      {pos}
                    </div>
                    <div className={`font-bold text-sm ${isComplete ? 'text-green-400' : 'text-white'}`}>
                      {slot.filled}/{slot.total}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Progress totale */}
            {myRosterSlots && (
              <div className="mt-3 pt-3 border-t border-surface-50/20">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Rosa completa</span>
                  <span>
                    {Object.values(myRosterSlots.slots).reduce((s, slot) => s + slot.filled, 0)}/
                    {Object.values(myRosterSlots.slots).reduce((s, slot) => s + slot.total, 0)}
                  </span>
                </div>
                <div className="h-2 bg-surface-400 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary-500 to-accent-500 transition-all"
                    style={{
                      width: `${(Object.values(myRosterSlots.slots).reduce((s, slot) => s + slot.filled, 0) /
                        Object.values(myRosterSlots.slots).reduce((s, slot) => s + slot.total, 0)) * 100}%`
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* TOP BUDGET + MANAGER TOGGLE */}
        <div className="lg:col-span-1 bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
          <button
            onClick={() => setShowManagers(!showManagers)}
            className="w-full p-3 border-b border-surface-50/20 flex items-center justify-between hover:bg-surface-300/50 transition-colors"
          >
            <h3 className="font-bold text-white text-sm">📊 Manager ({managersStatus?.managers.length || 0})</h3>
            <span className={`transform transition-transform ${showManagers ? 'rotate-180' : ''}`}>▼</span>
          </button>

          {!showManagers ? (
            /* Mini classifica top 3 */
            <div className="p-3">
              <div className="space-y-2">
                {topManagers.map((m, index) => {
                  const isMe = m.id === managersStatus?.myId
                  const isWinning = winningBidder === m.username

                  return (
                    <div
                      key={m.id}
                      className={`flex items-center gap-2 p-2 rounded-lg ${
                        isWinning ? 'bg-green-500/10' : isMe ? 'bg-primary-500/10' : 'bg-surface-300/50'
                      }`}
                    >
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                        index === 0 ? 'bg-yellow-500 text-dark-900' :
                        index === 1 ? 'bg-gray-400 text-dark-900' :
                        'bg-amber-700 text-white'
                      }`}>
                        {index + 1}
                      </span>
                      <span className={`flex-1 truncate text-sm ${isMe ? 'text-primary-400 font-bold' : 'text-gray-300'}`}>
                        {m.username}
                      </span>
                      {isWinning && <span className="text-green-400 text-xs">🏆</span>}
                      <span className="font-mono font-bold text-accent-400">{m.currentBudget}</span>
                    </div>
                  )
                })}
              </div>
              <p className="text-xs text-gray-500 text-center mt-2">Tap per vedere tutti</p>
            </div>
          ) : (
            /* Lista completa manager */
            <div className="max-h-48 overflow-y-auto">
              {managersStatus?.managers.map(m => {
                const isMe = m.id === managersStatus.myId
                const isWinning = winningBidder === m.username
                const budgetSpent = getBudgetSpent(m.roster)

                return (
                  <button
                    key={m.id}
                    onClick={() => onSelectManager(m)}
                    className={`w-full px-3 py-2 text-left border-b border-surface-50/10 last:border-0 hover:bg-surface-300/50 ${
                      isWinning ? 'bg-green-500/10' :
                      m.isCurrentTurn ? 'bg-accent-500/10' :
                      isMe ? 'bg-primary-500/5' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isWinning && <span className="text-green-400">▸</span>}
                        {m.isCurrentTurn && !isWinning && <span className="text-accent-400">◆</span>}
                        <span className={`text-sm ${
                          isMe ? 'text-primary-400 font-bold' :
                          isWinning ? 'text-green-400' :
                          'text-gray-300'
                        }`}>
                          {m.username}
                        </span>
                        <span className={`w-1.5 h-1.5 rounded-full ${m.isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                      </div>
                      <span className="font-mono font-bold text-accent-400">{m.currentBudget}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                      <span>Speso: {budgetSpent}</span>
                      <span>•</span>
                      <span>Slot: {m.slotsFilled}/{m.totalSlots}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
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

export default LayoutD
