import { useState, useEffect } from 'react'
import { svincolatiApi, leagueApi } from '../services/api'
import { Button } from '../components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'
import { Navigation } from '../components/Navigation'

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

export function Svincolati({ leagueId, onNavigate }: SvincolatiProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isSvincolatiPhase, setIsSvincolatiPhase] = useState(false)
  const [myBudget, setMyBudget] = useState(0)

  // Free agents
  const [freeAgents, setFreeAgents] = useState<Player[]>([])
  const [teams, setTeams] = useState<string[]>([])

  // Filters
  const [positionFilter, setPositionFilter] = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [searchFilter, setSearchFilter] = useState('')

  // Auction
  const [activeAuction, setActiveAuction] = useState<ActiveAuction | null>(null)
  const [bidAmount, setBidAmount] = useState(0)
  const [history, setHistory] = useState<AuctionHistoryItem[]>([])

  const [activeTab, setActiveTab] = useState<'pool' | 'auction' | 'history'>('pool')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

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

    const [leagueRes, teamsRes, auctionRes] = await Promise.all([
      leagueApi.getById(leagueId),
      svincolatiApi.getTeams(),
      svincolatiApi.getCurrentAuction(leagueId),
    ])

    if (leagueRes.success && leagueRes.data) {
      const data = leagueRes.data as { userMembership?: { role: string } }
      setIsAdmin(data.userMembership?.role === 'ADMIN')
    }

    if (teamsRes.success && teamsRes.data) {
      setTeams(teamsRes.data as string[])
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-300">
        <Navigation currentPage="svincolati" leagueId={leagueId} isLeagueAdmin={isAdmin} onNavigate={onNavigate} />
        <div className="flex items-center justify-center h-[80vh]">
          <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark-300">
      <Navigation currentPage="svincolati" leagueId={leagueId} isLeagueAdmin={isAdmin} onNavigate={onNavigate} />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {error && (
          <div className="bg-danger-50 text-danger-700 p-3 rounded mb-4">{error}</div>
        )}
        {success && (
          <div className="bg-success-50 text-success-700 p-3 rounded mb-4">{success}</div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={activeTab === 'pool' ? 'primary' : 'outline'}
            onClick={() => setActiveTab('pool')}
          >
            Pool Svincolati ({freeAgents.length})
          </Button>
          <Button
            variant={activeTab === 'auction' ? 'primary' : 'outline'}
            onClick={() => { setActiveTab('auction'); loadCurrentAuction() }}
          >
            Asta {activeAuction ? '(IN CORSO)' : ''}
          </Button>
          <Button
            variant={activeTab === 'history' ? 'primary' : 'outline'}
            onClick={() => { setActiveTab('history'); loadHistory() }}
          >
            Storico
          </Button>
        </div>

        {/* Pool View */}
        {activeTab === 'pool' && (
          <div>
            {/* Filters */}
            <Card className="mb-6">
              <CardContent className="py-4">
                <div className="grid md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm text-gray-500 mb-1">Ruolo</label>
                    <select
                      value={positionFilter}
                      onChange={e => setPositionFilter(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="">Tutti</option>
                      <option value="P">Portieri</option>
                      <option value="D">Difensori</option>
                      <option value="C">Centrocampisti</option>
                      <option value="A">Attaccanti</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 mb-1">Squadra</label>
                    <select
                      value={teamFilter}
                      onChange={e => setTeamFilter(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="">Tutte</option>
                      {teams.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 mb-1">Cerca</label>
                    <input
                      type="text"
                      value={searchFilter}
                      onChange={e => setSearchFilter(e.target.value)}
                      placeholder="Nome giocatore..."
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      variant="outline"
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
              </CardContent>
            </Card>

            {/* Players Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {freeAgents.length === 0 ? (
                <p className="text-gray-500 col-span-full text-center py-8">
                  Nessun giocatore svincolato trovato
                </p>
              ) : (
                freeAgents.map(player => (
                  <Card key={player.id}>
                    <CardContent className="py-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{player.name}</p>
                          <p className="text-sm text-gray-500">{player.team}</p>
                          <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${
                            player.position === 'P' ? 'bg-yellow-100 text-yellow-700' :
                            player.position === 'D' ? 'bg-blue-100 text-blue-700' :
                            player.position === 'C' ? 'bg-green-100 text-green-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {player.position}
                          </span>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-primary-600">{player.quotation}</p>
                          <p className="text-xs text-gray-400">quotazione</p>
                          {isAdmin && isSvincolatiPhase && !activeAuction && (
                            <Button
                              size="sm"
                              className="mt-2"
                              onClick={() => handleStartAuction(player.id)}
                              disabled={isSubmitting}
                            >
                              Avvia Asta
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        )}

        {/* Auction View */}
        {activeTab === 'auction' && (
          <div>
            {!activeAuction ? (
              <Card>
                <CardContent className="py-8 text-center text-gray-500">
                  {isSvincolatiPhase
                    ? 'Nessuna asta in corso. L\'admin può avviare un\'asta dal pool svincolati.'
                    : 'La fase SVINCOLATI non è attiva.'}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-warning-600">Asta in Corso</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="text-xl font-bold">{activeAuction.player.name}</p>
                        <p className="text-gray-500">
                          {activeAuction.player.team} - {activeAuction.player.position}
                        </p>
                        <div className="mt-4 grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-gray-500">Base (quotazione)</p>
                            <p className="font-bold">{activeAuction.basePrice}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Offerta attuale</p>
                            <p className="font-bold text-primary-600">{activeAuction.currentPrice}</p>
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
                            className="flex-1 px-3 py-2 border rounded-lg"
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
                          Budget disponibile: {myBudget}
                        </p>
                      </div>

                      {isAdmin && (
                        <Button
                          variant="outline"
                          className="mt-4 w-full"
                          onClick={handleCloseAuction}
                          disabled={isSubmitting}
                        >
                          Chiudi Asta
                        </Button>
                      )}
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">Ultime offerte</h4>
                      <div className="space-y-2">
                        {activeAuction.bids.length === 0 ? (
                          <p className="text-gray-400 text-sm">Nessuna offerta ancora</p>
                        ) : (
                          activeAuction.bids.map((bid, i) => (
                            <div
                              key={i}
                              className={`p-2 rounded ${bid.isWinning ? 'bg-success-50' : 'bg-gray-50'}`}
                            >
                              <span className="font-medium">{bid.bidder}</span>
                              <span className="ml-2 font-mono">{bid.amount}</span>
                              {bid.isWinning && (
                                <span className="ml-2 text-success-600 text-sm">Vincente</span>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* History View */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            {history.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-gray-500">
                  Nessuna asta completata
                </CardContent>
              </Card>
            ) : (
              history.map(item => (
                <Card key={item.id}>
                  <CardContent className="py-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">{item.player.name}</p>
                        <p className="text-sm text-gray-500">
                          {item.player.position} - {item.player.team}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-primary-600">{item.finalPrice}</p>
                        <p className="text-sm text-gray-500">
                          Vinto da: {item.winner}
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(item.closedAt).toLocaleString('it-IT')}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  )
}
