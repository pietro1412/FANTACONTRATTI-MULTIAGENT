import { useState } from 'react'
import type { LeagueTotals } from '../finance/types'

interface Member {
  id: string
  role: string
  status: string
  currentBudget: number
  teamName?: string
  user: { id: string; username: string; profilePhoto?: string }
  balance?: number
}

interface ManagersSidebarProps {
  members: Member[]
  maxParticipants: number
  leagueId: string
  leagueStatus: string
  isAdmin: boolean
  isLeaving: boolean
  totals: LeagueTotals | null
  onLeaveLeague: () => void
}

function getGiniLabel(gini: number): { label: string; color: string } {
  if (gini < 0.2) return { label: 'OTTIMA', color: 'text-green-400' }
  if (gini < 0.35) return { label: 'BUONA', color: 'text-emerald-400' }
  if (gini < 0.5) return { label: 'DISCRETA', color: 'text-amber-400' }
  return { label: 'SBILANCIATA', color: 'text-danger-400' }
}

export function ManagersSidebar({
  members,
  maxParticipants,
  leagueId,
  leagueStatus,
  isAdmin,
  isLeaving,
  totals,
  onLeaveLeague,
}: ManagersSidebarProps) {
  const [copied, setCopied] = useState(false)
  const activeMembers = members.filter(m => m.status === 'ACTIVE')
  const missing = maxParticipants - activeMembers.length
  const inviteCode = leagueId.slice(0, 8)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(inviteCode)
    setCopied(true)
    setTimeout(() => { setCopied(false); }, 2000)
  }

  const giniInfo = totals ? getGiniLabel(totals.giniIndex) : null

  return (
    <div className="space-y-6">
      {/* Manager List */}
      <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
        <div className="p-4 border-b border-surface-50/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{'\uD83D\uDC54'}</span>
            <h3 className="text-base font-bold text-white">Manager Lega</h3>
          </div>
          <span className="bg-surface-300 px-2.5 py-0.5 rounded-full text-xs text-gray-400 font-medium">
            {activeMembers.length}/{maxParticipants}
          </span>
        </div>

        <div className="divide-y divide-surface-50/10">
          {activeMembers.map((member) => (
            <div key={member.id} className="flex items-center justify-between px-4 py-3 hover:bg-surface-300/30 transition-colors">
              <div className="flex items-center gap-2.5 min-w-0">
                {member.user.profilePhoto ? (
                  <img
                    src={member.user.profilePhoto}
                    alt={member.user.username}
                    className="w-9 h-9 rounded-full object-cover border-2 border-surface-50/30 flex-shrink-0"
                    width={36}
                    height={36}
                  />
                ) : (
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${
                    member.role === 'ADMIN' ? 'bg-gradient-to-br from-accent-500 to-accent-700' : 'bg-gradient-to-br from-primary-500 to-primary-700'
                  }`}>
                    {member.user.username[0]?.toUpperCase() || '?'}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-white text-sm truncate">
                      {member.teamName || member.user.username}
                    </span>
                    {member.role === 'ADMIN' && (
                      <span className="text-[10px] bg-accent-500/20 text-accent-400 px-1.5 py-0.5 rounded-full border border-accent-500/40 font-medium flex-shrink-0">
                        Pres.
                      </span>
                    )}
                  </div>
                  {member.teamName && (
                    <p className="text-[10px] text-gray-500">{member.user.username}</p>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <span className={`text-sm font-bold ${(member.balance ?? member.currentBudget) >= 0 ? 'text-green-400' : 'text-danger-400'}`}>
                  {(member.balance ?? member.currentBudget) >= 0 ? '+' : ''}{member.balance ?? member.currentBudget}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Missing managers + invite code */}
        {missing > 0 && (
          <div className="px-4 py-3 border-t border-surface-50/20 bg-surface-300/30">
            <p className="text-xs text-gray-500 mb-2">Mancano {missing} Manager</p>
            <div className="flex items-center gap-2">
              <code className="font-mono text-primary-400 bg-surface-300 px-3 py-1.5 rounded text-sm flex-1 text-center">
                {inviteCode}
              </code>
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 bg-primary-500/20 text-primary-400 text-xs rounded hover:bg-primary-500/30 transition-colors font-medium"
              >
                {copied ? 'Copiato!' : 'Copia'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Financial Health Stats */}
      {totals && (
        <div className="bg-surface-200 rounded-xl border border-surface-50/20 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">{'\uD83D\uDCC8'}</span>
            <h3 className="text-sm font-bold text-white">Stats Lega</h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400">Salute Finanziaria</span>
              {giniInfo && (
                <span className={`font-bold text-xs ${giniInfo.color}`}>{giniInfo.label}</span>
              )}
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400">Giocatori a Roster</span>
              <span className="text-white font-medium">{totals.totalSlots}/{totals.maxTotalSlots}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400">Team OK / Attenzione / Critico</span>
              <span className="text-sm">
                <span className="text-green-400 font-medium">{totals.healthyTeams}</span>
                <span className="text-gray-400 mx-0.5">/</span>
                <span className="text-amber-400 font-medium">{totals.warningTeams}</span>
                <span className="text-gray-400 mx-0.5">/</span>
                <span className="text-danger-400 font-medium">{totals.criticalTeams}</span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Leave League Button */}
      {!isAdmin && leagueStatus === 'DRAFT' && (
        <div className="bg-surface-200 rounded-xl border border-surface-50/20 p-4">
          <button
            onClick={onLeaveLeague}
            disabled={isLeaving}
            className="w-full py-2.5 border-2 border-danger-500/50 text-danger-400 rounded-lg hover:bg-danger-500/10 transition-colors font-medium text-sm disabled:opacity-50"
          >
            {isLeaving ? 'Abbandono...' : 'Abbandona Lega'}
          </button>
          <p className="text-[10px] text-gray-500 mt-1.5 text-center">
            Puoi abbandonare solo prima che la lega sia avviata
          </p>
        </div>
      )}
    </div>
  )
}
