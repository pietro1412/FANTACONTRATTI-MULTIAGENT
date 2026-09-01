import { useMemo } from 'react'
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line,
} from 'recharts'
import type { Formatter } from 'recharts/types/component/DefaultTooltipContent'
import { SectionTitle } from './KPICard'
import { LandscapeHint } from '../ui/LandscapeHint'
import {
  type FinancialsData, type LeagueTotals,
  getTeamBalance,
  computeLeagueTotals,
  formatPhaseLabel,
  CHART_COLORS, CHART_TOOLTIP_STYLE, CHART_TOOLTIP_LABEL_STYLE, CHART_AXIS_TICK,
  CREDITS_Y_AXIS_LABEL,
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
  myTeamId?: string
  trends?: Record<string, TrendPoint[]> | null
}

// Rework 01/09/2026: durante la Fase Contratti (prima che tutti consolidino) l'ingaggio
// non e' ancora "impegnato" — nessuno lo ha ancora pagato, vedi getTeamBalance in ./types.
function getCompositionLabels(preConsolidation: boolean): Record<string, string> {
  return {
    ingaggi: preConsolidation ? 'Ingaggi da pagare' : 'Ingaggi impegnati',
    indennizzi: 'Indennizzi ipotetici (bozza)',
    riserva: 'Riserva slot',
    disponibile: 'Disponibile',
  }
}

// Custom X axis tick: the user's team is highlighted in gold
interface TeamAxisTickProps {
  x?: number
  y?: number
  payload?: { value?: string | number }
  highlight?: string
}

function TeamAxisTick({ x = 0, y = 0, payload, highlight }: TeamAxisTickProps) {
  const value = String(payload?.value ?? '')
  const isMe = highlight !== undefined && value === highlight
  return (
    <text
      x={x}
      y={y + 12}
      textAnchor="middle"
      fontSize={12}
      fontWeight={isMe ? 800 : 600}
      fill={isMe ? CHART_COLORS.accentLight : CHART_COLORS.axis}
    >
      {value}
    </text>
  )
}

export function TeamComparison({ data, myTeamId, trends }: TeamComparisonProps) {
  const totals: LeagueTotals = useMemo(() => computeLeagueTotals(data), [data])

  const myTeam = useMemo(
    () => (myTeamId ? data.teams.find(t => t.memberId === myTeamId) : undefined),
    [data.teams, myTeamId]
  )

  const preConsolidation = data.inContrattiPhase && !data.allMembersConsolidated
  const compositionLabels = useMemo(() => getCompositionLabels(preConsolidation), [preConsolidation])

  // Budget composition per team (sorted by total budget desc)
  const compositionData = useMemo(() => {
    return [...data.teams]
      .sort((a, b) => b.budget - a.budget)
      .map(t => {
        const balance = getTeamBalance(t, totals.hasFinancialDetails)
        const reserve = t.slotReserve ?? 0
        const indennizzi = preConsolidation ? (t.hypotheticalIndemnities ?? 0) : 0
        return {
          name: t.teamName.length > 12 ? t.teamName.substring(0, 12) + '..' : t.teamName,
          fullName: t.teamName,
          memberId: t.memberId,
          ingaggi: t.annualContractCost,
          indennizzi,
          riserva: reserve,
          disponibile: Math.max(0, balance - reserve),
          isMe: t.memberId === myTeamId,
        }
      })
  }, [data.teams, totals.hasFinancialDetails, preConsolidation, myTeamId])

  const myShortName = compositionData.find(d => d.isMe)?.name

  // Historical trends: flatten to array of { label, [teamName]: balance }.
  // The X axis tracks market SESSION snapshots (phases), not calendar dates:
  // we key snapshots by createdAt timestamp (stable chronological order) but
  // label them with the humanized phase (assioma 10 — axis must be unambiguous).
  const trendsChartData = useMemo(() => {
    if (!trends) return null
    const teamNames = Object.keys(trends)
    if (teamNames.length === 0) return null

    // ts -> { label, [teamName]: balance }; keep ts for sorting
    const snapMap = new Map<number, { ts: number; label: string } & Record<string, string | number>>()

    for (const [teamName, points] of Object.entries(trends)) {
      for (const point of points) {
        const ts = new Date(point.createdAt).getTime()
        const phaseLabel = formatPhaseLabel(point.sessionPhase)
        const label = phaseLabel
          || new Date(point.createdAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
        if (!snapMap.has(ts)) {
          snapMap.set(ts, { ts, label })
        }
        snapMap.get(ts)![teamName] = point.balance
      }
    }

    const ordered = Array.from(snapMap.values()).sort((a, b) => a.ts - b.ts)

    // Render the user's line last so it stays on top
    const myName = myTeam?.teamName
    const sortedNames = [...teamNames].sort((a, b) =>
      (a === myName ? 1 : 0) - (b === myName ? 1 : 0)
    )

    return { data: ordered, teamNames: sortedNames }
  }, [trends, myTeam])

  return (
    <div className="space-y-4 md:space-y-6">
      <SectionTitle
        title="Confronto squadre"
        subtitle="Come ogni squadra usa il proprio budget e come è cambiato nel tempo"
      />

      <LandscapeHint />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Budget composition stacked bar */}
        <div className="rounded-2xl border border-surface-50/60 bg-surface-200 p-3 md:p-5">
          <SectionTitle
            title="Composizione del budget"
            subtitle={
              preConsolidation
                ? 'Per ogni squadra: ingaggi da pagare, indennizzi ipotetici da bozza, riserva slot, disponibile — la tua colonna è evidenziata'
                : 'Per ogni squadra: ingaggi impegnati, riserva slot, disponibile — la tua colonna è evidenziata'
            }
          />
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={compositionData} margin={{ left: 12, right: 10, top: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={<TeamAxisTick highlight={myShortName} />}
                  interval={0}
                />
                <YAxis tick={CHART_AXIS_TICK} label={CREDITS_Y_AXIS_LABEL} />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE} labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                  itemStyle={{ color: '#fff' }}
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  formatter={((value: number, name: string) => [`${value}M`, compositionLabels[name] ?? name]) as Formatter<number, string>}
                  labelFormatter={((label: unknown) => {
                    const labelStr = String(label)
                    const item = compositionData.find(d => d.name === labelStr)
                    return item?.fullName ?? labelStr
                  }) as never}
                />
                <Legend
                  formatter={(value: string) => compositionLabels[value] ?? value}
                  wrapperStyle={{ fontSize: 11 }}
                />
                <Bar dataKey="ingaggi" stackId="a" fill={CHART_COLORS.primary}>
                  {compositionData.map(d => (
                    // eslint-disable-next-line @typescript-eslint/no-deprecated -- recharts: per-datum styling requires Cell
                    <Cell
                      key={d.memberId}
                      stroke={d.isMe ? CHART_COLORS.accentLight : undefined}
                      strokeWidth={d.isMe ? 2 : 0}
                    />
                  ))}
                </Bar>
                <Bar dataKey="riserva" stackId="a" fill={CHART_COLORS.accent}>
                  {compositionData.map(d => (
                    // eslint-disable-next-line @typescript-eslint/no-deprecated -- recharts: per-datum styling requires Cell
                    <Cell
                      key={d.memberId}
                      stroke={d.isMe ? CHART_COLORS.accentLight : undefined}
                      strokeWidth={d.isMe ? 2 : 0}
                    />
                  ))}
                </Bar>
                <Bar dataKey="disponibile" stackId="a" fill={CHART_COLORS.secondary} radius={preConsolidation ? undefined : [4, 4, 0, 0]}>
                  {compositionData.map(d => (
                    // eslint-disable-next-line @typescript-eslint/no-deprecated -- recharts: per-datum styling requires Cell
                    <Cell
                      key={d.memberId}
                      stroke={d.isMe ? CHART_COLORS.accentLight : undefined}
                      strokeWidth={d.isMe ? 2 : 0}
                    />
                  ))}
                </Bar>
                {preConsolidation && (
                  <Bar dataKey="indennizzi" stackId="a" fill={CHART_COLORS.primaryDark} radius={[4, 4, 0, 0]}>
                    {compositionData.map(d => (
                      // eslint-disable-next-line @typescript-eslint/no-deprecated -- recharts: per-datum styling requires Cell
                      <Cell
                        key={d.memberId}
                        stroke={d.isMe ? CHART_COLORS.accentLight : undefined}
                        strokeWidth={d.isMe ? 2 : 0}
                      />
                    ))}
                  </Bar>
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Balance trend line chart */}
        <div className="rounded-2xl border border-surface-50/60 bg-surface-200 p-3 md:p-5">
          <SectionTitle
            title="Andamento dei bilanci"
            subtitle="Evoluzione nelle sessioni di mercato — la tua linea in evidenza"
          />
          {trendsChartData ? (
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendsChartData.data} margin={{ left: 12, right: 10, top: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                  <XAxis dataKey="label" tick={CHART_AXIS_TICK} />
                  <YAxis tick={CHART_AXIS_TICK} label={CREDITS_Y_AXIS_LABEL} />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE} labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                    itemStyle={{ color: '#fff' }}
                    formatter={((value: number, name: string) => [`${value}M`, name]) as Formatter<number, string>}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {trendsChartData.teamNames.map(name => {
                    const isMe = name === myTeam?.teamName
                    return (
                      <Line
                        key={name}
                        type="monotone"
                        dataKey={name}
                        stroke={isMe ? CHART_COLORS.secondary : CHART_COLORS.neutralLine}
                        strokeWidth={isMe ? 3 : 1.5}
                        dot={false}
                        connectNulls
                      />
                    )
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-[300px] items-center justify-center text-sm text-gray-500">
              Nessuno storico disponibile per questa lega.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
