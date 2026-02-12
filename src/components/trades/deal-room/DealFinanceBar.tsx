import type { TeamData } from '../../finance/types'
import { getTeamBalance, getHealthStatus, HEALTH_COLORS } from '../../finance/types'

interface DealFinanceBarProps {
  isInTradePhase: boolean
  currentPhase: string | null
  pusherConnected: boolean
  myTeam: TeamData | null
  hasFinancialDetails: boolean
  postTradeImpact?: {
    budgetDelta: number
    newBudget: number
    newSalary: number
    rosterDelta: number
  } | null
}

export function DealFinanceBar({
  isInTradePhase,
  currentPhase,
  pusherConnected,
  myTeam,
  hasFinancialDetails,
  postTradeImpact,
}: DealFinanceBarProps) {
  if (!myTeam) return null

  const balance = getTeamBalance(myTeam, hasFinancialDetails)
  const health = getHealthStatus(balance)
  const healthColor = HEALTH_COLORS[health]

  const hasImpact = postTradeImpact && (postTradeImpact.budgetDelta !== 0 || postTradeImpact.rosterDelta !== 0)

  return (
    <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-xl px-4 py-3 mb-3">
      <div className="flex items-center gap-4 md:gap-5 flex-wrap">
        {/* Phase badge */}
        <div className="flex items-center gap-2">
          <div className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
            isInTradePhase
              ? 'bg-secondary-500/20 text-secondary-400 border border-secondary-500/40'
              : 'bg-surface-300 text-gray-400'
          }`}>
            {isInTradePhase ? 'Scambi Attivi' : 'Non Disponibili'}
          </div>
          <div
            className={`w-2 h-2 rounded-full flex-shrink-0 ${pusherConnected ? 'bg-green-400' : 'bg-red-400'}`}
            title={pusherConnected ? 'Real-time connesso' : 'Real-time disconnesso'}
          />
        </div>

        {/* Separator */}
        <div className="hidden md:block w-px h-5 bg-white/10" />

        {/* KPIs */}
        <div className="flex items-center gap-4 md:gap-5 flex-wrap">
          {/* Budget */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs uppercase text-gray-500 tracking-wide">Budget</span>
            <span className="font-mono font-bold text-sm md:text-base text-white">{myTeam.budget}</span>
            {hasImpact && (
              <span className={`font-mono text-xs font-semibold ${postTradeImpact.budgetDelta >= 0 ? 'text-green-400' : 'text-danger-400'}`}>
                {postTradeImpact.budgetDelta >= 0 ? '+' : ''}{postTradeImpact.budgetDelta}
              </span>
            )}
          </div>

          {/* Salary */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs uppercase text-gray-500 tracking-wide">Ingaggi</span>
            <span className="font-mono font-bold text-sm md:text-base text-white">{myTeam.annualContractCost}</span>
            {hasImpact && postTradeImpact.newSalary !== myTeam.annualContractCost && (
              <span className={`font-mono text-xs font-semibold ${postTradeImpact.newSalary <= myTeam.annualContractCost ? 'text-green-400' : 'text-danger-400'}`}>
                &rarr;{postTradeImpact.newSalary}
              </span>
            )}
          </div>

          {/* Balance */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs uppercase text-gray-500 tracking-wide">Bilancio</span>
            <span className={`font-mono font-bold text-sm md:text-base ${healthColor}`}>
              {balance >= 0 ? '+' : ''}{balance}
            </span>
          </div>

          {/* Roster count */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs uppercase text-gray-500 tracking-wide">Rosa</span>
            <span className="font-mono font-bold text-sm md:text-base text-white">
              {myTeam.slotCount}/{myTeam.maxSlots}
            </span>
            {hasImpact && postTradeImpact.rosterDelta !== 0 && (
              <span className={`font-mono text-xs font-semibold ${postTradeImpact.rosterDelta > 0 ? 'text-primary-400' : 'text-danger-400'}`}>
                {postTradeImpact.rosterDelta > 0 ? '+' : ''}{postTradeImpact.rosterDelta}
              </span>
            )}
          </div>
        </div>

        {/* Phase name - show on larger screens */}
        {currentPhase && (
          <div className="hidden lg:flex items-center ml-auto">
            <span className="text-xs text-gray-600 truncate max-w-[200px]">{currentPhase}</span>
          </div>
        )}
      </div>
    </div>
  )
}
