/**
 * PlannerWidget - Budget Planner for Clause Day
 * Part of Sprint 3: Functional Planner Widget
 *
 * Features:
 * - Budget summary (available, committed, remaining)
 * - Planned targets list (from watchlist with maxBid)
 * - Budget impact calculator
 * - Risk indicators
 */

import { useMemo } from 'react'
import { getPlayerPhotoUrl } from '../utils/player-images'
import { getTeamLogo } from '../utils/teamLogos'

// Types for player preferences
interface PlayerPreference {
  maxBid: number | null
  priority: number | null
  notes: string | null
  isWatchlist: boolean
  isAutoPass: boolean
}

// Types for strategy players
interface StrategyPlayer {
  rosterId: string
  memberId: string
  playerId: string
  playerName: string
  playerPosition: string
  playerTeam: string
  playerQuotation: number
  playerApiFootballId?: number | null
  ownerUsername?: string
  ownerTeamName?: string | null
  contractSalary: number
  contractDuration: number
  contractClause: number
  rubataPrice: number
  preference?: PlayerPreference
}

// Types for svincolati
interface SvincolatoPlayer {
  id: string
  name: string
  team: string
  position: string
  quotation: number
  status: string
  apiFootballId?: number | null
  preference?: PlayerPreference
}

interface PlannerWidgetProps {
  isCollapsed?: boolean
  onToggleCollapse?: () => void
  budgetTotal?: number
  budgetUsed?: number
  strategiesData?: StrategyPlayer[]
  svincolatiData?: SvincolatoPlayer[]
  onPlayerClick?: (playerId: string) => void
  // Phase-aware execution
  phase?: 'scouting' | 'open_window' | 'clause_meeting'
  onExecutePlan?: () => void
}

// Position colors
const POS_COLORS: Record<string, string> = {
  P: 'bg-yellow-500',
  D: 'bg-green-500',
  C: 'bg-blue-500',
  A: 'bg-red-500',
}

// Export planned player type for use with ExecutePlanModal
export interface PlannedPlayer {
  id: string
  name: string
  position: string
  team: string
  quotation: number
  apiFootballId?: number | null
  maxBid: number
  priority: number
  type: 'owned' | 'svincolato'
  ownerTeam: string
  rubataPrice: number
}

export function PlannerWidget({
  isCollapsed = false,
  onToggleCollapse,
  budgetTotal = 100,
  budgetUsed = 0,
  strategiesData = [],
  svincolatiData = [],
  onPlayerClick,
  phase = 'scouting',
  onExecutePlan,
}: PlannerWidgetProps) {
  // Calculate available budget
  const budgetAvailable = budgetTotal - budgetUsed

  // Get all planned players (with maxBid or in watchlist with priority)
  const plannedPlayers = useMemo(() => {
    const owned = strategiesData
      .filter(p => p.preference?.maxBid || (p.preference?.isWatchlist && p.preference?.priority))
      .map(p => ({
        id: p.playerId,
        name: p.playerName,
        position: p.playerPosition,
        team: p.playerTeam,
        quotation: p.playerQuotation,
        apiFootballId: p.playerApiFootballId,
        maxBid: p.preference?.maxBid || 0,
        priority: p.preference?.priority || 5,
        type: 'owned' as const,
        ownerTeam: p.ownerTeamName || p.ownerUsername || 'Unknown',
        rubataPrice: p.rubataPrice,
      }))

    const svincolati = svincolatiData
      .filter(p => p.preference?.maxBid || (p.preference?.isWatchlist && p.preference?.priority))
      .map(p => ({
        id: p.id,
        name: p.name,
        position: p.position,
        team: p.team,
        quotation: p.quotation,
        apiFootballId: p.apiFootballId,
        maxBid: p.preference?.maxBid || 0,
        priority: p.preference?.priority || 5,
        type: 'svincolato' as const,
        ownerTeam: 'Svincolato',
        rubataPrice: p.quotation, // For svincolati, use quotation as estimate
      }))

    return [...owned, ...svincolati]
      .sort((a, b) => a.priority - b.priority)
  }, [strategiesData, svincolatiData])

  // Calculate total committed budget (sum of maxBids)
  const totalCommitted = useMemo(() => {
    return plannedPlayers.reduce((sum, p) => sum + (p.maxBid || 0), 0)
  }, [plannedPlayers])

  // Calculate remaining budget after planned purchases
  const budgetRemaining = budgetAvailable - totalCommitted

  // Risk level based on budget utilization
  const getRiskLevel = () => {
    const utilization = totalCommitted / budgetAvailable
    if (utilization > 1) return { level: 'danger', label: 'Superato', color: 'text-red-400', bg: 'bg-red-500/20' }
    if (utilization > 0.9) return { level: 'warning', label: 'Critico', color: 'text-orange-400', bg: 'bg-orange-500/20' }
    if (utilization > 0.7) return { level: 'caution', label: 'Attenzione', color: 'text-yellow-400', bg: 'bg-yellow-500/20' }
    return { level: 'safe', label: 'OK', color: 'text-green-400', bg: 'bg-green-500/20' }
  }

  const risk = getRiskLevel()

  // Group players by priority
  const playersByPriority = useMemo(() => {
    const high = plannedPlayers.filter(p => p.priority === 1)
    const medium = plannedPlayers.filter(p => p.priority === 2)
    const low = plannedPlayers.filter(p => p.priority >= 3)
    return { high, medium, low }
  }, [plannedPlayers])

  // Collapsed view
  if (isCollapsed) {
    return (
      <div className="w-12 bg-surface-200 rounded-2xl border border-surface-50/20 p-2 flex flex-col items-center gap-3">
        <button
          onClick={onToggleCollapse}
          className="w-8 h-8 rounded-lg bg-surface-300 hover:bg-surface-100 text-gray-400 hover:text-white flex items-center justify-center transition-colors"
          title="Espandi planner"
        >
          <span className="text-lg">📋</span>
        </button>

        {/* Quick stats */}
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="text-xs text-gray-500">Budget</div>
          <div className={`text-sm font-bold ${budgetRemaining >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {budgetRemaining}M
          </div>
        </div>

        <div className="flex flex-col items-center gap-2 text-center mt-2">
          <div className="text-xs text-gray-500">Piano</div>
          <div className="text-sm font-bold text-blue-400">{plannedPlayers.length}</div>
        </div>

        {/* Risk indicator */}
        {plannedPlayers.length > 0 && (
          <div className={`w-8 h-8 rounded-lg ${risk.bg} flex items-center justify-center`} title={risk.label}>
            <span className="text-lg">
              {risk.level === 'danger' ? '🔴' : risk.level === 'warning' ? '🟠' : risk.level === 'caution' ? '🟡' : '🟢'}
            </span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="w-72 bg-surface-200 rounded-2xl border border-surface-50/20 overflow-hidden flex-shrink-0 flex flex-col max-h-[calc(100vh-200px)]">
      {/* Header */}
      <div className="p-3 border-b border-surface-50/20 flex items-center justify-between bg-gradient-to-r from-blue-500/10 to-purple-500/10 flex-shrink-0">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <span>📋</span>
          Planner Clausole
        </h3>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="w-7 h-7 rounded-lg bg-surface-300 hover:bg-surface-100 text-gray-400 hover:text-white flex items-center justify-center transition-colors"
            title="Comprimi planner"
          >
            <span className="text-xs">▶</span>
          </button>
        )}
      </div>

      {/* Budget Summary */}
      <div className="p-3 border-b border-surface-50/20 flex-shrink-0">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Budget Totale</span>
            <span className="text-white font-medium">{budgetTotal}M</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Contratti attuali</span>
            <span className="text-gray-400">-{budgetUsed}M</span>
          </div>
          <div className="flex items-center justify-between text-xs border-t border-surface-50/20 pt-2">
            <span className="text-gray-400 font-medium">Disponibile</span>
            <span className="text-lg font-bold text-green-400">{budgetAvailable}M</span>
          </div>
        </div>

        {/* Budget progress bar */}
        <div className="mt-2 h-2 bg-surface-300 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-300"
            style={{ width: `${Math.min(100, (budgetAvailable / budgetTotal) * 100)}%` }}
          />
        </div>
      </div>

      {/* Planned Budget Impact */}
      {plannedPlayers.length > 0 && (
        <div className="p-3 border-b border-surface-50/20 flex-shrink-0">
          <div className="text-xs text-gray-500 mb-2">📊 Impatto Budget Pianificato</div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Offerte pianificate ({plannedPlayers.length})</span>
              <span className="text-orange-400 font-medium">-{totalCommitted}M</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400 font-medium">Budget rimanente</span>
              <span className={`font-bold ${budgetRemaining >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {budgetRemaining}M
              </span>
            </div>
          </div>

          {/* Risk indicator */}
          <div className={`mt-2 px-2 py-1.5 rounded-lg ${risk.bg} flex items-center justify-between`}>
            <span className="text-xs text-gray-400">Livello rischio</span>
            <span className={`text-xs font-bold ${risk.color}`}>{risk.label}</span>
          </div>
        </div>
      )}

      {/* Planned Players List - Scrollable */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {plannedPlayers.length === 0 ? (
          <div className="p-4 text-center">
            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl">🎯</span>
            </div>
            <p className="text-xs text-gray-400 mb-2">
              Nessun obiettivo pianificato
            </p>
            <p className="text-[10px] text-gray-500">
              Imposta un'offerta massima o aggiungi alla watchlist con priorità nella pagina Giocatori
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {/* High priority */}
            {playersByPriority.high.length > 0 && (
              <div>
                <div className="text-[10px] font-bold text-red-400 uppercase px-1 mb-1 flex items-center gap-1">
                  <span>🔴</span> Priorità Alta ({playersByPriority.high.length})
                </div>
                {playersByPriority.high.map(player => (
                  <PlayerPlanCard
                    key={player.id}
                    player={player}
                    onClick={() => onPlayerClick?.(player.id)}
                  />
                ))}
              </div>
            )}

            {/* Medium priority */}
            {playersByPriority.medium.length > 0 && (
              <div>
                <div className="text-[10px] font-bold text-yellow-400 uppercase px-1 mb-1 flex items-center gap-1">
                  <span>🟡</span> Priorità Media ({playersByPriority.medium.length})
                </div>
                {playersByPriority.medium.map(player => (
                  <PlayerPlanCard
                    key={player.id}
                    player={player}
                    onClick={() => onPlayerClick?.(player.id)}
                  />
                ))}
              </div>
            )}

            {/* Low priority */}
            {playersByPriority.low.length > 0 && (
              <div>
                <div className="text-[10px] font-bold text-gray-400 uppercase px-1 mb-1 flex items-center gap-1">
                  <span>⚪</span> Altre priorità ({playersByPriority.low.length})
                </div>
                {playersByPriority.low.map(player => (
                  <PlayerPlanCard
                    key={player.id}
                    player={player}
                    onClick={() => onPlayerClick?.(player.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <div className="p-3 border-t border-surface-50/20 bg-surface-300/30 flex-shrink-0">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-[10px] text-gray-500 mb-0.5">Obiettivi</div>
            <div className="text-sm font-bold text-blue-400">{plannedPlayers.length}</div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500 mb-0.5">Totale</div>
            <div className="text-sm font-bold text-orange-400">{totalCommitted}M</div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500 mb-0.5">Rimanente</div>
            <div className={`text-sm font-bold ${budgetRemaining >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {budgetRemaining}M
            </div>
          </div>
        </div>

        {/* Execute Plan Button - Only visible during clause_meeting phase */}
        {phase === 'clause_meeting' && plannedPlayers.length > 0 && onExecutePlan && (
          <button
            onClick={onExecutePlan}
            className="w-full mt-3 py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <span>{'\uD83C\uDFAF'}</span>
            Esegui Piano ({plannedPlayers.length} clausole)
          </button>
        )}
      </div>
    </div>
  )
}

// Sub-component for player card
interface PlayerPlanCardProps {
  player: {
    id: string
    name: string
    position: string
    team: string
    apiFootballId?: number | null
    maxBid: number
    priority: number
    type: 'owned' | 'svincolato'
    ownerTeam: string
    rubataPrice: number
  }
  onClick?: () => void
}

function PlayerPlanCard({ player, onClick }: PlayerPlanCardProps) {
  const priceComparison = player.maxBid - player.rubataPrice
  const isGoodDeal = priceComparison >= 0
  const photoUrl = getPlayerPhotoUrl(player.apiFootballId)
  const teamLogoUrl = getTeamLogo(player.team)

  return (
    <button
      onClick={onClick}
      className="w-full p-2 rounded-lg bg-surface-300/50 hover:bg-surface-300 transition-colors text-left mb-1"
    >
      <div className="flex items-center gap-2">
        {/* Player photo with position badge */}
        <div className="relative flex-shrink-0">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={player.name}
              className="w-8 h-8 rounded-full object-cover bg-surface-300 border border-surface-50/30"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none'
                const fallback = (e.target as HTMLImageElement).nextElementSibling as HTMLElement
                if (fallback) fallback.style.display = 'flex'
              }}
            />
          ) : null}
          <span
            className={`w-8 h-8 rounded-full text-[10px] font-bold text-white items-center justify-center ${POS_COLORS[player.position] || 'bg-gray-500'} ${photoUrl ? 'hidden' : 'flex'}`}
          >
            {player.position}
          </span>
          {/* Position badge overlay */}
          {photoUrl && (
            <span className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full text-[8px] font-bold text-white flex items-center justify-center ${POS_COLORS[player.position] || 'bg-gray-500'} border border-surface-200`}>
              {player.position}
            </span>
          )}
        </div>

        {/* Player info */}
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-white truncate">{player.name}</div>
          <div className="text-[10px] text-gray-500 truncate flex items-center gap-1">
            {teamLogoUrl && (
              <img
                src={teamLogoUrl}
                alt={player.team}
                className="w-3 h-3 object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            )}
            {player.team} • {player.type === 'svincolato' ? '🆓' : `da ${player.ownerTeam}`}
          </div>
        </div>

        {/* Bid info */}
        <div className="text-right flex-shrink-0">
          <div className="text-xs font-bold text-orange-400">{player.maxBid}M</div>
          <div className={`text-[10px] ${isGoodDeal ? 'text-green-400' : 'text-red-400'}`}>
            {isGoodDeal ? '✓' : '!'} vs {player.rubataPrice}M
          </div>
        </div>
      </div>
    </button>
  )
}

export default PlannerWidget
