import { useState } from 'react'
import type { TeamData } from '../finance/types'
import { getTeamBalance } from '../finance/types'
import { ManagerCard } from './ManagerCard'

interface ManagerGridProps {
  teams: TeamData[]
  myMemberId: string
  selectedMemberId: string | null
  hasFinancialDetails: boolean
  onSelectManager: (memberId: string) => void
}

export function ManagerGrid({ teams, myMemberId, selectedMemberId, hasFinancialDetails, onSelectManager }: ManagerGridProps) {
  const [collapsed, setCollapsed] = useState(false)

  // Filter out my team, sort by balance descending
  const otherTeams = teams
    .filter(t => t.memberId !== myMemberId)
    .sort((a, b) => getTeamBalance(b, hasFinancialDetails) - getTeamBalance(a, hasFinancialDetails))

  if (otherTeams.length === 0) return null

  return (
    <div className="border border-surface-50/20 rounded-xl overflow-hidden">
      {/* Collapsible header */}
      <button
        onClick={() => { setCollapsed(!collapsed); }}
        className="w-full flex items-center justify-between px-4 py-3 bg-surface-300/50 hover:bg-surface-300/80 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span className="text-base font-bold text-white">Manager della Lega</span>
          <span className="text-sm text-gray-400">({otherTeams.length})</span>
        </div>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${collapsed ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Grid */}
      {!collapsed && (
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {otherTeams.map(team => (
            <ManagerCard
              key={team.memberId}
              team={team}
              isSelected={selectedMemberId === team.memberId}
              hasFinancialDetails={hasFinancialDetails}
              onClick={() => { onSelectManager(team.memberId); }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
