import { Button } from '../ui/Button'

const TIMER_PRESETS = [10, 15, 20, 30, 45, 60]

export interface SvincolatiCockpitAdminBarProps {
  /** Stato corrente della fase (AUCTION/NOMINATION/READY_CHECK/PAUSED/…) */
  state: string
  isSubmitting: boolean
  /** Quanti manager hanno dichiarato "Ho finito" */
  finishedCount: number
  totalMembers: number
  /** Timer corrente selezionato (secondi) */
  timerInput: number
  onSetTimer: (seconds: number) => void
  onPause: () => void
  onResume: () => void
  onCompletePhase: () => void
}

const ABTN = 'text-[11.5px] font-semibold rounded-[7px] border px-2.5 py-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed'

/**
 * P7 — Barra turni + admin del cockpit svincolati, sempre visibile su desktop:
 * a sinistra il progresso della fase (finiti X/Y), a destra le azioni admin
 * (preset timer · pausa/riprendi · termina fase). I controlli di test vivono
 * nel floating button. Mockup: docs/reviews/mockups/06-svincolati/cockpit.html.
 */
export function SvincolatiCockpitAdminBar({
  state,
  isSubmitting,
  finishedCount,
  totalMembers,
  timerInput,
  onSetTimer,
  onPause,
  onResume,
  onCompletePhase,
}: SvincolatiCockpitAdminBarProps) {
  const canPause = state === 'AUCTION' || state === 'NOMINATION' || state === 'READY_CHECK'
  const isPaused = state === 'PAUSED'

  return (
    <div className="flex items-center gap-2 flex-wrap bg-surface-300 border border-surface-50 rounded-xl px-3 py-1.5 min-h-[40px]">
      <span className="micro-label">
        Finiti <b className="text-secondary-400">{finishedCount}</b>/{totalMembers}
      </span>

      <span className="flex-1" />

      <span className="micro-label">Admin</span>
      <span className="flex items-center gap-1">
        <span className="micro-label tracking-[0.08em]">Timer</span>
        {TIMER_PRESETS.map(sec => (
          <button
            key={sec}
            type="button"
            onClick={() => { onSetTimer(sec); }}
            className={`font-mono text-[10.5px] font-bold rounded-[7px] border px-2 py-1 transition-colors ${
              timerInput === sec
                ? 'text-dark-300 bg-accent-400 border-accent-400'
                : 'text-gray-300 bg-surface-200 border-surface-50 hover:text-white'
            }`}
          >
            {sec}s
          </button>
        ))}
      </span>

      <span className="w-px h-4 bg-surface-50" aria-hidden="true" />

      {canPause && (
        <button
          type="button"
          onClick={onPause}
          disabled={isSubmitting}
          className={`${ABTN} text-warning-400 border-warning-500/50 bg-warning-500/[0.07] hover:bg-warning-500/15`}
        >
          Pausa
        </button>
      )}
      {isPaused && (
        <button
          type="button"
          onClick={onResume}
          disabled={isSubmitting}
          className={`${ABTN} text-secondary-400 border-secondary-500/50 bg-secondary-500/[0.07] hover:bg-secondary-500/15`}
        >
          Riprendi
        </button>
      )}
      <button
        type="button"
        onClick={onCompletePhase}
        disabled={isSubmitting}
        className={`${ABTN} text-danger-400 border-danger-500/50 bg-danger-500/[0.06] hover:bg-danger-500/15`}
      >
        Termina fase
      </button>
    </div>
  )
}

/** Pannello dei controlli di TEST per il floating button (solo dev). */
export interface SvincolatiTestPanelProps {
  state: string
  isSubmitting: boolean
  hasAuction: boolean
  nominatorConfirmed: boolean
  allFinished: boolean
  onBotNominate: () => void
  onBotConfirmNomination: () => void
  onBotBid: () => void
  onForceReady: () => void
  onForceAck: () => void
  onForceAllFinished: () => void
}

export function SvincolatiTestPanel({
  state,
  isSubmitting,
  hasAuction,
  nominatorConfirmed,
  allFinished,
  onBotNominate,
  onBotConfirmNomination,
  onBotBid,
  onForceReady,
  onForceAck,
  onForceAllFinished,
}: SvincolatiTestPanelProps) {
  return (
    <div className="bg-surface-200 rounded-xl border border-warning-500/30 overflow-hidden">
      <div className="px-3 py-2 border-b border-surface-50/60 bg-warning-500/10">
        <span className="micro-label text-warning-400">Controlli Admin (TEST)</span>
      </div>
      <div className="p-3 space-y-2">
        <Button
          size="sm" variant="outline"
          onClick={onBotNominate}
          disabled={isSubmitting || state !== 'READY_CHECK'}
          className="w-full text-xs border-warning-500/50 text-warning-400 hover:bg-warning-500/10"
        >
          Simula Scelta Giocatore
        </Button>
        <Button
          size="sm" variant="outline"
          onClick={onBotConfirmNomination}
          disabled={isSubmitting || state !== 'NOMINATION' || nominatorConfirmed}
          className="w-full text-xs border-warning-500/50 text-warning-400 hover:bg-warning-500/10"
        >
          Simula Conferma Scelta
        </Button>
        {hasAuction && (
          <Button
            size="sm" variant="outline"
            onClick={onBotBid}
            disabled={isSubmitting}
            className="w-full text-xs border-primary-500/50 text-primary-400 hover:bg-primary-500/10"
          >
            Simula Offerta Bot
          </Button>
        )}
        <Button
          size="sm" variant="outline"
          onClick={onForceReady}
          disabled={isSubmitting || state !== 'NOMINATION' || !nominatorConfirmed}
          className="w-full text-xs border-accent-500/50 text-accent-400 hover:bg-accent-500/10"
        >
          Forza Tutti Pronti
        </Button>
        <Button
          size="sm" variant="outline"
          onClick={onForceAck}
          disabled={isSubmitting || state !== 'PENDING_ACK'}
          className="w-full text-xs border-accent-500/50 text-accent-400 hover:bg-accent-500/10"
        >
          Forza Conferme
        </Button>
        {!allFinished && (
          <Button
            size="sm" variant="secondary"
            onClick={onForceAllFinished}
            disabled={isSubmitting}
            className="w-full text-xs"
          >
            Simula Tutti Finiti
          </Button>
        )}
      </div>
    </div>
  )
}
