import { useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ScatterChart, Scatter, Cell, ZAxis,
  LineChart, Line,
} from 'recharts'
import { TeamRanking } from './TeamRanking'
import { SectionHeader } from './KPICard'
import { LandscapeHint } from '../ui/LandscapeHint'
import {
  type FinancialsData, type LeagueTotals,
  getTeamBalance, getHealthStatus,
  POSITION_NAMES,
  computeLeagueTotals,
} from './types'

interface TrendPoint {
  snapshotType: string
  budget: number
  totalSalaries: number
  balance: number
  sessionType: string
  sessionPhase: string | null
  createdAt: string
}

interface TeamComparisonProps {
  data: FinancialsData
  onTeamClick: (memberId: string) => void
  trends?: Record<string, TrendPoint[]> | null
}

// Recharts theme for dark mode
const TOOLTIP_STYLE = { backgroundColor: '#1a1c20', border: '1px solid #2d3139', borderRadius: 8, fontSize: 12 }

// Team colors palette
const TEAM_COLORS = [
  '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4',
  '#f97316', '#14b8a6', '#a855f7',
]

export function TeamComparison({ data, onTeamClick, trends }: TeamComparisonProps) {
  const totals: LeagueTotals = useMemo(() => computeLeagueTotals(data), [data])
  const [sortBy, setSortBy] = useState<'balance' | 'budget' | 'contracts' | 'acquisitions'>('balance')

  const sortedTeams = useMemo(() => {
    return [...data.teams].sort((a, b) => {
      switch (sortBy) {
        case 'balance': return getTeamBalance(b, totals.hasFinancialDetails) - getTeamBalance(a, totals.hasFinancialDetails)
        case 'budget': return b.budget - a.budget
        case 'contracts': return b.annualContractCost - a.annualContractCost
        case 'acquisitions': return b.totalAcquisitionCost - a.totalAcquisitionCost
        default: return 0
      }
    })
  }, [data.teams, sortBy, totals.hasFinancialDetails])

  // Stacked bar data: budget composition
  const stackedBarData = useMemo(() => {
    return sortedTeams.map(t => {
      const balance = getTeamBalance(t, totals.hasFinancialDetails)
      return {
        name: t.teamName.length > 10 ? t.teamName.substring(0, 10) + '..' : t.teamName,
        fullName: t.teamName,
        memberId: t.memberId,
        bilancio: Math.max(0, balance),
        ingaggi: t.annualContractCost,
        acquisti: t.totalAcquisitionCost,
      }
    })
  }, [sortedTeams, totals.hasFinancialDetails])

  // Radar data: spending by position (normalized per team max for comparability)
  const radarData = useMemo(() => {
    const positions = ['P', 'D', 'C', 'A'] as const
    return positions.map(pos => {
      const entry: Record<string, string | number> = { position: POSITION_NAMES[pos] ?? pos }
      for (const team of sortedTeams) {
        entry[team.teamName] = team.costByPosition[pos].preRenewal
      }
      return entry
    })
  }, [sortedTeams])

  // Scatter: risk exposure (X = salary%, Y = balance)
  const scatterData = useMemo(() => {
    return sortedTeams.map(t => {
      const balance = getTeamBalance(t, totals.hasFinancialDetails)
      const initialBudget = t.budget + t.totalAcquisitionCost
      const salaryPct = initialBudget > 0 ? (t.annualContractCost / initialBudget) * 100 : 0
      return {
        name: t.teamName,
        memberId: t.memberId,
        x: Math.round(salaryPct),
        y: balance,
        health: getHealthStatus(balance),
      }
    })
  }, [sortedTeams, totals.hasFinancialDetails])

  // Historical trends: flatten to array of { date, [teamName]: balance }
  const trendsChartData = useMemo(() => {
    if (!trends) return null
    const teamNames = Object.keys(trends)
    if (teamNames.length === 0) return null

    // Build a map of date -> { date, team1: balance, team2: balance, ... }
    const dateMap = new Map<string, Record<string, string | number>>()

    for (const [teamName, points] of Object.entries(trends)) {
      for (const point of points) {
        const dateKey = new Date(point.createdAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
        if (!dateMap.has(dateKey)) {
          dateMap.set(dateKey, { date: dateKey })
        }
        dateMap.get(dateKey)![teamName] = point.balance
      }
    }

    return { data: Array.from(dateMap.values()), teamNames }
  }, [trends])

  // Contract duration averages
  const durationData = useMemo(() => {
    return sortedTeams.map(t => {
      const players = t.players.filter(p => p.duration > 0)
      const avgDur = players.length > 0
        ? players.reduce((s, p) => s + p.duration, 0) / players.length
        : 0
      return {
        name: t.teamName.length > 10 ? t.teamName.substring(0, 10) + '..' : t.teamName,
        fullName: t.teamName,
        avgDuration: Math.round(avgDur * 10) / 10,
      }
    }).sort((a, b) => b.avgDuration - a.avgDuration)
  }, [sortedTeams])

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Sort controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500">Ordina per:</span>
        {([
          { key: 'balance', label: 'Bilancio' },
          { key: 'budget', label: 'Budget' },
          { key: 'contracts', label: 'Ingaggi' },
          { key: 'acquisitions', label: 'Acquisti' },
        ] as const).map(opt => (
          <button
            key={opt.key}
            onClick={() => { setSortBy(opt.key); }}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              sortBy === opt.key
                ? 'bg-primary-500 text-white'
                : 'bg-surface-300/50 text-gray-400 hover:text-white hover:bg-surface-300'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Ranking */}
      <TeamRanking
        teams={data.teams}
        hasFinancialDetails={totals.hasFinancialDetails}
        onTeamClick={onTeamClick}
      />

      {/* Charts grid */}
      <LandscapeHint />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Budget vs Ingaggi stacked bar */}
        <div className="bg-surface-300/50 rounded-lg p-3 md:p-4 border border-surface-50/10">
          <div className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wider mb-3">
            Budget vs Ingaggi vs Acquisti
          </div>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stackedBarData} layout="vertical" margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d3139" />
                <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} width={80} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  itemStyle={{ color: '#fff' }}
                  formatter={((value: number, name: string) => [`${value}M`, name === 'bilancio' ? 'Bilancio' : name === 'ingaggi' ? 'Ingaggi' : 'Acquisti']) as any}
                  labelFormatter={((label: string) => {
                    const item = stackedBarData.find(d => d.name === label)
                    return item?.fullName || label
                  }) as any}
                />
                <Legend
                  formatter={(value: string) => value === 'bilancio' ? 'Bilancio' : value === 'ingaggi' ? 'Ingaggi' : 'Acquisti'}
                  wrapperStyle={{ fontSize: 11 }}
                />
                <Bar dataKey="bilancio" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                <Bar dataKey="ingaggi" stackId="a" fill="#f59e0b" />
                <Bar dataKey="acquisti" stackId="a" fill="#ea580c" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Radar: distribution by position */}
        <div className="bg-surface-300/50 rounded-lg p-3 md:p-4 border border-surface-50/10">
          <div className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wider mb-3">
            Distribuzione Spesa per Ruolo
          </div>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="#2d3139" />
                <PolarAngleAxis dataKey="position" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <PolarRadiusAxis tick={{ fill: '#6b7280', fontSize: 9 }} />
                {sortedTeams.slice(0, 5).map((team, i) => (
                  <Radar
                    key={team.memberId}
                    name={team.teamName}
                    dataKey={team.teamName}
                    stroke={TEAM_COLORS[i % TEAM_COLORS.length]}
                    fill={TEAM_COLORS[i % TEAM_COLORS.length]}
                    fillOpacity={0.1}
                  />
                ))}
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Contract duration comparison */}
        <div className="bg-surface-300/50 rounded-lg p-3 md:p-4 border border-surface-50/10">
          <div className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wider mb-3">
            Durata Media Contratti
          </div>
          <div style={{ height: 250 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={durationData} layout="vertical" margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d3139" />
                <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 10 }} domain={[0, 'auto']} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} width={80} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={((value: number) => [`${value} semestri`, 'Durata media']) as any}
                  labelFormatter={((label: string) => {
                    const item = durationData.find(d => d.name === label)
                    return item?.fullName || label
                  }) as any}
                />
                <Bar dataKey="avgDuration" fill="#8b5cf6" radius={[0, 4, 4, 0]}>
                  {durationData.map((_, i) => (
                    <Cell key={i} fill={TEAM_COLORS[i % TEAM_COLORS.length]} fillOpacity={0.7} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Scatter: risk exposure */}
        <div className="bg-surface-300/50 rounded-lg p-3 md:p-4 border border-surface-50/10">
          <div className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wider mb-3">
            Esposizione al Rischio
          </div>
          <div style={{ height: 250 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d3139" />
                <XAxis
                  type="number"
                  dataKey="x"
                  name="% Ingaggi"
                  tick={{ fill: '#9ca3af', fontSize: 10 }}
                  label={{ value: '% Ingaggi su budget', position: 'insideBottom', offset: -2, fill: '#6b7280', fontSize: 10 }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name="Bilancio"
                  tick={{ fill: '#9ca3af', fontSize: 10 }}
                  label={{ value: 'Bilancio', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 10 }}
                />
                <ZAxis range={[80, 80]} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={((value: number, name: string) => [
                    name === 'Bilancio' ? `${value}M` : `${value}%`,
                    name
                  ]) as any}
                  labelFormatter={(_, payload) => {
                    const item = payload?.[0]?.payload as (typeof scatterData)[0] | undefined
                    return item?.name || ''
                  }}
                />
                <Scatter data={scatterData} name="Squadre">
                  {scatterData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.health === 'good' ? '#22c55e' : entry.health === 'warning' ? '#fbbf24' : '#ef4444'}
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 text-[10px] text-gray-500">
            Zona rischio: basso bilancio + alto ingaggio
          </div>
        </div>
      </div>

      {/* Historical trends line chart */}
      {trendsChartData && (
        <div className="bg-surface-300/50 rounded-lg p-3 md:p-4 border border-surface-50/10">
          <div className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wider mb-3">
            Andamento Storico Bilancio
          </div>
          <div style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendsChartData.data} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d3139" />
                <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  itemStyle={{ color: '#fff' }}
                  formatter={((value: number) => [`${value}M`, '']) as any}
                />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {trendsChartData.teamNames.map((name, i) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={TEAM_COLORS[i % TEAM_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
