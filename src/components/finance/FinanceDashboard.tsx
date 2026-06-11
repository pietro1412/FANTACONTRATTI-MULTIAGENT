import { useMemo } from 'react'
import { SectionTitle } from './KPICard'
import { MyTeamHero } from './MyTeamHero'
import { TeamRanking } from './TeamRanking'
import { type FinancialsData, type LeagueTotals, computeLeagueTotals } from './types'

interface FinanceDashboardProps {
  data: FinancialsData
  myTeamId?: string
  onTeamClick: (memberId: string) => void
  onNavigateToRoster: () => void
  onShowMovements: () => void
}

// Small demoted KPI card for league-level aggregates
function LeagueKpi({ label, value, unit, note }: { label: string; value: string; unit?: string; note?: string }) {
  return (
    <div className="rounded-xl border border-surface-50/60 bg-surface-200 p-3.5 md:p-4">
      <div className="micro-label">{label}</div>
      <div className="stat-number mt-1.5 text-2xl leading-none text-white">
        {value}
        {unit && <span className="ml-0.5 text-[13px] font-medium text-gray-400">{unit}</span>}
      </div>
      {note && <div className="mt-1.5 text-[11px] text-gray-500">{note}</div>}
    </div>
  )
}

export function FinanceDashboard({ data, myTeamId, onTeamClick, onNavigateToRoster, onShowMovements }: FinanceDashboardProps) {
  const totals: LeagueTotals = useMemo(() => computeLeagueTotals(data), [data])

  const teamsCount = data.teams.length
  const myTeam = useMemo(
    () => (myTeamId ? data.teams.find(t => t.memberId === myTeamId) : undefined),
    [data.teams, myTeamId]
  )

  const avgBudget = teamsCount > 0
    ? Math.round(data.teams.reduce((sum, t) => sum + t.budget, 0) / teamsCount)
    : 0
  const avgContracts = teamsCount > 0
    ? Math.round(data.teams.reduce((sum, t) => sum + t.annualContractCost, 0) / teamsCount)
    : 0

  const budgetRank = useMemo(() => {
    if (!myTeam) return 0
    const sorted = [...data.teams].sort((a, b) => b.budget - a.budget)
    return sorted.findIndex(t => t.memberId === myTeam.memberId) + 1
  }, [data.teams, myTeam])

  return (
    <div className="space-y-5 md:space-y-7">
      {/* Hero: la mia squadra */}
      {myTeam && (
        <MyTeamHero
          team={myTeam}
          leagueName={data.leagueName}
          teamsCount={teamsCount}
          budgetRank={budgetRank}
          hasFinancialDetails={totals.hasFinancialDetails}
          onNavigateToRoster={onNavigateToRoster}
          onShowMovements={onShowMovements}
        />
      )}

      {/* League KPIs (demoted) */}
      <section>
        <SectionTitle
          title="La lega in numeri"
          subtitle="Valori medi e volumi della sessione visualizzata"
        />
        <div className="grid grid-cols-2 gap-2 md:gap-3.5 lg:grid-cols-4">
          <LeagueKpi
            label="Budget medio per squadra"
            value={`${avgBudget}`}
            unit="M"
            note={myTeam ? `il tuo: ${myTeam.budget}M` : undefined}
          />
          <LeagueKpi
            label="Monte ingaggi medio"
            value={`${avgContracts}`}
            unit="M/anno"
            note={myTeam ? `il tuo: ${myTeam.annualContractCost}M/anno` : undefined}
          />
          <LeagueKpi
            label="Volume scambi"
            value={`${totals.totalTradeBudgetIn}`}
            unit="M"
            note={totals.hasTradeData ? 'crediti trasferiti negli scambi' : 'nessuno scambio in sessione'}
          />
          <LeagueKpi
            label="Giocatori sotto contratto"
            value={`${totals.totalSlots}`}
            note={`su ${totals.maxTotalSlots} slot totali di lega`}
          />
        </div>
      </section>

      {/* Balance ranking */}
      <section>
        <SectionTitle
          title="Classifica bilanci"
          subtitle="Bilancio disponibile per squadra (budget − ingaggi) — la tua riga è evidenziata"
        />
        <TeamRanking
          teams={data.teams}
          hasFinancialDetails={totals.hasFinancialDetails}
          myTeamId={myTeamId}
          onTeamClick={onTeamClick}
        />
      </section>
    </div>
  )
}
