import { Card, CardContent } from '../ui/Card'
import { BilancioGauge, CompactBudgetBar, DeltaBar } from './FinancialCharts'
import type { TeamData } from '../finance/types'
import { getTeamBalance, getHealthStatus, HEALTH_COLORS } from '../finance/types'

interface MyFinancialDashboardProps {
  myTeam: TeamData
  hasFinancialDetails: boolean
  postTradeImpact?: {
    budgetDelta: number
    salaryDelta: number
    rosterDelta: number
    newBudget: number
    newSalary: number
  } | null
}

export function MyFinancialDashboard({ myTeam, hasFinancialDetails, postTradeImpact }: MyFinancialDashboardProps) {
  const balance = getTeamBalance(myTeam, hasFinancialDetails)
  const health = getHealthStatus(balance)
  const healthColor = HEALTH_COLORS[health]

  return (
    <Card className="bg-gradient-to-r from-surface-200 to-surface-300 border-accent-500/30">
      <CardContent className="py-5 px-5 md:px-6">
        <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
          <svg className="w-5 h-5 text-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Le Tue Finanze
        </h2>
        <div className="flex flex-col gap-3">
          {/* Main layout: gauge + KPIs + bar */}
          <div className="flex flex-col md:flex-row items-start gap-4">
            {/* Gauge */}
            <div className="flex flex-col items-center flex-shrink-0 self-center md:self-start">
              <BilancioGauge bilancio={balance} budget={myTeam.budget} ingaggi={myTeam.annualContractCost} size={220} />
            </div>
            {/* KPIs + Bar */}
            <div className="flex flex-col gap-3 min-w-0 flex-1 w-full">
              {/* KPI Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* Budget */}
                <div className="bg-surface-300/60 rounded-xl px-4 py-3 border border-surface-50/20">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Budget</p>
                  <p className="text-2xl md:text-3xl font-bold font-mono text-primary-400">{myTeam.budget}</p>
                </div>
                {/* Ingaggi */}
                <div className="bg-surface-300/60 rounded-xl px-4 py-3 border border-surface-50/20">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Ingaggi</p>
                  <p className="text-2xl md:text-3xl font-bold font-mono text-accent-400">{myTeam.annualContractCost}</p>
                </div>
                {/* Bilancio */}
                <div className="bg-surface-300/60 rounded-xl px-4 py-3 border border-surface-50/20">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Bilancio</p>
                  <p className={`text-2xl md:text-3xl font-bold font-mono ${healthColor}`}>{balance}</p>
                </div>
                {/* Rosa/Slot */}
                <div className="bg-surface-300/60 rounded-xl px-4 py-3 border border-surface-50/20">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Rosa</p>
                  <p className="text-2xl md:text-3xl font-bold font-mono text-white">
                    {myTeam.slotCount}<span className="text-lg text-gray-500">/{myTeam.maxSlots}</span>
                  </p>
                  {myTeam.slotsFree > 0 && (
                    <p className="text-xs text-secondary-400">{myTeam.slotsFree} liberi</p>
                  )}
                </div>
              </div>
              {/* Budget Bar */}
              <CompactBudgetBar budget={myTeam.budget} ingaggi={myTeam.annualContractCost} />
            </div>
          </div>

          {/* Post-trade impact DeltaBar */}
          {postTradeImpact && (
            <div className="pt-3 border-t border-surface-50/20">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Impatto post-scambio</p>
              <div className="flex flex-col gap-2">
                <DeltaBar before={balance} after={postTradeImpact.newBudget - postTradeImpact.newSalary} label="Bilancio" />
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500">Budget:</span>
                    <span className="text-primary-400 font-medium font-mono">{myTeam.budget}</span>
                    <span className="text-gray-600">&rarr;</span>
                    <span className={`font-semibold font-mono ${postTradeImpact.newBudget >= 0 ? 'text-primary-400' : 'text-danger-400'}`}>{postTradeImpact.newBudget}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500">Ingaggi:</span>
                    <span className="text-warning-400 font-medium font-mono">{myTeam.annualContractCost}</span>
                    <span className="text-gray-600">&rarr;</span>
                    <span className="text-warning-400 font-semibold font-mono">{postTradeImpact.newSalary}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
