import { useState, useMemo, useCallback, useRef } from 'react'
import { Settings, Search, X } from 'lucide-react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useRubataState } from '../hooks/useRubataState'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { BottomSheet } from '../components/ui/BottomSheet'
import { Navigation } from '../components/Navigation'
import { ContractModifierModal } from '../components/ContractModifier'
import { PlayerStatsModal } from '../components/PlayerStatsModal'
import { RubataStepper } from '../components/rubata/RubataStepper'
import { PreferenceModal } from '../components/rubata/PreferenceModal'
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
  GameFlowPanel,
  CompleteRubataPanel,
} from '../components/rubata/RubataAdminControls'
import { RubataActionBar } from '../components/rubata/RubataActionBar'
import { RubataReadyBanner } from '../components/rubata/RubataReadyBanner'
import { RubataBidPanel } from '../components/rubata/RubataBidPanel'
import { RubataActivityFeed } from '../components/rubata/RubataActivityFeed'
import { RubataStrategySummary } from '../components/rubata/RubataStrategySummary'
import { BoardRow } from '../components/rubata/BoardRow'
import { PlayerCompareModal } from '../components/rubata/PlayerCompareModal'
import { POSITION_COLORS } from '../types/rubata.types'
import type { BoardPlayer } from '../types/rubata.types'
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
    canEditPreferences,
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
    handleSavePreference, handleDeletePreference, handleBulkSetPreference, handleImportPreferences,
    // Watchlist alert (D4)
    watchlistAlert, dismissWatchlistAlert,
    // Retry / reload
    setError, loadData,
  } = useRubataState(leagueId)

  const [adminSheetOpen, setAdminSheetOpen] = useState(false)
  const [bidSheetOpen, setBidSheetOpen] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try { return !localStorage.getItem('rubata_onboarding_dismissed') } catch { return true }
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [positionFilter, setPositionFilter] = useState<string | null>(null)
  const [chipFilter, setChipFilter] = useState<'miei' | 'watchlist' | 'sul_piatto' | null>(null)
  // D5: Compare mode
  const [compareMode, setCompareMode] = useState(false)
  const [comparePlayerIds, setComparePlayerIds] = useState<string[]>([])
  const [showCompareModal, setShowCompareModal] = useState(false)

  // B4+B5: Filtered board
  const filteredBoard = useMemo(() => {
    if (!board) return null
    let result: (BoardPlayer & { originalIndex: number })[] = board.map((p, i) => ({ ...p, originalIndex: i }))

    // Text search
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter(p =>
        p.playerName.toLowerCase().includes(q) ||
        p.playerTeam.toLowerCase().includes(q) ||
        p.ownerUsername.toLowerCase().includes(q)
      )
    }

    // Position filter
    if (positionFilter) {
      result = result.filter(p => p.playerPosition === positionFilter)
    }

    // Chip filters
    if (chipFilter === 'miei') {
      result = result.filter(p => p.memberId === myMemberId)
    } else if (chipFilter === 'watchlist') {
      result = result.filter(p => preferencesMap.get(p.playerId)?.isWatchlist)
    } else if (chipFilter === 'sul_piatto') {
      const ci = boardData?.currentIndex
      if (ci != null) {
        result = result.filter(p => p.originalIndex >= ci)
      }
    }

    return result
  }, [board, searchQuery, positionFilter, chipFilter, myMemberId, preferencesMap, boardData?.currentIndex])

  const isFiltered = !!(searchQuery.trim() || positionFilter || chipFilter)

  // Virtualization for large boards (50+ items)
  const boardScrollRef = useRef<HTMLDivElement>(null)
  const rowCount = filteredBoard?.length ?? 0
  const useVirtual = rowCount > 50
  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => boardScrollRef.current,
    estimateSize: () => 90,
    overscan: 8,
    enabled: useVirtual,
  })

  const handlePlayerStatsClick = useCallback((info: { name: string; team: string; position: string; quotation?: number; age?: number | null; apiFootballId?: number | null; computedStats?: unknown }) => {
    setSelectedPlayerForStats(info as Parameters<typeof setSelectedPlayerForStats>[0])
  }, [setSelectedPlayerForStats])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Navigation currentPage="rubata" leagueId={leagueId} isLeagueAdmin={isAdmin} onNavigate={onNavigate} />
        <div className="flex items-center justify-center h-[80vh]">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Caricamento rubata...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <Navigation currentPage="rubata" leagueId={leagueId} isLeagueAdmin={isAdmin} onNavigate={onNavigate} />

      {/* Header — pattern Svincolati */}
      {isRubataPhase && (
        <div className="bg-gradient-to-r from-dark-200 via-surface-200 to-dark-200 border-b border-surface-50/20">
          <div className="max-w-full mx-auto px-4 py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-danger-500 to-danger-700 flex items-center justify-center shadow-glow">
                  <span className="text-2xl">⚔️</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">Fase Rubata</h1>
                    <span className={`w-2 h-2 rounded-full ${isPusherConnected ? 'bg-green-400' : 'bg-red-400'} animate-pulse`} />
                  </div>
                  <p className="text-gray-400 text-sm">
                    {rubataState === 'COMPLETED' ? 'Fase completata' :
                     boardData?.currentIndex != null ? `Giocatore ${boardData.currentIndex + 1} di ${boardData.totalPlayers}` :
                     !isOrderSet ? 'Configurazione ordine' : 'In attesa...'}
                  </p>
                </div>
              </div>
              {/* Progress shown in ActionBar when board is active */}
            </div>
          </div>
        </div>
      )}

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
            <Button
              onClick={() => { setError(''); void loadData(); }}
              size="sm"
              className="mt-4"
            >
              Riprova
            </Button>
          </div>
        )}
        {success && (
          <div className="bg-secondary-500/20 border border-secondary-500/30 text-secondary-400 p-3 rounded-lg mb-4">{success}</div>
        )}

        {/* Fase non RUBATA */}
        {!isRubataPhase && (
          <EmptyState
            icon="🎯"
            title="Fase RUBATA non attiva"
            description="La fase rubata inizierà dopo il consolidamento dei contratti. Attendi che l'admin della lega passi alla fase RUBATA."
          />
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
          <EmptyState
            icon="⏳"
            title="In attesa dell'ordine rubata"
            description="L'admin della lega sta impostando l'ordine di rubata. Una volta confermato, potrai vedere il tabellone e partecipare alle aste."
          />
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

              {/* Activity Feed - stolen transactions */}
              <RubataActivityFeed board={board ?? null} />

              {/* Strategy Summary */}
              <RubataStrategySummary
                board={board ?? null}
                preferencesMap={preferencesMap}
                myMemberId={myMemberId}
                currentIndex={boardData?.currentIndex ?? null}
                onOpenPrefsModal={openPrefsModal}
                canEditPreferences={canEditPreferences}
                onBulkSetPreference={handleBulkSetPreference}
                onImportPreferences={handleImportPreferences}
                isSubmitting={isSubmitting}
              />

              {/* Admin-only panels */}
              {isAdmin && (<>
                <GameFlowPanel
                  rubataState={rubataState ?? null}
                  isSubmitting={isSubmitting}
                  currentIndex={boardData?.currentIndex ?? null}
                  onStartRubata={() => void handleStartRubata()}
                  onPause={() => void handlePause()}
                  onResume={() => void handleResume()}
                  onAdvance={() => void handleAdvance()}
                  onGoBack={() => void handleGoBack()}
                  onCloseAuction={() => void handleCloseAuction()}
                />
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
            {/* 1. Action Bar — compact sticky replacing TimerPanel */}
            <RubataActionBar
              rubataState={rubataState ?? null}
              timerDisplay={timerDisplay}
              isPusherConnected={isPusherConnected}
              progressStats={progressStats}
              boardData={boardData}
              canMakeOffer={canMakeOffer}
              currentPlayer={currentPlayer ?? null}
              isSubmitting={isSubmitting}
              onMakeOffer={() => void handleMakeOffer()}
            />

            {/* 2. Ready Banner — compact, only during READY_CHECK or PAUSED */}
            {rubataState === 'READY_CHECK' && readyStatus && (
              <RubataReadyBanner
                variant="ready"
                readyStatus={readyStatus}
                isAdmin={isAdmin}
                isSubmitting={isSubmitting}
                onSetReady={() => void handleSetReady()}
                onForceAllReady={() => void handleForceAllReady()}
              />
            )}
            {rubataState === 'PAUSED' && readyStatus && (
              <RubataReadyBanner
                variant="paused"
                readyStatus={readyStatus}
                isAdmin={isAdmin}
                isSubmitting={isSubmitting}
                pausedInfo={{
                  remainingSeconds: boardData?.pausedRemainingSeconds ?? null,
                  fromState: boardData?.pausedFromState ?? null,
                }}
                onSetReady={() => void handleSetReady()}
                onForceAllReady={() => void handleForceAllReady()}
              />
            )}

            {/* 3. Desktop-only full stepper */}
            <RubataStepper currentState={rubataState ?? null} className="hidden lg:block mb-3" />

            {/* 3b. Strategy preparation banner — WAITING/PREVIEW only */}
            {(rubataState === 'WAITING' || rubataState === 'PREVIEW') && board && board.length > 0 && (() => {
              const totalEligible = board.filter(p => p.memberId !== myMemberId).length
              const configured = Array.from(preferencesMap.values()).filter(p => p.isWatchlist || p.isAutoPass || p.maxBid || p.priority || p.notes).length
              const pct = totalEligible > 0 ? Math.round((configured / totalEligible) * 100) : 0
              return (
                <div className="mb-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
                  <span className="text-lg">🎯</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-indigo-300">Prepara le tue strategie!</p>
                    <p className="text-xs text-indigo-400/70">Imposta watchlist, budget max e priorita' prima che inizi la rubata</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-surface-300 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-indigo-400 font-mono">{configured}/{totalEligible}</span>
                  </div>
                </div>
              )
            })()}

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

            {/* Pending Acknowledgment is now a modal - see below */}

            {/* Active Auction Panel — desktop inline, mobile via BottomSheet */}
            {activeAuction && rubataState === 'AUCTION' && (
              <div className="hidden md:block">
                <RubataBidPanel
                  activeAuction={activeAuction}
                  myMemberId={myMemberId}
                  bidAmount={bidAmount}
                  setBidAmount={setBidAmount}
                  isSubmitting={isSubmitting}
                  onBid={() => void handleBid()}
                  myBudget={boardData?.memberBudgets?.find(mb => mb.memberId === myMemberId)?.residuo}
                  myMaxBid={preferencesMap.get(activeAuction.player.id)?.maxBid}
                />
              </div>
            )}

            {/* Mobile Activity Feed + Strategy Summary */}
            <div className="lg:hidden space-y-3">
              <RubataActivityFeed board={board ?? null} />
              <RubataStrategySummary
                board={board ?? null}
                preferencesMap={preferencesMap}
                myMemberId={myMemberId}
                currentIndex={boardData?.currentIndex ?? null}
                onOpenPrefsModal={openPrefsModal}
                canEditPreferences={canEditPreferences}
                onBulkSetPreference={handleBulkSetPreference}
                onImportPreferences={handleImportPreferences}
                isSubmitting={isSubmitting}
              />
            </div>

            {/* D4: Watchlist alert — shown when a watchlisted player is "sul piatto" */}
            {watchlistAlert && rubataState === 'OFFERING' && (
              <div className="mb-3 bg-indigo-500/20 border border-indigo-500/40 rounded-xl px-4 py-3 flex items-center gap-3 animate-[fadeIn_0.3s_ease-out]">
                <span className="text-2xl animate-pulse">🔔</span>
                <div className="flex-1">
                  <p className="text-sm font-bold text-indigo-300">{watchlistAlert} è SUL PIATTO!</p>
                  <p className="text-xs text-indigo-400/70">Questo giocatore è nella tua watchlist</p>
                </div>
                <button
                  onClick={dismissWatchlistAlert}
                  className="text-xs text-indigo-400 hover:text-white px-2 py-1 rounded bg-indigo-500/20 flex-shrink-0"
                >
                  OK
                </button>
              </div>
            )}

            {/* Onboarding tooltip — first visit only, shown during OFFERING */}
            {showOnboarding && rubataState === 'OFFERING' && (
              <div className="mb-3 bg-primary-500/10 border border-primary-500/30 rounded-xl px-4 py-3 flex items-center gap-3 animate-[fadeIn_0.3s_ease-out]">
                <span className="text-2xl flex-shrink-0">💡</span>
                <p className="text-sm text-primary-300 flex-1">
                  Quando un giocatore e' <strong>SUL PIATTO</strong>, clicca <strong>VOGLIO RUBARE</strong> per avviare un'asta. Puoi anche impostare strategie (watchlist, budget max) cliccando sul giocatore.
                </p>
                <button
                  onClick={() => {
                    setShowOnboarding(false)
                    try { localStorage.setItem('rubata_onboarding_dismissed', '1') } catch { /* noop */ }
                  }}
                  className="text-xs text-primary-400 hover:text-white px-2 py-1 rounded bg-primary-500/20 flex-shrink-0"
                >
                  OK
                </button>
              </div>
            )}

            {/* Tabellone completo */}
            <div className="bg-surface-200 rounded-2xl border border-surface-50/20 overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 220px)', minHeight: '300px' }}>
              {/* Board header with search + filters */}
              <div className="p-4 border-b border-surface-50/20 shrink-0 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <span className="text-xl">📋</span>
                    Tabellone Rubata
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setCompareMode(prev => !prev); if (compareMode) setComparePlayerIds([]); }}
                      className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                        compareMode
                          ? 'bg-primary-500/20 text-primary-400 border border-primary-500/40'
                          : 'text-gray-500 hover:text-gray-300'
                      }`}
                      title="Confronta giocatori"
                    >
                      ⚖️ Confronta
                    </button>
                    <span className="text-sm text-gray-400">
                      {isFiltered ? `${filteredBoard?.length ?? 0} / ` : ''}{boardData?.totalPlayers} giocatori
                    </span>
                  </div>
                </div>

                {/* Search bar */}
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); }}
                    placeholder="Cerca giocatore, squadra o proprietario..."
                    className="w-full pl-9 pr-8 py-2 bg-surface-300 border border-surface-50/20 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-500/50 transition-colors"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => { setSearchQuery(''); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-white"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Filter row: position pills + quick chips */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Position filters */}
                  {(['P', 'D', 'C', 'A'] as const).map(pos => (
                    <button
                      key={pos}
                      onClick={() => { setPositionFilter(prev => prev === pos ? null : pos); }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all min-h-[32px] ${
                        positionFilter === pos
                          ? POSITION_COLORS[pos] ?? ''
                          : 'bg-surface-300 text-gray-400 hover:text-white border border-surface-50/20'
                      }`}
                    >
                      {pos}
                    </button>
                  ))}

                  <span className="w-px h-5 bg-surface-50/20" />

                  {/* Quick chips */}
                  {([
                    { key: 'miei' as const, label: 'Miei', icon: '👤' },
                    { key: 'watchlist' as const, label: 'Watchlist', icon: '👁️' },
                    { key: 'sul_piatto' as const, label: 'Rimanenti', icon: '🎯' },
                  ]).map(chip => (
                    <button
                      key={chip.key}
                      onClick={() => { setChipFilter(prev => prev === chip.key ? null : chip.key); }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all min-h-[32px] flex items-center gap-1 ${
                        chipFilter === chip.key
                          ? 'bg-primary-500/20 border border-primary-500/40 text-primary-400'
                          : 'bg-surface-300 text-gray-400 hover:text-white border border-surface-50/20'
                      }`}
                    >
                      <span>{chip.icon}</span>
                      <span className="hidden sm:inline">{chip.label}</span>
                    </button>
                  ))}

                  {/* Clear all filters */}
                  {isFiltered && (
                    <button
                      onClick={() => { setSearchQuery(''); setPositionFilter(null); setChipFilter(null); }}
                      className="px-2 py-1 rounded-lg text-xs text-gray-400 hover:text-white transition-all"
                    >
                      Azzera
                    </button>
                  )}
                </div>
              </div>

              {/* Board rows */}
              <div ref={boardScrollRef} className="p-4 pb-24 md:pb-4 overflow-y-auto flex-1" role="list" aria-label="Tabellone rubata">
                {filteredBoard?.length === 0 && isFiltered && (
                  <p className="text-center text-gray-500 py-8 text-sm">Nessun giocatore corrisponde ai filtri</p>
                )}
                {useVirtual ? (
                  /* Virtualized mode for 50+ rows */
                  <div style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
                    {virtualizer.getVirtualItems().map(virtualRow => {
                      const player = filteredBoard?.[virtualRow.index]
                      if (!player) return null
                      const globalIndex = player.originalIndex
                      const isCurrent = globalIndex === boardData?.currentIndex
                      const isPassed = globalIndex < (boardData?.currentIndex ?? 0)
                      return (
                        <div
                          key={player.rosterId}
                          style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${virtualRow.start}px)` }}
                          className="pb-3"
                        >
                          <BoardRow
                            player={player}
                            globalIndex={globalIndex}
                            isCurrent={isCurrent}
                            isPassed={isPassed}
                            rubataState={rubataState ?? null}
                            canMakeOffer={!!canMakeOffer}
                            isSubmitting={isSubmitting}
                            myMemberId={myMemberId}
                            preference={preferencesMap.get(player.playerId)}
                            canEditPreferences={canEditPreferences}
                            onMakeOffer={() => void handleMakeOffer()}
                            onOpenPrefsModal={openPrefsModal}
                            onPlayerStatsClick={handlePlayerStatsClick}
                            currentPlayerRef={isCurrent ? currentPlayerRef as React.RefObject<HTMLDivElement> : undefined}
                            compareMode={compareMode}
                            isCompareSelected={comparePlayerIds.includes(player.playerId)}
                            onToggleCompare={() => {
                              setComparePlayerIds(prev =>
                                prev.includes(player.playerId)
                                  ? prev.filter(id => id !== player.playerId)
                                  : prev.length < 3 ? [...prev, player.playerId] : prev
                              )
                            }}
                          />
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  /* Standard mode for <50 rows */
                  <div className="space-y-3">
                    {filteredBoard?.map((player) => {
                      const globalIndex = player.originalIndex
                      const isCurrent = globalIndex === boardData?.currentIndex
                      const isPassed = globalIndex < (boardData?.currentIndex ?? 0)
                      return (
                        <BoardRow
                          key={player.rosterId}
                          player={player}
                          globalIndex={globalIndex}
                          isCurrent={isCurrent}
                          isPassed={isPassed}
                          rubataState={rubataState ?? null}
                          canMakeOffer={!!canMakeOffer}
                          isSubmitting={isSubmitting}
                          myMemberId={myMemberId}
                          preference={preferencesMap.get(player.playerId)}
                          canEditPreferences={canEditPreferences}
                          onMakeOffer={() => void handleMakeOffer()}
                          onOpenPrefsModal={openPrefsModal}
                          onPlayerStatsClick={handlePlayerStatsClick}
                          currentPlayerRef={isCurrent ? currentPlayerRef as React.RefObject<HTMLDivElement> : undefined}
                          compareMode={compareMode}
                          isCompareSelected={comparePlayerIds.includes(player.playerId)}
                          onToggleCompare={() => {
                            setComparePlayerIds(prev =>
                              prev.includes(player.playerId)
                                ? prev.filter(id => id !== player.playerId)
                                : prev.length < 3 ? [...prev, player.playerId] : prev
                            )
                          }}
                        />
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
            </div>
          </div>
        )}


        {/* D5: Floating compare bar */}
        {compareMode && comparePlayerIds.length > 0 && (
          <div className="fixed bottom-20 md:bottom-4 left-1/2 -translate-x-1/2 z-50 bg-surface-200/95 backdrop-blur-sm border border-primary-500/40 rounded-full px-4 py-2 flex items-center gap-3 shadow-lg animate-[fadeIn_0.2s_ease-out]">
            <span className="text-sm text-gray-300">
              <span className="font-bold text-primary-400">{comparePlayerIds.length}</span>/3 selezionati
            </span>
            <button
              onClick={() => { setShowCompareModal(true); }}
              disabled={comparePlayerIds.length < 2}
              className="px-3 py-1.5 rounded-full text-sm font-bold bg-primary-500 text-white hover:bg-primary-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              ⚖️ Confronta
            </button>
            <button
              onClick={() => { setComparePlayerIds([]); }}
              className="text-xs text-gray-400 hover:text-white px-2 py-1"
            >
              Azzera
            </button>
          </div>
        )}

        {/* D5: Compare modal */}
        {showCompareModal && board && (
          <PlayerCompareModal
            isOpen={showCompareModal}
            onClose={() => { setShowCompareModal(false); }}
            players={board.filter(p => comparePlayerIds.includes(p.playerId))}
          />
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
              <GameFlowPanel
                rubataState={rubataState ?? null}
                isSubmitting={isSubmitting}
                currentIndex={boardData?.currentIndex ?? null}
                onStartRubata={() => void handleStartRubata()}
                onPause={() => void handlePause()}
                onResume={() => void handleResume()}
                onAdvance={() => void handleAdvance()}
                onGoBack={() => void handleGoBack()}
                onCloseAuction={() => void handleCloseAuction()}
              />
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

      {/* Mobile Auction Bottom Bar — fixed during AUCTION on mobile */}
      {activeAuction && rubataState === 'AUCTION' && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-r from-danger-900/95 via-surface-200/95 to-danger-900/95 backdrop-blur-sm border-t-2 border-danger-500 shadow-lg shadow-black/40">
          <div className="px-3 py-2 flex items-center gap-3">
            {/* Compact timer */}
            {timerDisplay !== null && (
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-mono font-bold text-lg ${
                timerDisplay > 10 ? 'bg-secondary-500/20 text-secondary-400' :
                timerDisplay > 5 ? 'bg-warning-500/20 text-warning-400' :
                'bg-danger-500/20 text-danger-400 animate-pulse'
              }`}>
                {timerDisplay}
              </div>
            )}
            {/* Current price — tap to open full panel */}
            <button
              type="button"
              onClick={() => { setBidSheetOpen(true); }}
              className="flex-1 min-w-0 text-left"
            >
              <p className="text-[10px] text-gray-400 uppercase truncate">{activeAuction.player.name}</p>
              <p className="text-lg font-bold font-mono text-primary-400">{activeAuction.currentPrice}M</p>
            </button>
            {/* Quick bid button */}
            {activeAuction.sellerId !== myMemberId && (
              <Button
                onClick={() => void handleBid()}
                disabled={isSubmitting || bidAmount <= activeAuction.currentPrice}
                className="text-sm py-2 px-4 whitespace-nowrap"
              >
                RILANCIA {bidAmount}M
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Mobile BidPanel BottomSheet */}
      {activeAuction && rubataState === 'AUCTION' && (
        <BottomSheet
          isOpen={bidSheetOpen}
          onClose={() => { setBidSheetOpen(false); }}
          title={`Asta: ${activeAuction.player.name}`}
          maxHeight="85vh"
        >
          <div className="p-2">
            <RubataBidPanel
              activeAuction={activeAuction}
              myMemberId={myMemberId}
              bidAmount={bidAmount}
              setBidAmount={setBidAmount}
              isSubmitting={isSubmitting}
              onBid={() => { void handleBid(); setBidSheetOpen(false); }}
              myBudget={boardData?.memberBudgets?.find(mb => mb.memberId === myMemberId)?.residuo}
              myMaxBid={preferencesMap.get(activeAuction.player.id)?.maxBid}
            />
          </div>
        </BottomSheet>
      )}

      {/* Mobile Budget Footer - Fixed Bottom */}
      {boardData?.memberBudgets && boardData.memberBudgets.length > 0 && isRubataPhase && isOrderSet && rubataState !== 'AUCTION' && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-gradient-to-r from-surface-200 via-surface-200 to-surface-200 border-t-2 border-primary-500/50 z-40 shadow-lg shadow-black/30">
          <div className="px-3 py-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] text-gray-500 uppercase font-medium">Bilancio</span>
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
