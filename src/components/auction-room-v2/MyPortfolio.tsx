import type { MyRosterSlots } from '../../types/auctionroom.types'
import { SlotProgress } from './SlotProgress'
import { getTeamLogo } from '../../utils/teamLogos'
import { useState } from 'react'

interface MyPortfolioProps {
  myRosterSlots: MyRosterSlots | null
  budget: number
}

const POSITIONS = ['P', 'D', 'C', 'A'] as const

const POS_BORDER_COLORS: Record<string, string> = {
  P: 'border-amber-500/40',
  D: 'border-blue-500/40',
  C: 'border-emerald-500/40',
  A: 'border-red-500/40',
}

const POS_BG_COLORS: Record<string, string> = {
  P: 'bg-amber-500/10',
  D: 'bg-blue-500/10',
  C: 'bg-emerald-500/10',
  A: 'bg-red-500/10',
}

export function MyPortfolio({ myRosterSlots, budget }: MyPortfolioProps) {
  const [expanded, setExpanded] = useState<string | null>(null)

  if (!myRosterSlots) {
    return (
      <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-xl p-4">
        <div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto"></div>
      </div>
    )
  }

  const totalFilled = POSITIONS.reduce((sum, p) => sum + myRosterSlots.slots[p].filled, 0)
  const totalSlots = POSITIONS.reduce((sum, p) => sum + myRosterSlots.slots[p].total, 0)

  return (
    <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="p-2.5 border-b border-white/10 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3 className="font-bold text-white text-xs">La Mia Rosa</h3>
        </div>
        <span className="text-xs font-mono text-gray-400">{totalFilled}/{totalSlots}</span>
      </div>

      {/* Budget bar */}
      <div className="px-3 pt-2 flex-shrink-0">
        <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
          <span>Budget</span>
          <span className="font-bold font-mono text-accent-400">{budget}</span>
        </div>
      </div>

      {/* Slot progress bars */}
      <div className="px-3 py-2 space-y-1 flex-shrink-0">
        {POSITIONS.map(pos => {
          const slot = myRosterSlots.slots[pos]
          return (
            <SlotProgress
              key={pos}
              position={pos}
              filled={slot.filled}
              total={slot.total}
              isCurrent={myRosterSlots.currentRole === pos}
            />
          )
        })}
      </div>

      {/* Visual Slot Rectangles per position */}
      <div className="px-3 pb-2 space-y-2 flex-shrink-0">
        {POSITIONS.map(pos => {
          const slot = myRosterSlots.slots[pos]
          if (slot.total === 0) return null
          return (
            <div key={pos}>
              <div className="flex gap-1 flex-wrap">
                {Array.from({ length: slot.total }).map((_, i) => {
                  const player = slot.players[i]
                  return (
                    <div
                      key={i}
                      className={`h-6 rounded text-[9px] font-medium flex items-center justify-center px-1 min-w-[28px] ${
                        player
                          ? `${POS_BG_COLORS[pos]} ${POS_BORDER_COLORS[pos]} border text-gray-200`
                          : `border border-dashed ${POS_BORDER_COLORS[pos]} text-gray-600`
                      }`}
                    >
                      {player ? player.playerName.split(' ').pop()?.slice(0, 5) : ''}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Expandable roster details */}
      <div className="flex-1 overflow-y-auto divide-y divide-white/5 border-t border-white/5">
        {POSITIONS.map(pos => {
          const slot = myRosterSlots.slots[pos]
          if (slot.players.length === 0) return null
          const isExpanded = expanded === pos
          return (
            <div key={pos}>
              <button
                onClick={() => setExpanded(isExpanded ? null : pos)}
                className="w-full px-3 py-1.5 flex items-center justify-between text-xs hover:bg-white/5 transition-colors"
              >
                <span className="text-gray-300 font-medium">{pos} ({slot.players.length})</span>
                <svg className={`w-3 h-3 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {isExpanded && (
                <div className="px-3 pb-2">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="text-gray-500 uppercase">
                        <th className="text-left font-medium pb-0.5">Giocatore</th>
                        <th className="text-center font-medium pb-0.5 w-10">Pr.</th>
                        <th className="text-center font-medium pb-0.5 w-8">Ing.</th>
                        <th className="text-center font-medium pb-0.5 w-8">Dur.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {slot.players.map(p => (
                        <tr key={p.id} className="border-t border-white/5">
                          <td className="py-1">
                            <div className="flex items-center gap-1">
                              <div className="w-3.5 h-3.5 bg-white/90 rounded flex items-center justify-center flex-shrink-0">
                                <img src={getTeamLogo(p.playerTeam)} alt={p.playerTeam} className="w-2.5 h-2.5 object-contain" />
                              </div>
                              <span className="text-gray-200 truncate">{p.playerName}</span>
                            </div>
                          </td>
                          <td className="text-center text-accent-400 font-bold font-mono">{p.acquisitionPrice}</td>
                          <td className="text-center text-white font-mono">{p.contract?.salary ?? '-'}</td>
                          <td className="text-center text-white font-mono">{p.contract?.duration ?? '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
