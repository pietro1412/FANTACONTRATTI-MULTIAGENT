import { Monogram } from '@/components/ui/Monogram'
import { getTimeRemaining } from './utils'
import type { Player, TradeOffer } from './types'

export type TradeOfferVariant = 'received' | 'sent' | 'history'

interface TradeOfferCardProps {
  offer: TradeOffer
  variant: TradeOfferVariant
  isInTradePhase?: boolean
  isHighlighted?: boolean
  onViewStats?: (player: Player) => void
  // received
  onAccept?: (id: string) => void
  onCounter?: (offer: TradeOffer) => void
  onReject?: (id: string) => void
  // sent
  onCancel?: (id: string) => void
}

const ROLE_BADGE: Record<string, string> = {
  P: 'bg-accent-500/[0.14] text-accent-400',
  D: 'bg-primary-500/[0.14] text-primary-400',
  C: 'bg-secondary-500/[0.14] text-secondary-400',
  A: 'bg-danger-500/[0.14] text-danger-400',
}

const HISTORY_STATUS: Record<string, { label: string; cls: string }> = {
  ACCEPTED: { label: 'Accettato', cls: 'bg-secondary-500/20 text-secondary-400 border-secondary-500/40' },
  REJECTED: { label: 'Rifiutato', cls: 'bg-danger-500/20 text-danger-400 border-danger-500/40' },
  INVALIDATED: { label: 'Decaduta', cls: 'bg-warning-500/20 text-warning-400 border-warning-500/40' },
  CANCELLED: { label: 'Annullato', cls: 'bg-surface-300 text-gray-400 border-surface-50' },
  EXPIRED: { label: 'Scaduto', cls: 'bg-surface-300 text-gray-400 border-surface-50' },
}

function PlayerChips({ players, budget, accent }: { players: Player[]; budget: number; accent: 'get' | 'give' }) {
  const creditCls = accent === 'get' ? 'text-secondary-400' : 'text-danger-400'
  const hasNothing = players.length === 0 && budget === 0
  return (
    <div className="flex flex-wrap gap-1.5">
      {players.map(p => {
        const role = ROLE_BADGE[p.position] ?? 'bg-surface-100 text-gray-400'
        return (
          <span key={p.id} className="inline-flex items-center gap-1.5 bg-surface-300 border border-surface-50 rounded-full pl-1 pr-2.5 py-0.5 text-[11.5px] font-semibold text-white">
            <span className={`w-[18px] h-[18px] rounded-[5px] flex items-center justify-center font-display font-extrabold text-[9px] ${role}`}>
              {p.position}
            </span>
            {p.name}
          </span>
        )
      })}
      {budget > 0 && (
        <span className="inline-flex items-center bg-surface-300 border border-surface-50 rounded-full px-2.5 py-0.5">
          <span className={`font-mono text-[11px] font-bold ${creditCls}`}>+{budget}M</span>
        </span>
      )}
      {hasNothing && <span className="text-[11px] text-gray-500 italic">nulla</span>}
    </div>
  )
}

export function TradeOfferCard({
  offer,
  variant,
  isInTradePhase = false,
  isHighlighted = false,
  onAccept,
  onCounter,
  onReject,
  onCancel,
}: TradeOfferCardProps) {
  const timeRemaining = getTimeRemaining(offer.expiresAt)

  // Counterparty + timestamp
  const counterpartyName =
    variant === 'sent'
      ? (offer.receiver?.username || offer.toMember?.user.username || '?')
      : (offer.sender?.username || offer.fromMember?.user.username || '?')

  const timestampSource = variant === 'history' && offer.respondedAt ? offer.respondedAt : offer.createdAt
  const timestamp = new Date(timestampSource).toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

  // Players + budget per leg. Received: offered=Ricevi, requested=Cedi.
  // Sent: offered=Offri, requested=Richiedi. History: offered=Offerti, requested=Richiesti.
  const offeredPlayers = offer.offeredPlayerDetails || offer.offeredPlayers || []
  const requestedPlayers = offer.requestedPlayerDetails || offer.requestedPlayers || []

  const labels: Record<TradeOfferVariant, { get: string; give: string }> = {
    received: { get: 'Ricevi', give: 'Cedi' },
    sent: { get: 'Offri', give: 'Richiedi' },
    history: { get: 'Offerti', give: 'Richiesti' },
  }
  // The "get" leg always maps to the offer's offered side, the "give" leg to the
  // requested side; only the labels change per variant (received reads from the
  // recipient's perspective, sent/history from the author's).
  const getPlayers = offeredPlayers
  const getBudget = offer.offeredBudget
  const givePlayers = requestedPlayers
  const giveBudget = offer.requestedBudget

  const status = HISTORY_STATUS[offer.status] ?? HISTORY_STATUS.CANCELLED!

  return (
    <div
      id={`offer-${offer.id}`}
      className={`grid grid-cols-1 lg:grid-cols-[190px_minmax(0,1fr)_minmax(0,1fr)_auto] gap-3 lg:gap-4 lg:items-center px-4 py-3.5 border-b border-surface-50 last:border-b-0 transition-colors ${
        isHighlighted ? 'bg-primary-500/[0.06] ring-1 ring-inset ring-primary-500/40' : ''
      }`}
    >
      {/* Counterparty */}
      <div className="flex items-center gap-2.5 min-w-0">
        <Monogram name={counterpartyName} size="md" />
        <div className="min-w-0">
          <div className="font-display text-[13.5px] font-bold text-white truncate">
            {variant === 'sent' ? `A: ${counterpartyName}` : counterpartyName}
          </div>
          <div className="text-[10.5px] text-gray-500">{timestamp}</div>
        </div>
      </div>

      {/* Leg GET */}
      <div className="flex flex-col gap-1 min-w-0">
        <span className="micro-label text-[9px] text-secondary-400">{labels[variant].get}</span>
        <PlayerChips players={getPlayers} budget={getBudget} accent="get" />
      </div>

      {/* Leg GIVE */}
      <div className="flex flex-col gap-1 min-w-0">
        <span className="micro-label text-[9px] text-danger-400">{labels[variant].give}</span>
        <PlayerChips players={givePlayers} budget={giveBudget} accent="give" />
      </div>

      {/* Actions / status */}
      <div className="flex flex-col gap-2 lg:items-end flex-shrink-0">
        {variant !== 'history' ? (
          <span className={`inline-flex items-center gap-1.5 self-start lg:self-auto font-mono text-[10.5px] font-bold rounded-full px-2.5 py-1 border ${
            timeRemaining.isExpired
              ? 'text-danger-400 bg-danger-500/10 border-danger-500/45'
              : timeRemaining.isUrgent
                ? 'text-warning-400 bg-warning-500/10 border-warning-500/45'
                : 'text-gray-400 bg-surface-300 border-surface-50'
          }`}>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {timeRemaining.text}
          </span>
        ) : (
          <span className={`inline-flex items-center self-start lg:self-auto text-[10.5px] font-bold uppercase tracking-wide rounded-full px-2.5 py-1 border ${status.cls}`}>
            {status.label}
          </span>
        )}

        {variant === 'received' && isInTradePhase && !timeRemaining.isExpired && (
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => onAccept?.(offer.id)}
              className="text-[11.5px] font-bold rounded-lg px-3 py-1.5 text-[#06200f] bg-gradient-to-b from-secondary-400 to-secondary-500"
            >
              Accetta
            </button>
            <button
              type="button"
              onClick={() => onCounter?.(offer)}
              className="text-[11.5px] font-bold rounded-lg px-3 py-1.5 text-primary-400 border border-primary-500/45 bg-primary-500/[0.08]"
            >
              Controfferta
            </button>
            <button
              type="button"
              onClick={() => onReject?.(offer.id)}
              className="text-[11.5px] font-bold rounded-lg px-3 py-1.5 text-danger-400 border border-danger-500/40 bg-danger-500/[0.06]"
            >
              Rifiuta
            </button>
          </div>
        )}

        {variant === 'sent' && offer.status === 'PENDING' && !timeRemaining.isExpired && (
          <button
            type="button"
            onClick={() => onCancel?.(offer.id)}
            className="text-[11.5px] font-bold rounded-lg px-3 py-1.5 text-danger-400 border border-danger-500/40 bg-danger-500/[0.06]"
          >
            Annulla offerta
          </button>
        )}

        {variant === 'history' && offer.status === 'INVALIDATED' && (
          <p className="text-[10.5px] text-warning-400 lg:text-right max-w-[200px]">Un giocatore coinvolto è stato scambiato in un'altra trattativa</p>
        )}
      </div>

      {/* Message (full width) */}
      {offer.message && (
        <div className="lg:col-span-4">
          <p className="text-[11.5px] text-gray-500 italic border-l-2 border-surface-50 pl-3">"{offer.message}"</p>
        </div>
      )}
    </div>
  )
}
