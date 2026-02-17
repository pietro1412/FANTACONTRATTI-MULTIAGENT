import { KPICard } from '../finance/KPICard'
import type { LeagueTotals } from '../finance/types'

interface FinancialKPIsProps {
  totals: LeagueTotals
  initialBudget: number
  teamCount: number
}

export function FinancialKPIs({ totals, initialBudget, teamCount }: FinancialKPIsProps) {
  const totalLeagueBudget = initialBudget * teamCount
  const balancePct = totalLeagueBudget > 0 ? (totals.totalBalance / totalLeagueBudget) * 100 : 0
  const salaryPct = totalLeagueBudget > 0 ? (totals.totalContracts / totalLeagueBudget) * 100 : 0

  const balanceVariant = balancePct > 50 ? 'success' : balancePct > 25 ? 'warning' : 'danger'
  const liquidityVariant = totals.liquidityAvg > 200 ? 'success' : totals.liquidityAvg > 100 ? 'warning' : 'danger'

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <KPICard
        title="Bilancio Totale"
        value={`${totals.totalBalance >= 0 ? '+' : ''}${totals.totalBalance}`}
        subtitle={`${balancePct.toFixed(0)}% del budget lega`}
        progress={Math.min(100, balancePct)}
        progressColor={balanceVariant === 'success' ? 'bg-green-500' : balanceVariant === 'warning' ? 'bg-amber-500' : 'bg-danger-500'}
        variant={balanceVariant}
        description="Somma dei bilanci (budget - ingaggi) di tutti i manager"
      />
      <KPICard
        title="Monte Ingaggi"
        value={`${totals.totalContracts}`}
        subtitle={`${salaryPct.toFixed(0)}% del budget totale`}
        progress={Math.min(100, salaryPct)}
        progressColor="bg-primary-500"
        variant="default"
        description="Costo totale annuale di tutti i contratti attivi"
      />
      <KPICard
        title="Liquidit\u00E0 Media"
        value={`${totals.liquidityAvg >= 0 ? '+' : ''}${Math.round(totals.liquidityAvg)}`}
        subtitle={`Min ${totals.liquidityMin} / Max ${totals.liquidityMax}`}
        variant={liquidityVariant}
        description="Media del bilancio disponibile per manager"
      />
    </div>
  )
}
