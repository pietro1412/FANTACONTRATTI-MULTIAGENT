import { useState } from 'react'
import { Monogram } from '@/components/ui/Monogram'
import { EmptyState } from '@/components/ui/EmptyState'
import { RoleTag } from '@/components/league/attention'
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
  inviteCode?: string
  onLeaveLeague: () => void
}

function getGiniLabel(gini: number): { label: string; color: string } {
  if (gini < 0.2) return { label: 'OTTIMA', color: 'text-secondary-400' }
  if (gini < 0.35) return { label: 'BUONA', color: 'text-secondary-400' }
  if (gini < 0.5) return { label: 'DISCRETA', color: 'text-warning-400' }
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
  inviteCode,
  onLeaveLeague,
}: ManagersSidebarProps) {
  const [copied, setCopied] = useState(false)
  const activeMembers = members.filter(m => m.status === 'ACTIVE')
  const missing = maxParticipants - activeMembers.length
  const code = inviteCode ?? leagueId.slice(0, 8)

  // Classifica per bilancio (desc); fallback al budget se balance non disponibile.
  const ranked = [...activeMembers].sort((a, b) => (b.balance ?? b.currentBudget) - (a.balance ?? a.currentBudget))

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => { setCopied(false); }, 2000)
  }

  const giniInfo = totals ? getGiniLabel(totals.giniIndex) : null

  return (
    <div className="space-y-6">
      {/* Classifica bilanci */}
      <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
        <div className="p-4 border-b border-surface-50/20 flex items-center justify-between">
          <span className="micro-label text-gray-400">Classifica bilanci</span>
          <span className="bg-surface-300 px-2.5 py-0.5 rounded-full text-xs text-gray-400 font-medium">
            {activeMembers.length}/{maxParticipants}
          </span>
        </div>

        {ranked.length === 0 ? (
          <EmptyState compact icon="👥" title="Nessun manager attivo" />
        ) : (
          <div className="divide-y divide-surface-50/10">
            {ranked.map((member, idx) => {
              const balance = member.balance ?? member.currentBudget
              const name = member.teamName || member.user.username
              return (
                <div key={member.id} className="flex items-center gap-2.5 px-4 py-3 hover:bg-surface-300/30 transition-colors">
                  <span className="stat-number w-4 text-sm text-gray-500 text-center flex-shrink-0">{idx + 1}</span>
                  <Monogram name={name} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-display text-sm font-bold text-white truncate">{name}</span>
                      {member.role === 'ADMIN' && <RoleTag role="ADMIN" />}
                    </div>
                    {member.teamName && <p className="text-[10px] text-gray-500 truncate">{member.user.username}</p>}
                  </div>
                  <span className={`stat-number text-sm font-bold text-right flex-shrink-0 ${balance >= 0 ? 'text-secondary-400' : 'text-danger-400'}`}>
                    {balance >= 0 ? '+' : ''}{balance}M
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* Mancano manager + codice invito */}
        {missing > 0 && (
          <div className="px-4 py-3 border-t border-surface-50/20 bg-surface-300/30">
            <p className="text-xs text-gray-500 mb-2">Mancano {missing} manager</p>
            <div className="flex items-center gap-2">
              <code className="font-mono text-primary-400 bg-surface-300 px-3 py-1.5 rounded text-sm flex-1 text-center">
                {code}
              </code>
              <button
                onClick={() => void handleCopy()}
                className="px-3 py-1.5 bg-primary-500/20 text-primary-400 text-xs rounded hover:bg-primary-500/30 transition-colors font-medium"
              >
                {copied ? 'Copiato!' : 'Copia'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Stats Lega */}
      {totals && (
        <div className="bg-surface-200 rounded-xl border border-surface-50/20 p-4 space-y-3">
          <span className="micro-label text-gray-400">Stats Lega</span>
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400">Salute finanziaria</span>
              {giniInfo && <span className={`font-bold text-xs ${giniInfo.color}`}>{giniInfo.label}</span>}
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400">Giocatori a roster</span>
              <span className="text-white font-medium">{totals.totalSlots}/{totals.maxTotalSlots}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400">Team OK / Attenzione / Critico</span>
              <span className="text-sm">
                <span className="text-secondary-400 font-medium">{totals.healthyTeams}</span>
                <span className="text-gray-400 mx-0.5">/</span>
                <span className="text-warning-400 font-medium">{totals.warningTeams}</span>
                <span className="text-gray-400 mx-0.5">/</span>
                <span className="text-danger-400 font-medium">{totals.criticalTeams}</span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Abbandona lega (solo membri, solo prima dell'avvio) */}
      {!isAdmin && leagueStatus === 'DRAFT' && (
        <div className="bg-surface-200 rounded-xl border border-surface-50/20 p-4">
          <button
            onClick={onLeaveLeague}
            disabled={isLeaving}
            className="w-full py-2.5 border-2 border-danger-500/50 text-danger-400 rounded-lg hover:bg-danger-500/10 transition-colors font-medium text-sm disabled:opacity-50"
          >
            {isLeaving ? 'Abbandono...' : 'Abbandona lega'}
          </button>
          <p className="text-[10px] text-gray-500 mt-1.5 text-center">
            Puoi abbandonare solo prima che la lega sia avviata
          </p>
        </div>
      )}
    </div>
  )
}
