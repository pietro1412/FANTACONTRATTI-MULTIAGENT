import { useState, useRef, useCallback, useEffect } from 'react'
import { getPlayerPhotoUrl } from '../../../utils/player-images'
import { getTeamLogo } from '../../../utils/teamLogos'
import { POSITION_GRADIENTS } from '../../ui/PositionBadge'
import { getRoleStyle } from '../utils'
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

const CHIP_STYLES = {
  danger: {
    container: 'bg-danger-500/5 border border-danger-500/20',
    removeHover: 'hover:bg-danger-500/20',
    removeIcon: 'text-danger-400',
  },
  primary: {
    container: 'bg-primary-500/5 border border-primary-500/20',
    removeHover: 'hover:bg-primary-500/20',
    removeIcon: 'text-primary-400',
  },
}

function PlayerChip({ entry, onRemove, accent, onViewStats }: { entry: RosterEntry; onRemove: () => void; accent: 'danger' | 'primary'; onViewStats?: (entry: RosterEntry) => void }) {
  const p = entry.player
  const gradient = POSITION_GRADIENTS[p.position as keyof typeof POSITION_GRADIENTS] || 'from-gray-500 to-gray-600'
  const roleStyle = getRoleStyle(p.position)
  const cs = CHIP_STYLES[accent]

  return (
    <div className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg ${cs.container} group`}>
      {/* Photo */}
      <div className="relative flex-shrink-0">
        {p.apiFootballId ? (
          <img
            src={getPlayerPhotoUrl(p.apiFootballId)}
            alt={p.name}
            className="w-9 h-9 rounded-full object-cover bg-surface-300"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none'
              const fallback = (e.target as HTMLImageElement).nextElementSibling as HTMLElement
              if (fallback) fallback.style.display = 'flex'
            }}
          />
        ) : null}
        <div
          className={`w-9 h-9 rounded-full bg-gradient-to-br ${gradient} items-center justify-center text-[10px] font-bold text-white ${p.apiFootballId ? 'hidden' : 'flex'}`}
        >
          {p.position}
        </div>
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onViewStats?.(entry) }}
            className="text-sm font-semibold text-white truncate hover:text-primary-400 transition-colors text-left"
          >
            {p.name}
          </button>
          <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${roleStyle.bg} ${roleStyle.text}`}>
            {roleStyle.label}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <div className="flex items-center gap-1">
            <div className="w-3.5 h-3.5 bg-white/90 rounded-sm flex items-center justify-center flex-shrink-0">
              <img src={getTeamLogo(p.team)} alt="" className="w-3 h-3 object-contain" />
            </div>
            <span className="truncate">{p.team}</span>
          </div>
          <span className="font-mono text-accent-400">{p.contract?.salary ?? '-'}M</span>
          <span className="font-mono">{p.contract?.duration ?? '-'}A</span>
        </div>
      </div>

      {/* Remove */}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove() }}
        className={`p-1 rounded-full opacity-60 hover:opacity-100 ${cs.removeHover} transition-all flex-shrink-0`}
        title="Rimuovi"
      >
        <svg className={`w-4 h-4 ${cs.removeIcon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

const STEPPER_COLORS = {
  danger: {
    border: 'border-danger-500/30',
    value: 'text-danger-300',
    bg: 'bg-danger-500/5',
  },
  primary: {
    border: 'border-primary-500/30',
    value: 'text-primary-300',
    bg: 'bg-primary-500/5',
  },
  accent: {
    border: 'border-accent-500/30',
    value: 'text-accent-300',
    bg: 'bg-accent-500/5',
  },
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

function BudgetStepper({ value, onChange, max, accent, shortcuts }: {
  value: number; onChange: (v: number) => void; max?: number; accent: 'danger' | 'primary';
  shortcuts?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const colors = STEPPER_COLORS[accent]

  const decrement = useCallback(() => onChange(Math.max(0, value - 1)), [onChange, value])
  const increment = useCallback(() => onChange(max != null ? Math.min(max, value + 1) : value + 1), [onChange, value, max])
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
    <div className="flex items-center gap-2">
      <div className="inline-flex items-center">
        <button
          type="button"
          onClick={decrement}
          disabled={value <= 0}
          className={`w-11 h-11 lg:w-10 lg:h-10 bg-surface-300 border ${colors.border} rounded-l-lg text-white font-bold text-base disabled:opacity-30 hover:bg-surface-300/80 transition-colors flex items-center justify-center`}
          {...longPressDown}
        >-</button>
        {editing ? (
          <input
            type="number"
            autoFocus
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={e => { if (e.key === 'Enter') commitEdit() }}
            className={`w-16 h-11 lg:h-10 bg-surface-300 border-y ${colors.border} text-center font-mono font-bold text-base text-white outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
          />
        ) : (
          <button
            type="button"
            onClick={() => { setEditValue(String(value)); setEditing(true) }}
            className={`min-w-[56px] h-11 lg:h-10 px-3 ${colors.bg} border-y ${colors.border} ${colors.value} flex items-center justify-center font-mono font-bold text-lg cursor-text`}
          >
            {value}
          </button>
        )}
        <button
          type="button"
          onClick={increment}
          disabled={max != null && value >= max}
          className={`w-11 h-11 lg:w-10 lg:h-10 bg-surface-300 border ${colors.border} rounded-r-lg text-white font-bold text-base disabled:opacity-30 hover:bg-surface-300/80 transition-colors flex items-center justify-center`}
          {...longPressUp}
        >+</button>
      </div>
      {shortcuts && (
        <div className="flex gap-1">
          {[5, 10, 25].map(n => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(max != null ? Math.min(max, value + n) : value + n)}
              disabled={max != null && value >= max}
              className={`px-2 py-1 rounded text-xs font-medium border ${colors.border} text-gray-400 hover:text-white hover:bg-surface-300/80 disabled:opacity-30 transition-colors`}
            >+{n}</button>
          ))}
        </div>
      )}
    </div>
  )
}

export function DealTable(props: DealTableProps) {
  const {
    members,
    selectedMemberId,
    targetMember,
    onMemberChange,
    myBudget,
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

  // Build deal summary text
  const summaryParts: string[] = []
  if (offeredEntries.length > 0) summaryParts.push(`${offeredEntries.length} giocator${offeredEntries.length === 1 ? 'e' : 'i'}`)
  if (offeredBudget > 0) summaryParts.push(`${offeredBudget} crediti`)
  const offerSummary = summaryParts.length > 0 ? summaryParts.join(' + ') : null
  const requestParts: string[] = []
  if (requestedEntries.length > 0) requestParts.push(`${requestedEntries.length} giocator${requestedEntries.length === 1 ? 'e' : 'i'}`)
  if (requestedBudget > 0) requestParts.push(`${requestedBudget} crediti`)
  const requestSummary = requestParts.length > 0 ? requestParts.join(' + ') : null

  return (
    <form onSubmit={onSubmit} className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden">
      {/* Header: DG Target + Budget */}
      <div className="px-4 py-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-1.5 block">Destinatario</label>
            <select
              value={selectedMemberId}
              onChange={e => onMemberChange(e.target.value)}
              className="w-full px-3 py-2.5 bg-surface-300 border border-white/10 rounded-lg text-white text-sm focus:border-primary-500 focus:outline-none"
            >
              <option value="">Seleziona DG target...</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>{m.user.username}</option>
              ))}
            </select>
          </div>
          <div className="text-right flex-shrink-0">
            <label className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-1.5 block">Il tuo Budget</label>
            <span className="text-2xl font-mono font-bold text-white">{myBudget}</span>
          </div>
        </div>
        {targetMember && (
          <div className="mt-2 flex items-center gap-2 text-sm text-gray-400">
            <span>Budget {targetMember.user.username}:</span>
            <span className="font-mono text-white font-medium">{targetMember.currentBudget}</span>
          </div>
        )}
      </div>

      {/* TU CEDI (danger/red) */}
      <div className="px-4 py-4 border-b border-white/5">
        <div className="flex items-center gap-2 mb-2.5">
          <div className="w-7 h-7 rounded-full bg-danger-500/20 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-danger-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </div>
          <span className="text-sm font-bold text-danger-400 uppercase tracking-wider">Tu Cedi</span>
          {offeredEntries.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-danger-500/20 text-danger-400">
              {offeredEntries.length}
            </span>
          )}
        </div>

        {offeredEntries.length > 0 ? (
          <div className="space-y-2">
            {offeredEntries.map(entry => (
              <PlayerChip key={entry.id} entry={entry} onRemove={() => onRemoveOffered(entry.id)} accent="danger" onViewStats={onViewStats} />
            ))}
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={onOpenMyRoster}
              className="lg:hidden w-full py-4 border border-dashed border-danger-500/30 rounded-lg text-danger-400 text-sm font-medium hover:bg-danger-500/5 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Scegli dalla Rosa
            </button>
            <div className="hidden lg:flex items-center justify-center gap-3 py-4 text-gray-500">
              <svg className="w-5 h-5 text-danger-400/40 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="text-sm italic">Seleziona giocatori dalla colonna sinistra</span>
            </div>
          </>
        )}

        {/* Budget offerto */}
        <div className="mt-3 bg-danger-500/5 border border-danger-500/15 rounded-lg px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-danger-400 text-sm font-bold">$</span>
              <label className="text-sm text-gray-300 font-medium">
                Crediti offerti <span className="text-gray-500 text-xs">(max: {myBudget})</span>
              </label>
            </div>
            <BudgetStepper value={offeredBudget} onChange={onOfferedBudgetChange} max={myBudget} accent="danger" shortcuts />
          </div>
        </div>
      </div>

      {/* Swap divider */}
      <div className="flex items-center justify-center py-2 border-b border-white/5">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold text-danger-400/60 uppercase tracking-widest">Cedi</span>
          <div className="w-11 h-11 rounded-full bg-gradient-to-r from-danger-500/20 to-primary-500/20 border-2 border-white/15 flex items-center justify-center">
            <svg className="w-5 h-5 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>
          <span className="text-[10px] font-bold text-primary-400/60 uppercase tracking-widest">Ottieni</span>
        </div>
      </div>

      {/* TU OTTIENI (primary/green) */}
      <div className="px-4 py-4 border-b border-white/5">
        <div className="flex items-center gap-2 mb-2.5">
          <div className="w-7 h-7 rounded-full bg-primary-500/20 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
          <span className="text-sm font-bold text-primary-400 uppercase tracking-wider">Tu Ottieni</span>
          {requestedEntries.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-primary-500/20 text-primary-400">
              {requestedEntries.length}
            </span>
          )}
        </div>

        {requestedEntries.length > 0 ? (
          <div className="space-y-2">
            {requestedEntries.map(entry => (
              <PlayerChip key={entry.id} entry={entry} onRemove={() => onRemoveRequested(entry.id)} accent="primary" onViewStats={onViewStats} />
            ))}
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={onOpenPartnerRoster}
              className="lg:hidden w-full py-4 border border-dashed border-primary-500/30 rounded-lg text-primary-400 text-sm font-medium hover:bg-primary-500/5 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Scegli dal Partner
            </button>
            <div className="hidden lg:flex items-center justify-center gap-3 py-4 text-gray-500">
              <span className="text-sm italic">Seleziona giocatori dalla colonna destra</span>
              <svg className="w-5 h-5 text-primary-400/40 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </div>
          </>
        )}

        {/* Budget richiesto */}
        <div className="mt-3 bg-primary-500/5 border border-primary-500/15 rounded-lg px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-primary-400 text-sm font-bold">$</span>
              <label className="text-sm text-gray-300 font-medium">Crediti richiesti</label>
            </div>
            <BudgetStepper value={requestedBudget} onChange={onRequestedBudgetChange} accent="primary" shortcuts />
          </div>
        </div>
      </div>

      {/* Duration */}
      <div className="px-4 py-3 border-b border-white/5">
        <div className="bg-accent-500/5 border border-accent-500/15 rounded-lg px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <label className="text-sm text-gray-300 font-medium">Durata offerta</label>
            </div>
            <div className="inline-flex items-center">
              <button
                type="button"
                onClick={() => { if (durationIndex > 0) onDurationChange(DURATIONS[durationIndex - 1]!) }}
                disabled={durationIndex <= 0}
                className="w-11 h-11 lg:w-10 lg:h-10 bg-surface-300 border border-accent-500/30 rounded-l-lg text-white font-bold text-base disabled:opacity-30 hover:bg-surface-300/80 transition-colors flex items-center justify-center"
              >-</button>
              <div className="min-w-[56px] h-11 lg:h-10 px-3 bg-accent-500/5 border-y border-accent-500/30 text-accent-300 flex items-center justify-center font-mono font-bold text-lg">
                {formatDuration(offerDuration)}
              </div>
              <button
                type="button"
                onClick={() => { if (durationIndex < DURATIONS.length - 1) onDurationChange(DURATIONS[durationIndex + 1]!) }}
                disabled={durationIndex >= DURATIONS.length - 1}
                className="w-11 h-11 lg:w-10 lg:h-10 bg-surface-300 border border-accent-500/30 rounded-r-lg text-white font-bold text-base disabled:opacity-30 hover:bg-surface-300/80 transition-colors flex items-center justify-center"
              >+</button>
            </div>
          </div>
          {offerDuration > 0 && (
            <div className="mt-2 flex items-center gap-1.5 text-xs">
              <span className="text-gray-500">Scade:</span>
              <span className={`font-medium ${offerDuration <= 6 ? 'text-warning-400' : 'text-gray-300'}`}>
                {new Date(Date.now() + offerDuration * 3600000).toLocaleString('it-IT', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Message */}
      <div className="px-4 py-3 border-b border-white/5">
        <label className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-1.5 block">Messaggio (opzionale)</label>
        <textarea
          value={message}
          onChange={e => onMessageChange(e.target.value)}
          rows={3}
          className="w-full px-3 py-2.5 bg-surface-300 border border-white/10 rounded-lg text-white text-sm focus:border-primary-500 focus:outline-none placeholder:text-gray-500 resize-none"
          placeholder="Aggiungi un messaggio..."
        />
      </div>

      {/* Desktop submit */}
      <div className="hidden lg:block px-4 py-4">
        {/* Deal summary */}
        {(offerSummary || requestSummary) && (
          <div className="flex items-center justify-center gap-2 text-xs text-gray-400 mb-3">
            <span className="text-danger-400">{offerSummary || 'nulla'}</span>
            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            <span className="text-primary-400">{requestSummary || 'nulla'}</span>
          </div>
        )}
        {!canSubmit && !isSubmitting && (
          <p className="text-xs text-gray-400 text-center mb-2">Seleziona un destinatario e almeno un elemento da scambiare</p>
        )}
        <button
          type="submit"
          disabled={!canSubmit || isSubmitting}
          className="w-full py-3.5 rounded-xl font-bold text-base transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/25 hover:shadow-xl hover:shadow-primary-500/30 active:scale-[0.98]"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Invio in corso...
            </span>
          ) : (
            'Invia Offerta'
          )}
        </button>
      </div>
    </form>
  )
}
