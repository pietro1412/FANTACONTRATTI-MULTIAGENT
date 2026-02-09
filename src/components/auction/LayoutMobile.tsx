/**
 * LayoutMobile.tsx - Mobile-First Layout
 *
 * Caratteristiche:
 * - Barra stato fissa con info critiche
 * - Una sola card centrale con tutto il necessario
 * - Tab per info secondarie (Asta/Manager/Rosa)
 * - Pulsante OFFRI gigante per mobile
 * - Touch-friendly controls (44px targets)
 *
 * Consolidato da LayoutB (Sprint 4)
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

type TabType = 'auction' | 'managers' | 'roster'

export function LayoutMobile({
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

  const [activeTab, setActiveTab] = useState<TabType>('auction')

  // Calcola budget speso
  const getBudgetSpent = (roster: ManagerData['roster']) => {
    return roster.reduce((sum, r) => sum + (r.acquisitionPrice || 0), 0)
  }

  const currentSlot = myRosterSlots?.currentRole || 'P'
  const currentSlotInfo = myRosterSlots?.slots[currentSlot as keyof typeof myRosterSlots.slots]

  // STATO: Attesa nomination
  if (!auction) {
    return (
      <div className="flex flex-col min-h-[60vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-surface-200 via-primary-500/10 to-surface-200 border-b border-surface-50/20 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📱</span>
              <span className="font-bold text-white">Mobile</span>
              <span className="text-sm text-gray-400">In attesa</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-accent-400">{membership?.currentBudget || 0}</span>
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-yellow-500'}`} />
            </div>
          </div>
        </div>

        {/* Card principale */}
        <div className="flex-1 p-4">
          <div className="bg-surface-200 rounded-2xl border border-surface-50/20 p-6 text-center mb-4">
            <div className="text-5xl mb-4">⏳</div>
            {currentTurnManager && (
              <p className="text-gray-400">Turno di: <strong className="text-primary-400">{currentTurnManager.username}</strong></p>
            )}
            {isMyTurn && (
              <div className="mt-3 px-4 py-2 bg-accent-500 text-dark-900 rounded-full inline-block font-bold">
                È il tuo turno!
              </div>
            )}
          </div>

          {/* Lista giocatori */}
          {isMyTurn && players && onNominatePlayer && (
            <div className="bg-surface-200 rounded-2xl border-2 border-primary-500/50 overflow-hidden">
              <div className="px-4 py-3 bg-primary-500/10">
                <span className="font-bold text-primary-400">🎯 Nomina un Giocatore</span>
              </div>
              <div className="p-3">
                {onSearchChange && (
                  <input
                    type="text"
                    placeholder="Cerca..."
                    value={searchQuery || ''}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="w-full px-3 py-2 mb-2 bg-surface-300 border border-surface-50/30 rounded-xl text-white placeholder-gray-500"
                  />
                )}
                <div className="max-h-[40vh] overflow-y-auto space-y-2">
                  {players.slice(0, 20).map(player => (
                    <button
                      key={player.id}
                      onClick={() => onNominatePlayer(player.id)}
                      className="w-full flex items-center p-3 rounded-xl bg-surface-300 hover:bg-primary-500/20 transition-all text-left"
                    >
                      <span className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white mr-3 ${POSITION_COLORS[player.position]?.split(' ')[0] || 'bg-gray-500'}`}>
                        {player.position}
                      </span>
                      <div className="flex-1">
                        <p className="font-bold text-white">{player.name}</p>
                        <p className="text-sm text-gray-400">{player.team}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-200px)]">
      {/* BARRA STATO FISSA */}
      <div className="bg-gradient-to-r from-surface-200 via-surface-300 to-surface-200 border-b border-surface-50/20 px-4 py-3 sticky top-0 z-40">
        <div className="flex items-center justify-between gap-4">
          {/* Budget */}
          <div className="flex items-center gap-2">
            <span className="text-lg">💰</span>
            <span className="font-mono font-bold text-accent-400 text-xl">{membership?.currentBudget || 0}</span>
          </div>

          {/* Turno */}
          <div className={`px-3 py-1 rounded-full text-sm font-bold ${
            isMyTurn ? 'bg-accent-500 text-dark-900' : 'bg-surface-400 text-gray-300'
          }`}>
            {isMyTurn ? '🎯 TUO TURNO' : `Turno: ${currentTurnManager?.username || '...'}`}
          </div>

          {/* Slot attivo */}
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded text-sm font-bold ${POSITION_BG[currentSlot]}`}>
              {currentSlot}
            </span>
            <span className="text-gray-400 text-sm">
              {currentSlotInfo?.filled || 0}/{currentSlotInfo?.total || 0}
            </span>
          </div>

          {/* Timer compatto */}
          {auction?.timerExpiresAt && (
            <AuctionTimer
              timeLeft={timeLeft}
              totalSeconds={timerSetting}
              compact={true}
            />
          )}
        </div>
      </div>

      {/* CONTENUTO PRINCIPALE */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'auction' && (
          <div className="h-full flex flex-col p-4">
            {auction ? (
              <>
                {/* CARD ASTA UNIFICATA */}
                <div className="flex-1 flex flex-col bg-gradient-to-b from-surface-200 to-surface-300 rounded-3xl border border-surface-50/20 overflow-hidden">
                  {/* Header con giocatore */}
                  <div className="p-6 text-center border-b border-surface-50/20">
                    <div className="inline-flex items-center gap-4 mb-4">
                      <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center p-2 shadow-lg">
                        <img
                          src={getTeamLogo(auction.player.team)}
                          alt={auction.player.team}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="text-left">
                        <h2 className="text-2xl font-black text-white">{auction.player.name}</h2>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400">{auction.player.team}</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${POSITION_BG[auction.player.position]}`}>
                            {auction.player.position}
                          </span>
                          {auction.player.quotation && (
                            <span className="text-accent-400 text-sm">Q:{auction.player.quotation}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Prezzo corrente - GRANDE */}
                  <div className="flex-1 flex flex-col items-center justify-center p-6">
                    <p className="text-primary-400 text-sm uppercase tracking-wider mb-2">Offerta Corrente</p>
                    <p className="text-8xl font-black text-white leading-none">{auction.currentPrice}</p>
                    {auction.bids.length > 0 && auction.bids[0] && (
                      <div className={`mt-3 px-4 py-2 rounded-full ${
                        auction.bids[0].bidder.user.username === currentUsername
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-surface-400 text-gray-300'
                      }`}>
                        {auction.bids[0].bidder.user.username === currentUsername
                          ? '🏆 Stai vincendo!'
                          : `di ${auction.bids[0].bidder.user.username}`
                        }
                      </div>
                    )}
                  </div>

                  {/* Controlli offerta */}
                  <div className="p-4 bg-surface-400/30 border-t border-surface-50/20">
                    {/* Quick buttons */}
                    <div className="flex gap-2 mb-3">
                      {[1, 5, 10].map(inc => {
                        const value = auction.currentPrice + inc
                        return (
                          <button
                            key={inc}
                            onClick={() => setBidAmount(String(value))}
                            disabled={isTimerExpired || (membership?.currentBudget || 0) < value}
                            className="flex-1 py-2 rounded-lg font-bold text-primary-400 bg-primary-500/20 border border-primary-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            +{inc}
                          </button>
                        )
                      })}
                      <button
                        onClick={() => setBidAmount(String(membership?.currentBudget || 0))}
                        disabled={isTimerExpired}
                        className="flex-1 py-2 rounded-lg font-bold text-dark-900 bg-accent-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        MAX
                      </button>
                    </div>

                    {/* Input + Offri */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setBidAmount(String(Math.max(auction.currentPrice + 1, parseInt(bidAmount || '0') - 1)))}
                        className="w-12 h-14 rounded-xl bg-surface-300 text-white text-2xl font-bold"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        value={bidAmount}
                        onChange={e => setBidAmount(e.target.value)}
                        className="flex-1 h-14 rounded-xl bg-surface-300 text-center text-2xl font-bold text-white outline-none"
                      />
                      <button
                        onClick={() => setBidAmount(String(parseInt(bidAmount || '0') + 1))}
                        className="w-12 h-14 rounded-xl bg-surface-300 text-white text-2xl font-bold"
                      >
                        +
                      </button>
                      <button
                        onClick={onPlaceBid}
                        disabled={isTimerExpired || !membership || (membership.currentBudget < (parseInt(bidAmount) || 0))}
                        className={`px-8 h-14 rounded-xl font-black text-lg transition-all ${
                          isTimerExpired
                            ? 'bg-gray-600 text-gray-400'
                            : 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg'
                        }`}
                      >
                        {isTimerExpired ? '⏱️' : '🔨'}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-6xl mb-4">⏳</div>
                  <p className="text-gray-400">In attesa della prossima asta...</p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'managers' && (
          <div className="h-full overflow-y-auto p-4">
            <div className="space-y-2">
              {managersStatus?.managers.map((m, index) => {
                const isMe = m.id === managersStatus.myId
                const budgetSpent = getBudgetSpent(m.roster)

                return (
                  <button
                    key={m.id}
                    onClick={() => onSelectManager(m)}
                    className={`w-full p-4 rounded-xl text-left transition-all ${
                      isMe ? 'bg-primary-500/20 border-2 border-primary-500' :
                      m.isCurrentTurn ? 'bg-accent-500/10 border border-accent-500/50' :
                      'bg-surface-200 border border-surface-50/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                          m.isCurrentTurn ? 'bg-accent-500 text-dark-900' : 'bg-surface-300 text-gray-400'
                        }`}>
                          {index + 1}
                        </span>
                        <span className={`font-bold ${isMe ? 'text-primary-400' : 'text-white'}`}>
                          {m.username}
                          {isMe && ' (tu)'}
                        </span>
                        <span className={`w-2 h-2 rounded-full ${m.isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                      </div>
                      <span className={`font-mono font-bold text-lg ${
                        m.currentBudget > 300 ? 'text-green-400' :
                        m.currentBudget > 100 ? 'text-yellow-400' :
                        'text-red-400'
                      }`}>
                        {m.currentBudget}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex gap-2">
                        {(['P', 'D', 'C', 'A'] as const).map(pos => (
                          <span key={pos} className={`px-2 py-0.5 rounded text-xs ${
                            m.slotsByPosition[pos].filled >= m.slotsByPosition[pos].total
                              ? POSITION_BG[pos]
                              : 'bg-surface-400 text-gray-500'
                          }`}>
                            {pos}:{m.slotsByPosition[pos].filled}/{m.slotsByPosition[pos].total}
                          </span>
                        ))}
                      </div>
                      <span className="text-gray-500">Speso: {budgetSpent}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {activeTab === 'roster' && (
          <div className="h-full overflow-y-auto p-4">
            {myRosterSlots && (['P', 'D', 'C', 'A'] as const).map(pos => {
              const slot = myRosterSlots.slots[pos]
              const isCurrent = myRosterSlots.currentRole === pos

              return (
                <div key={pos} className={`mb-4 rounded-xl overflow-hidden ${
                  isCurrent ? 'ring-2 ring-primary-500' : ''
                }`}>
                  <div className={`px-4 py-2 flex items-center justify-between bg-gradient-to-r ${POSITION_COLORS[pos]}`}>
                    <span className="font-bold text-white">{POSITION_NAMES[pos]}</span>
                    <span className="font-bold text-white">{slot.filled}/{slot.total}</span>
                  </div>
                  <div className="bg-surface-200">
                    {slot.players.length > 0 ? (
                      slot.players.map(p => (
                        <div key={p.id} className="px-4 py-3 border-b border-surface-50/10 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-white rounded flex items-center justify-center">
                              <img src={getTeamLogo(p.playerTeam)} alt="" className="w-6 h-6 object-contain" />
                            </div>
                            <span className="text-white">{p.playerName}</span>
                          </div>
                          <span className="font-mono font-bold text-accent-400">{p.acquisitionPrice}</span>
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-gray-500 italic">Nessun giocatore</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* TAB NAVIGATION */}
      <div className="bg-surface-200 border-t border-surface-50/20 px-4 py-2 safe-area-bottom">
        <div className="flex gap-2">
          {[
            { id: 'auction' as TabType, icon: '🔨', label: 'Asta' },
            { id: 'managers' as TabType, icon: '👔', label: `Manager (${managersStatus?.managers.length || 0})` },
            { id: 'roster' as TabType, icon: '📋', label: `Rosa (${myRosterSlots ? Object.values(myRosterSlots.slots).reduce((s, slot) => s + slot.filled, 0) : 0})` }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                activeTab === tab.id
                  ? 'bg-primary-500 text-white'
                  : 'bg-surface-300 text-gray-400'
              }`}
            >
              <span className="mr-1">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
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

export default LayoutMobile
