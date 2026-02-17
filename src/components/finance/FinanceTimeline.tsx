import { useState, useEffect, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { leagueApi } from '../../services/api'
import { type FinancialsData, POSITION_COLORS } from './types'

interface FinanceTimelineProps {
  leagueId: string
  data: FinancialsData
  initialMemberId?: string
  onBack: () => void
}

interface TimelineEvent {
  id: string
  type: 'contract' | 'trade'
  eventType: string
  label: string
  color: string
  playerName?: string
  playerPosition?: string
  previousSalary?: number | null
  newSalary?: number | null
  previousDuration?: number | null
  newDuration?: number | null
  previousClause?: number | null
  newClause?: number | null
  cost?: number | null
  income?: number | null
  notes?: string | null
  isSender?: boolean
  counterpart?: string
  offeredBudget?: number
  requestedBudget?: number
  sessionType: string
  sessionPhase: string | null
  createdAt: string
}

interface TrendPoint {
  id: string
  type: string
  budget: number
  totalSalaries: number
  balance: number
  totalIndemnities: number | null
  totalReleaseCosts: number | null
  contractCount: number
  sessionType: string
  sessionPhase: string | null
  createdAt: string
}

const EVENT_BG_COLORS: Record<string, string> = {
  blue: 'bg-primary-500/20 border-primary-500/30',
  gray: 'bg-surface-300/50 border-surface-50/20',
  red: 'bg-danger-500/10 border-danger-500/20',
  amber: 'bg-amber-500/10 border-amber-500/20',
  purple: 'bg-purple-500/10 border-purple-500/20',
  green: 'bg-green-500/10 border-green-500/20',
}

const EVENT_DOT_COLORS: Record<string, string> = {
  blue: 'bg-primary-400',
  gray: 'bg-gray-400',
  red: 'bg-danger-400',
  amber: 'bg-amber-400',
  purple: 'bg-purple-400',
  green: 'bg-green-400',
}

const TOOLTIP_STYLE = { backgroundColor: '#1a1c20', border: '1px solid #2d3139', borderRadius: 8, fontSize: 12 }

export function FinanceTimeline({ leagueId, data, initialMemberId, onBack }: FinanceTimelineProps) {
  // Auto-select first team if no initialMemberId provided
  const defaultMemberId = initialMemberId || data.teams[0]?.memberId
  const [selectedMemberId, setSelectedMemberId] = useState<string | undefined>(defaultMemberId)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [trendData, setTrendData] = useState<TrendPoint[]>([])
  const [teamName, setTeamName] = useState('')
  const [filterType, setFilterType] = useState<string>('all')

  useEffect(() => {
    if (selectedMemberId) {
      loadTimeline(selectedMemberId)
    }
  }, [selectedMemberId, leagueId])

  async function loadTimeline(memberId: string) {
    setLoading(true)
    setError(null)
    try {
      const result = await leagueApi.getFinancialTimeline(leagueId, memberId)
      if (result.success && result.data) {
        setEvents(result.data.events)
        setTrendData(result.data.trendData)
        setTeamName(result.data.teamName)
      } else {
        setError(result.message || 'Errore nel caricamento')
        setEvents([])
        setTrendData([])
      }
    } catch {
      setError('Errore di connessione')
      setEvents([])
      setTrendData([])
    } finally {
      setLoading(false)
    }
  }

  // Group events by month
  const groupedEvents = useMemo(() => {
    const filtered = filterType === 'all'
      ? events
      : events.filter(e => {
          if (filterType === 'trades') return e.type === 'trade'
          if (filterType === 'releases') return ['RELEASE_NORMAL', 'RELEASE_ESTERO', 'RELEASE_RETROCESSO', 'AUTO_RELEASE_EXPIRED'].includes(e.eventType)
          if (filterType === 'renewals') return ['RENEWAL', 'SPALMA'].includes(e.eventType)
          return true
        })

    const groups: Record<string, TimelineEvent[]> = {}
    for (const event of filtered) {
      const date = new Date(event.createdAt)
      const key = `${date.toLocaleString('it-IT', { month: 'long' })} ${date.getFullYear()}`
      if (!groups[key]) groups[key] = []
      groups[key].push(event)
    }
    return groups
  }, [events, filterType])

  // Trend chart data
  const chartData = useMemo(() => {
    return trendData.map((point, i) => ({
      name: point.sessionPhase
        ? `${point.sessionType === 'PRIMO_MERCATO' ? 'PM' : 'MR'} ${point.sessionPhase}`
        : `Snap ${i + 1}`,
      budget: point.budget,
      ingaggi: point.totalSalaries,
      bilancio: point.balance,
    }))
  }, [trendData])

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: undefined })
  }

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="text-gray-400 hover:text-white transition-colors text-sm"
          >
            &larr; Torna
          </button>
          <h2 className="text-lg md:text-xl font-bold text-white">
            Movimenti{teamName ? ` - ${teamName}` : ''}
          </h2>
        </div>
      </div>

      {/* Team selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500">Squadra:</span>
        {data.teams.map(team => (
          <button
            key={team.memberId}
            onClick={() => setSelectedMemberId(team.memberId)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              selectedMemberId === team.memberId
                ? 'bg-primary-500 text-white'
                : 'bg-surface-300/50 text-gray-400 hover:text-white hover:bg-surface-300'
            }`}
          >
            {team.teamName}
          </button>
        ))}
      </div>

      {!selectedMemberId && (
        <div className="text-center py-12 text-gray-500">
          Seleziona una squadra per vedere i movimenti
        </div>
      )}

      {loading && (
        <div className="animate-pulse space-y-3">
          <div className="h-48 bg-surface-300 rounded-lg" />
          <div className="h-32 bg-surface-300 rounded-lg" />
        </div>
      )}

      {error && (
        <div className="bg-danger-500/10 border border-danger-500/30 rounded-lg p-4 text-center">
          <p className="text-danger-400 text-sm">{error}</p>
        </div>
      )}

      {selectedMemberId && !loading && !error && (
        <>
          {/* Trend chart */}
          {chartData.length > 1 && (
            <div className="bg-surface-300/50 rounded-lg p-3 md:p-4 border border-surface-50/10">
              <div className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wider mb-3">
                Andamento Bilancio nel Tempo
              </div>
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2d3139" />
                    <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={((value: number, name: string) => [
                        `${value}M`,
                        name === 'bilancio' ? 'Bilancio' : name === 'budget' ? 'Budget' : 'Ingaggi',
                      ]) as any}
                    />
                    <Legend
                      formatter={(value: string) => value === 'bilancio' ? 'Bilancio' : value === 'budget' ? 'Budget' : 'Ingaggi'}
                      wrapperStyle={{ fontSize: 11 }}
                    />
                    <Line type="monotone" dataKey="budget" stroke="#3b82f6" dot={{ r: 3 }} strokeWidth={2} />
                    <Line type="monotone" dataKey="ingaggi" stroke="#f59e0b" dot={{ r: 3 }} strokeWidth={2} />
                    <Line type="monotone" dataKey="bilancio" stroke="#22c55e" dot={{ r: 3 }} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Filter controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500">Filtra:</span>
            {[
              { key: 'all', label: 'Tutti' },
              { key: 'trades', label: 'Scambi' },
              { key: 'releases', label: 'Tagli' },
              { key: 'renewals', label: 'Rinnovi' },
            ].map(opt => (
              <button
                key={opt.key}
                onClick={() => setFilterType(opt.key)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  filterType === opt.key
                    ? 'bg-primary-500 text-white'
                    : 'bg-surface-300/50 text-gray-400 hover:text-white hover:bg-surface-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Timeline */}
          {Object.keys(groupedEvents).length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              Nessun movimento trovato
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedEvents).map(([month, monthEvents]) => (
                <div key={month}>
                  <div className="text-xs md:text-sm font-medium text-gray-400 mb-3 pb-2 border-b border-surface-50/20">
                    {month}
                  </div>
                  <div className="space-y-2 relative">
                    {/* Timeline line */}
                    <div className="absolute left-3 top-0 bottom-0 w-px bg-surface-50/30 hidden md:block" />

                    {monthEvents.map(event => (
                      <div key={event.id} className="flex gap-3 md:pl-8 relative">
                        {/* Dot */}
                        <div className={`hidden md:block absolute left-2 top-3 w-2.5 h-2.5 rounded-full ${EVENT_DOT_COLORS[event.color] || 'bg-gray-400'} ring-2 ring-surface-200`} />

                        {/* Card */}
                        <div className={`flex-1 rounded-lg p-2.5 md:p-3 border ${EVENT_BG_COLORS[event.color] || EVENT_BG_COLORS.gray}`}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs md:text-sm font-medium text-white">{event.label}</span>
                              {event.playerPosition && (
                                <span className={`px-1 py-0.5 rounded text-[8px] font-bold ${POSITION_COLORS[event.playerPosition] || ''}`}>
                                  {event.playerPosition}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-gray-500">
                              {formatDate(event.createdAt)} {formatTime(event.createdAt)}
                            </span>
                          </div>

                          {/* Contract event details */}
                          {event.type === 'contract' && event.playerName && (
                            <div className="text-xs text-gray-400">
                              <span className="text-white">{event.playerName}</span>
                              {event.previousSalary != null && event.newSalary != null && event.previousSalary !== event.newSalary && (
                                <span className="ml-2">
                                  Ingaggio: {event.previousSalary}M &rarr; {event.newSalary}M
                                </span>
                              )}
                              {event.previousDuration != null && event.newDuration != null && event.previousDuration !== event.newDuration && (
                                <span className="ml-2">
                                  Durata: {event.previousDuration} &rarr; {event.newDuration}
                                </span>
                              )}
                              {event.cost != null && event.cost > 0 && (
                                <span className="ml-2 text-danger-400">Costo: -{event.cost}M</span>
                              )}
                              {event.income != null && event.income > 0 && (
                                <span className="ml-2 text-green-400">Incasso: +{event.income}M</span>
                              )}
                            </div>
                          )}

                          {/* Trade event details */}
                          {event.type === 'trade' && (
                            <div className="text-xs text-gray-400">
                              <span>
                                {event.isSender ? 'Scambio con' : 'Scambio da'}{' '}
                                <span className="text-white">{event.counterpart}</span>
                              </span>
                              {event.offeredBudget != null && event.offeredBudget > 0 && (
                                <span className="ml-2 text-amber-400">
                                  {event.isSender ? 'Ceduti' : 'Ricevuti'}: {event.offeredBudget}M
                                </span>
                              )}
                              {event.requestedBudget != null && event.requestedBudget > 0 && (
                                <span className="ml-2 text-secondary-400">
                                  {event.isSender ? 'Ricevuti' : 'Ceduti'}: {event.requestedBudget}M
                                </span>
                              )}
                            </div>
                          )}

                          {event.notes && (
                            <div className="text-[10px] text-gray-500 mt-1">{event.notes}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
