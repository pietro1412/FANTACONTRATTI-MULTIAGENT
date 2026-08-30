import { useEffect, useRef, useState } from 'react'
import { Button } from '../ui/Button'
import { Textarea } from '../ui/Textarea'
import { POSITION_NAMES } from '../ui/PositionBadge'
import { getTeamLogo } from '../../utils/teamLogos'
import { getPlayerPhotoUrl } from '../../utils/player-images'
import { NOT_DISPONIBILE } from '../../utils/stat-format'
import { POSITION_COLORS } from '../../types/auctionroom.types'
import type { PendingAcknowledgment, AppealStatus } from '../../types/auctionroom.types'
import { celebrateWin, celebrateBigWin } from '../../utils/confetti'

// ─── Props Interfaces ────────────────────────────────────────────────

/** Structural subset shared by auction-room ManagerData and svincolati SelectedManagerData */
export interface ManagerDetailData {
  username: string
  teamName?: string | null
  currentBudget: number
  slotsFilled: number
  totalSlots: number
  slotsByPosition: Record<'P' | 'D' | 'C' | 'A', { filled: number; total: number }>
  roster: Array<{
    id: string
    position: string
    playerName: string
    playerTeam: string
    age?: number | null
    apiFootballId?: number | null
    contract?: { salary: number; duration: number; rescissionClause: number } | null
  }>
}

interface ManagerDetailModalProps {
  selectedManager: ManagerDetailData | null
  onClose: () => void
  /**
   * 'slots' (default, Primo Mercato): mostra slot per ruolo X/Y e slot liberi.
   * 'count' (aste ricorrenti: svincolati, rubata): solo il conteggio dei
   * giocatori, niente vincolo di slot per ruolo — vedi SVINCOLATI.md §1.2.
   */
  rosterMode?: 'slots' | 'count'
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
  resolvingAppealId: string | null
  onResolveAppeal: (appealId: string, decision: 'ACCEPTED' | 'REJECTED', resolutionNote?: string) => void
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

const MODAL_POS_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  P: { bg: 'bg-amber-500/15', border: 'border-amber-500/40', text: 'text-amber-400' },
  D: { bg: 'bg-blue-500/15', border: 'border-blue-500/40', text: 'text-blue-400' },
  C: { bg: 'bg-emerald-500/15', border: 'border-emerald-500/40', text: 'text-emerald-400' },
  A: { bg: 'bg-red-500/15', border: 'border-red-500/40', text: 'text-red-400' },
}

/** Colonne dati del roster (Età/Ingaggio/Durata/Clausola/Rubata, ordine da
 * assioma 6) — usate sia dall'header desktop sia, per etichettare le celle,
 * dalla card mobile. */
const ROSTER_COLS = ['Età', 'Ing', 'Dur', 'Cls', 'Rub'] as const

function rosterColValues(p: ManagerDetailData['roster'][number]): [string, string, string, string, string] {
  const c = p.contract
  const rubata = c ? c.rescissionClause + c.salary : null
  return [
    p.age != null ? `${p.age}` : NOT_DISPONIBILE,
    c ? `${c.salary}M` : '-',
    c ? `${c.duration}s` : '-',
    c ? `${c.rescissionClause}M` : '-',
    rubata !== null ? `${rubata}M` : '-',
  ]
}

/**
 * Riga giocatore del roster manager. Doppia resa responsive nello stesso
 * componente (assioma 2 + eccezione assioma 9, CLAUDE.md §Assiomi UI/UX):
 * - desktop (`lg:`): grid a colonne fisse, nome su tutta la colonna, mai
 *   troncato via ellissi solo in casi estremi — le etichette Ing/Dur/Cls/Rub/Acq
 *   stanno SOLO nell'header persistente sopra la lista, non per riga.
 * - mobile: il nome sale su una riga propria a piena larghezza e va a capo
 *   (mai troncato); i valori scendono su una griglia con etichetta per cella,
 *   perché qui non c'è un header persistente sopra uno stack scrollabile.
 * Stesso pattern di RosterTableRow/RosterPlayerCard (Rose).
 */
function ManagerRosterRow({ player, pos, style }: {
  player: ManagerDetailData['roster'][number]
  pos: 'P' | 'D' | 'C' | 'A'
  style: { bg: string; border: string; text: string }
}) {
  const photoUrl = getPlayerPhotoUrl(player.apiFootballId)
  const values = rosterColValues(player)

  const identity = (
    <>
      {photoUrl ? (
        <img
          src={photoUrl}
          alt={player.playerName}
          className="w-6 h-6 rounded-full object-cover bg-surface-100 flex-shrink-0"
          onError={(e) => {
            const target = e.target as HTMLImageElement
            target.style.display = 'none'
            target.nextElementSibling?.classList.remove('hidden')
          }}
        />
      ) : null}
      <span className={`w-6 h-6 rounded-full bg-gradient-to-br ${POSITION_COLORS[pos] ?? ''} flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${photoUrl ? 'hidden' : ''}`}>{pos}</span>
      <span className="w-4 h-4 bg-white/80 rounded flex items-center justify-center flex-shrink-0">
        <img src={getTeamLogo(player.playerTeam)} alt={player.playerTeam} className="w-3 h-3 object-contain" />
      </span>
    </>
  )

  return (
    <div className={`${style.bg} border ${style.border} rounded-lg`}>
      {/* Desktop: griglia a colonne, nome + valori sulla stessa riga */}
      <div className="hidden lg:grid grid-cols-[minmax(0,1fr)_60px_56px_64px_72px_64px] gap-3 items-center px-2.5 py-2">
        <div className="flex items-center gap-2 min-w-0">
          {identity}
          <span className="text-sm text-gray-200 font-semibold truncate min-w-0">{player.playerName}</span>
        </div>
        {values.slice(0, 4).map((v, i) => (
          <span key={ROSTER_COLS[i]} className="text-right text-sm font-mono font-semibold text-gray-300">{v}</span>
        ))}
        <span className="text-right text-sm font-mono font-bold text-accent-400" title={values[4] !== '-' ? `Prezzo rubata ${values[4]}` : 'Nessun prezzo rubata'}>{values[4]}</span>
      </div>

      {/* Mobile: nome su riga propria (va a capo, mai troncato) + griglia valori etichettati */}
      <div className="lg:hidden px-2.5 py-2">
        <div className="flex items-center gap-2 mb-1.5">
          {identity}
          <span className="flex-1 min-w-0 text-sm text-gray-200 font-semibold break-words">{player.playerName}</span>
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {ROSTER_COLS.map((label, i) => (
            <div key={label} className="bg-black/20 rounded-md py-1 text-center">
              <div className="text-[8px] uppercase tracking-wide text-gray-500 font-bold leading-none">{label}</div>
              <div className={`text-xs font-mono font-bold mt-0.5 ${label === 'Rub' ? 'text-accent-400' : 'text-gray-200'}`}>{values[i]}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function ManagerDetailModal({ selectedManager, onClose, rosterMode = 'slots' }: ManagerDetailModalProps) {
  if (!selectedManager) return null

  const countOnly = rosterMode === 'count'

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-surface-200 rounded-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-surface-50" onClick={e => { e.stopPropagation(); }}>
        <div className="p-5 pb-0 flex-shrink-0">
          {/* Header: monogram + identity */}
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center text-white font-black text-sm flex-shrink-0">
                {selectedManager.username.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h2 className="text-xl font-bold text-white leading-tight">{selectedManager.teamName || selectedManager.username}</h2>
                {selectedManager.teamName && <p className="text-sm text-gray-400">{selectedManager.username}</p>}
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
          </div>

          {/* Stat boxes */}
          <div className="flex gap-3 mb-4">
            <div className="bg-surface-300 border border-surface-50 rounded-lg px-4 py-2.5 flex-1 text-center">
              <p className="text-sm text-gray-500 uppercase tracking-wider font-semibold">Budget</p>
              <p className="budget-display text-2xl font-black text-accent-400">
                {selectedManager.currentBudget}<span className="text-sm text-gray-500 font-semibold">M</span>
              </p>
            </div>
            <div className="bg-surface-300 border border-surface-50 rounded-lg px-4 py-2.5 flex-1 text-center">
              <p className="text-sm text-gray-500 uppercase tracking-wider font-semibold">Rosa</p>
              <p className="stat-number text-2xl font-black text-white">
                {selectedManager.slotsFilled}
                {!countOnly && <span className="text-gray-500">/{selectedManager.totalSlots}</span>}
                {countOnly && <span className="text-sm text-gray-500 font-semibold"> giocatori</span>}
              </p>
            </div>
          </div>
        </div>

        {/* Header colonne — solo desktop, persistente sopra le righe scrollabili
            (eccezione assioma 9): le label Ing/Dur/Cls/Rub/Acq stanno qui, non
            si ripetono per riga. Su mobile non c'è, quindi le card sotto
            mantengono l'etichetta per cella (assioma 9 pieno). */}
        <div className="hidden lg:grid grid-cols-[minmax(0,1fr)_60px_56px_64px_72px_64px] gap-3 px-5 pt-3 pb-2 mt-1 border-b border-surface-50 flex-shrink-0">
          <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Giocatore</span>
          {ROSTER_COLS.map(label => (
            <span key={label} className="text-[10px] uppercase tracking-wider text-gray-500 font-bold text-right">{label}</span>
          ))}
        </div>

        {/* Roster rows — raggruppate per ruolo, area scrollabile sotto la testata fissa */}
        <div className="p-5 pt-3 overflow-y-auto flex-1 min-h-0 space-y-4">
          {(['P', 'D', 'C', 'A'] as const).map(pos => {
            const slot = selectedManager.slotsByPosition[pos]
            const posPlayers = selectedManager.roster.filter(r => r.position === pos)
            const style = MODAL_POS_STYLES[pos] ?? { bg: 'bg-gray-500/15', border: 'border-gray-500/40', text: 'text-gray-400' }
            const freeSlots = Math.max(0, slot.total - slot.filled)
            return (
              <div key={pos}>
                {/* Position header */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-5 h-5 rounded-full bg-gradient-to-br ${POSITION_COLORS[pos] ?? ''} flex items-center justify-center text-sm font-bold text-white flex-shrink-0`}>{pos}</span>
                    <span className="text-sm font-bold text-gray-300 uppercase">{POSITION_NAMES[pos]}</span>
                  </div>
                  <span className={`text-sm font-mono font-bold ${countOnly ? 'text-gray-400' : slot.filled >= slot.total ? 'text-green-400' : 'text-gray-500'}`}>
                    {countOnly ? slot.filled : `${slot.filled}/${slot.total}`}
                  </span>
                </div>

                {/* Player rows */}
                <div className="space-y-1">
                  {posPlayers.map(p => (
                    <ManagerRosterRow key={p.id} player={p} pos={pos} style={style} />
                  ))}
                  {!countOnly && freeSlots > 0 && (
                    <div className={`flex items-center justify-center rounded-lg px-2 py-1.5 border border-dashed ${style.border} opacity-40`}>
                      <span className="text-sm text-gray-400">{freeSlots} slot liber{freeSlots === 1 ? 'o' : 'i'}</span>
                    </div>
                  )}
                  {countOnly && posPlayers.length === 0 && (
                    <p className="text-sm text-gray-600 italic px-2 py-1">Nessuno</p>
                  )}
                </div>
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
}: AcknowledgmentModalProps) {
  // T-007: Celebration confetti when auction is won
  const celebratedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!pendingAck?.winner || pendingAck.userAcknowledged) return
    // Only celebrate once per auction
    const ackId = pendingAck.id || pendingAck.player?.name
    if (celebratedRef.current === ackId) return
    celebratedRef.current = ackId
    // Big celebration for expensive players (>= 100M), normal otherwise
    if (pendingAck.finalPrice >= 100) {
      celebrateBigWin()
    } else {
      celebrateWin()
    }
  }, [pendingAck?.winner, pendingAck?.id, pendingAck?.player?.name, pendingAck?.userAcknowledged, pendingAck?.finalPrice])

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
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce-in ${pendingAck.winner ? 'bg-secondary-500/20' : 'bg-surface-300'}`}>
              <span className="text-3xl">{pendingAck.winner ? '\u2705' : '\u274C'}</span>
            </div>
            <h2 className="text-2xl font-bold text-white">{pendingAck.winner ? 'Transazione Completata' : 'Asta Conclusa'}</h2>
          </div>
          <div className="bg-surface-300 rounded-lg p-4 mb-4 flex items-center gap-3">
            {(() => {
              const photoUrl = getPlayerPhotoUrl(pendingAck.player.apiFootballId)
              if (photoUrl) {
                return (
                  <img
                    src={photoUrl}
                    alt={pendingAck.player.name}
                    className="w-10 h-10 rounded-full object-cover bg-surface-100 flex-shrink-0"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.style.display = 'none'
                      target.nextElementSibling?.classList.remove('hidden')
                    }}
                  />
                )
              }
              return null
            })()}
            <span className={`w-10 h-10 rounded-full bg-gradient-to-br ${POSITION_COLORS[pendingAck.player.position] ?? ''} flex items-center justify-center text-white font-bold flex-shrink-0 ${getPlayerPhotoUrl(pendingAck.player.apiFootballId) ? 'hidden' : ''}`}>{pendingAck.player.position}</span>
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
          <Textarea
            value={prophecyContent}
            onChange={e => { setProphecyContent(e.target.value); }}
            className="mb-4"
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
                onChange={e => { setAppealContent(e.target.value); }}
                className="w-full bg-surface-300 border border-danger-500/50 rounded-lg p-3 text-white placeholder-gray-500"
                rows={3}
                placeholder="Descrivi il motivo del ricorso..."
                maxLength={500}
              />
            </div>
          )}

          {/* Bottoni Azione — conferma e ricorso sono mutuamente esclusivi (test-session #10) */}
          {!isAppealMode ? (
            <div className="flex gap-3">
              <Button
                onClick={() => { onAcknowledge(!!prophecyContent.trim()); }}
                disabled={ackSubmitting}
                className="flex-1 bg-secondary-500 hover:bg-secondary-600 text-white font-bold py-3"
              >
                {ackSubmitting ? 'Invio...' : 'Conferma'}
              </Button>
              <Button
                onClick={() => { setIsAppealMode(true); }}
                disabled={ackSubmitting}
                variant="outline"
                className="flex-1 border-danger-500 text-danger-400 hover:bg-danger-500/10 py-3"
              >
                Ricorso
              </Button>
            </div>
          ) : (
            <div className="flex gap-3">
              <Button
                onClick={() => { setIsAppealMode(false); setAppealContent(''); }}
                disabled={ackSubmitting}
                variant="outline"
                className="flex-1 border-surface-50/40 text-gray-300 hover:bg-surface-300 py-3"
              >
                Annulla richiesta ricorso
              </Button>
              <Button
                onClick={() => { onAcknowledge(false, true); }}
                disabled={ackSubmitting || !appealContent.trim()}
                className="flex-1 bg-danger-500 hover:bg-danger-600 text-white py-3"
              >
                {ackSubmitting ? 'Invio...' : 'Invia Ricorso'}
              </Button>
            </div>
          )}

          {/* Admin: Simula ricorso — separato visivamente dai bottoni utente
              (Conferma/Ricorso) sopra per evitare misclick tra azione reale
              e scorciatoia di test (audit: click accidentale registrato). */}
          {isAdmin && (
            <div className="mt-4 pt-3 border-t border-surface-50/40">
              <p className="micro-label text-warning-500 mb-2">Solo admin · test</p>
              {error && (
                <div className="mb-2 p-2 bg-danger-500/20 border border-danger-500/50 rounded text-danger-400 text-xs">
                  {error}
                  {/* #13: la gestione ricorsi avviene inline (pannello Azioni Admin /
                      AppealReviewModal), non più reindirizzando alla pagina admin. */}
                  {error.includes('PENDING') && (
                    <p className="mt-2 text-gray-300">
                      Gestisci i ricorsi dal pannello &quot;Azioni Admin&quot; o dalla schermata di revisione del ricorso.
                    </p>
                  )}
                </div>
              )}
              <Button
                onClick={onSimulateAppeal}
                size="sm"
                variant="outline"
                className="w-full text-xs border-accent-500/50 text-accent-400 hover:bg-accent-500/10"
              >
                [TEST] Simula ricorso di un DG
              </Button>
            </div>
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
  resolvingAppealId,
  onResolveAppeal,
}: AppealReviewModalProps) {
  const [resolutionNote, setResolutionNote] = useState('')

  if (!(appealStatus?.auctionStatus === 'APPEAL_REVIEW' || pendingAck?.status === 'APPEAL_REVIEW')) {
    return null
  }

  const appealId = appealStatus?.appeal?.id
  const isResolving = !!appealId && resolvingAppealId === appealId

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
              <span className={`w-10 h-10 rounded-full bg-gradient-to-br ${POSITION_COLORS[(appealStatus?.player || pendingAck?.player)?.position || 'P'] ?? ''} flex items-center justify-center text-white font-bold flex-shrink-0`}>
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

          {/* Admin risolve il ricorso INLINE (Accetta/Rifiuta), senza lasciare
              la maschera asta (#13). I non-admin restano in attesa. */}
          {isAdmin && appealId ? (
            <div className="mt-2">
              <textarea
                value={resolutionNote}
                onChange={e => { setResolutionNote(e.target.value); }}
                className="w-full bg-surface-300 border border-surface-50/30 rounded-lg p-3 text-white placeholder-gray-500 mb-3"
                rows={2}
                placeholder="Nota per la decisione (opzionale)..."
                maxLength={500}
              />
              <div className="flex gap-3">
                <Button
                  onClick={() => { onResolveAppeal(appealId, 'ACCEPTED', resolutionNote.trim() || undefined); }}
                  disabled={isResolving}
                  className="flex-1 bg-secondary-500 hover:bg-secondary-600 text-white font-bold py-3"
                >
                  {isResolving ? 'Attendi...' : 'Accetta ricorso'}
                </Button>
                <Button
                  onClick={() => { onResolveAppeal(appealId, 'REJECTED', resolutionNote.trim() || undefined); }}
                  disabled={isResolving}
                  className="flex-1 bg-danger-500 hover:bg-danger-600 text-white font-bold py-3"
                >
                  {isResolving ? 'Attendi...' : 'Rifiuta ricorso'}
                </Button>
              </div>
              <p className="text-[11px] text-gray-500 mt-2 text-center">
                Accetta: annulla l&apos;aggiudicazione e riapre l&apos;asta. Rifiuta: conferma la transazione.
              </p>
            </div>
          ) : (
            <div className="text-center py-4">
              <div className="w-10 h-10 border-4 border-danger-500/30 border-t-danger-500 rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-gray-400">In attesa della decisione dell'admin...</p>
            </div>
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
  // #17: niente auto-ack né force-all automatico dell'admin. Ogni utente
  // (ricorrente, altri DG, admin) deve poter LEGGERE l'esito del ricorso e
  // confermare manualmente con "Ho preso visione". L'admin mantiene il bottone
  // [TEST] di forzatura, ma solo come click esplicito.
  const isVisible = appealStatus?.auctionStatus === 'AWAITING_APPEAL_ACK' || pendingAck?.status === 'AWAITING_APPEAL_ACK'

  if (!isVisible) {
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
              <span className={`w-10 h-10 rounded-full bg-gradient-to-br ${POSITION_COLORS[(appealStatus?.player || pendingAck?.player)?.position || 'P'] ?? ''} flex items-center justify-center text-white font-bold flex-shrink-0`}>
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
  const isVisible = appealStatus?.auctionStatus === 'AWAITING_RESUME' || pendingAck?.status === 'AWAITING_RESUME'

  // Nessun auto-ready/auto-force dell'admin: il ready-check deve attendere che
  // OGNI manager clicchi "SONO PRONTO" manualmente, così tutti hanno consapevolezza
  // della ripresa (prima la modale spariva subito e il timer ripartiva). L'admin
  // mantiene il bottone [TEST] "Forza Tutti Pronti" per i test. (test-session #31)

  if (!isVisible) {
    return null
  }

  // Messaggio differenziato: ricorso accolto vs annullo movimento admin (#29)
  const resumePlayerName = (appealStatus?.player || pendingAck?.player)?.name
  const resumeMessage =
    appealStatus?.resumeReason === 'movement-reverted'
      ? `L'admin ha annullato l'ultimo movimento. Si riparte dall'ultima offerta valida${
          resumePlayerName ? ` per ${resumePlayerName}` : ''
        }.`
      : "Il ricorso è stato accolto. L'asta riprenderà dall'ultima offerta valida."

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
              <span className={`w-10 h-10 rounded-full bg-gradient-to-br ${POSITION_COLORS[(appealStatus?.player || pendingAck?.player)?.position || 'P'] ?? ''} flex items-center justify-center text-white font-bold flex-shrink-0`}>
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
              {resumeMessage}
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
