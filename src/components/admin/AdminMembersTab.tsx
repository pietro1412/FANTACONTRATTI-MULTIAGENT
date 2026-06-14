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
      <div className="bg-surface-200 rounded-xl border border-surface-50 overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-50 flex items-center justify-between gap-3">
          <h3 className="micro-label text-gray-300 flex items-center gap-2">
            Membri attivi
            <span className="font-mono text-[10px] font-bold text-gray-400 bg-surface-300 border border-surface-50 px-1.5 py-0.5 rounded-full">
              {activeMembers.length}
            </span>
          </h3>
          {activeMembers.length < 8 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCompleteWithTestUsers}
              disabled={isSubmitting}
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
                <th className="px-5 py-3 text-left micro-label text-gray-400">Manager</th>
                <th className="px-5 py-3 text-left micro-label text-gray-400">Team</th>
                <th className="px-5 py-3 text-center micro-label text-gray-400">Ruolo</th>
                <th className="px-5 py-3 text-right micro-label text-gray-400">Budget</th>
                <th className="px-5 py-3 text-right micro-label text-gray-400">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-50/10">
              {activeMembers.map(member => (
                <tr key={member.id} className="hover:bg-surface-300/50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-surface-300 border border-surface-50 flex items-center justify-center font-display text-[11px] font-bold text-white flex-shrink-0">
                        {member.user.username.slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="font-display font-bold text-white truncate">{member.user.username}</p>
                        <p className="text-xs text-gray-500 truncate">{member.user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-400">{member.teamName || '-'}</td>
                  <td className="px-5 py-3 text-center">
                    <span className={`font-mono text-[10px] font-bold tracking-[0.06em] px-2.5 py-1 rounded-md border ${
                      member.role === 'ADMIN'
                        ? 'bg-accent-500/[0.13] text-accent-400 border-accent-500/40'
                        : 'bg-surface-300 text-gray-400 border-surface-50'
                    }`}>
                      {member.role === 'ADMIN' ? 'Presidente' : 'DG'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right budget-display text-accent-400 text-lg">{member.currentBudget}</td>
                  <td className="px-5 py-3 text-right">
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
