import { ChevronDown } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'

export interface HistoryMember {
  memberId: string
  teamName: string | null
  username: string
  baseReincrement: number
  categoryPrizes: Record<string, number>
  total: number
}

export interface HistoryCategory {
  name: string
  isSystemPrize: boolean
}

export interface HistorySession {
  sessionId: string
  type: string
  season: number
  semester: string
  finalizedAt: string
  baseReincrement: number
  categories: HistoryCategory[]
  members: HistoryMember[]
}

interface PrizeHistoryAccordionProps {
  history: HistorySession[]
  expandedId: string | null
  onToggle: (sessionId: string) => void
}

function formatSessionType(type: string, season: number, semester: string) {
  const typeMap: Record<string, string> = {
    PRIMO_MERCATO: 'Primo Mercato',
    SECONDO_MERCATO: 'Secondo Mercato',
  }
  const semesterMap: Record<string, string> = {
    FIRST: '1° Semestre',
    SECOND: '2° Semestre',
  }
  return `${typeMap[type] || type} - Stagione ${season} - ${semesterMap[semester] || semester}`
}

export function PrizeHistoryAccordion({ history, expandedId, onToggle }: PrizeHistoryAccordionProps) {
  if (history.length === 0) {
    return (
      <EmptyState
        icon="📜"
        title="Nessuno storico premi disponibile"
        description="I premi finalizzati nelle stagioni precedenti appariranno qui."
        compact
      />
    )
  }

  return (
    <div className="space-y-4">
      {history.map(session => {
        const isExpanded = expandedId === session.sessionId

        return (
          <div key={session.sessionId} className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
            {/* Session header - clickable */}
            <button
              onClick={() => { onToggle(session.sessionId); }}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-surface-100/50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-2xl flex-shrink-0" aria-hidden="true">🏆</span>
                <div className="text-left min-w-0">
                  <p className="font-display font-bold text-white truncate">
                    {formatSessionType(session.type, session.season, session.semester)}
                  </p>
                  <p className="text-sm text-gray-500">
                    Finalizzato il {new Date(session.finalizedAt).toLocaleDateString('it-IT')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="micro-label">Base {session.baseReincrement}M</span>
                <ChevronDown
                  size={18}
                  className={`text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                />
              </div>
            </button>

            {/* Expanded details */}
            {isExpanded && (
              <div className="px-4 pb-4 border-t border-surface-50/20">
                {/* Categories legend */}
                <div className="flex flex-wrap items-center gap-2 py-3 mb-3">
                  <span className="micro-label">Categorie</span>
                  {session.categories.map(cat => (
                    <span
                      key={cat.name}
                      className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                        cat.isSystemPrize
                          ? 'bg-accent-500/15 text-accent-400 border border-accent-500/30'
                          : 'bg-primary-500/15 text-primary-400 border border-primary-500/30'
                      }`}
                    >
                      {cat.name}
                    </span>
                  ))}
                </div>

                {/* Members table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-surface-50/20">
                        <th className="text-left py-2 micro-label">Manager</th>
                        <th className="text-center py-2 micro-label">Base</th>
                        {session.categories.map(cat => (
                          <th key={cat.name} className="text-center py-2 micro-label whitespace-nowrap">
                            {cat.name.length > 15 ? cat.name.substring(0, 15) + '...' : cat.name}
                          </th>
                        ))}
                        <th className="text-center py-2 micro-label text-accent-400">Totale</th>
                      </tr>
                    </thead>
                    <tbody>
                      {session.members.map(member => (
                        <tr key={member.memberId} className="border-b border-surface-50/10 hover:bg-surface-100/30">
                          <td className="py-2">
                            <div>
                              <p className="font-display font-bold text-white">{member.teamName || 'Team'}</p>
                              <p className="text-xs text-gray-500">{member.username}</p>
                            </div>
                          </td>
                          <td className="text-center py-2 font-mono text-gray-300">{member.baseReincrement}M</td>
                          {session.categories.map(cat => (
                            <td key={cat.name} className="text-center py-2 font-mono text-gray-300">
                              {member.categoryPrizes[cat.name] ?? 0}M
                            </td>
                          ))}
                          <td className="text-center py-2 stat-number text-accent-400">{member.total}M</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
