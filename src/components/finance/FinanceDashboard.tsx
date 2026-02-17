import { useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { KPICard, SectionHeader } from './KPICard'
import { LandscapeHint } from '../ui/LandscapeHint'
import { HealthIndicator, HealthIndicatorCompact } from './HealthIndicator'
import { type FinancialsData, type LeagueTotals, computeLeagueTotals } from './types'

interface FinanceDashboardProps {
  data: FinancialsData
}

export function FinanceDashboard({ data }: FinanceDashboardProps) {
  const totals: LeagueTotals = useMemo(() => computeLeagueTotals(data), [data])

  const budgetPct = totals.totalBudget > 0
    ? Math.round(((totals.totalBudget - totals.totalAcquisitions) / totals.totalBudget) * 100)
    : 0

  const salaryPct = totals.totalBudget > 0
    ? Math.round((totals.totalContracts / totals.totalBudget) * 100)
    : 0

  const slotPct = totals.maxTotalSlots > 0
    ? Math.round((totals.totalSlots / totals.maxTotalSlots) * 100)
    : 0

  const distributionData = [
    { name: 'Budget Residuo', value: Math.max(0, totals.totalBudget - totals.totalAcquisitions - totals.totalContracts), color: '#3b82f6' },
    { name: 'Monte Ingaggi', value: totals.totalContracts, color: '#f59e0b' },
    { name: 'Speso Aste', value: totals.totalAcquisitions, color: '#ea580c' },
    ...(totals.totalReleaseCosts ? [{ name: 'Tagli', value: totals.totalReleaseCosts, color: '#ef4444' }] : []),
    ...(totals.hasTradeData ? [{ name: 'Scambi', value: totals.totalTradeBudgetIn, color: '#8b5cf6' }] : []),
  ].filter(d => d.value > 0)

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Row 1: Main KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
        <KPICard
          title="Budget Totale"
          description="Somma dei crediti liquidi disponibili di tutte le squadre. Calcolato come budget iniziale meno i costi di acquisto all'asta."
          value={`${totals.totalBudget - totals.totalAcquisitions}M`}
          subtitle={`su ${totals.totalBudget}M iniziali`}
          progress={budgetPct}
          progressColor="bg-primary-500"
        />
        <KPICard
          title="Monte Ingaggi"
          description="Somma di tutti gli ingaggi annuali dei giocatori sotto contratto nella lega. La barra indica il peso degli ingaggi rispetto al budget iniziale."
          value={`${totals.totalContracts}M`}
          subtitle={`${salaryPct}% del budget`}
          progress={salaryPct}
          progressColor={salaryPct > 40 ? 'bg-danger-500' : salaryPct > 25 ? 'bg-amber-500' : 'bg-green-500'}
        />
        <KPICard
          title="Bilancio Totale"
          description="Somma dei bilanci di tutte le squadre (Budget - Ingaggi). Un valore positivo indica margine di manovra complessivo nella lega."
          value={`${totals.totalBalance >= 0 ? '+' : ''}${totals.totalBalance}M`}
          variant={totals.totalBalance > 0 ? 'success' : totals.totalBalance < 0 ? 'danger' : 'default'}
        />
        <KPICard
          title="Liquidita Media"
          description="Media del bilancio (Budget - Ingaggi) per squadra. Min e max mostrano la forbice tra la squadra con piu risorse e quella con meno."
          value={`${Math.round(totals.liquidityAvg)}M/team`}
          subtitle={`min: ${totals.liquidityMin}  max: ${totals.liquidityMax}`}
        />
      </div>

      {/* Row 2: Secondary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
        <KPICard
          title="Speso in Aste"
          description="Totale crediti spesi per acquistare giocatori nelle aste. Include primo mercato e mercati ricorrenti."
          value={`${totals.totalAcquisitions}M`}
          subtitle={totals.totalBudget > 0 ? `${Math.round((totals.totalAcquisitions / totals.totalBudget) * 100)}% del budget` : undefined}
        />
        <KPICard
          title="Volume Scambi"
          description="Totale crediti trasferiti nelle operazioni di scambio (trade) tra squadre."
          value={`${totals.totalTradeBudgetIn}M`}
          subtitle={totals.hasTradeData ? `crediti trasferiti` : 'nessuno scambio'}
        />
        <KPICard
          title="Tagli Totali"
          description="Somma dei costi di taglio giocatori nella lega. Costo taglio = arrotonda per eccesso (ingaggio x durata residua / 2)."
          value={totals.totalReleaseCosts !== null ? `${totals.totalReleaseCosts}M` : '-'}
          subtitle={totals.totalReleaseCosts !== null
            ? `media ${(totals.totalReleaseCosts / Math.max(1, data.teams.length)).toFixed(1)}/team`
            : undefined}
          variant={totals.totalReleaseCosts !== null && totals.totalReleaseCosts > 0 ? 'danger' : 'default'}
        />
        <KPICard
          title="Giocatori"
          description="Numero totale di giocatori sotto contratto rispetto agli slot massimi disponibili nella lega."
          value={`${totals.totalSlots} / ${totals.maxTotalSlots}`}
          subtitle={`${slotPct}% rosa piena \u00B7 ${totals.maxTotalSlots - totals.totalSlots} slot liberi`}
          progress={slotPct}
          progressColor="bg-secondary-500"
        />
      </div>

      {/* Row 3: Distribution chart + Health indicator */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Distribution pie chart */}
        <div className="lg:col-span-3 bg-surface-300/50 rounded-lg p-3 md:p-4 border border-surface-50/10">
          <SectionHeader
            title="Distribuzione Budget Lega"
            description="Come e suddiviso il budget complessivo della lega tra residuo, ingaggi, acquisti alle aste, tagli e scambi."
          />
          <LandscapeHint />
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="w-full md:w-1/2" style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={distributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={85}
                    dataKey="value"
                    stroke="rgba(0,0,0,0.3)"
                    strokeWidth={1}
                  >
                    {distributionData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1a1c20', border: '1px solid #2d3139', borderRadius: 8, fontSize: 12 }}
                    itemStyle={{ color: '#fff' }}
                    formatter={((value: number) => [`${value}M`, '']) as any}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap md:flex-col gap-2 md:gap-3 text-xs md:text-sm">
              {distributionData.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded" style={{ backgroundColor: d.color }} />
                  <span className="text-gray-400">{d.name}</span>
                  <span className="text-white font-medium">{d.value}M</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Health indicator */}
        <div className="lg:col-span-2">
          {/* Desktop */}
          <div className="hidden md:block">
            <HealthIndicator
              teams={data.teams}
              hasFinancialDetails={totals.hasFinancialDetails}
              giniIndex={totals.giniIndex}
            />
          </div>
          {/* Mobile */}
          <div className="md:hidden">
            <HealthIndicatorCompact
              teams={data.teams}
              hasFinancialDetails={totals.hasFinancialDetails}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
