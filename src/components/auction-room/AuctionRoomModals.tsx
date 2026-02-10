import { useEffect, useRef } from 'react'
import { Button } from '../ui/Button'
import { POSITION_NAMES } from '../ui/PositionBadge'
import { getTeamLogo } from '../../utils/teamLogos'
import { POSITION_COLORS } from '../../types/auctionroom.types'
import type { ManagerData, PendingAcknowledgment, AppealStatus } from '../../types/auctionroom.types'

// ─── Props Interfaces ────────────────────────────────────────────────

interface ManagerDetailModalProps {
  selectedManager: ManagerData | null
  onClose: () => void
}

interface AcknowledgmentModalProps {
  pendingAck: PendingAcknowledgment | null
  appealStatus: AppealStatus | null
  isAppealMode: boolean
  setIsAppealMode: (v: boolean) => void
  appealContent: string
  setAppealContent: (v: string) => void
  prophecyContent: string
  setProphecyContent: (v: string) => void
  ackSubmitting: boolean
  isAdmin: boolean
  error: string
  onAcknowledge: (hasProphecy: boolean, isAppeal?: boolean) => void
  onSimulateAppeal: () => void
  onNavigate: (page: string, params?: Record<string, string>) => void
  leagueId: string
}

interface WaitingModalProps {
  pendingAck: PendingAcknowledgment | null
  appealStatus: AppealStatus | null
  isAdmin: boolean
  onForceAcknowledgeAll: () => void
}

interface AppealReviewModalProps {
  appealStatus: AppealStatus | null
  pendingAck: PendingAcknowledgment | null
  isAdmin: boolean
  onNavigate: (page: string, params?: Record<string, string>) => void
  leagueId: string
}

interface AppealAckModalProps {
  appealStatus: AppealStatus | null
  pendingAck: PendingAcknowledgment | null
  ackSubmitting: boolean
  isAdmin: boolean
  onAcknowledgeAppealDecision: () => void
  onForceAllAppealAcks: () => void
}

interface AwaitingResumeModalProps {
  appealStatus: AppealStatus | null
  pendingAck: PendingAcknowledgment | null
  markingReady: boolean
  isAdmin: boolean
  onReadyToResume: () => void
  onForceAllReadyResume: () => void
}

// ─── 1. Manager Detail Modal ─────────────────────────────────────────

export function ManagerDetailModal({ selectedManager, onClose }: ManagerDetailModalProps) {
  if (!selectedManager) return null

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-surface-200 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-surface-50/20" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-xl font-bold text-white">{selectedManager.username}</h2>
              {selectedManager.teamName && <p className="text-gray-400">{selectedManager.teamName}</p>}
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">×</button>
          </div>
          <div className="flex gap-4 mb-6">
            <div className="bg-surface-300 rounded-lg px-4 py-3 flex-1 text-center">
              <p className="text-xs text-gray-400 uppercase">Budget</p>
              <p className="text-2xl font-bold text-accent-400">{selectedManager.currentBudget}</p>
            </div>
            <div className="bg-surface-300 rounded-lg px-4 py-3 flex-1 text-center">
              <p className="text-xs text-gray-400 uppercase">Rosa</p>
              <p className="text-2xl font-bold text-white">{selectedManager.slotsFilled}/{selectedManager.totalSlots}</p>
            </div>
          </div>
          {(['P', 'D', 'C', 'A'] as const).map(pos => {
            const slot = selectedManager.slotsByPosition[pos]
            const posPlayers = selectedManager.roster.filter(r => r.position === pos)
            return (
              <div key={pos} className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-6 h-6 rounded-full bg-gradient-to-br ${POSITION_COLORS[pos]} flex items-center justify-center text-xs font-bold text-white`}>{pos}</span>
                    <span className="text-gray-300">{POSITION_NAMES[pos]}</span>
                  </div>
                  <span className={`text-sm font-bold ${slot.filled >= slot.total ? 'text-secondary-400' : 'text-gray-500'}`}>{slot.filled}/{slot.total}</span>
                </div>
                {posPlayers.length > 0 ? (
                  <table className="w-full text-xs ml-2">
                    <thead>
                      <tr className="text-gray-500 text-[10px] uppercase">
                        <th className="text-left font-medium pb-1">Giocatore</th>
                        <th className="text-center font-medium pb-1 w-14">Prezzo</th>
                        <th className="text-center font-medium pb-1 w-12">Ing.</th>
                        <th className="text-center font-medium pb-1 w-10">Dur.</th>
                        <th className="text-center font-medium pb-1 w-14">Claus.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {posPlayers.map(p => (
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
                ) : (
                  <p className="text-gray-600 italic text-sm ml-8">Nessuno</p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── 2. Acknowledgment Modal ─────────────────────────────────────────

export function AcknowledgmentModal({
  pendingAck,
  appealStatus,
  isAppealMode,
  setIsAppealMode,
  appealContent,
  setAppealContent,
  prophecyContent,
  setProphecyContent,
  ackSubmitting,
  isAdmin,
  error,
  onAcknowledge,
  onSimulateAppeal,
  onNavigate,
  leagueId,
}: AcknowledgmentModalProps) {
  if (
    !(
      pendingAck &&
      !pendingAck.userAcknowledged &&
      appealStatus?.auctionStatus !== 'APPEAL_REVIEW' &&
      appealStatus?.auctionStatus !== 'AWAITING_APPEAL_ACK' &&
      appealStatus?.auctionStatus !== 'AWAITING_RESUME'
    )
  ) {
    return null
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-200 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-surface-50/20">
        <div className="p-6">
          <div className="text-center mb-6">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${pendingAck.winner ? 'bg-secondary-500/20' : 'bg-surface-300'}`}>
              <span className="text-3xl">{pendingAck.winner ? '\u2705' : '\u274C'}</span>
            </div>
            <h2 className="text-2xl font-bold text-white">{pendingAck.winner ? 'Transazione Completata' : 'Asta Conclusa'}</h2>
          </div>
          <div className="bg-surface-300 rounded-lg p-4 mb-4 flex items-center gap-3">
            <span className={`w-10 h-10 rounded-full bg-gradient-to-br ${POSITION_COLORS[pendingAck.player.position]} flex items-center justify-center text-white font-bold flex-shrink-0`}>{pendingAck.player.position}</span>
            <div className="w-8 h-8 bg-white/90 rounded flex items-center justify-center p-0.5 flex-shrink-0">
              <img
                src={getTeamLogo(pendingAck.player.team)}
                alt={pendingAck.player.team}
                className="w-7 h-7 object-contain"
              />
            </div>
            <div>
              <p className="font-bold text-white">{pendingAck.player.name}</p>
              <p className="text-sm text-gray-400">{pendingAck.player.team}</p>
            </div>
          </div>
          {pendingAck.winner ? (
            <div className="bg-primary-500/10 rounded-lg p-4 mb-4 border border-primary-500/30">
              <div className="text-center mb-3">
                <p className="text-sm text-primary-400">Acquistato da</p>
                <p className="text-xl font-bold text-white">{pendingAck.winner.username}</p>
                <p className="text-3xl font-bold text-accent-400 mt-1">{pendingAck.finalPrice}M</p>
              </div>
              {pendingAck.contractInfo && (
                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-primary-500/20">
                  <div className="text-center">
                    <p className="text-[10px] text-gray-500 uppercase">Ingaggio</p>
                    <p className="text-sm font-bold text-white">{pendingAck.contractInfo.salary}M</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-gray-500 uppercase">Durata</p>
                    <p className="text-sm font-bold text-white">{pendingAck.contractInfo.duration}s</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-gray-500 uppercase">Clausola</p>
                    <p className="text-sm font-bold text-primary-400">{pendingAck.contractInfo.rescissionClause}M</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-surface-300 rounded-lg p-4 mb-4 text-center"><p className="text-gray-400">Nessuna offerta</p></div>
          )}
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Conferme</span>
              <span className="text-white">{pendingAck.totalAcknowledged}/{pendingAck.totalMembers}</span>
            </div>
            <div className="w-full bg-surface-400 rounded-full h-2">
              <div className="h-2 rounded-full bg-secondary-500 transition-all" style={{ width: `${(pendingAck.totalAcknowledged / pendingAck.totalMembers) * 100}%` }}></div>
            </div>
          </div>

          {/* Profezia opzionale */}
          <textarea
            value={prophecyContent}
            onChange={e => setProphecyContent(e.target.value)}
            className="w-full bg-surface-300 border border-surface-50/30 rounded-lg p-3 text-white placeholder-gray-500 mb-4"
            rows={2}
            placeholder="Profezia (opzionale)..."
            maxLength={500}
          />

          {/* Ricorso (espandibile) */}
          {isAppealMode && (
            <div className="mb-4">
              <p className="text-xs text-danger-400 mb-2">
                Indica il motivo per cui contesti questa conclusione d'asta (es. problemi di connessione)
              </p>
              <textarea
                value={appealContent}
                onChange={e => setAppealContent(e.target.value)}
                className="w-full bg-surface-300 border border-danger-500/50 rounded-lg p-3 text-white placeholder-gray-500"
                rows={3}
                placeholder="Descrivi il motivo del ricorso..."
                maxLength={500}
              />
            </div>
          )}

          {/* Bottoni Azione */}
          <div className="flex gap-3">
            <Button
              onClick={() => onAcknowledge(!!prophecyContent.trim())}
              disabled={ackSubmitting}
              className="flex-1 bg-secondary-500 hover:bg-secondary-600 text-white font-bold py-3"
            >
              {ackSubmitting ? 'Invio...' : 'Conferma'}
            </Button>
            {!isAppealMode ? (
              <Button
                onClick={() => setIsAppealMode(true)}
                disabled={ackSubmitting}
                variant="outline"
                className="flex-1 border-danger-500 text-danger-400 hover:bg-danger-500/10 py-3"
              >
                Ricorso
              </Button>
            ) : (
              <Button
                onClick={() => onAcknowledge(false, true)}
                disabled={ackSubmitting || !appealContent.trim()}
                className="flex-1 bg-danger-500 hover:bg-danger-600 text-white py-3"
              >
                {ackSubmitting ? 'Invio...' : 'Invia Ricorso'}
              </Button>
            )}
          </div>

          {/* Admin: Simula ricorso */}
          {isAdmin && (
            <>
              {error && (
                <div className="mt-3 p-2 bg-danger-500/20 border border-danger-500/50 rounded text-danger-400 text-xs">
                  {error}
                  {error.includes('PENDING') && (
                    <Button
                      onClick={() => onNavigate('admin', { leagueId, tab: 'appeals' })}
                      size="sm"
                      className="w-full mt-2 bg-danger-500 hover:bg-danger-600 text-white text-xs"
                    >
                      Gestisci Ricorsi
                    </Button>
                  )}
                </div>
              )}
              <Button
                onClick={onSimulateAppeal}
                size="sm"
                variant="outline"
                className="w-full mt-3 text-xs border-accent-500/50 text-accent-400 hover:bg-accent-500/10"
              >
                [TEST] Simula ricorso di un DG
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── 3. Waiting Modal ────────────────────────────────────────────────

export function WaitingModal({ pendingAck, appealStatus, isAdmin, onForceAcknowledgeAll }: WaitingModalProps) {
  if (
    !(
      pendingAck &&
      pendingAck.userAcknowledged &&
      !['APPEAL_REVIEW', 'AWAITING_APPEAL_ACK', 'AWAITING_RESUME'].includes(pendingAck.status) &&
      !['APPEAL_REVIEW', 'AWAITING_APPEAL_ACK', 'AWAITING_RESUME'].includes(appealStatus?.auctionStatus || '')
    )
  ) {
    return null
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-200 rounded-xl max-w-sm w-full p-6 text-center border border-surface-50/20">
        <div className="w-12 h-12 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-4"></div>
        <h3 className="font-bold text-white mb-2">In attesa degli altri</h3>
        <p className="text-sm text-gray-400 mb-3">{pendingAck.totalAcknowledged}/{pendingAck.totalMembers} confermati</p>
        <p className="text-xs text-gray-500 mb-4">Mancano: {pendingAck.pendingMembers.map(m => m.username).join(', ')}</p>
        {isAdmin && <Button size="sm" variant="outline" onClick={onForceAcknowledgeAll} className="border-accent-500/50 text-accent-400">[TEST] Forza Conferme</Button>}
      </div>
    </div>
  )
}

// ─── 4. Appeal Review Modal ──────────────────────────────────────────

export function AppealReviewModal({
  appealStatus,
  pendingAck,
  isAdmin,
  onNavigate,
  leagueId,
}: AppealReviewModalProps) {
  if (!(appealStatus?.auctionStatus === 'APPEAL_REVIEW' || pendingAck?.status === 'APPEAL_REVIEW')) {
    return null
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-200 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-danger-500/50">
        <div className="p-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-full bg-danger-500/20 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">{'\u26A0\uFE0F'}</span>
            </div>
            <h2 className="text-2xl font-bold text-white">Ricorso in Corso</h2>
            <p className="text-gray-400 mt-1">L'asta è sospesa in attesa della decisione dell'admin</p>
          </div>

          {/* Player info */}
          {(appealStatus?.player || pendingAck?.player) && (
            <div className="bg-surface-300 rounded-lg p-4 mb-4 flex items-center gap-3">
              <span className={`w-10 h-10 rounded-full bg-gradient-to-br ${POSITION_COLORS[(appealStatus?.player || pendingAck?.player)?.position || 'P']} flex items-center justify-center text-white font-bold flex-shrink-0`}>
                {(appealStatus?.player || pendingAck?.player)?.position}
              </span>
              <div className="w-8 h-8 bg-white/90 rounded flex items-center justify-center p-0.5 flex-shrink-0">
                <img
                  src={getTeamLogo((appealStatus?.player || pendingAck?.player)?.team || '')}
                  alt={(appealStatus?.player || pendingAck?.player)?.team}
                  className="w-7 h-7 object-contain"
                />
              </div>
              <div>
                <p className="font-bold text-white">{(appealStatus?.player || pendingAck?.player)?.name}</p>
                <p className="text-sm text-gray-400">{(appealStatus?.player || pendingAck?.player)?.team}</p>
              </div>
            </div>
          )}

          {/* Appeal details */}
          {appealStatus?.appeal && (
            <div className="bg-danger-500/10 border border-danger-500/30 rounded-lg p-4 mb-4">
              <p className="text-xs text-danger-400 uppercase font-bold mb-2">Motivo del ricorso</p>
              <p className="text-gray-300">{appealStatus.appeal.reason}</p>
              <p className="text-sm text-gray-500 mt-2">Presentato da: <span className="text-white">{appealStatus.appeal.submittedBy?.username}</span></p>
            </div>
          )}

          {/* Transaction info */}
          {(appealStatus?.winner || pendingAck?.winner) && (
            <div className="bg-primary-500/10 rounded-lg p-4 mb-4 text-center border border-primary-500/30">
              <p className="text-sm text-primary-400">Transazione contestata</p>
              <p className="text-lg font-bold text-white">{(appealStatus?.winner || pendingAck?.winner)?.username}</p>
              <p className="text-2xl font-bold text-accent-400 mt-1">{appealStatus?.finalPrice || pendingAck?.finalPrice}</p>
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
  )
}

// ─── 5. Appeal Ack Modal ─────────────────────────────────────────────

export function AppealAckModal({
  appealStatus,
  pendingAck,
  ackSubmitting,
  isAdmin,
  onAcknowledgeAppealDecision,
  onForceAllAppealAcks,
}: AppealAckModalProps) {
  const autoAckedRef = useRef(false)

  // Admin auto-ack: automatically acknowledge and force all when modal opens
  useEffect(() => {
    if (!isAdmin || autoAckedRef.current) return
    const isVisible = appealStatus?.auctionStatus === 'AWAITING_APPEAL_ACK' || pendingAck?.status === 'AWAITING_APPEAL_ACK'
    if (!isVisible) return
    autoAckedRef.current = true
    // Auto-ack own, then force all
    if (!appealStatus?.userHasAcked) {
      onAcknowledgeAppealDecision()
    }
    setTimeout(() => onForceAllAppealAcks(), 500)
  }, [isAdmin, appealStatus?.auctionStatus, pendingAck?.status, appealStatus?.userHasAcked, onAcknowledgeAppealDecision, onForceAllAppealAcks])

  if (!(appealStatus?.auctionStatus === 'AWAITING_APPEAL_ACK' || pendingAck?.status === 'AWAITING_APPEAL_ACK')) {
    autoAckedRef.current = false
    return null
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-200 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-surface-50/20">
        <div className="p-6">
          <div className="text-center mb-6">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${appealStatus?.appeal?.status === 'ACCEPTED' ? 'bg-warning-500/20' : 'bg-secondary-500/20'}`}>
              <span className="text-3xl">{appealStatus?.appeal?.status === 'ACCEPTED' ? '\uD83D\uDD04' : '\u2705'}</span>
            </div>
            <h2 className="text-2xl font-bold text-white">
              Ricorso {appealStatus?.appeal?.status === 'ACCEPTED' ? 'Accolto' : 'Respinto'}
            </h2>
            <p className="text-gray-400 mt-1">
              {appealStatus?.appeal?.status === 'ACCEPTED'
                ? 'La transazione è stata annullata, l\'asta riprenderà'
                : 'La transazione è confermata'}
            </p>
          </div>

          {/* Player info */}
          {(appealStatus?.player || pendingAck?.player) && (
            <div className="bg-surface-300 rounded-lg p-4 mb-4 flex items-center gap-3">
              <span className={`w-10 h-10 rounded-full bg-gradient-to-br ${POSITION_COLORS[(appealStatus?.player || pendingAck?.player)?.position || 'P']} flex items-center justify-center text-white font-bold flex-shrink-0`}>
                {(appealStatus?.player || pendingAck?.player)?.position}
              </span>
              <div className="w-8 h-8 bg-white/90 rounded flex items-center justify-center p-0.5 flex-shrink-0">
                <img
                  src={getTeamLogo((appealStatus?.player || pendingAck?.player)?.team || '')}
                  alt={(appealStatus?.player || pendingAck?.player)?.team}
                  className="w-7 h-7 object-contain"
                />
              </div>
              <div>
                <p className="font-bold text-white">{(appealStatus?.player || pendingAck?.player)?.name}</p>
                <p className="text-sm text-gray-400">{(appealStatus?.player || pendingAck?.player)?.team}</p>
              </div>
            </div>
          )}

          {/* Admin notes */}
          {appealStatus?.appeal?.adminNotes && (
            <div className="bg-surface-300 border border-surface-50/30 rounded-lg p-4 mb-4">
              <p className="text-xs text-gray-400 uppercase font-bold mb-2">Note dell'admin</p>
              <p className="text-gray-300">{appealStatus.appeal.adminNotes}</p>
            </div>
          )}

          {/* Ack progress */}
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Conferme presa visione</span>
              <span className="text-white">{appealStatus?.appealDecisionAcks?.length || 0}/{appealStatus?.allMembers?.length || pendingAck?.totalMembers || 0}</span>
            </div>
            <div className="w-full bg-surface-400 rounded-full h-2">
              <div
                className="h-2 rounded-full bg-secondary-500 transition-all"
                style={{ width: `${((appealStatus?.appealDecisionAcks?.length || 0) / (appealStatus?.allMembers?.length || pendingAck?.totalMembers || 1)) * 100}%` }}
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
              disabled={ackSubmitting}
              className="w-full bg-secondary-500 hover:bg-secondary-600 text-white font-bold py-3"
            >
              {ackSubmitting ? 'Invio...' : 'Ho preso visione'}
            </Button>
          ) : (
            <div className="text-center py-4">
              <p className="text-secondary-400 font-medium mb-2">{'\u2713'} Hai confermato - In attesa degli altri</p>
            </div>
          )}

          {/* Admin test button - sempre visibile per admin */}
          {isAdmin && (
            <Button
              size="sm"
              variant="outline"
              onClick={onForceAllAppealAcks}
              className="w-full mt-3 border-accent-500/50 text-accent-400"
            >
              [TEST] Forza Tutte Conferme Ricorso
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── 6. Awaiting Resume Modal ────────────────────────────────────────

export function AwaitingResumeModal({
  appealStatus,
  pendingAck,
  markingReady,
  isAdmin,
  onReadyToResume,
  onForceAllReadyResume,
}: AwaitingResumeModalProps) {
  const autoReadyRef = useRef(false)

  // Admin auto-ready: automatically mark ready and force all when modal opens
  useEffect(() => {
    if (!isAdmin || autoReadyRef.current) return
    const isVisible = appealStatus?.auctionStatus === 'AWAITING_RESUME' || pendingAck?.status === 'AWAITING_RESUME'
    if (!isVisible) return
    autoReadyRef.current = true
    // Auto-ready own, then force all
    if (!appealStatus?.userIsReady) {
      onReadyToResume()
    }
    setTimeout(() => onForceAllReadyResume(), 500)
  }, [isAdmin, appealStatus?.auctionStatus, pendingAck?.status, appealStatus?.userIsReady, onReadyToResume, onForceAllReadyResume])

  if (!(appealStatus?.auctionStatus === 'AWAITING_RESUME' || pendingAck?.status === 'AWAITING_RESUME')) {
    autoReadyRef.current = false
    return null
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-200 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto border-2 border-accent-500/50 animate-pulse-slow">
        <div className="p-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-full bg-accent-500/20 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">{'\uD83D\uDD14'}</span>
            </div>
            <h2 className="text-2xl font-bold text-white">Pronto a Riprendere?</h2>
            <p className="text-gray-400 mt-1">L'asta sta per riprendere, conferma la tua presenza</p>
          </div>

          {/* Player info */}
          {(appealStatus?.player || pendingAck?.player) && (
            <div className="bg-surface-300 rounded-lg p-4 mb-4 flex items-center gap-3">
              <span className={`w-10 h-10 rounded-full bg-gradient-to-br ${POSITION_COLORS[(appealStatus?.player || pendingAck?.player)?.position || 'P']} flex items-center justify-center text-white font-bold flex-shrink-0`}>
                {(appealStatus?.player || pendingAck?.player)?.position}
              </span>
              <div className="w-8 h-8 bg-white/90 rounded flex items-center justify-center p-0.5 flex-shrink-0">
                <img
                  src={getTeamLogo((appealStatus?.player || pendingAck?.player)?.team || '')}
                  alt={(appealStatus?.player || pendingAck?.player)?.team}
                  className="w-7 h-7 object-contain"
                />
              </div>
              <div>
                <p className="font-bold text-white">{(appealStatus?.player || pendingAck?.player)?.name}</p>
                <p className="text-sm text-gray-400">{(appealStatus?.player || pendingAck?.player)?.team}</p>
              </div>
            </div>
          )}

          <div className="bg-warning-500/10 border border-warning-500/30 rounded-lg p-4 mb-4 text-center">
            <p className="text-warning-400 font-medium">
              Il ricorso è stato accolto. L'asta riprenderà dall'ultima offerta valida.
            </p>
          </div>

          {/* Ready progress */}
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">DG pronti</span>
              <span className="text-white">{appealStatus?.resumeReadyMembers?.length || 0}/{appealStatus?.allMembers?.length || pendingAck?.totalMembers || 0}</span>
            </div>
            <div className="w-full bg-surface-400 rounded-full h-2">
              <div
                className="h-2 rounded-full bg-accent-500 transition-all"
                style={{ width: `${((appealStatus?.resumeReadyMembers?.length || 0) / (appealStatus?.allMembers?.length || pendingAck?.totalMembers || 1)) * 100}%` }}
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
              onClick={onReadyToResume}
              disabled={markingReady}
              className="w-full btn-accent py-3 text-lg font-bold"
            >
              {markingReady ? 'Attendi...' : 'SONO PRONTO'}
            </Button>
          ) : (
            <div className="text-center py-4">
              <p className="text-secondary-400 font-medium mb-2">{'\u2713'} Pronto - In attesa degli altri</p>
            </div>
          )}

          {/* Admin test button - sempre visibile per admin */}
          {isAdmin && (
            <Button
              size="sm"
              variant="outline"
              onClick={onForceAllReadyResume}
              className="w-full mt-3 border-accent-500/50 text-accent-400"
            >
              [TEST] Forza Tutti Pronti
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
