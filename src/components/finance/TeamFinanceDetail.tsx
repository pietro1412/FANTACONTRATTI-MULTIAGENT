import { useMemo, useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, ZAxis } from 'recharts'
import { WaterfallChart } from './WaterfallChart'
import { ContractExpiryGantt } from './ContractExpiryGantt'
import { KPICard, SectionHeader } from './KPICard'
import {
  type TeamData, type FinancialsData,
  getTeamBalance, getHealthStatus,
  POSITION_CHART_COLORS, POSITION_NAMES, POSITION_COLORS,
} from './types'

interface TeamFinanceDetailProps {
  team: TeamData
  data: FinancialsData
  onBack: () => void
  onNavigateToPlayers: (teamName: string) => void
  onNavigateToTimeline: (memberId: string) => void
}

const TOOLTIP_STYLE = { backgroundColor: '#1a1c20', border: '1px solid #2d3139', borderRadius: 8, fontSize: 12 }

export function TeamFinanceDetail({ team, data, onBack, onNavigateToPlayers, onNavigateToTimeline }: TeamFinanceDetailProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null)
  const hasFinancialDetails = !data.inContrattiPhase && (team.totalReleaseCosts !== null || team.totalIndemnities !== null)

  const balance = getTeamBalance(team, hasFinancialDetails)
  const health = getHealthStatus(balance)
  const initialBudget = team.budget + team.totalAcquisitionCost
  const salaryPct = initialBudget > 0 ? Math.round((team.annualContractCost / initialBudget) * 100) : 0

  // Donut: cost by position
  const donutData = useMemo(() => {
    return (['P', 'D', 'C', 'A'] as const).map(pos => ({
      name: POSITION_NAMES[pos],
      value: team.costByPosition[pos].preRenewal,
      color: POSITION_CHART_COLORS[pos],
    })).filter(d => d.value > 0)
  }, [team])

  // Top 5 heaviest contracts
  const topContracts = useMemo(() => {
    return [...team.players]
      .filter(p => !p.draftReleased && p.salary > 0)
      .sort((a, b) => b.salary - a.salary)
      .slice(0, 5)
  }, [team.players])

  const totalSalary = team.annualContractCost
  const top5Salary = topContracts.reduce((s, p) => s + p.salary, 0)
  const concentrationPct = totalSalary > 0 ? Math.round((top5Salary / totalSalary) * 100) : 0

  // Clause scatter data
  const clauseData = useMemo(() => {
    return team.players
      .filter(p => !p.draftReleased && p.salary > 0 && p.clause > 0)
      .map(p => ({
        name: p.name,
        x: p.salary,
        y: p.clause,
        z: p.duration,
        position: p.position,
      }))
  }, [team.players])

  // Average duration
  const avgDuration = useMemo(() => {
    const active = team.players.filter(p => p.duration > 0 && !p.draftReleased)
    if (active.length === 0) return 0
    return active.reduce((s, p) => s + p.duration, 0) / active.length
  }, [team.players])

  const toggleSection = (section: string) => {
    setExpandedSection(prev => prev === section ? null : section)
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
          <h2 className="text-lg md:text-xl font-bold text-white">{team.teamName}</h2>
          <span className="text-xs text-gray-500">@{team.username}</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { onNavigateToTimeline(team.memberId); }}
            className="px-3 py-1.5 bg-surface-300/50 hover:bg-surface-300 text-gray-400 hover:text-white rounded-lg text-xs font-medium transition-colors"
          >
            Movimenti
          </button>
          <button
            onClick={() => { onNavigateToPlayers(team.teamName); }}
            className="px-3 py-1.5 bg-primary-500/20 hover:bg-primary-500/30 text-primary-400 rounded-lg text-xs font-medium transition-colors"
          >
            Vedi Giocatori &rarr;
          </button>
        </div>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
        <KPICard
          title="Budget"
          description="Crediti liquidi attualmente disponibili. Calcolato dal budget iniziale meno acquisti, tagli, crediti ceduti in scambi, piu indennizzi e crediti ricevuti."
          value={`${team.budget}M`}
          subtitle={`su ${initialBudget}M iniziali`}
          progress={initialBudget > 0 ? Math.round((team.budget / initialBudget) * 100) : 0}
          progressColor="bg-primary-500"
        />
        <KPICard
          title="Ingaggi"
          description="Costo annuale totale dei contratti di tutti i giocatori in rosa. La barra indica la percentuale rispetto al budget iniziale."
          value={`${team.annualContractCost}M`}
          subtitle={`${salaryPct}% budget`}
          progress={salaryPct}
          progressColor={salaryPct > 40 ? 'bg-danger-500' : salaryPct > 25 ? 'bg-amber-500' : 'bg-green-500'}
        />
        <KPICard
          title="Bilancio"
          description="Budget attuale meno monte ingaggi. Rappresenta la reale capacita di spesa: piu e alto, piu la squadra ha margine di manovra."
          value={`${balance >= 0 ? '+' : ''}${balance}M`}
          variant={health === 'good' ? 'success' : health === 'warning' ? 'warning' : 'danger'}
        />
        <KPICard
          title="Rosa"
          description="Giocatori attualmente sotto contratto rispetto agli slot massimi. Gli slot liberi possono essere riempiti al prossimo mercato."
          value={`${team.slotCount}/${team.maxSlots}`}
          subtitle={`${team.slotsFree} slot liberi`}
          progress={Math.round((team.slotCount / team.maxSlots) * 100)}
          progressColor="bg-secondary-500"
        />
      </div>

      {/* Waterfall */}
      <WaterfallChart team={team} />

      {/* Grid: Donut + Top 5 contracts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Donut: cost by position */}
        <div className="bg-surface-300/50 rounded-lg p-3 md:p-4 border border-surface-50/10">
          <div className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wider mb-3">
            Costi per Ruolo
          </div>
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div style={{ width: 180, height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    dataKey="value"
                    stroke="rgba(0,0,0,0.3)"
                  >
                    {donutData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={((value: number) => [`${value}M`, '']) as any}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {(['P', 'D', 'C', 'A'] as const).map(pos => {
                const cost = team.costByPosition[pos].preRenewal
                const pct = totalSalary > 0 ? Math.round((cost / totalSalary) * 100) : 0
                return (
                  <div key={pos} className="flex items-center gap-2 text-xs">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${POSITION_COLORS[pos]}`}>{pos}</span>
                    <span className="text-gray-400 w-20">{POSITION_NAMES[pos]}</span>
                    <span className="text-white font-medium">{cost}M</span>
                    <span className="text-gray-500">({pct}%)</span>
                  </div>
                )
              })}
              {/* Concentration warning */}
              {(() => {
                const positions = ['C', 'D'] as const
                const cdCost = positions.reduce((s, pos) => s + team.costByPosition[pos].preRenewal, 0)
                const cdPct = totalSalary > 0 ? Math.round((cdCost / totalSalary) * 100) : 0
                return cdPct > 60 ? (
                  <div className="text-[10px] text-amber-400 mt-1">
                    C+D = {cdPct}% del monte ingaggi
                  </div>
                ) : null
              })()}
            </div>
          </div>
        </div>

        {/* Top 5 heaviest contracts */}
        <div className="bg-surface-300/50 rounded-lg p-3 md:p-4 border border-surface-50/10">
          <div className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wider mb-3">
            Top 5 Contratti Piu Pesanti
          </div>
          <div className="space-y-2">
            {topContracts.map((player, i) => {
              const pct = totalSalary > 0 ? Math.round((player.salary / totalSalary) * 100) : 0
              return (
                <div key={player.id} className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-4">{i + 1}.</span>
                  <span className={`px-1 py-0.5 rounded text-[8px] font-bold ${POSITION_COLORS[player.position]}`}>
                    {player.position}
                  </span>
                  <span className="text-xs text-white font-medium flex-1 truncate">{player.name}</span>
                  <span className="text-[10px] text-gray-500">{player.salary}M x{player.duration}</span>
                  <span className="text-[10px] text-gray-500">cl.{player.clause}</span>
                  <div className="w-20 h-3 bg-surface-100/30 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent-500/60 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-accent-400 w-8 text-right">{pct}%</span>
                </div>
              )
            })}
          </div>
          <div className="mt-3 pt-2 border-t border-surface-50/20 text-[10px] text-gray-500">
            Top 5 = {concentrationPct}% del monte ingaggi
            {concentrationPct > 80 && <span className="text-danger-400 ml-2">Alta concentrazione</span>}
            {concentrationPct > 60 && concentrationPct <= 80 && <span className="text-amber-400 ml-2">Concentrazione moderata</span>}
          </div>
        </div>
      </div>

      {/* Grid: Contract expiry gantt + Clause scatter */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ContractExpiryGantt players={team.players} />

        {/* Clause scatter chart */}
        <div className="bg-surface-300/50 rounded-lg p-3 md:p-4 border border-surface-50/10">
          <div className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wider mb-3">
            Clausole Rescissorie
          </div>
          {clauseData.length > 0 ? (
            <>
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2d3139" />
                    <XAxis
                      type="number"
                      dataKey="x"
                      name="Ingaggio"
                      tick={{ fill: '#9ca3af', fontSize: 10 }}
                      label={{ value: 'Ingaggio', position: 'insideBottom', offset: -2, fill: '#6b7280', fontSize: 10 }}
                    />
                    <YAxis
                      type="number"
                      dataKey="y"
                      name="Clausola"
                      tick={{ fill: '#9ca3af', fontSize: 10 }}
                      label={{ value: 'Clausola', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 10 }}
                    />
                    <ZAxis type="number" dataKey="z" range={[40, 200]} name="Durata" />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={((value: number, name: string) => [
                        `${value}M`,
                        name
                      ]) as any}
                      labelFormatter={(_, payload) => {
                        const item = payload?.[0]?.payload as (typeof clauseData)[0] | undefined
                        return item ? `${item.name} (${item.position})` : ''
                      }}
                    />
                    <Scatter data={clauseData}>
                      {clauseData.map((entry, i) => (
                        <Cell key={i} fill={POSITION_CHART_COLORS[entry.position] || '#3b82f6'} fillOpacity={0.7} />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
              <div className="text-[10px] text-gray-500 mt-1">
                Dimensione bolla = durata residua
              </div>
            </>
          ) : (
            <div className="text-sm text-gray-500 text-center py-8">Nessun dato clausole</div>
          )}
        </div>
      </div>

      {/* Full roster table - accordion on mobile */}
      <div className="bg-surface-300/50 rounded-lg border border-surface-50/10 overflow-hidden">
        <button
          onClick={() => { toggleSection('roster'); }}
          className="w-full flex items-center justify-between p-3 md:p-4 text-left md:cursor-default"
        >
          <span className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wider font-medium">
            Rosa Completa - {team.teamName}
          </span>
          <span className="md:hidden text-gray-500 text-xs">
            {expandedSection === 'roster' ? '\u25B2' : '\u25BC'}
          </span>
        </button>

        <div className={expandedSection === 'roster' ? '' : 'hidden md:block'}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-0 text-xs">
              <thead className="bg-surface-300/50">
                <tr>
                  <th className="px-2 md:px-3 py-2 text-left text-gray-400 font-medium">Giocatore</th>
                  <th className="px-2 py-2 text-center text-gray-400 font-medium">Ruolo</th>
                  <th className="px-2 py-2 text-right text-gray-400 font-medium hidden md:table-cell">Quot.</th>
                  <th className="px-2 py-2 text-right text-gray-400 font-medium hidden md:table-cell">Eta</th>
                  <th className="px-2 py-2 text-right text-gray-400 font-medium">Ingag.</th>
                  <th className="px-2 py-2 text-right text-gray-400 font-medium">Durata</th>
                  <th className="px-2 py-2 text-right text-gray-400 font-medium hidden md:table-cell">Clausola</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-50/10">
                {team.players
                  .filter(p => !p.draftReleased)
                  .sort((a, b) => b.salary - a.salary)
                  .map(player => (
                    <tr key={player.id} className="hover:bg-surface-100/20">
                      <td className="px-2 md:px-3 py-2 text-white">{player.name}</td>
                      <td className="px-2 py-2 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${POSITION_COLORS[player.position]}`}>
                          {player.position}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-right text-gray-400 hidden md:table-cell">{player.quotation}</td>
                      <td className="px-2 py-2 text-right text-gray-400 hidden md:table-cell">{player.age ?? '-'}</td>
                      <td className="px-2 py-2 text-right text-accent-400 font-medium">{player.salary}M</td>
                      <td className={`px-2 py-2 text-right font-medium ${player.duration <= 1 ? 'text-danger-400' : player.duration <= 2 ? 'text-amber-400' : 'text-white'}`}>
                        {player.duration}
                      </td>
                      <td className="px-2 py-2 text-right text-gray-400 hidden md:table-cell">{player.clause}M</td>
                    </tr>
                  ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-surface-50/30 bg-surface-300/30">
                  <td className="px-2 md:px-3 py-2 text-gray-400 font-medium">TOTALE</td>
                  <td className="px-2 py-2 text-center text-white font-bold">{team.slotCount}</td>
                  <td className="px-2 py-2 hidden md:table-cell" />
                  <td className="px-2 py-2 hidden md:table-cell" />
                  <td className="px-2 py-2 text-right text-accent-400 font-bold">{team.annualContractCost}M</td>
                  <td className="px-2 py-2 text-right text-white font-medium">{avgDuration.toFixed(1)}</td>
                  <td className="px-2 py-2 text-right text-gray-400 hidden md:table-cell">
                    {team.players.filter(p => !p.draftReleased).reduce((s, p) => s + p.clause, 0)}M
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
