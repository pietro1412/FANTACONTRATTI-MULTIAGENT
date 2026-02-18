import { useState } from 'react'
import { Settings } from 'lucide-react'
import { useRubataState } from '../hooks/useRubataState'
import { Button } from '../components/ui/Button'
import { BottomSheet } from '../components/ui/BottomSheet'
import { Navigation } from '../components/Navigation'
import { getPlayerPhotoUrl } from '../utils/player-images'
import { ContractModifierModal } from '../components/ContractModifier'
import { PlayerStatsModal } from '../components/PlayerStatsModal'
import { RubataStepper } from '../components/rubata/RubataStepper'
import { PreferenceModal } from '../components/rubata/PreferenceModal'
import { TeamLogo } from '../components/rubata/TeamLogo'
import {
  PendingAckModal,
  AppealReviewModal,
  AppealAckModal,
  AwaitingResumeModal,
  AuctionReadyCheckModal,
} from '../components/rubata/RubataModals'
import {
  BudgetPanel,
  TimerSettingsPanel,
  BotSimulationPanel,
  CompleteRubataPanel,
} from '../components/rubata/RubataAdminControls'
import { RubataTimerPanel } from '../components/rubata/RubataTimerPanel'
import { RubataBidPanel } from '../components/rubata/RubataBidPanel'
import { POSITION_COLORS } from '../types/rubata.types'
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface SortableOrderItemProps {
  id: string
  index: number
  memberName: string
  totalItems: number
  onMoveUp: () => void
  onMoveDown: () => void
}

function SortableOrderItem({ id, index, memberName, totalItems, onMoveUp, onMoveDown }: SortableOrderItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between p-3 bg-surface-300 rounded-xl border-2 transition-all ${
        isDragging
          ? 'border-primary-500 opacity-50 scale-95'
          : 'border-surface-50/20 hover:border-primary-500/50'
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className="text-gray-500 cursor-grab active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>
          </svg>
        </span>
        <span className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-400 font-bold text-sm">
          {index + 1}
        </span>
        <span className="text-white font-medium">{memberName}</span>
      </div>
      <div className="flex gap-1">
        <button
          onClick={onMoveUp}
          disabled={index === 0}
          aria-label={`Sposta ${memberName} in su`}
          className="w-8 h-8 flex items-center justify-center bg-surface-50/10 hover:bg-surface-50/20 rounded-lg text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          ↑
        </button>
        <button
          onClick={onMoveDown}
          disabled={index === totalItems - 1}
          aria-label={`Sposta ${memberName} in giù`}
          className="w-8 h-8 flex items-center justify-center bg-surface-50/10 hover:bg-surface-50/20 rounded-lg text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          ↓
        </button>
      </div>
    </div>
  )
}

interface RubataProps {
  leagueId: string
  onNavigate: (page: string, params?: Record<string, string>) => void
}

export function Rubata({ leagueId, onNavigate }: RubataProps) {
  const {
    // Loading / meta
    isLoading, isAdmin, error, success, isSubmitting,
    // Core data
    members, boardData, board, rubataState, currentPlayer,
    activeAuction, myMemberId, isRubataPhase, isOrderSet,
    canMakeOffer, isPusherConnected,
    // Timer
    timerDisplay, offerTimer, setOfferTimer, auctionTimer, setAuctionTimer,
    // Budget
    mobileBudgetExpanded, setMobileBudgetExpanded,
    // Ready check & ack
    readyStatus, pendingAck,
    // Appeal
    appealStatus, isAppealMode, setIsAppealMode, appealContent, setAppealContent,
    // Prophecy
    prophecyContent, setProphecyContent,
    // Bid
    bidAmount, setBidAmount,
    // Admin simulation
    simulateMemberId, setSimulateMemberId, simulateBidAmount, setSimulateBidAmount,
    // Order draft + drag & drop
    orderDraft, moveInOrder,
    handleDndDragEnd, handleDndDragStart,
    // Preferences
    preferencesMap, selectedPlayerForPrefs, openPrefsModal, closePrefsModal,
    currentPlayerPreference, canEditPreferences,
    // Progress
    progressStats,
    // Scroll helpers
    currentPlayerRef, isCurrentPlayerVisible, scrollToCurrentPlayer,
    // Contract modification
    pendingContractModification,
    // Player stats
    selectedPlayerForStats, setSelectedPlayerForStats,
    // Admin handlers
    handleSetOrder, handleGenerateBoard, handleStartRubata, handleUpdateTimers,
    handlePause, handleResume, handleAdvance, handleGoBack,
    handleCloseAuction, handleCompleteRubata,
    // Player handlers
    handleMakeOffer, handleBid,
    // Ready check
    handleSetReady, handleForceAllReady,
    // Ack
    handleAcknowledgeWithAppeal, handleForceAllAcknowledge,
    // Appeal handlers
    handleAcknowledgeAppealDecision, handleMarkReadyToResume,
    handleForceAllAppealAcks, handleForceAllReadyResume, handleSimulateAppeal,
    // Contract
    handleContractModification, handleSkipContractModification,
    // Simulation
    handleSimulateOffer, handleSimulateBid,
    // Preferences handlers
    handleSavePreference, handleDeletePreference,
    // Retry / reload
    setError, loadData,
  } = useRubataState(leagueId)

  const [adminSheetOpen, setAdminSheetOpen] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Navigation currentPage="rubata" leagueId={leagueId} isLeagueAdmin={isAdmin} onNavigate={onNavigate} />
        <div className="flex items-center justify-center h-[80vh]">
          <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <Navigation currentPage="rubata" leagueId={leagueId} isLeagueAdmin={isAdmin} onNavigate={onNavigate} />


      {/* Modals */}
      {rubataState === 'PENDING_ACK' && pendingAck && (
        <PendingAckModal
          pendingAck={pendingAck}
          isAdmin={isAdmin}
          isSubmitting={isSubmitting}
          appealStatus={appealStatus}
          isAppealMode={isAppealMode}
          setIsAppealMode={setIsAppealMode}
          appealContent={appealContent}
          setAppealContent={setAppealContent}
          prophecyContent={prophecyContent}
          setProphecyContent={setProphecyContent}
          onAcknowledgeWithAppeal={() => void handleAcknowledgeWithAppeal()}
          onSimulateAppeal={() => void handleSimulateAppeal()}
          onForceAllAcknowledge={() => void handleForceAllAcknowledge()}
          onNavigate={onNavigate}
          leagueId={leagueId}
        />
      )}

      {appealStatus?.auctionStatus === 'APPEAL_REVIEW' && (
        <AppealReviewModal
          appealStatus={appealStatus}
          isAdmin={isAdmin}
          onNavigate={onNavigate}
          leagueId={leagueId}
        />
      )}

      {appealStatus?.auctionStatus === 'AWAITING_APPEAL_ACK' && (
        <AppealAckModal
          appealStatus={appealStatus}
          isAdmin={isAdmin}
          isSubmitting={isSubmitting}
          onAcknowledgeAppealDecision={() => void handleAcknowledgeAppealDecision()}
          onForceAllAppealAcks={() => void handleForceAllAppealAcks()}
        />
      )}

      {appealStatus?.auctionStatus === 'AWAITING_RESUME' && (
        <AwaitingResumeModal
          appealStatus={appealStatus}
          isAdmin={isAdmin}
          isSubmitting={isSubmitting}
          onMarkReadyToResume={() => void handleMarkReadyToResume()}
          onForceAllReadyResume={() => void handleForceAllReadyResume()}
        />
      )}

      {rubataState === 'AUCTION_READY_CHECK' && boardData && readyStatus && (
        <AuctionReadyCheckModal
          boardData={boardData}
          readyStatus={readyStatus}
          isAdmin={isAdmin}
          isSubmitting={isSubmitting}
          onSetReady={() => void handleSetReady()}
          onForceAllReady={() => void handleForceAllReady()}
        />
      )}


      <main className="max-w-[1600px] mx-auto px-4 py-8">
        {error && (
          <div className="bg-danger-500/20 border border-danger-500/30 text-danger-400 p-3 rounded-lg mb-4">
            <p>{error}</p>
            <button
              onClick={() => { setError(''); void loadData(); }}
              className="mt-4 px-4 py-2 bg-primary-500 hover:bg-primary-400 text-white rounded-lg transition-colors min-h-[44px]"
            >
              Riprova
            </button>
          </div>
        )}
        {success && (
          <div className="bg-secondary-500/20 border border-secondary-500/30 text-secondary-400 p-3 rounded-lg mb-4">{success}</div>
        )}

        {/* Fase non RUBATA */}
        {!isRubataPhase && (
          <div className="bg-surface-200 rounded-2xl border border-surface-50/20 p-8 text-center">
            <div className="w-20 h-20 rounded-full bg-warning-500/20 flex items-center justify-center mx-auto mb-4">
              <span className="text-5xl">🎯</span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Fase RUBATA non attiva</h2>
            <p className="text-gray-400 max-w-lg mx-auto">
              La fase rubata inizierà dopo il consolidamento dei contratti.
              Attendi che l'admin della lega passi alla fase RUBATA.
            </p>
          </div>
        )}

        {/* Fase RUBATA - Setup ordine (Admin) */}
        {isRubataPhase && !isOrderSet && isAdmin && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Order Management */}
            <div className="bg-surface-200 rounded-2xl border border-surface-50/20 overflow-hidden">
              <div className="p-5 border-b border-surface-50/20">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span className="text-xl">📋</span>
                  Ordine Rubata
                </h3>
                <p className="text-sm text-gray-400 mt-1">Trascina i manager per impostare l'ordine dei turni</p>
              </div>
              <div className="p-5">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDndDragEnd} onDragStart={handleDndDragStart}>
                  <SortableContext items={orderDraft} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2 mb-4">
                      {orderDraft.map((memberId, index) => {
                        const member = members.find(m => m.id === memberId)
                        const memberName = member?.user?.username || member?.teamName || 'Unknown'
                        return (
                          <SortableOrderItem
                            key={memberId}
                            id={memberId}
                            index={index}
                            memberName={memberName}
                            totalItems={orderDraft.length}
                            onMoveUp={() => { moveInOrder(index, 'up'); }}
                            onMoveDown={() => { moveInOrder(index, 'down'); }}
                          />
                        )
                      })}
                    </div>
                  </SortableContext>
                </DndContext>
                <Button onClick={() => void handleSetOrder()} disabled={isSubmitting} className="w-full">
                  {isSubmitting ? 'Salvando...' : 'Conferma Ordine'}
                </Button>
              </div>
            </div>

            {/* Timer Settings */}
            <div className="bg-surface-200 rounded-2xl border border-surface-50/20 overflow-hidden">
              <div className="p-5 border-b border-surface-50/20">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span className="text-xl">⏱️</span>
                  Impostazioni Timer
                </h3>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Timer offerta iniziale (secondi)</label>
                  <input
                    type="number"
                    value={offerTimer}
                    onChange={(e) => { setOfferTimer(parseInt(e.target.value) || 30); }}
                    min={5}
                    max={120}
                    className="w-full px-4 py-2 bg-surface-300 border border-surface-50/30 rounded-xl text-white focus:border-primary-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Timer asta (secondi)</label>
                  <input
                    type="number"
                    value={auctionTimer}
                    onChange={(e) => { setAuctionTimer(parseInt(e.target.value) || 15); }}
                    min={5}
                    max={60}
                    className="w-full px-4 py-2 bg-surface-300 border border-surface-50/30 rounded-xl text-white focus:border-primary-500 focus:outline-none"
                  />
                </div>
                <Button onClick={() => void handleUpdateTimers()} disabled={isSubmitting} variant="outline" className="w-full">
                  Salva Timer
                </Button>
                <hr className="border-surface-50/20" />
                <Button onClick={() => void handleGenerateBoard()} disabled={isSubmitting} className="w-full">
                  Genera Tabellone
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Fase RUBATA ma ordine non impostato - Vista per non-admin */}
        {isRubataPhase && !isOrderSet && !isAdmin && (
          <div className="bg-surface-200 rounded-2xl border border-surface-50/20 p-8 text-center">
            <div className="w-20 h-20 rounded-full bg-primary-500/20 flex items-center justify-center mx-auto mb-4">
              <span className="text-5xl animate-pulse">⏳</span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">In attesa dell'ordine rubata</h2>
            <p className="text-gray-400 max-w-lg mx-auto">
              L'admin della lega sta impostando l'ordine di rubata.
              Una volta confermato, potrai vedere il tabellone e partecipare alle aste.
            </p>
          </div>
        )}

        {/* Tabellone e controlli - Board generato */}
        {isRubataPhase && isOrderSet && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Left Sidebar - Budget + Admin controls */}
            <div className="hidden lg:block lg:col-span-1 space-y-4">
              {/* Budget Residuo Panel - visible to all */}
              {boardData?.memberBudgets && boardData.memberBudgets.length > 0 && (
                <BudgetPanel memberBudgets={boardData.memberBudgets} />
              )}

              {/* Admin-only panels */}
              {isAdmin && (<>
                <TimerSettingsPanel
                  offerTimer={offerTimer}
                  setOfferTimer={setOfferTimer}
                  auctionTimer={auctionTimer}
                  setAuctionTimer={setAuctionTimer}
                  isSubmitting={isSubmitting}
                  onUpdateTimers={() => void handleUpdateTimers()}
                />
                <BotSimulationPanel
                  rubataState={rubataState ?? null}
                  activeAuction={activeAuction ?? null}
                  members={members}
                  myMemberId={myMemberId}
                  currentPlayerMemberId={currentPlayer?.memberId}
                  simulateMemberId={simulateMemberId}
                  setSimulateMemberId={setSimulateMemberId}
                  simulateBidAmount={simulateBidAmount}
                  setSimulateBidAmount={setSimulateBidAmount}
                  isSubmitting={isSubmitting}
                  onSimulateOffer={() => void handleSimulateOffer()}
                  onSimulateBid={() => void handleSimulateBid()}
                />
                <CompleteRubataPanel
                  rubataState={rubataState ?? null}
                  isSubmitting={isSubmitting}
                  onCompleteRubata={() => void handleCompleteRubata()}
                />
              </>)}
            </div>

            {/* Main Content */}
            <div className="lg:col-span-4">
            {/* Stepper visivo flusso rubata */}
            <RubataStepper currentState={rubataState ?? null} className="mb-4" />

            {/* Timer e stato corrente */}
            <RubataTimerPanel
              rubataState={rubataState ?? null}
              currentPlayer={currentPlayer ?? null}
              currentPlayerPreference={currentPlayerPreference}
              myMemberId={myMemberId}
              timerDisplay={timerDisplay}
              isPusherConnected={isPusherConnected}
              progressStats={progressStats}
              canMakeOffer={canMakeOffer}
              isAdmin={isAdmin}
              isSubmitting={isSubmitting}
              boardData={boardData}
              onStartRubata={() => void handleStartRubata()}
              onResume={() => void handleResume()}
              onPause={() => void handlePause()}
              onGoBack={() => void handleGoBack()}
              onAdvance={() => void handleAdvance()}
              onCloseAuction={() => void handleCloseAuction()}
              onMakeOffer={() => void handleMakeOffer()}
            />


            {/* Preference Edit Modal - componente separato per evitare re-render */}
            {selectedPlayerForPrefs && (
              <PreferenceModal
                player={selectedPlayerForPrefs}
                onClose={closePrefsModal}
                onSave={handleSavePreference}
                onDelete={handleDeletePreference}
                isSubmitting={isSubmitting}
              />
            )}

            {/* Ready Check Panel - With pending members list */}
            {rubataState === 'READY_CHECK' && readyStatus && (
              <div className="mb-4 bg-surface-200 rounded-xl border border-blue-500/50 p-4">
                <div className="flex items-center justify-between gap-4 flex-wrap mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🔔</span>
                    <div>
                      <span className="font-bold text-blue-400">Pronti?</span>
                      <span className="text-gray-400 text-sm ml-2">{readyStatus.readyCount}/{readyStatus.totalMembers}</span>
                    </div>
                    <div className="w-24 h-2 bg-surface-300 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all"
                        style={{ width: `${(readyStatus.readyCount / readyStatus.totalMembers) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {!readyStatus.userIsReady ? (
                      <Button onClick={() => void handleSetReady()} disabled={isSubmitting} size="sm">
                        ✅ Sono Pronto
                      </Button>
                    ) : (
                      <span className="px-3 py-1 bg-secondary-500/20 border border-secondary-500/40 rounded-lg text-secondary-400 text-sm">
                        ✓ Pronto
                      </span>
                    )}
                    {isAdmin && (
                      <Button onClick={() => void handleForceAllReady()} disabled={isSubmitting} variant="outline" size="sm" className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10">
                        🤖 Forza Tutti Pronti
                      </Button>
                    )}
                  </div>
                </div>
                {/* Pending members list */}
                {readyStatus.pendingMembers.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap text-sm">
                    <span className="text-gray-500">In attesa:</span>
                    {readyStatus.pendingMembers.map((member, _idx) => (
                      <span key={member.id} className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-warning-500/20 text-warning-400 rounded text-xs">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            member.isConnected === true ? 'bg-green-500' : member.isConnected === false ? 'bg-red-500' : 'bg-gray-500'
                          }`}
                          title={member.isConnected ? 'Online' : 'Offline'}
                        />
                        {member.username}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* PAUSED State Panel - Ready check to resume */}
            {rubataState === 'PAUSED' && readyStatus && (
              <div className="mb-4 bg-surface-200 rounded-xl border border-gray-500/50 p-4">
                <div className="flex items-center justify-between gap-4 flex-wrap mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">⏸️</span>
                    <div>
                      <span className="font-bold text-gray-300">IN PAUSA</span>
                      {boardData?.pausedRemainingSeconds != null && (
                        <span className="text-yellow-400 text-sm ml-2">
                          ({boardData.pausedRemainingSeconds}s rimanenti - {boardData.pausedFromState === 'AUCTION' ? 'Asta' : 'Offerta'})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Ready check for resume */}
                <div className="bg-surface-300/50 rounded-lg p-3 mb-3">
                  <div className="flex items-center justify-between gap-4 flex-wrap mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">🔔</span>
                      <div>
                        <span className="font-medium text-blue-400">Pronti a riprendere?</span>
                        <span className="text-gray-400 text-sm ml-2">{readyStatus.readyCount}/{readyStatus.totalMembers}</span>
                      </div>
                      <div className="w-24 h-2 bg-surface-300 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 transition-all"
                          style={{ width: `${(readyStatus.readyCount / readyStatus.totalMembers) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {!readyStatus.userIsReady ? (
                        <Button onClick={() => void handleSetReady()} disabled={isSubmitting} size="sm">
                          ✅ Sono Pronto
                        </Button>
                      ) : (
                        <span className="px-3 py-1 bg-secondary-500/20 border border-secondary-500/40 rounded-lg text-secondary-400 text-sm">
                          ✓ Pronto
                        </span>
                      )}
                      {isAdmin && (
                        <Button onClick={() => void handleForceAllReady()} disabled={isSubmitting} variant="outline" size="sm" className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10">
                          🤖 Forza Tutti Pronti
                        </Button>
                      )}
                    </div>
                  </div>
                  {/* Pending members list */}
                  {readyStatus.pendingMembers.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap text-sm">
                      <span className="text-gray-500">In attesa:</span>
                      {readyStatus.pendingMembers.map((member, _idx) => (
                        <span key={member.id} className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-warning-500/20 text-warning-400 rounded text-xs">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              member.isConnected === true ? 'bg-green-500' : member.isConnected === false ? 'bg-red-500' : 'bg-gray-500'
                            }`}
                            title={member.isConnected ? 'Online' : 'Offline'}
                          />
                          {member.username}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <p className="text-gray-400 text-xs text-center">
                  L'admin ha messo in pausa la rubata. Tutti i manager devono confermare di essere pronti per riprendere.
                </p>
              </div>
            )}

            {/* Pending Acknowledgment is now a modal - see below */}

            {/* Active Auction Panel */}
            {activeAuction && rubataState === 'AUCTION' && (
              <RubataBidPanel
                activeAuction={activeAuction}
                myMemberId={myMemberId}
                bidAmount={bidAmount}
                setBidAmount={setBidAmount}
                isSubmitting={isSubmitting}
                onBid={() => void handleBid()}
              />
            )}


            {/* Tabellone completo */}
            <div className="bg-surface-200 rounded-2xl border border-surface-50/20 overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 420px)', minHeight: '300px' }}>
              <div className="p-5 border-b border-surface-50/20 shrink-0">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span className="text-xl">📋</span>
                  Tabellone Rubata
                </h3>
                <p className="text-sm text-gray-400 mt-1">{boardData?.totalPlayers} giocatori in ordine di rubata</p>
              </div>

              {/* Desktop: Table View - Scrollable */}
              <div className="hidden md:block overflow-y-auto flex-1">
                <table className="w-full text-sm table-fixed">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-surface-300 text-[11px] text-gray-400 uppercase tracking-wide">
                      <th className="text-center py-2 w-[3%]">#</th>
                      <th className="text-left pl-2 py-2 w-[18%]">Giocatore</th>
                      <th className="text-center py-2 w-[5%]">Pos</th>
                      <th className="text-center py-2 w-[5%]">Età</th>
                      <th className="text-left px-2 py-2 w-[10%]">Propr.</th>
                      <th className="text-center py-2 w-[5%]">Ing.</th>
                      <th className="text-center py-2 w-[5%]">Dur.</th>
                      <th className="text-center py-2 w-[6%]">Claus.</th>
                      <th className="text-center py-2 w-[7%]">Rubata</th>
                      <th className="text-center py-2 w-[13%]">Nuovo Prop.</th>
                      <th className="text-center py-2 w-[11%]">Strategia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {board?.map((player, globalIndex) => {
                      const isCurrent = globalIndex === boardData?.currentIndex
                      const isPassed = globalIndex < (boardData?.currentIndex ?? 0)
                      const wasStolen = !!player.stolenByUsername

                      return (
                        <tr
                          key={player.rosterId}
                          ref={isCurrent ? currentPlayerRef as React.RefObject<HTMLTableRowElement> : null}
                          className={`border-t border-surface-50/10 transition-all ${
                            isCurrent
                              ? 'bg-primary-500/30 ring-2 ring-inset ring-primary-400 shadow-lg'
                              : isPassed
                              ? wasStolen
                                ? 'bg-danger-500/10'
                                : 'bg-surface-50/5 opacity-60'
                              : 'hover:bg-surface-300/30'
                          }`}
                        >
                          <td className="text-center py-2 font-mono text-[11px]">
                            {isCurrent ? (
                              <span className="inline-flex items-center justify-center w-5 h-5 bg-primary-500 text-white rounded-full animate-pulse font-bold text-[10px]">
                                {globalIndex + 1}
                              </span>
                            ) : (
                              <span className={isPassed ? 'text-gray-500' : 'text-gray-500'}>{globalIndex + 1}</span>
                            )}
                          </td>
                          <td className="pl-2 py-2">
                            <div className="flex items-center gap-1.5">
                              {player.playerApiFootballId ? (
                                <img
                                  src={getPlayerPhotoUrl(player.playerApiFootballId)}
                                  alt={player.playerName}
                                  className="w-7 h-7 rounded-full object-cover bg-surface-300 flex-shrink-0"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none'
                                  }}
                                />
                              ) : (
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${POSITION_COLORS[player.playerPosition] ?? ''}`}>
                                  {player.playerPosition}
                                </div>
                              )}
                              <div className="w-5 h-5 bg-white rounded p-0.5 flex-shrink-0">
                                <TeamLogo team={player.playerTeam} />
                              </div>
                              <button
                                type="button"
                                onClick={() => { setSelectedPlayerForStats({
                                  name: player.playerName,
                                  team: player.playerTeam,
                                  position: player.playerPosition,
                                  quotation: player.playerQuotation,
                                  age: player.playerAge,
                                  apiFootballId: player.playerApiFootballId,
                                  computedStats: player.playerComputedStats,
                                }); }}
                                className={`font-medium truncate hover:underline cursor-pointer text-left ${isCurrent ? 'text-white font-bold' : isPassed ? 'text-gray-500' : 'text-gray-300 hover:text-white'}`}
                                title="Clicca per vedere statistiche"
                              >
                                {player.playerName}
                              </button>
                            </div>
                          </td>
                          <td className="py-2 text-center">
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-[10px] font-bold ${isPassed ? 'opacity-40' : ''} ${POSITION_COLORS[player.playerPosition] ?? ''}`}>
                              {player.playerPosition}
                            </span>
                          </td>
                          <td className="py-2 text-center">
                            <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                              isPassed ? 'text-gray-500 bg-transparent' :
                              (player.playerAge ?? 99) <= 23 ? 'text-green-400 bg-green-500/10' :
                              (player.playerAge ?? 99) <= 27 ? 'text-blue-400 bg-blue-500/10' :
                              (player.playerAge ?? 99) <= 30 ? 'text-yellow-400 bg-yellow-500/10' :
                              'text-orange-400 bg-orange-500/10'
                            }`}>
                              {player.playerAge || '—'}
                            </span>
                          </td>
                          <td className="px-2 py-2">
                            <span className={`text-xs truncate block ${isPassed && wasStolen ? 'text-gray-500 line-through' : isPassed ? 'text-gray-500' : 'text-gray-400'}`}>
                              {player.ownerUsername}
                            </span>
                          </td>
                          <td className="py-2 text-center">
                            <span className={`text-xs ${isCurrent ? 'text-accent-400' : isPassed ? 'text-gray-500' : 'text-accent-400'}`}>
                              {player.contractSalary}
                            </span>
                          </td>
                          <td className="py-2 text-center">
                            <span className={`text-xs font-medium ${
                              isPassed ? 'text-gray-500' :
                              player.contractDuration === 1 ? 'text-danger-400' :
                              player.contractDuration === 2 ? 'text-warning-400' :
                              player.contractDuration === 3 ? 'text-blue-400' :
                              'text-secondary-400'
                            }`}>
                              {player.contractDuration}
                            </span>
                          </td>
                          <td className="py-2 text-center">
                            <span className={`text-xs ${isPassed ? 'text-gray-500' : 'text-gray-400'}`}>
                              {player.contractClause}
                            </span>
                          </td>
                          <td className="py-2 text-center">
                            <span className={`font-bold ${isCurrent ? 'text-primary-400 text-sm' : isPassed ? 'text-gray-500 text-xs' : 'text-warning-400 text-sm'}`}>
                              {player.rubataPrice}M
                            </span>
                          </td>
                          <td className="px-1 py-2 text-center">
                            {wasStolen ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-danger-500/20 border border-danger-500/30 text-danger-400 font-bold text-xs truncate">
                                🎯 {player.stolenByUsername}
                              </span>
                            ) : isPassed ? (
                              <span className="text-secondary-500/60 text-xs">✓</span>
                            ) : (
                              <span className="text-gray-500 text-xs">—</span>
                            )}
                          </td>
                          <td className="p-2 text-center">
                            {(() => {
                              const pref = preferencesMap.get(player.playerId)
                              const isMyPlayer = player.memberId === myMemberId
                              if (isMyPlayer) return <span className="text-gray-500 text-xs">Mio</span>
                              const hasStrategy = pref?.priority || pref?.maxBid || pref?.notes
                              return (
                                <div className="flex items-center justify-center gap-1">
                                  {/* Strategy indicators */}
                                  {pref?.priority && (
                                    <span className="text-purple-400 text-[10px]" title={`Priorità ${pref.priority}`}>
                                      {'★'.repeat(pref.priority)}
                                    </span>
                                  )}
                                  {pref?.maxBid && (
                                    <span className="text-blue-400 text-[10px]" title={`Max ${pref.maxBid}M`}>
                                      {pref.maxBid}M
                                    </span>
                                  )}
                                  {pref?.notes && !pref.priority && !pref.maxBid && (
                                    <span className="text-gray-400 text-xs" title={pref.notes}>📝</span>
                                  )}
                                  {/* Edit button */}
                                  {canEditPreferences && (
                                    <button
                                      type="button"
                                      onClick={() => { openPrefsModal({ ...player, preference: pref || null }); }}
                                      className={`w-6 h-6 rounded flex items-center justify-center text-xs transition-all ${
                                        hasStrategy ? 'bg-indigo-500/30 text-indigo-400' : 'bg-surface-50/20 text-gray-500 hover:bg-indigo-500/20'
                                      }`}
                                      title="Imposta strategia"
                                    >
                                      ⚙️
                                    </button>
                                  )}
                                </div>
                              )
                            })()}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile: Card View - Scrollable */}
              <div className="md:hidden p-4 pb-24 space-y-3 overflow-y-auto flex-1">
                {board?.map((player, globalIndex) => {
                  const isCurrent = globalIndex === boardData?.currentIndex
                  const isPassed = globalIndex < (boardData?.currentIndex ?? 0)
                  const wasStolen = !!player.stolenByUsername

                  return (
                    <div
                      key={player.rosterId}
                      ref={isCurrent ? currentPlayerRef as React.RefObject<HTMLDivElement> : null}
                      className={`p-3 rounded-lg border transition-all ${
                        isCurrent
                          ? 'bg-primary-500/30 border-primary-400 ring-2 ring-primary-400/50 shadow-lg'
                          : isPassed
                          ? wasStolen
                            ? 'bg-danger-500/10 border-danger-500/30'
                            : 'bg-surface-50/5 border-surface-50/10 opacity-60'
                          : 'bg-surface-300 border-surface-50/20'
                      }`}
                    >
                      {/* Header: numero e giocatore */}
                      <div className="flex items-center gap-2 mb-2">
                        {isCurrent ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 bg-primary-500 text-white rounded-full text-xs font-bold animate-pulse">
                            {globalIndex + 1}
                          </span>
                        ) : (
                          <span className={`text-xs font-mono w-6 text-center ${isPassed ? 'text-gray-500' : 'text-gray-500'}`}>
                            #{globalIndex + 1}
                          </span>
                        )}
                        {/* Player photo */}
                        {player.playerApiFootballId ? (
                          <img
                            src={getPlayerPhotoUrl(player.playerApiFootballId)}
                            alt={player.playerName}
                            className="w-8 h-8 rounded-full object-cover bg-surface-300 flex-shrink-0"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none'
                            }}
                          />
                        ) : (
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${POSITION_COLORS[player.playerPosition] ?? ''}`}>
                            {player.playerPosition}
                          </div>
                        )}
                        <div className="w-6 h-6 bg-white rounded p-0.5 flex-shrink-0">
                          <TeamLogo team={player.playerTeam} />
                        </div>
                        <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[8px] font-bold flex-shrink-0 ${POSITION_COLORS[player.playerPosition] ?? ''}`}>
                          {player.playerPosition}
                        </span>
                        <button
                          type="button"
                          onClick={() => { setSelectedPlayerForStats({
                            name: player.playerName,
                            team: player.playerTeam,
                            position: player.playerPosition,
                            quotation: player.playerQuotation,
                            age: player.playerAge,
                            apiFootballId: player.playerApiFootballId,
                            computedStats: player.playerComputedStats,
                          }); }}
                          className={`font-medium flex-1 truncate text-left ${isCurrent ? 'text-white font-bold' : isPassed ? 'text-gray-500' : 'text-gray-300'}`}
                        >
                          {player.playerName}
                        </button>
                        {isCurrent && (
                          <span className="text-[10px] bg-primary-500 text-white px-2 py-0.5 rounded-full shrink-0">
                            SUL PIATTO
                          </span>
                        )}
                      </div>

                      {/* Proprietario + Età */}
                      <div className="text-xs text-gray-500 mb-2 pl-6">
                        di <span className={isPassed && wasStolen ? 'text-gray-500 line-through' : 'text-gray-400'}>{player.ownerUsername}</span>
                        {player.ownerTeamName && <span className="text-gray-500"> ({player.ownerTeamName})</span>}
                        {player.playerAge && <span className="text-gray-500"> · {player.playerAge}a</span>}
                      </div>

                      {/* Nuovo proprietario se rubato */}
                      {wasStolen && (
                        <div className="mb-2 ml-6 flex items-center gap-1 text-sm">
                          <span className="text-danger-400">🎯</span>
                          <span className="text-danger-400 font-bold">{player.stolenByUsername}</span>
                          {player.stolenPrice && player.stolenPrice > player.rubataPrice && (
                            <span className="text-danger-500 text-xs">({player.stolenPrice}M)</span>
                          )}
                        </div>
                      )}

                      {/* Dettagli contratto */}
                      <div className={`grid grid-cols-4 gap-2 rounded p-2 ${isPassed ? 'bg-surface-50/5' : 'bg-surface-50/10'}`}>
                        <div className="text-center">
                          <div className="text-[10px] text-gray-500 uppercase">Ingaggio</div>
                          <div className={`font-medium text-sm ${isPassed ? 'text-gray-500' : 'text-accent-400'}`}>
                            {player.contractSalary}M
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-[10px] text-gray-500 uppercase">Durata</div>
                          <div className={`font-medium text-sm ${
                            isPassed ? 'text-gray-500' :
                            player.contractDuration === 1 ? 'text-danger-400' :
                            player.contractDuration === 2 ? 'text-warning-400' :
                            player.contractDuration === 3 ? 'text-blue-400' :
                            'text-secondary-400'
                          }`}>
                            {player.contractDuration}s
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-[10px] text-gray-500 uppercase">Clausola</div>
                          <div className={`font-medium text-sm ${isPassed ? 'text-gray-500' : 'text-gray-400'}`}>
                            {player.contractClause}M
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-[10px] text-gray-500 uppercase">Rubata</div>
                          <div className={`font-bold text-sm ${isPassed ? 'text-gray-500' : isCurrent ? 'text-primary-400' : 'text-warning-400'}`}>
                            {player.rubataPrice}M
                          </div>
                        </div>
                      </div>

                      {/* Stato per giocatori passati non rubati */}
                      {isPassed && !wasStolen && (
                        <div className="mt-2 text-center text-xs text-secondary-500">
                          ✓ Non rubato
                        </div>
                      )}

                      {/* Strategia - Mobile */}
                      {(() => {
                        const pref = preferencesMap.get(player.playerId)
                        const isMyPlayer = player.memberId === myMemberId
                        if (isMyPlayer || isPassed) return null
                        return (
                          <div className="mt-2 pt-2 border-t border-surface-50/20">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {pref?.priority && (
                                  <span className="text-purple-400 text-xs">{'★'.repeat(pref.priority)}</span>
                                )}
                                {pref?.maxBid && (
                                  <span className="text-blue-400 text-xs">Max: {pref.maxBid}M</span>
                                )}
                                {pref?.notes && (
                                  <span className="text-gray-400 text-xs" title={pref.notes}>📝</span>
                                )}
                                {!pref?.priority && !pref?.maxBid && !pref?.notes && (
                                  <span className="text-gray-500 text-xs">Nessuna strategia</span>
                                )}
                              </div>
                              {canEditPreferences && (
                                <button
                                  type="button"
                                  onClick={() => { openPrefsModal({ ...player, preference: pref || null }); }}
                                  className={`px-2 py-1 rounded text-xs transition-all ${
                                    (pref?.priority || pref?.maxBid || pref?.notes) ? 'bg-indigo-500/30 text-indigo-400' : 'bg-surface-50/20 text-gray-500'
                                  }`}
                                >
                                  ⚙️ Strategia
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  )
                })}
              </div>
            </div>
            </div>
          </div>
        )}


        {/* Floating "Scroll to Current Player" Button - Bottom Left */}
        {isRubataPhase && isOrderSet && !isCurrentPlayerVisible && currentPlayer && (
          <button
            onClick={scrollToCurrentPlayer}
            className="fixed bottom-20 md:bottom-4 left-4 z-50 flex items-center gap-2 px-4 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-full shadow-lg transition-all animate-pulse hover:animate-none"
            title={`Torna a ${currentPlayer.playerName}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-medium hidden sm:inline">
              Torna a {currentPlayer.playerName.split(' ').pop()}
            </span>
            <span className="text-sm font-medium sm:hidden">
              ↑ Player
            </span>
          </button>
        )}

        {/* Mobile Admin FAB - Only visible on mobile for admins when board is active */}
        {isRubataPhase && isOrderSet && isAdmin && (
          <button
            className="fixed bottom-20 right-4 z-40 lg:hidden bg-primary-500 text-white rounded-full p-3 shadow-lg hover:bg-primary-400 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center gap-2"
            onClick={() => { setAdminSheetOpen(true); }}
          >
            <Settings size={20} />
            <span className="text-sm font-medium">Admin</span>
          </button>
        )}

        {/* Mobile Admin BottomSheet */}
        <BottomSheet
          isOpen={adminSheetOpen}
          onClose={() => { setAdminSheetOpen(false); }}
          title="Controlli Admin"
          maxHeight="85vh"
        >
          <div className="p-4 space-y-4">
            {/* Budget Panel - visible to all */}
            {boardData?.memberBudgets && boardData.memberBudgets.length > 0 && (
              <BudgetPanel memberBudgets={boardData.memberBudgets} />
            )}

            {/* Admin-only panels */}
            {isAdmin && (<>
              <TimerSettingsPanel
                offerTimer={offerTimer}
                setOfferTimer={setOfferTimer}
                auctionTimer={auctionTimer}
                setAuctionTimer={setAuctionTimer}
                isSubmitting={isSubmitting}
                onUpdateTimers={() => void handleUpdateTimers()}
              />
              <BotSimulationPanel
                rubataState={rubataState ?? null}
                activeAuction={activeAuction ?? null}
                members={members}
                myMemberId={myMemberId}
                currentPlayerMemberId={currentPlayer?.memberId}
                simulateMemberId={simulateMemberId}
                setSimulateMemberId={setSimulateMemberId}
                simulateBidAmount={simulateBidAmount}
                setSimulateBidAmount={setSimulateBidAmount}
                isSubmitting={isSubmitting}
                onSimulateOffer={() => void handleSimulateOffer()}
                onSimulateBid={() => void handleSimulateBid()}
              />
              <CompleteRubataPanel
                rubataState={rubataState ?? null}
                isSubmitting={isSubmitting}
                onCompleteRubata={() => void handleCompleteRubata()}
              />
            </>)}
          </div>
        </BottomSheet>

      </main>

      {/* Mobile Budget Footer - Fixed Bottom */}
      {boardData?.memberBudgets && boardData.memberBudgets.length > 0 && isRubataPhase && isOrderSet && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-gradient-to-r from-surface-200 via-surface-200 to-surface-200 border-t-2 border-primary-500/50 z-40 shadow-lg shadow-black/30">
          <div className="px-3 py-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] text-gray-500 uppercase font-medium">Budget Residuo</span>
              <button
                type="button"
                onClick={() => { setMobileBudgetExpanded(prev => !prev); }}
                className="text-[9px] text-gray-400 px-2 py-0.5 rounded bg-surface-300/50"
              >
                {mobileBudgetExpanded ? '▼ Chiudi' : '▲ Espandi'}
              </button>
            </div>
            <div className={`grid gap-1.5 ${mobileBudgetExpanded ? 'grid-cols-2' : 'grid-cols-4'}`}>
              {(mobileBudgetExpanded ? boardData.memberBudgets : boardData.memberBudgets.slice(0, 4)).map(mb => (
                <div
                  key={mb.memberId}
                  className={`rounded p-1 text-center ${
                    mb.residuo < 0 ? 'bg-danger-500/20' : 'bg-surface-300/50'
                  }`}
                >
                  <div className="text-[8px] text-gray-500 truncate">{mb.teamName}</div>
                  <div className={`font-bold text-xs ${
                    mb.residuo < 0 ? 'text-danger-400' : mb.residuo < 50 ? 'text-warning-400' : 'text-accent-400'
                  }`}>
                    {mb.residuo}M
                  </div>
                  {mobileBudgetExpanded && (
                    <div className="text-[7px] text-gray-500">
                      {mb.currentBudget}M - {mb.totalSalaries}M
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Contract Modification Modal after Rubata Win */}
      {pendingContractModification && (
        <ContractModifierModal
          isOpen={true}
          onClose={handleSkipContractModification}
          player={{
            id: pendingContractModification.playerId,
            name: pendingContractModification.playerName,
            team: pendingContractModification.playerTeam || '',
            position: pendingContractModification.playerPosition || '',
          }}
          contract={{
            salary: pendingContractModification.salary,
            duration: pendingContractModification.duration,
            initialSalary: pendingContractModification.initialSalary,
            rescissionClause: pendingContractModification.rescissionClause,
          }}
          onConfirm={handleContractModification}
          increaseOnly={true}
          title="Modifica Contratto"
          description="Hai appena rubato questo giocatore. Puoi solo aumentare ingaggio e/o durata del contratto."
        />
      )}

      {/* Player Stats Modal */}
      <PlayerStatsModal
        isOpen={!!selectedPlayerForStats}
        onClose={() => { setSelectedPlayerForStats(null); }}
        player={selectedPlayerForStats}
      />
    </div>
  )
}
