import { useState, useEffect, useRef } from 'react'
import { leagueApi } from '../services/api'
import { Button } from './ui/Button'
import { JoinLeagueModal } from './JoinLeagueModal'

interface SearchResult {
  id: string
  name: string
  description: string | null
  inviteCode: string
  status: string
  maxParticipants: number
  currentParticipants: number
  adminUsername: string
  createdAt: string
}

interface SearchLeaguesModalProps {
  isOpen: boolean
  onClose: () => void
  onNavigate: (page: string, params?: Record<string, string>) => void
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'In preparazione', color: 'bg-amber-500/20 text-amber-400' },
  ACTIVE: { label: 'Attiva', color: 'bg-secondary-500/20 text-secondary-400' },
  COMPLETED: { label: 'Completata', color: 'bg-gray-500/20 text-gray-400' },
}

export function SearchLeaguesModal({ isOpen, onClose, onNavigate }: SearchLeaguesModalProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedLeague, setSelectedLeague] = useState<SearchResult | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setQuery('')
      setResults([])
      setHasSearched(false)
      setError(null)
      setSelectedLeague(null)
    }
  }, [isOpen])

  async function handleSearch(e?: React.FormEvent) {
    e?.preventDefault()

    if (query.trim().length < 2) {
      setError('Inserisci almeno 2 caratteri')
      return
    }

    setIsSearching(true)
    setError(null)

    const res = await leagueApi.search(query.trim())

    if (res.success && res.data) {
      setResults(res.data)
    } else {
      setError(res.message || 'Errore nella ricerca')
      setResults([])
    }

    setHasSearched(true)
    setIsSearching(false)
  }

  function handleSelectLeague(league: SearchResult) {
    setSelectedLeague(league)
  }

  function handleJoinSuccess() {
    setSelectedLeague(null)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-surface-200 rounded-2xl border border-surface-50/20 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-surface-300/80 to-surface-300/40 border-b border-surface-50/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Cerca Leghe</h2>
              <p className="text-xs text-gray-400">Trova leghe esistenti a cui unirti</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-surface-300/50 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search Form */}
        <div className="px-6 py-4 border-b border-surface-50/20">
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nome lega, codice invito, admin o membro..."
                className="w-full pl-10 pr-4 py-2.5 bg-surface-300 border border-surface-50/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary-500/50 focus:ring-2 focus:ring-primary-500/20 transition-all"
              />
            </div>
            <Button
              type="submit"
              disabled={isSearching || query.trim().length < 2}
            >
              {isSearching ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Cerca'
              )}
            </Button>
          </form>
          {error && (
            <p className="mt-2 text-sm text-danger-400">{error}</p>
          )}
          <p className="mt-2 text-xs text-gray-500">
            Cerca per nome lega, codice invito, nome utente o email di un membro
          </p>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto">
          {!hasSearched ? (
            <div className="py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-surface-300 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <p className="text-gray-400">Inserisci un termine di ricerca</p>
            </div>
          ) : isSearching ? (
            <div className="py-12 text-center">
              <div className="w-12 h-12 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto" />
              <p className="mt-4 text-gray-400">Ricerca in corso...</p>
            </div>
          ) : results.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-surface-300 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-gray-400">Nessuna lega trovata</p>
              <p className="text-sm text-gray-500 mt-1">Prova con un altro termine di ricerca</p>
            </div>
          ) : (
            <div className="divide-y divide-surface-50/10">
              {results.map((league) => {
                const status = STATUS_LABELS[league.status] || { label: league.status, color: 'bg-gray-500/20 text-gray-400' }
                const isFull = league.currentParticipants >= league.maxParticipants
                const canJoin = league.status === 'DRAFT' && !isFull

                return (
                  <div
                    key={league.id}
                    className="px-6 py-4 hover:bg-surface-300/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-base font-semibold text-white truncate">
                            {league.name}
                          </h3>
                          <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${status.color}`}>
                            {status.label}
                          </span>
                        </div>
                        {league.description && (
                          <p className="text-sm text-gray-400 line-clamp-1 mb-2">
                            {league.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            Admin: <span className="text-primary-400">{league.adminUsername}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            <span className={isFull ? 'text-danger-400' : ''}>
                              {league.currentParticipants}/{league.maxParticipants}
                            </span>
                          </span>
                          <span className="font-mono text-gray-400">
                            #{league.inviteCode}
                          </span>
                        </div>
                      </div>
                      <div>
                        {canJoin ? (
                          <Button
                            size="sm"
                            onClick={() => handleSelectLeague(league)}
                          >
                            Unisciti
                          </Button>
                        ) : (
                          <span className="px-3 py-1.5 text-xs font-medium bg-surface-300 text-gray-400 rounded-lg">
                            {isFull ? 'Completa' : 'Non disponibile'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-surface-300/30 border-t border-surface-50/20 text-center">
          <p className="text-xs text-gray-500">
            Puoi anche unirti a una lega usando il codice invito nella pagina di join
          </p>
        </div>
      </div>

      {/* Join League Modal */}
      <JoinLeagueModal
        isOpen={selectedLeague !== null}
        league={selectedLeague}
        onClose={() => setSelectedLeague(null)}
        onSuccess={handleJoinSuccess}
      />
    </div>
  )
}
