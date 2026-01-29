/**
 * LayoutE.tsx - Stile Compatto
 *
 * Layout compatto per asta fantacalcio:
 * - Design compatto e professionale
 * - Info dense ma leggibili
 * - Timer con colori progressivi
 * - Pulsanti rilancio rapido (+1, +5, +20, +50, +100)
 * - Budget sempre visibile
 * - Rosa manager in formato tabella compatta
 *
 * Creato il: 25/01/2026
 */

import { useState } from 'react'
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

export function LayoutE({
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

  const [expandedManager, setExpandedManager] = useState<string | null>(null)

  // Timer color based on percentage
  const timerPercent = timerSetting > 0 ? ((timeLeft || 0) / timerSetting) * 100 : 0
  const timerColor = timerPercent > 50 ? 'text-green-400' : timerPercent > 20 ? 'text-yellow-400' : 'text-red-400'
  const timerBg = timerPercent > 50 ? 'bg-green-500/20' : timerPercent > 20 ? 'bg-yellow-500/20' : 'bg-red-500/20'

  const winningBidder = auction?.bids[0]?.bidder.user.username
  const isWinning = winningBidder === currentUsername

  // Check se lo slot per la posizione del giocatore corrente è pieno
  const currentPlayerPosition = auction?.player?.position as 'P' | 'D' | 'C' | 'A' | undefined
  const currentPositionSlot = currentPlayerPosition && myRosterSlots?.slots[currentPlayerPosition]
  const isSlotFull = currentPositionSlot ? currentPositionSlot.filled >= currentPositionSlot.total : false
  const canBid = !isSlotFull && !isTimerExpired

  // Budget speso per manager
  const getBudgetSpent = (roster: ManagerData['roster']) => {
    return roster.reduce((sum, r) => sum + (r.acquisitionPrice || 0), 0)
  }

  // Colori posizione compatti
  const POS_COLORS: Record<string, string> = {
    P: 'bg-purple-500',
    D: 'bg-green-500',
    C: 'bg-blue-500',
    A: 'bg-red-500'
  }

  // STATO: Attesa nomination
  if (!auction) {
    return (
      <div className="space-y-2">
        {/* Header compatto */}
        <div className="bg-surface-200 rounded-lg border border-surface-50/20 px-3 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">🎮</span>
              <span className="font-bold text-white text-sm">Asta Pro</span>
              <span className="text-xs text-gray-500">In attesa</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-bold text-accent-400">{membership?.currentBudget || 0}</span>
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-yellow-500'}`} />
            </div>
          </div>
        </div>

        {/* Info turno */}
        <div className="bg-surface-200 rounded-lg border border-surface-50/20 p-4 text-center">
          <div className="text-4xl mb-2">⏳</div>
          {currentTurnManager && (
            <p className="text-sm text-gray-400">
              Turno di: <strong className="text-primary-400">{currentTurnManager.username}</strong>
            </p>
          )}
          {isMyTurn && (
            <div className="mt-2 px-3 py-1 bg-accent-500 text-dark-900 rounded text-sm font-bold inline-block">
              È il tuo turno!
            </div>
          )}
        </div>

        {/* Manager grid compatto */}
        <div className="bg-surface-200 rounded-lg border border-surface-50/20 overflow-hidden">
          <div className="px-2 py-1.5 bg-surface-300/50 border-b border-surface-50/20">
            <span className="text-xs font-bold text-gray-400 uppercase">Manager</span>
          </div>
          <div className="p-1.5 grid grid-cols-4 gap-1">
            {managersStatus?.managers?.slice(0, 8).map(m => (
              <div key={m.id} className={`px-2 py-1 rounded text-xs text-center ${m.isCurrentTurn ? 'bg-accent-500/20' : 'bg-surface-300/50'}`}>
                <span className={`w-1.5 h-1.5 rounded-full inline-block mr-1 ${m.isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-gray-300 truncate">{m.username.slice(0, 8)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Lista giocatori compatta */}
        {isMyTurn && players && onNominatePlayer && (
          <div className="bg-surface-200 rounded-lg border-2 border-primary-500/50 overflow-hidden">
            <div className="px-2 py-1.5 bg-primary-500/10 flex items-center justify-between">
              <span className="text-xs font-bold text-primary-400">🎯 Nomina</span>
              {onSearchChange && (
                <input
                  type="text"
                  placeholder="Cerca..."
                  value={searchQuery || ''}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="px-2 py-0.5 bg-surface-300 border border-surface-50/30 rounded text-xs text-white placeholder-gray-500 w-32"
                />
              )}
            </div>
            <div className="p-1.5 grid grid-cols-2 gap-1 max-h-[35vh] overflow-y-auto">
              {players.slice(0, 20).map(player => (
                <button
                  key={player.id}
                  onClick={() => onNominatePlayer(player.id)}
                  className="flex items-center p-1.5 rounded bg-surface-300 hover:bg-primary-500/20 text-left text-xs"
                >
                  <span className={`w-5 h-5 rounded text-[9px] font-bold text-white flex items-center justify-center mr-1.5 ${POS_COLORS[player.position] || 'bg-gray-500'}`}>
                    {player.position}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white truncate">{player.name}</p>
                    <p className="text-[10px] text-gray-500 truncate">{player.team}</p>
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
    <div className="space-y-2">
      {/* === TOP BAR: Timer + Player + Price === */}
      <div className="bg-surface-200 rounded-lg border border-surface-50/20 p-3">
        <div className="flex items-center gap-4">
          {/* Timer compatto */}
          <div className={`${timerBg} rounded-lg px-3 py-2 text-center min-w-[70px]`}>
            <div className={`text-2xl font-mono font-bold ${timerColor}`}>
              {timeLeft ?? '--'}
            </div>
            <div className="text-[10px] text-gray-500 uppercase">sec</div>
          </div>

          {/* Player info compatto */}
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center p-1 shadow">
              <img
                src={getTeamLogo(auction.player.team)}
                alt={auction.player.team}
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${POSITION_BG[auction.player.position]}`}>
                  {auction.player.position}
                </span>
                <h2 className="font-bold text-white text-base truncate">{auction.player.name}</h2>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span>{auction.player.team}</span>
                {auction.player.quotation && (
                  <>
                    <span>•</span>
                    <span className="text-accent-400">Q: {auction.player.quotation}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Prezzo corrente */}
          <div className={`rounded-lg px-4 py-2 text-center ${isWinning ? 'bg-green-500/20 border border-green-500/50' : 'bg-primary-500/20 border border-primary-500/30'}`}>
            <div className="text-3xl font-bold text-white">{auction.currentPrice}</div>
            <div className={`text-xs ${isWinning ? 'text-green-400' : 'text-gray-400'}`}>
              {winningBidder ? (isWinning ? 'Tua offerta' : winningBidder) : 'Base'}
            </div>
          </div>

          {/* Budget personale */}
          <div className="text-center px-3">
            <div className="text-xl font-bold text-accent-400">{membership?.currentBudget || 0}</div>
            <div className="text-[10px] text-gray-500 uppercase">Budget</div>
          </div>
        </div>
      </div>

      {/* === MAIN GRID: Bid Controls + Managers + History + My Slots === */}
      <div className="grid grid-cols-12 gap-2">
        {/* BID CONTROLS - Compatto verticale */}
        <div className={`col-span-2 bg-surface-200 rounded-lg border overflow-hidden ${
          isSlotFull ? 'border-red-500/30 opacity-60' : 'border-surface-50/20'
        }`}>
          <div className={`px-2 py-1.5 border-b border-surface-50/20 ${
            isSlotFull ? 'bg-red-500/10' : 'bg-surface-300/50'
          }`}>
            <span className="text-[10px] font-bold text-gray-400 uppercase">Offerta</span>
          </div>

          {/* Messaggio slot pieno */}
          {isSlotFull ? (
            <div className="p-3 text-center">
              <div className="text-red-400 text-lg mb-1">🚫</div>
              <p className="text-[10px] text-red-400 font-medium">Slot {currentPlayerPosition} completo</p>
              <p className="text-[9px] text-gray-500 mt-1">Non puoi partecipare</p>
            </div>
          ) : (
            <div className="p-2 space-y-2">
              {/* Input con +/- */}
              <div className="flex items-center bg-surface-300 rounded overflow-hidden">
                <button
                  onClick={() => setBidAmount(String(Math.max(auction.currentPrice + 1, parseInt(bidAmount || '0') - 1)))}
                  disabled={!canBid}
                  className="w-7 h-8 text-white text-sm hover:bg-surface-200 transition-colors disabled:opacity-50"
                >
                  −
                </button>
                <input
                  type="number"
                  value={bidAmount}
                  onChange={e => setBidAmount(e.target.value)}
                  disabled={!canBid}
                  className="flex-1 min-w-0 bg-transparent text-center text-sm font-bold text-white outline-none disabled:opacity-50"
                  placeholder="..."
                />
                <button
                  onClick={() => setBidAmount(String(parseInt(bidAmount || '0') + 1))}
                  disabled={!canBid}
                  className="w-7 h-8 text-white text-sm hover:bg-surface-200 transition-colors disabled:opacity-50"
                >
                  +
                </button>
              </div>

              {/* Quick buttons grid 3x2 */}
              <div className="grid grid-cols-3 gap-1">
                {[1, 5, 10, 20, 50, 100].map(inc => {
                  const newValue = auction.currentPrice + inc
                  const canAfford = (membership?.currentBudget || 0) >= newValue
                  return (
                    <button
                      key={inc}
                      onClick={() => setBidAmount(String(newValue))}
                      disabled={!canBid || !canAfford}
                      className={`py-1 rounded text-[10px] font-bold transition-all ${
                        canAfford && canBid
                          ? 'bg-surface-300 text-gray-300 hover:bg-primary-500/30 hover:text-primary-400'
                          : 'bg-surface-400/30 text-gray-600 cursor-not-allowed'
                      }`}
                    >
                      +{inc}
                    </button>
                  )
                })}
              </div>

              {/* MAX + OFFRI */}
              <div className="flex gap-1">
                <button
                  onClick={() => setBidAmount(String(membership?.currentBudget || 0))}
                  disabled={!canBid}
                  className="flex-1 py-1.5 rounded text-[10px] font-bold bg-accent-500/20 text-accent-400 hover:bg-accent-500/30 disabled:opacity-50"
                >
                  MAX
                </button>
                <button
                  onClick={onPlaceBid}
                  disabled={!canBid || !membership || membership.currentBudget < (parseInt(bidAmount) || 0)}
                  className={`flex-[2] py-1.5 rounded font-bold text-xs transition-all ${
                    !canBid
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      : 'bg-primary-500 text-white hover:bg-primary-400 active:scale-95'
                  }`}
                >
                  {isTimerExpired ? 'SCADUTO' : 'OFFRI'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Manager List - Tabella compatta */}
        <div className="col-span-4 bg-surface-200 rounded-lg border border-surface-50/20 overflow-hidden">
          <div className="px-3 py-2 bg-surface-300/50 border-b border-surface-50/20 flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase">Manager</span>
            <span className="text-xs text-gray-500">{managersStatus?.managers.length || 0} DG</span>
          </div>
          <div className="max-h-[280px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-surface-300/30 sticky top-0">
                <tr className="text-gray-500">
                  <th className="px-2 py-1 text-left font-medium">#</th>
                  <th className="px-2 py-1 text-left font-medium">Nome</th>
                  <th className="px-2 py-1 text-center font-medium">P</th>
                  <th className="px-2 py-1 text-center font-medium">D</th>
                  <th className="px-2 py-1 text-center font-medium">C</th>
                  <th className="px-2 py-1 text-center font-medium">A</th>
                  <th className="px-2 py-1 text-right font-medium">Budget</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-50/10">
                {managersStatus?.managers.map((m, index) => {
                  const isMe = m.id === managersStatus.myId
                  const isWinningManager = winningBidder === m.username
                  const isTurn = m.isCurrentTurn
                  const budgetSpent = getBudgetSpent(m.roster)

                  return (
                    <tr
                      key={m.id}
                      onClick={() => onSelectManager(m)}
                      className={`cursor-pointer transition-colors ${
                        isWinningManager ? 'bg-green-500/10' :
                        isTurn ? 'bg-accent-500/10' :
                        isMe ? 'bg-primary-500/5' :
                        'hover:bg-surface-300/30'
                      }`}
                    >
                      <td className="px-2 py-1.5">
                        <div className="flex items-center gap-1">
                          <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            isTurn ? 'bg-accent-500 text-dark-900' : 'bg-surface-400 text-gray-400'
                          }`}>
                            {index + 1}
                          </span>
                          <span className={`w-1.5 h-1.5 rounded-full ${m.isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                        </div>
                      </td>
                      <td className="px-2 py-1.5">
                        <span className={`font-medium ${
                          isMe ? 'text-primary-400' :
                          isWinningManager ? 'text-green-400' :
                          isTurn ? 'text-accent-400' :
                          'text-gray-200'
                        }`}>
                          {m.username}
                          {isWinningManager && ' 🏆'}
                        </span>
                      </td>
                      <td className={`px-2 py-1.5 text-center ${m.slotsByPosition.P.filled >= m.slotsByPosition.P.total ? 'text-green-400' : 'text-gray-500'}`}>
                        {m.slotsByPosition.P.filled}
                      </td>
                      <td className={`px-2 py-1.5 text-center ${m.slotsByPosition.D.filled >= m.slotsByPosition.D.total ? 'text-green-400' : 'text-gray-500'}`}>
                        {m.slotsByPosition.D.filled}
                      </td>
                      <td className={`px-2 py-1.5 text-center ${m.slotsByPosition.C.filled >= m.slotsByPosition.C.total ? 'text-green-400' : 'text-gray-500'}`}>
                        {m.slotsByPosition.C.filled}
                      </td>
                      <td className={`px-2 py-1.5 text-center ${m.slotsByPosition.A.filled >= m.slotsByPosition.A.total ? 'text-green-400' : 'text-gray-500'}`}>
                        {m.slotsByPosition.A.filled}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <span className={`font-mono font-bold ${
                          m.currentBudget > 300 ? 'text-green-400' :
                          m.currentBudget > 100 ? 'text-yellow-400' :
                          'text-red-400'
                        }`}>
                          {m.currentBudget}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bid History - Lista compatta */}
        <div className="col-span-3 bg-surface-200 rounded-lg border border-surface-50/20 overflow-hidden">
          <div className="px-3 py-2 bg-surface-300/50 border-b border-surface-50/20 flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase">Storico Offerte</span>
            <span className="text-xs text-gray-500">{auction.bids.length}</span>
          </div>
          <div className="max-h-[280px] overflow-y-auto">
            {auction.bids.length > 0 ? (
              <table className="w-full text-xs">
                <thead className="bg-surface-300/30 sticky top-0">
                  <tr className="text-gray-500">
                    <th className="px-2 py-1 text-left font-medium">Ora</th>
                    <th className="px-2 py-1 text-left font-medium">Manager</th>
                    <th className="px-2 py-1 text-right font-medium">Offerta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-50/10">
                  {auction.bids.map((bid, index) => {
                    const time = new Date(bid.placedAt).toLocaleTimeString('it-IT', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    })
                    const isFirst = index === 0
                    const isMyBid = bid.bidder.user.username === currentUsername

                    return (
                      <tr key={bid.id} className={isFirst ? 'bg-primary-500/10' : ''}>
                        <td className="px-2 py-1.5 text-gray-500 font-mono">{time}</td>
                        <td className={`px-2 py-1.5 ${isMyBid ? 'text-primary-400 font-medium' : isFirst ? 'text-white' : 'text-gray-300'}`}>
                          {bid.bidder.user.username}
                          {isMyBid && ' ◀'}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono font-bold text-white">{bid.amount}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : (
              <div className="p-4 text-center text-gray-500 text-xs">
                Nessuna offerta - Base: {auction.basePrice}
              </div>
            )}
          </div>
        </div>

        {/* My Slots - Compatto */}
        <div className="col-span-3 bg-surface-200 rounded-lg border border-surface-50/20 overflow-hidden">
          <div className="px-3 py-2 bg-surface-300/50 border-b border-surface-50/20">
            <span className="text-xs font-bold text-gray-400 uppercase">La Mia Rosa</span>
          </div>
          <div className="p-2 space-y-1">
            {myRosterSlots && (['P', 'D', 'C', 'A'] as const).map(pos => {
              const slot = myRosterSlots.slots[pos]
              const isCurrent = myRosterSlots.currentRole === pos
              const isComplete = slot.filled >= slot.total
              const fillPercent = (slot.filled / slot.total) * 100

              return (
                <div
                  key={pos}
                  className={`p-2 rounded ${isCurrent ? 'bg-primary-500/20 ring-1 ring-primary-500' : 'bg-surface-300/50'}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold ${POSITION_BG[pos]}`}>
                        {pos}
                      </span>
                      <span className="text-xs text-gray-300">{POSITION_NAMES[pos]}</span>
                    </div>
                    <span className={`text-xs font-bold ${isComplete ? 'text-green-400' : 'text-gray-400'}`}>
                      {slot.filled}/{slot.total}
                    </span>
                  </div>
                  <div className="h-1 bg-surface-400 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${isComplete ? 'bg-green-500' : 'bg-primary-500'}`}
                      style={{ width: `${fillPercent}%` }}
                    />
                  </div>
                </div>
              )
            })}

            {/* Totale Rosa */}
            {myRosterSlots && (
              <div className="mt-2 pt-2 border-t border-surface-50/20 flex items-center justify-between text-xs">
                <span className="text-gray-500">Totale</span>
                <span className="font-bold text-white">
                  {Object.values(myRosterSlots.slots).reduce((s, slot) => s + slot.filled, 0)}/
                  {Object.values(myRosterSlots.slots).reduce((s, slot) => s + slot.total, 0)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* === STATUS BAR === */}
      <div className="bg-surface-200/50 rounded-lg px-3 py-1.5 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <span className={`flex items-center gap-1 ${isConnected ? 'text-green-400' : 'text-yellow-400'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-yellow-500'}`} />
            {isConnected ? 'Live' : connectionStatus}
          </span>
          {isMyTurn && (
            <span className="px-2 py-0.5 bg-accent-500/20 text-accent-400 rounded font-bold animate-pulse">
              TUO TURNO
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-gray-500">
          {marketProgress && (
            <>
              <span>Fase: <strong className="text-gray-300">{POSITION_NAMES[marketProgress.currentRole]}</strong></span>
              <span>Progresso: <strong className="text-gray-300">{marketProgress.filledSlots}/{marketProgress.totalSlots}</strong></span>
            </>
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

export default LayoutE
