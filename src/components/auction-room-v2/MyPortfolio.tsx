import { useState } from 'react'
import type { MyRosterSlots, RosterSlot } from '../../types/auctionroom.types'
import { POSITION_NAMES } from '../ui/PositionBadge'
import { getTeamLogo } from '../../utils/teamLogos'
import { getPlayerPhotoUrl } from '../../utils/player-images'
import { PlayerStatsModal } from '../PlayerStatsModal'
import type { PlayerInfo } from '../PlayerStatsModal'

interface MyPortfolioProps {
  myRosterSlots: MyRosterSlots | null
  budget: number
}

const POSITIONS = ['P', 'D', 'C', 'A'] as const

function getAgeColor(age: number | null | undefined): string {
  if (age == null) return 'text-gray-500'
  if (age < 20) return 'text-emerald-400'
  if (age < 25) return 'text-green-400'
  if (age < 30) return 'text-yellow-400'
  if (age < 35) return 'text-orange-400'
  return 'text-red-400'
}

function SlotPlayerPhoto({ apiFootballId, playerName, position, posGradient }: {
  apiFootballId?: number | null
  playerName: string
  position: string
  posGradient: string
}) {
  const [imgError, setImgError] = useState(false)
  const photoUrl = getPlayerPhotoUrl(apiFootballId)

  if (photoUrl && !imgError) {
    return (
      <img
        src={photoUrl}
        alt={playerName}
        className="w-5 h-5 rounded-full object-cover bg-slate-700 flex-shrink-0"
        onError={() => setImgError(true)}
      />
    )
  }
  return (
    <span className={`w-5 h-5 rounded-full bg-gradient-to-br ${posGradient} flex items-center justify-center text-[7px] font-bold text-white flex-shrink-0`}>
      {position}
    </span>
  )
}

const POS_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  P: { bg: 'bg-amber-500/15', border: 'border-amber-500/40', text: 'text-amber-400', badge: 'from-amber-500 to-amber-600' },
  D: { bg: 'bg-blue-500/15', border: 'border-blue-500/40', text: 'text-blue-400', badge: 'from-blue-500 to-blue-600' },
  C: { bg: 'bg-emerald-500/15', border: 'border-emerald-500/40', text: 'text-emerald-400', badge: 'from-emerald-500 to-emerald-600' },
  A: { bg: 'bg-red-500/15', border: 'border-red-500/40', text: 'text-red-400', badge: 'from-red-500 to-red-600' },
}

export function MyPortfolio({ myRosterSlots, budget }: MyPortfolioProps) {
  const [statsModalOpen, setStatsModalOpen] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState<{ player: RosterSlot; position: string } | null>(null)

  const handleSlotClick = (player: RosterSlot, position: string) => {
    setSelectedPlayer({ player, position })
    setStatsModalOpen(true)
  }

  if (!myRosterSlots) {
    return (
      <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-xl p-4">
        <div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto"></div>
      </div>
    )
  }

  const totalFilled = POSITIONS.reduce((sum, p) => sum + myRosterSlots.slots[p].filled, 0)
  const totalSlots = POSITIONS.reduce((sum, p) => sum + myRosterSlots.slots[p].total, 0)
  const totalSpent = POSITIONS.reduce((sum, p) =>
    sum + myRosterSlots.slots[p].players.reduce((s, pl) => s + pl.acquisitionPrice, 0), 0
  )

  // Analysis calculations
  const avgCostPerSlot = totalFilled > 0 ? Math.round(totalSpent / totalFilled) : 0

  // Liquidity for remaining slots: budget minus reserve for empty slots at min price
  const emptySlots = totalSlots - totalFilled
  const liquidityForAttack = emptySlots > 0 ? Math.max(0, budget - (emptySlots * 2)) : budget

  // Savings percentage vs avg quotation
  const totalQuotSpent = POSITIONS.reduce((sum, p) =>
    sum + myRosterSlots.slots[p].players.reduce((s, pl) => s + (pl.contract?.salary || pl.acquisitionPrice), 0), 0
  )
  const savingsPercent = totalSpent > 0 && totalQuotSpent > 0
    ? Math.round(((totalQuotSpent - totalSpent) / totalQuotSpent) * 100)
    : 0

  return (
    <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-white/10 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3 className="font-black text-white text-sm uppercase tracking-wide">Board Strategica</h3>
        </div>
        <span className="text-xs font-mono font-bold text-sky-400">{totalFilled}/{totalSlots} SLOT</span>
      </div>

      {/* Budget spent summary */}
      <div className="px-3 pt-2 pb-1 flex-shrink-0">
        <div className="flex items-center justify-between text-[11px] mb-1">
          <span className="text-gray-400">Budget Speso:</span>
          <span className="font-bold font-mono text-accent-400">{totalSpent}M</span>
        </div>
      </div>

      {/* Slot Grid per position */}
      <div className="flex-1 overflow-y-auto px-3 py-1.5 space-y-3">
        {POSITIONS.map(pos => {
          const slot = myRosterSlots.slots[pos]
          if (slot.total === 0) return null
          const isCurrent = myRosterSlots.currentRole === pos
          const colors = POS_COLORS[pos]
          const posName = POSITION_NAMES[pos as keyof typeof POSITION_NAMES] || pos

          return (
            <div key={pos} className={isCurrent ? 'opacity-100' : 'opacity-80'}>
              {/* Position header */}
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className={`w-5 h-5 rounded-full bg-gradient-to-br ${colors.badge} flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0`}>
                    {pos}
                  </span>
                  <span className="text-[11px] font-bold text-gray-300 uppercase">{posName}</span>
                </div>
                <span className={`text-[10px] font-mono font-bold flex-shrink-0 ${
                  slot.filled >= slot.total ? 'text-green-400' : 'text-gray-500'
                }`}>
                  {slot.filled}/{slot.total}
                </span>
              </div>

              {/* Slot rectangles — larger */}
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: slot.total }).map((_, i) => {
                  const player = slot.players[i]
                  if (player) {
                    return (
                      <button
                        key={i}
                        onClick={() => handleSlotClick(player, pos)}
                        className={`${colors.bg} border ${colors.border} rounded-lg px-2 py-1.5 min-w-[4.5rem] hover:brightness-125 transition-all cursor-pointer`}
                        title={`${player.playerName} - ${player.playerTeam} - ${player.acquisitionPrice}M${player.age ? ` - ${player.age} anni` : ''}`}
                      >
                        {/* Top row: photo + team logo */}
                        <div className="flex items-center justify-center gap-1 mb-0.5">
                          <SlotPlayerPhoto
                            apiFootballId={player.apiFootballId}
                            playerName={player.playerName}
                            position={pos}
                            posGradient={colors.badge}
                          />
                          <div className="w-4 h-4 bg-white/80 rounded flex items-center justify-center flex-shrink-0">
                            <img src={getTeamLogo(player.playerTeam)} alt={player.playerTeam} className="w-3 h-3 object-contain" />
                          </div>
                        </div>
                        {/* Name */}
                        <p className="text-[10px] text-gray-200 font-semibold truncate text-center">
                          {player.playerName.length > 8 ? player.playerName.slice(0, 7) + '.' : player.playerName}
                        </p>
                        {/* Price + age color */}
                        <div className="flex items-center justify-center gap-1">
                          <span className={`text-xs font-mono font-bold ${colors.text}`}>
                            {player.acquisitionPrice}M
                          </span>
                          {player.age != null && (
                            <span className={`text-[8px] font-bold ${getAgeColor(player.age)}`}>{player.age}a</span>
                          )}
                        </div>
                      </button>
                    )
                  }
                  return (
                    <div
                      key={i}
                      className={`border border-dashed ${colors.border} rounded-lg px-2 py-1.5 min-w-[4.5rem] text-center opacity-40 flex items-center justify-center`}
                    >
                      <span className="text-gray-600 text-lg leading-none">+</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* ANALISI OBIETTIVI */}
      {totalFilled > 0 && (
        <div className="p-3 border-t border-white/10 flex-shrink-0 space-y-2">
          <h4 className="text-[11px] font-bold text-white uppercase tracking-wider">Analisi Obiettivi</h4>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-800/50 rounded-lg px-2 py-1.5">
              <p className="text-[9px] text-gray-500 uppercase font-semibold">Costo Medio</p>
              <p className="text-sm font-mono font-bold text-white">{avgCostPerSlot}M</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg px-2 py-1.5">
              <p className="text-[9px] text-gray-500 uppercase font-semibold">Liquidita</p>
              <p className="text-sm font-mono font-bold text-sky-400">{liquidityForAttack}M</p>
            </div>
          </div>

          {savingsPercent !== 0 && (
            <p className={`text-[10px] leading-relaxed ${savingsPercent > 0 ? 'text-green-400' : 'text-amber-400'}`}>
              {savingsPercent > 0
                ? `Stai risparmiando il ${savingsPercent}% del budget previsto.`
                : `Stai spendendo il ${Math.abs(savingsPercent)}% in piu del previsto.`
              }
            </p>
          )}
        </div>
      )}

      {/* Player Stats Modal */}
      <PlayerStatsModal
        isOpen={statsModalOpen}
        onClose={() => { setStatsModalOpen(false); setSelectedPlayer(null) }}
        player={selectedPlayer ? {
          name: selectedPlayer.player.playerName,
          team: selectedPlayer.player.playerTeam,
          position: selectedPlayer.position,
          age: selectedPlayer.player.age,
          apiFootballId: selectedPlayer.player.apiFootballId,
        } as PlayerInfo : null}
      />
    </div>
  )
}
