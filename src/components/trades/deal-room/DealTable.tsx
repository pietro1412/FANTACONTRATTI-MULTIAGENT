import { useState, useRef, useCallback, useEffect } from 'react'
import { getPlayerPhotoUrl } from '@/utils/player-images'
import { Textarea } from '@/components/ui/Textarea'
import { Monogram } from '@/components/ui/Monogram'
import { POSITION_GRADIENTS } from '../../ui/PositionBadge'
import type { RosterEntry, LeagueMember } from '../types'

interface DealTableProps {
  // Target
  members: LeagueMember[]
  selectedMemberId: string
  targetMember?: LeagueMember
  onMemberChange: (id: string) => void
  myBudget: number
  // Offered (mine)
  selectedOfferedPlayers: string[]
  myRoster: RosterEntry[]
  onRemoveOffered: (id: string) => void
  offeredBudget: number
  onOfferedBudgetChange: (v: number) => void
  // Requested (partner)
  selectedRequestedPlayers: string[]
  allOtherPlayers: RosterEntry[]
  onRemoveRequested: (id: string) => void
  requestedBudget: number
  onRequestedBudgetChange: (v: number) => void
  // Controls
  offerDuration: number
  onDurationChange: (d: number) => void
  message: string
  onMessageChange: (m: string) => void
  // Post-trade impact (computed in Trades.tsx)
  budgetNow: number
  budgetNext: number
  salaryNow: number
  salaryNext: number
  rosterNow: number
  rosterNext: number
  // Submit
  isSubmitting: boolean
  canSubmit: boolean
  onSubmit: (e: React.FormEvent) => void
  // Mobile triggers
  onOpenMyRoster: () => void
  onOpenPartnerRoster: () => void
  // Player stats
  onViewStats?: (entry: RosterEntry) => void
}

const DURATIONS = [6, 12, 24, 48, 72, 168]

function formatDuration(h: number) {
  if (h < 24) return `${h}h`
  if (h === 24) return '24h'
  if (h === 48) return '2gg'
  if (h === 72) return '3gg'
  return '7gg'
}

function DealAsset({ entry, onRemove, onViewStats }: { entry: RosterEntry; onRemove: () => void; onViewStats?: (entry: RosterEntry) => void }) {
  const p = entry.player
  const gradient = POSITION_GRADIENTS[p.position] || 'from-gray-500 to-gray-600'

  return (
    <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-[9px] bg-surface-300 border border-surface-50 mb-1.5">
      <div className="relative flex-shrink-0">
        {p.apiFootballId ? (
          <img
            src={getPlayerPhotoUrl(p.apiFootballId)}
            alt={p.name}
            className="w-7 h-7 rounded-full object-cover bg-surface-300"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none'
              const fallback = (e.target as HTMLImageElement).nextElementSibling as HTMLElement
              if (fallback) fallback.style.display = 'flex'
            }}
          />
        ) : null}
        <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${gradient} items-center justify-center text-[10px] font-bold text-white ${p.apiFootballId ? 'hidden' : 'flex'}`}>
          {p.position}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onViewStats?.(entry) }}
          className="font-display text-[12.5px] font-bold text-white truncate hover:text-primary-400 transition-colors text-left block"
        >
          {p.name}
        </button>
        <div className="text-[10.5px] text-gray-500 flex items-center gap-1.5">
          <span className="truncate">{p.team}</span>
          <span aria-hidden="true">·</span>
          <span>ing. {p.contract?.salary ?? '-'}M</span>
          <span aria-hidden="true">·</span>
          <span>{p.contract?.duration ?? '-'} sem</span>
        </div>
      </div>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onRemove() }}
        className="w-5 h-5 rounded-md bg-surface-200 border border-surface-50 text-gray-500 hover:text-white text-xs flex items-center justify-center flex-shrink-0"
        title="Rimuovi"
      >
        ✕
      </button>
    </div>
  )
}

const STEPPER_COLORS = {
  danger: { border: 'border-danger-500/30', value: 'text-danger-300', bg: 'bg-danger-500/[0.05]' },
  secondary: { border: 'border-secondary-500/30', value: 'text-secondary-300', bg: 'bg-secondary-500/[0.05]' },
}

function useLongPress(callback: () => void, delay = 400, interval = 80) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stop = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (intervalRef.current) clearInterval(intervalRef.current)
    timerRef.current = null
    intervalRef.current = null
  }, [])

  const start = useCallback(() => {
    timerRef.current = setTimeout(() => {
      intervalRef.current = setInterval(callback, interval)
    }, delay)
  }, [callback, delay, interval])

  useEffect(() => stop, [stop])

  return { onMouseDown: start, onMouseUp: stop, onMouseLeave: stop, onTouchStart: start, onTouchEnd: stop }
}

function BudgetStepper({ value, onChange, max, accent }: {
  value: number; onChange: (v: number) => void; max?: number; accent: 'danger' | 'secondary'
}) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const colors = STEPPER_COLORS[accent]

  const decrement = useCallback(() => { onChange(Math.max(0, value - 1)); }, [onChange, value])
  const increment = useCallback(() => { onChange(max != null ? Math.min(max, value + 1) : value + 1); }, [onChange, value, max])
  const longPressDown = useLongPress(decrement)
  const longPressUp = useLongPress(increment)

  function commitEdit() {
    const num = parseInt(editValue, 10)
    if (!isNaN(num)) {
      const clamped = max != null ? Math.min(max, Math.max(0, num)) : Math.max(0, num)
      onChange(clamped)
    }
    setEditing(false)
  }

  return (
    <div className="inline-flex items-center">
      <button
        type="button"
        onClick={decrement}
        disabled={value <= 0}
        className={`w-9 h-9 bg-surface-200 border ${colors.border} rounded-l-lg text-white font-bold disabled:opacity-30 hover:bg-surface-100 transition-colors flex items-center justify-center`}
        {...longPressDown}
      >-</button>
      {editing ? (
        <input
          type="number"
          autoFocus
          value={editValue}
          onChange={e => { setEditValue(e.target.value); }}
          onBlur={commitEdit}
          onKeyDown={e => { if (e.key === 'Enter') commitEdit() }}
          className={`w-14 h-9 bg-surface-200 border-y ${colors.border} text-center stat-number text-base text-white outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
        />
      ) : (
        <button
          type="button"
          onClick={() => { setEditValue(String(value)); setEditing(true) }}
          className={`min-w-[48px] h-9 px-2 ${colors.bg} border-y ${colors.border} ${colors.value} flex items-center justify-center stat-number text-base cursor-text`}
        >
          {value}
        </button>
      )}
      <button
        type="button"
        onClick={increment}
        disabled={max != null && value >= max}
        className={`w-9 h-9 bg-surface-200 border ${colors.border} rounded-r-lg text-white font-bold disabled:opacity-30 hover:bg-surface-100 transition-colors flex items-center justify-center`}
        {...longPressUp}
      >+</button>
    </div>
  )
}

function ImpactStat({ label, now, next }: { label: string; now: number; next: number }) {
  const dir = next > now ? 'up' : next < now ? 'down' : 'flat'
  const nextColor = dir === 'up' ? 'text-secondary-400' : dir === 'down' ? 'text-danger-400' : 'text-white'
  return (
    <div className="flex-1 min-w-0">
      <div className="micro-label text-[9px]">{label}</div>
      <div className="flex items-baseline gap-1.5 mt-0.5">
        <span className="stat-number text-sm text-gray-500">{now}</span>
        <span className="text-gray-500 text-[11px]" aria-hidden="true">→</span>
        <span className={`stat-number text-[17px] ${nextColor}`}>{next}</span>
      </div>
    </div>
  )
}

export function DealTable(props: DealTableProps) {
  const {
    members,
    selectedMemberId,
    targetMember,
    onMemberChange,
    selectedOfferedPlayers,
    myRoster,
    onRemoveOffered,
    offeredBudget,
    onOfferedBudgetChange,
    selectedRequestedPlayers,
    allOtherPlayers,
    onRemoveRequested,
    requestedBudget,
    onRequestedBudgetChange,
    offerDuration,
    onDurationChange,
    message,
    onMessageChange,
    budgetNow, budgetNext, salaryNow, salaryNext, rosterNow, rosterNext,
    isSubmitting,
    canSubmit,
    onSubmit,
    onOpenMyRoster,
    onOpenPartnerRoster,
    onViewStats,
  } = props

  const offeredEntries = selectedOfferedPlayers.map(id => myRoster.find(r => r.id === id)).filter(Boolean) as RosterEntry[]
  const requestedEntries = selectedRequestedPlayers.map(id => allOtherPlayers.find(r => r.id === id)).filter(Boolean) as RosterEntry[]

  const durationIndex = DURATIONS.indexOf(offerDuration)
  const [showMessage, setShowMessage] = useState(false)
  const partnerName = targetMember?.user.username

  return (
    <form onSubmit={onSubmit} className="bg-surface-200 arena-gold rounded-xl overflow-hidden flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-3.5 py-2.5 border-b border-surface-50 flex-shrink-0">
        <span className="micro-label text-accent-400">Tavolo dello scambio</span>
      </div>

      {/* Recipient — UNICO selettore destinatario */}
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 border-b border-surface-50 flex-shrink-0">
        <span className="micro-label">Con</span>
        {partnerName ? (
          <span className="inline-flex items-center gap-2 bg-surface-300 border border-primary-500/45 rounded-full pr-3.5 pl-1 py-0.5 font-display text-[13px] font-bold text-white">
            <Monogram name={partnerName} size="sm" />
            {partnerName}
          </span>
        ) : (
          <select
            value={selectedMemberId}
            onChange={e => { onMemberChange(e.target.value); }}
            className="px-2.5 py-1.5 bg-surface-300 border border-surface-50 rounded-lg text-white text-sm focus:border-primary-500 focus:outline-none"
          >
            <option value="">Seleziona destinatario…</option>
            {members.map(m => (
              <option key={m.id} value={m.id}>{m.user.username}</option>
            ))}
          </select>
        )}
        {targetMember && (
          <div className="ml-auto text-right">
            <div className="micro-label text-[9px]">Suo budget</div>
            <div className="budget-display text-base text-gray-300">{targetMember.currentBudget}M</div>
          </div>
        )}
      </div>

      {/* Body: Cedo / Ottengo (scroll interno) */}
      <div className="panel-scroll flex-1 min-h-0">
        {/* Cedo */}
        <div className="px-3.5 py-2.5 border-b border-surface-50">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-[18px] h-[18px] rounded-md bg-danger-500/[0.18] text-danger-400 flex items-center justify-center flex-shrink-0">
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            </span>
            <span className="micro-label text-danger-400">Cedo</span>
            <span className="ml-auto font-mono text-[10px] text-gray-500">
              {offeredEntries.length > 0 ? `${offeredEntries.length} giocator${offeredEntries.length === 1 ? 'e' : 'i'}` : 'nulla'}
            </span>
          </div>

          {offeredEntries.length > 0 ? (
            offeredEntries.map(entry => (
              <DealAsset key={entry.id} entry={entry} onRemove={() => { onRemoveOffered(entry.id); }} onViewStats={onViewStats} />
            ))
          ) : (
            <>
              <button
                type="button"
                onClick={onOpenMyRoster}
                className="lg:hidden w-full py-3 border border-dashed border-danger-500/30 rounded-lg text-danger-400 text-sm font-medium hover:bg-danger-500/[0.05] transition-colors"
              >
                Scegli dalla tua rosa
              </button>
              <p className="hidden lg:block text-center text-xs italic text-gray-500 py-2">Seleziona dalla colonna sinistra</p>
            </>
          )}

          <div className="flex items-center gap-2 mt-2 px-2 py-1.5 rounded-[9px] border border-dashed border-surface-50">
            <span className="text-[11.5px] text-gray-500">Crediti offerti</span>
            <span className="ml-auto"><BudgetStepper value={offeredBudget} onChange={onOfferedBudgetChange} max={budgetNow} accent="danger" /></span>
          </div>
        </div>

        {/* Ottengo */}
        <div className="px-3.5 py-2.5">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-[18px] h-[18px] rounded-md bg-secondary-500/[0.18] text-secondary-400 flex items-center justify-center flex-shrink-0">
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </span>
            <span className="micro-label text-secondary-400">Ottengo</span>
            <span className="ml-auto font-mono text-[10px] text-gray-500">
              {requestedEntries.length > 0 ? `${requestedEntries.length} giocator${requestedEntries.length === 1 ? 'e' : 'i'}` : 'nulla'}
            </span>
          </div>

          {requestedEntries.length > 0 ? (
            requestedEntries.map(entry => (
              <DealAsset key={entry.id} entry={entry} onRemove={() => { onRemoveRequested(entry.id); }} onViewStats={onViewStats} />
            ))
          ) : (
            <>
              <button
                type="button"
                onClick={onOpenPartnerRoster}
                className="lg:hidden w-full py-3 border border-dashed border-secondary-500/30 rounded-lg text-secondary-400 text-sm font-medium hover:bg-secondary-500/[0.05] transition-colors"
              >
                Scegli dalla rosa partner
              </button>
              <p className="hidden lg:block text-center text-xs italic text-gray-500 py-2">Seleziona dalla colonna destra</p>
            </>
          )}

          <div className="flex items-center gap-2 mt-2 px-2 py-1.5 rounded-[9px] border border-dashed border-surface-50">
            <span className="text-[11.5px] text-gray-500">Crediti richiesti</span>
            <span className="ml-auto"><BudgetStepper value={requestedBudget} onChange={onRequestedBudgetChange} accent="secondary" /></span>
          </div>
        </div>
      </div>

      {/* Footer pinnato: impatto post-scambio + opzioni + invio */}
      <div className="mt-auto border-t border-surface-50 px-3.5 py-3 bg-surface-300 flex-shrink-0">
        <div className="flex gap-3.5 mb-2.5">
          <ImpactStat label="Budget" now={budgetNow} next={budgetNext} />
          <ImpactStat label="Monte ingaggi" now={salaryNow} next={salaryNext} />
          <ImpactStat label="Rosa" now={rosterNow} next={rosterNext} />
        </div>

        <div className="flex items-center gap-2 mb-2.5">
          <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
            <span>Scade tra</span>
            <span className="inline-flex items-center">
              <button
                type="button"
                onClick={() => { if (durationIndex > 0) onDurationChange(DURATIONS[durationIndex - 1]!) }}
                disabled={durationIndex <= 0}
                className="w-6 h-6 bg-surface-200 border border-surface-50 rounded-l-md text-white text-xs font-bold disabled:opacity-30 hover:bg-surface-100"
              >-</button>
              <span className="min-w-[40px] h-6 px-1.5 bg-surface-200 border-y border-surface-50 text-gray-200 flex items-center justify-center font-mono text-xs font-bold">
                {formatDuration(offerDuration)}
              </span>
              <button
                type="button"
                onClick={() => { if (durationIndex < DURATIONS.length - 1) onDurationChange(DURATIONS[durationIndex + 1]!) }}
                disabled={durationIndex >= DURATIONS.length - 1}
                className="w-6 h-6 bg-surface-200 border border-surface-50 rounded-r-md text-white text-xs font-bold disabled:opacity-30 hover:bg-surface-100"
              >+</button>
            </span>
          </div>
          <button
            type="button"
            onClick={() => { setShowMessage(v => !v); }}
            className="flex-1 text-left px-2.5 py-1.5 bg-surface-200 border border-surface-50 rounded-lg text-[11.5px] italic text-gray-500 truncate hover:text-gray-300 transition-colors"
          >
            {message ? message : 'Aggiungi un messaggio…'}
          </button>
        </div>

        {showMessage && (
          <div className="mb-2.5">
            <Textarea
              textareaSize="sm"
              value={message}
              onChange={e => { onMessageChange(e.target.value); }}
              rows={2}
              placeholder="Aggiungi un messaggio…"
              autoFocus
            />
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit || isSubmitting}
          className="w-full py-2.5 rounded-xl font-display font-extrabold text-[15px] uppercase tracking-[0.04em] transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-b from-secondary-400 to-secondary-500 text-[#06200f] shadow-lg shadow-secondary-500/30 hover:shadow-xl active:scale-[0.98]"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-[#06200f]/40 border-t-[#06200f] rounded-full animate-spin" />
              Invio in corso…
            </span>
          ) : (
            partnerName ? `Invia offerta a ${partnerName}` : 'Invia offerta'
          )}
        </button>
      </div>
    </form>
  )
}
