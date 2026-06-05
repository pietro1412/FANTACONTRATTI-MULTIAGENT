import { useState, useMemo } from 'react'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../ui/Modal'
import { Button } from '../ui/Button'
import { tradeApi } from '../../services/api'
import { getRoleStyle } from './utils'
import type { TradeOffer, RosterEntry } from './types'

interface CounterOfferModalProps {
  isOpen: boolean
  onClose: () => void
  /** The original offer being countered (received by the current user). */
  offer: TradeOffer
  /** Current user's roster — source of players the counter can offer. */
  myRoster: RosterEntry[]
  /** All other managers' players — used to resolve the partner's roster. */
  allOtherPlayers: RosterEntry[]
  /** Called after a successful counter so the parent can refresh + switch tabs. */
  onCountered: () => void
}

interface SelectablePlayer {
  rosterId: string
  name: string
  team: string
  position: string
  salary: number | null
  duration: number | null
}

function toSelectable(entry: RosterEntry): SelectablePlayer {
  return {
    rosterId: entry.id,
    name: entry.player.name,
    team: entry.player.team,
    position: entry.player.position,
    salary: entry.player.contract?.salary ?? null,
    duration: entry.player.contract?.duration ?? null,
  }
}

/**
 * Counter-offer form, pre-filled with the ORIGINAL offer inverted
 * (what I would give <-> what I would receive). The current user (original
 * receiver) offers players from their own roster and requests players from the
 * original sender. Players and credits are editable before sending.
 */
export function CounterOfferModal({
  isOpen,
  onClose,
  offer,
  myRoster,
  allOtherPlayers,
  onCountered,
}: CounterOfferModalProps) {
  // Resolve the original sender's member id from the players they had offered.
  // The original "offeredPlayers" belong to the sender; match by player.id to
  // find them in allOtherPlayers and read their memberId.
  const senderMemberId = useMemo(() => {
    const offeredPlayerIds = (offer.offeredPlayerDetails || offer.offeredPlayers || []).map(p => p.id)
    for (const entry of allOtherPlayers) {
      if (offeredPlayerIds.includes(entry.player.id) && entry.memberId) {
        return entry.memberId
      }
    }
    return undefined
  }, [offer, allOtherPlayers])

  const senderUsername = offer.sender?.username || offer.fromMember?.user.username || 'manager'

  // Partner roster = the original sender's players (what I can request).
  const partnerPlayers = useMemo(
    () => allOtherPlayers.filter(e => senderMemberId && e.memberId === senderMemberId),
    [allOtherPlayers, senderMemberId]
  )

  // ---- Precompiled (inverted) initial selection ----
  // New OFFERED = original REQUESTED players (the ones from MY roster).
  const initialOfferedRosterIds = useMemo(() => {
    const requestedPlayerIds = (offer.requestedPlayerDetails || offer.requestedPlayers || []).map(p => p.id)
    return myRoster.filter(e => requestedPlayerIds.includes(e.player.id)).map(e => e.id)
  }, [offer, myRoster])

  // New REQUESTED = original OFFERED players (the sender's players).
  const initialRequestedRosterIds = useMemo(() => {
    const offeredPlayerIds = (offer.offeredPlayerDetails || offer.offeredPlayers || []).map(p => p.id)
    return partnerPlayers.filter(e => offeredPlayerIds.includes(e.player.id)).map(e => e.id)
  }, [offer, partnerPlayers])

  // The parent mounts this modal fresh per offer, so lazy initial state
  // pre-fills the inverted offer once. Original requestedBudget = credits the
  // sender wanted from me -> now I offer them; original offeredBudget -> I request.
  const [offeredPlayerIds, setOfferedPlayerIds] = useState<string[]>(() => initialOfferedRosterIds)
  const [requestedPlayerIds, setRequestedPlayerIds] = useState<string[]>(() => initialRequestedRosterIds)
  const [offeredBudget, setOfferedBudget] = useState(() => offer.requestedBudget || 0)
  const [requestedBudget, setRequestedBudget] = useState(() => offer.offeredBudget || 0)
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  function toggle(list: string[], setList: (l: string[]) => void, id: string) {
    setList(list.includes(id) ? list.filter(x => x !== id) : [...list, id])
  }

  const myPlayers = useMemo(() => myRoster.map(toSelectable), [myRoster])
  const theirPlayers = useMemo(() => partnerPlayers.map(toSelectable), [partnerPlayers])

  const canSubmit =
    !!senderMemberId &&
    (offeredPlayerIds.length > 0 || requestedPlayerIds.length > 0 || offeredBudget > 0 || requestedBudget > 0)

  async function handleSubmit() {
    setError('')
    setIsSubmitting(true)
    const res = await tradeApi.counter(offer.id, {
      offeredPlayerIds,
      requestedPlayerIds,
      offeredBudget,
      requestedBudget,
      message: message || undefined,
    })
    setIsSubmitting(false)
    if (res.success) {
      onCountered()
      onClose()
    } else {
      setError(res.message || 'Errore durante l\'invio della controfferta')
    }
  }

  function renderPlayerRow(p: SelectablePlayer, selected: boolean, onToggle: () => void) {
    const roleStyle = getRoleStyle(p.position)
    return (
      <button
        key={p.rosterId}
        type="button"
        onClick={onToggle}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-colors min-h-[44px] ${
          selected
            ? 'bg-primary-500/15 border-primary-500/50'
            : 'bg-surface-300/40 border-surface-50/20 hover:border-surface-50/40'
        }`}
      >
        <span className={`w-7 h-5 flex items-center justify-center text-[10px] font-bold rounded ${roleStyle.bg} ${roleStyle.text} ${roleStyle.border} border flex-shrink-0`}>
          {roleStyle.label}
        </span>
        <span className="text-sm text-white truncate flex-1">{p.name}</span>
        <span className="text-xs text-gray-500 truncate hidden sm:inline">{p.team}</span>
        {p.salary !== null && (
          <span className="text-xs text-accent-400 font-mono flex-shrink-0">{p.salary}M</span>
        )}
        <span className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 ${
          selected ? 'bg-primary-500 border-primary-500' : 'border-gray-500'
        }`}>
          {selected && (
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </span>
      </button>
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="full" className="max-h-[90vh] flex flex-col">
      <ModalHeader>Controfferta a {senderUsername}</ModalHeader>
      <ModalBody className="flex-1">
        {!senderMemberId ? (
          <p className="text-warning-400 text-sm py-4">
            Impossibile determinare la rosa del mittente per la controfferta. Riprova ricaricando la pagina.
          </p>
        ) : (
          <div className="space-y-5">
            <p className="text-xs text-gray-400">
              La controfferta è precompilata invertendo l'offerta ricevuta. Modifica giocatori e crediti
              come preferisci, poi invia. L'offerta originale verrà marcata come controofferta.
            </p>

            <div className="grid md:grid-cols-2 gap-5">
              {/* What I offer (from my roster) */}
              <div className="space-y-2">
                <p className="text-sm font-semibold text-danger-400 uppercase tracking-wide">Offri (dalla tua rosa)</p>
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {myPlayers.length === 0 ? (
                    <p className="text-xs text-gray-500 italic py-2">Nessun giocatore in rosa</p>
                  ) : (
                    myPlayers.map(p =>
                      renderPlayerRow(p, offeredPlayerIds.includes(p.rosterId), () => {
                        toggle(offeredPlayerIds, setOfferedPlayerIds, p.rosterId)
                      })
                    )
                  )}
                </div>
                <label className="block text-xs text-gray-400 pt-1">
                  Crediti offerti
                  <input
                    type="number"
                    min={0}
                    value={offeredBudget}
                    onChange={e => { setOfferedBudget(Math.max(0, Number(e.target.value) || 0)) }}
                    className="mt-1 w-full px-3 py-2 rounded-lg bg-surface-300 border border-surface-50/20 text-white text-sm focus:outline-none focus:border-primary-500"
                  />
                </label>
              </div>

              {/* What I request (from sender's roster) */}
              <div className="space-y-2">
                <p className="text-sm font-semibold text-secondary-400 uppercase tracking-wide">Richiedi (da {senderUsername})</p>
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {theirPlayers.length === 0 ? (
                    <p className="text-xs text-gray-500 italic py-2">Nessun giocatore disponibile</p>
                  ) : (
                    theirPlayers.map(p =>
                      renderPlayerRow(p, requestedPlayerIds.includes(p.rosterId), () => {
                        toggle(requestedPlayerIds, setRequestedPlayerIds, p.rosterId)
                      })
                    )
                  )}
                </div>
                <label className="block text-xs text-gray-400 pt-1">
                  Crediti richiesti
                  <input
                    type="number"
                    min={0}
                    value={requestedBudget}
                    onChange={e => { setRequestedBudget(Math.max(0, Number(e.target.value) || 0)) }}
                    className="mt-1 w-full px-3 py-2 rounded-lg bg-surface-300 border border-surface-50/20 text-white text-sm focus:outline-none focus:border-primary-500"
                  />
                </label>
              </div>
            </div>

            <label className="block text-xs text-gray-400">
              Messaggio (opzionale)
              <textarea
                value={message}
                onChange={e => { setMessage(e.target.value) }}
                rows={2}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-surface-300 border border-surface-50/20 text-white text-sm focus:outline-none focus:border-primary-500 resize-none"
                placeholder="Aggiungi un messaggio alla controfferta..."
              />
            </label>

            {error && (
              <div className="bg-danger-500/20 border border-danger-500/50 text-danger-400 p-3 rounded-lg text-sm">
                {error}
              </div>
            )}
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
          Annulla
        </Button>
        <Button
          variant="primary"
          onClick={() => { void handleSubmit() }}
          disabled={!canSubmit || isSubmitting}
          isLoading={isSubmitting}
          loadingText="Invio..."
        >
          Invia Controfferta
        </Button>
      </ModalFooter>
    </Modal>
  )
}

export default CounterOfferModal
