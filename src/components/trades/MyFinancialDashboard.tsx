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
      <CardContent className="py-4">
        <div className="flex flex-col gap-3">
          {/* Main layout: gauge + KPIs + bar */}
          <div className="flex flex-col md:flex-row items-start gap-4">
            {/* Gauge */}
            <div className="flex flex-col items-center flex-shrink-0 self-center md:self-start">
              <BilancioGauge bilancio={balance} budget={myTeam.budget} size={160} />
            </div>
            {/* KPIs + Bar */}
            <div className="flex flex-col gap-3 min-w-0 flex-1 w-full">
              {/* KPI Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* Budget */}
                <div className="bg-surface-300/60 rounded-lg p-2.5 border border-surface-50/20">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide">Budget</p>
                  <p className="text-lg font-bold text-primary-400">{myTeam.budget}</p>
                </div>
                {/* Ingaggi */}
                <div className="bg-surface-300/60 rounded-lg p-2.5 border border-surface-50/20">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide">Ingaggi</p>
                  <p className="text-lg font-bold text-accent-400">{myTeam.annualContractCost}</p>
                </div>
                {/* Bilancio */}
                <div className="bg-surface-300/60 rounded-lg p-2.5 border border-surface-50/20">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide">Bilancio</p>
                  <p className={`text-lg font-bold ${healthColor}`}>{balance}</p>
                </div>
                {/* Rosa/Slot */}
                <div className="bg-surface-300/60 rounded-lg p-2.5 border border-surface-50/20">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide">Rosa</p>
                  <p className="text-lg font-bold text-white">
                    {myTeam.slotCount}<span className="text-sm text-gray-500">/{myTeam.maxSlots}</span>
                  </p>
                  {myTeam.slotsFree > 0 && (
                    <p className="text-[10px] text-secondary-400">{myTeam.slotsFree} liberi</p>
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
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Impatto post-scambio</p>
              <div className="flex flex-col gap-2">
                <DeltaBar before={balance} after={postTradeImpact.newBudget - postTradeImpact.newSalary} label="Bilancio" />
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-500">Budget:</span>
                    <span className="text-primary-400 font-medium">{myTeam.budget}</span>
                    <span className="text-gray-600">&rarr;</span>
                    <span className={`font-semibold ${postTradeImpact.newBudget >= 0 ? 'text-primary-400' : 'text-danger-400'}`}>{postTradeImpact.newBudget}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-500">Ingaggi:</span>
                    <span className="text-warning-400 font-medium">{myTeam.annualContractCost}</span>
                    <span className="text-gray-600">&rarr;</span>
                    <span className="text-warning-400 font-semibold">{postTradeImpact.newSalary}</span>
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
