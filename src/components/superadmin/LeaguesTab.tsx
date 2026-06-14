import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { LeagueCrest } from '../ui/LeagueCrest'
import { STATUS_LABELS, type League } from './types'

export interface LeaguesTabProps {
  leagueSearch: string
  leagueSearchInput: string
  setLeagueSearchInput: (value: string) => void
  onSearch: () => void
  onResetSearch: () => void
  leaguesLoading: boolean
  leagues: League[]
  expandedLeague: string | null
  setExpandedLeague: (id: string | null) => void
  onViewRoster: (memberId: string) => void
}

export function LeaguesTab({
  leagueSearch,
  leagueSearchInput,
  setLeagueSearchInput,
  onSearch,
  onResetSearch,
  leaguesLoading,
  leagues,
  expandedLeague,
  setExpandedLeague,
  onViewRoster,
}: LeaguesTabProps) {
  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="bg-surface-200 border border-surface-50 rounded-xl p-4">
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block micro-label text-gray-400 mb-1">Cerca lega o utente</label>
            <Input
              value={leagueSearchInput}
              onChange={(e) => { setLeagueSearchInput(e.target.value); }}
              placeholder="Nome lega o username..."
              onKeyDown={(e) => { if (e.key === 'Enter') onSearch(); }}
            />
          </div>
          <Button onClick={onSearch} variant="primary">
            Cerca
          </Button>
          {leagueSearch && (
            <Button variant="outline" onClick={onResetSearch}>
              Reset
            </Button>
          )}
        </div>
        {leagueSearch && (
          <p className="text-sm text-gray-400 mt-2">
            Risultati per: <span className="text-primary-400">"{leagueSearch}"</span>
          </p>
        )}
      </div>

      <div className="bg-surface-200 border border-surface-50 rounded-xl overflow-hidden">
        {leaguesLoading ? (
          <div className="p-8 text-center">
            <div className="w-10 h-10 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto"></div>
          </div>
        ) : leagues.length > 0 ? (
          <div className="divide-y divide-surface-50/10">
            {leagues.map((league) => (
              <div key={league.id}>
                <button
                  onClick={() => { setExpandedLeague(expandedLeague === league.id ? null : league.id); }}
                  className="w-full px-4 sm:px-6 py-4 flex items-center justify-between hover:bg-surface-300/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <LeagueCrest name={league.name} size="md" />
                    <div className="min-w-0">
                      <h3 className="font-display font-bold text-white truncate">{league.name}</h3>
                      <p className="text-sm text-gray-400">
                        {league._count.members} membri · {STATUS_LABELS[league.status] || league.status}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Budget iniziale</p>
                      <p className="stat-number text-accent-400 text-lg">{league.initialBudget}</p>
                    </div>
                    <span className={`text-gray-400 transition-transform ${expandedLeague === league.id ? 'rotate-180' : ''}`}>
                      ▼
                    </span>
                  </div>
                </button>

                {expandedLeague === league.id && (
                  <div className="px-4 sm:px-6 pb-4 bg-surface-300/30">
                    <h4 className="micro-label text-gray-400 mb-3">Membri della Lega</h4>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {league.members.map((member) => (
                        <div key={member.id} className="bg-surface-200 border border-surface-50 rounded-xl p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="min-w-0">
                              <p className="font-display font-bold text-white truncate">{member.user.username}</p>
                              <p className="text-xs text-gray-400 truncate">{member.user.email}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <span className={`font-mono text-[10px] font-bold tracking-[0.06em] px-2.5 py-1 rounded-md border ${
                                member.role === 'ADMIN'
                                  ? 'bg-accent-500/[0.13] text-accent-400 border-accent-500/40'
                                  : 'bg-surface-300 text-gray-400 border-surface-50'
                              }`}>
                                {member.role === 'ADMIN' ? 'Presidente' : 'DG'}
                              </span>
                              <p className="stat-number text-accent-400 text-base mt-1">{member.currentBudget}</p>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={(e) => {
                              e.stopPropagation()
                              onViewRoster(member.id)
                            }}
                          >
                            Vedi Rosa
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-400">
            <p>Nessuna lega trovata</p>
            {leagueSearch && <p className="text-sm mt-1">Prova a cercare con altri termini</p>}
          </div>
        )}
      </div>
    </div>
  )
}
