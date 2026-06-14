import { LeagueCrest } from '@/components/ui/LeagueCrest'
import { RoleTag } from '@/components/league/attention'

export interface ProfileLeagueMembership {
  id: string
  role: string
  teamName?: string
  league: { id: string; name: string }
}

interface MyTeamsListProps {
  memberships: ProfileLeagueMembership[]
  onOpenLeague: (leagueId: string) => void
}

/** Le mie squadre: crest + nome squadra + RoleTag + CTA "Apri" verso l'hub di lega. */
export function MyTeamsList({ memberships, onOpenLeague }: MyTeamsListProps) {
  if (memberships.length === 0) return null

  return (
    <section className="bg-surface-200 border border-surface-50/20 rounded-2xl p-5">
      <h3 className="micro-label text-gray-400 mb-2">Le mie squadre</h3>
      <div>
        {memberships.map((m, i) => (
          <button
            key={m.id}
            type="button"
            onClick={() => { onOpenLeague(m.league.id) }}
            className={`w-full flex items-center gap-3 py-3 text-left group focus:outline-none ${
              i < memberships.length - 1 ? 'border-b border-surface-50/20' : ''
            }`}
          >
            <LeagueCrest name={m.league.name} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-display font-bold text-white text-sm truncate">
                  {m.teamName || 'Squadra senza nome'}
                </span>
                <RoleTag role={m.role} />
              </div>
              <p className="text-[11px] text-gray-500 truncate">{m.league.name}</p>
            </div>
            <span className="text-[11px] font-semibold text-primary-400 group-hover:text-primary-300 transition-colors flex-shrink-0">
              Apri →
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
