import { useState, useEffect, useRef } from 'react'
import { svincolatiApi, leagueApi } from '../services/api'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Navigation } from '../components/Navigation'
import { getTeamLogo } from '../utils/teamLogos'

interface SvincolatiProps {
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

interface ActiveAuction {
  id: string
  player: Player
  basePrice: number
  currentPrice: number
  bids: Array<{
    amount: number
    bidder: string
    isWinning: boolean
  }>
}

interface AuctionHistoryItem {
  id: string
  player: Player
  winner: string
  finalPrice: number
  closedAt: string
}

const POSITION_COLORS: Record<string, string> = {
  P: 'from-amber-500 to-amber-600',
  D: 'from-blue-500 to-blue-600',
  C: 'from-green-500 to-green-600',
  A: 'from-red-500 to-red-600',
}

const SERIE_A_TEAMS = [
  'Atalanta', 'Bologna', 'Cagliari', 'Como', 'Cremonese', 'Empoli',
  'Fiorentina', 'Genoa', 'Inter', 'Juventus', 'Lazio', 'Lecce',
  'Milan', 'Monza', 'Napoli', 'Parma', 'Pisa', 'Roma', 'Sassuolo',
  'Torino', 'Udinese', 'Venezia', 'Verona',
]

export function Svincolati({ leagueId, onNavigate }: SvincolatiProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isSvincolatiPhase, setIsSvincolatiPhase] = useState(false)
  const [myBudget, setMyBudget] = useState(0)

  // Free agents
  const [freeAgents, setFreeAgents] = useState<Player[]>([])

  // Filters
  const [positionFilter, setPositionFilter] = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [searchFilter, setSearchFilter] = useState('')
  const [teamDropdownOpen, setTeamDropdownOpen] = useState(false)
  const teamDropdownRef = useRef<HTMLDivElement>(null)

  // Auction
  const [activeAuction, setActiveAuction] = useState<ActiveAuction | null>(null)
  const [bidAmount, setBidAmount] = useState(0)
  const [history, setHistory] = useState<AuctionHistoryItem[]>([])

  const [activeTab, setActiveTab] = useState<'pool' | 'auction' | 'history'>('pool')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Click outside handler for team dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (teamDropdownRef.current && !teamDropdownRef.current.contains(event.target as Node)) {
        setTeamDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    loadInitialData()
  }, [leagueId])

  useEffect(() => {
    loadFreeAgents()
  }, [leagueId, positionFilter, teamFilter, searchFilter])

  useEffect(() => {
    // Poll for auction updates every 5 seconds when viewing auction
    if (activeTab === 'auction') {
      const interval = setInterval(loadCurrentAuction, 5000)
      return () => clearInterval(interval)
    }
  }, [activeTab, leagueId])

  async function loadInitialData() {
    setIsLoading(true)

    const [leagueRes, auctionRes] = await Promise.all([
      leagueApi.getById(leagueId),
      svincolatiApi.getCurrentAuction(leagueId),
    ])

    if (leagueRes.success && leagueRes.data) {
      const data = leagueRes.data as { userMembership?: { role: string } }
      setIsAdmin(data.userMembership?.role === 'ADMIN')
    }

    if (auctionRes.success && auctionRes.data) {
      const data = auctionRes.data as {
        isSvincolatiPhase: boolean
        activeAuction: ActiveAuction | null
        myBudget: number
      }
      setIsSvincolatiPhase(data.isSvincolatiPhase)
      setActiveAuction(data.activeAuction)
      setMyBudget(data.myBudget)
    }

    setIsLoading(false)
  }

  async function loadFreeAgents() {
    const filters = {
      position: positionFilter || undefined,
      team: teamFilter || undefined,
      search: searchFilter || undefined,
    }

    const res = await svincolatiApi.getAll(leagueId, filters)
    if (res.success && res.data) {
      setFreeAgents(res.data as Player[])
    }
  }

  async function loadCurrentAuction() {
    const res = await svincolatiApi.getCurrentAuction(leagueId)
    if (res.success && res.data) {
      const data = res.data as {
        isSvincolatiPhase: boolean
        activeAuction: ActiveAuction | null
        myBudget: number
      }
      setIsSvincolatiPhase(data.isSvincolatiPhase)
      setActiveAuction(data.activeAuction)
      setMyBudget(data.myBudget)
    }
  }

  async function loadHistory() {
    const res = await svincolatiApi.getHistory(leagueId)
    if (res.success && res.data) {
      setHistory(res.data as AuctionHistoryItem[])
    }
  }

  async function handleStartAuction(playerId: string) {
    setError('')
    setSuccess('')
    setIsSubmitting(true)

    const res = await svincolatiApi.startAuction(leagueId, playerId)
    if (res.success) {
      setSuccess('Asta avviata!')
      loadCurrentAuction()
      loadFreeAgents()
      setActiveTab('auction')
    } else {
      setError(res.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  async function handleBid() {
    if (!activeAuction) return
    setError('')
    setIsSubmitting(true)

    const res = await svincolatiApi.bid(activeAuction.id, bidAmount)
    if (res.success) {
      setBidAmount(0)
      loadCurrentAuction()
    } else {
      setError(res.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  async function handleCloseAuction() {
    if (!activeAuction) return
    setError('')
    setIsSubmitting(true)

    const res = await svincolatiApi.closeAuction(activeAuction.id)
    if (res.success) {
      setSuccess(res.message || 'Asta chiusa!')
      loadCurrentAuction()
      loadFreeAgents()
      loadHistory()
    } else {
      setError(res.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  async function handleBotBid() {
    if (!activeAuction) return
    setError('')
    setIsSubmitting(true)

    const res = await svincolatiApi.triggerBotBid(activeAuction.id)
    if (res.success) {
      const data = res.data as { hasBotBid: boolean; newCurrentPrice: number; botBids: Array<{ botName: string; amount: number; reason: string }> }
      if (data.hasBotBid) {
        setSuccess(`Bot ha offerto ${data.newCurrentPrice}!`)
      } else {
        setSuccess('Nessun bot ha fatto offerte')
      }
      loadCurrentAuction()
    } else {
      setError(res.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-100">
        <Navigation currentPage="svincolati" leagueId={leagueId} isLeagueAdmin={isAdmin} onNavigate={onNavigate} />
        <div className="flex items-center justify-center h-[80vh]">
          <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark-100">
      <Navigation currentPage="svincolati" leagueId={leagueId} isLeagueAdmin={isAdmin} onNavigate={onNavigate} />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Svincolati</h1>
          <p className="text-gray-400">Gestisci il pool di giocatori svincolati</p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="bg-danger-500/20 border border-danger-500/30 text-danger-400 p-3 rounded-lg mb-4">{error}</div>
        )}
        {success && (
          <div className="bg-secondary-500/20 border border-secondary-500/30 text-secondary-400 p-3 rounded-lg mb-4">{success}</div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('pool')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'pool'
                ? 'bg-primary-500 text-white'
                : 'bg-surface-200 text-gray-400 hover:text-white'
            }`}
          >
            Pool Svincolati ({freeAgents.length})
          </button>
          <button
            onClick={() => { setActiveTab('auction'); loadCurrentAuction() }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'auction'
                ? 'bg-primary-500 text-white'
                : 'bg-surface-200 text-gray-400 hover:text-white'
            }`}
          >
            Asta {activeAuction ? <span className="text-warning-400">(IN CORSO)</span> : ''}
          </button>
          <button
            onClick={() => { setActiveTab('history'); loadHistory() }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'history'
                ? 'bg-primary-500 text-white'
                : 'bg-surface-200 text-gray-400 hover:text-white'
            }`}
          >
            Storico
          </button>
        </div>

        {/* Pool View */}
        {activeTab === 'pool' && (
          <div>
            {/* Filters */}
            <div className="bg-surface-200 rounded-xl border border-surface-50/20 p-4 mb-6">
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Cerca</label>
                  <Input
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Nome giocatore..."
                    className="w-48 bg-surface-300 border-surface-50/30"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Ruolo</label>
                  <select
                    value={positionFilter}
                    onChange={(e) => setPositionFilter(e.target.value)}
                    className="bg-surface-300 border border-surface-50/30 text-white rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Tutti</option>
                    <option value="P">Portieri</option>
                    <option value="D">Difensori</option>
                    <option value="C">Centrocampisti</option>
                    <option value="A">Attaccanti</option>
                  </select>
                </div>
                <div className="relative" ref={teamDropdownRef}>
                  <label className="block text-xs text-gray-400 mb-1">Squadra</label>
                  <button
                    type="button"
                    onClick={() => setTeamDropdownOpen(!teamDropdownOpen)}
                    className="bg-surface-300 border border-surface-50/30 text-white rounded-lg px-3 py-2 text-sm flex items-center gap-2 min-w-[160px] justify-between"
                  >
                    <div className="flex items-center gap-2">
                      {teamFilter ? (
                        <>
                          <div className="w-5 h-5 bg-white/90 rounded flex items-center justify-center p-0.5">
                            <img src={getTeamLogo(teamFilter)} alt={teamFilter} className="w-4 h-4 object-contain" />
                          </div>
                          <span>{teamFilter}</span>
                        </>
                      ) : (
                        <span>Tutte</span>
                      )}
                    </div>
                    <svg className={`w-4 h-4 transition-transform ${teamDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {teamDropdownOpen && (
                    <div className="absolute top-full left-0 mt-1 bg-surface-200 border border-surface-50/30 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto min-w-[200px]">
                      <button
                        type="button"
                        onClick={() => { setTeamFilter(''); setTeamDropdownOpen(false) }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-300 flex items-center gap-2 ${!teamFilter ? 'bg-primary-500/20 text-primary-400' : 'text-white'}`}
                      >
                        Tutte le squadre
                      </button>
                      {SERIE_A_TEAMS.map(team => (
                        <button
                          key={team}
                          type="button"
                          onClick={() => { setTeamFilter(team); setTeamDropdownOpen(false) }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-300 flex items-center gap-2 ${teamFilter === team ? 'bg-primary-500/20 text-primary-400' : 'text-white'}`}
                        >
                          <div className="w-6 h-6 bg-white/90 rounded flex items-center justify-center p-0.5 flex-shrink-0">
                            <img src={getTeamLogo(team)} alt={team} className="w-5 h-5 object-contain" />
                          </div>
                          <span>{team}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPositionFilter('')
                    setTeamFilter('')
                    setSearchFilter('')
                  }}
                >
                  Reset
                </Button>
              </div>
            </div>

            {/* Players Table */}
            <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
              {freeAgents.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  Nessun giocatore svincolato trovato
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-surface-300">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">Ruolo</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">Nome</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">Squadra</th>
                          <th className="px-4 py-3 text-center text-xs font-bold text-gray-400 uppercase">Quot.</th>
                          {isAdmin && isSvincolatiPhase && !activeAuction && (
                            <th className="px-4 py-3 text-center text-xs font-bold text-gray-400 uppercase">Azioni</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-50/10">
                        {freeAgents.map((player) => (
                          <tr key={player.id} className="hover:bg-surface-300/50">
                            <td className="px-4 py-3">
                              <span className={`w-8 h-8 rounded-full bg-gradient-to-br ${POSITION_COLORS[player.position] || 'from-gray-500 to-gray-600'} flex items-center justify-center text-white font-bold text-xs`}>
                                {player.position}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="font-medium text-white">{player.name}</span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="relative w-7 h-7 bg-white/90 rounded flex items-center justify-center p-0.5 flex-shrink-0">
                                  <img
                                    src={getTeamLogo(player.team)}
                                    alt={player.team}
                                    className="w-6 h-6 object-contain"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%236b7280"%3E%3Cpath d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/%3E%3C/svg%3E'
                                    }}
                                  />
                                </div>
                                <span className="text-gray-400">{player.team}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="font-mono text-accent-400">{player.quotation}</span>
                            </td>
                            {isAdmin && isSvincolatiPhase && !activeAuction && (
                              <td className="px-4 py-3 text-center">
                                <Button
                                  size="sm"
                                  onClick={() => handleStartAuction(player.id)}
                                  disabled={isSubmitting}
                                >
                                  Avvia Asta
                                </Button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-4 py-3 border-t border-surface-50/20">
                    <p className="text-sm text-gray-400">{freeAgents.length} giocatori svincolati</p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Auction View */}
        {activeTab === 'auction' && (
          <div>
            {!activeAuction ? (
              <div className="bg-surface-200 rounded-xl border border-surface-50/20 p-8 text-center text-gray-400">
                {isSvincolatiPhase
                  ? "Nessuna asta in corso. L'admin può avviare un'asta dal pool svincolati."
                  : 'La fase SVINCOLATI non è attiva.'}
              </div>
            ) : (
              <div className="bg-surface-200 rounded-xl border border-surface-50/20">
                <div className="border-b border-surface-50/20 px-6 py-4">
                  <h2 className="text-lg font-bold text-warning-400">Asta in Corso</h2>
                </div>
                <div className="p-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <div className="bg-surface-300 p-4 rounded-lg">
                        <div className="flex items-center gap-3 mb-4">
                          <span className={`w-10 h-10 rounded-full bg-gradient-to-br ${POSITION_COLORS[activeAuction.player.position] || 'from-gray-500 to-gray-600'} flex items-center justify-center text-white font-bold text-sm`}>
                            {activeAuction.player.position}
                          </span>
                          <div>
                            <p className="text-xl font-bold text-white">{activeAuction.player.name}</p>
                            <div className="flex items-center gap-2 text-gray-400">
                              <div className="w-5 h-5 bg-white/90 rounded flex items-center justify-center p-0.5">
                                <img src={getTeamLogo(activeAuction.player.team)} alt={activeAuction.player.team} className="w-4 h-4 object-contain" />
                              </div>
                              <span>{activeAuction.player.team}</span>
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-surface-200 rounded-lg p-3">
                            <p className="text-xs text-gray-500">Base (quotazione)</p>
                            <p className="font-bold text-white font-mono">{activeAuction.basePrice}</p>
                          </div>
                          <div className="bg-primary-500/20 rounded-lg p-3">
                            <p className="text-xs text-primary-300">Offerta attuale</p>
                            <p className="font-bold text-primary-400 font-mono">{activeAuction.currentPrice}</p>
                          </div>
                        </div>
                      </div>

                      {/* Bid Form */}
                      <div className="mt-4">
                        <div className="flex gap-2">
                          <input
                            type="number"
                            value={bidAmount}
                            onChange={(e) => setBidAmount(parseInt(e.target.value) || 0)}
                            placeholder={`Min: ${activeAuction.currentPrice + 1}`}
                            className="flex-1 px-3 py-2 bg-surface-300 border border-surface-50/30 rounded-lg text-white"
                            min={activeAuction.currentPrice + 1}
                            max={myBudget}
                          />
                          <Button
                            onClick={handleBid}
                            disabled={isSubmitting || bidAmount <= activeAuction.currentPrice || bidAmount > myBudget}
                          >
                            Offri
                          </Button>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          Budget disponibile: <span className="text-accent-400 font-mono">{myBudget}</span>
                        </p>
                      </div>

                      {isAdmin && (
                        <div className="mt-4 space-y-2">
                          <Button
                            variant="outline"
                            className="w-full bg-warning-500/20 border-warning-500/30 text-warning-400 hover:bg-warning-500/30"
                            onClick={handleBotBid}
                            disabled={isSubmitting}
                          >
                            Bot fa offerta
                          </Button>
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={handleCloseAuction}
                            disabled={isSubmitting}
                          >
                            Chiudi Asta
                          </Button>
                        </div>
                      )}
                    </div>

                    <div>
                      <h4 className="font-medium text-white mb-3">Ultime offerte</h4>
                      <div className="space-y-2">
                        {activeAuction.bids.length === 0 ? (
                          <p className="text-gray-500 text-sm">Nessuna offerta ancora</p>
                        ) : (
                          activeAuction.bids.map((bid, i) => (
                            <div
                              key={i}
                              className={`p-3 rounded-lg ${bid.isWinning ? 'bg-secondary-500/20 border border-secondary-500/30' : 'bg-surface-300'}`}
                            >
                              <span className="font-medium text-white">{bid.bidder}</span>
                              <span className="ml-2 font-mono text-accent-400">{bid.amount}</span>
                              {bid.isWinning && (
                                <span className="ml-2 text-secondary-400 text-sm">Vincente</span>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* History View */}
        {activeTab === 'history' && (
          <div>
            {history.length === 0 ? (
              <div className="bg-surface-200 rounded-xl border border-surface-50/20 p-8 text-center text-gray-400">
                Nessuna asta completata
              </div>
            ) : (
              <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-surface-300">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">Ruolo</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">Giocatore</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">Squadra</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">Vincitore</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-400 uppercase">Prezzo</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-400 uppercase">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-50/10">
                    {history.map(item => (
                      <tr key={item.id} className="hover:bg-surface-300/50">
                        <td className="px-4 py-3">
                          <span className={`w-8 h-8 rounded-full bg-gradient-to-br ${POSITION_COLORS[item.player.position] || 'from-gray-500 to-gray-600'} flex items-center justify-center text-white font-bold text-xs`}>
                            {item.player.position}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-medium text-white">{item.player.name}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-white/90 rounded flex items-center justify-center p-0.5">
                              <img src={getTeamLogo(item.player.team)} alt={item.player.team} className="w-5 h-5 object-contain" />
                            </div>
                            <span className="text-gray-400">{item.player.team}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-secondary-400">{item.winner}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-mono text-accent-400 font-bold">{item.finalPrice}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-gray-500 text-sm">{new Date(item.closedAt).toLocaleString('it-IT')}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
