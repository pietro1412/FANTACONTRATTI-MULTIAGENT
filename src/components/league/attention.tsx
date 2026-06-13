// Segnali "Richiede la tua attenzione" per-lega.
// Fonte unica condivisa da Dashboard (hub globale) e LeagueDetail (hub di lega):
// stessa logica di derivazione delle azioni dal summary di GET /api/leagues/dashboard-summary.

export type NavigateFn = (page: string, params?: Record<string, string>) => void

// Per-league signals from GET /api/leagues/dashboard-summary (see league.service.ts).
export interface LeagueSummary {
  phase: { type: string; currentPhase: string | null } | null
  tradeOffersReceived: number
  isAdmin: boolean
  pendingJoinRequests: number
  pendingAppeals: number
  needsConsolidation: boolean
  isYourTurn: boolean
  turnTarget: { kind: 'auction' | 'rubata' | 'svincolati'; sessionId: string } | null
}

const PHASE_LABELS: Record<string, string> = {
  ASTA_LIBERA: 'Asta in corso',
  OFFERTE_PRE_RINNOVO: 'Offerte pre-rinnovo',
  PREMI: 'Fase premi',
  CONTRATTI: 'Rinnovo contratti',
  RUBATA: 'Rubata',
  ASTA_SVINCOLATI: 'Asta svincolati',
  OFFERTE_POST_ASTA_SVINCOLATI: 'Offerte post-svincolati',
}

export function phaseLabel(summary?: LeagueSummary): string | null {
  if (!summary?.phase?.currentPhase) return null
  if (summary.phase.type === 'PRIMO_MERCATO' && summary.phase.currentPhase === 'ASTA_LIBERA') {
    return 'Primo Mercato · Asta'
  }
  return PHASE_LABELS[summary.phase.currentPhase] || summary.phase.currentPhase
}

export type ActionTone = 'urgent' | 'info' | 'warn' | 'admin'

export interface DashAction {
  key: string
  chip: string
  emoji: string
  text: string
  sub?: string
  tone: ActionTone
  ctaLabel: string
  ctaVariant: 'primary' | 'accent'
  go: () => void
}

export const TONE_CHIP: Record<ActionTone, string> = {
  urgent: 'bg-danger-500/15 text-danger-400 border border-danger-500/40',
  info: 'bg-primary-500/15 text-primary-400 border border-primary-500/40',
  warn: 'bg-accent-500/15 text-accent-400 border border-accent-500/40',
  admin: 'bg-purple-500/15 text-purple-400 border border-purple-500/40',
}

/** Deriva le azioni in sospeso per una lega dal suo summary. */
export function buildActions(leagueId: string, summary: LeagueSummary | undefined, onNavigate: NavigateFn): DashAction[] {
  const out: DashAction[] = []
  if (!summary) return out

  // Highest priority: it is the user's turn to act in an auction phase.
  if (summary.isYourTurn) {
    const target = summary.turnTarget
    const sub =
      target?.kind === 'svincolati'
        ? 'tocca a te nominare un giocatore svincolato'
        : target?.kind === 'rubata'
          ? 'tocca a te nella rubata'
          : 'tocca a te nominare un giocatore'
    out.push({
      key: 'your-turn',
      chip: '🔴 Tocca a te',
      emoji: '🔴',
      text: 'È il tuo turno',
      sub,
      tone: 'urgent',
      ctaLabel: 'Entra →',
      ctaVariant: 'primary',
      go: () => {
        if (target?.kind === 'auction') {
          onNavigate('auction', { leagueId, sessionId: target.sessionId })
        } else if (target?.kind === 'rubata') {
          onNavigate('rubata', { leagueId })
        } else if (target?.kind === 'svincolati') {
          onNavigate('svincolati', { leagueId })
        } else {
          onNavigate('leagueDetail', { leagueId })
        }
      },
    })
  }

  if (summary.tradeOffersReceived > 0) {
    const n = summary.tradeOffersReceived
    out.push({
      key: 'trades',
      chip: `📨 ${n}`,
      emoji: '📨',
      text: `${n} ${n === 1 ? 'offerta di scambio' : 'offerte di scambio'} da valutare`,
      tone: 'info',
      ctaLabel: 'Valuta offerte →',
      ctaVariant: 'primary',
      go: () => { onNavigate('trades', { leagueId }) },
    })
  }

  if (summary.needsConsolidation) {
    out.push({
      key: 'consolidation',
      chip: '📝 Consolida',
      emoji: '📝',
      text: 'Consolidamento contratti da completare',
      sub: 'la fase contratti è aperta',
      tone: 'warn',
      ctaLabel: 'Vai ai contratti →',
      ctaVariant: 'accent',
      go: () => { onNavigate('contracts', { leagueId }) },
    })
  }

  if (summary.isAdmin && summary.pendingJoinRequests > 0) {
    const n = summary.pendingJoinRequests
    out.push({
      key: 'requests',
      chip: `🙋 ${n}`,
      emoji: '🙋',
      text: `${n} ${n === 1 ? 'richiesta di adesione' : 'richieste di adesione'} da approvare`,
      tone: 'admin',
      ctaLabel: 'Pannello Admin',
      ctaVariant: 'accent',
      go: () => { onNavigate('adminPanel', { leagueId, tab: 'members' }) },
    })
  }

  if (summary.isAdmin && summary.pendingAppeals > 0) {
    const n = summary.pendingAppeals
    out.push({
      key: 'appeals',
      chip: `⚖ ${n}`,
      emoji: '⚖️',
      text: `${n} ${n === 1 ? 'ricorso' : 'ricorsi'} da gestire`,
      tone: 'admin',
      ctaLabel: 'Gestisci ricorsi',
      ctaVariant: 'accent',
      go: () => { onNavigate('adminPanel', { leagueId, tab: 'appeals' }) },
    })
  }

  return out
}

/** Badge ruolo: Presidente (admin) o DG (manager). Fonte unica. */
export function RoleTag({ role }: { role: string }) {
  return role === 'ADMIN' ? (
    <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-accent-500/15 text-accent-400 border border-accent-500/30">
      Presidente
    </span>
  ) : (
    <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary-500/15 text-primary-400 border border-primary-500/30">
      DG
    </span>
  )
}
