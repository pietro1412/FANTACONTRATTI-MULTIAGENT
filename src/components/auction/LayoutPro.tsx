/**
 * LayoutPro.tsx - Pro Layout (consolidato da LayoutF, Sprint 4)
 *
 * Layout professionale con:
 * - Design compatto e denso di informazioni
 * - Integrazione completa flussi: nomination, ready check, asta, acknowledgment
 * - Sistema fasce giocatori (A/B/C) derivato da quotazione
 * - Box offerte con gestione slot pieno
 * - Pannello obiettivi pre-asta integrato
 *
 * Issue: #147
 * Creato il: 25/01/2026
 */

import { useState, useMemo } from 'react'
import { getTeamLogo } from '../../utils/teamLogos'
import { getPlayerPhotoUrl } from '../../utils/player-images'
import {
  AuctionLayoutProps,
  POSITION_NAMES,
  POSITION_BG,
  POSITION_COLORS,
  ManagerData
} from './types'
import { useAuctionObjectives, type AuctionObjective } from '../../modules/auction/presentation/hooks/useAuctionObjectives'
import { AdminControlsPanel } from './AdminControlsPanel'

// Player type per nomination
interface NominationPlayer {
  id: string
  name: string
  team: string
  position: string
  quotation?: number
}

// Estensione props per flussi specifici Fantacontratti
interface LayoutFProps extends AuctionLayoutProps {
  // Session ID per obiettivi
  sessionId?: string

  // Player nomination
  players?: NominationPlayer[]
  searchQuery?: string
  onSearchChange?: (query: string) => void
  onNominatePlayer?: (playerId: string) => void

  // Ready check
  readyStatus?: {
    hasPendingNomination: boolean
    nominatorConfirmed: boolean
    player: { name: string; position: string; team: string } | null
    nominatorUsername: string
    readyMembers: { id: string; username: string }[]
    pendingMembers: { id: string; username: string }[]
    totalMembers: number
    readyCount: number
    userIsReady: boolean
    userIsNominator: boolean
  } | null
  onMarkReady?: () => void
  markingReady?: boolean

  // Acknowledgment
  pendingAck?: {
    player: { name: string; position: string; team: string }
    winner: { username: string } | null
    finalPrice: number
    userAcknowledged: boolean
    acknowledgedMembers: { id: string; username: string }[]
    pendingMembers: { id: string; username: string }[]
    totalMembers: number
    totalAcknowledged: number
  } | null
  onAcknowledge?: () => void
  ackSubmitting?: boolean

  // Admin Controls
  onUpdateTimer?: (seconds: number) => void
  onBotNominate?: () => void
  onBotConfirmNomination?: () => void
  onBotBid?: () => void
  onForceAllReady?: () => void
  onForceAcknowledgeAll?: () => void
  onCompleteAllSlots?: () => void
  onResetFirstMarket?: () => void
}

// Calcolo fascia da quotazione
function getPlayerTier(quotation: number | undefined): { tier: string; color: string; bg: string } {
  if (!quotation) return { tier: '?', color: 'text-gray-400', bg: 'bg-gray-500/20' }
  if (quotation >= 25) return { tier: 'A', color: 'text-yellow-400', bg: 'bg-yellow-500/20' }
  if (quotation >= 10) return { tier: 'B', color: 'text-blue-400', bg: 'bg-blue-500/20' }
  return { tier: 'C', color: 'text-gray-400', bg: 'bg-gray-500/20' }
}

// Colori posizione compatti
const POS_COLORS: Record<string, string> = {
  P: 'bg-purple-500',
  D: 'bg-green-500',
  C: 'bg-blue-500',
  A: 'bg-red-500'
}

export function LayoutPro({
  auction,
  timeLeft,
  timerSetting,
  isTimerExpired,
  membership,
  isAdmin,
  isMyTurn,
  isUserWinning,
  currentUsername,
  managersStatus,
  currentTurnManager,
  myRosterSlots,
  marketProgress,
  bidAmount,
  setBidAmount,
  onPlaceBid,
  isConnected,
  connectionStatus,
  onSelectManager,
  onCloseAuction,
  // Props estese
  sessionId,
  players,
  searchQuery,
  onSearchChange,
  onNominatePlayer,
  readyStatus,
  onMarkReady,
  markingReady,
  pendingAck,
  onAcknowledge,
  ackSubmitting,
  // Admin Controls
  onUpdateTimer,
  onBotNominate,
  onBotConfirmNomination,
  onBotBid,
  onForceAllReady,
  onForceAcknowledgeAll,
  onCompleteAllSlots,
  onResetFirstMarket
}: LayoutFProps) {
  // State per pannello obiettivi - aperto di default
  const [showObjectives, setShowObjectives] = useState(true)

  // Hook obiettivi
  const {
    objectives,
    summary,
    isLoading: objectivesLoading,
    createObjective,
    deleteObjective,
    isPlayerObjective,
    getPlayerObjective
  } = useAuctionObjectives(sessionId)

  // Controlla se giocatore corrente è negli obiettivi
  const currentPlayerObjective = useMemo(() => {
    if (!auction?.player?.id) return null
    return getPlayerObjective(auction.player.id)
  }, [auction?.player?.id, getPlayerObjective])

  const isCurrentPlayerObjective = useMemo(() => {
    if (!auction?.player?.id) return false
    return isPlayerObjective(auction.player.id)
  }, [auction?.player?.id, isPlayerObjective])

  // Timer styling
  const timerPercent = timerSetting > 0 ? ((timeLeft || 0) / timerSetting) * 100 : 0
  const timerColor = timerPercent > 50 ? 'text-green-400' : timerPercent > 20 ? 'text-yellow-400' : 'text-red-400'
  const timerBg = timerPercent > 50 ? 'bg-green-500' : timerPercent > 20 ? 'bg-yellow-500' : 'bg-red-500'

  // Auction state
  const winningBidder = auction?.bids[0]?.bidder.user.username
  const isWinning = winningBidder === currentUsername

  // Slot check
  const currentPlayerPosition = auction?.player?.position as 'P' | 'D' | 'C' | 'A' | undefined
  const currentPositionSlot = currentPlayerPosition && myRosterSlots?.slots[currentPlayerPosition]
  const isSlotFull = currentPositionSlot ? currentPositionSlot.filled >= currentPositionSlot.total : false
  const canBid = !isSlotFull && !isTimerExpired

  // Player tier
  const playerTier = auction ? getPlayerTier(auction.player.quotation) : null

  // Budget helper
  const getBudgetSpent = (roster: ManagerData['roster']) => {
    return roster.reduce((sum, r) => sum + (r.acquisitionPrice || 0), 0)
  }

  // ==================== COMPONENTE OBIETTIVI RIUTILIZZABILE ====================
  const ObjectivesPanel = () => {
    console.log('[ObjectivesPanel] sessionId:', sessionId, 'objectives:', objectives.length, 'loading:', objectivesLoading)

    if (!sessionId) {
      return (
        <div className="bg-yellow-500/20 border border-yellow-500 rounded-lg p-3 text-yellow-400 text-sm">
          ⚠️ SessionId mancante - impossibile caricare obiettivi
        </div>
      )
    }

    return (
      <div className="bg-surface-200 rounded-lg border-2 border-accent-500/50 overflow-hidden">
        {/* Header collapsible */}
        <button
          onClick={() => setShowObjectives(!showObjectives)}
          className="w-full px-3 py-2 flex items-center justify-between bg-accent-500/10 hover:bg-accent-500/20 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">🎯</span>
            <span className="text-xs font-bold text-accent-400 uppercase">I Miei Obiettivi</span>
            {summary && (
              <div className="flex items-center gap-1.5 text-[10px]">
                <span className="px-1.5 py-0.5 rounded bg-accent-500/20 text-accent-400 font-bold">{summary.active} attivi</span>
                {summary.acquired > 0 && <span className="px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">{summary.acquired} vinti</span>}
                {summary.missed > 0 && <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">{summary.missed} persi</span>}
              </div>
            )}
          </div>
          <span className={`text-gray-500 transition-transform ${showObjectives ? 'rotate-180' : ''}`}>▼</span>
        </button>

        {/* Panel content */}
        {showObjectives && (
          <div className="border-t border-surface-50/20 p-2">
            {objectivesLoading ? (
              <div className="text-center text-gray-500 text-xs py-2">Caricamento...</div>
            ) : objectives.filter(o => o.status === 'ACTIVE').length === 0 ? (
              <div className="text-center text-gray-500 text-xs py-2">
                Nessun obiettivo attivo
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5">
                {objectives.filter(o => o.status === 'ACTIVE').slice(0, 8).map(obj => (
                  <div
                    key={obj.id}
                    className="p-1.5 rounded text-[10px] flex items-center justify-between gap-1 bg-surface-300/50"
                  >
                    <div className="flex items-center gap-1 min-w-0">
                      <span className={`w-4 h-4 rounded text-[8px] font-bold text-white flex items-center justify-center flex-shrink-0 ${POS_COLORS[obj.player.position] || 'bg-gray-500'}`}>
                        {obj.player.position}
                      </span>
                      <span className="truncate text-gray-200">{obj.player.name}</span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className={`w-4 h-4 rounded-full text-[8px] font-bold flex items-center justify-center ${
                        obj.priority === 1 ? 'bg-red-500 text-white' :
                        obj.priority === 2 ? 'bg-yellow-500 text-dark-900' :
                        'bg-gray-500 text-white'
                      }`}>{obj.priority}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteObjective(obj.id)
                        }}
                        className="text-gray-500 hover:text-red-400 text-xs"
                        title="Rimuovi obiettivo"
                      >×</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ==================== RENDER STATES ====================

  // STATO: Pending Acknowledgment
  if (pendingAck) {
    const ackPercent = (pendingAck.totalAcknowledged / pendingAck.totalMembers) * 100
    return (
      <div className="space-y-3">
        {/* Header compatto */}
        <div className="bg-surface-200 rounded-lg border border-surface-50/20 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">✅</span>
              <span className="font-bold text-white text-sm">ASTA CONCLUSA</span>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded ${isConnected ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
              {isConnected ? 'Live' : connectionStatus}
            </span>
          </div>
        </div>

        {/* Card risultato */}
        <div className="bg-surface-200 rounded-lg border border-green-500/30 p-4">
          <div className="text-center mb-4">
            <div className="flex items-center justify-center gap-3 mb-2">
              <div className="w-12 h-12 bg-white rounded-lg p-1">
                <img src={getTeamLogo(pendingAck.player.team)} alt="" className="w-full h-full object-contain" />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className={`w-5 h-5 rounded text-[10px] font-bold text-white flex items-center justify-center ${POS_COLORS[pendingAck.player.position] || 'bg-gray-500'}`}>
                    {pendingAck.player.position}
                  </span>
                  <span className="font-bold text-white">{pendingAck.player.name}</span>
                </div>
                <span className="text-xs text-gray-400">{pendingAck.player.team}</span>
              </div>
            </div>

            {pendingAck.winner ? (
              <div className="bg-green-500/10 rounded-lg p-3 border border-green-500/30">
                <p className="text-xs text-gray-400 mb-1">Aggiudicato a</p>
                <p className="text-lg font-bold text-green-400">{pendingAck.winner.username}</p>
                <p className="text-2xl font-black text-white">{pendingAck.finalPrice}</p>
              </div>
            ) : (
              <div className="bg-gray-500/10 rounded-lg p-3">
                <p className="text-gray-400">Nessuna offerta - Invenduto</p>
              </div>
            )}
          </div>

          {/* Progress conferme */}
          <div className="mb-3">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Conferme</span>
              <span>{pendingAck.totalAcknowledged}/{pendingAck.totalMembers}</span>
            </div>
            <div className="h-1.5 bg-surface-400 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 transition-all" style={{ width: `${ackPercent}%` }} />
            </div>
          </div>

          {/* Lista conferme */}
          <div className="grid grid-cols-2 gap-2 text-xs mb-3">
            <div>
              <p className="text-green-400 font-medium mb-1">Confermato</p>
              {pendingAck.acknowledgedMembers.map(m => (
                <p key={m.id} className="text-gray-300">{m.username}</p>
              ))}
            </div>
            <div>
              <p className="text-yellow-400 font-medium mb-1">In attesa</p>
              {pendingAck.pendingMembers.map(m => (
                <p key={m.id} className="text-gray-500">{m.username}</p>
              ))}
            </div>
          </div>

          {/* Pulsante conferma */}
          {!pendingAck.userAcknowledged ? (
            <button
              onClick={onAcknowledge}
              disabled={ackSubmitting}
              className="w-full py-2 rounded-lg font-bold text-sm bg-green-500 text-white hover:bg-green-400 disabled:opacity-50"
            >
              {ackSubmitting ? 'Conferma in corso...' : 'CONFERMA'}
            </button>
          ) : (
            <div className="text-center text-green-400 text-sm py-2">
              ✓ Hai confermato
            </div>
          )}
        </div>

        {/* Pannello Obiettivi */}
        <ObjectivesPanel />
      </div>
    )
  }

  // STATO: Ready Check (nomination pending)
  if (readyStatus?.hasPendingNomination && !auction) {
    const readyPercent = (readyStatus.readyCount / readyStatus.totalMembers) * 100
    return (
      <div className="space-y-3">
        {/* Header */}
        <div className="bg-surface-200 rounded-lg border border-accent-500/30 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg animate-pulse">🎯</span>
              <span className="font-bold text-accent-400 text-sm">READY CHECK</span>
            </div>
            <span className="text-xs text-gray-400">
              Nominato da: <strong className="text-white">{readyStatus.nominatorUsername}</strong>
            </span>
          </div>
        </div>

        {/* Player nominated */}
        {readyStatus.player && (
          <div className="bg-surface-200 rounded-lg border border-surface-50/20 p-4 text-center">
            <p className="text-xs text-gray-400 mb-2">Giocatore scelto</p>
            <div className="flex items-center justify-center gap-3">
              <span className={`w-6 h-6 rounded text-xs font-bold text-white flex items-center justify-center ${POS_COLORS[readyStatus.player.position] || 'bg-gray-500'}`}>
                {readyStatus.player.position}
              </span>
              <span className="text-xl font-bold text-white">{readyStatus.player.name}</span>
            </div>
            <p className="text-sm text-gray-400 mt-1">{readyStatus.player.team}</p>
          </div>
        )}

        {/* Progress */}
        <div className="bg-surface-200 rounded-lg border border-surface-50/20 p-3">
          <div className="flex justify-between text-xs text-gray-400 mb-2">
            <span>Manager pronti</span>
            <span className="font-bold text-white">{readyStatus.readyCount}/{readyStatus.totalMembers}</span>
          </div>
          <div className="h-2 bg-surface-400 rounded-full overflow-hidden mb-3">
            <div className="h-full bg-accent-500 transition-all" style={{ width: `${readyPercent}%` }} />
          </div>

          {/* Lista */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-green-400 font-medium mb-1">Pronti</p>
              {readyStatus.readyMembers.map(m => (
                <p key={m.id} className="text-gray-300">{m.username}</p>
              ))}
              {readyStatus.readyMembers.length === 0 && <p className="text-gray-500 italic">Nessuno</p>}
            </div>
            <div>
              <p className="text-yellow-400 font-medium mb-1">In attesa</p>
              {readyStatus.pendingMembers.map(m => (
                <p key={m.id} className="text-gray-500">{m.username}</p>
              ))}
            </div>
          </div>
        </div>

        {/* Pulsante Ready */}
        {readyStatus.nominatorConfirmed && !readyStatus.userIsReady && (
          <button
            onClick={onMarkReady}
            disabled={markingReady}
            className="w-full py-3 rounded-lg font-bold bg-accent-500 text-dark-900 hover:bg-accent-400 disabled:opacity-50"
          >
            {markingReady ? 'Attendi...' : 'SONO PRONTO'}
          </button>
        )}
        {readyStatus.userIsReady && (
          <div className="text-center text-green-400 text-sm py-2">
            ✓ Sei pronto - In attesa degli altri
          </div>
        )}
        {!readyStatus.nominatorConfirmed && readyStatus.userIsNominator && (
          <div className="text-center text-yellow-400 text-sm py-2">
            Conferma la tua scelta per avviare il ready check
          </div>
        )}

        {/* Pannello Obiettivi */}
        <ObjectivesPanel />
      </div>
    )
  }

  // STATO: Waiting (no auction, no nomination)
  if (!auction) {
    return (
      <div className="space-y-3">
        {/* Header Layout F */}
        <div className="bg-gradient-to-r from-accent-500/20 to-primary-500/20 rounded-lg border-2 border-accent-500 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🏆</span>
              <span className="font-bold text-accent-400 text-lg">LAYOUT PRO</span>
              {membership && (
                <span className="text-sm text-white ml-4">Budget: <strong className="text-accent-400">{membership.currentBudget}</strong></span>
              )}
            </div>
            <span className={`text-xs px-2 py-1 rounded ${isConnected ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
              {isConnected ? '● Live' : connectionStatus}
            </span>
          </div>
        </div>

        <div className="bg-surface-200 rounded-lg border border-surface-50/20 p-6 text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-surface-300 flex items-center justify-center">
            <span className="text-2xl">⏳</span>
          </div>
          <p className="text-gray-400 text-sm mb-2">In attesa della prossima nomination</p>
          {currentTurnManager && (
            <p className="text-primary-400 text-sm">
              Turno di: <strong>{currentTurnManager.username}</strong>
            </p>
          )}
          {isMyTurn && (
            <div className="mt-3 px-3 py-1.5 bg-accent-500/20 rounded-lg inline-block">
              <span className="text-accent-400 font-bold text-sm">È il tuo turno!</span>
            </div>
          )}
        </div>

        {/* Mini griglia manager */}
        <div className="bg-surface-200 rounded-lg border border-surface-50/20 overflow-hidden">
          <div className="px-3 py-2 bg-surface-300/50 border-b border-surface-50/20">
            <span className="text-xs font-bold text-gray-400 uppercase">Manager Online</span>
          </div>
          <div className="p-2 flex flex-wrap gap-1">
            {managersStatus?.managers.map(m => (
              <div
                key={m.id}
                className={`px-2 py-1 rounded text-xs ${
                  m.isCurrentTurn ? 'bg-accent-500/20 text-accent-400' :
                  m.id === managersStatus.myId ? 'bg-primary-500/20 text-primary-400' :
                  'bg-surface-300 text-gray-400'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full inline-block mr-1 ${m.isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                {m.username}
              </div>
            ))}
          </div>
        </div>

        {/* Lista Giocatori per Nomination - Solo se è il mio turno */}
        {isMyTurn && players && onNominatePlayer && (
          <div className="bg-surface-200 rounded-lg border-2 border-primary-500/50 overflow-hidden">
            <div className="px-3 py-2 bg-primary-500/10 border-b border-primary-500/30">
              <span className="text-sm font-bold text-primary-400">🎯 Nomina un Giocatore</span>
            </div>
            <div className="p-2">
              {/* Search */}
              {onSearchChange && (
                <input
                  type="text"
                  placeholder="Cerca giocatore..."
                  value={searchQuery || ''}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="w-full px-3 py-2 mb-2 bg-surface-300 border border-surface-50/30 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-primary-500"
                />
              )}
              {/* Player List */}
              <div className="max-h-[40vh] overflow-y-auto space-y-1">
                {players.length === 0 ? (
                  <p className="text-gray-500 text-center py-4 text-sm">Nessun giocatore disponibile</p>
                ) : (
                  players.slice(0, 30).map(player => (
                    <button
                      key={player.id}
                      onClick={() => onNominatePlayer(player.id)}
                      className="w-full flex items-center p-2 rounded-lg bg-surface-300 hover:bg-primary-500/20 border border-transparent hover:border-primary-500/30 transition-all text-left"
                    >
                      <span className={`w-6 h-6 rounded text-[10px] font-bold text-white flex items-center justify-center mr-2 ${POS_COLORS[player.position] || 'bg-gray-500'}`}>
                        {player.position}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white text-sm truncate">{player.name}</p>
                        <p className="text-xs text-gray-400 truncate">{player.team}</p>
                      </div>
                      {player.quotation && (
                        <span className="text-xs text-gray-500 ml-2">Q{player.quotation}</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Pannello Obiettivi */}
        <ObjectivesPanel />
      </div>
    )
  }

  // ==================== STATO: ASTA ATTIVA ====================
  return (
    <div className="space-y-2">
      {/* === ROW 1: Status Bar === */}
      <div className="bg-surface-200 rounded-lg border border-surface-50/20 px-3 py-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <span className={`flex items-center gap-1 ${isConnected ? 'text-green-400' : 'text-yellow-400'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-yellow-500'}`} />
            {isConnected ? 'Live' : connectionStatus}
          </span>
          {isMyTurn && (
            <span className="px-2 py-0.5 bg-accent-500 text-dark-900 rounded font-bold">TUO TURNO</span>
          )}
          {marketProgress && (
            <span className="text-gray-500">
              Fase: <strong className="text-gray-300">{POSITION_NAMES[marketProgress.currentRole]}</strong>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500">Budget:</span>
          <span className="font-mono font-bold text-accent-400">{membership?.currentBudget || 0}</span>
        </div>
      </div>

      {/* === ROW 2: Player + Timer + Price === */}
      <div className="bg-surface-200 rounded-lg border border-surface-50/20 p-3">
        <div className="flex items-center gap-3">
          {/* Timer */}
          <div className="text-center min-w-[60px]">
            <div className={`text-3xl font-mono font-bold ${timerColor}`}>{timeLeft ?? '--'}</div>
            <div className="h-1 bg-surface-400 rounded-full overflow-hidden mt-1">
              <div className={`h-full ${timerBg} transition-all`} style={{ width: `${timerPercent}%` }} />
            </div>
          </div>

          {/* Separator */}
          <div className="w-px h-12 bg-surface-50/20" />

          {/* Player */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-10 h-10 bg-white rounded p-1 flex-shrink-0">
              <img src={getTeamLogo(auction.player.team)} alt="" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className={`w-5 h-5 rounded text-[10px] font-bold text-white flex items-center justify-center flex-shrink-0 ${POS_COLORS[auction.player.position] || 'bg-gray-500'}`}>
                  {auction.player.position}
                </span>
                {playerTier && (
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${playerTier.bg} ${playerTier.color}`}>
                    {playerTier.tier}
                  </span>
                )}
                <span className="font-bold text-white text-sm truncate">{auction.player.name}</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-gray-400">
                <span>{auction.player.team}</span>
                {auction.player.quotation && <span>Q: {auction.player.quotation}</span>}
              </div>
            </div>
          </div>

          {/* Separator */}
          <div className="w-px h-12 bg-surface-50/20" />

          {/* Price */}
          <div className={`text-center px-3 py-1 rounded-lg min-w-[80px] ${isWinning ? 'bg-green-500/20' : 'bg-primary-500/10'}`}>
            <div className="text-2xl font-bold text-white">{auction.currentPrice}</div>
            <div className={`text-[10px] ${isWinning ? 'text-green-400' : 'text-gray-400'}`}>
              {winningBidder ? (isWinning ? 'Tua' : winningBidder.slice(0, 8)) : 'Base'}
            </div>
          </div>
        </div>
      </div>

      {/* === ROW 3: Main Grid === */}
      <div className="grid grid-cols-12 gap-2">
        {/* COL 1: Bid Controls */}
        <div className={`col-span-2 bg-surface-200 rounded-lg border overflow-hidden ${isSlotFull ? 'border-red-500/30' : 'border-surface-50/20'}`}>
          <div className={`px-2 py-1.5 border-b border-surface-50/20 text-center ${isSlotFull ? 'bg-red-500/10' : 'bg-surface-300/50'}`}>
            <span className="text-[10px] font-bold text-gray-400 uppercase">Offerta</span>
          </div>

          {isSlotFull ? (
            <div className="p-3 text-center">
              <div className="text-red-400 text-xl mb-1">🚫</div>
              <p className="text-[10px] text-red-400 font-medium">Slot {currentPlayerPosition}</p>
              <p className="text-[9px] text-gray-500">completo</p>
            </div>
          ) : (
            <div className="p-1.5 space-y-1.5">
              {/* Input */}
              <div className="flex items-center bg-surface-300 rounded overflow-hidden">
                <button
                  onClick={() => setBidAmount(String(Math.max(auction.currentPrice + 1, parseInt(bidAmount || '0') - 1)))}
                  disabled={!canBid}
                  className="w-6 h-7 text-white text-xs hover:bg-surface-200 disabled:opacity-50"
                >−</button>
                <input
                  type="number"
                  value={bidAmount}
                  onChange={e => setBidAmount(e.target.value)}
                  disabled={!canBid}
                  className="flex-1 min-w-0 bg-transparent text-center text-xs font-bold text-white outline-none"
                />
                <button
                  onClick={() => setBidAmount(String(parseInt(bidAmount || '0') + 1))}
                  disabled={!canBid}
                  className="w-6 h-7 text-white text-xs hover:bg-surface-200 disabled:opacity-50"
                >+</button>
              </div>

              {/* Quick buttons */}
              <div className="grid grid-cols-3 gap-0.5">
                {[1, 5, 10, 20, 50, 100].map(inc => {
                  const val = auction.currentPrice + inc
                  const ok = (membership?.currentBudget || 0) >= val
                  return (
                    <button
                      key={inc}
                      onClick={() => setBidAmount(String(val))}
                      disabled={!canBid || !ok}
                      className={`py-1 rounded text-[9px] font-bold ${ok && canBid ? 'bg-surface-300 text-gray-300 hover:bg-primary-500/30' : 'bg-surface-400/30 text-gray-600'}`}
                    >+{inc}</button>
                  )
                })}
              </div>

              {/* MAX + OFFRI */}
              <div className="flex gap-1">
                <button
                  onClick={() => setBidAmount(String(membership?.currentBudget || 0))}
                  disabled={!canBid}
                  className="flex-1 py-1 rounded text-[9px] font-bold bg-accent-500/20 text-accent-400 disabled:opacity-50"
                >MAX</button>
                <button
                  onClick={onPlaceBid}
                  disabled={!canBid || !membership || membership.currentBudget < (parseInt(bidAmount) || 0)}
                  className={`flex-[2] py-1 rounded font-bold text-[10px] ${!canBid ? 'bg-gray-600 text-gray-400' : 'bg-primary-500 text-white hover:bg-primary-400'}`}
                >{isTimerExpired ? 'SCADUTO' : 'OFFRI'}</button>
              </div>
            </div>
          )}
        </div>

        {/* COL 2: Managers Table */}
        <div className="col-span-5 bg-surface-200 rounded-lg border border-surface-50/20 overflow-hidden">
          <div className="px-2 py-1.5 bg-surface-300/50 border-b border-surface-50/20 flex justify-between">
            <span className="text-[10px] font-bold text-gray-400 uppercase">Manager</span>
            <span className="text-[10px] text-gray-500">{managersStatus?.managers.length}</span>
          </div>
          <div className="max-h-[200px] overflow-y-auto">
            <table className="w-full text-[10px]">
              <thead className="bg-surface-300/30 sticky top-0">
                <tr className="text-gray-500">
                  <th className="px-1.5 py-1 text-left">#</th>
                  <th className="px-1.5 py-1 text-left">Nome</th>
                  <th className="px-1.5 py-1 text-center">P</th>
                  <th className="px-1.5 py-1 text-center">D</th>
                  <th className="px-1.5 py-1 text-center">C</th>
                  <th className="px-1.5 py-1 text-center">A</th>
                  <th className="px-1.5 py-1 text-right">$</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-50/10">
                {managersStatus?.managers.map((m, i) => {
                  const isMe = m.id === managersStatus.myId
                  const isWin = winningBidder === m.username
                  const isTurn = m.isCurrentTurn
                  return (
                    <tr
                      key={m.id}
                      onClick={() => onSelectManager(m)}
                      className={`cursor-pointer ${isWin ? 'bg-green-500/10' : isTurn ? 'bg-accent-500/10' : isMe ? 'bg-primary-500/5' : 'hover:bg-surface-300/30'}`}
                    >
                      <td className="px-1.5 py-1">
                        <div className="flex items-center gap-0.5">
                          <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold ${isTurn ? 'bg-accent-500 text-dark-900' : 'bg-surface-400 text-gray-500'}`}>{i+1}</span>
                          <span className={`w-1 h-1 rounded-full ${m.isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                        </div>
                      </td>
                      <td className={`px-1.5 py-1 ${isMe ? 'text-primary-400 font-medium' : isWin ? 'text-green-400' : 'text-gray-200'}`}>
                        {m.username.slice(0, 10)}{isWin && ' 🏆'}
                      </td>
                      <td className={`px-1.5 py-1 text-center ${m.slotsByPosition.P.filled >= m.slotsByPosition.P.total ? 'text-green-400' : 'text-gray-500'}`}>{m.slotsByPosition.P.filled}</td>
                      <td className={`px-1.5 py-1 text-center ${m.slotsByPosition.D.filled >= m.slotsByPosition.D.total ? 'text-green-400' : 'text-gray-500'}`}>{m.slotsByPosition.D.filled}</td>
                      <td className={`px-1.5 py-1 text-center ${m.slotsByPosition.C.filled >= m.slotsByPosition.C.total ? 'text-green-400' : 'text-gray-500'}`}>{m.slotsByPosition.C.filled}</td>
                      <td className={`px-1.5 py-1 text-center ${m.slotsByPosition.A.filled >= m.slotsByPosition.A.total ? 'text-green-400' : 'text-gray-500'}`}>{m.slotsByPosition.A.filled}</td>
                      <td className={`px-1.5 py-1 text-right font-mono font-bold ${m.currentBudget > 300 ? 'text-green-400' : m.currentBudget > 100 ? 'text-yellow-400' : 'text-red-400'}`}>{m.currentBudget}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* COL 3: Bid History */}
        <div className="col-span-3 bg-surface-200 rounded-lg border border-surface-50/20 overflow-hidden">
          <div className="px-2 py-1.5 bg-surface-300/50 border-b border-surface-50/20 flex justify-between">
            <span className="text-[10px] font-bold text-gray-400 uppercase">Offerte</span>
            <span className="text-[10px] text-gray-500">{auction.bids.length}</span>
          </div>
          <div className="max-h-[200px] overflow-y-auto">
            {auction.bids.length > 0 ? (
              <table className="w-full text-[10px]">
                <tbody className="divide-y divide-surface-50/10">
                  {auction.bids.slice(0, 10).map((bid, i) => {
                    const isFirst = i === 0
                    const isMyBid = bid.bidder.user.username === currentUsername
                    const time = new Date(bid.placedAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                    return (
                      <tr key={bid.id} className={isFirst ? 'bg-primary-500/10' : ''}>
                        <td className="px-1.5 py-1 text-gray-500 font-mono">{time}</td>
                        <td className={`px-1.5 py-1 ${isMyBid ? 'text-primary-400' : isFirst ? 'text-white' : 'text-gray-300'}`}>{bid.bidder.user.username.slice(0, 8)}</td>
                        <td className="px-1.5 py-1 text-right font-mono font-bold text-white">{bid.amount}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : (
              <div className="p-3 text-center text-gray-500 text-[10px]">
                Nessuna offerta<br />Base: {auction.basePrice}
              </div>
            )}
          </div>
        </div>

        {/* COL 4: My Slots */}
        <div className="col-span-2 bg-surface-200 rounded-lg border border-surface-50/20 overflow-hidden">
          <div className="px-2 py-1.5 bg-surface-300/50 border-b border-surface-50/20">
            <span className="text-[10px] font-bold text-gray-400 uppercase">Rosa</span>
          </div>
          <div className="p-1.5 space-y-1">
            {myRosterSlots && (['P', 'D', 'C', 'A'] as const).map(pos => {
              const slot = myRosterSlots.slots[pos]
              const isCurrent = myRosterSlots.currentRole === pos
              const isComplete = slot.filled >= slot.total
              const pct = (slot.filled / slot.total) * 100
              return (
                <div key={pos} className={`p-1.5 rounded ${isCurrent ? 'bg-primary-500/20 ring-1 ring-primary-500' : 'bg-surface-300/30'}`}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={`w-4 h-4 rounded text-[9px] font-bold text-white flex items-center justify-center ${POS_COLORS[pos]}`}>{pos}</span>
                    <span className={`text-[10px] font-bold ${isComplete ? 'text-green-400' : 'text-gray-400'}`}>{slot.filled}/{slot.total}</span>
                  </div>
                  <div className="h-1 bg-surface-400 rounded-full overflow-hidden">
                    <div className={`h-full ${isComplete ? 'bg-green-500' : 'bg-primary-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* === ROW 4: Objectives Panel === */}
      {sessionId && (
        <div className="bg-surface-200 rounded-lg border border-surface-50/20 overflow-hidden">
          {/* Header collapsible */}
          <button
            onClick={() => setShowObjectives(!showObjectives)}
            className="w-full px-3 py-2 flex items-center justify-between hover:bg-surface-300/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">{isCurrentPlayerObjective ? '🎯' : '📋'}</span>
              <span className="text-xs font-bold text-gray-400 uppercase">Obiettivi</span>
              {summary && (
                <div className="flex items-center gap-1.5 text-[10px]">
                  <span className="px-1.5 py-0.5 rounded bg-accent-500/20 text-accent-400 font-bold">{summary.active} attivi</span>
                  {summary.acquired > 0 && <span className="px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">{summary.acquired} vinti</span>}
                  {summary.missed > 0 && <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">{summary.missed} persi</span>}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isCurrentPlayerObjective && currentPlayerObjective && (
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  currentPlayerObjective.priority === 1 ? 'bg-red-500/20 text-red-400' :
                  currentPlayerObjective.priority === 2 ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {currentPlayerObjective.priority === 1 ? 'PRIORITA ALTA' : currentPlayerObjective.priority === 2 ? 'PRIORITA MEDIA' : 'PRIORITA BASSA'}
                </span>
              )}
              <span className={`text-gray-500 transition-transform ${showObjectives ? 'rotate-180' : ''}`}>▼</span>
            </div>
          </button>

          {/* Panel content */}
          {showObjectives && (
            <div className="border-t border-surface-50/20 p-2">
              {objectivesLoading ? (
                <div className="text-center text-gray-500 text-xs py-2">Caricamento...</div>
              ) : objectives.filter(o => o.status === 'ACTIVE').length === 0 ? (
                <div className="text-center text-gray-500 text-xs py-2">
                  Nessun obiettivo attivo
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5">
                  {objectives.filter(o => o.status === 'ACTIVE').slice(0, 8).map(obj => (
                    <div
                      key={obj.id}
                      className={`p-1.5 rounded text-[10px] flex items-center justify-between gap-1 ${
                        auction?.player?.id === obj.playerId ? 'bg-accent-500/20 ring-1 ring-accent-500' : 'bg-surface-300/50'
                      }`}
                    >
                      <div className="flex items-center gap-1 min-w-0">
                        <span className={`w-4 h-4 rounded text-[8px] font-bold text-white flex items-center justify-center flex-shrink-0 ${POS_COLORS[obj.player.position] || 'bg-gray-500'}`}>
                          {obj.player.position}
                        </span>
                        <span className="truncate text-gray-200">{obj.player.name}</span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className={`w-4 h-4 rounded-full text-[8px] font-bold flex items-center justify-center ${
                          obj.priority === 1 ? 'bg-red-500 text-white' :
                          obj.priority === 2 ? 'bg-yellow-500 text-dark-900' :
                          'bg-gray-500 text-white'
                        }`}>{obj.priority}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteObjective(obj.id)
                          }}
                          className="text-gray-500 hover:text-red-400 text-xs"
                          title="Rimuovi obiettivo"
                        >×</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Quick action: add/remove current player */}
              {auction?.player && !isSlotFull && (
                <div className="mt-2 pt-2 border-t border-surface-50/10">
                  {isCurrentPlayerObjective ? (
                    <button
                      onClick={() => currentPlayerObjective && deleteObjective(currentPlayerObjective.id)}
                      className="w-full py-1.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 hover:bg-red-500/30"
                    >
                      Rimuovi {auction.player.name} dagli obiettivi
                    </button>
                  ) : (
                    <div className="flex gap-1">
                      <button
                        onClick={() => createObjective({ playerId: auction.player.id, priority: 1 })}
                        className="flex-1 py-1.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 hover:bg-red-500/30"
                      >Alta</button>
                      <button
                        onClick={() => createObjective({ playerId: auction.player.id, priority: 2 })}
                        className="flex-1 py-1.5 rounded text-[10px] font-bold bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30"
                      >Media</button>
                      <button
                        onClick={() => createObjective({ playerId: auction.player.id, priority: 3 })}
                        className="flex-1 py-1.5 rounded text-[10px] font-bold bg-gray-500/20 text-gray-400 hover:bg-gray-500/30"
                      >Bassa</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Admin Controls Panel */}
      {isAdmin && (
        <div className="mt-3">
          <AdminControlsPanel
            isAdmin={isAdmin}
            timerSetting={timerSetting}
            hasAuction={!!auction}
            onUpdateTimer={onUpdateTimer}
            onBotNominate={onBotNominate}
            onBotConfirmNomination={onBotConfirmNomination}
            onBotBid={onBotBid}
            onForceAllReady={onForceAllReady}
            onForceAcknowledgeAll={onForceAcknowledgeAll}
            onCompleteAllSlots={onCompleteAllSlots}
            onResetFirstMarket={onResetFirstMarket}
          />
        </div>
      )}
    </div>
  )
}

export default LayoutPro
