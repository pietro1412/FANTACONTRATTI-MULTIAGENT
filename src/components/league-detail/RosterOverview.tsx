import { Monogram } from '@/components/ui/Monogram'
import { RoleTag } from '@/components/league/attention'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatStat, NOT_DISPONIBILE } from '@/utils/stat-format'

export interface RosterMemberData {
  memberId: string
  username: string
  teamName: string | null
  role: string
  budget: number
  playerCount: number
  players: Array<{ position: string; age?: number | null; contract?: { salary: number } | null }>
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

function average(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

function averageAge(players: RosterMemberData['players']): number | null {
  return average(players.map(p => p.age).filter((a): a is number => a != null))
}

function averageAgeByPosition(players: RosterMemberData['players']): Record<(typeof POSITIONS)[number], number | null> {
  const result = {} as Record<(typeof POSITIONS)[number], number | null>
  for (const pos of POSITIONS) {
    result[pos] = average(players.filter(p => p.position === pos).map(p => p.age).filter((a): a is number => a != null))
  }
  return result
}

function formatAge(age: number | null): string {
  return formatStat(age, { decimals: 1, fallback: NOT_DISPONIBILE })
}

function Field({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <p className="micro-label text-gray-500">{label}</p>
      <p className={`font-mono text-sm mt-0.5 ${tone ?? 'text-gray-200'}`}>{value}</p>
    </div>
  )
}

/** Colonne condivise fra header e righe della tabella avversari (desktop). */
const OPPONENTS_TABLE_GRID = 'grid-cols-[minmax(160px,1.6fr)_76px_44px_44px_44px_44px_84px_70px_20px]'

function PositionChips({ counts, slotLimits }: { counts: PositionCounts; slotLimits: RosterOverviewProps['slotLimits'] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {POSITIONS.map(pos => (
        <span key={pos} className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-bold font-mono ${POS_STYLE[pos]}`}>
          <span className={`w-2 h-2 rounded-full ${POS_DOT[pos]}`} aria-hidden="true" />
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
                    <span className="font-display text-base font-bold text-white">{mine.teamName || mine.username}</span>
                    <span className="text-xs font-bold text-secondary-400 border border-secondary-500/50 rounded px-1.5 py-px tracking-wide">TU</span>
                    {mine.role === 'ADMIN' && <RoleTag role={mine.role} />}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{mine.playerCount}/{totalSlots} slot occupati</p>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="micro-label text-gray-500">Bilancio</p>
                <p className="budget-display text-3xl text-accent-400 leading-none mt-1">
                  {computeAvailableBudget(mine)}<span className="text-base text-gray-500 ml-0.5">M</span>
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

          {/* Desktop: tabella vera con età media rosa, età media per reparto e budget residuo. */}
          <div className="hidden md:block mt-2">
            <div className={`grid ${OPPONENTS_TABLE_GRID} gap-2 px-4`}>
              <span className="micro-label text-gray-500">Squadra</span>
              <span className="micro-label text-gray-500 text-right">Età rosa</span>
              <span className="micro-label text-gray-500 text-center col-span-4">Età media per reparto</span>
              <span className="micro-label text-gray-500 text-right">Bilancio</span>
              <span className="micro-label text-gray-500 text-right">Rosa</span>
              <span />
            </div>
            <div className={`grid ${OPPONENTS_TABLE_GRID} gap-2 px-4 pb-1.5`}>
              <span /><span />
              <span className="micro-label text-gray-600 text-center">P</span>
              <span className="micro-label text-gray-600 text-center">D</span>
              <span className="micro-label text-gray-600 text-center">C</span>
              <span className="micro-label text-gray-600 text-center">A</span>
              <span /><span /><span />
            </div>
            <div className="space-y-1.5">
              {others.map(r => {
                const posAges = averageAgeByPosition(r.players)
                return (
                  <button
                    key={r.memberId}
                    onClick={() => { onNavigate('rose', { leagueId, memberId: r.memberId }); }}
                    className={`grid ${OPPONENTS_TABLE_GRID} gap-2 items-center w-full bg-surface-200 border border-surface-50/20 rounded-lg px-4 py-3 hover:border-primary-500/50 hover:bg-surface-100/30 transition-colors text-left`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <Monogram name={r.teamName || r.username} size="sm" />
                      <span className="text-sm font-bold text-white truncate">{r.teamName || r.username}</span>
                      {r.role === 'ADMIN' && <RoleTag role={r.role} />}
                    </span>
                    <span className="font-mono text-sm text-gray-200 text-right">{formatAge(averageAge(r.players))}</span>
                    <span className="font-mono text-xs text-gray-400 text-center">{formatAge(posAges.P)}</span>
                    <span className="font-mono text-xs text-gray-400 text-center">{formatAge(posAges.D)}</span>
                    <span className="font-mono text-xs text-gray-400 text-center">{formatAge(posAges.C)}</span>
                    <span className="font-mono text-xs text-gray-400 text-center">{formatAge(posAges.A)}</span>
                    <span className="budget-display text-sm text-accent-400 text-right">{computeAvailableBudget(r)}<span className="text-xs text-gray-500">M</span></span>
                    <span className="text-sm text-gray-500 font-mono text-right">{r.playerCount}/{totalSlots}</span>
                    <span className="text-gray-500 text-base text-right" aria-hidden="true">›</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Mobile: card impilate con label esplicite per ogni dato (niente troncamento/colonne strette). */}
          <div className="md:hidden mt-2 space-y-2">
            {others.map(r => {
              const posAges = averageAgeByPosition(r.players)
              return (
                <button
                  key={r.memberId}
                  onClick={() => { onNavigate('rose', { leagueId, memberId: r.memberId }); }}
                  className="w-full text-left bg-surface-200 border border-surface-50/20 rounded-lg p-4 hover:border-primary-500/50 hover:bg-surface-100/30 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 min-w-0">
                      <Monogram name={r.teamName || r.username} size="md" />
                      <span className="text-sm font-bold text-white truncate">{r.teamName || r.username}</span>
                      {r.role === 'ADMIN' && <RoleTag role={r.role} />}
                    </span>
                    <span className="text-gray-500 text-base flex-shrink-0" aria-hidden="true">›</span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    <Field label="Età media rosa" value={formatAge(averageAge(r.players))} />
                    <Field label="Bilancio" value={`${computeAvailableBudget(r)}M`} tone="text-accent-400" />
                    <Field label="Rosa" value={`${r.playerCount}/${totalSlots}`} />
                  </div>
                  <div className="mt-3 pt-3 border-t border-surface-50/10">
                    <p className="micro-label text-gray-500 mb-2">Età media per reparto</p>
                    <div className="grid grid-cols-4 gap-2">
                      <Field label="P" value={formatAge(posAges.P)} />
                      <Field label="D" value={formatAge(posAges.D)} />
                      <Field label="C" value={formatAge(posAges.C)} />
                      <Field label="A" value={formatAge(posAges.A)} />
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
