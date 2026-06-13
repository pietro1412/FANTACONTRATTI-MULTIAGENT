import { Button } from '@/components/ui/Button'
import { buildActions, type LeagueSummary, type NavigateFn, type ActionTone } from '@/components/league/attention'

interface AttentionRailProps {
  leagueId: string
  summary: LeagueSummary | undefined
  onNavigate: NavigateFn
}

// Stile della card per tono (riusa la semantica colori della rotaia Dashboard).
const CARD_TONE: Record<ActionTone, { border: string; iconBg: string }> = {
  urgent: { border: 'border-danger-500/50 ring-1 ring-danger-500/15', iconBg: 'bg-danger-500/15 text-danger-400' },
  info: { border: 'border-primary-500/45', iconBg: 'bg-primary-500/15 text-primary-400' },
  warn: { border: 'border-accent-500/45', iconBg: 'bg-accent-500/15 text-accent-400' },
  admin: { border: 'border-purple-500/45', iconBg: 'bg-purple-500/15 text-purple-400' },
}

/**
 * Rotaia "Richiede la tua attenzione" filtrata sulla lega corrente.
 * Riusa buildActions (stessa logica della Dashboard): se non ci sono segnali, non rende nulla.
 */
export function AttentionRail({ leagueId, summary, onNavigate }: AttentionRailProps) {
  const actions = buildActions(leagueId, summary, onNavigate)
  if (actions.length === 0) return null

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <span className="micro-label text-accent-400">⚡ Richiede la tua attenzione</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {actions.map((action) => {
          const tone = CARD_TONE[action.tone]
          return (
            <div
              key={action.key}
              className={`flex items-center gap-3 bg-surface-200 border rounded-xl p-3.5 ${tone.border}`}
            >
              <span className={`w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0 ${tone.iconBg}`} aria-hidden="true">
                {action.emoji}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-display text-sm font-bold text-white leading-snug">{action.text}</p>
                {action.sub && <p className="text-[11px] text-gray-400 mt-0.5">{action.sub}</p>}
              </div>
              <Button variant={action.ctaVariant} size="sm" className="flex-shrink-0" onClick={() => { action.go() }}>
                {action.ctaLabel}
              </Button>
            </div>
          )
        })}
      </div>
    </section>
  )
}
