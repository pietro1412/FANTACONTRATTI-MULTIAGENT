import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { NumberStepper } from '../ui/NumberStepper'
import type { Member, Invite } from './types'

export interface AdminRequestsTabProps {
  pendingMembers: Member[]
  invites: Invite[]
  newInviteEmail: string
  setNewInviteEmail: (email: string) => void
  inviteDuration: number
  setInviteDuration: (duration: number) => void
  isSubmitting: boolean
  handleMemberAction: (memberId: string, action: 'accept' | 'reject') => void
  handleCreateInvite: () => void
  handleCancelInvite: (inviteId: string) => void
}

export function AdminRequestsTab({
  pendingMembers,
  invites,
  newInviteEmail,
  setNewInviteEmail,
  inviteDuration,
  setInviteDuration,
  isSubmitting,
  handleMemberAction,
  handleCreateInvite,
  handleCancelInvite,
}: AdminRequestsTabProps) {
  return (
    <div className="space-y-6">
      {/* Pending Members */}
      <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
        <div className="p-5 border-b border-surface-50/20">
          <h3 className="text-xl font-bold text-white flex items-center gap-3">
            <span>👤</span> Richieste di Adesione
            {pendingMembers.length > 0 && (
              <span className="bg-accent-500/20 text-accent-400 px-2.5 py-0.5 rounded-full text-sm font-bold border border-accent-500/40">
                {pendingMembers.length}
              </span>
            )}
          </h3>
        </div>
        <div className="p-5">
          {pendingMembers.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-3 opacity-50">✅</div>
              <p className="text-gray-500">Nessuna richiesta in attesa</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingMembers.map(member => (
                <div key={member.id} className="flex justify-between items-center p-4 bg-surface-300 rounded-lg">
                  <div>
                    <p className="font-semibold text-white text-lg">{member.user.username}</p>
                    <p className="text-sm text-gray-400">{member.user.email}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => handleMemberAction(member.id, 'accept')} disabled={isSubmitting}>
                      Accetta
                    </Button>
                    <Button variant="outline" onClick={() => handleMemberAction(member.id, 'reject')} disabled={isSubmitting}>
                      Rifiuta
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Invite Form */}
      <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
        <div className="p-5 border-b border-surface-50/20">
          <h3 className="text-xl font-bold text-white flex items-center gap-3">
            <span>✉️</span> Invia Nuovo Invito
          </h3>
        </div>
        <div className="p-5">
          <div className="flex flex-col gap-5">
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Email o username del nuovo partecipante
              </label>
              <Input
                type="text"
                value={newInviteEmail}
                onChange={(e) => setNewInviteEmail(e.target.value)}
                placeholder="Email o username..."
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Validità dell'invito (giorni)
              </label>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <NumberStepper
                  value={inviteDuration}
                  onChange={setInviteDuration}
                  min={1}
                  max={30}
                  size="sm"
                />
                <div className="flex items-center gap-2 text-sm">
                  <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-gray-400">
                    Scade il{' '}
                    <span className="text-white font-medium">
                      {new Date(Date.now() + inviteDuration * 24 * 60 * 60 * 1000).toLocaleDateString('it-IT', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleCreateInvite} disabled={!newInviteEmail.trim() || isSubmitting}>
                {isSubmitting ? 'Invio...' : 'Invia Invito'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Pending Invites */}
      <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
        <div className="p-5 border-b border-surface-50/20">
          <h3 className="text-xl font-bold text-white flex items-center gap-3">
            <span>📨</span> Inviti in Attesa
            {invites.length > 0 && (
              <span className="bg-surface-300 px-2.5 py-0.5 rounded-full text-sm text-gray-400">
                {invites.length}
              </span>
            )}
          </h3>
        </div>
        <div className="p-5">
          {invites.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-3 opacity-50">📭</div>
              <p className="text-gray-500">Nessun invito in attesa</p>
            </div>
          ) : (
            <div className="space-y-3">
              {invites.map(invite => (
                <div key={invite.id} className="flex justify-between items-center p-4 bg-surface-300 rounded-lg">
                  <div>
                    <p className="font-semibold text-white">{invite.email}</p>
                    <p className="text-xs text-gray-500">
                      Inviato: {new Date(invite.createdAt).toLocaleDateString('it-IT')} - Scade: {new Date(invite.expiresAt).toLocaleDateString('it-IT')}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => handleCancelInvite(invite.id)} disabled={isSubmitting}>
                    Annulla
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
