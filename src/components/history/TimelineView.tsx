import { useState, useEffect } from 'react'
import { historyApi } from '../../services/api'

interface SessionSummary {
  id: string
  type: string
  season: number
  semester: string
}

interface TimelineEvent {
  id: string
  type: string
  createdAt: string
  player: {
    id: string
    name: string
    position: string
    team: string
  }
  from: {
    memberId: string
    username: string
    teamName: string | null
  } | null
  to: {
    memberId: string
    username: string
    teamName: string | null
  } | null
  price: number | null
  contract: {
    salary: number
    duration: number
    clause: number | null
  } | null
  session: {
    type: string
    season: number
    semester: string
  } | null
}

interface TimelineViewProps {
  leagueId: string
  sessions: SessionSummary[]
}

const eventTypeConfig: Record<string, { label: string; color: string }> = {
  FIRST_MARKET: { label: 'Asta', color: 'text-yellow-400' },
  TRADE: { label: 'Scambio', color: 'text-blue-400' },
  RUBATA: { label: 'Rubata', color: 'text-red-400' },
  SVINCOLATI: { label: 'Svincolati', color: 'text-green-400' },
  RELEASE: { label: 'Cessione', color: 'text-gray-400' },
  CONTRACT_RENEW: { label: 'Rinnovo', color: 'text-purple-400' },
  // Indemnity movement types
  RETIREMENT: { label: 'Ritiro', color: 'text-gray-500' },
  RELEGATION_RELEASE: { label: 'Retrocesso (Rilascio)', color: 'text-amber-500' },
  RELEGATION_KEEP: { label: 'Retrocesso (Mantenuto)', color: 'text-amber-400' },
  ABROAD_COMPENSATION: { label: 'Estero (Compenso)', color: 'text-cyan-400' },
  ABROAD_KEEP: { label: 'Estero (Mantenuto)', color: 'text-cyan-300' },
}

const positionColors: Record<string, string> = {
  P: 'bg-amber-500/20 text-amber-400',
  D: 'bg-blue-500/20 text-blue-400',
  C: 'bg-emerald-500/20 text-emerald-400',
  A: 'bg-red-500/20 text-red-400',
}

export function TimelineView({ leagueId, sessions }: TimelineViewProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)
  const [filterTypes, setFilterTypes] = useState<string[]>([])
  const [filterSession, setFilterSession] = useState<string>('')

  const limit = 50

  useEffect(() => {
    loadEvents(true)
  }, [leagueId, filterTypes, filterSession])

  async function loadEvents(reset = false) {
    if (reset) {
      setOffset(0)
      setEvents([])
    }
    setIsLoading(true)

    try {
      const result = await historyApi.getTimeline(leagueId, {
        limit,
        offset: reset ? 0 : offset,
        eventTypes: filterTypes.length > 0 ? filterTypes : undefined,
        sessionId: filterSession || undefined,
      })

      if (result.success && result.data) {
        const data = result.data as { events: TimelineEvent[]; hasMore: boolean }
        if (reset) {
          setEvents(data.events)
        } else {
          setEvents(prev => [...prev, ...data.events])
        }
        setHasMore(data.hasMore)
        setOffset(prev => (reset ? limit : prev + limit))
      }
    } catch (err) {
      console.error('Error loading timeline:', err)
    }
    setIsLoading(false)
  }

  function toggleTypeFilter(type: string) {
    setFilterTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    )
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Group events by date
  const eventsByDate: Record<string, TimelineEvent[]> = {}
  for (const event of events) {
    const date = formatDate(event.createdAt)
    if (!eventsByDate[date]) {
      eventsByDate[date] = []
    }
    eventsByDate[date].push(event)
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-surface-200 rounded-xl border border-surface-50/20 p-4">
        <div className="flex flex-wrap gap-4 items-center">
          {/* Event Type Filters */}
          <div className="flex flex-wrap gap-2">
            {Object.entries(eventTypeConfig).map(([type, config]) => (
              <button
                key={type}
                onClick={() => toggleTypeFilter(type)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filterTypes.includes(type)
                    ? 'bg-primary-500 text-white'
                    : `bg-surface-300 ${config.color} hover:brightness-125`
                }`}
              >
                {config.label}
              </button>
            ))}
          </div>

          {/* Session Filter */}
          <select
            value={filterSession}
            onChange={e => setFilterSession(e.target.value)}
            className="px-3 py-1.5 bg-surface-300 border border-surface-50/20 rounded-lg text-white text-sm"
          >
            <option value="">Tutte le sessioni</option>
            {sessions.map(s => (
              <option key={s.id} value={s.id}>
                {s.type === 'PRIMO_MERCATO' ? 'Primo Mercato' : 'Mercato Ricorrente'} - S{s.season}
              </option>
            ))}
          </select>

          {/* Clear Filters */}
          {(filterTypes.length > 0 || filterSession) && (
            <button
              onClick={() => {
                setFilterTypes([])
                setFilterSession('')
              }}
              className="text-sm text-gray-400 hover:text-white"
            >
              Pulisci filtri
            </button>
          )}
        </div>
      </div>

      {/* Timeline Table */}
      <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface-300">
              <tr className="border-b border-surface-50/30 text-gray-400 text-xs uppercase">
                <th className="text-left py-2 px-3">Data</th>
                <th className="text-left py-2 px-2 hidden sm:table-cell">Sessione</th>
                <th className="text-left py-2 px-2">Fase</th>
                <th className="text-left py-2 px-2 w-8">R</th>
                <th className="text-left py-2 px-3">Giocatore</th>
                <th className="text-left py-2 px-3 hidden md:table-cell">Da</th>
                <th className="text-left py-2 px-3 hidden md:table-cell">A</th>
                <th className="text-right py-2 px-3">Prezzo</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(eventsByDate).map(([date, dateEvents], dateIndex) => (
                dateEvents.map((event, eventIndex) => {
                  const config = eventTypeConfig[event.type] || {
                    icon: '📌',
                    label: event.type,
                    color: 'text-gray-400',
                  }
                  const isFirstOfDate = eventIndex === 0

                  return (
                    <tr
                      key={event.id}
                      className={`border-b border-surface-50/10 hover:bg-surface-300/20 ${
                        isFirstOfDate && dateIndex > 0 ? 'border-t-2 border-t-surface-50/30' : ''
                      }`}
                    >
                      <td className="py-1.5 px-3 text-gray-500 whitespace-nowrap">
                        {isFirstOfDate ? (
                          <span className="font-medium text-gray-300">{date}</span>
                        ) : (
                          <span className="text-xs">{formatTime(event.createdAt)}</span>
                        )}
                      </td>
                      <td className="py-1.5 px-2 text-xs text-gray-500 hidden sm:table-cell whitespace-nowrap">
                        {event.session ? (() => {
                          const baseYear = 24 + event.session.season // Season 1 = 25/26
                          const yearStr = `${baseYear}/${baseYear + 1}`
                          const sessionName = event.session.type === 'PRIMO_MERCATO' ? 'Primo Mercato' : 'Mercato Ricorrente'
                          return (
                            <span className={event.session.type === 'PRIMO_MERCATO' ? 'text-yellow-500' : 'text-blue-400'}>
                              {sessionName} {yearStr}
                            </span>
                          )
                        })() : '-'}
                      </td>
                      <td className={`py-1.5 px-2 text-xs font-medium ${config.color}`}>
                        {config.label}
                      </td>
                      <td className={`py-1.5 px-2 font-bold ${(positionColors[event.player.position] || 'bg-gray-500/20 text-gray-400').split(' ')[1]}`}>
                        {event.player.position}
                      </td>
                      <td className="py-1.5 px-3 text-white">{event.player.name}</td>
                      <td className="py-1.5 px-3 text-gray-400 hidden md:table-cell">
                        {event.from?.teamName || event.from?.username || '-'}
                      </td>
                      <td className="py-1.5 px-3 text-gray-400 hidden md:table-cell">
                        {event.to?.teamName || event.to?.username || '-'}
                      </td>
                      <td className="py-1.5 px-3 text-right font-medium text-primary-400">
                        {event.price && event.price > 0 ? `${event.price}M` : '-'}
                      </td>
                    </tr>
                  )
                })
              ))}
            </tbody>
          </table>
        </div>

        {/* Load More */}
        {hasMore && !isLoading && (
          <div className="text-center py-3 border-t border-surface-50/20">
            <button
              onClick={() => loadEvents(false)}
              className="px-6 py-2 bg-surface-300 text-gray-300 rounded-lg hover:bg-surface-400 transition-colors text-sm"
            >
              Carica altri
            </button>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-6">
            <div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin"></div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && events.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            Nessun evento trovato con i filtri selezionati
          </div>
        )}
      </div>
    </div>
  )
}
