import { useState, useEffect } from 'react'
import { auctionApi } from '../services/api'
import { Button } from '../components/ui/Button'
import { Navigation } from '../components/Navigation'

interface RosterProps {
  leagueId: string
  onNavigate: (page: string, params?: Record<string, string>) => void
}

interface Player {
  id: string
  name: string
  team: string
  position: string
  quotation: number
}

interface RosterEntry {
  id: string
  acquisitionPrice: number
  player: Player
  contract?: {
    salary: number
    duration: number
  }
}

interface RosterData {
  member: {
    id: string
    currentBudget: number
    user: { username: string }
    league: {
      goalkeeperSlots: number
      defenderSlots: number
      midfielderSlots: number
      forwardSlots: number
    }
  }
  roster: {
    P: RosterEntry[]
    D: RosterEntry[]
    C: RosterEntry[]
    A: RosterEntry[]
  }
  totals: {
    P: number
    D: number
    C: number
    A: number
    total: number
  }
  slots: {
    P: number
    D: number
    C: number
    A: number
  }
}

const POSITION_CONFIG = {
  P: { name: 'Portieri', gradient: 'from-amber-500 to-amber-600', text: 'text-amber-400', border: 'border-amber-500/30' },
  D: { name: 'Difensori', gradient: 'from-blue-500 to-blue-600', text: 'text-blue-400', border: 'border-blue-500/30' },
  C: { name: 'Centrocampisti', gradient: 'from-emerald-500 to-emerald-600', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  A: { name: 'Attaccanti', gradient: 'from-red-500 to-red-600', text: 'text-red-400', border: 'border-red-500/30' },
}

export function Roster({ leagueId, onNavigate }: RosterProps) {
  const [rosterData, setRosterData] = useState<RosterData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadRoster()
  }, [leagueId])

  async function loadRoster() {
    const result = await auctionApi.getRoster(leagueId)
    if (result.success && result.data) {
      setRosterData(result.data as RosterData)
    }
    setIsLoading(false)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-300 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg text-gray-400">Caricamento rosa...</p>
        </div>
      </div>
    )
  }

  if (!rosterData) {
    return (
      <div className="min-h-screen bg-dark-300 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">😕</div>
          <p className="text-xl text-danger-400">Errore nel caricamento della rosa</p>
        </div>
      </div>
    )
  }

  const { member, roster, totals, slots } = rosterData
  const totalSlots = slots.P + slots.D + slots.C + slots.A

  return (
    <div className="min-h-screen bg-dark-300">
      <Navigation currentPage="roster" leagueId={leagueId} onNavigate={onNavigate} />

      {/* Page Header */}
      <div className="bg-gradient-to-r from-dark-200 via-surface-200 to-dark-200 border-b border-surface-50/20">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex justify-between items-end">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-glow">
                <span className="text-3xl">📋</span>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">La Mia Rosa</h1>
                <p className="text-gray-400 mt-1">{member.user.username}</p>
              </div>
            </div>
            <div className="text-right bg-surface-200 rounded-xl px-6 py-4 border border-surface-50/20">
              <p className="text-sm text-gray-400 uppercase tracking-wide">Budget Disponibile</p>
              <p className="text-4xl font-bold text-accent-400">{member.currentBudget}</p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Summary Stats */}
        <div className="bg-surface-200 rounded-xl border border-surface-50/20 p-6 mb-8">
          <div className="grid grid-cols-5 gap-4">
            {(['P', 'D', 'C', 'A'] as const).map(pos => {
              const config = POSITION_CONFIG[pos]
              const isFull = totals[pos] >= slots[pos]
              return (
                <div key={pos} className={`text-center p-4 rounded-xl bg-surface-300 border ${config.border}`}>
                  <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${config.gradient} flex items-center justify-center mx-auto mb-3 text-white font-bold text-xl`}>
                    {pos}
                  </div>
                  <div className={`text-2xl font-bold ${isFull ? 'text-secondary-400' : config.text}`}>
                    {totals[pos]}/{slots[pos]}
                  </div>
                  <div className="text-sm text-gray-400">{config.name}</div>
                </div>
              )
            })}
            <div className="text-center p-4 rounded-xl bg-gradient-to-br from-primary-500/20 to-primary-600/20 border border-primary-500/30">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center mx-auto mb-3 text-white">
                <span className="text-xl">⚽</span>
              </div>
              <div className="text-2xl font-bold text-primary-400">
                {totals.total}/{totalSlots}
              </div>
              <div className="text-sm text-gray-400">Totale</div>
            </div>
          </div>
        </div>

        {/* Roster by Position */}
        <div className="grid md:grid-cols-2 gap-6">
          {(['P', 'D', 'C', 'A'] as const).map(pos => {
            const config = POSITION_CONFIG[pos]
            const players = roster[pos]

            return (
              <div key={pos} className={`bg-surface-200 rounded-xl border ${config.border} overflow-hidden`}>
                {/* Card Header */}
                <div className={`p-5 border-b border-surface-50/20 bg-gradient-to-r ${config.gradient}/10`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${config.gradient} flex items-center justify-center text-white font-bold`}>
                        {pos}
                      </div>
                      <h3 className={`text-xl font-bold ${config.text}`}>{config.name}</h3>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                      totals[pos] >= slots[pos]
                        ? 'bg-secondary-500/20 text-secondary-400'
                        : 'bg-surface-300 text-gray-400'
                    }`}>
                      {totals[pos]}/{slots[pos]}
                    </span>
                  </div>
                </div>

                {/* Card Content */}
                <div className="p-5">
                  {players.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-3xl mb-2 opacity-50">📭</div>
                      <p className="text-gray-500">Nessun giocatore</p>
                    </div>
                  ) : (
                    <ul className="space-y-3">
                      {players.map(entry => (
                        <li key={entry.id} className="bg-surface-300 rounded-lg p-4 flex justify-between items-center hover:bg-surface-50/20 transition-colors">
                          <div>
                            <p className="font-semibold text-white text-lg">{entry.player.name}</p>
                            <p className="text-sm text-gray-400">{entry.player.team}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-bold text-accent-400">{entry.acquisitionPrice}</p>
                            {entry.contract && (
                              <p className="text-xs text-gray-500">
                                {entry.contract.duration} semestri
                              </p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-8 flex gap-4">
          <Button size="lg" variant="outline" onClick={() => onNavigate('rosters', { leagueId })}>
            <span className="mr-2">👥</span> Vedi tutte le rose
          </Button>
          <Button size="lg" variant="outline" onClick={() => onNavigate('contracts', { leagueId })}>
            <span className="mr-2">📝</span> Gestisci Contratti
          </Button>
        </div>
      </main>
    </div>
  )
}
