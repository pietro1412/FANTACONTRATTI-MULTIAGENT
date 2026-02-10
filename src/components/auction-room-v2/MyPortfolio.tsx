import type { MyRosterSlots } from '../../types/auctionroom.types'
import { SlotProgress } from './SlotProgress'
import { getTeamLogo } from '../../utils/teamLogos'
import { useState } from 'react'

interface MyPortfolioProps {
  myRosterSlots: MyRosterSlots | null
  budget: number
}

const POSITIONS = ['P', 'D', 'C', 'A'] as const

export function MyPortfolio({ myRosterSlots, budget }: MyPortfolioProps) {
  const [expanded, setExpanded] = useState<string | null>(null)

  if (!myRosterSlots) {
    return (
      <div className="bg-surface-200 rounded-xl border border-surface-50/20 p-4">
        <div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto"></div>
      </div>
    )
  }

  const totalFilled = POSITIONS.reduce((sum, p) => sum + myRosterSlots.slots[p].filled, 0)
  const totalSlots = POSITIONS.reduce((sum, p) => sum + myRosterSlots.slots[p].total, 0)

  return (
    <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="p-2 border-b border-surface-50/20 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm">📋</span>
          <h3 className="font-bold text-white text-xs">La Mia Rosa</h3>
        </div>
        <span className="text-xs font-mono text-gray-400">{totalFilled}/{totalSlots}</span>
      </div>

      {/* Budget bar */}
      <div className="px-3 pt-2 flex-shrink-0">
        <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
          <span>Budget</span>
          <span className="font-bold text-accent-400">{budget}</span>
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

      {/* Expandable roster */}
      <div className="flex-1 overflow-y-auto divide-y divide-surface-50/10 border-t border-surface-50/10">
        {POSITIONS.map(pos => {
          const slot = myRosterSlots.slots[pos]
          if (slot.players.length === 0) return null
          const isExpanded = expanded === pos
          return (
            <div key={pos}>
              <button
                onClick={() => setExpanded(isExpanded ? null : pos)}
                className="w-full px-3 py-1.5 flex items-center justify-between text-xs hover:bg-surface-300/30 transition-colors"
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
                        <tr key={p.id} className="border-t border-surface-50/10">
                          <td className="py-1">
                            <div className="flex items-center gap-1">
                              <div className="w-3.5 h-3.5 bg-white/90 rounded flex items-center justify-center flex-shrink-0">
                                <img src={getTeamLogo(p.playerTeam)} alt={p.playerTeam} className="w-2.5 h-2.5 object-contain" />
                              </div>
                              <span className="text-gray-200 truncate">{p.playerName}</span>
                            </div>
                          </td>
                          <td className="text-center text-accent-400 font-bold">{p.acquisitionPrice}</td>
                          <td className="text-center text-white">{p.contract?.salary ?? '-'}</td>
                          <td className="text-center text-white">{p.contract?.duration ?? '-'}</td>
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
