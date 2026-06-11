import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { Settings, Search, X, Swords, ChevronDown, ChevronUp } from 'lucide-react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useRubataState } from '../hooks/useRubataState'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { BottomSheet } from '../components/ui/BottomSheet'
import { Navigation } from '../components/Navigation'
import { ContractModifierModal } from '../components/ContractModifier'
import { PlayerStatsModal } from '../components/PlayerStatsModal'
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
import { RubataReadyBanner } from '../components/rubata/RubataReadyBanner'
import { RubataStateBar } from '../components/rubata/RubataStateBar'
import { HeroPlayerCard } from '../components/rubata/HeroPlayerCard'
import { BoardViewToggle } from '../components/rubata/BoardViewToggle'
import { PendingAckBanner } from '../components/rubata/PendingAckBanner'
import { CircularTimer } from '../components/rubata/CircularTimer'
import { RubataBidPanel } from '../components/rubata/RubataBidPanel'
import { RubataRivalsStrip } from '../components/rubata/RubataRivalsStrip'
import { RubataActivityFeed } from '../components/rubata/RubataActivityFeed'
import { RubataStrategySummary } from '../components/rubata/RubataStrategySummary'
import { BoardRow } from '../components/rubata/BoardRow'
import { BoardRowSkeleton } from '../components/rubata/BoardRowSkeleton'
import { PlayerCompareModal } from '../components/rubata/PlayerCompareModal'
import { POSITION_COLORS } from '../types/rubata.types'
import type { BoardPlayer } from '../types/rubata.types'
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useToast } from '../components/ui/Toast'

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
    handleMakeOffer, handleBid, handleQuickBid,
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
  // Official admin panels collapsed to one row (mockup v2)
  const [adminPanelsExpanded, setAdminPanelsExpanded] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [positionFilter, setPositionFilter] = useState<string | null>(null)
  const [chipFilter, setChipFilter] = useState<'miei' | 'watchlist' | 'sul_piatto' | null>(null)
  // D5: Compare mode
  const [compareMode, setCompareMode] = useState(false)
  const [comparePlayerIds, setComparePlayerIds] = useState<string[]>([])
  const [showCompareModal, setShowCompareModal] = useState(false)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  // Dashboard mode: board view toggle
  const [boardViewMode, setBoardViewMode] = useState<'upcoming' | 'all'>('upcoming')

  // Toast notifications for success/error feedback
  const { toast } = useToast()
  const prevErrorRef = useRef(error)
  const prevSuccessRef = useRef(success)
  useEffect(() => {
    if (error && error !== prevErrorRef.current) {
      toast.error(error)
    }
    prevErrorRef.current = error
  }, [error, toast])
  useEffect(() => {
    if (success && success !== prevSuccessRef.current) {
      toast.success(success)
    }
    prevSuccessRef.current = success
  }, [success, toast])

  // Auto-set "Rimanenti" filter when rubata starts actively running
  const prevRubataStateRef = useRef(rubataState)
  useEffect(() => {
    const prev = prevRubataStateRef.current
    prevRubataStateRef.current = rubataState
    const isActive = rubataState === 'OFFERING' || rubataState === 'AUCTION'
    const wasActive = prev === 'OFFERING' || prev === 'AUCTION'
    if (isActive && !wasActive && !chipFilter) {
      setChipFilter('sul_piatto')
    }
  }, [rubataState, chipFilter])

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

    // Dashboard mode: show nearby window (2 passed + 10 upcoming) when no filters active
    // Only applies when there are still upcoming players
    if (boardViewMode === 'upcoming' && !searchQuery && !positionFilter && !chipFilter && boardData?.currentIndex != null) {
      const ci = boardData.currentIndex
      const hasUpcoming = result.some(p => p.originalIndex >= ci)
      if (hasUpcoming) {
        const windowStart = Math.max(0, ci - 2)
        const windowEnd = ci + 10
        result = result.filter(p => p.originalIndex >= windowStart && p.originalIndex < windowEnd)
      }
    }

    return result
  }, [board, searchQuery, positionFilter, chipFilter, boardViewMode, myMemberId, preferencesMap, boardData?.currentIndex])

  const isFiltered = !!(searchQuery.trim() || positionFilter || chipFilter)

  // Pre-compute indices where owner changes (for manager group separators)
  const ownerGroupStartIndices = useMemo(() => {
    if (!filteredBoard) return new Set<number>()
    const set = new Set<number>()
    for (let i = 0; i < filteredBoard.length; i++) {
      if (i === 0 || filteredBoard[i]?.memberId !== filteredBoard[i - 1]?.memberId) {
        set.add(i)
      }
    }
    return set
  }, [filteredBoard])

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

  // Bilancio residuo del manager corrente (affordability check nella HeroPlayerCard)
  const myResiduo = useMemo(() => {
    return boardData?.memberBudgets?.find(mb => mb.memberId === myMemberId)?.residuo ?? null
  }, [boardData?.memberBudgets, myMemberId])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Navigation currentPage="rubata" leagueId={leagueId} isLeagueAdmin={isAdmin} onNavigate={onNavigate} />
        <div className="max-w-[1600px] mx-auto px-4 py-6">
          <div className="bg-surface-200 rounded-2xl border border-surface-50/20 overflow-hidden">
            <div className="p-3 md:p-4 border-b border-surface-50/20">
              <div className="h-6 w-48 bg-surface-300 rounded animate-pulse" />
            </div>
            <div className="divide-y divide-surface-50/10">
              {Array.from({ length: 6 }).map((_, i) => (
                <BoardRowSkeleton key={i} />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <Navigation currentPage="rubata" leagueId={leagueId} isLeagueAdmin={isAdmin} onNavigate={onNavigate} />

      {/* Header — pattern Svincolati (hidden on mobile, ActionBar shows same info) */}
      {isRubataPhase && (
        <div className="hidden md:block bg-gradient-to-r from-dark-200 via-surface-200 to-dark-200 border-b border-surface-50/20">
          <div className="max-w-full mx-auto px-4 py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2.5 md:gap-5">
                <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl bg-gradient-to-br from-danger-500 to-danger-700 flex items-center justify-center shadow-glow flex-shrink-0">
                  <Swords className="w-5 h-5 md:w-7 md:h-7 text-white" aria-hidden="true" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">Fase Rubata</h1>
                    <span className={`w-2 h-2 rounded-full ${isPusherConnected ? 'bg-secondary-400' : 'bg-danger-400'}`} />
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

      {/* Modals — PendingAckModal is the primary ack UI (blocking modal) */}
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


      <main className="max-w-[1600px] mx-auto px-4 py-3 md:py-8">
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
            icon=""
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
                <h3 className="text-lg font-bold text-white">
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
                <h3 className="text-lg font-bold text-white">
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
            icon=""
            title="In attesa dell'ordine rubata"
            description="L'admin della lega sta impostando l'ordine di rubata. Una volta confermato, potrai vedere il tabellone e partecipare alle aste."
          />
        )}

        {/* Tabellone e controlli - Board generato — 2-Zone Layout */}
        {isRubataPhase && isOrderSet && (
          <div className="lg:grid lg:grid-cols-5 lg:gap-4">
            {/* === ZONA AZIONE (left on desktop, top on mobile) === */}
            <div className="lg:col-span-2 lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto mb-4 lg:mb-0 space-y-3">
              {/* State Bar — unified (fase + turno + timer + progresso) */}
              <RubataStateBar
                rubataState={rubataState ?? 'WAITING'}
                timerDisplay={timerDisplay}
                isPusherConnected={isPusherConnected}
                progressStats={progressStats}
              />

              {/* Official admin controls — collapsed to one row, expand on demand */}
              {isAdmin && (
                <div className="hidden lg:block bg-surface-300 rounded-xl border border-surface-50/20 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => { setAdminPanelsExpanded(prev => !prev); }}
                    aria-expanded={adminPanelsExpanded}
                    aria-label={adminPanelsExpanded ? 'Comprimi controlli admin' : 'Espandi controlli admin'}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-surface-100/40 transition-colors"
                  >
                    <span className="text-[10px] font-mono font-bold text-primary-400 border border-primary-500/40 rounded px-1.5 py-px tracking-wider">ADMIN</span>
                    <span className="text-xs text-gray-400 truncate">Conduzione · Timer · Completa fase</span>
                    <span className="ml-auto text-gray-500">
                      {adminPanelsExpanded ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
                    </span>
                  </button>
                  {adminPanelsExpanded && (
                    <div className="p-2 space-y-3 border-t border-surface-50/20">
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
                      <CompleteRubataPanel
                        rubataState={rubataState ?? null}
                        isSubmitting={isSubmitting}
                        onCompleteRubata={() => void handleCompleteRubata()}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Dynamic content based on rubataState */}

              {/* OFFERING: HeroPlayerCard (arena di decisione) + rivali */}
              {rubataState === 'OFFERING' && currentPlayer && (
                <>
                  <HeroPlayerCard
                    player={currentPlayer}
                    rubataState={rubataState}
                    canMakeOffer={!!canMakeOffer}
                    isSubmitting={isSubmitting}
                    myMemberId={myMemberId}
                    myResiduo={myResiduo}
                    preference={preferencesMap.get(currentPlayer.playerId)}
                    activeAuction={activeAuction ?? null}
                    onMakeOffer={() => void handleMakeOffer()}
                    onPlayerStatsClick={handlePlayerStatsClick}
                    onOpenPrefsModal={openPrefsModal}
                    canEditPreferences={canEditPreferences}
                    heroRef={currentPlayerRef as React.RefObject<HTMLDivElement>}
                  />
                  {boardData?.memberBudgets && boardData.memberBudgets.length > 0 && (
                    <RubataRivalsStrip
                      memberBudgets={boardData.memberBudgets}
                      cost={currentPlayer.rubataPrice}
                      ownerMemberId={currentPlayer.memberId}
                      myMemberId={myMemberId}
                      title="Chi altro può rubarlo"
                    />
                  )}
                </>
              )}

              {/* AUCTION: HeroPlayerCard + BidPanel inline + rivali */}
              {rubataState === 'AUCTION' && currentPlayer && (
                <>
                  <HeroPlayerCard
                    player={currentPlayer}
                    rubataState={rubataState}
                    canMakeOffer={!!canMakeOffer}
                    isSubmitting={isSubmitting}
                    myMemberId={myMemberId}
                    myResiduo={myResiduo}
                    preference={preferencesMap.get(currentPlayer.playerId)}
                    activeAuction={activeAuction ?? null}
                    onMakeOffer={() => void handleMakeOffer()}
                    onPlayerStatsClick={handlePlayerStatsClick}
                    onOpenPrefsModal={openPrefsModal}
                    canEditPreferences={canEditPreferences}
                    heroRef={currentPlayerRef as React.RefObject<HTMLDivElement>}
                  />
                  {activeAuction && (
                    <div className="hidden md:block">
                      <RubataBidPanel
                        activeAuction={activeAuction}
                        myMemberId={myMemberId}
                        bidAmount={bidAmount}
                        setBidAmount={setBidAmount}
                        isSubmitting={isSubmitting}
                        onBid={() => void handleBid()}
                        myBudget={myResiduo}
                        myMaxBid={preferencesMap.get(activeAuction.player.id)?.maxBid}
                      />
                    </div>
                  )}
                  {activeAuction && boardData?.memberBudgets && boardData.memberBudgets.length > 0 && (
                    <RubataRivalsStrip
                      memberBudgets={boardData.memberBudgets}
                      cost={activeAuction.currentPrice + 1}
                      ownerMemberId={activeAuction.sellerId}
                      myMemberId={myMemberId}
                      title="Chi può ancora rilanciare"
                    />
                  )}
                </>
              )}

              {/* AUCTION_READY_CHECK / PREVIEW: HeroPlayerCard */}
              {(rubataState === 'AUCTION_READY_CHECK' || rubataState === 'PREVIEW') && currentPlayer && (
                <HeroPlayerCard
                  player={currentPlayer}
                  rubataState={rubataState}
                  canMakeOffer={!!canMakeOffer}
                  isSubmitting={isSubmitting}
                  myMemberId={myMemberId}
                  myResiduo={myResiduo}
                  preference={preferencesMap.get(currentPlayer.playerId)}
                  activeAuction={activeAuction ?? null}
                  onMakeOffer={() => void handleMakeOffer()}
                  onPlayerStatsClick={handlePlayerStatsClick}
                  onOpenPrefsModal={openPrefsModal}
                  canEditPreferences={canEditPreferences}
                  heroRef={currentPlayerRef as React.RefObject<HTMLDivElement>}
                />
              )}

              {/* PENDING_ACK: Inline banner (modal remains primary, not touched) */}
              {rubataState === 'PENDING_ACK' && currentPlayer && (
                <HeroPlayerCard
                  player={currentPlayer}
                  rubataState={rubataState}
                  canMakeOffer={!!canMakeOffer}
                  isSubmitting={isSubmitting}
                  myMemberId={myMemberId}
                  myResiduo={myResiduo}
                  preference={preferencesMap.get(currentPlayer.playerId)}
                  activeAuction={activeAuction ?? null}
                  onMakeOffer={() => void handleMakeOffer()}
                  onPlayerStatsClick={handlePlayerStatsClick}
                  onOpenPrefsModal={openPrefsModal}
                  canEditPreferences={canEditPreferences}
                  heroRef={currentPlayerRef as React.RefObject<HTMLDivElement>}
                />
              )}
              {rubataState === 'PENDING_ACK' && pendingAck && !pendingAck.allAcknowledged && pendingAck.userAcknowledged && (
                <PendingAckBanner
                  pendingAck={pendingAck}
                  isAdmin={isAdmin}
                  isSubmitting={isSubmitting}
                  prophecyContent={prophecyContent}
                  setProphecyContent={setProphecyContent}
                  onAcknowledge={() => void handleAcknowledgeWithAppeal()}
                  onForceAllAcknowledge={() => void handleForceAllAcknowledge()}
                />
              )}

              {/* READY_CHECK / PAUSED: RubataReadyBanner */}
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

              {/* COMPLETED: completion message */}
              {rubataState === 'COMPLETED' && (
                <div className="bg-secondary-500/10 border border-secondary-500/30 rounded-xl px-4 py-4 text-center">
                  <p className="text-sm font-bold text-secondary-300">Fase Rubata completata!</p>
                  <p className="text-xs text-secondary-400/70 mt-1">Tutti i giocatori sono stati processati.</p>
                </div>
              )}

              {/* UNICO banner contestuale (mockup v2): watchlist sul piatto > watchlist in arrivo > preparazione strategie */}
              {(() => {
                if (rubataState === 'OFFERING' && watchlistAlert) {
                  return (
                    <div className="flex items-center gap-2.5 rounded-xl border border-accent-500/40 bg-accent-500/10 px-3 py-2 animate-[fadeIn_0.3s_ease-out]">
                      <span className="text-[9px] font-mono font-bold text-dark-300 bg-accent-400 rounded px-1.5 py-px tracking-wider flex-shrink-0">WATCHLIST</span>
                      <p className="text-sm text-gray-300 flex-1 min-w-0 truncate">
                        <b className="text-accent-300">{watchlistAlert}</b> è sul piatto — è nella tua watchlist.
                      </p>
                      <button
                        onClick={dismissWatchlistAlert}
                        className="text-xs text-accent-400 hover:text-white px-2 py-1 rounded bg-accent-500/20 flex-shrink-0"
                      >
                        OK
                      </button>
                    </div>
                  )
                }
                if (rubataState === 'OFFERING' && board && boardData?.currentIndex != null) {
                  const upcoming = board.slice(boardData.currentIndex + 1, boardData.currentIndex + 6)
                  const wlUpcoming = upcoming.filter(p => p.memberId !== myMemberId && preferencesMap.get(p.playerId)?.isWatchlist).length
                  if (wlUpcoming === 0) return null
                  return (
                    <div className="flex items-center gap-2.5 rounded-xl border border-primary-500/30 bg-primary-500/10 px-3 py-2">
                      <p className="text-sm text-gray-300 flex-1 min-w-0">
                        <b className="text-primary-400">{wlUpcoming}</b> della tua watchlist nei prossimi 5 giocatori.
                      </p>
                    </div>
                  )
                }
                if ((rubataState === 'WAITING' || rubataState === 'PREVIEW') && board && board.length > 0) {
                  const totalEligible = board.filter(p => p.memberId !== myMemberId).length
                  const configured = Array.from(preferencesMap.values()).filter(p => p.isWatchlist || p.isAutoPass || p.maxBid || p.priority || p.notes).length
                  return (
                    <div className="flex items-center gap-2.5 rounded-xl border border-primary-500/30 bg-primary-500/10 px-3 py-2 flex-wrap">
                      <p className="text-sm text-primary-300 flex-1 min-w-0">
                        Prepara le tue strategie prima che inizi la rubata.
                      </p>
                      <span className="text-xs text-primary-400 font-mono flex-shrink-0">{configured}/{totalEligible}</span>
                    </div>
                  )
                }
                return null
              })()}

              {/* Budget Panel — desktop in action zone */}
              {boardData?.memberBudgets && boardData.memberBudgets.length > 0 && (
                <div className="hidden lg:block">
                  <BudgetPanel memberBudgets={boardData.memberBudgets} />
                </div>
              )}

              {/* Activity Feed — desktop in action zone */}
              <div className="hidden lg:block">
                <RubataActivityFeed board={board ?? null} />
              </div>

              {/* Strategy Summary — desktop in action zone */}
              <div className="hidden lg:block">
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

              {/* Admin test/simulation panels — desktop, bottom of action zone */}
              {isAdmin && (
                <div className="hidden lg:block space-y-4">
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
                </div>
              )}
            </div>

            {/* === TABELLONE (right on desktop, below on mobile) === */}
            <div className="lg:col-span-3">
              {/* Preference Edit Modal */}
              {selectedPlayerForPrefs && (
                <PreferenceModal
                  player={selectedPlayerForPrefs}
                  onClose={closePrefsModal}
                  onSave={handleSavePreference}
                  onDelete={handleDeletePreference}
                  isSubmitting={isSubmitting}
                />
              )}

              {/* Tabellone completo */}
              <div className="bg-surface-200 rounded-2xl border border-surface-50/20 overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 280px)', minHeight: '250px' }}>
                {/* Board header with search + filters */}
                <div className="p-3 md:p-4 border-b border-surface-50/20 shrink-0 space-y-2 md:space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-base md:text-lg font-bold text-white">
                      <span className="hidden sm:inline">Tabellone Rubata</span>
                      <span className="sm:hidden">Tabellone</span>
                    </h3>
                    <div className="flex items-center gap-1.5 md:gap-2">
                      {/* Board view toggle — upcoming/all */}
                      <BoardViewToggle
                        mode={boardViewMode}
                        upcomingCount={Math.min(10, Math.max(0, (boardData?.totalPlayers ?? 0) - (boardData?.currentIndex ?? 0)))}
                        totalCount={boardData?.totalPlayers ?? 0}
                        onToggle={setBoardViewMode}
                      />
                      {/* Mobile search/filter toggle */}
                      <button
                        onClick={() => { setMobileFiltersOpen(prev => !prev); }}
                        className={`md:hidden p-1 rounded transition-all ${
                          mobileFiltersOpen || isFiltered
                            ? 'text-primary-400 bg-primary-500/20'
                            : 'text-gray-500 hover:text-gray-300'
                        }`}
                        title="Cerca e filtra"
                      >
                        <Search size={16} />
                      </button>
                      <button
                        onClick={() => { setCompareMode(prev => !prev); if (compareMode) setComparePlayerIds([]); }}
                        className={`px-1.5 md:px-2 py-1 rounded text-xs font-medium transition-all ${
                          compareMode
                            ? 'bg-primary-500/20 text-primary-400 border border-primary-500/40'
                            : 'text-gray-500 hover:text-gray-300'
                        }`}
                        title="Confronta giocatori"
                      >
                        <span className="hidden sm:inline">Confronta</span>
                        <span className="sm:hidden">VS</span>
                      </button>
                      <span className="text-xs md:text-sm text-gray-400 whitespace-nowrap">
                        {isFiltered ? `${filteredBoard?.length ?? 0}/` : ''}{boardData?.totalPlayers}
                      </span>
                    </div>
                  </div>

                  {/* Search bar + filters — always visible on desktop, toggled on mobile */}
                  <div className={`${mobileFiltersOpen ? 'block' : 'hidden'} md:block space-y-2 md:space-y-3`}>
                  <div className="relative">
                    <Search size={16} className="absolute left-2.5 md:left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => { setSearchQuery(e.target.value); }}
                      placeholder="Cerca giocatore..."
                      className="w-full pl-8 md:pl-9 pr-7 md:pr-8 py-1.5 md:py-2 bg-surface-300 border border-surface-50/20 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-500/50 transition-colors"
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
                  <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
                    {/* Position filters */}
                    {(['P', 'D', 'C', 'A'] as const).map(pos => (
                      <button
                        key={pos}
                        onClick={() => { setPositionFilter(prev => prev === pos ? null : pos); }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all min-h-[44px] ${
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
                      { key: 'miei' as const, label: 'Miei' },
                      { key: 'watchlist' as const, label: 'Watchlist' },
                      { key: 'sul_piatto' as const, label: 'Rimanenti' },
                    ]).map(chip => (
                      <button
                        key={chip.key}
                        onClick={() => { setChipFilter(prev => prev === chip.key ? null : chip.key); }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all min-h-[44px] flex items-center gap-1 ${
                          chipFilter === chip.key
                            ? 'bg-primary-500/20 border border-primary-500/40 text-primary-400'
                            : 'bg-surface-300 text-gray-400 hover:text-white border border-surface-50/20'
                        }`}
                      >
                        {chip.label}
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
                </div>

                {/* Board rows */}
                <div ref={boardScrollRef} className="p-2 md:p-4 pb-16 md:pb-4 overflow-y-auto flex-1" role="list" aria-label="Tabellone rubata">
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
                            className="md:pb-3"
                          >
                            <BoardRow
                              player={player}
                              globalIndex={globalIndex}
                              isCurrent={isCurrent}
                              isPassed={isPassed}
                              isNewOwnerGroup={ownerGroupStartIndices.has(virtualRow.index)}
                              myMemberId={myMemberId}
                              preference={preferencesMap.get(player.playerId)}
                              canEditPreferences={canEditPreferences}
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
                    <div className="md:space-y-3">
                      {filteredBoard?.map((player, idx) => {
                        const globalIndex = player.originalIndex
                        const isCurrent = globalIndex === boardData?.currentIndex
                        const isPassed = globalIndex < (boardData?.currentIndex ?? 0)
                        const isNewOwnerGroup = idx === 0 || player.memberId !== filteredBoard[idx - 1]?.memberId
                        return (
                          <BoardRow
                            key={player.rosterId}
                            player={player}
                            globalIndex={globalIndex}
                            isCurrent={isCurrent}
                            isPassed={isPassed}
                            isNewOwnerGroup={isNewOwnerGroup}
                            myMemberId={myMemberId}
                            preference={preferencesMap.get(player.playerId)}
                            canEditPreferences={canEditPreferences}
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

              {/* Mobile Activity Feed + Strategy Summary — after board so player list is primary */}
              <div className="lg:hidden space-y-3 mt-3">
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
            </div>
          </div>
        )}


        {/* D5: Floating compare bar */}
        {compareMode && comparePlayerIds.length > 0 && (
          <div className="fixed bottom-20 md:bottom-4 left-1/2 -translate-x-1/2 z-50 bg-surface-200 border border-primary-500/40 rounded-full px-3 py-1.5 md:px-4 md:py-2 flex items-center gap-2 md:gap-3 shadow-lg animate-[fadeIn_0.2s_ease-out]">
            <span className="text-xs md:text-sm text-gray-300">
              <span className="font-bold text-primary-400">{comparePlayerIds.length}</span>/3
            </span>
            <button
              onClick={() => { setShowCompareModal(true); }}
              disabled={comparePlayerIds.length < 2}
              className="px-2.5 py-1 md:px-3 md:py-1.5 rounded-full text-xs md:text-sm font-bold bg-primary-500 text-white hover:bg-primary-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              Confronta
            </button>
            <button
              onClick={() => { setComparePlayerIds([]); }}
              className="text-xs text-gray-400 hover:text-white px-1.5 py-0.5 md:px-2 md:py-1"
            >
              ✕
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
            {/* Official admin controls first */}
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
              <CompleteRubataPanel
                rubataState={rubataState ?? null}
                isSubmitting={isSubmitting}
                onCompleteRubata={() => void handleCompleteRubata()}
              />
            </>)}

            {/* Budget Panel - visible to all */}
            {boardData?.memberBudgets && boardData.memberBudgets.length > 0 && (
              <BudgetPanel memberBudgets={boardData.memberBudgets} />
            )}

            {/* Admin test/simulation panels last */}
            {isAdmin && (<>
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
            </>)}
          </div>
        </BottomSheet>

      </main>

      {/* Mobile Auction Dock — fixed during AUCTION on mobile (mockup v2: [-][importo][+][RILANCIA]) */}
      {activeAuction && rubataState === 'AUCTION' && (() => {
        const minBid = activeAuction.currentPrice + 1
        const isSeller = activeAuction.sellerId === myMemberId
        const myMaxBid = preferencesMap.get(activeAuction.player.id)?.maxBid
        const dockBid = Math.max(bidAmount, minBid)
        return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface-300 border-t-2 border-danger-500 shadow-lg shadow-black/40">
          {/* Intel row: player, current price, strategy limit */}
          <button
            type="button"
            onClick={() => { setBidSheetOpen(true); }}
            className="w-full px-3 pt-2 flex items-center gap-2 text-left"
            title="Apri pannello completo"
          >
            {timerDisplay !== null && (
              <CircularTimer seconds={timerDisplay} totalSeconds={auctionTimer} size="sm" />
            )}
            <span className="flex-1 min-w-0">
              <span className="block text-[10px] text-gray-500 uppercase truncate">
                {activeAuction.player.name} — offerta attuale <b className="text-accent-300 font-mono">{activeAuction.currentPrice}M</b>
              </span>
              {myMaxBid != null && (
                <span className="block text-[11px] text-primary-400 truncate">
                  Il tuo limite di strategia: <b className="font-mono">{myMaxBid}M</b>
                </span>
              )}
            </span>
            <span className="p-1 text-gray-400" aria-hidden="true">•••</span>
          </button>

          {/* Dock controls */}
          {!isSeller ? (
            <div className="px-3 py-2 flex items-stretch gap-2">
              <button
                type="button"
                onClick={() => { setBidAmount(prev => Math.max(minBid, prev - 1)); }}
                disabled={dockBid <= minBid}
                aria-label="Diminuisci offerta"
                className="w-12 rounded-xl bg-surface-200 border border-surface-50/30 text-white text-2xl font-bold disabled:opacity-30 active:scale-95 transition-all"
              >
                −
              </button>
              <div className="flex flex-col items-center justify-center w-[86px] rounded-xl bg-surface-200 border border-accent-500">
                <span className="stat-number text-2xl text-accent-300 leading-none">{dockBid}M</span>
                <span className="text-[9px] text-gray-500 uppercase tracking-wider mt-0.5">tua offerta</span>
              </div>
              <button
                type="button"
                onClick={() => { setBidAmount(prev => Math.max(minBid, prev) + 1); }}
                disabled={isSubmitting}
                aria-label="Aumenta offerta"
                className="w-12 rounded-xl bg-surface-200 border border-surface-50/30 text-white text-2xl font-bold disabled:opacity-30 active:scale-95 transition-all"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => void handleQuickBid(dockBid)}
                disabled={isSubmitting || dockBid <= activeAuction.currentPrice}
                className="flex-1 rounded-xl py-3 font-display font-extrabold uppercase tracking-wide text-dark-300 bg-gradient-to-b from-secondary-400 to-secondary-500 shadow-glow-green disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99] transition-all"
              >
                Rilancia
              </button>
            </div>
          ) : (
            <p className="px-3 py-2.5 text-center text-xs text-gray-400">
              Sei il proprietario — non puoi rilanciare
            </p>
          )}
        </div>
        )
      })()}

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

      {/* Mobile Budget Footer - Fixed Bottom (compact: own budget only, expandable) */}
      {boardData?.memberBudgets && boardData.memberBudgets.length > 0 && isRubataPhase && isOrderSet && rubataState !== 'AUCTION' && (() => {
        const myBudget = boardData.memberBudgets.find(mb => mb.memberId === myMemberId)
        return (
          <div className="md:hidden fixed bottom-0 left-0 right-0 bg-surface-200 border-t border-surface-50/30 z-40 shadow-lg shadow-black/30">
            {!mobileBudgetExpanded ? (
              /* Compact: single row with own budget */
              <button
                type="button"
                onClick={() => { setMobileBudgetExpanded(true); }}
                className="w-full px-3 py-1.5 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-gray-500 uppercase font-medium">Budget</span>
                  {myBudget && (
                    <span className={`font-bold text-sm ${
                      myBudget.residuo < 0 ? 'text-danger-400' : myBudget.residuo < 50 ? 'text-warning-400' : 'text-accent-400'
                    }`}>
                      {myBudget.residuo}M
                    </span>
                  )}
                </div>
                <span className="text-[9px] text-gray-500">▲ Tutti</span>
              </button>
            ) : (
              /* Expanded: full grid */
              <div className="px-3 py-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] text-gray-500 uppercase font-medium">Bilancio</span>
                  <button
                    type="button"
                    onClick={() => { setMobileBudgetExpanded(false); }}
                    className="text-[9px] text-gray-400 px-2 py-0.5 rounded bg-surface-300/50"
                  >
                    ▼ Chiudi
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {boardData.memberBudgets.map(mb => (
                    <div
                      key={mb.memberId}
                      className={`rounded p-1 text-center ${
                        mb.memberId === myMemberId ? 'ring-1 ring-primary-500/50' : ''
                      } ${mb.residuo < 0 ? 'bg-danger-500/20' : 'bg-surface-300/50'}`}
                    >
                      <div className="text-[8px] text-gray-500 truncate">{mb.teamName}</div>
                      <div className={`font-bold text-xs ${
                        mb.residuo < 0 ? 'text-danger-400' : mb.residuo < 50 ? 'text-warning-400' : 'text-accent-400'
                      }`}>
                        {mb.residuo}M
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })()}

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
