import { Button } from '../ui/Button'
import type { Member } from './types'

export interface AdminMembersTabProps {
  activeMembers: Member[]
  isSubmitting: boolean
  confirmKick: (memberId: string, username: string) => void
  handleCompleteWithTestUsers: () => void
}

export function AdminMembersTab({
  activeMembers,
  isSubmitting,
  confirmKick,
  handleCompleteWithTestUsers,
}: AdminMembersTabProps) {
  return (
    <div className="space-y-6">
      {/* Active Members */}
      <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
        <div className="p-5 border-b border-surface-50/20 flex items-center justify-between">
          <h3 className="text-xl font-bold text-white">Membri Attivi ({activeMembers.length})</h3>
          {activeMembers.length < 8 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCompleteWithTestUsers}
              disabled={isSubmitting}
              className="border-purple-500/50 text-purple-400"
            >
              {isSubmitting ? 'Aggiungendo...' : `Completa a 8 manager (+${8 - activeMembers.length} test)`}
            </Button>
          )}
        </div>
        {/* Mobile: card list */}
        <div className="md:hidden divide-y divide-surface-50/10">
          {activeMembers.map(member => (
            <div key={member.id} className="px-4 py-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    member.role === 'ADMIN'
                      ? 'bg-accent-500/20 text-accent-400 border border-accent-500/40'
                      : 'bg-surface-50/20 text-gray-400 border border-surface-50/30'
                  }`}>
                    {member.role === 'ADMIN' ? 'Pres.' : 'DG'}
                  </span>
                  <span className="font-semibold text-white truncate">{member.user.username}</span>
                </div>
                <span className="font-mono text-accent-400 font-bold">{member.currentBudget}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{member.teamName || '-'}</span>
                {member.role !== 'ADMIN' && (
                  <Button size="sm" variant="outline" className="border-danger-500/50 text-danger-400 !px-2 !py-1 !text-xs !min-h-[36px]" onClick={() => { confirmKick(member.id, member.user.username); }} disabled={isSubmitting}>
                    Espelli
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
        {/* Desktop: table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-surface-300">
              <tr>
                <th className="px-5 py-4 text-left text-sm text-gray-400 font-semibold">Username</th>
                <th className="px-5 py-4 text-left text-sm text-gray-400 font-semibold">Team</th>
                <th className="px-5 py-4 text-center text-sm text-gray-400 font-semibold">Ruolo</th>
                <th className="px-5 py-4 text-right text-sm text-gray-400 font-semibold">Budget</th>
                <th className="px-5 py-4 text-right text-sm text-gray-400 font-semibold">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-50/10">
              {activeMembers.map(member => (
                <tr key={member.id} className="hover:bg-surface-300/50 transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-semibold text-white">{member.user.username}</p>
                    <p className="text-xs text-gray-500">{member.user.email}</p>
                  </td>
                  <td className="px-5 py-4 text-gray-300">{member.teamName || '-'}</td>
                  <td className="px-5 py-4 text-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      member.role === 'ADMIN'
                        ? 'bg-accent-500/20 text-accent-400 border border-accent-500/40'
                        : 'bg-surface-50/20 text-gray-400 border border-surface-50/30'
                    }`}>
                      {member.role === 'ADMIN' ? 'Presidente' : 'DG'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right font-mono text-accent-400 text-lg">{member.currentBudget}</td>
                  <td className="px-5 py-4 text-right">
                    {member.role !== 'ADMIN' && (
                      <Button size="sm" variant="outline" className="border-danger-500/50 text-danger-400" onClick={() => { confirmKick(member.id, member.user.username); }} disabled={isSubmitting}>
                        Espelli
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
