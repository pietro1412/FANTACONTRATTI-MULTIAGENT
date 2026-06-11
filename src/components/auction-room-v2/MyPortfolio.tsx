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
        className="w-6 h-6 rounded-full object-cover bg-surface-100 flex-shrink-0"
        onError={() => { setImgError(true); }}
      />
    )
  }
  return (
    <span className={`w-6 h-6 rounded-full bg-gradient-to-br ${posGradient} flex items-center justify-center text-sm font-bold text-white flex-shrink-0`}>
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

export function MyPortfolio({ myRosterSlots, budget: _budget }: MyPortfolioProps) {
  const [statsModalOpen, setStatsModalOpen] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState<{ player: RosterSlot; position: string } | null>(null)

  const handleSlotClick = (player: RosterSlot, position: string) => {
    setSelectedPlayer({ player, position })
    setStatsModalOpen(true)
  }

  if (!myRosterSlots) {
    return (
      <div className="bg-surface-200 border border-surface-50 rounded-xl p-4">
        <div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto"></div>
      </div>
    )
  }

  const totalFilled = POSITIONS.reduce((sum, p) => sum + myRosterSlots.slots[p].filled, 0)
  const totalSlots = POSITIONS.reduce((sum, p) => sum + myRosterSlots.slots[p].total, 0)
  const totalSpent = POSITIONS.reduce((sum, p) =>
    sum + myRosterSlots.slots[p].players.reduce((s, pl) => s + pl.acquisitionPrice, 0), 0
  )

  return (
    <div className="bg-surface-200 border border-surface-50 rounded-xl overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-surface-50 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3 className="micro-label">La mia rosa</h3>
        </div>
        <span className="text-sms font-mono font-bold text-sky-400">{totalFilled}/{totalSlots} SLOT</span>
      </div>

      {/* Roster as compact rows per position */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {POSITIONS.map(pos => {
          const slot = myRosterSlots.slots[pos]
          if (slot.total === 0) return null
          const isCurrent = myRosterSlots.currentRole === pos
          const colors = POS_COLORS[pos] ?? { bg: 'bg-gray-500/15', border: 'border-gray-500/40', text: 'text-gray-400', badge: 'from-gray-500 to-gray-600' }
          const posName = POSITION_NAMES[pos as keyof typeof POSITION_NAMES] || pos

          return (
            <div key={pos} className={isCurrent ? 'opacity-100' : 'opacity-80'}>
              {/* Position header */}
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className={`w-5 h-5 rounded-full bg-gradient-to-br ${colors.badge} flex items-center justify-center text-sm font-bold text-white flex-shrink-0`}>
                    {pos}
                  </span>
                  <span className="text-sm font-bold text-gray-300 uppercase">{posName}</span>
                </div>
                <span className={`text-sm font-mono font-bold flex-shrink-0 ${
                  slot.filled >= slot.total ? 'text-green-400' : 'text-gray-500'
                }`}>
                  {slot.filled}/{slot.total}
                </span>
              </div>

              {/* Player rows + empty slots */}
              <div className="space-y-1">
                {Array.from({ length: slot.total }).map((_, i) => {
                  const player = slot.players[i]
                  if (player) {
                    return (
                      <button
                        key={i}
                        onClick={() => { handleSlotClick(player, pos); }}
                        className={`w-full flex items-center gap-2 ${colors.bg} border ${colors.border} rounded-lg px-2 py-1.5 hover:brightness-125 transition-all cursor-pointer text-left`}
                        title={`${player.playerName} - ${player.playerTeam} - ${player.acquisitionPrice}M${player.age ? ` - ${player.age} anni` : ''}`}
                      >
                        <SlotPlayerPhoto
                          apiFootballId={player.apiFootballId}
                          playerName={player.playerName}
                          position={pos}
                          posGradient={colors.badge}
                        />
                        <span className="flex-1 min-w-0 text-sm text-gray-200 font-semibold truncate">
                          {player.playerName}
                        </span>
                        <span className="w-4 h-4 bg-white/80 rounded flex items-center justify-center flex-shrink-0">
                          <img src={getTeamLogo(player.playerTeam)} alt={player.playerTeam} className="w-3 h-3 object-contain" />
                        </span>
                        {player.age != null && (
                          <span className={`text-sm font-bold flex-shrink-0 ${getAgeColor(player.age)}`}>{player.age}a</span>
                        )}
                        <span className={`text-sms font-mono font-bold flex-shrink-0 ${colors.text}`}>
                          {player.acquisitionPrice}M
                        </span>
                      </button>
                    )
                  }
                  // First empty slot of the active role is the one at stake right now
                  const isNextAtStake = isCurrent && i === slot.filled
                  return (
                    <div
                      key={i}
                      className={`flex items-center justify-center rounded-lg px-2 py-1.5 border border-dashed ${
                        isNextAtStake
                          ? 'border-secondary-500/60 bg-secondary-500/10'
                          : `${colors.border} opacity-40`
                      }`}
                    >
                      <span className={`text-sm ${isNextAtStake ? 'text-secondary-400 font-semibold' : 'text-gray-400'}`}>
                        {isNextAtStake ? 'Slot libero — in asta ora' : 'Slot libero'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer: budget spent */}
      <div className="px-3 py-2 border-t border-surface-50 flex-shrink-0 flex items-center justify-between">
        <span className="text-sm text-gray-400">Budget speso</span>
        <span className="text-sms font-mono font-bold text-accent-400">{totalSpent}M</span>
      </div>

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
