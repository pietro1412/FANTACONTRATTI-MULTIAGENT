import { Monogram } from '../ui/Monogram'
import type { User } from './types'

export interface UsersTabProps {
  usersLoading: boolean
  users: User[]
}

export function UsersTab({ usersLoading, users }: UsersTabProps) {
  return (
    <div className="bg-surface-200 border border-surface-50 rounded-xl overflow-hidden">
      {usersLoading ? (
        <div className="p-8 text-center">
          <div className="w-10 h-10 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto"></div>
        </div>
      ) : users.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-surface-300">
              <tr>
                <th className="px-4 py-3 text-left micro-label text-gray-400">Username</th>
                <th className="px-4 py-3 text-left micro-label text-gray-400">Email</th>
                <th className="px-4 py-3 text-center micro-label text-gray-400">Leghe</th>
                <th className="px-4 py-3 text-center micro-label text-gray-400">Stato</th>
                <th className="px-4 py-3 text-center micro-label text-gray-400">Ruolo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-50/10">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-surface-300/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Monogram name={user.username} size="md" />
                      <span className="font-display font-bold text-white">{user.username}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{user.email}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-mono text-primary-400">{user._count.leagueMemberships}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`font-mono text-[10px] font-bold tracking-[0.05em] px-2.5 py-1 rounded-md border ${
                      user.emailVerified
                        ? 'bg-secondary-500/[0.13] text-secondary-400 border-secondary-500/40'
                        : 'bg-warning-500/[0.13] text-warning-400 border-warning-500/40'
                    }`}>
                      {user.emailVerified ? 'Verificato' : 'Non verificato'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {user.isSuperAdmin && (
                      <span className="font-mono text-[10px] font-bold tracking-[0.05em] px-2.5 py-1 rounded-md border bg-accent-500/[0.13] text-accent-400 border-accent-500/40">
                        SuperAdmin
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-8 text-center text-gray-400">
          <p>Nessun utente trovato</p>
        </div>
      )}
    </div>
  )
}
