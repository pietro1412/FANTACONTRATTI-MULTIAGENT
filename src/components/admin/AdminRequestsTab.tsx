import { useState, useEffect } from 'react'
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
  const [expiryDateLabel, setExpiryDateLabel] = useState('')
  useEffect(() => {
    setExpiryDateLabel(
      new Date(Date.now() + inviteDuration * 24 * 60 * 60 * 1000).toLocaleDateString('it-IT', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    )
  }, [inviteDuration])

  return (
    <div className="space-y-6">
      {/* Pending Members */}
      <div className="bg-surface-200 rounded-xl border border-surface-50 overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-50">
          <h3 className="micro-label text-gray-300 flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Richieste di adesione
            {pendingMembers.length > 0 && (
              <span className="font-mono text-[10px] font-bold text-accent-400 bg-accent-500/20 border border-accent-500/40 px-1.5 py-0.5 rounded-full">
                {pendingMembers.length}
              </span>
            )}
          </h3>
        </div>
        <div className="p-4">
          {pendingMembers.length === 0 ? (
            <p className="text-center text-sm text-gray-500 py-6">Nessuna richiesta in attesa</p>
          ) : (
            <div className="space-y-2">
              {pendingMembers.map(member => (
                <div key={member.id} className="flex justify-between items-center gap-3 p-3 bg-surface-300 border border-surface-50 rounded-xl">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-8 h-8 rounded-full bg-surface-200 border border-surface-50 flex items-center justify-center font-display text-[11px] font-bold text-white flex-shrink-0">
                      {member.user.username.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="font-display font-bold text-white truncate">{member.user.username}</p>
                      <p className="text-xs text-gray-500 truncate">{member.user.email}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button size="sm" variant="secondary" onClick={() => { handleMemberAction(member.id, 'accept'); }} disabled={isSubmitting}>
                      Accetta
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { handleMemberAction(member.id, 'reject'); }} disabled={isSubmitting}>
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
      <div className="bg-surface-200 rounded-xl border border-surface-50 overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-50">
          <h3 className="micro-label text-gray-300 flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Invia nuovo invito
          </h3>
        </div>
        <div className="p-4">
          <div className="flex flex-col gap-5">
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Email o username del nuovo partecipante
              </label>
              <Input
                type="text"
                value={newInviteEmail}
                onChange={(e) => { setNewInviteEmail(e.target.value); }}
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
                      {expiryDateLabel}
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
      <div className="bg-surface-200 rounded-xl border border-surface-50 overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-50">
          <h3 className="micro-label text-gray-300 flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Inviti in attesa
            {invites.length > 0 && (
              <span className="font-mono text-[10px] font-bold text-gray-400 bg-surface-300 border border-surface-50 px-1.5 py-0.5 rounded-full">
                {invites.length}
              </span>
            )}
          </h3>
        </div>
        <div className="p-4">
          {invites.length === 0 ? (
            <p className="text-center text-sm text-gray-500 py-6">Nessun invito in attesa</p>
          ) : (
            <div className="space-y-2">
              {invites.map(invite => (
                <div key={invite.id} className="flex justify-between items-center gap-3 p-3 bg-surface-300 border border-surface-50 rounded-xl">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-8 h-8 rounded-full bg-surface-200 border border-surface-50 flex items-center justify-center text-gray-400 flex-shrink-0">@</span>
                    <div className="min-w-0">
                      <p className="font-display font-bold text-white truncate">{invite.email}</p>
                      <p className="text-xs text-gray-500">
                        Inviato {new Date(invite.createdAt).toLocaleDateString('it-IT')} · Scade {new Date(invite.expiresAt).toLocaleDateString('it-IT')}
                      </p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => { handleCancelInvite(invite.id); }} disabled={isSubmitting}>
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
