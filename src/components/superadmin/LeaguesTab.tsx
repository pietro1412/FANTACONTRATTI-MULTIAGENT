import { useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Trash2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { LeagueCrest } from '../ui/LeagueCrest'
import { STATUS_LABELS, type League } from './types'

const CONFIRM_WORD = 'ELIMINA'

export interface LeaguesTabProps {
  leagueSearch: string
  leagueSearchInput: string
  setLeagueSearchInput: (value: string) => void
  onSearch: () => void
  onResetSearch: () => void
  leaguesLoading: boolean
  leagues: League[]
  expandedLeague: string | null
  setExpandedLeague: (id: string | null) => void
  onViewRoster: (memberId: string) => void
  /** Conferma eliminazione lega. Risolve a true se l'eliminazione e riuscita. */
  onDeleteLeague: (leagueId: string) => Promise<boolean>
}

export function LeaguesTab({
  leagueSearch,
  leagueSearchInput,
  setLeagueSearchInput,
  onSearch,
  onResetSearch,
  leaguesLoading,
  leagues,
  expandedLeague,
  setExpandedLeague,
  onViewRoster,
  onDeleteLeague,
}: LeaguesTabProps) {
  const [leagueToDelete, setLeagueToDelete] = useState<League | null>(null)
  const [confirmInput, setConfirmInput] = useState('')
  const [deleting, setDeleting] = useState(false)

  function openDeleteDialog(league: League) {
    setLeagueToDelete(league)
    setConfirmInput('')
  }

  function closeDeleteDialog() {
    if (deleting) return
    setLeagueToDelete(null)
    setConfirmInput('')
  }

  async function handleConfirmDelete() {
    if (!leagueToDelete || confirmInput.trim().toUpperCase() !== CONFIRM_WORD) return
    setDeleting(true)
    const ok = await onDeleteLeague(leagueToDelete.id)
    setDeleting(false)
    if (ok) {
      setLeagueToDelete(null)
      setConfirmInput('')
    }
  }

  const canConfirm = confirmInput.trim().toUpperCase() === CONFIRM_WORD

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="bg-surface-200 border border-surface-50 rounded-xl p-4">
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block micro-label text-gray-400 mb-1">Cerca lega o utente</label>
            <Input
              value={leagueSearchInput}
              onChange={(e) => { setLeagueSearchInput(e.target.value); }}
              placeholder="Nome lega o username..."
              onKeyDown={(e) => { if (e.key === 'Enter') onSearch(); }}
            />
          </div>
          <Button onClick={onSearch} variant="primary">
            Cerca
          </Button>
          {leagueSearch && (
            <Button variant="outline" onClick={onResetSearch}>
              Reset
            </Button>
          )}
        </div>
        {leagueSearch && (
          <p className="text-sm text-gray-400 mt-2">
            Risultati per: <span className="text-primary-400">"{leagueSearch}"</span>
          </p>
        )}
      </div>

      <div className="bg-surface-200 border border-surface-50 rounded-xl overflow-hidden">
        {leaguesLoading ? (
          <div className="p-8 text-center">
            <div className="w-10 h-10 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto"></div>
          </div>
        ) : leagues.length > 0 ? (
          <div className="divide-y divide-surface-50/10">
            {leagues.map((league) => (
              <div key={league.id}>
                <div className="w-full px-4 sm:px-6 py-4 flex items-center justify-between gap-3 hover:bg-surface-300/50 transition-colors">
                  <button
                    onClick={() => { setExpandedLeague(expandedLeague === league.id ? null : league.id); }}
                    className="flex items-center gap-4 min-w-0 flex-1 text-left"
                  >
                    <LeagueCrest name={league.name} size="md" />
                    <div className="min-w-0">
                      <h3 className="font-display font-bold text-white truncate">{league.name}</h3>
                      <p className="text-sm text-gray-400">
                        {league._count.members} membri · {STATUS_LABELS[league.status] || league.status}
                      </p>
                    </div>
                  </button>
                  <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Budget iniziale</p>
                      <p className="stat-number text-accent-400 text-lg">{league.initialBudget}</p>
                    </div>
                    <button
                      onClick={() => { openDeleteDialog(league); }}
                      className="p-2 rounded-lg text-gray-400 hover:text-danger-400 hover:bg-danger-500/10 transition-colors"
                      aria-label={`Elimina lega ${league.name}`}
                      title="Elimina lega"
                    >
                      <Trash2 size={18} aria-hidden="true" />
                    </button>
                    <button
                      onClick={() => { setExpandedLeague(expandedLeague === league.id ? null : league.id); }}
                      className={`text-gray-400 transition-transform ${expandedLeague === league.id ? 'rotate-180' : ''}`}
                      aria-label="Espandi membri"
                    >
                      ▼
                    </button>
                  </div>
                </div>

                {expandedLeague === league.id && (
                  <div className="px-4 sm:px-6 pb-4 bg-surface-300/30">
                    <h4 className="micro-label text-gray-400 mb-3">Membri della Lega</h4>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {league.members.map((member) => (
                        <div key={member.id} className="bg-surface-200 border border-surface-50 rounded-xl p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="min-w-0">
                              <p className="font-display font-bold text-white truncate">{member.user.username}</p>
                              <p className="text-xs text-gray-400 truncate">{member.user.email}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <span className={`font-mono text-[10px] font-bold tracking-[0.06em] px-2.5 py-1 rounded-md border ${
                                member.role === 'ADMIN'
                                  ? 'bg-accent-500/[0.13] text-accent-400 border-accent-500/40'
                                  : 'bg-surface-300 text-gray-400 border-surface-50'
                              }`}>
                                {member.role === 'ADMIN' ? 'Presidente' : 'DG'}
                              </span>
                              <p className="stat-number text-accent-400 text-base mt-1">{member.currentBudget}</p>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={(e) => {
                              e.stopPropagation()
                              onViewRoster(member.id)
                            }}
                          >
                            Vedi Rosa
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-400">
            <p>Nessuna lega trovata</p>
            {leagueSearch && <p className="text-sm mt-1">Prova a cercare con altri termini</p>}
          </div>
        )}
      </div>

      {/* Dialog eliminazione lega (azione distruttiva: typed-confirm "ELIMINA") */}
      {leagueToDelete &&
        createPortal(
          <div
            className="fixed inset-0 z-[110] flex items-center justify-center p-4"
            onClick={closeDeleteDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-league-title"
          >
            <div className="absolute inset-0 bg-dark-900/80 backdrop-blur-sm" aria-hidden="true" />
            <div
              className="relative bg-surface-200 border border-surface-50/20 rounded-2xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] max-w-md w-full p-6 animate-modal-in"
              onClick={(e) => { e.stopPropagation(); }}
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-danger-500/[0.13] border border-danger-500/40 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="text-danger-400" size={22} aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <h2 id="delete-league-title" className="font-display text-lg font-bold text-white">
                    Eliminare la lega?
                  </h2>
                  <p className="text-sm text-gray-400 mt-1 leading-relaxed">
                    Stai per eliminare <span className="text-white font-semibold">{leagueToDelete.name}</span> con i suoi{' '}
                    <span className="text-white font-semibold">{leagueToDelete._count.members} membri</span>, rose, contratti e sessioni di mercato.{' '}
                    <span className="text-danger-400">Questa azione non può essere annullata.</span>
                  </p>
                </div>
              </div>

              <label className="block micro-label text-gray-400 mb-1">
                Digita <span className="text-white">{CONFIRM_WORD}</span> per confermare
              </label>
              <Input
                value={confirmInput}
                onChange={(e) => { setConfirmInput(e.target.value); }}
                placeholder={CONFIRM_WORD}
                autoFocus
                disabled={deleting}
                onKeyDown={(e) => { if (e.key === 'Enter' && canConfirm) void handleConfirmDelete(); }}
              />

              <div className="flex gap-3 mt-6">
                <Button variant="ghost" size="sm" fullWidth onClick={closeDeleteDialog} disabled={deleting}>
                  Annulla
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  fullWidth
                  disabled={!canConfirm || deleting}
                  isLoading={deleting}
                  loadingText="Eliminazione..."
                  onClick={() => void handleConfirmDelete()}
                >
                  Elimina lega
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
