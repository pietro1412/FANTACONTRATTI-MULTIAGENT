import { useState } from 'react'
import { Play, Pause, SkipBack, SkipForward, Check, Bell } from 'lucide-react'
import { BotSimulationPanel } from './RubataAdminControls'
import type { LeagueMember, ActiveAuction, RubataStateType } from '../../types/rubata.types'

const OFFER_PRESETS = [15, 30, 45, 60]
const AUCTION_PRESETS = [10, 15, 20, 30]

export interface RubataCockpitAdminBarProps {
  rubataState: RubataStateType
  isSubmitting: boolean
  currentIndex: number | null
  onStartRubata: () => void
  onPause: () => void
  onResume: () => void
  onAdvance: () => void
  onGoBack: () => void
  onCloseAuction: () => void
  onCompleteRubata: () => void
  offerTimer: number
  setOfferTimer: (v: number | ((prev: number) => number)) => void
  auctionTimer: number
  setAuctionTimer: (v: number | ((prev: number) => number)) => void
  onUpdateTimers: () => void
  // Bot simulation (overlay)
  activeAuction: ActiveAuction | null
  members: LeagueMember[]
  myMemberId: string | undefined
  currentPlayerMemberId: string | undefined
  simulateMemberId: string
  setSimulateMemberId: (v: string) => void
  simulateBidAmount: number
  setSimulateBidAmount: (v: number | ((prev: number) => number)) => void
  onSimulateOffer: () => void
  onSimulateBid: () => void
}

const ABTN = 'text-[11.5px] font-semibold rounded-[7px] border px-2.5 py-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1'
const ABTN_NEUTRAL = `${ABTN} text-gray-200 border-surface-50 bg-surface-200 hover:bg-surface-100`
const ABTN_GOLD = `${ABTN} text-accent-400 border-accent-500/50 bg-accent-500/[0.07] hover:bg-accent-500/15`
const ABTN_DANGER = `${ABTN} text-danger-400 border-danger-500/50 bg-danger-500/[0.06] hover:bg-danger-500/15`

/**
 * P7 — Barra admin della rubata SEMPRE visibile e compatta (cockpit, solo
 * desktop): conduzione (avvia/pausa/avanza/indietro/chiudi) · preset timer
 * con salvataggio · Completa fase in outline danger · bot di simulazione
 * in overlay. Sostituisce il pannello a chevron/collasso.
 */
export function RubataCockpitAdminBar({
  rubataState,
  isSubmitting,
  currentIndex,
  onStartRubata,
  onPause,
  onResume,
  onAdvance,
  onGoBack,
  onCloseAuction,
  onCompleteRubata,
  offerTimer,
  setOfferTimer,
  auctionTimer,
  setAuctionTimer,
  onUpdateTimers,
  activeAuction,
  members,
  myMemberId,
  currentPlayerMemberId,
  simulateMemberId,
  setSimulateMemberId,
  simulateBidAmount,
  setSimulateBidAmount,
  onSimulateOffer,
  onSimulateBid,
}: RubataCockpitAdminBarProps) {
  const [timersDirty, setTimersDirty] = useState(false)
  const [botOpen, setBotOpen] = useState(false)

  const showStart = rubataState === 'WAITING' || rubataState === 'PREVIEW'
  const showResume = rubataState === 'PAUSED'
  const showPlayControls = rubataState === 'OFFERING' || rubataState === 'AUCTION'
  const showBot = rubataState === 'OFFERING' || rubataState === 'AUCTION'

  return (
    <div className="relative flex items-center gap-2 flex-wrap bg-surface-300 border border-surface-50 rounded-xl px-3 py-1.5 min-h-[40px]">
      <span className="micro-label">Azioni admin</span>

      {/* Conduzione */}
      {showStart && (
        <button type="button" onClick={onStartRubata} disabled={isSubmitting} className={ABTN_GOLD}>
          <Play size={12} aria-hidden="true" /> Avvia rubata
        </button>
      )}
      {showResume && (
        <button type="button" onClick={onResume} disabled={isSubmitting} className={ABTN_GOLD}>
          <Bell size={12} aria-hidden="true" /> Richiedi pronti
        </button>
      )}
      {showPlayControls && (
        <>
          <button type="button" onClick={onPause} disabled={isSubmitting} className={ABTN_NEUTRAL}>
            <Pause size={12} aria-hidden="true" /> Pausa
          </button>
          <button type="button" onClick={onGoBack} disabled={isSubmitting || currentIndex === 0} className={ABTN_NEUTRAL}>
            <SkipBack size={12} aria-hidden="true" /> Indietro
          </button>
          {rubataState === 'OFFERING' && (
            <button type="button" onClick={onAdvance} disabled={isSubmitting} className={ABTN_NEUTRAL}>
              <SkipForward size={12} aria-hidden="true" /> Avanza
            </button>
          )}
          {rubataState === 'AUCTION' && (
            <button type="button" onClick={onCloseAuction} disabled={isSubmitting} className={ABTN_GOLD}>
              <Check size={12} aria-hidden="true" /> Chiudi asta
            </button>
          )}
        </>
      )}

      <span className="w-px h-4 bg-surface-50" aria-hidden="true" />

      {/* Preset timer: offerta + asta, con salvataggio esplicito */}
      <span className="flex items-center gap-1">
        <span className="micro-label tracking-[0.08em]">Offerta</span>
        {OFFER_PRESETS.map(sec => (
          <button
            key={sec}
            type="button"
            onClick={() => { setOfferTimer(sec); setTimersDirty(true); }}
            className={`font-mono text-[10.5px] font-bold rounded-[7px] border px-2 py-1 transition-colors ${
              offerTimer === sec
                ? 'text-dark-300 bg-accent-400 border-accent-400'
                : 'text-gray-300 bg-surface-200 border-surface-50 hover:text-white'
            }`}
          >
            {sec}s
          </button>
        ))}
      </span>
      <span className="flex items-center gap-1">
        <span className="micro-label tracking-[0.08em]">Asta</span>
        {AUCTION_PRESETS.map(sec => (
          <button
            key={sec}
            type="button"
            onClick={() => { setAuctionTimer(sec); setTimersDirty(true); }}
            className={`font-mono text-[10.5px] font-bold rounded-[7px] border px-2 py-1 transition-colors ${
              auctionTimer === sec
                ? 'text-dark-300 bg-accent-400 border-accent-400'
                : 'text-gray-300 bg-surface-200 border-surface-50 hover:text-white'
            }`}
          >
            {sec}s
          </button>
        ))}
      </span>
      {timersDirty && (
        <button
          type="button"
          onClick={() => { onUpdateTimers(); setTimersDirty(false); }}
          disabled={isSubmitting}
          className={ABTN_GOLD}
        >
          Salva timer
        </button>
      )}

      <span className="w-px h-4 bg-surface-50" aria-hidden="true" />

      {/* Bot di simulazione in overlay */}
      {showBot && (
        <button
          type="button"
          onClick={() => { setBotOpen(prev => !prev); }}
          aria-expanded={botOpen}
          className={ABTN_NEUTRAL}
        >
          Simula bot {botOpen ? '▲' : '▼'}
        </button>
      )}

      {/* Completa fase — azione distruttiva in coda, outline danger */}
      <button
        type="button"
        onClick={onCompleteRubata}
        disabled={isSubmitting || rubataState === 'COMPLETED'}
        className={`${ABTN_DANGER} ml-auto`}
        title="Completa la rubata con transazioni casuali (30% rubate)"
      >
        Completa fase
      </button>

      {botOpen && showBot && (
        <div className="absolute top-full left-0 mt-1.5 w-[340px] z-40 shadow-card-hover">
          <BotSimulationPanel
            rubataState={rubataState}
            activeAuction={activeAuction}
            members={members}
            myMemberId={myMemberId}
            currentPlayerMemberId={currentPlayerMemberId}
            simulateMemberId={simulateMemberId}
            setSimulateMemberId={setSimulateMemberId}
            simulateBidAmount={simulateBidAmount}
            setSimulateBidAmount={setSimulateBidAmount}
            isSubmitting={isSubmitting}
            onSimulateOffer={onSimulateOffer}
            onSimulateBid={onSimulateBid}
          />
        </div>
      )}
    </div>
  )
}
