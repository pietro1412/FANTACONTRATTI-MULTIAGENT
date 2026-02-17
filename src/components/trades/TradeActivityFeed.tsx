import { useState } from 'react'
import { EmptyState } from '../ui/EmptyState'
import { PlayersTable } from './PlayerDisplay'
import { getTimeRemaining, getRoleStyle } from './utils'
import type { TradeOffer, TradeMovement } from './types'

type ActivityFilter = 'all' | 'mine' | 'pending' | 'concluded'

interface TradeActivityFeedProps {
  receivedOffers: TradeOffer[]
  sentOffers: TradeOffer[]
  tradeHistory: TradeOffer[]
  tradeMovements: TradeMovement[]
  isInTradePhase: boolean
  filter: ActivityFilter
  onFilterChange: (filter: ActivityFilter) => void
  onViewOffer: (offerId: string) => void
}

type TimelineOffer = TradeOffer & { _type: 'offer'; _subtype: 'received' | 'sent' | 'history' }
type TimelineMovement = TradeMovement & { _type: 'movement' }
type TimelineItem = TimelineOffer | TimelineMovement

export function TradeActivityFeed({ receivedOffers, sentOffers, tradeHistory, tradeMovements, filter, onFilterChange, onViewOffer }: TradeActivityFeedProps) {
  const [collapsed, setCollapsed] = useState(false)

  // Build unified timeline
  const items: TimelineItem[] = []

  // My pending received
  for (const o of receivedOffers) {
    if (o.status === 'PENDING') {
      items.push({ ...o, _type: 'offer', _subtype: 'received' })
    }
  }
  // My pending sent
  for (const o of sentOffers) {
    if (o.status === 'PENDING') {
      items.push({ ...o, _type: 'offer', _subtype: 'sent' })
    }
  }
  // Concluded trades (ACCEPTED/REJECTED from history)
  for (const o of tradeHistory) {
    items.push({ ...o, _type: 'offer', _subtype: 'history' })
  }
  // Trade movements
  for (const m of tradeMovements) {
    items.push({ ...m, _type: 'movement' })
  }

  // Sort by date descending
  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  // Apply filters
  const filtered = items.filter(item => {
    if (filter === 'all') return true
    if (filter === 'mine') {
      return item._type === 'offer' && (item._subtype === 'received' || item._subtype === 'sent')
    }
    if (filter === 'pending') {
      return item._type === 'offer' && (item._subtype === 'received' || item._subtype === 'sent')
    }
    if (filter === 'concluded') {
      return (item._type === 'offer' && item._subtype === 'history') || item._type === 'movement'
    }
    return true
  })

  const pendingCount = receivedOffers.filter(o => o.status === 'PENDING').length + sentOffers.filter(o => o.status === 'PENDING').length

  const filters: { key: ActivityFilter; label: string; count?: number }[] = [
    { key: 'all', label: 'Tutto' },
    { key: 'mine', label: 'Le mie', count: pendingCount },
    { key: 'pending', label: 'In corso', count: pendingCount },
    { key: 'concluded', label: 'Concluse', count: tradeHistory.length },
  ]

  return (
    <div className="border border-surface-50/20 rounded-xl overflow-hidden">
      {/* Collapsible header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-4 py-3 bg-surface-300/50 hover:bg-surface-300/80 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <span className="text-base font-bold text-white">Attivit&agrave; Scambi</span>
          {pendingCount > 0 && (
            <span className="px-2 py-1 text-xs font-bold bg-accent-500/20 text-accent-400 rounded-full">{pendingCount}</span>
          )}
        </div>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${collapsed ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {!collapsed && (
        <div className="p-3 space-y-3">
          {/* Filter pills */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {filters.map(f => (
              <button
                key={f.key}
                onClick={() => onFilterChange(f.key)}
                className={`whitespace-nowrap px-4 py-2 min-h-[40px] text-sm font-semibold rounded-full border transition-colors ${
                  filter === f.key
                    ? 'bg-accent-500/20 text-accent-400 border-accent-500/40'
                    : 'bg-surface-200 text-gray-400 border-surface-50/20 hover:border-surface-50/40'
                }`}
              >
                {f.label}
                {f.count != null && f.count > 0 && <span className="ml-1 text-gray-500">({f.count})</span>}
              </button>
            ))}
          </div>

          {/* Timeline items */}
          {filtered.length === 0 ? (
            <EmptyState icon="📋" title="Nessuna attivit&agrave;" description="Le attivit&agrave; di scambio appariranno qui" />
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {filtered.map(item => {
                if (item._type === 'movement') {
                  return <MovementRow key={`mov-${item.id}`} movement={item} />
                }
                return <OfferRow key={`offer-${item._subtype}-${item.id}`} offer={item} onView={onViewOffer} />
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function OfferRow({ offer, onView }: { offer: TimelineOffer; onView: (id: string) => void }) {
  const isPending = offer._subtype === 'received' || offer._subtype === 'sent'
  const timeRemaining = isPending ? getTimeRemaining(offer.expiresAt) : null

  const senderName = offer.sender?.username || offer.fromMember?.user?.username || '?'
  const receiverName = offer.receiver?.username || offer.toMember?.user?.username || '?'

  // Status styling
  let statusBadge: { bg: string; text: string; label: string }
  if (offer._subtype === 'received') {
    statusBadge = { bg: 'bg-accent-500/20', text: 'text-accent-400', label: 'Ricevuta' }
  } else if (offer._subtype === 'sent') {
    statusBadge = { bg: 'bg-primary-500/20', text: 'text-primary-400', label: 'Inviata' }
  } else if (offer.status === 'ACCEPTED') {
    statusBadge = { bg: 'bg-secondary-500/20', text: 'text-secondary-400', label: 'Accettata' }
  } else {
    statusBadge = { bg: 'bg-danger-500/20', text: 'text-danger-400', label: 'Rifiutata' }
  }

  const borderColor = offer._subtype === 'received' ? 'border-l-accent-500'
    : offer._subtype === 'sent' ? 'border-l-primary-500'
    : offer.status === 'ACCEPTED' ? 'border-l-secondary-500' : 'border-l-danger-500'

  return (
    <div className={`border-l-4 ${borderColor} bg-surface-300/40 rounded-lg overflow-hidden`}>
      {/* Compact header */}
      <div className="px-4 py-3 flex items-center gap-2">
        <span className={`px-2 py-0.5 text-xs font-bold rounded ${statusBadge.bg} ${statusBadge.text} uppercase tracking-wide flex-shrink-0`}>
          {statusBadge.label}
        </span>
        <span className="text-sm text-gray-300 truncate">
          {offer._subtype === 'received' ? `da ${senderName}` : offer._subtype === 'sent' ? `a ${receiverName}` : `${senderName} → ${receiverName}`}
        </span>
        {timeRemaining && (
          <span className={`ml-auto text-xs font-medium font-mono flex-shrink-0 ${
            timeRemaining.isExpired ? 'text-danger-400' : timeRemaining.isUrgent ? 'text-warning-400' : 'text-gray-500'
          }`}>
            {timeRemaining.text}
          </span>
        )}
        {!timeRemaining && (
          <span className="ml-auto text-xs text-gray-400 flex-shrink-0">
            {new Date(offer.createdAt).toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        {isPending && (
          <button
            onClick={() => onView(offer.id)}
            className="text-xs text-primary-400 font-semibold hover:underline flex-shrink-0 ml-1"
          >
            Vedi
          </button>
        )}
      </div>

      {/* Concluded offer details */}
      {offer._subtype === 'history' && (
        <div className="px-4 pb-3">
          <div className="grid md:grid-cols-2 gap-3">
            {/* Offered */}
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Offerto</p>
              <PlayersTable players={offer.offeredPlayerDetails || []} />
              {offer.offeredBudget > 0 && (
                <p className="text-xs text-danger-400 mt-1">+ {offer.offeredBudget} crediti</p>
              )}
            </div>
            {/* Requested */}
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Richiesto</p>
              <PlayersTable players={offer.requestedPlayerDetails || []} />
              {offer.requestedBudget > 0 && (
                <p className="text-xs text-secondary-400 mt-1">+ {offer.requestedBudget} crediti</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MovementRow({ movement }: { movement: TimelineMovement }) {
  const roleStyle = getRoleStyle(movement.player.position)

  return (
    <div className="border-l-4 border-l-secondary-500/60 bg-surface-300/40 rounded-lg px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="px-2 py-0.5 text-xs font-bold rounded bg-secondary-500/20 text-secondary-400 uppercase tracking-wide flex-shrink-0">
          Trade
        </span>
        <span className={`w-6 h-5 flex items-center justify-center text-xs font-bold rounded ${roleStyle.bg} ${roleStyle.text} flex-shrink-0`}>
          {roleStyle.label}
        </span>
        <span className="text-sm text-white font-medium truncate">{movement.player.name}</span>
        <div className="flex items-center gap-1 text-sm flex-shrink-0 ml-auto">
          {movement.fromMember && <span className="text-gray-400">{movement.fromMember.username}</span>}
          <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
          {movement.toMember && <span className="text-white font-medium">{movement.toMember.username}</span>}
        </div>
        {movement.newSalary != null && (
          <span className="text-xs font-mono text-accent-400 font-medium flex-shrink-0 ml-1">{movement.newSalary}M</span>
        )}
        <span className="text-xs text-gray-400 flex-shrink-0 ml-1">
          {new Date(movement.createdAt).toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  )
}
