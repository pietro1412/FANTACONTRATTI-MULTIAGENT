import { Button } from '../components/ui/Button'
import { Navigation } from '../components/Navigation'
import { ContractModifierModal } from '../components/ContractModifier'
import { AuctionRoomLayout } from '../components/auction-room-v2'
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
import type { AuctionRoomProps } from '../types/auctionroom.types'
import {
  ManagerDetailModal, AcknowledgmentModal, WaitingModal,
  AppealReviewModal, AppealAckModal, AwaitingResumeModal,
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
    pendingContractModification,
    isAdmin, isPrimoMercato, hasTurnOrder,
    isMyTurn, currentTurnManager,
    isUserWinning, isTimerExpired, currentUsername,
    connectionStatus, isConnected,
    sensors, handleDragEnd,
    handleSetTurnOrder, handleNominatePlayer,
    handleConfirmNomination, handleCancelNomination,
    handleMarkReady, handleForceAllReady,
    handleBotBid, handleBotNominate, handleBotConfirmNomination,
    handleForceAcknowledgeAll, handleSimulateAppeal,
    handleAcknowledgeAppealDecision, handleReadyToResume,
    handleForceAllAppealAcks, handleForceAllReadyResume,
    handleResetFirstMarket, handleRequestPause, handlePauseAuction, handleResumeAuction,
    pauseRequest, dismissPauseRequest,
    handleCompleteAllSlots, handlePlaceBid, handleCloseAuction,
    handleUpdateTimer, handleAcknowledge,
    handleContractModification, handleSkipContractModification,
  } = useAuctionRoomState(sessionId, leagueId)

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
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
      <div className="min-h-screen">
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
      <div className="min-h-screen flex items-center justify-center">
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
    <div className="min-h-screen">
      <Navigation currentPage="auction" leagueId={leagueId} isLeagueAdmin={isAdmin} onNavigate={onNavigate} />

      <main className={`max-w-full mx-auto px-3 py-3 lg:px-4 lg:py-4 ${auction ? 'pb-40 lg:pb-4' : ''}`}>
        {/* Error/Success Messages */}
        {(error || successMessage) && (
          <div className="space-y-2 mb-3">
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
        )}

        {/* Unified Layout */}
        <AuctionRoomLayout
          auction={auction}
          timeLeft={timeLeft}
          timerSetting={timerSetting}
          isTimerExpired={isTimerExpired}
          membership={membership}
          isAdmin={isAdmin}
          isMyTurn={isMyTurn}
          isUserWinning={isUserWinning}
          currentUsername={currentUsername}
          managersStatus={managersStatus}
          currentTurnManager={currentTurnManager}
          firstMarketStatus={firstMarketStatus}
          myRosterSlots={myRosterSlots}
          marketProgress={marketProgress}
          bidAmount={bidAmount}
          setBidAmount={setBidAmount}
          onPlaceBid={handlePlaceBid}
          isConnected={isConnected}
          connectionStatus={connectionStatus}
          readyStatus={readyStatus}
          onMarkReady={handleMarkReady}
          onConfirmNomination={handleConfirmNomination}
          onCancelNomination={handleCancelNomination}
          markingReady={markingReady}
          pendingAck={pendingAck}
          onAcknowledge={() => handleAcknowledge(false)}
          ackSubmitting={ackSubmitting}
          players={players}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedTeam={selectedTeam}
          onTeamChange={setSelectedTeam}
          availableTeams={availableTeams}
          teamDropdownOpen={teamDropdownOpen}
          setTeamDropdownOpen={setTeamDropdownOpen}
          onNominatePlayer={handleNominatePlayer}
          onSelectManager={setSelectedManager}
          onCloseAuction={handleCloseAuction}
          onUpdateTimer={handleUpdateTimer}
          onBotNominate={handleBotNominate}
          onBotConfirmNomination={handleBotConfirmNomination}
          onBotBid={handleBotBid}
          onForceAllReady={handleForceAllReady}
          onForceAcknowledgeAll={handleForceAcknowledgeAll}
          onCompleteAllSlots={handleCompleteAllSlots}
          onResetFirstMarket={handleResetFirstMarket}
          onPauseAuction={handlePauseAuction}
          onResumeAuction={handleResumeAuction}
          onRequestPause={handleRequestPause}
          pauseRequest={pauseRequest}
          dismissPauseRequest={dismissPauseRequest}
          isPrimoMercato={isPrimoMercato}
          onNavigate={onNavigate}
          leagueId={leagueId}
        />
      </main>

      {/* All Modals - Unchanged */}
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
