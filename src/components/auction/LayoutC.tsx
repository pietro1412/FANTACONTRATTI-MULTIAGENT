/**
 * LayoutC.tsx - Dashboard Real-Time
 *
 * Caratteristiche:
 * - Header con progress bar timer sempre visibile
 * - Pannello offerta fisso a sinistra
 * - Arena centrale con giocatore + storico offerte
 * - Manager sidebar con indicatore chi sta vincendo
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
  POSITION_COLORS,
  ManagerData
} from './types'
import { AdminControlsPanel } from './AdminControlsPanel'

export function LayoutC({
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
  const getBudgetSpent = (roster: ManagerData['roster']) => {
    return roster.reduce((sum, r) => sum + (r.acquisitionPrice || 0), 0)
  }

  const winningBidder = auction?.bids[0]?.bidder.user.username

  // STATO: Attesa nomination
  if (!auction) {
    return (
      <div className="space-y-4">
        {/* Header Dashboard */}
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-surface-200 rounded-lg p-3 border border-surface-50/20">
            <p className="text-xs text-gray-500 uppercase">Layout</p>
            <p className="text-lg font-bold text-white">📊 Dashboard</p>
          </div>
          <div className="bg-surface-200 rounded-lg p-3 border border-surface-50/20">
            <p className="text-xs text-gray-500 uppercase">Budget</p>
            <p className="text-lg font-bold text-accent-400">{membership?.currentBudget || 0}</p>
          </div>
          <div className="bg-surface-200 rounded-lg p-3 border border-surface-50/20">
            <p className="text-xs text-gray-500 uppercase">Stato</p>
            <p className={`text-lg font-bold ${isConnected ? 'text-green-400' : 'text-yellow-400'}`}>
              {isConnected ? '● Live' : 'Connecting'}
            </p>
          </div>
          <div className="bg-surface-200 rounded-lg p-3 border border-surface-50/20">
            <p className="text-xs text-gray-500 uppercase">Turno</p>
            <p className="text-lg font-bold text-primary-400">{currentTurnManager?.username || '-'}</p>
          </div>
        </div>

        {/* Main content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Centro - Stato attesa */}
          <div className="lg:col-span-2 bg-surface-200 rounded-lg border border-surface-50/20 p-8 text-center">
            <div className="text-6xl mb-4">⏳</div>
            <h2 className="text-xl font-bold text-white mb-2">In Attesa Nomination</h2>
            {isMyTurn && (
              <div className="mt-4 px-6 py-3 bg-accent-500 text-dark-900 rounded-lg inline-block font-bold">
                È il tuo turno - Nomina un giocatore!
              </div>
            )}
          </div>

          {/* Sidebar - Manager */}
          <div className="bg-surface-200 rounded-lg border border-surface-50/20 overflow-hidden">
            <div className="px-3 py-2 bg-surface-300/50 border-b border-surface-50/20">
              <span className="text-sm font-bold text-white">Manager ({managersStatus?.managers?.length || 0})</span>
            </div>
            <div className="divide-y divide-surface-50/10 max-h-48 overflow-y-auto">
              {managersStatus?.managers?.map(m => (
                <div key={m.id} className={`px-3 py-2 flex items-center justify-between text-sm ${m.isCurrentTurn ? 'bg-accent-500/10' : ''}`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${m.isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="text-white">{m.username}</span>
                  </div>
                  <span className="text-accent-400 font-mono">{m.currentBudget}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Lista giocatori */}
        {isMyTurn && players && onNominatePlayer && (
          <div className="bg-surface-200 rounded-lg border-2 border-primary-500/50 overflow-hidden">
            <div className="px-4 py-3 bg-primary-500/10 flex items-center justify-between">
              <span className="font-bold text-primary-400">🎯 Nomina un Giocatore</span>
              {onSearchChange && (
                <input
                  type="text"
                  placeholder="Cerca..."
                  value={searchQuery || ''}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="px-3 py-1 bg-surface-300 border border-surface-50/30 rounded text-sm text-white placeholder-gray-500 w-48"
                />
              )}
            </div>
            <div className="p-2 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-[40vh] overflow-y-auto">
              {players.slice(0, 24).map(player => (
                <button
                  key={player.id}
                  onClick={() => onNominatePlayer(player.id)}
                  className="flex items-center p-2 rounded bg-surface-300 hover:bg-primary-500/20 transition-all text-left"
                >
                  <span className={`w-6 h-6 rounded text-[10px] font-bold text-white flex items-center justify-center mr-2 ${POSITION_COLORS[player.position]?.split(' ')[0] || 'bg-gray-500'}`}>
                    {player.position}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{player.name}</p>
                    <p className="text-xs text-gray-500 truncate">{player.team}</p>
                  </div>
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
      {/* HEADER BAR CON TIMER */}
      <div className="bg-gradient-to-r from-surface-200 via-primary-900/30 to-surface-200 rounded-xl p-4 border border-primary-500/30">
        <div className="flex items-center justify-between gap-4">
          {/* Info Asta */}
          <div className="flex items-center gap-4">
            <span className="text-2xl">🔨</span>
            <div>
              <h2 className="font-bold text-white">ASTA ATTIVA</h2>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-400">{auction.player.name}</span>
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${POSITION_BG[auction.player.position]}`}>
                  {auction.player.position}
                </span>
              </div>
            </div>
          </div>

          {/* Timer con progress */}
          <div className="flex items-center gap-4">
            <div className="hidden lg:block w-48">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Tempo</span>
                <span>{timeLeft}s / {timerSetting}s</span>
              </div>
              <div className="h-3 bg-surface-400 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    (timeLeft || 0) <= 5 ? 'bg-red-500' :
                    (timeLeft || 0) <= 10 ? 'bg-yellow-500' :
                    'bg-green-500'
                  }`}
                  style={{ width: `${((timeLeft || 0) / timerSetting) * 100}%` }}
                />
              </div>
            </div>
            <AuctionTimer
              timeLeft={timeLeft}
              totalSeconds={timerSetting}
              compact={true}
            />
          </div>

          {/* Budget personale */}
          <div className="text-right">
            <p className="text-xs text-gray-400">Il tuo budget</p>
            <p className="text-2xl font-bold text-accent-400">{membership?.currentBudget || 0}</p>
          </div>
        </div>
      </div>

      {/* MAIN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* PANNELLO OFFERTA FISSO */}
        <div className="lg:col-span-3">
          <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden sticky top-4">
            <div className="p-3 border-b border-surface-50/20 bg-gradient-to-r from-primary-500/20 to-transparent">
              <h3 className="font-bold text-white">💰 Offerta Rapida</h3>
            </div>
            <div className="p-4 space-y-4">
              {/* Prezzo attuale */}
              <div className="text-center p-4 bg-surface-300 rounded-xl">
                <p className="text-xs text-gray-400 uppercase">Prezzo Attuale</p>
                <p className="text-4xl font-black text-white">{auction.currentPrice}</p>
                {winningBidder && (
                  <p className={`text-sm mt-1 ${winningBidder === currentUsername ? 'text-green-400' : 'text-gray-400'}`}>
                    {winningBidder === currentUsername ? '🏆 Stai vincendo' : `di ${winningBidder}`}
                  </p>
                )}
              </div>

              {/* La tua offerta */}
              <div>
                <p className="text-xs text-gray-400 uppercase mb-2">La Tua Offerta</p>
                <div className="flex items-center gap-2 bg-surface-300 rounded-xl p-2">
                  <button
                    onClick={() => setBidAmount(String(Math.max(auction.currentPrice + 1, parseInt(bidAmount || '0') - 1)))}
                    className="w-10 h-10 rounded-lg bg-surface-400 text-white text-xl font-bold hover:bg-surface-200"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    value={bidAmount}
                    onChange={e => setBidAmount(e.target.value)}
                    className="flex-1 bg-transparent text-center text-2xl font-bold text-white outline-none"
                  />
                  <button
                    onClick={() => setBidAmount(String(parseInt(bidAmount || '0') + 1))}
                    className="w-10 h-10 rounded-lg bg-surface-400 text-white text-xl font-bold hover:bg-surface-200"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Quick buttons */}
              <div className="grid grid-cols-4 gap-1">
                {[1, 5, 10, 0].map((inc, i) => {
                  const value = inc === 0 ? membership?.currentBudget || 0 : auction.currentPrice + inc
                  return (
                    <button
                      key={i}
                      onClick={() => setBidAmount(String(value))}
                      disabled={isTimerExpired || (membership?.currentBudget || 0) < value}
                      className={`py-2 rounded-lg text-sm font-bold ${
                        inc === 0
                          ? 'bg-accent-500 text-dark-900'
                          : 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                      } disabled:opacity-50`}
                    >
                      {inc === 0 ? 'MAX' : `+${inc}`}
                    </button>
                  )
                })}
              </div>

              {/* Pulsante OFFRI */}
              <button
                onClick={onPlaceBid}
                disabled={isTimerExpired || !membership || (membership.currentBudget < (parseInt(bidAmount) || 0))}
                className={`w-full py-4 rounded-xl font-black text-xl transition-all ${
                  isTimerExpired
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-primary-500 to-primary-600 text-white hover:from-primary-400 hover:to-primary-500 shadow-lg shadow-primary-500/30'
                }`}
              >
                {isTimerExpired ? '⏱️ SCADUTO' : '🔨 OFFRI!'}
              </button>

              {/* I tuoi slot */}
              <div className="pt-4 border-t border-surface-50/20">
                <p className="text-xs text-gray-400 uppercase mb-2">I Tuoi Slot</p>
                <div className="grid grid-cols-4 gap-1">
                  {myRosterSlots && (['P', 'D', 'C', 'A'] as const).map(pos => {
                    const slot = myRosterSlots.slots[pos]
                    const isCurrent = myRosterSlots.currentRole === pos
                    return (
                      <div
                        key={pos}
                        className={`p-2 rounded-lg text-center ${
                          isCurrent ? 'bg-primary-500/20 ring-1 ring-primary-500' : 'bg-surface-300'
                        }`}
                      >
                        <div className={`text-xs font-bold ${
                          slot.filled >= slot.total ? 'text-green-400' : 'text-gray-400'
                        }`}>
                          {pos}
                        </div>
                        <div className="text-white font-bold">{slot.filled}/{slot.total}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ARENA CENTRALE */}
        <div className="lg:col-span-6 space-y-4">
          {/* Card Giocatore */}
          <div className="bg-gradient-to-br from-surface-200 to-surface-300 rounded-2xl p-6 border border-surface-50/20">
            <div className="flex items-center gap-6">
              <div className="w-28 h-28 bg-white rounded-2xl flex items-center justify-center p-3 shadow-2xl">
                <img
                  src={getTeamLogo(auction.player.team)}
                  alt={auction.player.team}
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`px-4 py-1 rounded-full font-bold ${POSITION_BG[auction.player.position]}`}>
                    {POSITION_NAMES[auction.player.position]}
                  </span>
                  {auction.player.quotation && (
                    <span className="px-3 py-1 bg-accent-500/20 text-accent-400 rounded-full font-bold">
                      Q: {auction.player.quotation}
                    </span>
                  )}
                </div>
                <h1 className="text-4xl font-black text-white mb-1">{auction.player.name}</h1>
                <p className="text-xl text-gray-400">{auction.player.team}</p>
              </div>
            </div>
          </div>

          {/* Storico Offerte */}
          <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
            <div className="p-3 border-b border-surface-50/20 flex items-center justify-between">
              <h3 className="font-bold text-white flex items-center gap-2">
                <span>📊</span> Storico Offerte
              </h3>
              <span className="text-sm text-gray-400">{auction.bids.length} offerte</span>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {auction.bids.length > 0 ? (
                <table className="w-full">
                  <thead className="bg-surface-300/50 sticky top-0">
                    <tr className="text-xs text-gray-400 uppercase">
                      <th className="px-4 py-2 text-left">Ora</th>
                      <th className="px-4 py-2 text-left">Manager</th>
                      <th className="px-4 py-2 text-right">Offerta</th>
                      <th className="px-4 py-2 text-right">+</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auction.bids.map((bid, index) => {
                      const prevBid = auction.bids[index + 1]
                      const increment = prevBid ? bid.amount - prevBid.amount : bid.amount - auction.basePrice
                      const time = new Date(bid.placedAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                      const isWinner = index === 0
                      const isMe = bid.bidder.user.username === currentUsername

                      return (
                        <tr
                          key={bid.id}
                          className={`border-t border-surface-50/10 ${
                            isWinner ? 'bg-primary-500/10' : ''
                          }`}
                        >
                          <td className="px-4 py-3 text-sm text-gray-500 font-mono">{time}</td>
                          <td className="px-4 py-3">
                            <span className={`font-medium ${
                              isMe ? 'text-primary-400' : isWinner ? 'text-white' : 'text-gray-300'
                            }`}>
                              {bid.bidder.user.username}
                              {isMe && ' (tu)'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-white">{bid.amount}</td>
                          <td className="px-4 py-3 text-right font-mono text-green-400">+{increment}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="p-8 text-center text-gray-500">
                  <p>Nessuna offerta ancora</p>
                  <p className="text-sm mt-1">Base d'asta: {auction.basePrice}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* MANAGER SIDEBAR */}
        <div className="lg:col-span-3">
          <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden sticky top-4">
            <div className="p-3 border-b border-surface-50/20">
              <h3 className="font-bold text-white flex items-center gap-2">
                <span>👔</span> Manager Live
              </h3>
            </div>
            <div className="divide-y divide-surface-50/10 max-h-[500px] overflow-y-auto">
              {managersStatus?.managers.map((m, index) => {
                const isMe = m.id === managersStatus.myId
                const isWinning = winningBidder === m.username
                const budgetSpent = getBudgetSpent(m.roster)

                return (
                  <button
                    key={m.id}
                    onClick={() => onSelectManager(m)}
                    className={`w-full px-3 py-2 text-left hover:bg-surface-300/50 transition-colors ${
                      isWinning ? 'bg-green-500/10' :
                      m.isCurrentTurn ? 'bg-accent-500/10' :
                      isMe ? 'bg-primary-500/5' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {/* Indicatore vincita */}
                      <div className="w-6 text-center">
                        {isWinning && <span className="text-green-400">▸</span>}
                        {m.isCurrentTurn && !isWinning && <span className="text-accent-400">◆</span>}
                      </div>

                      {/* Nome */}
                      <span className={`flex-1 truncate ${
                        isMe ? 'text-primary-400 font-bold' :
                        isWinning ? 'text-green-400 font-bold' :
                        m.isCurrentTurn ? 'text-accent-400' :
                        'text-gray-300'
                      }`}>
                        {m.username}
                      </span>

                      {/* Connessione */}
                      <span className={`w-2 h-2 rounded-full ${m.isConnected ? 'bg-green-500' : 'bg-red-500'}`} />

                      {/* Budget */}
                      <span className={`font-mono font-bold ${
                        m.currentBudget > 300 ? 'text-green-400' :
                        m.currentBudget > 100 ? 'text-yellow-400' :
                        'text-red-400'
                      }`}>
                        {m.currentBudget}
                      </span>
                    </div>
                    <div className="ml-6 mt-1 flex items-center gap-2 text-xs">
                      <span className="text-gray-500">Speso: {budgetSpent}</span>
                      <span className="text-gray-600">|</span>
                      <span className="text-gray-500">Slot: {m.slotsFilled}/{m.totalSlots}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
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

export default LayoutC
