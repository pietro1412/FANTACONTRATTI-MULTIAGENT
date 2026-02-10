import { useRubataState } from '../hooks/useRubataState'
import { Button } from '../components/ui/Button'
import { Navigation } from '../components/Navigation'
import { getTeamLogo } from '../utils/teamLogos'
import { getPlayerPhotoUrl } from '../utils/player-images'
import { ContractModifierModal } from '../components/ContractModifier'
import { PlayerStatsModal } from '../components/PlayerStatsModal'
import { RubataStepper } from '../components/rubata/RubataStepper'
import { PreferenceModal } from '../components/rubata/PreferenceModal'
import { POSITION_COLORS } from '../types/rubata.types'

// Componente logo squadra
function TeamLogo({ team }: { team: string }) {
  return (
    <img
      src={getTeamLogo(team)}
      alt={team}
      className="w-full h-full object-contain"
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = 'none'
      }}
    />
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
    orderDraft, draggedIndex, dragOverIndex, moveInOrder,
    handleDragStart, handleDragEnd, handleDragOver, handleDragLeave, handleDrop,
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
  } = useRubataState(leagueId)

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-300">
        <Navigation currentPage="rubata" leagueId={leagueId} isLeagueAdmin={isAdmin} onNavigate={onNavigate} />
        <div className="flex items-center justify-center h-[80vh]">
          <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark-300">
      <Navigation currentPage="rubata" leagueId={leagueId} isLeagueAdmin={isAdmin} onNavigate={onNavigate} />

      {/* Transaction Confirmation Modal - Resta aperta finché TUTTI i manager confermano */}
      {rubataState === 'PENDING_ACK' && pendingAck && !pendingAck.allAcknowledged &&
       !['APPEAL_REVIEW', 'AWAITING_APPEAL_ACK', 'AWAITING_RESUME'].includes(appealStatus?.auctionStatus || '') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-gradient-to-br from-purple-900 to-purple-950 rounded-3xl p-6 max-w-lg w-full shadow-2xl border-2 border-purple-400 animate-bounce-in max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/10 mb-3">
                <span className="text-4xl">{pendingAck.winner ? '🎯' : '🛡️'}</span>
              </div>
              <h2 className="text-2xl font-black text-white uppercase tracking-wide">
                {pendingAck.winner ? 'RUBATA COMPLETATA!' : 'NESSUNA RUBATA'}
              </h2>
              <p className="text-purple-200 text-sm mt-1">Conferma la transazione per procedere</p>
            </div>

            {/* Player Card */}
            <div className="bg-white/10 rounded-2xl p-4 mb-4">
              <div className="flex items-center justify-center gap-3 mb-3">
                <div className="w-10 h-10 bg-white rounded p-1">
                  <TeamLogo team={pendingAck.player.team} />
                </div>
                <div className={`w-10 h-10 flex items-center justify-center rounded-full ${POSITION_COLORS[pendingAck.player.position as keyof typeof POSITION_COLORS] || 'bg-gray-500/20 text-gray-400'} border-2`}>
                  <span className="font-bold">{pendingAck.player.position}</span>
                </div>
              </div>
              <p className="text-center text-2xl font-bold text-white">{pendingAck.player.name}</p>
            </div>

            {/* Transaction Details */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-white/5 rounded-xl p-3 text-center">
                <p className="text-xs text-purple-300 uppercase">Da</p>
                <p className="font-bold text-white">{pendingAck.seller.username}</p>
              </div>
              <div className="bg-white/5 rounded-xl p-3 text-center">
                <p className="text-xs text-purple-300 uppercase">A</p>
                <p className="font-bold text-secondary-400">{pendingAck.winner?.username || 'Nessuno'}</p>
              </div>
            </div>

            {/* Price */}
            {pendingAck.winner && (
              <div className="bg-white/10 rounded-xl p-3 text-center mb-4">
                <p className="text-xs text-purple-300 uppercase">Prezzo Finale</p>
                <p className="text-3xl font-black text-accent-400">{pendingAck.finalPrice}M</p>
              </div>
            )}

            {/* Confirmation Status */}
            <div className="bg-white/5 rounded-xl p-4 mb-4">
              <div className="flex justify-between items-center mb-3">
                <span className="text-purple-200 text-sm">Conferme</span>
                <span className="text-white font-bold">{pendingAck.totalAcknowledged} / {pendingAck.totalMembers}</span>
              </div>
              <div className="h-3 bg-white/10 rounded-full overflow-hidden mb-3">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-secondary-500 transition-all duration-500"
                  style={{ width: `${(pendingAck.totalAcknowledged / pendingAck.totalMembers) * 100}%` }}
                />
              </div>

              {/* Members List */}
              <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                {pendingAck.acknowledgedMembers.map((member) => (
                  <div key={member.id} className="flex items-center gap-2 p-2 rounded-lg bg-secondary-500/20 text-sm">
                    <span className="text-secondary-400">✓</span>
                    <span className="text-white truncate">{member.username}</span>
                  </div>
                ))}
                {pendingAck.pendingMembers.map((member) => (
                  <div key={member.id} className="flex items-center gap-2 p-2 rounded-lg bg-white/5 text-sm">
                    <span className="text-gray-500">○</span>
                    <span className="text-gray-400 truncate">{member.username}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Existing Prophecies */}
            {pendingAck.prophecies && pendingAck.prophecies.length > 0 && (
              <div className="bg-white/5 rounded-xl p-3 mb-4">
                <p className="text-xs text-purple-300 uppercase font-bold mb-2 flex items-center gap-1">
                  <span>🔮</span> Profezie
                </p>
                <div className="space-y-2 max-h-24 overflow-y-auto">
                  {pendingAck.prophecies.map((p, idx) => (
                    <div key={idx} className="bg-white/5 rounded-lg p-2">
                      <p className="text-sm text-white">{p.content}</p>
                      <p className="text-xs text-gray-500 mt-1">— {p.username}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Appeal Mode Input */}
            {isAppealMode && (
              <div className="mb-4">
                <label className="block text-xs text-danger-300 uppercase font-bold mb-2">
                  ⚠️ Motivo del ricorso
                </label>
                <textarea
                  value={appealContent}
                  onChange={(e) => setAppealContent(e.target.value)}
                  className="w-full bg-danger-500/10 border border-danger-500/30 rounded-xl p-3 text-white placeholder-gray-500 text-sm resize-none focus:border-danger-400 focus:outline-none"
                  rows={3}
                  placeholder="Descrivi il motivo del ricorso..."
                  maxLength={500}
                />
                <p className="text-xs text-gray-500 mt-1 text-right">{appealContent.length}/500</p>
              </div>
            )}

            {/* Prophecy Input (only if not in appeal mode) */}
            {!isAppealMode && (
              <div className="mb-4">
                <label className="block text-xs text-purple-300 uppercase font-bold mb-2">
                  🔮 La tua profezia (opzionale)
                </label>
                <textarea
                  value={prophecyContent}
                  onChange={(e) => setProphecyContent(e.target.value)}
                  className="w-full bg-white/5 border border-purple-500/30 rounded-xl p-3 text-white placeholder-gray-500 text-sm resize-none focus:border-purple-400 focus:outline-none"
                  rows={2}
                  placeholder="Scrivi una previsione su questa transazione..."
                  maxLength={200}
                />
                <p className="text-xs text-gray-500 mt-1 text-right">{prophecyContent.length}/200</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2">
              {pendingAck.userAcknowledged ? (
                /* User already confirmed - show waiting state */
                <div className="w-full py-3 text-center rounded-xl bg-secondary-500/20 border border-secondary-500/30">
                  <p className="text-secondary-400 font-bold">✅ Hai confermato</p>
                  <p className="text-xs text-gray-400 mt-1">In attesa degli altri manager ({pendingAck.totalAcknowledged}/{pendingAck.totalMembers})</p>
                </div>
              ) : !isAppealMode ? (
                <>
                  <Button onClick={handleAcknowledgeWithAppeal} disabled={isSubmitting} className="w-full py-3 text-lg">
                    {prophecyContent.trim() ? '🔮 CONFERMA CON PROFEZIA' : '✅ CONFERMA TRANSAZIONE'}
                  </Button>
                  <button
                    onClick={() => setIsAppealMode(true)}
                    className="w-full py-2 text-sm text-danger-400 hover:text-danger-300 underline"
                  >
                    ⚠️ Voglio fare ricorso
                  </button>
                </>
              ) : (
                <>
                  <Button
                    onClick={handleAcknowledgeWithAppeal}
                    disabled={isSubmitting || !appealContent.trim()}
                    className="w-full py-3 text-lg bg-danger-500 hover:bg-danger-600"
                  >
                    ⚠️ INVIA RICORSO E CONFERMA
                  </Button>
                  <button
                    onClick={() => { setIsAppealMode(false); setAppealContent('') }}
                    className="w-full py-2 text-sm text-gray-400 hover:text-white"
                  >
                    Annulla ricorso
                  </button>
                </>
              )}

              {/* Admin: Simula ricorso */}
              {isAdmin && (
                <div className="pt-2 border-t border-white/10 space-y-2">
                  <button
                    onClick={() => onNavigate('admin', { leagueId, tab: 'appeals' })}
                    className="w-full py-2 text-xs text-purple-400 hover:text-purple-300"
                  >
                    📋 Vai al pannello ricorsi
                  </button>
                  <Button onClick={handleSimulateAppeal} disabled={isSubmitting} variant="outline" className="w-full text-xs border-danger-500/50 text-danger-400">
                    🤖 [TEST] Simula ricorso di un DG
                  </Button>
                  <Button onClick={handleForceAllAcknowledge} disabled={isSubmitting} variant="outline" className="w-full text-xs">
                    🤖 [TEST] Forza Tutte le Conferme
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* APPEAL_REVIEW Modal - Transazione sospesa in attesa decisione admin */}
      {(appealStatus?.auctionStatus === 'APPEAL_REVIEW') && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-gradient-to-br from-danger-900 to-danger-950 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto border-2 border-danger-500">
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-danger-500/20 flex items-center justify-center mx-auto mb-4 animate-pulse">
                  <span className="text-4xl">⚠️</span>
                </div>
                <h2 className="text-2xl font-black text-white uppercase">Ricorso in Corso</h2>
                <p className="text-danger-200 mt-1">La transazione è sospesa in attesa della decisione dell'admin</p>
              </div>

              {/* Player info */}
              {appealStatus?.player && (
                <div className="bg-white/10 rounded-xl p-4 mb-4 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${POSITION_COLORS[appealStatus.player.position] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
                    <span className="font-bold">{appealStatus.player.position}</span>
                  </div>
                  <div className="w-8 h-8 bg-white rounded p-0.5 flex-shrink-0">
                    <TeamLogo team={appealStatus.player.team} />
                  </div>
                  <div>
                    <p className="font-bold text-white">{appealStatus.player.name}</p>
                    <p className="text-sm text-gray-400">{appealStatus.player.team}</p>
                  </div>
                </div>
              )}

              {/* Appeal details */}
              {appealStatus?.appeal && (
                <div className="bg-danger-500/10 border border-danger-500/30 rounded-xl p-4 mb-4">
                  <p className="text-xs text-danger-300 uppercase font-bold mb-2">Motivo del ricorso</p>
                  <p className="text-gray-200">{appealStatus.appeal.reason}</p>
                  <p className="text-sm text-gray-500 mt-2">Presentato da: <span className="text-white">{appealStatus.appeal.submittedBy?.username}</span></p>
                </div>
              )}

              {/* Transaction info */}
              {appealStatus?.winner && (
                <div className="bg-white/10 rounded-xl p-4 mb-4 text-center">
                  <p className="text-sm text-danger-300">Transazione contestata</p>
                  <p className="text-lg font-bold text-white">{appealStatus.winner.username}</p>
                  <p className="text-2xl font-black text-accent-400 mt-1">{appealStatus.finalPrice}M</p>
                </div>
              )}

              <div className="text-center py-4">
                <div className="w-10 h-10 border-4 border-danger-500/30 border-t-danger-500 rounded-full animate-spin mx-auto mb-3"></div>
                <p className="text-gray-400">In attesa della decisione dell'admin...</p>
              </div>

              {/* Admin button */}
              {isAdmin && (
                <Button
                  onClick={() => onNavigate('admin', { leagueId, tab: 'appeals' })}
                  className="w-full bg-danger-500 hover:bg-danger-600 text-white font-bold py-3"
                >
                  Gestisci Ricorso
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AWAITING_APPEAL_ACK Modal - Tutti devono confermare di aver visto la decisione */}
      {(appealStatus?.auctionStatus === 'AWAITING_APPEAL_ACK') && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-gradient-to-br from-surface-200 to-surface-300 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto border-2 border-surface-50/30">
            <div className="p-6">
              <div className="text-center mb-6">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${appealStatus?.appeal?.status === 'ACCEPTED' ? 'bg-warning-500/20' : 'bg-secondary-500/20'}`}>
                  <span className="text-4xl">{appealStatus?.appeal?.status === 'ACCEPTED' ? '🔄' : '✅'}</span>
                </div>
                <h2 className="text-2xl font-black text-white uppercase">
                  Ricorso {appealStatus?.appeal?.status === 'ACCEPTED' ? 'Accolto' : 'Respinto'}
                </h2>
                <p className="text-gray-400 mt-1">
                  {appealStatus?.appeal?.status === 'ACCEPTED'
                    ? 'La transazione è stata annullata, l\'asta riprenderà'
                    : 'La transazione è confermata'}
                </p>
              </div>

              {/* Player info */}
              {appealStatus?.player && (
                <div className="bg-white/10 rounded-xl p-4 mb-4 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${POSITION_COLORS[appealStatus.player.position] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
                    <span className="font-bold">{appealStatus.player.position}</span>
                  </div>
                  <div className="w-8 h-8 bg-white rounded p-0.5 flex-shrink-0">
                    <TeamLogo team={appealStatus.player.team} />
                  </div>
                  <div>
                    <p className="font-bold text-white">{appealStatus.player.name}</p>
                    <p className="text-sm text-gray-400">{appealStatus.player.team}</p>
                  </div>
                </div>
              )}

              {/* Admin notes */}
              {appealStatus?.appeal?.adminNotes && (
                <div className="bg-white/10 border border-white/20 rounded-xl p-4 mb-4">
                  <p className="text-xs text-gray-400 uppercase font-bold mb-2">Note dell'admin</p>
                  <p className="text-gray-200">{appealStatus.appeal.adminNotes}</p>
                </div>
              )}

              {/* Ack progress */}
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Conferme presa visione</span>
                  <span className="text-white">{appealStatus?.appealDecisionAcks?.length || 0}/{appealStatus?.allMembers?.length || 0}</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-secondary-500 to-purple-500 transition-all duration-500"
                    style={{ width: `${((appealStatus?.appealDecisionAcks?.length || 0) / (appealStatus?.allMembers?.length || 1)) * 100}%` }}
                  ></div>
                </div>
                {appealStatus?.allMembers && appealStatus.allMembers.filter(m => !appealStatus.appealDecisionAcks?.includes(m.id)).length > 0 && (
                  <p className="text-xs text-gray-500 mt-2">
                    Mancano: {appealStatus.allMembers.filter(m => !appealStatus.appealDecisionAcks?.includes(m.id)).map(m => m.username).join(', ')}
                  </p>
                )}
              </div>

              {/* Action buttons */}
              {!appealStatus?.userHasAcked ? (
                <Button
                  onClick={handleAcknowledgeAppealDecision}
                  disabled={isSubmitting}
                  className="w-full bg-secondary-500 hover:bg-secondary-600 text-white font-bold py-3 text-lg"
                >
                  {isSubmitting ? 'Invio...' : 'Ho preso visione'}
                </Button>
              ) : (
                <div className="text-center py-4">
                  <p className="text-secondary-400 font-medium mb-2">✓ Hai confermato - In attesa degli altri</p>
                </div>
              )}

              {/* Admin test button */}
              {isAdmin && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleForceAllAppealAcks}
                  disabled={isSubmitting}
                  className="w-full mt-3 border-accent-500/50 text-accent-400"
                >
                  🤖 [TEST] Forza Tutte Conferme Ricorso
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AWAITING_RESUME Modal - Ready check prima di riprendere l'asta */}
      {(appealStatus?.auctionStatus === 'AWAITING_RESUME') && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-gradient-to-br from-accent-900 to-orange-950 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto border-4 border-accent-500 animate-pulse-slow">
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-accent-500/20 flex items-center justify-center mx-auto mb-4 animate-bounce">
                  <span className="text-4xl">🔔</span>
                </div>
                <h2 className="text-2xl font-black text-white uppercase">Pronto a Riprendere?</h2>
                <p className="text-orange-200 mt-1">L'asta sta per riprendere, conferma la tua presenza</p>
              </div>

              {/* Player info */}
              {appealStatus?.player && (
                <div className="bg-white/10 rounded-xl p-4 mb-4 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${POSITION_COLORS[appealStatus.player.position] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
                    <span className="font-bold">{appealStatus.player.position}</span>
                  </div>
                  <div className="w-8 h-8 bg-white rounded p-0.5 flex-shrink-0">
                    <TeamLogo team={appealStatus.player.team} />
                  </div>
                  <div>
                    <p className="font-bold text-white">{appealStatus.player.name}</p>
                    <p className="text-sm text-gray-400">{appealStatus.player.team}</p>
                  </div>
                </div>
              )}

              <div className="bg-warning-500/10 border border-warning-500/30 rounded-xl p-4 mb-4 text-center">
                <p className="text-warning-400 font-medium">
                  Il ricorso è stato accolto. L'asta riprenderà dall'ultima offerta valida.
                </p>
              </div>

              {/* Ready progress */}
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">DG pronti</span>
                  <span className="text-white">{appealStatus?.resumeReadyMembers?.length || 0}/{appealStatus?.allMembers?.length || 0}</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-accent-500 to-orange-500 transition-all duration-500"
                    style={{ width: `${((appealStatus?.resumeReadyMembers?.length || 0) / (appealStatus?.allMembers?.length || 1)) * 100}%` }}
                  ></div>
                </div>
                {appealStatus?.allMembers && appealStatus.allMembers.filter(m => !appealStatus.resumeReadyMembers?.includes(m.id)).length > 0 && (
                  <p className="text-xs text-gray-500 mt-2">
                    Mancano: {appealStatus.allMembers.filter(m => !appealStatus.resumeReadyMembers?.includes(m.id)).map(m => m.username).join(', ')}
                  </p>
                )}
              </div>

              {/* Action buttons */}
              {!appealStatus?.userIsReady ? (
                <Button
                  onClick={handleMarkReadyToResume}
                  disabled={isSubmitting}
                  className="w-full btn-accent py-3 text-lg font-bold"
                >
                  {isSubmitting ? 'Attendi...' : 'SONO PRONTO'}
                </Button>
              ) : (
                <div className="text-center py-4">
                  <p className="text-secondary-400 font-medium mb-2">✓ Pronto - In attesa degli altri</p>
                </div>
              )}

              {/* Admin test button */}
              {isAdmin && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleForceAllReadyResume}
                  disabled={isSubmitting}
                  className="w-full mt-3 border-accent-500/50 text-accent-400"
                >
                  🤖 [TEST] Forza Tutti Pronti
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Auction Ready Check Modal - Before Auction Starts */}
      {rubataState === 'AUCTION_READY_CHECK' && boardData?.auctionReadyInfo && readyStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-gradient-to-br from-orange-900 to-orange-950 rounded-3xl p-6 max-w-lg w-full shadow-2xl border-4 border-orange-400 animate-bounce-in">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/20 mb-4 animate-pulse">
                <span className="text-6xl">🎯</span>
              </div>
              <h2 className="text-3xl font-black text-white uppercase tracking-wide">
                RUBATA!
              </h2>
              <p className="text-orange-200 text-sm mt-2">Qualcuno vuole rubare questo giocatore!</p>
            </div>

            {/* Bidder Info */}
            <div className="bg-white/10 rounded-2xl p-4 mb-4">
              <p className="text-center text-orange-200 text-sm uppercase tracking-wider mb-2">
                Volontà di rubare di
              </p>
              <p className="text-center text-3xl font-black text-white">
                {boardData.auctionReadyInfo.bidderUsername}
              </p>
            </div>

            {/* Player Info */}
            <div className="bg-white/10 rounded-2xl p-4 mb-4">
              <div className="flex items-center justify-center gap-3 mb-2">
                <div className="w-10 h-10 bg-white rounded p-1">
                  <TeamLogo team={boardData.auctionReadyInfo.playerTeam} />
                </div>
                <div className={`w-10 h-10 flex items-center justify-center rounded-full ${POSITION_COLORS[boardData.auctionReadyInfo.playerPosition as keyof typeof POSITION_COLORS] || 'bg-gray-500/20 text-gray-400'} border-2`}>
                  <span className="font-bold">{boardData.auctionReadyInfo.playerPosition}</span>
                </div>
              </div>
              <p className="text-center text-2xl font-bold text-white">
                {boardData.auctionReadyInfo.playerName}
              </p>
              <p className="text-center text-orange-200">
                di <span className="font-semibold text-white">{boardData.auctionReadyInfo.ownerUsername}</span>
              </p>
            </div>

            {/* Price */}
            <div className="text-center mb-4">
              <p className="text-orange-200 text-sm uppercase tracking-wider mb-1">
                Prezzo rubata
              </p>
              <p className="text-4xl font-black text-white">
                {boardData.auctionReadyInfo.basePrice}M
              </p>
            </div>

            {/* Ready Status */}
            <div className="bg-white/5 rounded-xl p-4 mb-4">
              <div className="flex justify-between items-center mb-3">
                <span className="text-orange-200 text-sm font-bold uppercase">Manager Pronti</span>
                <span className="text-white font-bold">{readyStatus.readyCount} / {readyStatus.totalMembers}</span>
              </div>
              <div className="h-3 bg-white/10 rounded-full overflow-hidden mb-3">
                <div
                  className="h-full bg-gradient-to-r from-orange-500 to-yellow-500 transition-all duration-500"
                  style={{ width: `${(readyStatus.readyCount / readyStatus.totalMembers) * 100}%` }}
                />
              </div>

              {/* Members List */}
              <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                {readyStatus.readyMembers.map((member) => (
                  <div key={member.id} className="flex items-center gap-2 p-2 rounded-lg bg-secondary-500/20 text-sm">
                    <div className="relative flex-shrink-0">
                      <span className="text-secondary-400">✓</span>
                      <span
                        className={`absolute -bottom-1 -right-1 w-2 h-2 rounded-full border border-surface-200 ${
                          member.isConnected === true ? 'bg-green-500' : member.isConnected === false ? 'bg-red-500' : 'bg-gray-500'
                        }`}
                        title={member.isConnected ? 'Online' : 'Offline'}
                      />
                    </div>
                    <span className="text-white truncate">{member.username}</span>
                  </div>
                ))}
                {readyStatus.pendingMembers.map((member) => (
                  <div key={member.id} className="flex items-center gap-2 p-2 rounded-lg bg-white/5 text-sm">
                    <div className="relative flex-shrink-0">
                      <span className="text-gray-500">○</span>
                      <span
                        className={`absolute -bottom-1 -right-1 w-2 h-2 rounded-full border border-surface-200 ${
                          member.isConnected === true ? 'bg-green-500' : member.isConnected === false ? 'bg-red-500' : 'bg-gray-500'
                        }`}
                        title={member.isConnected ? 'Online' : 'Offline'}
                      />
                    </div>
                    <span className="text-gray-400 truncate">{member.username}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              {!readyStatus.userIsReady ? (
                <Button onClick={handleSetReady} disabled={isSubmitting} className="w-full py-3 text-lg bg-orange-500 hover:bg-orange-600">
                  ✅ SONO PRONTO PER L'ASTA!
                </Button>
              ) : (
                <div className="w-full py-3 bg-secondary-500/20 border border-secondary-500/40 rounded-xl text-secondary-400 font-bold text-center">
                  ✓ Sei pronto - attendi gli altri manager
                </div>
              )}
              {isAdmin && (
                <Button onClick={handleForceAllReady} disabled={isSubmitting} variant="outline" className="w-full border-orange-500/50 text-orange-400">
                  [TEST] Forza Tutti Pronti
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <main className="max-w-[1600px] mx-auto px-4 py-8">
        {error && (
          <div className="bg-danger-500/20 border border-danger-500/30 text-danger-400 p-3 rounded-lg mb-4">{error}</div>
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
                <div className="space-y-2 mb-4">
                  {orderDraft.map((memberId, index) => {
                    const member = members.find(m => m.id === memberId)
                    const isDragging = draggedIndex === index
                    const isDragOver = dragOverIndex === index
                    return (
                      <div
                        key={memberId}
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, index)}
                        className={`flex items-center justify-between p-3 bg-surface-300 rounded-xl border-2 transition-all cursor-grab active:cursor-grabbing ${
                          isDragging
                            ? 'border-primary-500 opacity-50 scale-95'
                            : isDragOver
                            ? 'border-primary-500 bg-primary-500/10'
                            : 'border-surface-50/20 hover:border-primary-500/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-gray-500 cursor-grab active:cursor-grabbing">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>
                            </svg>
                          </span>
                          <span className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-400 font-bold text-sm">
                            {index + 1}
                          </span>
                          <span className="text-white font-medium">{member?.user?.username || member?.teamName || 'Unknown'}</span>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => moveInOrder(index, 'up')}
                            disabled={index === 0}
                            aria-label={`Sposta ${member?.user?.username || 'giocatore'} in su`}
                            className="w-8 h-8 flex items-center justify-center bg-surface-50/10 hover:bg-surface-50/20 rounded-lg text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => moveInOrder(index, 'down')}
                            disabled={index === orderDraft.length - 1}
                            aria-label={`Sposta ${member?.user?.username || 'giocatore'} in giù`}
                            className="w-8 h-8 flex items-center justify-center bg-surface-50/10 hover:bg-surface-50/20 rounded-lg text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                          >
                            ↓
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <Button onClick={handleSetOrder} disabled={isSubmitting} className="w-full">
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
                    onChange={(e) => setOfferTimer(parseInt(e.target.value) || 30)}
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
                    onChange={(e) => setAuctionTimer(parseInt(e.target.value) || 15)}
                    min={5}
                    max={60}
                    className="w-full px-4 py-2 bg-surface-300 border border-surface-50/30 rounded-xl text-white focus:border-primary-500 focus:outline-none"
                  />
                </div>
                <Button onClick={handleUpdateTimers} disabled={isSubmitting} variant="outline" className="w-full">
                  Salva Timer
                </Button>
                <hr className="border-surface-50/20" />
                <Button onClick={handleGenerateBoard} disabled={isSubmitting} className="w-full">
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
                <div className="bg-surface-200 rounded-2xl border border-primary-500/50 overflow-hidden sticky top-20">
                  <div className="p-3 border-b border-surface-50/20 bg-primary-500/10">
                    <h3 className="font-bold text-primary-400 text-sm flex items-center gap-2">
                      <span>💰</span>
                      Budget Residuo
                    </h3>
                  </div>
                  <div className="p-2 space-y-1">
                    {boardData.memberBudgets.map((mb, idx) => (
                      <div
                        key={mb.memberId}
                        className={`flex items-center justify-between px-2 py-1.5 rounded-lg ${
                          idx === 0 ? 'bg-accent-500/10 border border-accent-500/20' :
                          mb.residuo < 0 ? 'bg-danger-500/10' :
                          mb.residuo < 50 ? 'bg-warning-500/5' :
                          'bg-surface-300/30'
                        }`}
                      >
                        <span className="text-xs text-gray-400 truncate flex-1">{mb.teamName}</span>
                        <span className={`text-sm font-bold ml-2 ${
                          mb.residuo < 0 ? 'text-danger-400' :
                          mb.residuo < 50 ? 'text-warning-400' :
                          'text-accent-400'
                        }`}>
                          {mb.residuo}M
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Admin-only panels */}
              {isAdmin && (<>
              {/* Timer Settings Panel */}
                {/* Timer Settings Panel */}
                <div className="bg-surface-200 rounded-2xl border border-accent-500/50 overflow-hidden">
                  <div className="p-3 border-b border-surface-50/20 bg-accent-500/10">
                    <h3 className="font-bold text-accent-400 flex items-center gap-2">
                      <span>⏱️</span>
                      Timer
                    </h3>
                  </div>
                  <div className="p-3 space-y-3">
                    <div>
                      <label className="block text-xs text-gray-400 uppercase mb-1">Offerta (sec)</label>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setOfferTimer(prev => Math.max(5, prev - 5))}
                          className="w-10 h-10 shrink-0 rounded-lg bg-surface-300 text-white hover:bg-surface-100 text-xl font-bold flex items-center justify-center"
                        >−</button>
                        <input
                          type="number"
                          value={offerTimer}
                          onChange={(e) => setOfferTimer(Math.max(5, parseInt(e.target.value) || 5))}
                          className="w-full min-w-0 text-center bg-surface-300 border border-surface-50/30 rounded-lg py-2 text-white text-lg font-bold"
                        />
                        <button
                          onClick={() => setOfferTimer(prev => prev + 5)}
                          className="w-10 h-10 shrink-0 rounded-lg bg-surface-300 text-white hover:bg-surface-100 text-xl font-bold flex items-center justify-center"
                        >+</button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 uppercase mb-1">Asta (sec)</label>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setAuctionTimer(prev => Math.max(5, prev - 5))}
                          className="w-10 h-10 shrink-0 rounded-lg bg-surface-300 text-white hover:bg-surface-100 text-xl font-bold flex items-center justify-center"
                        >−</button>
                        <input
                          type="number"
                          value={auctionTimer}
                          onChange={(e) => setAuctionTimer(Math.max(5, parseInt(e.target.value) || 5))}
                          className="w-full min-w-0 text-center bg-surface-300 border border-surface-50/30 rounded-lg py-2 text-white text-lg font-bold"
                        />
                        <button
                          onClick={() => setAuctionTimer(prev => prev + 5)}
                          className="w-10 h-10 shrink-0 rounded-lg bg-surface-300 text-white hover:bg-surface-100 text-xl font-bold flex items-center justify-center"
                        >+</button>
                      </div>
                    </div>
                    <Button
                      onClick={handleUpdateTimers}
                      disabled={isSubmitting}
                      size="sm"
                      className="w-full"
                    >
                      💾 Salva
                    </Button>
                  </div>
                </div>

                {/* Bot Simulation Panel */}
                {(rubataState === 'OFFERING' || rubataState === 'AUCTION') && (
                  <div className="bg-surface-200 rounded-2xl border border-orange-500/50 overflow-hidden">
                    <div className="p-4 border-b border-surface-50/20 bg-orange-500/10">
                      <h3 className="font-bold text-orange-400 flex items-center gap-2">
                        <span>🤖</span>
                        Simula Bot
                      </h3>
                    </div>
                    <div className="p-4 space-y-3">
                      <div>
                        <label className="block text-xs text-gray-400 uppercase mb-1">Manager</label>
                        <select
                          value={simulateMemberId}
                          onChange={(e) => setSimulateMemberId(e.target.value)}
                          className="w-full px-3 py-2 bg-surface-300 border border-surface-50/30 rounded-lg text-white text-sm"
                        >
                          <option value="">-- Seleziona --</option>
                          {members
                            .filter(m => m.id !== myMemberId && m.id !== currentPlayer?.memberId)
                            .map(m => (
                              <option key={m.id} value={m.id}>
                                {m.user?.username || m.teamName || 'Unknown'}
                              </option>
                            ))}
                        </select>
                      </div>

                      {rubataState === 'OFFERING' && (
                        <Button
                          onClick={handleSimulateOffer}
                          disabled={isSubmitting || !simulateMemberId}
                          size="sm"
                          variant="outline"
                          className="w-full border-orange-500/50 text-orange-400"
                        >
                          🎯 Simula Offerta
                        </Button>
                      )}

                      {rubataState === 'AUCTION' && activeAuction && (
                        <>
                          <div>
                            <label className="block text-xs text-gray-400 uppercase mb-1">Importo</label>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setSimulateBidAmount(prev => Math.max(activeAuction.currentPrice + 1, prev - 1))}
                                className="w-8 h-8 rounded-lg bg-surface-300 text-white text-sm"
                              >−</button>
                              <input
                                type="number"
                                value={simulateBidAmount}
                                onChange={(e) => setSimulateBidAmount(Math.max(activeAuction.currentPrice + 1, parseInt(e.target.value) || 0))}
                                className="flex-1 text-center bg-surface-300 border border-surface-50/30 rounded-lg py-1 text-white text-sm"
                              />
                              <button
                                onClick={() => setSimulateBidAmount(prev => prev + 1)}
                                className="w-8 h-8 rounded-lg bg-surface-300 text-white text-sm"
                              >+</button>
                            </div>
                          </div>
                          <Button
                            onClick={handleSimulateBid}
                            disabled={isSubmitting || !simulateMemberId || simulateBidAmount <= activeAuction.currentPrice}
                            size="sm"
                            variant="outline"
                            className="w-full border-orange-500/50 text-orange-400"
                          >
                            💰 Simula Rilancio
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Complete Rubata Panel */}
                <div className="bg-surface-200 rounded-2xl border border-danger-500/50 overflow-hidden">
                  <div className="p-3 border-b border-surface-50/20 bg-danger-500/10">
                    <h3 className="font-bold text-danger-400 flex items-center gap-2">
                      <span>⚡</span>
                      Test Rapido
                    </h3>
                  </div>
                  <div className="p-3">
                    <p className="text-xs text-gray-400 mb-3">Completa la rubata con transazioni casuali (30% rubate)</p>
                    <Button
                      onClick={handleCompleteRubata}
                      disabled={isSubmitting || rubataState === 'COMPLETED'}
                      size="sm"
                      className="w-full bg-danger-500 hover:bg-danger-600"
                    >
                      🚀 Completa Rubata
                    </Button>
                  </div>
                </div>
              </>)}
            </div>

            {/* Main Content */}
            <div className="lg:col-span-4">
            {/* Stepper visivo flusso rubata */}
            <RubataStepper currentState={rubataState} className="mb-4" />

            {/* Timer e stato corrente - sticky on mobile for visibility */}
            <div className="mb-6 bg-surface-200 rounded-2xl border-2 border-primary-500/50 overflow-hidden sticky top-16 z-20 lg:relative lg:top-0">
              <div className="p-5 bg-primary-500/10">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  {/* Current Player Info */}
                  <div className="flex items-center gap-4">
                    {currentPlayer ? (
                      <>
                        <div className={`w-12 h-12 rounded-full ${POSITION_COLORS[currentPlayer.playerPosition]} border flex items-center justify-center font-bold text-lg`}>
                          {currentPlayer.playerPosition}
                        </div>
                        <div>
                          <p className="text-xl font-bold text-white">{currentPlayer.playerName}</p>
                          <p className="text-gray-400">{currentPlayer.playerTeam} • {currentPlayer.ownerUsername}</p>
                        </div>
                        <div className="ml-4 text-right">
                          <p className="text-2xl font-bold text-primary-400">{currentPlayer.rubataPrice}M</p>
                          <p className="text-xs text-gray-500">prezzo rubata</p>
                        </div>
                        {/* My strategy indicator for current player */}
                        {currentPlayerPreference && currentPlayer.memberId !== myMemberId && (
                          <div className="ml-4 px-3 py-2 bg-indigo-500/20 border border-indigo-500/40 rounded-lg">
                            <p className="text-[10px] text-indigo-300 uppercase mb-1">La tua strategia</p>
                            <div className="flex items-center gap-2 text-sm">
                              {currentPlayerPreference.isWatchlist && <span title="Watchlist">⭐</span>}
                              {currentPlayerPreference.isAutoPass && <span title="Auto-pass">🚫</span>}
                              {currentPlayerPreference.priority && (
                                <span className="text-purple-400">{'★'.repeat(currentPlayerPreference.priority)}</span>
                              )}
                              {currentPlayerPreference.maxBid && (
                                <span className="text-blue-400">Max: {currentPlayerPreference.maxBid}M</span>
                              )}
                              {currentPlayerPreference.notes && (
                                <span className="text-gray-400 truncate max-w-[100px]" title={currentPlayerPreference.notes}>📝</span>
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-gray-400">Nessun giocatore in esame</p>
                    )}
                  </div>

                  {/* Timer */}
                  <div className="flex items-center gap-4">
                    {/* Pusher Connection Indicator */}
                    <div className="flex items-center gap-1" title={isPusherConnected ? 'Real-time connesso' : 'Real-time disconnesso'}>
                      <div className={`w-2 h-2 rounded-full ${isPusherConnected ? 'bg-secondary-400' : 'bg-danger-400 animate-pulse'}`} />
                      <span className={`text-[10px] uppercase tracking-wider ${isPusherConnected ? 'text-secondary-400' : 'text-danger-400'}`}>
                        {isPusherConnected ? 'LIVE' : 'OFFLINE'}
                      </span>
                    </div>
                    {timerDisplay !== null && (
                      <div className={`text-4xl font-mono font-bold ${timerDisplay <= 5 ? 'text-danger-400 animate-pulse' : timerDisplay <= 10 ? 'text-warning-400' : 'text-white'}`}>
                        {timerDisplay}s
                      </div>
                    )}
                    <div className="text-center">
                      <span className={`px-4 py-2 rounded-full font-bold text-sm ${
                        rubataState === 'READY_CHECK' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40' :
                        rubataState === 'PREVIEW' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/40' :
                        rubataState === 'OFFERING' ? 'bg-warning-500/20 text-warning-400 border border-warning-500/40' :
                        rubataState === 'AUCTION_READY_CHECK' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40 animate-pulse' :
                        rubataState === 'AUCTION' ? 'bg-danger-500/20 text-danger-400 border border-danger-500/40 animate-pulse' :
                        rubataState === 'PENDING_ACK' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40' :
                        rubataState === 'PAUSED' ? 'bg-gray-500/20 text-gray-400 border border-gray-500/40' :
                        rubataState === 'WAITING' ? 'bg-primary-500/20 text-primary-400 border border-primary-500/40' :
                        rubataState === 'COMPLETED' ? 'bg-secondary-500/20 text-secondary-400 border border-secondary-500/40' :
                        'bg-surface-300 text-gray-400'
                      }`}>
                        {rubataState === 'READY_CHECK' ? '🔔 PRONTI?' :
                         rubataState === 'PREVIEW' ? '👁️ PREVIEW' :
                         rubataState === 'OFFERING' ? '⏳ OFFERTA' :
                         rubataState === 'AUCTION_READY_CHECK' ? '🎯 RUBATA!' :
                         rubataState === 'AUCTION' ? '🔥 ASTA' :
                         rubataState === 'PENDING_ACK' ? '✋ CONFERMA' :
                         rubataState === 'PAUSED' ? '⏸️ PAUSA' :
                         rubataState === 'WAITING' ? '⏹️ IN ATTESA' :
                         rubataState === 'COMPLETED' ? '✅ COMPLETATA' :
                         'SCONOSCIUTO'}
                      </span>
                      {/* Progress counters */}
                      {progressStats && (
                        <div className="flex flex-wrap gap-2 mt-2 text-xs">
                          {progressStats.managerProgress && (
                            <span className="px-2 py-0.5 bg-primary-500/20 rounded text-primary-400">
                              👤 {progressStats.managerProgress.username}: {progressStats.managerProgress.processed}/{progressStats.managerProgress.total}
                            </span>
                          )}
                          <span className="px-2 py-0.5 bg-accent-500/20 rounded text-accent-400">
                            📊 Totale: {progressStats.currentIndex + 1}/{progressStats.totalPlayers}
                          </span>
                          <span className="px-2 py-0.5 bg-warning-500/20 rounded text-warning-400">
                            ⏳ Rimangono: {progressStats.remaining}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Admin Controls */}
                {isAdmin && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(rubataState === 'WAITING' || rubataState === 'PREVIEW') && (
                      <Button onClick={handleStartRubata} disabled={isSubmitting}>
                        ▶️ Avvia Rubata
                      </Button>
                    )}
                    {rubataState === 'PAUSED' && (
                      <Button onClick={handleResume} disabled={isSubmitting}>
                        🔔 Richiedi Pronti per Riprendere
                      </Button>
                    )}
                    {(rubataState === 'OFFERING' || rubataState === 'AUCTION') && (
                      <>
                        <Button onClick={handlePause} disabled={isSubmitting} variant="outline">
                          ⏸️ Pausa
                        </Button>
                        <Button onClick={handleGoBack} disabled={isSubmitting || boardData?.currentIndex === 0} variant="outline">
                          ⏮️ Indietro
                        </Button>
                        {rubataState === 'OFFERING' && (
                          <Button onClick={handleAdvance} disabled={isSubmitting} variant="outline">
                            ⏭️ Avanti
                          </Button>
                        )}
                        {rubataState === 'AUCTION' && (
                          <Button onClick={handleCloseAuction} disabled={isSubmitting}>
                            ✅ Chiudi Asta
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Player Actions - tutti i manager (incluso admin) possono fare offerte */}
                {rubataState === 'OFFERING' && canMakeOffer && (
                  <div className="mt-4">
                    <Button onClick={handleMakeOffer} disabled={isSubmitting} className="w-full md:w-auto">
                      🎯 VOGLIO RUBARE! ({currentPlayer?.rubataPrice}M)
                    </Button>
                  </div>
                )}

                {/* Strategy Info - Inline section below "Voglio Rubare" */}
                {currentPlayer && currentPlayerPreference &&
                 currentPlayer.memberId !== myMemberId &&
                 (currentPlayerPreference.maxBid || currentPlayerPreference.priority || currentPlayerPreference.notes) && (
                  <div className="mt-4 bg-gradient-to-r from-indigo-900/50 to-purple-900/50 rounded-xl border border-indigo-500/40 overflow-hidden">
                    <div className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">🎯</span>
                        <span className="font-bold text-indigo-300 text-sm">LA TUA STRATEGIA</span>
                      </div>
                      <div className="flex flex-wrap gap-3 items-center">
                        {currentPlayerPreference.maxBid && (
                          <div className="bg-black/20 rounded-lg px-3 py-1.5">
                            <span className="text-[10px] text-indigo-300 uppercase mr-1">Max:</span>
                            <span className="font-bold text-blue-400">{currentPlayerPreference.maxBid}M</span>
                          </div>
                        )}
                        {currentPlayerPreference.priority && (
                          <div className="bg-black/20 rounded-lg px-3 py-1.5">
                            <span className="text-[10px] text-indigo-300 uppercase mr-1">Priorita:</span>
                            <span className="text-purple-400">{'★'.repeat(currentPlayerPreference.priority)}</span>
                          </div>
                        )}
                        {currentPlayerPreference.notes && (
                          <div className="bg-black/20 rounded-lg px-3 py-1.5 flex-1 min-w-0">
                            <span className="text-[10px] text-indigo-300 uppercase mr-1">Note:</span>
                            <span className="text-gray-300 text-sm">{currentPlayerPreference.notes}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

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
                      <Button onClick={handleSetReady} disabled={isSubmitting} size="sm">
                        ✅ Sono Pronto
                      </Button>
                    ) : (
                      <span className="px-3 py-1 bg-secondary-500/20 border border-secondary-500/40 rounded-lg text-secondary-400 text-sm">
                        ✓ Pronto
                      </span>
                    )}
                    {isAdmin && (
                      <Button onClick={handleForceAllReady} disabled={isSubmitting} variant="outline" size="sm" className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10">
                        🤖 Forza Tutti Pronti
                      </Button>
                    )}
                  </div>
                </div>
                {/* Pending members list */}
                {readyStatus.pendingMembers.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap text-sm">
                    <span className="text-gray-500">In attesa:</span>
                    {readyStatus.pendingMembers.map((member, idx) => (
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
                      {boardData?.pausedRemainingSeconds !== null && boardData.pausedRemainingSeconds !== undefined && (
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
                        <Button onClick={handleSetReady} disabled={isSubmitting} size="sm">
                          ✅ Sono Pronto
                        </Button>
                      ) : (
                        <span className="px-3 py-1 bg-secondary-500/20 border border-secondary-500/40 rounded-lg text-secondary-400 text-sm">
                          ✓ Pronto
                        </span>
                      )}
                      {isAdmin && (
                        <Button onClick={handleForceAllReady} disabled={isSubmitting} variant="outline" size="sm" className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10">
                          🤖 Forza Tutti Pronti
                        </Button>
                      )}
                    </div>
                  </div>
                  {/* Pending members list */}
                  {readyStatus.pendingMembers.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap text-sm">
                      <span className="text-gray-500">In attesa:</span>
                      {readyStatus.pendingMembers.map((member, idx) => (
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
              <div className="mb-6 bg-surface-200 rounded-2xl border-4 border-danger-500 overflow-hidden auction-highlight shadow-2xl">
                <div className="p-5 border-b border-surface-50/20 bg-gradient-to-r from-danger-600/30 via-danger-500/20 to-danger-600/30">
                  <h3 className="text-xl font-black text-danger-400 flex items-center justify-center gap-3 uppercase tracking-wide">
                    <span className="text-3xl animate-pulse">🔥</span>
                    <span className="text-white">ASTA IN CORSO</span>
                    <span className="text-3xl animate-pulse">🔥</span>
                  </h3>
                  <p className="text-center text-2xl font-bold text-white mt-2">
                    {activeAuction.player.name}
                  </p>
                </div>
                <div className="p-5">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <div className="bg-surface-300 p-4 rounded-xl border border-surface-50/20 mb-4">
                        <div className="grid grid-cols-2 gap-4 text-center">
                          <div>
                            <p className="text-sm text-gray-500">Base</p>
                            <p className="font-bold text-white text-xl">{activeAuction.basePrice}M</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Offerta attuale</p>
                            <p className="font-bold text-primary-400 text-2xl">{activeAuction.currentPrice}M</p>
                          </div>
                        </div>
                      </div>

                      {/* Bid Form - only if not the seller */}
                      {activeAuction.sellerId !== myMemberId && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setBidAmount(prev => Math.max(activeAuction.currentPrice + 1, prev - 1))}
                              disabled={bidAmount <= activeAuction.currentPrice + 1}
                              className="w-12 h-12 rounded-xl bg-surface-300 border border-surface-50/30 text-white text-2xl font-bold hover:bg-surface-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                              −
                            </button>
                            <div className="flex-1 text-center">
                              <input
                                type="number"
                                value={bidAmount}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value) || 0
                                  setBidAmount(Math.max(activeAuction.currentPrice + 1, val))
                                }}
                                className="w-full text-center text-3xl font-bold bg-transparent text-white focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                min={activeAuction.currentPrice + 1}
                              />
                              <p className="text-xs text-gray-500">Min: {activeAuction.currentPrice + 1}M</p>
                            </div>
                            <button
                              onClick={() => setBidAmount(prev => prev + 1)}
                              className="w-12 h-12 rounded-xl bg-surface-300 border border-surface-50/30 text-white text-2xl font-bold hover:bg-surface-200 transition-all"
                            >
                              +
                            </button>
                          </div>
                          <Button
                            onClick={handleBid}
                            disabled={isSubmitting || bidAmount <= activeAuction.currentPrice}
                            className="w-full py-3 text-lg"
                          >
                            RILANCIA {bidAmount}M
                          </Button>
                        </div>
                      )}
                    </div>

                    <div>
                      <h4 className="font-medium text-white mb-3">Ultime offerte</h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {activeAuction.bids.length === 0 ? (
                          <p className="text-gray-500 text-sm">Nessuna offerta ancora</p>
                        ) : (
                          activeAuction.bids.map((bid, i) => (
                            <div
                              key={i}
                              className={`p-3 rounded-xl ${bid.isWinning ? 'bg-secondary-500/20 border border-secondary-500/40' : 'bg-surface-300 border border-surface-50/20'}`}
                            >
                              <span className="font-medium text-white">{bid.bidder}</span>
                              <span className="ml-2 font-mono text-primary-400">{bid.amount}M</span>
                              {bid.isWinning && (
                                <span className="ml-2 text-secondary-400 text-sm font-medium">✓ Vincente</span>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
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
                              <span className={isPassed ? 'text-gray-600' : 'text-gray-500'}>{globalIndex + 1}</span>
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
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${POSITION_COLORS[player.playerPosition]}`}>
                                  {player.playerPosition}
                                </div>
                              )}
                              <div className="w-5 h-5 bg-white rounded p-0.5 flex-shrink-0">
                                <TeamLogo team={player.playerTeam} />
                              </div>
                              <button
                                type="button"
                                onClick={() => setSelectedPlayerForStats({
                                  name: player.playerName,
                                  team: player.playerTeam,
                                  position: player.playerPosition,
                                  quotation: player.playerQuotation,
                                  age: player.playerAge,
                                  apiFootballId: player.playerApiFootballId,
                                  computedStats: player.playerComputedStats,
                                })}
                                className={`font-medium truncate hover:underline cursor-pointer text-left ${isCurrent ? 'text-white font-bold' : isPassed ? 'text-gray-500' : 'text-gray-300 hover:text-white'}`}
                                title="Clicca per vedere statistiche"
                              >
                                {player.playerName}
                              </button>
                            </div>
                          </td>
                          <td className="py-2 text-center">
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-[10px] font-bold ${isPassed ? 'opacity-40' : ''} ${POSITION_COLORS[player.playerPosition]}`}>
                              {player.playerPosition}
                            </span>
                          </td>
                          <td className="py-2 text-center">
                            <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                              isPassed ? 'text-gray-600 bg-transparent' :
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
                            <span className={`text-xs ${isCurrent ? 'text-accent-400' : isPassed ? 'text-gray-600' : 'text-accent-400'}`}>
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
                            <span className={`text-xs ${isPassed ? 'text-gray-600' : 'text-gray-400'}`}>
                              {player.contractClause}
                            </span>
                          </td>
                          <td className="py-2 text-center">
                            <span className={`font-bold ${isCurrent ? 'text-primary-400 text-sm' : isPassed ? 'text-gray-600 text-xs' : 'text-warning-400 text-sm'}`}>
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
                              <span className="text-gray-600 text-xs">—</span>
                            )}
                          </td>
                          <td className="p-2 text-center">
                            {(() => {
                              const pref = preferencesMap.get(player.playerId)
                              const isMyPlayer = player.memberId === myMemberId
                              if (isMyPlayer) return <span className="text-gray-600 text-xs">Mio</span>
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
                                      onClick={() => openPrefsModal({ ...player, preference: pref || null })}
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
                          <span className={`text-xs font-mono w-6 text-center ${isPassed ? 'text-gray-600' : 'text-gray-500'}`}>
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
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${POSITION_COLORS[player.playerPosition]}`}>
                            {player.playerPosition}
                          </div>
                        )}
                        <div className="w-6 h-6 bg-white rounded p-0.5 flex-shrink-0">
                          <TeamLogo team={player.playerTeam} />
                        </div>
                        <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[8px] font-bold flex-shrink-0 ${POSITION_COLORS[player.playerPosition]}`}>
                          {player.playerPosition}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedPlayerForStats({
                            name: player.playerName,
                            team: player.playerTeam,
                            position: player.playerPosition,
                            quotation: player.playerQuotation,
                            age: player.playerAge,
                            apiFootballId: player.playerApiFootballId,
                            computedStats: player.playerComputedStats,
                          })}
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
                        {player.ownerTeamName && <span className="text-gray-600"> ({player.ownerTeamName})</span>}
                        {player.playerAge && <span className="text-gray-600"> · {player.playerAge}a</span>}
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
                          <div className={`font-medium text-sm ${isPassed ? 'text-gray-600' : 'text-accent-400'}`}>
                            {player.contractSalary}M
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-[10px] text-gray-500 uppercase">Durata</div>
                          <div className={`font-medium text-sm ${
                            isPassed ? 'text-gray-600' :
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
                          <div className={`font-medium text-sm ${isPassed ? 'text-gray-600' : 'text-gray-400'}`}>
                            {player.contractClause}M
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-[10px] text-gray-500 uppercase">Rubata</div>
                          <div className={`font-bold text-sm ${isPassed ? 'text-gray-600' : isCurrent ? 'text-primary-400' : 'text-warning-400'}`}>
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
                                  onClick={() => openPrefsModal({ ...player, preference: pref || null })}
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

      </main>

      {/* Mobile Budget Footer - Fixed Bottom */}
      {boardData?.memberBudgets && boardData.memberBudgets.length > 0 && isRubataPhase && isOrderSet && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-gradient-to-r from-surface-200 via-surface-200 to-surface-200 border-t-2 border-primary-500/50 z-40 shadow-lg shadow-black/30">
          <div className="px-3 py-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] text-gray-500 uppercase font-medium">Budget Residuo</span>
              <button
                type="button"
                onClick={() => setMobileBudgetExpanded(prev => !prev)}
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
                    <div className="text-[7px] text-gray-600">
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
        onClose={() => setSelectedPlayerForStats(null)}
        player={selectedPlayerForStats}
      />
    </div>
  )
}
