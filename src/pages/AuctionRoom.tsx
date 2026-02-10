import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Navigation } from '../components/Navigation'
import { getTeamLogo } from '../utils/teamLogos'
import { POSITION_GRADIENTS, POSITION_NAMES } from '../components/ui/PositionBadge'
import { ContractModifierModal } from '../components/ContractModifier'
import { AuctionTimer } from '../components/AuctionTimer'
import {
  AuctionLayoutSelector,
  LayoutMobile,
  LayoutDesktop,
  LayoutPro
} from '../components/auction'
import type { ManagerData as LayoutManagerData } from '../components/auction/types'
import {
  DndContext,
  closestCenter,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useAuctionRoomState } from '../hooks/useAuctionRoomState'
import { POSITION_COLORS, POSITION_BG } from '../types/auctionroom.types'
import type { AuctionRoomProps } from '../types/auctionroom.types'
import {
  ManagerDetailModal, AcknowledgmentModal, WaitingModal,
  AppealReviewModal, AppealAckModal, AwaitingResumeModal,
  ManagersTable, MobileBidControls,
} from '../components/auction-room'

// Sortable item component for drag & drop
function SortableManagerItem({ id, member, index }: { id: string; member: { username: string; teamName: string | null }; index: number }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-4 p-4 rounded-lg border transition-all ${
        isDragging
          ? 'bg-primary-900/50 border-primary-500 shadow-glow scale-105 z-50'
          : 'bg-surface-200 border-surface-50/20 hover:border-primary-500/40'
      }`}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-primary-400 p-1"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
        </svg>
      </div>

      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-bold text-lg shadow-glow">
        {index + 1}
      </div>

      <div className="flex-1">
        <p className="font-semibold text-gray-100">{member.username}</p>
        {member.teamName && (
          <p className="text-sm text-gray-400">{member.teamName}</p>
        )}
      </div>

      <div className="text-right text-sm text-gray-500">
        #{index + 1}
      </div>
    </div>
  )
}

export function AuctionRoom({ sessionId, leagueId, onNavigate }: AuctionRoomProps) {
  const {
    auction, membership, players,
    bidAmount, setBidAmount,
    searchQuery, setSearchQuery,
    selectedPosition, setSelectedPosition,
    selectedTeam, setSelectedTeam,
    availableTeams,
    teamDropdownOpen, setTeamDropdownOpen,
    isLoading, error, successMessage,
    sessionInfo, marketProgress, timeLeft, timerSetting,
    firstMarketStatus, turnOrderDraft,
    readyStatus, markingReady,
    pendingAck,
    prophecyContent, setProphecyContent,
    ackSubmitting,
    isAppealMode, setIsAppealMode,
    appealContent, setAppealContent,
    myRosterSlots, managersStatus,
    selectedManager, setSelectedManager,
    appealStatus,
    auctionLayout, setAuctionLayout,
    pendingContractModification,
    isAdmin, isPrimoMercato, hasTurnOrder,
    isMyTurn, currentTurnManager,
    isUserWinning, isTimerExpired, currentUsername,
    connectionStatus, isConnected,
    sensors, handleDragEnd,
    getTimerClass, getTimerContainerClass,
    getBudgetPercentage, getBudgetBarClass,
    handleSetTurnOrder, handleNominatePlayer,
    handleConfirmNomination, handleCancelNomination,
    handleMarkReady, handleForceAllReady,
    handleBotBid, handleBotNominate, handleBotConfirmNomination,
    handleForceAcknowledgeAll, handleSimulateAppeal,
    handleAcknowledgeAppealDecision, handleReadyToResume,
    handleForceAllAppealAcks, handleForceAllReadyResume,
    handleResetFirstMarket, handlePauseAuction, handleResumeAuction,
    handleCompleteAllSlots, handlePlaceBid, handleCloseAuction,
    handleUpdateTimer, handleAcknowledge,
    handleContractModification, handleSkipContractModification,
  } = useAuctionRoomState(sessionId, leagueId)

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-300 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Caricamento sala asta...</p>
        </div>
      </div>
    )
  }

  // ==================== SETUP: Turn Order with Drag & Drop ====================
  if (isPrimoMercato && !hasTurnOrder && isAdmin) {
    return (
      <div className="min-h-screen bg-dark-300">
        <header className="fm-header py-6">
          <div className="max-w-2xl mx-auto px-4">
            <button onClick={() => onNavigate('leagueDetail', { leagueId })} className="text-primary-400 hover:text-primary-300 text-sm mb-2 flex items-center gap-1">
              <span>←</span> Torna alla lega
            </button>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white">Ordine di Chiamata</h1>
            <p className="text-gray-400 mt-1">Trascina i Direttori Generali per definire l'ordine dei turni</p>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-8">
          {error && <div className="bg-danger-500/20 border border-danger-500/50 text-danger-400 p-4 rounded-lg mb-6">{error}</div>}
          {successMessage && <div className="bg-secondary-500/20 border border-secondary-500/50 text-secondary-400 p-4 rounded-lg mb-6">{successMessage}</div>}

          <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
            <div className="p-4 border-b border-surface-50/20 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent-500 to-accent-600 flex items-center justify-center">
                <span className="text-xl">👔</span>
              </div>
              <div>
                <h2 className="font-bold text-white">Direttori Generali in Sala</h2>
                <p className="text-sm text-gray-400">{turnOrderDraft.length} partecipanti</p>
              </div>
            </div>

            <div className="p-4 space-y-2">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={turnOrderDraft} strategy={verticalListSortingStrategy}>
                  {turnOrderDraft.map((memberId, index) => {
                    const member = firstMarketStatus?.memberStatus.find(m => m.memberId === memberId)
                    if (!member) return null
                    return <SortableManagerItem key={memberId} id={memberId} member={member} index={index} />
                  })}
                </SortableContext>
              </DndContext>
            </div>

            <div className="p-4 border-t border-surface-50/20">
              <Button onClick={handleSetTurnOrder} className="w-full btn-accent py-3 text-lg font-bold">
                Conferma e Inizia Aste
              </Button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // Non-admin waiting
  if (isPrimoMercato && !hasTurnOrder && !isAdmin) {
    return (
      <div className="min-h-screen bg-dark-300 flex items-center justify-center">
        <div className="bg-surface-200 rounded-xl p-8 text-center max-w-md border border-surface-50/20">
          <div className="w-16 h-16 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-xl font-bold text-white mb-2">Sala Riunioni</h2>
          <p className="text-gray-400">L'admin sta definendo l'ordine dei turni...</p>
        </div>
      </div>
    )
  }

  // ==================== MAIN AUCTION ROOM ====================
  return (
    <div className="min-h-screen bg-dark-300">
      <Navigation currentPage="auction" leagueId={leagueId} isLeagueAdmin={isAdmin} onNavigate={onNavigate} />

      {/* Auction Header */}
      <div className="bg-gradient-to-r from-dark-200 via-surface-200 to-dark-200 border-b border-surface-50/20">
        <div className="max-w-full mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-secondary-500 to-secondary-700 flex items-center justify-center shadow-glow">
                <span className="text-2xl">🔨</span>
              </div>
              <div>
                <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">Sala Asta</h1>
                <div className="flex items-center gap-2">
                  <p className="text-gray-400 text-sm">Primo Mercato</p>
                  {sessionInfo?.auctionMode === 'IN_PRESENCE' && (
                    <span className="text-xs bg-accent-500/20 text-accent-400 px-2 py-0.5 rounded-full">In Presenza</span>
                  )}
                  {/* Pusher connection status */}
                  <div className={`text-xs ${isConnected ? 'text-green-400' : 'text-yellow-400'}`}>
                    {isConnected ? '🟢 Real-time' : '🟡 ' + connectionStatus}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Layout Selector Compatto - Sempre visibile per permettere cambio layout */}
              <AuctionLayoutSelector
                currentLayout={auctionLayout}
                onLayoutChange={setAuctionLayout}
                compact={true}
              />
              <div className="text-right bg-surface-200 rounded-xl px-5 py-3 border border-surface-50/20">
                <p className="text-xs text-gray-400 uppercase tracking-wider">Budget</p>
                <p className="text-3xl font-bold gradient-text-gold">{membership?.currentBudget || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Turn Banner */}
        {currentTurnManager && (
          <div className={`px-4 py-3 ${isMyTurn ? 'bg-accent-500/20 border-y border-accent-500/40' : 'bg-primary-500/10 border-y border-primary-500/30'}`}>
            <div className="max-w-full mx-auto flex items-center justify-center gap-3">
              {isMyTurn ? (
                <>
                  <span className="text-2xl">🎯</span>
                  <span className="text-lg font-bold text-accent-400 text-glow-gold">È IL TUO TURNO!</span>
                  <span className="text-2xl">🎯</span>
                </>
              ) : (
                <span className="text-gray-300">Turno di <strong className="text-primary-400">{currentTurnManager.username}</strong></span>
              )}
            </div>
          </div>
        )}

        {/* Progress */}
        {isPrimoMercato && marketProgress && (
          <div className="bg-dark-400/50 px-4 py-3">
            <div className="max-w-full mx-auto flex items-center justify-between">
              <div className="flex items-center gap-2">
                {marketProgress.roleSequence.map((role) => (
                  <span key={role} className={`px-3 py-1 rounded-full text-xs font-bold border ${role === marketProgress.currentRole ? POSITION_BG[role] : 'bg-surface-300 text-gray-500 border-surface-50/20'}`}>
                    {POSITION_NAMES[role]}
                  </span>
                ))}
              </div>
              <div className="text-sm flex items-center gap-4">
                <div>
                  <span className="text-gray-400">{POSITION_NAMES[marketProgress.currentRole]}: </span>
                  <span className="font-bold text-white">{marketProgress.filledSlots}/{marketProgress.totalSlots}</span>
                </div>
                <div className="text-gray-500">
                  (slot/DG: {marketProgress.slotLimits[marketProgress.currentRole as keyof typeof marketProgress.slotLimits]})
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <main className={`max-w-full mx-auto px-4 py-4 lg:py-6 ${auction ? 'auction-room-mobile' : ''}`}>
        {/* Error/Success Messages - Fixed on mobile */}
        <div className="space-y-2 mb-4">
          {error && (
            <div className="bg-danger-500/20 border border-danger-500/50 text-danger-400 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}
          {successMessage && (
            <div className="bg-secondary-500/20 border border-secondary-500/50 text-secondary-400 p-3 rounded-lg text-sm">
              {successMessage}
            </div>
          )}
        </div>

        {/*
         * =======================================================
         * LAYOUT SELECTOR v2 - Layout alternativi asta - 24/01/2026
         * =======================================================
         * Per ROLLBACK: rimuovere questo blocco e il wrapper condizionale,
         * lasciare solo il grid classico sotto
         * =======================================================
         */}
        {/* Layout Pro - Completo con obiettivi, ready check, acknowledgment */}
        {auctionLayout === 'pro' && (
          <div className="mb-4">
            <LayoutPro
              auction={auction}
              timeLeft={timeLeft}
              timerSetting={timerSetting}
              isTimerExpired={isTimerExpired}
              membership={membership}
              isAdmin={isAdmin}
              isMyTurn={isMyTurn}
              isUserWinning={isUserWinning}
              currentUsername={currentUsername}
              managersStatus={managersStatus as any}
              currentTurnManager={currentTurnManager}
              myRosterSlots={myRosterSlots as any}
              marketProgress={marketProgress}
              bidAmount={bidAmount}
              setBidAmount={setBidAmount}
              onPlaceBid={handlePlaceBid}
              isConnected={isConnected}
              connectionStatus={connectionStatus}
              onSelectManager={(m: LayoutManagerData) => setSelectedManager(m as any)}
              onCloseAuction={handleCloseAuction}
              sessionId={sessionId}
              players={players}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onNominatePlayer={handleNominatePlayer}
              readyStatus={readyStatus as any}
              onMarkReady={handleMarkReady}
              markingReady={markingReady}
              pendingAck={pendingAck as any}
              onAcknowledge={() => handleAcknowledge(false)}
              ackSubmitting={ackSubmitting}
              onUpdateTimer={handleUpdateTimer}
              onBotNominate={handleBotNominate}
              onBotConfirmNomination={handleBotConfirmNomination}
              onBotBid={handleBotBid}
              onForceAllReady={handleForceAllReady}
              onForceAcknowledgeAll={handleForceAcknowledgeAll}
              onCompleteAllSlots={handleCompleteAllSlots}
              onResetFirstMarket={handleResetFirstMarket}
            />
          </div>
        )}

        {/* Layout Mobile - Card stack con tab, touch-friendly */}
        {auctionLayout === 'mobile' && (
          <div className="mb-4">
            <LayoutMobile
              auction={auction}
              timeLeft={timeLeft}
              timerSetting={timerSetting}
              isTimerExpired={isTimerExpired}
              membership={membership}
              isAdmin={isAdmin}
              isMyTurn={isMyTurn}
              isUserWinning={isUserWinning}
              currentUsername={currentUsername}
              managersStatus={managersStatus as any}
              currentTurnManager={currentTurnManager}
              myRosterSlots={myRosterSlots as any}
              marketProgress={marketProgress}
              bidAmount={bidAmount}
              setBidAmount={setBidAmount}
              onPlaceBid={handlePlaceBid}
              isConnected={isConnected}
              connectionStatus={connectionStatus}
              onSelectManager={(m: LayoutManagerData) => setSelectedManager(m as any)}
              onCloseAuction={handleCloseAuction}
              sessionId={sessionId}
              players={players}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onNominatePlayer={handleNominatePlayer}
              onUpdateTimer={handleUpdateTimer}
              onBotNominate={handleBotNominate}
              onBotConfirmNomination={handleBotConfirmNomination}
              onBotBid={handleBotBid}
              onForceAllReady={handleForceAllReady}
              onForceAcknowledgeAll={handleForceAcknowledgeAll}
              onCompleteAllSlots={handleCompleteAllSlots}
              onResetFirstMarket={handleResetFirstMarket}
            />
          </div>
        )}

        {/* Layout Desktop - Best mix responsive (default) */}
        {auctionLayout === 'desktop' && (
          <div className="mb-4">
            <LayoutDesktop
              auction={auction}
              timeLeft={timeLeft}
              timerSetting={timerSetting}
              isTimerExpired={isTimerExpired}
              membership={membership}
              isAdmin={isAdmin}
              isMyTurn={isMyTurn}
              isUserWinning={isUserWinning}
              currentUsername={currentUsername}
              managersStatus={managersStatus as any}
              currentTurnManager={currentTurnManager}
              myRosterSlots={myRosterSlots as any}
              marketProgress={marketProgress}
              bidAmount={bidAmount}
              setBidAmount={setBidAmount}
              onPlaceBid={handlePlaceBid}
              isConnected={isConnected}
              connectionStatus={connectionStatus}
              onSelectManager={(m: LayoutManagerData) => setSelectedManager(m as any)}
              onCloseAuction={handleCloseAuction}
              sessionId={sessionId}
              players={players}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onNominatePlayer={handleNominatePlayer}
              onUpdateTimer={handleUpdateTimer}
              onBotNominate={handleBotNominate}
              onBotConfirmNomination={handleBotConfirmNomination}
              onBotBid={handleBotBid}
              onForceAllReady={handleForceAllReady}
              onForceAcknowledgeAll={handleForceAcknowledgeAll}
              onCompleteAllSlots={handleCompleteAllSlots}
              onResetFirstMarket={handleResetFirstMarket}
            />
          </div>
        )}

        {/* Mobile-first grid layout - Classic Layout (nascosto quando un layout consolidato è selezionato) */}
        <div className={`grid grid-cols-1 lg:grid-cols-12 gap-4 ${auctionLayout !== 'classic' && auction ? 'hidden' : ''}`}>
          {/* LEFT: My Roster - Hidden on mobile during active auction, collapsible */}
          <div className={`lg:col-span-3 space-y-4 ${auction ? 'hidden lg:block' : ''}`}>
            <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
              <div className="p-3 border-b border-surface-50/20 flex items-center gap-2">
                <span className="text-lg">📋</span>
                <h3 className="font-bold text-white">La Mia Rosa</h3>
              </div>
              {myRosterSlots && (
                <div className="divide-y divide-surface-50/10">
                  {(['P', 'D', 'C', 'A'] as const).map(pos => {
                    const slot = myRosterSlots.slots[pos]
                    const isCurrent = myRosterSlots.currentRole === pos
                    return (
                      <div key={pos} className={`p-2 ${isCurrent ? 'bg-primary-500/10' : ''}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`w-6 h-6 rounded-full bg-gradient-to-br ${POSITION_COLORS[pos]} flex items-center justify-center text-xs font-bold text-white`}>{pos}</span>
                            <span className="text-sm text-gray-300">{POSITION_NAMES[pos]}</span>
                          </div>
                          <span className={`text-sm font-bold ${slot.filled >= slot.total ? 'text-secondary-400' : 'text-gray-500'}`}>{slot.filled}/{slot.total}</span>
                        </div>
                        {slot.players.length > 0 && (
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-gray-500 text-[10px] uppercase">
                                <th className="text-left font-medium pb-1">Giocatore</th>
                                <th className="text-center font-medium pb-1 w-12">Prezzo</th>
                                <th className="text-center font-medium pb-1 w-10">Ing.</th>
                                <th className="text-center font-medium pb-1 w-8">Dur.</th>
                                <th className="text-center font-medium pb-1 w-12">Claus.</th>
                              </tr>
                            </thead>
                            <tbody>
                              {slot.players.map(p => (
                                <tr key={p.id} className="border-t border-surface-50/10">
                                  <td className="py-1.5">
                                    <div className="flex items-center gap-1.5">
                                      <div className="w-4 h-4 bg-white/90 rounded flex items-center justify-center flex-shrink-0">
                                        <img src={getTeamLogo(p.playerTeam)} alt={p.playerTeam} className="w-3 h-3 object-contain" />
                                      </div>
                                      <span className="text-gray-200 truncate">{p.playerName}</span>
                                    </div>
                                  </td>
                                  <td className="text-center text-accent-400 font-bold">{p.acquisitionPrice}</td>
                                  <td className="text-center text-white">{p.contract?.salary ?? '-'}</td>
                                  <td className="text-center text-white">{p.contract?.duration ?? '-'}</td>
                                  <td className="text-center text-primary-400">{p.contract?.rescissionClause ?? '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                        {slot.players.length === 0 && (
                          <p className="text-xs text-gray-600 italic ml-8">Nessun giocatore</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Admin Controls */}
            {isAdmin && (
              <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
                <div className="p-3 border-b border-surface-50/20">
                  <h3 className="font-bold text-white text-sm">Controlli Admin</h3>
                </div>
                <div className="p-3 space-y-3">
                  <div>
                    <p className="text-xs text-gray-400 mb-2">Timer Asta</p>
                    <div className="flex flex-wrap gap-1">
                      {[5, 10, 15, 20, 25, 30, 45, 60].map(sec => (
                        <button
                          key={sec}
                          onClick={() => handleUpdateTimer(sec)}
                          className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                            timerSetting === sec
                              ? 'bg-primary-500 text-white'
                              : 'bg-surface-300 text-gray-400 hover:bg-surface-50/20 hover:text-white'
                          }`}
                        >
                          {sec}s
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Pause / Resume */}
                  {auction && (
                    <div className="pt-2 border-t border-surface-50/20">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handlePauseAuction}
                        className="w-full text-xs border-warning-500/50 text-warning-400 hover:bg-warning-500/10"
                      >
                        Pausa Asta
                      </Button>
                    </div>
                  )}
                  {!auction && firstMarketStatus?.currentPhase === 'PAUSED' && (
                    <div className="pt-2 border-t border-surface-50/20">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleResumeAuction}
                        className="w-full text-xs border-secondary-500/50 text-secondary-400 hover:bg-secondary-500/10"
                      >
                        Riprendi Asta
                      </Button>
                    </div>
                  )}
                  <div className="pt-2 border-t border-surface-50/20 space-y-2">
                    <p className="text-xs text-accent-500 font-bold uppercase">Test Mode</p>
                    <Button size="sm" variant="outline" onClick={handleBotNominate} className="w-full text-xs border-warning-500/50 text-warning-400 hover:bg-warning-500/10">
                      🎯 Simula Scelta Giocatore
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleBotConfirmNomination} className="w-full text-xs border-warning-500/50 text-warning-400 hover:bg-warning-500/10">
                      ✅ Simula Conferma Scelta
                    </Button>
                    {auction && (
                      <Button size="sm" variant="outline" onClick={handleBotBid} className="w-full text-xs border-primary-500/50 text-primary-400 hover:bg-primary-500/10">
                        💰 Simula Offerta Bot
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={handleForceAllReady} className="w-full text-xs border-accent-500/50 text-accent-400 hover:bg-accent-500/10">Forza Tutti Pronti</Button>
                    <Button size="sm" variant="outline" onClick={handleForceAcknowledgeAll} className="w-full text-xs border-accent-500/50 text-accent-400 hover:bg-accent-500/10">Forza Conferme</Button>
                    <Button size="sm" variant="outline" onClick={handleCompleteAllSlots} className="w-full text-xs border-secondary-500/50 text-secondary-400 hover:bg-secondary-500/10">
                      ✅ Completa Tutti Slot
                    </Button>
                    <Button size="sm" variant="danger" onClick={handleResetFirstMarket} className="w-full text-xs">Reset Asta</Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* CENTER: Auction - Full width on mobile, primary focus */}
          <div className="lg:col-span-5 space-y-4 order-first lg:order-none">
            {/* Ready Check */}
            {readyStatus?.hasPendingNomination && !auction && (
              <div className="bg-surface-200 rounded-xl border-2 border-accent-500/50 overflow-hidden animate-pulse-slow">
                <div className="p-6 text-center">
                  <div className="text-4xl mb-4">{readyStatus.userIsNominator && !readyStatus.nominatorConfirmed ? '🎯' : '⏳'}</div>
                  <h2 className="text-xl font-bold text-white mb-2">
                    {readyStatus.userIsNominator && !readyStatus.nominatorConfirmed
                      ? 'Conferma la tua scelta'
                      : `${readyStatus.nominatorUsername} ha chiamato`}
                  </h2>
                  {readyStatus.player && (
                    <div className="inline-flex items-center gap-3 bg-surface-300 rounded-lg p-4 mb-4">
                      <span className={`w-12 h-12 rounded-full bg-gradient-to-br ${POSITION_COLORS[readyStatus.player.position]} flex items-center justify-center text-white font-bold text-lg`}>{readyStatus.player.position}</span>
                      <div className="w-10 h-10 bg-white/90 rounded flex items-center justify-center p-0.5 flex-shrink-0">
                        <img
                          src={getTeamLogo(readyStatus.player.team)}
                          alt={readyStatus.player.team}
                          className="w-8 h-8 object-contain"
                        />
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-xl text-white">{readyStatus.player.name}</p>
                        <p className="text-gray-400">{readyStatus.player.team}</p>
                      </div>
                    </div>
                  )}

                  {/* Nominator: Confirm/Cancel buttons (before confirmation) */}
                  {readyStatus.userIsNominator && !readyStatus.nominatorConfirmed && (
                    <div className="space-y-3">
                      <div className="flex gap-3 justify-center">
                        <Button onClick={handleConfirmNomination} disabled={markingReady} className="btn-accent px-8 py-3 text-lg font-bold">
                          {markingReady ? 'Attendi...' : '✓ CONFERMA'}
                        </Button>
                        <Button onClick={handleCancelNomination} variant="outline" className="border-gray-500 text-gray-300 px-6 py-3">
                          Cambia
                        </Button>
                      </div>
                      <p className="text-sm text-gray-500">Dopo la conferma, gli altri Direttori Generali potranno dichiararsi pronti</p>
                    </div>
                  )}

                  {/* Nominator: After confirmation */}
                  {readyStatus.userIsNominator && readyStatus.nominatorConfirmed && (
                    <div className="space-y-3">
                      <div className="mb-4">
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-gray-400">DG pronti</span>
                          <span className="font-bold text-white">{readyStatus.readyCount}/{readyStatus.totalMembers}</span>
                        </div>
                        <div className="w-full bg-surface-400 rounded-full h-2">
                          <div className="h-2 rounded-full bg-accent-500 transition-all" style={{ width: `${(readyStatus.readyCount / readyStatus.totalMembers) * 100}%` }}></div>
                        </div>
                      </div>
                      {/* Lista DG pronti/non pronti */}
                      <div className="bg-surface-300/50 rounded-lg p-3 text-left">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-secondary-400 font-semibold mb-1">✓ Pronti</p>
                            {readyStatus.readyMembers.length > 0 ? (
                              readyStatus.readyMembers.map(m => (
                                <p key={m.id} className="text-gray-300">{m.username}</p>
                              ))
                            ) : (
                              <p className="text-gray-500 italic">Nessuno</p>
                            )}
                          </div>
                          <div>
                            <p className="text-amber-400 font-semibold mb-1">⏳ In attesa</p>
                            {readyStatus.pendingMembers.length > 0 ? (
                              readyStatus.pendingMembers.map(m => (
                                <p key={m.id} className="text-gray-400">{m.username}</p>
                              ))
                            ) : (
                              <p className="text-gray-500 italic">Nessuno</p>
                            )}
                          </div>
                        </div>
                      </div>
                      <p className="text-secondary-400 font-medium">✓ Confermato - In attesa degli altri</p>
                      {isAdmin && <Button size="sm" variant="outline" onClick={handleForceAllReady} className="border-accent-500/50 text-accent-400">[TEST] Forza Tutti Pronti</Button>}
                    </div>
                  )}

                  {/* Non-nominator: Waiting for confirmation */}
                  {!readyStatus.userIsNominator && !readyStatus.nominatorConfirmed && (
                    <div className="space-y-3">
                      <p className="text-amber-400 font-medium">⏳ Attendi che {readyStatus.nominatorUsername} confermi la scelta...</p>
                    </div>
                  )}

                  {/* Non-nominator: After confirmation, show SONO PRONTO or waiting */}
                  {!readyStatus.userIsNominator && readyStatus.nominatorConfirmed && (
                    <>
                      <div className="mb-4">
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-gray-400">DG pronti</span>
                          <span className="font-bold text-white">{readyStatus.readyCount}/{readyStatus.totalMembers}</span>
                        </div>
                        <div className="w-full bg-surface-400 rounded-full h-2">
                          <div className="h-2 rounded-full bg-accent-500 transition-all" style={{ width: `${(readyStatus.readyCount / readyStatus.totalMembers) * 100}%` }}></div>
                        </div>
                      </div>
                      {/* Lista DG pronti/non pronti */}
                      <div className="bg-surface-300/50 rounded-lg p-3 text-left mb-4">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-secondary-400 font-semibold mb-1">✓ Pronti</p>
                            {readyStatus.readyMembers.length > 0 ? (
                              readyStatus.readyMembers.map(m => (
                                <p key={m.id} className="text-gray-300">{m.username}</p>
                              ))
                            ) : (
                              <p className="text-gray-500 italic">Nessuno</p>
                            )}
                          </div>
                          <div>
                            <p className="text-amber-400 font-semibold mb-1">⏳ In attesa</p>
                            {readyStatus.pendingMembers.length > 0 ? (
                              readyStatus.pendingMembers.map(m => (
                                <p key={m.id} className="text-gray-400">{m.username}</p>
                              ))
                            ) : (
                              <p className="text-gray-500 italic">Nessuno</p>
                            )}
                          </div>
                        </div>
                      </div>
                      {!readyStatus.userIsReady ? (
                        <Button onClick={handleMarkReady} disabled={markingReady} className="btn-accent px-12 py-3 text-lg font-bold">
                          {markingReady ? 'Attendi...' : 'SONO PRONTO'}
                        </Button>
                      ) : (
                        <div className="space-y-3">
                          <p className="text-secondary-400 font-medium">✓ Pronto - In attesa degli altri</p>
                          {isAdmin && <Button size="sm" variant="outline" onClick={handleForceAllReady} className="border-accent-500/50 text-accent-400">[TEST] Forza Tutti Pronti</Button>}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Auction Card */}
            <div className={`bg-surface-200 rounded-xl border overflow-hidden ${auction ? 'auction-card-active' : 'border-surface-50/20'}`}>
              <div className="p-4 border-b border-surface-50/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{auction ? '🔨' : '📭'}</span>
                  <h3 className="font-bold text-white">{auction ? 'Asta in Corso' : 'Nessuna Asta'}</h3>
                </div>
                {auction && isUserWinning && (
                  <div className="winning-indicator">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Stai vincendo!
                  </div>
                )}
              </div>

              <div className="p-4 lg:p-6">
                {auction ? (
                  <div className="space-y-4">
                    {/*
                     * =======================================================
                     * NUOVO TIMER v2 con Progress Bar - 24/01/2026
                     * =======================================================
                     * Per ROLLBACK alla versione precedente:
                     * 1. Commentare/rimuovere il blocco AuctionTimer qui sotto
                     * 2. Scommentare il blocco "OLD_TIMER_START" ... "OLD_TIMER_END"
                     * 3. Rimuovere l'import di AuctionTimer in cima al file
                     * =======================================================
                     */}
                    {auction.timerExpiresAt && (
                      <div className="relative sticky top-16 z-30 lg:relative lg:top-0">
                        <AuctionTimer
                          timeLeft={timeLeft}
                          totalSeconds={timerSetting}
                          className="w-full"
                        />
                      </div>
                    )}

                    {/*
                     * OLD_TIMER_START - VERSIONE PRECEDENTE (commentata per rollback)
                     * Scommentare questo blocco se si vuole tornare al vecchio timer
                     *
                    {auction.timerExpiresAt && (
                      <div className={`${getTimerContainerClass()} relative sticky top-16 z-30 lg:relative lg:top-0`}>
                        {timeLeft !== null && timeLeft <= 5 && (
                          <div className="sound-indicator">
                            <span className="sr-only">Timer warning</span>
                          </div>
                        )}
                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Tempo rimanente</p>
                        <div className={getTimerClass()}>{timeLeft ?? '--'}</div>
                        <p className="text-gray-500 text-sm mt-1">secondi</p>
                        {timeLeft !== null && timeLeft <= 10 && timeLeft > 0 && (
                          <p className="text-xs text-amber-400 mt-2 animate-pulse">Affrettati!</p>
                        )}
                      </div>
                    )}
                     * OLD_TIMER_END
                     */}

                    {/*
                     * ENHANCED PLAYER DISPLAY v2 - Card Giocatore Stile Asta - 24/01/2026
                     * Per ROLLBACK: sostituire con il blocco OLD_PLAYER commentato sotto
                     */}
                    <div className="relative overflow-hidden rounded-2xl">
                      {/* Sfondo con gradient posizione */}
                      <div className={`absolute inset-0 opacity-30 ${POSITION_GRADIENTS[auction.player.position] || 'bg-gradient-to-br from-gray-600 to-gray-800'}`} />

                      {/* Pattern decorativo */}
                      <div className="absolute inset-0 opacity-5">
                        <div className="absolute inset-0" style={{
                          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 20px)'
                        }} />
                      </div>

                      <div className="relative text-center p-6 bg-gradient-to-br from-surface-300/90 to-surface-200/90 backdrop-blur-sm">
                        {/* Badge "ALL'ASTA" */}
                        <div className="absolute -top-1 left-1/2 transform -translate-x-1/2">
                          <span className="px-4 py-1 bg-accent-500 text-dark-900 text-xs font-black uppercase tracking-wider rounded-b-lg shadow-lg">
                            🔨 All'Asta
                          </span>
                        </div>

                        {/* Logo squadra grande con cornice */}
                        <div className="relative inline-block mt-4 mb-4">
                          <div className="absolute inset-0 bg-white rounded-2xl transform rotate-3 opacity-20" />
                          <div className="relative w-20 h-20 bg-white rounded-2xl flex items-center justify-center p-2 shadow-2xl border-4 border-white/30">
                            <img
                              src={getTeamLogo(auction.player.team)}
                              alt={auction.player.team}
                              className="w-16 h-16 object-contain"
                            />
                          </div>
                        </div>

                        {/* Nome giocatore con effetto */}
                        <h2 className="text-3xl lg:text-4xl font-black text-white mb-2 tracking-tight">
                          {auction.player.name}
                        </h2>

                        {/* Team e posizione in riga */}
                        <div className="flex items-center justify-center gap-3 mb-4">
                          <span className="text-gray-400 font-medium">{auction.player.team}</span>
                          <span className="text-gray-600">•</span>
                          <span className={`px-3 py-1 rounded-full text-sm font-bold ${POSITION_BG[auction.player.position]}`}>
                            {POSITION_NAMES[auction.player.position]}
                          </span>
                        </div>

                        {/* Quotazione con stile enfatizzato */}
                        {auction.player.quotation && (
                          <div className="inline-flex items-center gap-3 px-5 py-2.5 bg-gradient-to-r from-accent-500/20 via-accent-400/10 to-accent-500/20 rounded-xl border border-accent-500/30">
                            <div className="text-center">
                              <span className="text-xs text-gray-400 block uppercase tracking-wider">Quotazione Ufficiale</span>
                              <span className="text-2xl font-black text-accent-400">{auction.player.quotation}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/*
                     * OLD_PLAYER_START - Versione precedente per rollback
                     *
                    <div className="text-center p-5 bg-gradient-to-br from-surface-300 to-surface-200 rounded-xl border border-surface-50/20">
                      <div className="flex items-center justify-center gap-4 mb-3">
                        <span className={`px-4 py-1.5 rounded-full text-sm font-bold border ${POSITION_BG[auction.player.position]}`}>
                          {POSITION_NAMES[auction.player.position]}
                        </span>
                        <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center p-1 shadow-lg">
                          <img
                            src={getTeamLogo(auction.player.team)}
                            alt={auction.player.team}
                            className="w-10 h-10 object-contain"
                          />
                        </div>
                      </div>
                      <h2 className="text-3xl lg:text-4xl font-bold text-white mb-1">{auction.player.name}</h2>
                      <p className="text-lg text-gray-400">{auction.player.team}</p>
                      {auction.player.quotation && (
                        <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-surface-400/50 rounded-full">
                          <span className="text-xs text-gray-400">Quotazione:</span>
                          <span className="text-sm font-bold text-accent-400">{auction.player.quotation}</span>
                        </div>
                      )}
                    </div>
                     * OLD_PLAYER_END
                     */}

                    {/*
                     * ENHANCED CURRENT PRICE v2 - Design Asta Enfatizzato - 24/01/2026
                     * Per ROLLBACK: sostituire con il blocco OLD_PRICE commentato sotto
                     */}
                    <div className="relative">
                      {/* Effetto sfondo animato */}
                      <div className="absolute inset-0 bg-gradient-to-r from-primary-600/20 via-primary-500/10 to-primary-600/20 rounded-xl animate-pulse" />

                      <div className="relative rounded-xl p-6 text-center border-2 border-primary-500/30 bg-gradient-to-br from-surface-300 via-surface-200 to-surface-300 overflow-hidden">
                        {/* Decorazione angoli stile asta */}
                        <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-primary-500/50 rounded-tl-xl" />
                        <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-primary-500/50 rounded-tr-xl" />
                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-primary-500/50 rounded-bl-xl" />
                        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-primary-500/50 rounded-br-xl" />

                        {/* Label con icona martelletto */}
                        <div className="flex items-center justify-center gap-2 mb-3">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-primary-400">
                            <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 000-1.5h-3.75V6z" clipRule="evenodd" />
                          </svg>
                          <p className="text-sm text-primary-400 uppercase tracking-wider font-bold">
                            Offerta Corrente
                          </p>
                        </div>

                        {/* Prezzo grande con effetto glow */}
                        <div className="relative">
                          <p
                            className="text-6xl lg:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary-400 via-white to-primary-400 mb-2"
                            style={{
                              textShadow: '0 0 40px rgba(99, 102, 241, 0.5)',
                              animation: auction.bids.length > 0 ? 'none' : undefined
                            }}
                          >
                            {auction.currentPrice}
                          </p>
                          {/* Indicatore crediti */}
                          <span className="absolute -top-2 -right-2 lg:right-1/4 text-lg text-primary-300">€</span>
                        </div>

                        {/* Info offerente con badge */}
                        {auction.bids.length > 0 && auction.bids[0] && (
                          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full mt-2 ${
                            auction.bids[0].bidder.user.username === currentUsername
                              ? 'bg-green-500/20 border border-green-500/50'
                              : 'bg-primary-500/20 border border-primary-500/30'
                          }`}>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`w-4 h-4 ${auction.bids[0].bidder.user.username === currentUsername ? 'text-green-400' : 'text-primary-400'}`}>
                              <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
                            </svg>
                            <span className={`font-bold ${auction.bids[0].bidder.user.username === currentUsername ? 'text-green-400' : 'text-primary-300'}`}>
                              {auction.bids[0].bidder.user.username}
                              {auction.bids[0].bidder.user.username === currentUsername && ' (SEI TU!)'}
                            </span>
                          </div>
                        )}
                        {auction.bids.length === 0 && (
                          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface-400/50 mt-2">
                            <span className="text-gray-400">Base d'asta:</span>
                            <span className="text-white font-bold">{auction.basePrice}</span>
                          </div>
                        )}

                        {/* Contatore offerte */}
                        <div className="mt-4 text-xs text-gray-500">
                          {auction.bids.length} {auction.bids.length === 1 ? 'offerta' : 'offerte'} ricevute
                        </div>
                      </div>
                    </div>

                    {/*
                     * OLD_PRICE_START - Versione precedente per rollback
                     *
                    <div className="current-price-container rounded-xl p-5 text-center">
                      <p className="text-sm text-primary-400 mb-2 uppercase tracking-wider">Offerta Attuale</p>
                      <p className="text-5xl lg:text-6xl font-bold text-white text-glow mb-2">{auction.currentPrice}</p>
                      {auction.bids.length > 0 && auction.bids[0] && (
                        <p className={`text-lg ${auction.bids[0].bidder.user.username === currentUsername ? 'text-secondary-400 font-bold' : 'text-primary-400'}`}>
                          di {auction.bids[0].bidder.user.username}
                          {auction.bids[0].bidder.user.username === currentUsername && ' (TU)'}
                        </p>
                      )}
                      {auction.bids.length === 0 && (
                        <p className="text-gray-500">Base d'asta: {auction.basePrice}</p>
                      )}
                    </div>
                     * OLD_PRICE_END
                     */}

                    {/* Enhanced Bid Controls */}
                    <div className="space-y-3 bg-surface-300/50 rounded-xl p-4">
                      {/* Quick Bid Buttons */}
                      <div className="grid grid-cols-5 gap-2">
                        {[1, 5, 10, 20].map(n => {
                          const newBid = parseInt(bidAmount || '0') + n
                          return (
                            <Button
                              key={n}
                              size="sm"
                              variant="outline"
                              onClick={() => setBidAmount(String(newBid))}
                              disabled={isTimerExpired || (membership?.currentBudget || 0) < newBid}
                              className={`border-surface-50/30 text-gray-300 hover:border-primary-500/50 hover:bg-primary-500/10 font-mono ${
                                (membership?.currentBudget || 0) < newBid ? 'opacity-50 cursor-not-allowed' : ''
                              }`}
                            >
                              +{n}
                            </Button>
                          )
                        })}
                        <Button
                          size="sm"
                          variant="accent"
                          onClick={() => setBidAmount(String(membership?.currentBudget || 0))}
                          disabled={isTimerExpired || !membership?.currentBudget}
                          className="font-bold"
                        >
                          MAX
                        </Button>
                      </div>

                      {/* Main Bid Input with +/- */}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setBidAmount(String(Math.max(auction.currentPrice + 1, parseInt(bidAmount || '0') - 1)))}
                          disabled={isTimerExpired || parseInt(bidAmount || '0') <= auction.currentPrice + 1}
                          className="w-12 h-12 shrink-0 flex items-center justify-center rounded-lg bg-surface-300 text-white hover:bg-surface-300/70 text-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          −
                        </button>
                        <Input
                          type="number"
                          value={bidAmount}
                          onChange={e => setBidAmount(e.target.value)}
                          disabled={isTimerExpired}
                          className="flex-1 text-xl text-center bg-surface-300 border-surface-50/30 text-white font-mono"
                          placeholder="Importo..."
                          data-bid-input="true"
                        />
                        <button
                          type="button"
                          onClick={() => setBidAmount(String(parseInt(bidAmount || '0') + 1))}
                          disabled={isTimerExpired || parseInt(bidAmount || '0') + 1 > (membership?.currentBudget || 0)}
                          className="w-12 h-12 shrink-0 flex items-center justify-center rounded-lg bg-surface-300 text-white hover:bg-surface-300/70 text-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          +
                        </button>
                        <Button
                          onClick={handlePlaceBid}
                          disabled={isTimerExpired || !membership || membership.currentBudget < (parseInt(bidAmount) || 0)}
                          className={`btn-primary px-6 lg:px-8 font-bold ${isTimerExpired ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {isTimerExpired ? 'Scaduto' : 'Offri'}
                        </Button>
                      </div>

                      {/* Budget reminder */}
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>Il tuo budget:</span>
                        <span className="font-bold text-accent-400">{membership?.currentBudget || 0}</span>
                      </div>

                      {/* Keyboard shortcuts hint */}
                      <div className="hidden md:flex items-center gap-3 text-[10px] text-gray-600 mt-1">
                        <span><kbd className="px-1 py-0.5 bg-surface-300 rounded text-gray-500">Enter</kbd> Offri</span>
                        <span><kbd className="px-1 py-0.5 bg-surface-300 rounded text-gray-500">+</kbd><kbd className="px-1 py-0.5 bg-surface-300 rounded text-gray-500">-</kbd> Importo</span>
                        <span><kbd className="px-1 py-0.5 bg-surface-300 rounded text-gray-500">Esc</kbd> Reset</span>
                      </div>

                      {isAdmin && (
                        <Button variant="secondary" onClick={handleCloseAuction} className="w-full mt-2">
                          Chiudi Asta Manualmente
                        </Button>
                      )}
                    </div>

                    {/* Enhanced Bid History */}
                    {auction.bids.length > 0 && (
                      <div className="border-t border-surface-50/20 pt-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm text-gray-400 font-medium">Storico Offerte</h4>
                          <span className="text-xs text-gray-500">{auction.bids.length} offerte</span>
                        </div>
                        <div className="bid-history space-y-1.5">
                          {auction.bids.map((bid, i) => (
                            <div
                              key={bid.id}
                              className={`flex items-center justify-between py-2 px-3 rounded-lg transition-all ${
                                i === 0
                                  ? 'bg-gradient-to-r from-primary-500/20 to-primary-500/10 border border-primary-500/30'
                                  : 'bg-surface-300/50 hover:bg-surface-300'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {i === 0 && (
                                  <span className="w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center">
                                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                    </svg>
                                  </span>
                                )}
                                <span className={`${i === 0 ? 'text-white font-medium' : 'text-gray-300'} ${bid.bidder.user.username === currentUsername ? 'text-secondary-400' : ''}`}>
                                  {bid.bidder.user.username}
                                  {bid.bidder.user.username === currentUsername && ' (tu)'}
                                </span>
                              </div>
                              <span className={`font-mono font-bold ${i === 0 ? 'text-primary-400 text-lg' : 'text-white'}`}>
                                {bid.amount}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : !readyStatus?.hasPendingNomination && !pendingAck && (
                  <div>
                    {isMyTurn ? (
                      <div>
                        <div className="text-center mb-4">
                          <div className="text-4xl mb-2">🎯</div>
                          <p className="text-lg font-bold text-accent-400">È il tuo turno!</p>
                          <p className="text-sm text-gray-400">Seleziona un giocatore</p>
                        </div>
                        <Input placeholder="Cerca giocatore..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="mb-3 bg-surface-300 border-surface-50/30 text-white placeholder-gray-500" />
                        {/* Team Filter Dropdown */}
                        <div className="relative mb-3" data-team-dropdown>
                          <button
                            type="button"
                            onClick={() => setTeamDropdownOpen(!teamDropdownOpen)}
                            className="w-full bg-surface-300 border border-surface-50/30 text-white rounded-lg px-3 py-2 text-sm flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2">
                              {selectedTeam ? (
                                <>
                                  <div className="w-5 h-5 bg-white/90 rounded flex items-center justify-center p-0.5">
                                    <img src={getTeamLogo(selectedTeam)} alt={selectedTeam} className="w-4 h-4 object-contain" />
                                  </div>
                                  <span>{selectedTeam}</span>
                                </>
                              ) : (
                                <span className="text-gray-400">Tutte le squadre</span>
                              )}
                            </div>
                            <svg className={`w-4 h-4 transition-transform ${teamDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          {teamDropdownOpen && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-surface-200 border border-surface-50/30 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
                              <button
                                type="button"
                                onClick={() => { setSelectedTeam(''); setTeamDropdownOpen(false) }}
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-300 ${!selectedTeam ? 'bg-primary-500/20 text-primary-400' : 'text-white'}`}
                              >
                                Tutte le squadre
                              </button>
                              {availableTeams.map(team => (
                                <button
                                  key={team.name}
                                  type="button"
                                  onClick={() => { setSelectedTeam(team.name); setTeamDropdownOpen(false) }}
                                  className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-300 flex items-center gap-2 ${selectedTeam === team.name ? 'bg-primary-500/20 text-primary-400' : 'text-white'}`}
                                >
                                  <div className="w-5 h-5 bg-white/90 rounded flex items-center justify-center p-0.5 flex-shrink-0">
                                    <img src={getTeamLogo(team.name)} alt={team.name} className="w-4 h-4 object-contain" />
                                  </div>
                                  <span>{team.name}</span>
                                  <span className="text-xs text-gray-500 ml-auto">({team.playerCount})</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        {isPrimoMercato && marketProgress && (
                          <div className={`text-center py-2 px-3 rounded-lg mb-3 border ${POSITION_BG[marketProgress.currentRole]}`}>
                            <span className="font-medium">Solo {marketProgress.currentRoleName}</span>
                          </div>
                        )}
                        <div className="max-h-[45vh] overflow-y-auto space-y-1">
                          {players.length === 0 ? (
                            <p className="text-gray-500 text-center py-4">Nessun giocatore</p>
                          ) : players.slice(0, 50).map(player => (
                            <button key={player.id} onClick={() => handleNominatePlayer(player.id)} className="w-full flex items-center p-3 rounded-lg bg-surface-300 hover:bg-primary-500/10 border border-transparent hover:border-primary-500/30 transition-all text-left">
                              <div className="flex items-center gap-3 flex-1">
                                <span className={`w-8 h-8 rounded-full bg-gradient-to-br ${POSITION_COLORS[player.position]} flex items-center justify-center text-xs font-bold text-white flex-shrink-0`}>{player.position}</span>
                                <div className="w-7 h-7 bg-white/90 rounded flex items-center justify-center p-0.5 flex-shrink-0">
                                  <img
                                    src={getTeamLogo(player.team)}
                                    alt={player.team}
                                    className="w-6 h-6 object-contain"
                                  />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium text-white truncate">{player.name}</p>
                                  <p className="text-xs text-gray-400 truncate">{player.team}</p>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        {marketProgress && <div className={`w-20 h-20 mx-auto rounded-full bg-gradient-to-br ${POSITION_COLORS[marketProgress.currentRole]} flex items-center justify-center text-3xl font-bold text-white mb-4`}>{marketProgress.currentRole}</div>}
                        <p className="text-gray-400">In attesa...</p>
                        {currentTurnManager && <p className="text-sm text-gray-500 mt-1">Turno di <strong className="text-primary-400">{currentTurnManager.username}</strong></p>}
                      </div>
                    )}
                  </div>
                )}
                {/* Waiting for confirmation state - show when auction just ended */}
                {!auction && pendingAck && !readyStatus?.hasPendingNomination && (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-secondary-500/20 flex items-center justify-center">
                      <span className="text-3xl">⏳</span>
                    </div>
                    <p className="text-gray-400">Conferma transazione in corso...</p>
                  </div>
                )}
              </div>
            </div>
          </div>


          {/* RIGHT: DGs + Chat - Collapsible on mobile */}
          <div className={`lg:col-span-4 space-y-4 ${auction ? 'hidden lg:block' : ''}`}>
            <ManagersTable
              managersStatus={managersStatus}
              firstMarketStatus={firstMarketStatus}
              onSelectManager={setSelectedManager}
              getBudgetPercentage={getBudgetPercentage}
            />
          </div>
        </div>
      </main>

      <MobileBidControls
        auction={auction}
        timeLeft={timeLeft}
        timerSetting={timerSetting}
        isTimerExpired={isTimerExpired}
        isUserWinning={isUserWinning}
        membership={membership}
        bidAmount={bidAmount}
        setBidAmount={setBidAmount}
        onPlaceBid={handlePlaceBid}
      />

      <ManagerDetailModal
        selectedManager={selectedManager}
        onClose={() => setSelectedManager(null)}
      />

      <AcknowledgmentModal
        pendingAck={pendingAck}
        appealStatus={appealStatus}
        isAppealMode={isAppealMode}
        setIsAppealMode={setIsAppealMode}
        appealContent={appealContent}
        setAppealContent={setAppealContent}
        prophecyContent={prophecyContent}
        setProphecyContent={setProphecyContent}
        ackSubmitting={ackSubmitting}
        isAdmin={isAdmin}
        error={error}
        onAcknowledge={handleAcknowledge}
        onSimulateAppeal={handleSimulateAppeal}
        onNavigate={onNavigate}
        leagueId={leagueId}
      />

      <WaitingModal
        pendingAck={pendingAck}
        appealStatus={appealStatus}
        isAdmin={isAdmin}
        onForceAcknowledgeAll={handleForceAcknowledgeAll}
      />

      <AppealReviewModal
        appealStatus={appealStatus}
        pendingAck={pendingAck}
        isAdmin={isAdmin}
        onNavigate={onNavigate}
        leagueId={leagueId}
      />

      <AppealAckModal
        appealStatus={appealStatus}
        pendingAck={pendingAck}
        ackSubmitting={ackSubmitting}
        isAdmin={isAdmin}
        onAcknowledgeAppealDecision={handleAcknowledgeAppealDecision}
        onForceAllAppealAcks={handleForceAllAppealAcks}
      />

      <AwaitingResumeModal
        appealStatus={appealStatus}
        pendingAck={pendingAck}
        markingReady={markingReady}
        isAdmin={isAdmin}
        onReadyToResume={handleReadyToResume}
        onForceAllReadyResume={handleForceAllReadyResume}
      />

      {/* Contract Modification Modal after Primo Mercato Win */}
      {pendingContractModification && (
        <ContractModifierModal
          isOpen={true}
          onClose={handleSkipContractModification}
          player={{
            id: pendingContractModification.playerId,
            name: pendingContractModification.playerName,
            team: pendingContractModification.playerTeam,
            position: pendingContractModification.playerPosition,
          }}
          contract={{
            salary: pendingContractModification.salary,
            duration: pendingContractModification.duration,
            initialSalary: pendingContractModification.initialSalary,
            rescissionClause: pendingContractModification.rescissionClause,
          }}
          onConfirm={handleContractModification}
          title="Modifica Contratto"
          description="Hai appena acquistato questo giocatore. Puoi modificare il suo contratto seguendo le regole del rinnovo."
        />
      )}
    </div>
  )
}
