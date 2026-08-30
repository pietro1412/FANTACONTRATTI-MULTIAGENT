import { useState, useRef, useEffect, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { CockpitShell } from '@/components/cockpit/CockpitShell'
import { TimerDisplay } from '@/components/ui/TimerDisplay'
import { BidControlsShared } from '@/components/ui/BidControlsShared'
import { BidChips } from '@/components/ui/BidChips'
import { ManagerListRow } from '@/components/ui/ManagerListRow'
import { Monogram } from '@/components/ui/Monogram'
import { PlayerName } from '@/components/players/PlayerName'
import { PanelTabs } from '@/components/ui/PanelTabs'
import { AdminTestFab } from '../auction/AdminTestFab'
import { SvincolatiCockpitAdminBar, SvincolatiTestPanel } from './SvincolatiCockpitAdminBar'
import { FreeAgentTableRow } from './FreeAgentTableRow'
import { SvincolatiActivityFeed } from './SvincolatiActivityFeed'
import { SvincolatiStrategySummary } from './SvincolatiStrategySummary'
import { PreferenceModal } from '../rubata/PreferenceModal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { getTeamLogo } from '../../utils/teamLogos'
import { getPlayerPhotoUrl } from '../../utils/player-images'
import { NOT_DISPONIBILE, getAgeColor } from '../../utils/stat-format'
import { SERIE_A_TEAMS } from '../../types/svincolati.types'
import type { BoardState, Player, SvincolatiActivityItem, SvincolatiPreference, SvincolatiPrefsPlayer } from '../../types/svincolati.types'

/** Badge ruolo 46px stile mockup (P oro, D blu, C verde, A rosso) */
const ROLE_BADGE: Record<string, string> = {
  P: 'bg-accent-500/[0.14] text-accent-400 border border-accent-500/40',
  D: 'bg-primary-500/[0.14] text-primary-400 border border-primary-500/40',
  C: 'bg-secondary-500/[0.14] text-secondary-400 border border-secondary-500/40',
  A: 'bg-danger-500/[0.14] text-danger-400 border border-danger-500/40',
}
const POS_NAMES: Record<string, string> = { P: 'Portiere', D: 'Difensore', C: 'Centrocampista', A: 'Attaccante' }

type SortKey = 'age' | 'quotation' | 'appearances' | 'avgRating' | 'totalGoals' | 'totalAssists'

export interface SvincolatiCockpitProps {
  board: BoardState
  leagueId: string
  freeAgents: Player[]
  activityFeed: SvincolatiActivityItem[]
  // Strategie (watchlist/priorità/note)
  preferencesMap: Map<string, SvincolatiPreference>
  selectedPlayerForPrefs: SvincolatiPrefsPlayer | null
  onOpenPrefsModal: (player: SvincolatiPrefsPlayer) => void
  onClosePrefsModal: () => void
  onSavePreference: (data: { isWatchlist: boolean; isAutoPass: boolean; maxBid: number | null; priority: number | null; notes: string | null }) => Promise<void>
  onDeletePreference: () => Promise<void>
  onBulkSetPreference: (playerIds: string[], data: { isWatchlist?: boolean; isAutoPass?: boolean; maxBid?: number | null }) => Promise<void>
  onImportPreferences: (strategies: Array<{ playerId: string; isWatchlist: boolean; isAutoPass: boolean; maxBid: number | null; priority: number | null; notes: string | null }>) => Promise<void>
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
  minQuotation: string
  setMinQuotation: (v: string) => void
  maxQuotation: string
  setMaxQuotation: (v: string) => void
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
 * Sala asta svincolati a cockpit, allineata a Rubata: colonna sinistra 2fr
 * (arena + tab Bilanci/Attività/Strategie sotto — solo Bilanci per ora),
 * colonna destra 3fr = catalogo giocatori liberi (non un tabellone
 * sequenziale come Rubata: qui il turno può chiamare QUALSIASI giocatore
 * libero di qualsiasi ruolo, quindi la colonna destra è cercabile/ordinabile
 * invece che scorsa in sequenza). Mobile a colonna singola, invariato.
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

  // Ready check: pallino "pronto" per-riga sul pannello Direttori Generali (pattern
  // gia' adottato in Rubata per eliminare la striscia di avatar separata) — rilevante
  // solo durante NOMINATION dopo la conferma del nominatore.
  const readyRelevant = state === 'NOMINATION' && board.nominatorConfirmed

  // Stesso guard del backend (setSvincolatiPreference/deleteSvincolatiPreference):
  // non modificabili durante un'asta attiva.
  const canEditPreferences = state !== 'AUCTION'

  // Ordinamento colonna (client-side sull'array gia' caricato — capacita' nuova,
  // non presente nemmeno in Rubata, sensata qui perche' il pool e' un catalogo
  // da esplorare e non un tabellone a ordine fisso).
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const sortedFreeAgents = useMemo(() => {
    if (!sortKey) return freeAgents
    const dir = sortDir === 'asc' ? 1 : -1
    const getValue = (p: Player): number => {
      if (sortKey === 'age') return p.age ?? -Infinity
      if (sortKey === 'quotation') return p.quotation
      const stats = p.computedStats
      if (sortKey === 'appearances') return stats?.appearances ?? -Infinity
      if (sortKey === 'avgRating') return stats?.avgRating ?? -Infinity
      if (sortKey === 'totalGoals') return stats?.totalGoals ?? -Infinity
      return stats?.totalAssists ?? -Infinity
    }
    return [...freeAgents].sort((a, b) => (getValue(a) - getValue(b)) * dir)
  }, [freeAgents, sortKey, sortDir])

  const handleOpenPrefsModal = (p: Player & { preference: SvincolatiPreference | null }) => {
    props.onOpenPrefsModal({
      playerId: p.id,
      playerName: p.name,
      playerTeam: p.team,
      playerPosition: p.position as 'P' | 'D' | 'C' | 'A',
      playerAge: p.age,
      playerApiFootballId: p.apiFootballId,
      preference: p.preference,
    })
  }

  const handleSort = (key: SortKey) => {
    setSortKey(prevKey => {
      if (prevKey === key) {
        setSortDir(prevDir => prevDir === 'asc' ? 'desc' : 'asc')
        return key
      }
      setSortDir('desc')
      return key
    })
  }

  // Virtualizzazione sopra i 50 elementi — stessa soglia/config del tabellone Rubata.
  const listScrollRef = useRef<HTMLDivElement>(null)
  const rowCount = sortedFreeAgents.length
  const useVirtual = rowCount > 50
  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => listScrollRef.current,
    estimateSize: () => 52,
    overscan: 8,
    enabled: useVirtual,
  })

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
            hasActiveAuction={state === 'AUCTION' && !!auction}
            onCloseAuction={props.onCloseAuction}
          />
        </div>
      ) : undefined}
    >
      {/* grid-rows-[minmax(0,1fr)] + overflow-hidden: senza, la riga implicita "auto"
          cresce oltre h-full quando una colonna ha contenuto alto (es. rosa piena),
          e l'overflow-hidden di un antenato taglia il fondo di tutte le colonne
          invece di far scrollare solo quella interna (stesso bug di AuctionRoomLayout). */}
      <div className="mt-3 lg:mt-0 lg:pt-2 lg:h-full lg:min-h-0 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:grid-rows-[minmax(0,1fr)] lg:gap-3 lg:overflow-hidden">

        {/* ===== Sinistra: Arena + tab Bilanci ===== */}
        <div className="space-y-3 min-w-0 lg:space-y-0 lg:flex lg:flex-col lg:gap-3 lg:min-h-0">
          {/* READY_CHECK — tocca a te: scegli dalla tabella a destra */}
          {canNominate && (
            <div className="bg-surface-200 arena-gold rounded-xl p-5 text-center">
              <p className="micro-label text-accent-400 mb-2">È il tuo turno</p>
              <p className="font-display text-2xl font-bold text-white">Scegli chi chiamare</p>
              <p className="text-sm text-gray-400 mt-1">Seleziona un giocatore dalla tabella <b className="text-secondary-400">Giocatori liberi</b>.</p>
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
              <PlayerHead player={board.pendingPlayer} leagueId={props.leagueId} />

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
                  {/* Chi e' pronto si vede riga-per-riga nel pannello Direttori Generali
                      (readyDot su ManagerListRow) — niente striscia di avatar duplicata,
                      stesso decluttering gia' adottato in Rubata. */}
                  <p className="text-center text-xs text-gray-500">
                    Pronti {board.readyMembers.length}/{totalMembers}
                  </p>
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

          {/* AUCTION — arena bidding, stessa arena orizzontale di HeroPlayerCard
              (Rubata): identità a sinistra, prezzo/timer/azione a destra su
              desktop, invece di impilare tutto in un'unica colonna — a parità
              di contenuto occupa meno della metà dell'altezza verticale. */}
          {state === 'AUCTION' && auction && (
            <div className="bg-surface-200 arena-gold rounded-xl p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <p className="micro-label text-accent-400">Asta svincolato · in corso</p>
                {props.isUserWinning && (
                  <span className="text-xs font-bold text-secondary-400">Stai vincendo</span>
                )}
              </div>

              <div className="lg:grid lg:grid-cols-[1fr_1.05fr]">
                {/* ===== Colonna sinistra: identità ===== */}
                <div className="lg:pr-4 lg:min-w-0">
                  <PlayerHead player={auction.player} nominator={board.nominatorUsername} leagueId={props.leagueId} />
                </div>

                {/* ===== Colonna destra: prezzo/timer + controlli ===== */}
                <div className="lg:border-l lg:border-surface-50 lg:pl-4 lg:min-w-0 lg:flex lg:flex-col lg:gap-2.5">
                  {/* Box prezzo + timer sulla stessa riga (P1) */}
                  <div className="mt-3 lg:mt-0 flex items-center gap-5 bg-surface-300 border border-accent-500/40 rounded-xl px-4 py-3">
                    <div className="flex flex-col min-w-0">
                      <span className="font-mono text-[10px] font-bold tracking-[0.14em] uppercase text-accent-400 mb-1">Offerta attuale</span>
                      <span className="stat-number text-5xl lg:text-4xl leading-none text-accent-300" aria-live="polite">{auction.currentPrice}M</span>
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
                    <div className="mt-3 lg:mt-0 rounded-xl p-3 bg-warning-500/10 border border-warning-500/30 text-center">
                      <p className="text-warning-400 text-sm font-medium">Hai dichiarato di aver finito. Non puoi più fare offerte.</p>
                    </div>
                  ) : (
                    <>
                      <div className="mt-3 lg:mt-0">
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
                      </div>
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
              </div>
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

          {/* Direttori Generali (tab Bilanci su desktop, card diretta su mobile — nascosto
              su mobile durante un'asta attiva per lasciare spazio all'arena, stesso
              comportamento di prima) + footer "Ho finito", sempre visibile indipendentemente
              dalla tab attiva. */}
          <div className={`min-w-0 lg:min-h-0 lg:flex-1 lg:flex lg:flex-col lg:gap-2 ${auction ? 'hidden lg:flex lg:flex-col' : 'flex flex-col gap-3'}`}>
            <div className="hidden lg:flex lg:flex-col lg:flex-1 lg:min-h-0">
              <PanelTabs
                className="flex-1 min-h-0"
                scrollContent
                tabs={[
                  {
                    key: 'bilanci',
                    label: 'Bilanci',
                    content: (
                      <DirettoriGeneraliList
                        board={board}
                        readyRelevant={readyRelevant}
                        onViewManagerRoster={props.onViewManagerRoster}
                      />
                    ),
                  },
                  {
                    key: 'attivita',
                    label: 'Attività',
                    content: <SvincolatiActivityFeed items={props.activityFeed} />,
                  },
                  {
                    key: 'strategie',
                    label: 'Strategie',
                    content: (
                      <SvincolatiStrategySummary
                        freeAgents={freeAgents}
                        preferencesMap={props.preferencesMap}
                        onOpenPrefsModal={props.onOpenPrefsModal}
                        canEditPreferences={canEditPreferences}
                        onBulkSetPreference={props.onBulkSetPreference}
                        onImportPreferences={props.onImportPreferences}
                        isSubmitting={props.isSubmitting}
                      />
                    ),
                  },
                ]}
              />
            </div>
            <div className="lg:hidden bg-surface-200 border border-surface-50 rounded-xl overflow-hidden flex flex-col">
              <div className="px-3.5 py-2.5 border-b border-surface-50 flex-shrink-0">
                <h3 className="micro-label">Direttori Generali · turno e budget</h3>
              </div>
              <div className="panel-scroll">
                <DirettoriGeneraliList
                  board={board}
                  readyRelevant={readyRelevant}
                  onViewManagerRoster={props.onViewManagerRoster}
                />
              </div>
            </div>
            {/* Attività — su mobile non esistono tab, ripetuta in flusso sotto
                i Direttori Generali come fa Rubata con Attività/Strategie. */}
            {props.activityFeed.length > 0 && (
              <div className="lg:hidden bg-surface-200 border border-surface-50 rounded-xl overflow-hidden">
                <div className="px-3.5 py-2.5 border-b border-surface-50">
                  <h3 className="micro-label">Attività</h3>
                </div>
                <SvincolatiActivityFeed items={props.activityFeed} />
              </div>
            )}
            <div className="lg:hidden bg-surface-200 border border-surface-50 rounded-xl overflow-hidden">
              <div className="px-3.5 py-2.5 border-b border-surface-50">
                <h3 className="micro-label">Strategie</h3>
              </div>
              <SvincolatiStrategySummary
                freeAgents={freeAgents}
                preferencesMap={props.preferencesMap}
                onOpenPrefsModal={props.onOpenPrefsModal}
                canEditPreferences={canEditPreferences}
                onBulkSetPreference={props.onBulkSetPreference}
                onImportPreferences={props.onImportPreferences}
                isSubmitting={props.isSubmitting}
              />
            </div>

            <div className="bg-surface-200 border border-surface-50 rounded-xl px-3.5 py-2.5 flex-shrink-0">
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

        {/* ===== Destra: catalogo giocatori liberi ===== */}
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
              <div className="flex items-center gap-1.5">
                <span className="micro-label text-gray-500 flex-shrink-0">Quot.</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="Min"
                  value={props.minQuotation}
                  onChange={e => { props.setMinQuotation(e.target.value); }}
                  className="bg-surface-300 border-surface-50/30 text-white text-xs py-1.5"
                />
                <span className="text-gray-600" aria-hidden="true">–</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="Max"
                  value={props.maxQuotation}
                  onChange={e => { props.setMaxQuotation(e.target.value); }}
                  className="bg-surface-300 border-surface-50/30 text-white text-xs py-1.5"
                />
              </div>
            </div>

            {canNominate && (
              <div className="px-3.5 py-2 text-[10.5px] text-gray-400 border-b border-surface-50 bg-secondary-500/[0.04] flex-shrink-0">
                È il tuo turno: clicca un giocatore per <b className="text-secondary-400">chiamarlo</b>.
              </div>
            )}

            {/* Header colonne ordinabile (solo desktop, fuori dallo scroll cosi' resta fisso) */}
            <div className="hidden lg:grid svincolati-pool-grid px-3 py-2 border-b border-surface-50/20 bg-surface-300/40 flex-shrink-0">
              <span className="micro-label">Giocatore</span>
              <SortableHeader label="Età" sortKey="age" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
              <SortableHeader label="Quot." sortKey="quotation" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
              <SortableHeader label="Pres." sortKey="appearances" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
              <SortableHeader label="Media" sortKey="avgRating" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
              <SortableHeader label="Gol" sortKey="totalGoals" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
              <SortableHeader label="Ass." sortKey="totalAssists" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
              <span className="micro-label text-center">Azione</span>
            </div>

            <div ref={listScrollRef} className="panel-scroll flex-1 min-h-0">
              {sortedFreeAgents.length === 0 ? (
                <p className="text-gray-500 text-center text-sm py-6">Nessun giocatore trovato</p>
              ) : useVirtual ? (
                <div style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
                  {virtualizer.getVirtualItems().map(virtualRow => {
                    const player = sortedFreeAgents[virtualRow.index]
                    if (!player) return null
                    return (
                      <div
                        key={player.id}
                        ref={virtualizer.measureElement}
                        data-index={virtualRow.index}
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${virtualRow.start}px)` }}
                      >
                        <FreeAgentTableRow
                          player={player}
                          leagueId={props.leagueId}
                          nominable={canNominate && !props.isSubmitting}
                          onNominate={props.onNominate}
                          preference={props.preferencesMap.get(player.id)}
                          canEditPreferences={canEditPreferences}
                          onOpenPrefsModal={handleOpenPrefsModal}
                        />
                      </div>
                    )
                  })}
                </div>
              ) : (
                sortedFreeAgents.map(player => (
                  <FreeAgentTableRow
                    key={player.id}
                    player={player}
                    leagueId={props.leagueId}
                    nominable={canNominate && !props.isSubmitting}
                    onNominate={props.onNominate}
                    preference={props.preferencesMap.get(player.id)}
                    canEditPreferences={canEditPreferences}
                    onOpenPrefsModal={handleOpenPrefsModal}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modale Strategie: watchlist/priorità/note per un giocatore libero */}
      {props.selectedPlayerForPrefs && (
        <PreferenceModal
          player={props.selectedPlayerForPrefs}
          onClose={props.onClosePrefsModal}
          onSave={props.onSavePreference}
          onDelete={props.onDeletePreference}
          isSubmitting={props.isSubmitting}
        />
      )}

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

/* ── Etichetta colonna cliccabile per ordinare la tabella liberi ── */
function SortableHeader({ label, sortKey, activeKey, dir, onSort }: {
  label: string
  sortKey: SortKey
  activeKey: SortKey | null
  dir: 'asc' | 'desc'
  onSort: (key: SortKey) => void
}) {
  const isActive = activeKey === sortKey
  return (
    <button
      type="button"
      onClick={() => { onSort(sortKey); }}
      className={`micro-label text-center flex items-center justify-center gap-0.5 hover:text-white transition-colors ${isActive ? 'text-primary-400' : ''}`}
    >
      {label}
      {isActive && <span aria-hidden="true">{dir === 'asc' ? '▲' : '▼'}</span>}
    </button>
  )
}

/* ── Lista Direttori Generali (turno/budget/pronti) — riusata sia nella tab
   Bilanci desktop sia nella card diretta mobile, stesso markup di prima. ── */
function DirettoriGeneraliList({ board, readyRelevant, onViewManagerRoster }: {
  board: BoardState
  readyRelevant: boolean
  onViewManagerRoster: (member: BoardState['turnOrder'][number]) => void
}) {
  return (
    <>
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
        const readyDot = readyRelevant ? board.readyMembers.includes(member.id) : undefined
        return (
          <ManagerListRow
            key={member.id}
            name={member.username}
            isMe={isMe}
            isHolding={isCurrent}
            dim={dim}
            leadingBadge={badge}
            readyDot={readyDot}
            connectedDot={readyDot == null ? (member.isConnected ?? null) : null}
            statusLine={
              isCurrent ? (
                <span className="text-accent-400 font-semibold">Sta chiamando…</span>
              ) : member.hasPassed ? (
                <span className="text-accent-400 font-mono text-[9px] font-bold border border-accent-500/50 rounded px-1.5 py-px tracking-[0.05em]">PASS</span>
              ) : hasFinished ? (
                <span className="text-gray-400 font-mono text-[9px] font-bold border border-surface-50 rounded px-1.5 py-px tracking-[0.05em]">FINITO</span>
              ) : readyDot != null ? (
                readyDot ? <span className="text-secondary-400">Pronto</span> : <span className="text-gray-400">In attesa</span>
              ) : 'In gara'
            }
            bigValue={`${member.budget}M`}
            bigValueGold={isMe || isCurrent}
            onClick={() => { onViewManagerRoster(member); }}
            title="Clicca per vedere la rosa"
          />
        )
      })}
    </>
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

/* ── Testa giocatore: foto/badge ruolo 46px + nome cliccabile (Assioma 7) +
   squadra (+ chip nominatore) — stesso pattern di HeroPlayerCard in Rubata ── */
function PlayerHead({ player, nominator, leagueId }: { player: Player; nominator?: string | null; leagueId: string }) {
  return (
    <div className="flex items-center gap-3.5">
      {player.apiFootballId ? (
        <img
          src={getPlayerPhotoUrl(player.apiFootballId)}
          alt={player.name}
          className="w-[46px] h-[46px] rounded-full object-cover bg-surface-300 border-2 border-accent-500/60 flex-shrink-0"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      ) : (
        <span className={`w-[46px] h-[46px] rounded-[10px] flex items-center justify-center text-xl font-display font-extrabold flex-shrink-0 ${ROLE_BADGE[player.position] ?? ''}`}>
          {player.position}
        </span>
      )}
      {/* min-w-0 indispensabile: senza, un flex item con testo lungo si rifiuta di
          restringersi sotto la sua larghezza intrinseca e spinge fuori i fratelli
          invece di truncare — qui vogliamo l'opposto (il nome tronca se serve). */}
      <div className="min-w-0 flex-1">
        <PlayerName
          player={{ name: player.name, team: player.team, position: player.position, quotation: player.quotation, age: player.age }}
          leagueId={leagueId}
          leaguePlayerId={player.id}
          truncate
          className="font-display text-2xl lg:text-[26px] font-bold text-white leading-tight block text-left"
        />
        {/* Chip "chiamato da" spostato QUI (riga sottotitolo, che già va a capo da
            sola) invece che fratello diretto del nome: da fratello con flex-shrink-0
            "rubava" spazio al nome (flex-1) nella stessa riga prima che flex-wrap
            decidesse di mandarlo a capo, troncando il nome anche per chip larghi
            (es. "chiamato da Marcolino"). Stesso pattern di HeroPlayerCard in Rubata,
            che tiene l'equivalente chip "dalla rosa di" nella riga squadra/età. */}
        <p className="text-sm text-gray-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
          {POS_NAMES[player.position] || player.position}
          <span className="text-gray-600" aria-hidden="true">·</span>
          <span className="w-4 h-4 bg-white rounded p-px inline-flex items-center justify-center flex-shrink-0">
            <img src={getTeamLogo(player.team)} alt={player.team} className="w-3 h-3 object-contain" />
          </span>
          <b className="text-gray-200 font-semibold">{player.team}</b>
          <span className="text-gray-600" aria-hidden="true">·</span>
          <span className={`font-mono ${getAgeColor(player.age)}`}>{player.age != null ? `${player.age} anni` : NOT_DISPONIBILE}</span>
          {nominator && (
            <span className="inline-flex items-center gap-1.5 pl-1 pr-3 py-1 rounded-full bg-surface-300 border border-surface-50 text-xs text-gray-400 flex-shrink-0">
              <Monogram name={nominator} size="sm" />
              chiamato da <b className="text-gray-200 font-semibold">{nominator}</b>
            </span>
          )}
        </p>
      </div>
    </div>
  )
}
