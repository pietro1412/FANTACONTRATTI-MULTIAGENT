import { useState } from 'react'
import { AppealCard } from './AdminActionsPanel'
import type { Appeal } from '../admin/types'
import type { MarketProgress, MyRosterSlots } from '../../types/auctionroom.types'

const TIMER_PRESETS = [5, 10, 15, 20, 25, 30, 45, 60]

export interface CockpitRailAdminBarProps {
  marketProgress: MarketProgress | null
  isPrimoMercato: boolean
  myRosterSlots?: MyRosterSlots | null
  isAdmin: boolean
  canCloseAuction: boolean
  onCloseAuction?: () => void
  canReopenAuction: boolean
  onReopenAuction?: () => void
  pendingAppeals: Appeal[]
  resolvingAppealId: string | null
  onResolveAppeal: (appealId: string, decision: 'ACCEPTED' | 'REJECTED', resolutionNote?: string) => void
  timerSetting: number
  onUpdateTimer?: (seconds: number) => void
}

/**
 * P7 — Riga 2 del cockpit asta (solo desktop): rail ruoli compressa a
 * sinistra (P ✓ → D ✓ → C · 2/6 → A) + progresso slot lega, azioni admin
 * compatte a destra SEMPRE visibili (preset timer · Concludi · Annulla ·
 * ricorsi in overlay). Mockup: railadmin in cockpit.html.
 */
export function CockpitRailAdminBar({
  marketProgress,
  isPrimoMercato,
  myRosterSlots,
  isAdmin,
  canCloseAuction,
  onCloseAuction,
  canReopenAuction,
  onReopenAuction,
  pendingAppeals,
  resolvingAppealId,
  onResolveAppeal,
  timerSetting,
  onUpdateTimer,
}: CockpitRailAdminBarProps) {
  const [appealsOpen, setAppealsOpen] = useState(false)
  const [notes, setNotes] = useState<Record<string, string>>({})

  const hasRail = isPrimoMercato && !!marketProgress
  if (!hasRail && !isAdmin) return null

  const currentIndex = marketProgress ? marketProgress.roleSequence.indexOf(marketProgress.currentRole) : -1
  const progressPercent = marketProgress && marketProgress.totalSlots > 0
    ? Math.round((marketProgress.filledSlots / marketProgress.totalSlots) * 100)
    : 0
  const appealsCount = pendingAppeals.length

  const railStepBase = 'inline-flex items-center gap-1 font-mono text-[10px] font-bold tracking-[0.07em] rounded-full border px-2.5 py-0.5 whitespace-nowrap'

  return (
    <div className="relative flex items-center gap-2 bg-surface-300 border border-surface-50 rounded-xl px-3 py-1.5 min-h-[40px]">
      {/* Rail ruoli compressa */}
      {hasRail && marketProgress && (
        <>
          <div className="flex items-center gap-1.5 min-w-0 overflow-x-auto">
            {marketProgress.roleSequence.map((role, i) => {
              const isDone = currentIndex >= 0 && i < currentIndex
              const isActive = role === marketProgress.currentRole
              const mySlot = myRosterSlots?.slots[role as 'P' | 'D' | 'C' | 'A']
              return (
                <span key={role} className="flex items-center gap-1.5">
                  {i > 0 && <span className="text-gray-600 text-[11px]" aria-hidden="true">→</span>}
                  <span
                    className={`${railStepBase} ${
                      isActive
                        ? 'text-accent-400 border-accent-500/55 bg-accent-500/10'
                        : isDone
                          ? 'text-secondary-400 border-secondary-500/45 bg-secondary-500/[0.07]'
                          : 'text-gray-500 border-surface-50'
                    }`}
                  >
                    {role}
                    {isDone && ' ✓'}
                    {isActive && mySlot && ` · ${mySlot.filled}/${mySlot.total}`}
                  </span>
                </span>
              )
            })}
          </div>
          <span className="micro-label ml-2 flex-shrink-0 hidden xl:inline">
            Slot lega {marketProgress.filledSlots}/{marketProgress.totalSlots}
          </span>
          <div className="w-[120px] h-1 rounded-full bg-surface-50 overflow-hidden flex-shrink-0">
            <div className="h-full progress-gradient" style={{ width: `${progressPercent}%` }} />
          </div>
        </>
      )}

      <span className="flex-1" />

      {/* Azioni admin compatte, sempre visibili */}
      {isAdmin && (
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="micro-label">Admin</span>
          {onUpdateTimer && (
            <span className="flex items-center gap-1">
              <span className="micro-label tracking-[0.08em]">Timer</span>
              {TIMER_PRESETS.map(sec => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => { onUpdateTimer(sec); }}
                  className={`font-mono text-[10.5px] font-bold rounded-[7px] border px-2 py-1 transition-colors ${
                    timerSetting === sec
                      ? 'text-dark-300 bg-accent-400 border-accent-400'
                      : 'text-gray-300 bg-surface-200 border-surface-50 hover:text-white'
                  }`}
                >
                  {sec}s
                </button>
              ))}
            </span>
          )}
          <span className="w-px h-4 bg-surface-50" aria-hidden="true" />
          <button
            type="button"
            onClick={onCloseAuction}
            disabled={!canCloseAuction}
            className="text-[11.5px] font-semibold text-accent-400 border border-accent-500/50 bg-accent-500/[0.07] rounded-[7px] px-2.5 py-1 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent-500/15 transition-colors"
          >
            Concludi asta
          </button>
          <button
            type="button"
            onClick={onReopenAuction}
            disabled={!canReopenAuction}
            title="Riapre l'ultima asta conclusa. Disponibile finché non parte la prossima asta."
            className="text-[11.5px] font-semibold text-gray-200 border border-surface-50 bg-surface-200 rounded-[7px] px-2.5 py-1 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-100 transition-colors"
          >
            Annulla ultimo
          </button>
          {appealsCount > 0 && (
            <button
              type="button"
              onClick={() => { setAppealsOpen(prev => !prev); }}
              aria-expanded={appealsOpen}
              className="text-[11.5px] font-bold text-danger-400 border border-danger-500/50 bg-danger-500/[0.06] rounded-[7px] px-2.5 py-1 hover:bg-danger-500/15 transition-colors"
            >
              {appealsCount} {appealsCount === 1 ? 'ricorso' : 'ricorsi'} {appealsOpen ? '▲' : '▼'}
            </button>
          )}
        </div>
      )}

      {/* Overlay risoluzione ricorsi (non spinge il layout del cockpit) */}
      {isAdmin && appealsOpen && appealsCount > 0 && (
        <div className="absolute top-full right-0 mt-1.5 w-[460px] max-h-[60vh] overflow-y-auto z-40 bg-surface-200 border border-danger-500/40 rounded-xl shadow-card-hover p-3 space-y-3">
          {pendingAppeals.map(appeal => (
            <AppealCard
              key={appeal.id}
              appeal={appeal}
              isResolving={resolvingAppealId === appeal.id}
              note={notes[appeal.id] ?? ''}
              onNoteChange={value => { setNotes(prev => ({ ...prev, [appeal.id]: value })); }}
              onResolve={decision => { onResolveAppeal(appeal.id, decision, notes[appeal.id]?.trim() || undefined); }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
