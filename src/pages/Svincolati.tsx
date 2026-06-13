import { useEffect } from 'react'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { useToast } from '../components/ui/Toast'
import { Textarea } from '@/components/ui/Textarea'
import { Navigation } from '../components/Navigation'
import { getTeamLogo } from '../utils/teamLogos'

import { ContractModifierModal } from '../components/ContractModifier'
import { ManagerDetailModal } from '../components/auction-room/AuctionRoomModals'
import { SvincolatiCockpit } from '../components/svincolati/SvincolatiCockpit'
import { useSvincolatiState } from '../hooks/useSvincolatiState'
import { POSITION_COLORS, SERIE_A_TEAMS } from '../types/svincolati.types'
import type { SvincolatiProps, TurnMember } from '../types/svincolati.types'
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface SortableTurnItemProps {
  member: TurnMember
  index: number
}

function SortableTurnItem({ member, index }: SortableTurnItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: member.id })
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
          ? 'bg-primary-900/50 border-primary-500 shadow-glow scale-105 opacity-50'
          : 'bg-surface-300 border-surface-50/20 hover:border-primary-500/40'
      }`}
    >
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-bold text-lg">
        {index + 1}
      </div>
      <div className="flex-1">
        <p className="font-semibold text-gray-100">{member.username}</p>
      </div>
      <span className="font-mono text-accent-400">{member.budget}</span>
      <span
        className="cursor-grab active:cursor-grabbing text-gray-500"
        {...attributes}
        {...listeners}
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
        </svg>
      </span>
    </div>
  )
}

export function Svincolati({ leagueId, onNavigate }: SvincolatiProps) {
  const {
    isLoading, board,
    freeAgents,
    searchQuery, setSearchQuery,
    selectedPosition, setSelectedPosition,
    selectedTeam, setSelectedTeam,
    teamDropdownOpen, setTeamDropdownOpen,
    teamDropdownRef,
    turnOrderDraft,
    bidAmount, setBidAmount,
    timerRemaining,
    error, success, setSuccess, isSubmitting,
    timerInput, setTimerInput,
    isAppealMode, setIsAppealMode,
    appealContent, setAppealContent,
    appealStatus, ackSubmitting, userHasAcked,
    showFinishConfirmModal, setShowFinishConfirmModal,
    pendingContractModification,
    selectedManager, setSelectedManager, loadingManager,
    isPusherConnected,
    isTimerExpired, currentUsername, isUserWinning,
    handleDndDragEnd, handleDndDragStart, handleSetTurnOrder,
    handleViewManagerRoster,
    handleNominate, handleConfirmNomination, handleCancelNomination, handlePassTurn,
    handleDeclareFinished, confirmDeclareFinished, handleForceAllFinished,
    handleMarkReady, handleForceReady,
    handleBid, handleCloseAuction,
    handleAcknowledge, handleForceAck,
    handleContractModification, handleSkipContractModification,
    handleSimulateAppeal, handleAcknowledgeAppealDecision,
    handleReadyToResume, handleForceAllAppealAcks, handleForceAllReadyResume,
    handlePause, handleResume,
    handleSetTimer,
    handleCompletePhase,
    handleBotNominate, handleBotConfirmNomination, handleBotBid,
    setError, loadBoard,
  } = useSvincolatiState(leagueId)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // Transient success feedback goes through toasts; blocking errors keep the
  // inline banner with the Riprova action
  const { toast } = useToast()
  useEffect(() => {
    if (success) {
      toast.success(success)
      setSuccess('')
    }
  }, [success, toast, setSuccess])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Caricamento sala asta svincolati...</p>
        </div>
      </div>
    )
  }

  const isAdmin = board?.isAdmin || false
  const state = board?.state || 'SETUP'

  // ==================== SETUP: Turn Order ====================
  if (board?.isActive && state === 'SETUP' && isAdmin) {
    return (
      <div className="min-h-screen">
        <header className="py-6 border-b border-surface-50/20 bg-surface-200">
          <div className="max-w-2xl mx-auto px-4">
            <button onClick={() => { onNavigate('leagueDetail', { leagueId }); }} className="text-primary-400 hover:text-primary-300 text-sm mb-2 flex items-center gap-1">
              <span>←</span> Torna alla lega
            </button>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white">Asta Svincolati - Ordine Turni</h1>
            <p className="text-gray-400 mt-1">Trascina i Direttori Generali per definire l'ordine dei turni</p>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-8">
          {error && (
            <div className="bg-danger-500/20 border border-danger-500/50 text-danger-400 p-4 rounded-lg mb-6">
              <p>{error}</p>
              <button
                onClick={() => { setError(''); void loadBoard(); }}
                className="mt-4 px-4 py-2 bg-primary-500 hover:bg-primary-400 text-white rounded-lg transition-colors min-h-[44px]"
              >
                Riprova
              </button>
            </div>
          )}
          {/* Timer Setting */}
          <div className="bg-surface-200 rounded-xl border border-surface-50/20 p-4 mb-6">
            <h3 className="font-bold text-white mb-3">Timer Asta</h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { setTimerInput(Math.max(10, timerInput - 5)); }}
                className="w-12 h-12 shrink-0 flex items-center justify-center rounded-lg bg-surface-300 text-white hover:bg-surface-300/70 text-xl font-bold"
              >
                −
              </button>
              <div className="flex-1 text-center">
                <span className="text-3xl font-mono font-bold text-white">{timerInput}</span>
                <span className="text-gray-400 ml-2">secondi</span>
              </div>
              <button
                type="button"
                onClick={() => { setTimerInput(Math.min(300, timerInput + 5)); }}
                className="w-12 h-12 shrink-0 flex items-center justify-center rounded-lg bg-surface-300 text-white hover:bg-surface-300/70 text-xl font-bold"
              >
                +
              </button>
            </div>
            <Button size="sm" onClick={() => void handleSetTimer()} disabled={isSubmitting} className="w-full mt-3">
              Imposta Timer
            </Button>
          </div>

          <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
            <div className="p-4 border-b border-surface-50/20 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent-500 to-accent-600 flex items-center justify-center">
                <span className="text-xl">👔</span>
              </div>
              <div>
                <h2 className="font-bold text-white">Direttori Generali</h2>
                <p className="text-sm text-gray-400">{turnOrderDraft.length} partecipanti</p>
              </div>
            </div>

            {turnOrderDraft.length === 0 ? (
              <div className="p-8 text-center text-warning-400">Nessun manager trovato</div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDndDragEnd} onDragStart={handleDndDragStart}>
                <SortableContext items={turnOrderDraft.map(m => m.id)} strategy={verticalListSortingStrategy}>
                  <div className="p-4 space-y-2">
                    {turnOrderDraft.map((member, index) => (
                      <SortableTurnItem key={member.id} member={member} index={index} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}

            <div className="p-4 border-t border-surface-50/20">
              <Button onClick={() => void handleSetTurnOrder()} disabled={isSubmitting || turnOrderDraft.length === 0} className="w-full py-3 text-lg font-bold">
                Conferma e Inizia Aste
              </Button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // Non-admin waiting for setup
  if (board?.isActive && state === 'SETUP' && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-surface-200 rounded-xl p-8 text-center max-w-md border border-surface-50/20">
          <div className="w-16 h-16 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-xl font-bold text-white mb-2">Sala Riunioni Svincolati</h2>
          <p className="text-gray-400">L'admin sta definendo l'ordine dei turni...</p>
        </div>
      </div>
    )
  }

  // Phase not active - show free agents in read-only mode
  if (!board?.isActive) {
    return (
      <div className="min-h-screen">
        <Navigation currentPage="svincolati" leagueId={leagueId} isLeagueAdmin={isAdmin} onNavigate={onNavigate} />
        <main className="max-w-[1600px] mx-auto px-4 py-6">
          {/* Header */}
          <div className="bg-surface-200 rounded-xl border border-surface-50/20 p-6 mb-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-secondary-500/50 to-secondary-700/50 flex items-center justify-center">
                <span className="text-2xl">🔓</span>
              </div>
              <div>
                <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">Giocatori Svincolati</h1>
                <p className="text-gray-400 text-sm">Giocatori attualmente non in rosa</p>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-surface-200 rounded-xl border border-surface-50/20 p-4 mb-4">
            <div className="flex flex-wrap gap-3">
              <Input
                type="text"
                placeholder="Cerca giocatore..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); }}
                className="flex-1 min-w-[200px]"
              />
              <select
                value={selectedPosition}
                onChange={(e) => { setSelectedPosition(e.target.value); }}
                className="bg-surface-300 border border-surface-50/30 text-white rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Tutti i ruoli</option>
                <option value="P">Portieri</option>
                <option value="D">Difensori</option>
                <option value="C">Centrocampisti</option>
                <option value="A">Attaccanti</option>
              </select>
              <div className="relative" ref={teamDropdownRef}>
                <button
                  type="button"
                  onClick={() => { setTeamDropdownOpen(!teamDropdownOpen); }}
                  className="bg-surface-300 border border-surface-50/30 text-white rounded-lg px-3 py-2 text-sm flex items-center gap-2 min-w-[150px]"
                >
                  {selectedTeam ? (
                    <>
                      <div className="w-5 h-5 bg-white/90 rounded flex items-center justify-center p-0.5">
                        <img src={getTeamLogo(selectedTeam)} alt={selectedTeam} className="w-4 h-4 object-contain" />
                      </div>
                      <span>{selectedTeam}</span>
                    </>
                  ) : (
                    <span className="text-gray-400">Squadra</span>
                  )}
                  <svg className={`w-4 h-4 ml-auto transition-transform ${teamDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {teamDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1 bg-surface-200 border border-surface-50/30 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto min-w-[180px]">
                    <button
                      type="button"
                      onClick={() => { setSelectedTeam(''); setTeamDropdownOpen(false) }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-300 ${!selectedTeam ? 'bg-primary-500/20 text-primary-400' : 'text-white'}`}
                    >
                      Tutte le squadre
                    </button>
                    {SERIE_A_TEAMS.map(team => (
                      <button
                        key={team}
                        type="button"
                        onClick={() => { setSelectedTeam(team); setTeamDropdownOpen(false) }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-300 flex items-center gap-2 ${selectedTeam === team ? 'bg-primary-500/20 text-primary-400' : 'text-white'}`}
                      >
                        <div className="w-5 h-5 bg-white/90 rounded flex items-center justify-center p-0.5 flex-shrink-0">
                          <img src={getTeamLogo(team)} alt={team} className="w-4 h-4 object-contain" />
                        </div>
                        <span>{team}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Position Counters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {(['P', 'D', 'C', 'A'] as const).map(pos => {
              const count = freeAgents.filter(p => p.position === pos).length
              const posNames: Record<string, string> = { P: 'Portieri', D: 'Difensori', C: 'Centrocampisti', A: 'Attaccanti' }
              return (
                <div
                  key={pos}
                  className={`bg-gradient-to-br ${POSITION_COLORS[pos] ?? ''} rounded-xl p-3 text-center`}
                >
                  <div className="text-2xl font-bold text-white">{count}</div>
                  <div className="text-xs text-white/80">{posNames[pos]}</div>
                </div>
              )
            })}
          </div>

          {/* Free Agents Table */}
          <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
            <div className="p-4 border-b border-surface-50/20">
              <h2 className="font-bold text-white">Giocatori Liberi ({freeAgents.length})</h2>
            </div>
            <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface-300">
                  <tr className="border-b border-surface-50/30 text-gray-400 text-xs uppercase">
                    <th className="text-left py-3 px-4 w-12">R</th>
                    <th className="text-left py-3 px-4">Giocatore</th>
                    <th className="text-left py-3 px-4 hidden sm:table-cell">Squadra</th>
                  </tr>
                </thead>
                <tbody>
                  {freeAgents.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-center py-8 text-gray-500">
                        Nessun giocatore trovato con i filtri selezionati
                      </td>
                    </tr>
                  ) : (
                    freeAgents.map(player => (
                      <tr key={player.id} className="border-b border-surface-50/10 hover:bg-surface-300/30">
                        <td className="py-2 px-4">
                          <span className={`w-8 h-8 rounded-full bg-gradient-to-br ${POSITION_COLORS[player.position] ?? ''} flex items-center justify-center text-xs font-bold text-white`}>
                            {player.position}
                          </span>
                        </td>
                        <td className="py-2 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-white/90 rounded flex items-center justify-center p-0.5 sm:hidden">
                              <img src={getTeamLogo(player.team)} alt={player.team} className="w-5 h-5 object-contain" />
                            </div>
                            <span className="font-medium text-white">{player.name}</span>
                          </div>
                        </td>
                        <td className="py-2 px-4 hidden sm:table-cell">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-white/90 rounded flex items-center justify-center p-0.5">
                              <img src={getTeamLogo(player.team)} alt={player.team} className="w-5 h-5 object-contain" />
                            </div>
                            <span className="text-gray-400">{player.team}</span>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // ==================== MAIN AUCTION ROOM (cockpit) ====================
  return (
    <div className="min-h-screen lg:h-dvh lg:flex lg:flex-col lg:overflow-hidden">
      <Navigation currentPage="svincolati" leagueId={leagueId} isLeagueAdmin={isAdmin} onNavigate={onNavigate} />

      <main className="w-full max-w-full mx-auto px-3 lg:px-4 py-3 lg:flex-1 lg:min-h-0 lg:flex lg:flex-col lg:overflow-hidden">
        {error && (
          <div className="bg-danger-500/20 border border-danger-500/50 text-danger-400 p-3 rounded-lg text-sm mb-3 lg:flex-shrink-0">
            <p>{error}</p>
            <Button onClick={() => { setError(''); void loadBoard(); }} size="sm" className="mt-3">Riprova</Button>
          </div>
        )}
        <SvincolatiCockpit
          board={board}
          freeAgents={freeAgents}
          currentUsername={currentUsername}
          isPusherConnected={isPusherConnected}
          isSubmitting={isSubmitting}
          isTimerExpired={isTimerExpired}
          isUserWinning={isUserWinning}
          timerRemaining={timerRemaining}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          selectedPosition={selectedPosition}
          setSelectedPosition={setSelectedPosition}
          selectedTeam={selectedTeam}
          setSelectedTeam={setSelectedTeam}
          bidAmount={bidAmount}
          setBidAmount={setBidAmount}
          timerInput={timerInput}
          onNominate={(id) => void handleNominate(id)}
          onConfirmNomination={() => void handleConfirmNomination()}
          onCancelNomination={() => void handleCancelNomination()}
          onPassTurn={() => void handlePassTurn()}
          onMarkReady={() => void handleMarkReady()}
          onBid={() => void handleBid()}
          onCloseAuction={() => void handleCloseAuction()}
          onViewManagerRoster={(m) => void handleViewManagerRoster(m)}
          onDeclareFinished={handleDeclareFinished}
          onSetTimer={(sec) => { setTimerInput(sec); void handleSetTimer(); }}
          onPause={() => void handlePause()}
          onResume={() => void handleResume()}
          onCompletePhase={() => void handleCompletePhase()}
          onBotNominate={() => void handleBotNominate()}
          onBotConfirmNomination={() => void handleBotConfirmNomination()}
          onBotBid={() => void handleBotBid()}
          onForceReady={() => void handleForceReady()}
          onForceAck={() => void handleForceAck()}
          onForceAllFinished={() => void handleForceAllFinished()}
        />
      </main>

      {/* ==================== MODALS ==================== */}

      {/* Confirm Finish Modal */}
      {showFinishConfirmModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-200 rounded-xl max-w-md w-full border border-surface-50/20">
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-warning-500/20">
                  <span className="text-3xl">⚠️</span>
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Conferma Fine Fase</h2>
                <p className="text-gray-400">
                  Stai per dichiarare di aver finito questa fase di mercato svincolati.
                </p>
              </div>

              <div className="bg-warning-500/10 border border-warning-500/30 rounded-lg p-4 mb-6">
                <p className="text-warning-400 text-sm text-center">
                  <strong>Attenzione:</strong> Questa azione è <strong>irreversibile</strong>.
                  Non potrai più fare offerte per nessun giocatore in questa fase.
                  Potrai comunque continuare a vedere le aste in corso.
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => { setShowFinishConfirmModal(false); }}
                  className="flex-1"
                >
                  Annulla
                </Button>
                <Button
                  variant="primary"
                  onClick={() => void confirmDeclareFinished()}
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  Conferma
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Acknowledgment Modal - Non mostrare se c'è un ricorso attivo */}
      {state === 'PENDING_ACK' && board?.pendingAck && !userHasAcked &&
       appealStatus?.auctionStatus !== 'APPEAL_REVIEW' &&
       appealStatus?.auctionStatus !== 'AWAITING_APPEAL_ACK' &&
       appealStatus?.auctionStatus !== 'AWAITING_RESUME' && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-200 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-surface-50/20">
            <div className="p-6">
              <div className="text-center mb-6">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${board.pendingAck.winnerUsername ? 'bg-secondary-500/20' : 'bg-surface-300'}`}>
                  <span className="text-3xl">{board.pendingAck.winnerUsername ? '✅' : '❌'}</span>
                </div>
                <h2 className="text-2xl font-bold text-white">{board.pendingAck.winnerUsername ? 'Transazione Completata' : 'Asta Conclusa'}</h2>
              </div>

              <div className="bg-surface-300 rounded-lg p-4 mb-4 text-center">
                <p className="font-bold text-xl text-white mb-2">{board.pendingAck.playerName}</p>
              </div>

              {board.pendingAck.winnerUsername ? (
                <div className="bg-primary-500/10 rounded-lg p-4 mb-4 text-center border border-primary-500/30">
                  <p className="text-sm text-primary-400">Acquistato da</p>
                  <p className="text-xl font-bold text-white">{board.pendingAck.winnerUsername}</p>
                  <p className="text-3xl font-bold text-accent-400 mt-1">{board.pendingAck.price}</p>
                </div>
              ) : (
                <div className="bg-surface-300 rounded-lg p-4 mb-4 text-center">
                  <p className="text-gray-400">Nessuna offerta - rimane svincolato</p>
                </div>
              )}

              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Conferme</span>
                  <span className="text-white">{board.pendingAck.acknowledgedMembers.length}/{board.turnOrder.length}</span>
                </div>
                <div className="w-full bg-surface-400 rounded-full h-2">
                  <div className="h-2 rounded-full bg-secondary-500 transition-all" style={{ width: `${(board.pendingAck.acknowledgedMembers.length / board.turnOrder.length) * 100}%` }}></div>
                </div>
              </div>

              {/* Appeal mode toggle */}
              {!isAppealMode ? (
                <div className="space-y-3">
                  <Button onClick={() => { void handleAcknowledge(false) }} disabled={ackSubmitting} className="w-full py-3 font-bold">
                    {ackSubmitting ? 'Conferma...' : 'Ho Visto, Conferma'}
                  </Button>
                  <button
                    onClick={() => { setIsAppealMode(true); }}
                    className="w-full text-sm text-danger-400 hover:text-danger-300 transition-colors"
                  >
                    Contesta questa transazione (Ricorso)
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-danger-400 font-medium">
                    Indica il motivo per cui contesti questa conclusione d'asta
                  </p>
                  <Textarea
                    value={appealContent}
                    onChange={e => { setAppealContent(e.target.value); }}
                    rows={3}
                    placeholder="Descrivi il motivo del ricorso..."
                    maxLength={500}
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => { setIsAppealMode(false); setAppealContent('') }}
                      className="flex-1 border-gray-500 text-gray-300"
                    >
                      Annulla
                    </Button>
                    <Button
                      onClick={() => { void handleAcknowledge(true) }}
                      disabled={ackSubmitting || !appealContent.trim()}
                      className="flex-1 bg-danger-500 hover:bg-danger-600 text-white"
                    >
                      {ackSubmitting ? 'Invio...' : 'Invia Ricorso'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Admin: Test button */}
              {isAdmin && !isAppealMode && (
                <Button
                  onClick={() => void handleSimulateAppeal()}
                  variant="outline"
                  className="w-full mt-3 text-xs border-accent-500/50 text-accent-400 hover:bg-accent-500/10"
                >
                  [TEST] Simula ricorso di un DG
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Waiting Modal - After acknowledging, waiting for others */}
      {state === 'PENDING_ACK' && board?.pendingAck && userHasAcked &&
       appealStatus?.auctionStatus !== 'APPEAL_REVIEW' &&
       appealStatus?.auctionStatus !== 'AWAITING_APPEAL_ACK' &&
       appealStatus?.auctionStatus !== 'AWAITING_RESUME' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-200 rounded-xl max-w-sm w-full p-6 text-center border border-surface-50/20">
            <div className="w-12 h-12 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-4"></div>
            <h3 className="font-bold text-white mb-2">In attesa degli altri</h3>
            <p className="text-sm text-gray-400 mb-3">{board.pendingAck.acknowledgedMembers.length}/{board.turnOrder.length} confermati</p>
            <p className="text-xs text-gray-500 mb-4">
              Mancano: {board.turnOrder.filter(m => !board.pendingAck!.acknowledgedMembers.includes(m.id)).map(m => m.username).join(', ')}
            </p>
            {isAdmin && (
              <Button size="sm" variant="outline" onClick={() => void handleForceAck()} className="border-accent-500/50 text-accent-400">
                [TEST] Forza Conferme
              </Button>
            )}
          </div>
        </div>
      )}

      {/* APPEAL_REVIEW Modal - Asta bloccata in attesa decisione admin */}
      {appealStatus?.auctionStatus === 'APPEAL_REVIEW' && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-200 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-danger-500/50">
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-danger-500/20 flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">⚖️</span>
                </div>
                <h2 className="text-2xl font-bold text-white">Ricorso in Valutazione</h2>
                <p className="text-gray-400 mt-1">L'admin della lega sta valutando il ricorso</p>
              </div>

              {appealStatus.player && (
                <div className="bg-surface-300 rounded-lg p-4 mb-4 text-center">
                  <p className="font-bold text-white">{appealStatus.player.name}</p>
                  <p className="text-sm text-gray-400">{appealStatus.player.team}</p>
                </div>
              )}

              {appealStatus.appeal && (
                <div className="bg-danger-500/10 border border-danger-500/30 rounded-lg p-4 mb-4">
                  <p className="text-xs text-danger-400 uppercase font-bold mb-2">Motivo del ricorso</p>
                  <p className="text-gray-300">{appealStatus.appeal.reason}</p>
                  <p className="text-sm text-gray-500 mt-2">
                    Presentato da: <span className="text-white">{appealStatus.appeal.submittedBy?.username}</span>
                  </p>
                </div>
              )}

              {appealStatus.winner && (
                <div className="bg-primary-500/10 rounded-lg p-4 mb-4 text-center border border-primary-500/30">
                  <p className="text-sm text-primary-400">Transazione contestata</p>
                  <p className="text-lg font-bold text-white">{appealStatus.winner.username}</p>
                  <p className="text-2xl font-bold text-accent-400 mt-1">{appealStatus.finalPrice}</p>
                </div>
              )}

              <div className="text-center text-gray-400 text-sm">
                <p>L'asta è in pausa fino alla decisione dell'admin</p>
              </div>

              {isAdmin && (
                <Button
                  onClick={() => { onNavigate('admin', { leagueId, tab: 'appeals' }); }}
                  className="w-full mt-4 bg-danger-500 hover:bg-danger-600 text-white font-bold py-3"
                >
                  Gestisci Ricorso
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AWAITING_APPEAL_ACK Modal - Tutti devono confermare di aver visto la decisione */}
      {appealStatus?.auctionStatus === 'AWAITING_APPEAL_ACK' && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-200 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-surface-50/20">
            <div className="p-6">
              <div className="text-center mb-6">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${appealStatus.appeal?.status === 'ACCEPTED' ? 'bg-warning-500/20' : 'bg-secondary-500/20'}`}>
                  <span className="text-3xl">{appealStatus.appeal?.status === 'ACCEPTED' ? '🔄' : '✅'}</span>
                </div>
                <h2 className="text-2xl font-bold text-white">
                  Ricorso {appealStatus.appeal?.status === 'ACCEPTED' ? 'Accolto' : 'Respinto'}
                </h2>
                <p className="text-gray-400 mt-1">
                  {appealStatus.appeal?.status === 'ACCEPTED'
                    ? 'La transazione è stata annullata, l\'asta riprenderà'
                    : 'La transazione è confermata'}
                </p>
              </div>

              {appealStatus.player && (
                <div className="bg-surface-300 rounded-lg p-4 mb-4 text-center">
                  <p className="font-bold text-white">{appealStatus.player.name}</p>
                  <p className="text-sm text-gray-400">{appealStatus.player.team}</p>
                </div>
              )}

              {appealStatus.appeal?.adminNotes && (
                <div className="bg-surface-300 border border-surface-50/30 rounded-lg p-4 mb-4">
                  <p className="text-xs text-gray-400 uppercase font-bold mb-2">Note dell'admin</p>
                  <p className="text-gray-300">{appealStatus.appeal.adminNotes}</p>
                </div>
              )}

              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Conferme presa visione</span>
                  <span className="text-white">{appealStatus.appealDecisionAcks?.length || 0}/{appealStatus.allMembers?.length || 0}</span>
                </div>
                <div className="w-full bg-surface-400 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-secondary-500 transition-all"
                    style={{ width: `${((appealStatus.appealDecisionAcks?.length || 0) / (appealStatus.allMembers?.length || 1)) * 100}%` }}
                  ></div>
                </div>
                {appealStatus.allMembers && appealStatus.allMembers.filter(m => !appealStatus.appealDecisionAcks?.includes(m.id)).length > 0 && (
                  <p className="text-xs text-gray-500 mt-2">
                    Mancano: {appealStatus.allMembers.filter(m => !appealStatus.appealDecisionAcks?.includes(m.id)).map(m => m.username).join(', ')}
                  </p>
                )}
              </div>

              {!appealStatus.userHasAcked ? (
                <Button
                  onClick={() => void handleAcknowledgeAppealDecision()}
                  disabled={ackSubmitting}
                  className="w-full py-3 font-bold"
                >
                  {ackSubmitting ? 'Conferma...' : 'Ho Preso Visione'}
                </Button>
              ) : (
                <div className="text-center text-secondary-400">
                  <p>✓ Hai confermato. In attesa degli altri...</p>
                </div>
              )}

              {isAdmin && (
                <Button
                  onClick={() => void handleForceAllAppealAcks()}
                  variant="outline"
                  className="w-full mt-3 text-xs border-accent-500/50 text-accent-400 hover:bg-accent-500/10"
                >
                  [TEST] Forza Tutte le Conferme
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AWAITING_RESUME Modal - Ready check prima di riprendere l'asta */}
      {appealStatus?.auctionStatus === 'AWAITING_RESUME' && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-200 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto border-2 border-accent-500/50 animate-pulse-slow">
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-accent-500/20 flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">🔄</span>
                </div>
                <h2 className="text-2xl font-bold text-white">Ripresa Asta</h2>
                <p className="text-gray-400 mt-1">Tutti devono confermare di essere pronti</p>
              </div>

              {appealStatus.player && (
                <div className="bg-surface-300 rounded-lg p-4 mb-4 text-center">
                  <p className="font-bold text-white">{appealStatus.player.name}</p>
                  <p className="text-sm text-gray-400">{appealStatus.player.team}</p>
                </div>
              )}

              <div className="bg-warning-500/10 border border-warning-500/30 rounded-lg p-4 mb-4 text-center">
                <p className="text-warning-400 font-medium">
                  Il ricorso è stato accolto. L'asta riprenderà dall'ultima offerta valida.
                </p>
              </div>

              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">DG pronti</span>
                  <span className="text-white">{appealStatus.resumeReadyMembers?.length || 0}/{appealStatus.allMembers?.length || 0}</span>
                </div>
                <div className="w-full bg-surface-400 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-accent-500 transition-all"
                    style={{ width: `${((appealStatus.resumeReadyMembers?.length || 0) / (appealStatus.allMembers?.length || 1)) * 100}%` }}
                  ></div>
                </div>
                {appealStatus.allMembers && appealStatus.allMembers.filter(m => !appealStatus.resumeReadyMembers?.includes(m.id)).length > 0 && (
                  <p className="text-xs text-gray-500 mt-2">
                    Mancano: {appealStatus.allMembers.filter(m => !appealStatus.resumeReadyMembers?.includes(m.id)).map(m => m.username).join(', ')}
                  </p>
                )}
              </div>

              {!appealStatus.userIsReady ? (
                <Button
                  onClick={() => void handleReadyToResume()}
                  disabled={ackSubmitting}
                  className="w-full py-3 font-bold bg-accent-500 hover:bg-accent-600"
                >
                  {ackSubmitting ? 'Conferma...' : 'Sono Pronto'}
                </Button>
              ) : (
                <div className="text-center text-accent-400">
                  <p>✓ Sei pronto. In attesa degli altri...</p>
                </div>
              )}

              {isAdmin && (
                <Button
                  onClick={() => void handleForceAllReadyResume()}
                  variant="outline"
                  className="w-full mt-3 text-xs border-accent-500/50 text-accent-400 hover:bg-accent-500/10"
                >
                  [TEST] Forza Tutti Pronti
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Contract Modification Modal after Svincolati Win */}
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
          description="Hai appena acquistato questo svincolato. Puoi solo aumentare ingaggio (minimo attuale) e durata (minimo 3, massimo 4 semestri)."
          isSvincolatiMode={true}
        />
      )}

      {/* Manager Roster Modal — shared component, same style as "La mia rosa" */}
      {loadingManager ? (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => { setSelectedManager(null); }}>
          <div className="bg-surface-200 rounded-xl max-w-lg w-full border border-surface-50 p-6 flex items-center justify-center" onClick={e => { e.stopPropagation(); }}>
            <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
          </div>
        </div>
      ) : (
        <ManagerDetailModal
          selectedManager={selectedManager}
          onClose={() => { setSelectedManager(null); }}
          rosterMode="count"
        />
      )}
    </div>
  )
}
