import { useState, useRef, useEffect } from 'react'
import { CockpitShell } from '@/components/cockpit/CockpitShell'
import { TimerDisplay } from '@/components/ui/TimerDisplay'
import { BidControlsShared } from '@/components/ui/BidControlsShared'
import { BidChips } from '@/components/ui/BidChips'
import { ManagerListRow } from '@/components/ui/ManagerListRow'
import { MemberReadyChips } from '@/components/ui/MemberReadyChips'
import { Monogram } from '@/components/ui/Monogram'
import { AdminTestFab } from '../auction/AdminTestFab'
import { SvincolatiCockpitAdminBar, SvincolatiTestPanel } from './SvincolatiCockpitAdminBar'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { getTeamLogo } from '../../utils/teamLogos'
import { SERIE_A_TEAMS } from '../../types/svincolati.types'
import type { BoardState, Player } from '../../types/svincolati.types'

/** Badge ruolo 46px stile mockup (P oro, D blu, C verde, A rosso) */
const ROLE_BADGE: Record<string, string> = {
  P: 'bg-accent-500/[0.14] text-accent-400 border border-accent-500/40',
  D: 'bg-primary-500/[0.14] text-primary-400 border border-primary-500/40',
  C: 'bg-secondary-500/[0.14] text-secondary-400 border border-secondary-500/40',
  A: 'bg-danger-500/[0.14] text-danger-400 border border-danger-500/40',
}
const POS_NAMES: Record<string, string> = { P: 'Portiere', D: 'Difensore', C: 'Centrocampista', A: 'Attaccante' }

export interface SvincolatiCockpitProps {
  board: BoardState
  freeAgents: Player[]
  currentUsername: string | undefined
  isPusherConnected: boolean
  isSubmitting: boolean
  isTimerExpired: boolean
  isUserWinning: boolean
  timerRemaining: number | null
  // filtri lista liberi
  searchQuery: string
  setSearchQuery: (v: string) => void
  selectedPosition: string
  setSelectedPosition: (v: string) => void
  selectedTeam: string
  setSelectedTeam: (v: string) => void
  // offerta
  bidAmount: string
  setBidAmount: (v: string) => void
  // timer admin
  timerInput: number
  // handlers
  onNominate: (playerId: string) => void
  onConfirmNomination: () => void
  onCancelNomination: () => void
  onPassTurn: () => void
  onMarkReady: () => void
  onBid: () => void
  onCloseAuction: () => void
  onViewManagerRoster: (member: BoardState['turnOrder'][number]) => void
  onDeclareFinished: () => void
  onSetTimer: (seconds: number) => void
  onPause: () => void
  onResume: () => void
  onCompletePhase: () => void
  // test (dev only)
  onBotNominate: () => void
  onBotConfirmNomination: () => void
  onBotBid: () => void
  onForceReady: () => void
  onForceAck: () => void
  onForceAllFinished: () => void
}

/**
 * Sala asta svincolati a cockpit (mockup 06-svincolati): viewport bloccata su
 * desktop — testata + barra turni/admin + arena sempre visibili, scroll solo
 * dentro le colonne. Tre colonne: [Direttori Generali | arena | giocatori
 * liberi]. Peculiarità: asta a giro, "Ho finito", "Passo", lista liberi
 * cliccabile quando è il tuo turno. Mobile a colonna singola.
 */
export function SvincolatiCockpit(props: SvincolatiCockpitProps) {
  const { board, freeAgents } = props
  const state = board.state
  const isAdmin = board.isAdmin
  const auction = board.activeAuction

  // Dropdown filtro squadra: stato e click-outside locali (il ref non può
  // attraversare il confine di componente via props — react-hooks/refs)
  const [teamOpen, setTeamOpen] = useState(false)
  const teamRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!teamOpen) return
    const onDown = (e: MouseEvent) => {
      if (teamRef.current && !teamRef.current.contains(e.target as Node)) setTeamOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => { document.removeEventListener('mousedown', onDown); }
  }, [teamOpen])

  const finishedCount = board.finishedMembers.length
  const totalMembers = board.turnOrder.length
  const canNominate = state === 'READY_CHECK' && board.isMyTurn && !board.pendingPlayer

  // Ready check: chip pronti (P6) da turnOrder + readyMembers
  const readyDone = board.turnOrder.filter(m => board.readyMembers.includes(m.id)).map(m => ({ id: m.id, username: m.username }))
  const readyPending = board.turnOrder.filter(m => !board.readyMembers.includes(m.id)).map(m => ({ id: m.id, username: m.username }))

  return (
    <CockpitShell
      header={<SvincolatiHeader {...props} />}
      adminBar={isAdmin ? (
        <div className="hidden lg:block mt-2">
          <SvincolatiCockpitAdminBar
            state={state}
            isSubmitting={props.isSubmitting}
            finishedCount={finishedCount}
            totalMembers={totalMembers}
            timerInput={props.timerInput}
            onSetTimer={props.onSetTimer}
            onPause={props.onPause}
            onResume={props.onResume}
            onCompletePhase={props.onCompletePhase}
          />
        </div>
      ) : undefined}
    >
      <div className="mt-3 lg:mt-0 lg:pt-2 lg:h-full lg:min-h-0 lg:grid lg:grid-cols-[300px_minmax(0,1fr)_360px] lg:gap-3">

        {/* ===== Sinistra: Direttori Generali ===== */}
        <div className={`mb-3 lg:mb-0 lg:min-h-0 ${auction ? 'hidden lg:flex lg:flex-col' : 'flex flex-col'}`}>
          <div className="bg-surface-200 border border-surface-50 rounded-xl overflow-hidden flex flex-col h-full min-h-0">
            <div className="px-3.5 py-2.5 border-b border-surface-50 flex-shrink-0">
              <h3 className="micro-label">Direttori Generali · turno e budget</h3>
            </div>
            <div className="panel-scroll flex-1 min-h-0">
              {board.turnOrder.map((member, index) => {
                const isCurrent = board.currentTurnMemberId === member.id
                const isMe = member.id === board.myMemberId
                const hasFinished = board.finishedMembers.includes(member.id)
                const dim = member.hasPassed || hasFinished
                const badge = (
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center font-mono text-xs font-bold ${
                    isCurrent ? 'bg-accent-400 text-dark-300' : dim ? 'bg-surface-300 text-gray-500' : 'bg-surface-100 text-gray-400'
                  }`}>
                    {index + 1}
                  </span>
                )
                return (
                  <ManagerListRow
                    key={member.id}
                    name={member.username}
                    isMe={isMe}
                    isHolding={isCurrent}
                    dim={dim}
                    leadingBadge={badge}
                    connectedDot={member.isConnected ?? null}
                    statusLine={
                      isCurrent ? (
                        <span className="text-accent-400 font-semibold">Sta chiamando…</span>
                      ) : member.hasPassed ? (
                        <span className="text-accent-400 font-mono text-[9px] font-bold border border-accent-500/50 rounded px-1.5 py-px tracking-[0.05em]">PASS</span>
                      ) : hasFinished ? (
                        <span className="text-gray-400 font-mono text-[9px] font-bold border border-surface-50 rounded px-1.5 py-px tracking-[0.05em]">FINITO</span>
                      ) : 'In gara'
                    }
                    bigValue={`${member.budget}M`}
                    bigValueGold={isMe || isCurrent}
                    onClick={() => { props.onViewManagerRoster(member); }}
                    title="Clicca per vedere la rosa"
                  />
                )
              })}
            </div>
            {/* "Ho finito" + progresso */}
            <div className="px-3.5 py-2.5 border-t border-surface-50 flex-shrink-0">
              {board.isFinished ? (
                <p className="text-center text-xs text-gray-400">Hai dichiarato di aver finito · non fai più offerte</p>
              ) : (
                <button
                  type="button"
                  onClick={props.onDeclareFinished}
                  disabled={props.isSubmitting}
                  className="w-full text-xs font-semibold text-danger-400 border border-danger-500/40 bg-danger-500/[0.06] rounded-[9px] py-2 hover:bg-danger-500/15 transition-colors disabled:opacity-40"
                >
                  Ho finito — non faccio più offerte
                </button>
              )}
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-1 rounded-full bg-surface-50 overflow-hidden">
                  <div className="h-full progress-gradient" style={{ width: `${totalMembers > 0 ? (finishedCount / totalMembers) * 100 : 0}%` }} />
                </div>
                <span className="font-mono text-[10px] text-gray-500">{finishedCount}/{totalMembers} finiti</span>
              </div>
            </div>
          </div>
        </div>

        {/* ===== Centro: Arena ===== */}
        <div className="space-y-3 min-w-0 lg:space-y-0 lg:flex lg:flex-col lg:gap-3 lg:min-h-0">
          {/* READY_CHECK — tocca a te: scegli dalla lista a destra */}
          {canNominate && (
            <div className="bg-surface-200 arena-gold rounded-xl p-5 text-center">
              <p className="micro-label text-accent-400 mb-2">È il tuo turno</p>
              <p className="font-display text-2xl font-bold text-white">Scegli chi chiamare</p>
              <p className="text-sm text-gray-400 mt-1">Seleziona un giocatore dalla lista <b className="text-secondary-400">Giocatori liberi</b> a destra.</p>
              <button
                type="button"
                onClick={props.onPassTurn}
                disabled={props.isSubmitting}
                className="mt-4 text-xs font-semibold text-warning-400 border border-warning-500/40 bg-warning-500/[0.07] rounded-[9px] px-4 py-2 hover:bg-warning-500/15 transition-colors disabled:opacity-40"
              >
                Passo — non chiamo più
              </button>
            </div>
          )}

          {/* READY_CHECK — attesa turno altrui */}
          {state === 'READY_CHECK' && !board.isMyTurn && !board.pendingPlayer && (
            <div className="bg-surface-200 border border-surface-50 rounded-xl p-8 text-center">
              <p className="text-gray-400">In attesa…</p>
              <p className="text-sm text-gray-500 mt-1">Turno di <b className="text-primary-400">{board.currentTurnUsername}</b></p>
            </div>
          )}

          {/* NOMINATION — conferma scelta + ready check */}
          {(state === 'NOMINATION' || (state === 'READY_CHECK' && board.pendingPlayer)) && board.pendingPlayer && (
            <div className="bg-surface-200 arena-gold rounded-xl p-5">
              <p className="micro-label text-accent-400 mb-3">
                {board.pendingNominatorId === board.myMemberId && !board.nominatorConfirmed ? 'Conferma la tua scelta' : `${board.nominatorUsername ?? ''} ha chiamato`}
              </p>
              <PlayerHead player={board.pendingPlayer} />

              {board.pendingNominatorId === board.myMemberId && !board.nominatorConfirmed && (
                <div className="mt-4 flex gap-3">
                  <Button onClick={props.onConfirmNomination} disabled={props.isSubmitting} className="flex-1 py-3 font-bold">
                    {props.isSubmitting ? 'Attendi…' : 'Conferma'}
                  </Button>
                  <Button onClick={props.onCancelNomination} variant="outline" className="border-gray-500 text-gray-300 px-6 py-3">
                    Cambia
                  </Button>
                </div>
              )}

              {board.nominatorConfirmed && (
                <div className="mt-4 space-y-3">
                  <MemberReadyChips done={readyDone} pending={readyPending} doneLabel="pronto" variant="strip" />
                  {board.pendingNominatorId !== board.myMemberId ? (
                    !board.readyMembers.includes(board.myMemberId) ? (
                      <Button onClick={props.onMarkReady} disabled={props.isSubmitting} className="w-full py-3 font-bold">
                        {props.isSubmitting ? 'Attendi…' : 'Sono pronto'}
                      </Button>
                    ) : (
                      <p className="text-center text-secondary-400 font-medium text-sm">✓ Pronto — in attesa degli altri</p>
                    )
                  ) : (
                    <p className="text-center text-secondary-400 font-medium text-sm">✓ Confermato — in attesa degli altri</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* AUCTION — arena bidding */}
          {state === 'AUCTION' && auction && (
            <div className="bg-surface-200 arena-gold rounded-xl p-4 lg:flex-1 lg:min-h-0 lg:flex lg:flex-col lg:gap-3 panel-scroll">
              <div className="flex items-center justify-between gap-2">
                <p className="micro-label text-accent-400">Asta svincolato · in corso</p>
                {props.isUserWinning && (
                  <span className="text-xs font-bold text-secondary-400">Stai vincendo</span>
                )}
              </div>

              <PlayerHead player={auction.player} nominator={board.nominatorUsername} />

              {/* Box prezzo + timer (P1) */}
              <div className="flex items-center gap-5 bg-surface-300 border border-accent-500/40 rounded-xl px-4 py-3">
                <div className="flex flex-col min-w-0">
                  <span className="font-mono text-[10px] font-bold tracking-[0.14em] uppercase text-accent-400 mb-1">Offerta attuale</span>
                  <span className="stat-number text-5xl leading-none text-accent-300" aria-live="polite">{auction.currentPrice}M</span>
                  {auction.bids[0] ? (
                    <span className="mt-1.5 inline-flex items-center gap-1.5 text-[12.5px] text-gray-400">
                      <Monogram name={auction.bids[0].bidder} size="sm" />
                      {auction.bids[0].bidder === props.currentUsername
                        ? <b className="text-secondary-400 font-semibold">offerta tua — stai vincendo</b>
                        : <>di <b className="text-white font-semibold">{auction.bids[0].bidder}</b></>}
                    </span>
                  ) : (
                    <span className="mt-1.5 text-[12.5px] text-gray-400">Base d&apos;asta: <b className="text-white font-mono font-semibold">{auction.basePrice}M</b></span>
                  )}
                </div>
                {auction.timerExpiresAt && (
                  <TimerDisplay
                    seconds={props.timerRemaining}
                    totalSeconds={auction.timerSeconds ?? props.timerInput}
                    size={44}
                    className="ml-auto"
                  />
                )}
              </div>

              {/* Controlli offerta (P3) */}
              {board.isFinished ? (
                <div className="rounded-xl p-3 bg-warning-500/10 border border-warning-500/30 text-center">
                  <p className="text-warning-400 text-sm font-medium">Hai dichiarato di aver finito. Non puoi più fare offerte.</p>
                </div>
              ) : (
                <>
                  <BidControlsShared
                    bidAmount={parseInt(props.bidAmount || '0') || 0}
                    setBidAmount={n => { props.setBidAmount(String(n)); }}
                    onPlaceBid={props.onBid}
                    currentPrice={auction.currentPrice}
                    budget={board.myBudget}
                    budgetLabel="budget"
                    isSubmitting={props.isSubmitting}
                    isDisabled={props.isTimerExpired}
                    disabledLabel="Scaduto"
                    isConnected={props.isPusherConnected}
                    actionLabel="Offri"
                  />
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={props.onCloseAuction}
                      className="text-xs font-semibold text-gray-300 border border-surface-50 bg-surface-300 rounded-[9px] py-1.5 hover:bg-surface-100 transition-colors"
                    >
                      Chiudi asta manualmente
                    </button>
                  )}
                </>
              )}

              {/* Ultime offerte a chip (P4) */}
              {auction.bids.length > 0 && (
                <BidChips
                  label="Ultime offerte"
                  bids={auction.bids.slice(0, 10).map((b, i) => ({
                    id: `${b.bidderId}-${b.amount}-${i}`,
                    name: b.bidder,
                    amount: b.amount,
                    isMine: b.bidder === props.currentUsername,
                  }))}
                />
              )}
            </div>
          )}

          {/* PENDING_ACK — il modale è overlay */}
          {state === 'PENDING_ACK' && board.pendingAck && (
            <div className="bg-surface-200 border border-surface-50 rounded-xl p-8 text-center">
              <div className="w-12 h-12 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-gray-400">Conferma transazione in corso…</p>
            </div>
          )}

          {/* PAUSED */}
          {state === 'PAUSED' && (
            <div className="bg-surface-200 border border-warning-500/40 rounded-xl p-8 text-center">
              <p className="font-display text-lg font-bold text-warning-400">Fase in pausa</p>
              <p className="text-sm text-gray-400 mt-1">L&apos;admin riprenderà a breve.</p>
            </div>
          )}

          {/* COMPLETED */}
          {state === 'COMPLETED' && (
            <div className="bg-surface-200 border border-secondary-500/30 rounded-xl p-8 text-center">
              <p className="font-display text-lg font-bold text-secondary-300">Fase Svincolati completata!</p>
              <p className="text-sm text-gray-400 mt-1">Tutti i manager hanno terminato le chiamate.</p>
            </div>
          )}
        </div>

        {/* ===== Destra: Giocatori liberi ===== */}
        <div className={`mt-3 lg:mt-0 lg:min-h-0 ${auction ? 'hidden lg:flex lg:flex-col' : 'flex flex-col'}`}>
          <div className="bg-surface-200 border border-surface-50 rounded-xl overflow-hidden flex flex-col h-full min-h-0">
            <div className="px-3.5 py-2.5 border-b border-surface-50 flex flex-col gap-2 flex-shrink-0">
              <div className="flex items-baseline gap-2">
                <h3 className="micro-label">Giocatori liberi</h3>
                <span className="ml-auto font-mono text-[10.5px] text-gray-500">{freeAgents.length} disponibili</span>
              </div>
              <Input
                type="text"
                placeholder="Cerca giocatore…"
                value={props.searchQuery}
                onChange={e => { props.setSearchQuery(e.target.value); }}
                className="bg-surface-300 border-surface-50/30 text-white text-sm"
              />
              <div className="flex items-center gap-1.5 flex-wrap">
                {(['', 'P', 'D', 'C', 'A'] as const).map(pos => (
                  <button
                    key={pos || 'all'}
                    type="button"
                    onClick={() => { props.setSelectedPosition(pos); }}
                    className={`font-mono text-[9.5px] font-bold rounded-full border px-2.5 py-1 transition-colors ${
                      props.selectedPosition === pos
                        ? 'text-dark-300 bg-accent-400 border-accent-400'
                        : 'text-gray-400 bg-surface-300 border-surface-50 hover:text-white'
                    }`}
                  >
                    {pos || 'Tutti'}
                  </button>
                ))}
                <div className="relative ml-auto" ref={teamRef}>
                  <button
                    type="button"
                    onClick={() => { setTeamOpen(!teamOpen); }}
                    className="font-mono text-[9.5px] font-bold rounded-full border border-surface-50 bg-surface-300 text-gray-400 px-2.5 py-1 flex items-center gap-1 hover:text-white transition-colors"
                  >
                    {props.selectedTeam || 'Squadra'} ▾
                  </button>
                  {teamOpen && (
                    <div className="absolute top-full right-0 mt-1 bg-surface-200 border border-surface-50/30 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto min-w-[160px]">
                      <button
                        type="button"
                        onClick={() => { props.setSelectedTeam(''); setTeamOpen(false); }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-300 ${!props.selectedTeam ? 'bg-primary-500/20 text-primary-400' : 'text-white'}`}
                      >
                        Tutte le squadre
                      </button>
                      {SERIE_A_TEAMS.map(team => (
                        <button
                          key={team}
                          type="button"
                          onClick={() => { props.setSelectedTeam(team); setTeamOpen(false); }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-300 flex items-center gap-2 ${props.selectedTeam === team ? 'bg-primary-500/20 text-primary-400' : 'text-white'}`}
                        >
                          <span className="w-5 h-5 bg-white/90 rounded flex items-center justify-center p-0.5 flex-shrink-0">
                            <img src={getTeamLogo(team)} alt={team} className="w-4 h-4 object-contain" />
                          </span>
                          {team}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {canNominate && (
              <div className="px-3.5 py-2 text-[10.5px] text-gray-400 border-b border-surface-50 bg-secondary-500/[0.04] flex-shrink-0">
                È il tuo turno: clicca un giocatore per <b className="text-secondary-400">chiamarlo</b>.
              </div>
            )}

            <div className="panel-scroll flex-1 min-h-0">
              {freeAgents.length === 0 ? (
                <p className="text-gray-500 text-center text-sm py-6">Nessun giocatore trovato</p>
              ) : (
                freeAgents.slice(0, 80).map(player => (
                  <button
                    key={player.id}
                    type="button"
                    onClick={canNominate ? () => { props.onNominate(player.id); } : undefined}
                    disabled={!canNominate || props.isSubmitting}
                    className={`w-full flex items-center gap-3 px-3.5 py-2 border-b border-surface-50/40 text-left transition-colors ${
                      canNominate ? 'hover:bg-hover cursor-pointer' : 'cursor-default'
                    }`}
                  >
                    <span className={`w-[30px] h-[30px] rounded-lg flex items-center justify-center font-display font-extrabold text-[13px] flex-shrink-0 ${ROLE_BADGE[player.position] ?? ''}`}>
                      {player.position}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-display font-bold text-[13.5px] text-white truncate">{player.name}</span>
                      <span className="block text-[11px] text-gray-500 truncate">{player.team}</span>
                    </span>
                    {canNominate && (
                      <span className="font-mono text-[9.5px] font-bold text-secondary-400 border border-secondary-500/40 bg-secondary-500/[0.08] rounded-md px-2 py-1 flex-shrink-0">
                        Chiama
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Controlli admin di TEST in floating button (solo dev) */}
      <AdminTestFab isAdmin={isAdmin}>
        <SvincolatiTestPanel
          state={state}
          isSubmitting={props.isSubmitting}
          hasAuction={!!auction}
          nominatorConfirmed={board.nominatorConfirmed}
          allFinished={finishedCount >= totalMembers}
          onBotNominate={props.onBotNominate}
          onBotConfirmNomination={props.onBotConfirmNomination}
          onBotBid={props.onBotBid}
          onForceReady={props.onForceReady}
          onForceAck={props.onForceAck}
          onForceAllFinished={props.onForceAllFinished}
        />
      </AdminTestFab>
    </CockpitShell>
  )
}

/* ── Testata cockpit (identità fase + turno + budget) ── */
function SvincolatiHeader({ board, isPusherConnected }: SvincolatiCockpitProps) {
  return (
    <div className="bg-surface-200 border border-surface-50 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap min-h-[56px]">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-secondary-500 to-secondary-700 flex items-center justify-center flex-shrink-0">
        <span className="text-lg" aria-hidden="true">🔓</span>
      </div>
      <div className="flex flex-col min-w-0">
        <h1 className="font-display font-bold text-sm sm:text-base text-white leading-tight">Asta Svincolati</h1>
        <span className="text-sm text-gray-500 leading-tight">
          {board.state === 'COMPLETED' ? 'Fase completata' : 'Mercato libero'}
        </span>
      </div>

      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-semibold border ${
        isPusherConnected ? 'bg-secondary-500/10 border-secondary-500/30 text-secondary-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-400 animate-pulse'
      }`}>
        <span className={isPusherConnected ? 'dot-live bg-secondary-500 shadow-[0_0_8px_theme(colors.secondary.500)]' : 'w-1.5 h-1.5 rounded-full bg-amber-400'} />
        {isPusherConnected ? 'Connesso' : 'Disconnesso'}
      </span>

      {board.currentTurnUsername && board.state !== 'COMPLETED' && (
        board.isMyTurn ? (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-sm font-bold border bg-accent-500/15 border-accent-500/40 text-accent-400 uppercase tracking-wide">
            Tocca a te
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm border bg-surface-300 border-surface-50 text-gray-400 uppercase tracking-wide font-semibold">
            <Monogram name={board.currentTurnUsername} size="sm" />
            Turno di <strong className="text-white normal-case">{board.currentTurnUsername}</strong>
          </span>
        )
      )}

      <div className="ml-auto flex flex-col items-end">
        <span className="text-sm text-gray-500 uppercase tracking-wider font-semibold leading-none">Budget</span>
        <span className="budget-display text-xl sm:text-2xl font-black text-accent-400 leading-tight">
          {board.myBudget}<span className="text-sm text-gray-500 font-semibold">M</span>
        </span>
      </div>
    </div>
  )
}

/* ── Testa giocatore: badge ruolo 46px + nome + squadra (+ chip nominatore) ── */
function PlayerHead({ player, nominator }: { player: Player; nominator?: string | null }) {
  return (
    <div className="flex items-center gap-3.5 flex-wrap">
      <span className={`w-[46px] h-[46px] rounded-[10px] flex items-center justify-center text-xl font-display font-extrabold flex-shrink-0 ${ROLE_BADGE[player.position] ?? ''}`}>
        {player.position}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-2xl lg:text-[26px] font-bold text-white leading-tight truncate">{player.name}</p>
        <p className="text-sm text-gray-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
          {POS_NAMES[player.position] || player.position}
          <span className="text-gray-600" aria-hidden="true">·</span>
          <span className="w-4 h-4 bg-white rounded p-px inline-flex items-center justify-center flex-shrink-0">
            <img src={getTeamLogo(player.team)} alt={player.team} className="w-3 h-3 object-contain" />
          </span>
          <b className="text-gray-200 font-semibold">{player.team}</b>
        </p>
      </div>
      {nominator && (
        <span className="inline-flex items-center gap-1.5 pl-1 pr-3 py-1 rounded-full bg-surface-300 border border-surface-50 text-xs text-gray-400 flex-shrink-0">
          <Monogram name={nominator} size="sm" />
          chiamato da <b className="text-gray-200 font-semibold">{nominator}</b>
        </span>
      )}
    </div>
  )
}
