import { Monogram } from '@/components/ui/Monogram'
import { RoleTag } from '@/components/league/attention'
import { EmptyState } from '@/components/ui/EmptyState'

export interface RosterMemberData {
  memberId: string
  username: string
  teamName: string | null
  role: string
  budget: number
  playerCount: number
  players: Array<{ position: string; contract?: { salary: number } | null }>
}

interface RosterOverviewProps {
  rosters: RosterMemberData[]
  myMemberId: string | null
  slotLimits: { P: number; D: number; C: number; A: number }
  leagueId: string
  onNavigate: (page: string, params?: Record<string, string>) => void
}

type PositionCounts = { P: number; D: number; C: number; A: number }

const POSITIONS = ['P', 'D', 'C', 'A'] as const
const POS_STYLE: Record<(typeof POSITIONS)[number], string> = {
  P: 'bg-accent-500/12 text-accent-400',
  D: 'bg-primary-500/12 text-primary-400',
  C: 'bg-secondary-500/12 text-secondary-400',
  A: 'bg-danger-500/12 text-danger-400',
}
const POS_DOT: Record<(typeof POSITIONS)[number], string> = {
  P: 'bg-accent-500',
  D: 'bg-primary-500',
  C: 'bg-secondary-500',
  A: 'bg-danger-500',
}

function countByPosition(players: RosterMemberData['players']): PositionCounts {
  const counts: PositionCounts = { P: 0, D: 0, C: 0, A: 0 }
  for (const p of players) {
    if (p.position === 'P' || p.position === 'D' || p.position === 'C' || p.position === 'A') counts[p.position]++
  }
  return counts
}

/** Budget - monte ingaggi, stessa definizione di "disponibile"/"bilancio" usata in FinancialKPIs/Finanze. */
function computeAvailableBudget(member: RosterMemberData): number {
  const monteIngaggi = member.players.reduce((sum, p) => sum + (p.contract?.salary || 0), 0)
  return member.budget - monteIngaggi
}

function PositionChips({ counts, slotLimits }: { counts: PositionCounts; slotLimits: RosterOverviewProps['slotLimits'] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {POSITIONS.map(pos => (
        <span key={pos} className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] font-bold font-mono ${POS_STYLE[pos]}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${POS_DOT[pos]}`} aria-hidden="true" />
          {pos} {counts[pos]}<span className="opacity-50 font-semibold">/{slotLimits[pos]}</span>
        </span>
      ))}
    </div>
  )
}

/**
 * "La mia rosa" + "Rose degli avversari": budget e composizione per ruolo di
 * ogni manager, ogni rosa cliccabile → pagina Rose con quel manager selezionato.
 * Niente classifica bilanci/movimenti/KPI di lega qui: vivono già nelle loro
 * pagine dedicate (Finanze, Storico) — non duplicati (mockup 28-dashboard-lega/E).
 */
export function RosterOverview({ rosters, myMemberId, slotLimits, leagueId, onNavigate }: RosterOverviewProps) {
  if (rosters.length === 0) {
    return <EmptyState compact icon="👥" title="Nessuna rosa disponibile" />
  }

  const mine = rosters.find(r => r.memberId === myMemberId) ?? null
  const others = rosters.filter(r => r.memberId !== myMemberId)
  const totalSlots = slotLimits.P + slotLimits.D + slotLimits.C + slotLimits.A

  return (
    <div className="space-y-6">
      {mine && (
        <div>
          <span className="micro-label text-gray-400">La mia rosa</span>
          <button
            onClick={() => { onNavigate('rose', { leagueId }); }}
            className="mt-2 w-full text-left bg-surface-200 border border-secondary-500/35 rounded-xl p-4 sm:p-5 hover:border-secondary-500/70 hover:bg-surface-100/40 transition-colors relative overflow-hidden group"
          >
            <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-secondary-500" aria-hidden="true" />
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <Monogram name={mine.teamName || mine.username} size="md" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-display text-sm font-bold text-white">{mine.teamName || mine.username}</span>
                    <span className="text-[9px] font-bold text-secondary-400 border border-secondary-500/50 rounded px-1.5 py-px tracking-wide">TU</span>
                    {mine.role === 'ADMIN' && <RoleTag role={mine.role} />}
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5">{mine.playerCount}/{totalSlots} slot occupati</p>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="micro-label text-gray-500">Budget disponibile</p>
                <p className="budget-display text-2xl text-accent-400 leading-none mt-1">
                  {computeAvailableBudget(mine)}<span className="text-sm text-gray-500 ml-0.5">M</span>
                </p>
              </div>
            </div>
            <div className="mt-3.5">
              <PositionChips counts={countByPosition(mine.players)} slotLimits={slotLimits} />
            </div>
            <span className="absolute right-4 bottom-4 text-gray-500 text-sm group-hover:text-secondary-400 transition-colors" aria-hidden="true">↗</span>
          </button>
        </div>
      )}

      {others.length > 0 && (
        <div>
          <span className="micro-label text-gray-400">Rose degli avversari</span>
          <div className="mt-2 space-y-1.5">
            {others.map(r => (
              <button
                key={r.memberId}
                onClick={() => { onNavigate('rose', { leagueId, memberId: r.memberId }); }}
                className="w-full flex items-center gap-3 bg-surface-200 border border-surface-50/20 rounded-lg px-3.5 py-2.5 hover:border-primary-500/50 hover:bg-surface-100/30 transition-colors text-left"
              >
                <Monogram name={r.teamName || r.username} size="sm" />
                <span className="text-[12.5px] font-bold text-white flex-shrink-0 w-28 truncate flex items-center gap-1.5">
                  {r.teamName || r.username}
                  {r.role === 'ADMIN' && <RoleTag role={r.role} />}
                </span>
                <span className="flex-1 min-w-0">
                  <PositionChips counts={countByPosition(r.players)} slotLimits={slotLimits} />
                </span>
                <span className="text-[11px] text-gray-500 font-mono flex-shrink-0">{r.playerCount}/{totalSlots}</span>
                <span className="text-gray-500 text-sm flex-shrink-0" aria-hidden="true">›</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
