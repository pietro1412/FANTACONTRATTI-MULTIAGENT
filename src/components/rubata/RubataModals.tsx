import { Modal, ModalBody } from '@/components/ui/Modal'
import { Button } from '../ui/Button'
import { TeamLogo } from './TeamLogo'
import { POSITION_COLORS } from '../../types/rubata.types'
import { getPlayerPhotoUrl } from '../../utils/player-images'
import type {
  PendingAck,
  ReadyStatus,
  AppealStatus,
  BoardData,
} from '../../types/rubata.types'

// ============================================================
// Transaction Confirmation Modal (PENDING_ACK)
// ============================================================
interface PendingAckModalProps {
  pendingAck: PendingAck
  isAdmin: boolean
  isSubmitting: boolean
  appealStatus: AppealStatus | null
  isAppealMode: boolean
  setIsAppealMode: (v: boolean) => void
  appealContent: string
  setAppealContent: (v: string) => void
  prophecyContent: string
  setProphecyContent: (v: string) => void
  onAcknowledgeWithAppeal: () => void
  onSimulateAppeal: () => void
  onForceAllAcknowledge: () => void
  onNavigate: (page: string, params?: Record<string, string>) => void
  leagueId: string
}

export function PendingAckModal({
  pendingAck,
  isAdmin,
  isSubmitting,
  appealStatus,
  isAppealMode,
  setIsAppealMode,
  appealContent,
  setAppealContent,
  prophecyContent,
  setProphecyContent,
  onAcknowledgeWithAppeal,
  onSimulateAppeal,
  onForceAllAcknowledge,
  onNavigate,
  leagueId,
}: PendingAckModalProps) {
  // Don't show if appeal is in certain states
  if (['APPEAL_REVIEW', 'AWAITING_APPEAL_ACK', 'AWAITING_RESUME'].includes(appealStatus?.auctionStatus || '')) {
    return null
  }
  if (pendingAck.allAcknowledged) {
    return null
  }

  return (
    <Modal isOpen={true} onClose={() => {}} closeOnBackdrop={false} closeOnEscape={false} showCloseButton={false} size="lg" className="bg-gradient-to-br from-purple-900 to-purple-950 border-2 border-purple-400 rounded-3xl animate-bounce-in max-h-[90vh] overflow-y-auto">
      <ModalBody>
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
            {pendingAck.player.apiFootballId && (
              <img
                src={getPlayerPhotoUrl(pendingAck.player.apiFootballId)}
                alt={pendingAck.player.name}
                className="w-14 h-14 rounded-full object-cover bg-surface-300 border-2 border-white/20"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            )}
            <div className="w-10 h-10 bg-white rounded p-1">
              <TeamLogo team={pendingAck.player.team} />
            </div>
            <div className={`w-10 h-10 flex items-center justify-center rounded-full ${POSITION_COLORS[pendingAck.player.position] || 'bg-gray-500/20 text-gray-400'} border-2`}>
              <span className="font-bold">{pendingAck.player.position}</span>
            </div>
          </div>
          <p className="text-center text-2xl font-bold text-white">{pendingAck.player.name}</p>
          <p className="text-center text-gray-400 text-sm">{pendingAck.player.team}</p>
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
              onChange={(e) => { setAppealContent(e.target.value); }}
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
              onChange={(e) => { setProphecyContent(e.target.value); }}
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
            <div className="w-full py-3 text-center rounded-xl bg-secondary-500/20 border border-secondary-500/30">
              <p className="text-secondary-400 font-bold">✅ Hai confermato</p>
              <p className="text-xs text-gray-400 mt-1">In attesa degli altri manager ({pendingAck.totalAcknowledged}/{pendingAck.totalMembers})</p>
            </div>
          ) : !isAppealMode ? (
            <>
              <Button onClick={onAcknowledgeWithAppeal} disabled={isSubmitting} className="w-full py-3 text-lg">
                {prophecyContent.trim() ? '🔮 CONFERMA CON PROFEZIA' : '✅ CONFERMA TRANSAZIONE'}
              </Button>
              <button
                onClick={() => { setIsAppealMode(true); }}
                className="w-full py-2 text-sm text-danger-400 hover:text-danger-300 underline"
              >
                ⚠️ Voglio fare ricorso
              </button>
            </>
          ) : (
            <>
              <Button
                onClick={onAcknowledgeWithAppeal}
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
                onClick={() => { onNavigate('admin', { leagueId, tab: 'appeals' }); }}
                className="w-full py-2 text-xs text-purple-400 hover:text-purple-300"
              >
                📋 Vai al pannello ricorsi
              </button>
              <Button onClick={onSimulateAppeal} disabled={isSubmitting} variant="outline" className="w-full text-xs border-danger-500/50 text-danger-400">
                🤖 [TEST] Simula ricorso di un DG
              </Button>
              <Button onClick={onForceAllAcknowledge} disabled={isSubmitting} variant="outline" className="w-full text-xs">
                🤖 [TEST] Forza Tutte le Conferme
              </Button>
            </div>
          )}
        </div>
      </ModalBody>
    </Modal>
  )
}

// ============================================================
// Appeal Review Modal (APPEAL_REVIEW)
// ============================================================
interface AppealReviewModalProps {
  appealStatus: AppealStatus
  isAdmin: boolean
  onNavigate: (page: string, params?: Record<string, string>) => void
  leagueId: string
}

export function AppealReviewModal({ appealStatus, isAdmin, onNavigate, leagueId }: AppealReviewModalProps) {
  return (
    <Modal isOpen={true} onClose={() => {}} closeOnBackdrop={false} closeOnEscape={false} showCloseButton={false} size="lg" className="bg-gradient-to-br from-danger-900 to-danger-950 border-2 border-danger-500 rounded-3xl max-h-[90vh] overflow-y-auto">
      <ModalBody>
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
            onClick={() => { onNavigate('admin', { leagueId, tab: 'appeals' }); }}
            className="w-full bg-danger-500 hover:bg-danger-600 text-white font-bold py-3"
          >
            Gestisci Ricorso
          </Button>
        )}
      </ModalBody>
    </Modal>
  )
}

// ============================================================
// Appeal Ack Modal (AWAITING_APPEAL_ACK)
// ============================================================
interface AppealAckModalProps {
  appealStatus: AppealStatus
  isAdmin: boolean
  isSubmitting: boolean
  onAcknowledgeAppealDecision: () => void
  onForceAllAppealAcks: () => void
}

export function AppealAckModal({
  appealStatus,
  isAdmin,
  isSubmitting,
  onAcknowledgeAppealDecision,
  onForceAllAppealAcks,
}: AppealAckModalProps) {
  return (
    <Modal isOpen={true} onClose={() => {}} closeOnBackdrop={false} closeOnEscape={false} showCloseButton={false} size="lg" className="bg-gradient-to-br from-surface-200 to-surface-300 border-2 border-surface-50/30 rounded-3xl max-h-[90vh] overflow-y-auto">
      <ModalBody>
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
            onClick={onAcknowledgeAppealDecision}
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
            onClick={onForceAllAppealAcks}
            disabled={isSubmitting}
            className="w-full mt-3 border-accent-500/50 text-accent-400"
          >
            🤖 [TEST] Forza Tutte Conferme Ricorso
          </Button>
        )}
      </ModalBody>
    </Modal>
  )
}

// ============================================================
// Awaiting Resume Modal (AWAITING_RESUME)
// ============================================================
interface AwaitingResumeModalProps {
  appealStatus: AppealStatus
  isAdmin: boolean
  isSubmitting: boolean
  onMarkReadyToResume: () => void
  onForceAllReadyResume: () => void
}

export function AwaitingResumeModal({
  appealStatus,
  isAdmin,
  isSubmitting,
  onMarkReadyToResume,
  onForceAllReadyResume,
}: AwaitingResumeModalProps) {
  return (
    <Modal isOpen={true} onClose={() => {}} closeOnBackdrop={false} closeOnEscape={false} showCloseButton={false} size="lg" className="bg-gradient-to-br from-accent-900 to-orange-950 border-4 border-accent-500 rounded-3xl animate-pulse-slow max-h-[90vh] overflow-y-auto">
      <ModalBody>
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
            onClick={onMarkReadyToResume}
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
            onClick={onForceAllReadyResume}
            disabled={isSubmitting}
            className="w-full mt-3 border-accent-500/50 text-accent-400"
          >
            🤖 [TEST] Forza Tutti Pronti
          </Button>
        )}
      </ModalBody>
    </Modal>
  )
}

// ============================================================
// Auction Ready Check Modal (AUCTION_READY_CHECK)
// ============================================================
interface AuctionReadyCheckModalProps {
  boardData: BoardData
  readyStatus: ReadyStatus
  isAdmin: boolean
  isSubmitting: boolean
  onSetReady: () => void
  onForceAllReady: () => void
}

export function AuctionReadyCheckModal({
  boardData,
  readyStatus,
  isAdmin,
  isSubmitting,
  onSetReady,
  onForceAllReady,
}: AuctionReadyCheckModalProps) {
  if (!boardData.auctionReadyInfo) return null

  return (
    <Modal isOpen={true} onClose={() => {}} closeOnBackdrop={false} closeOnEscape={false} showCloseButton={false} size="lg" className="bg-gradient-to-br from-orange-900 to-orange-950 border-4 border-orange-400 rounded-3xl animate-bounce-in">
      <ModalBody>
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
            {boardData.currentPlayer?.playerApiFootballId && (
              <img
                src={getPlayerPhotoUrl(boardData.currentPlayer.playerApiFootballId)}
                alt={boardData.auctionReadyInfo.playerName}
                className="w-14 h-14 rounded-full object-cover bg-surface-300 border-2 border-white/20"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            )}
            <div className="w-10 h-10 bg-white rounded p-1">
              <TeamLogo team={boardData.auctionReadyInfo.playerTeam} />
            </div>
            <div className={`w-10 h-10 flex items-center justify-center rounded-full ${POSITION_COLORS[boardData.auctionReadyInfo.playerPosition] || 'bg-gray-500/20 text-gray-400'} border-2`}>
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
            <Button onClick={onSetReady} disabled={isSubmitting} className="w-full py-3 text-lg bg-orange-500 hover:bg-orange-600">
              ✅ SONO PRONTO PER L'ASTA!
            </Button>
          ) : (
            <div className="w-full py-3 bg-secondary-500/20 border border-secondary-500/40 rounded-xl text-secondary-400 font-bold text-center">
              ✓ Sei pronto - attendi gli altri manager
            </div>
          )}
          {isAdmin && (
            <Button onClick={onForceAllReady} disabled={isSubmitting} variant="outline" className="w-full border-orange-500/50 text-orange-400">
              [TEST] Forza Tutti Pronti
            </Button>
          )}
        </div>
      </ModalBody>
    </Modal>
  )
}
