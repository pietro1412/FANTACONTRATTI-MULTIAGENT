import { useState, useEffect } from 'react'
import { rubataApi, leagueApi } from '../services/api'
import { Button } from '../components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'
import { Navigation } from '../components/Navigation'

interface RubataProps {
  leagueId: string
  onNavigate: (page: string, params?: Record<string, string>) => void
}

interface LeagueMember {
  id: string
  username: string
  teamName?: string
  rubataOrder?: number
  currentBudget: number
}

interface Player {
  id: string
  name: string
  team: string
  position: string
}

interface RubablePlayer {
  rosterId: string
  player: Player
  contract: {
    salary: number
    duration: number
    rescissionClause: number
  } | null
  rubataBasePrice: number
}

interface ActiveAuction {
  id: string
  player: Player
  basePrice: number
  currentPrice: number
  sellerId: string
  bids: Array<{
    amount: number
    bidder: string
    isWinning: boolean
  }>
}

interface RubataStatus {
  isRubataPhase: boolean
  currentPhase?: string
  rubataOrder: string[]
  currentTurn: {
    memberId: string
    username: string
    isMe: boolean
  } | null
  activeAuction: ActiveAuction | null
  remainingTurns: number
}

export function Rubata({ leagueId, onNavigate }: RubataProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [status, setStatus] = useState<RubataStatus | null>(null)
  const [members, setMembers] = useState<LeagueMember[]>([])
  const [rubablePlayers, setRubablePlayers] = useState<RubablePlayer[]>([])
  const [orderDraft, setOrderDraft] = useState<string[]>([])
  const [bidAmount, setBidAmount] = useState(0)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    loadData()
    // Poll for updates every 5 seconds
    const interval = setInterval(loadData, 5000)
    return () => clearInterval(interval)
  }, [leagueId])

  useEffect(() => {
    if (status?.currentTurn?.memberId) {
      loadRubablePlayers(status.currentTurn.memberId)
    }
  }, [status?.currentTurn?.memberId])

  async function loadData() {
    const [statusRes, membersRes, leagueRes] = await Promise.all([
      rubataApi.getStatus(leagueId),
      leagueApi.getMembers(leagueId),
      leagueApi.getById(leagueId),
    ])

    if (statusRes.success && statusRes.data) {
      setStatus(statusRes.data as RubataStatus)
    }
    if (membersRes.success && membersRes.data) {
      const data = membersRes.data as { members: LeagueMember[] }
      setMembers(data.members || [])
      if (orderDraft.length === 0) {
        setOrderDraft(data.members?.map(m => m.id) || [])
      }
    }
    if (leagueRes.success && leagueRes.data) {
      const data = leagueRes.data as { userMembership?: { role: string } }
      setIsAdmin(data.userMembership?.role === 'ADMIN')
    }
    setIsLoading(false)
  }

  async function loadRubablePlayers(memberId: string) {
    const res = await rubataApi.getRubablePlayers(leagueId, memberId)
    if (res.success && res.data) {
      setRubablePlayers(res.data as RubablePlayer[])
    }
  }

  async function handleSetOrder() {
    setError('')
    setSuccess('')
    setIsSubmitting(true)

    const res = await rubataApi.setOrder(leagueId, orderDraft)
    if (res.success) {
      setSuccess('Ordine rubata impostato!')
      loadData()
    } else {
      setError(res.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  async function handlePutOnPlate(rosterId: string) {
    setError('')
    setSuccess('')
    setIsSubmitting(true)

    const res = await rubataApi.putOnPlate(leagueId, rosterId)
    if (res.success) {
      setSuccess('Giocatore messo sul piatto!')
      loadData()
    } else {
      setError(res.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  async function handleBid() {
    if (!status?.activeAuction) return
    setError('')
    setIsSubmitting(true)

    const res = await rubataApi.bid(status.activeAuction.id, bidAmount)
    if (res.success) {
      setBidAmount(0)
      loadData()
    } else {
      setError(res.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  async function handleCloseAuction() {
    if (!status?.activeAuction) return
    setError('')
    setIsSubmitting(true)

    const res = await rubataApi.closeAuction(status.activeAuction.id)
    if (res.success) {
      setSuccess(res.message || 'Asta chiusa!')
      loadData()
    } else {
      setError(res.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  async function handleSkipTurn() {
    setError('')
    setIsSubmitting(true)

    const res = await rubataApi.skipTurn(leagueId)
    if (res.success) {
      setSuccess(res.message || 'Turno saltato')
      loadData()
    } else {
      setError(res.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  function moveInOrder(index: number, direction: 'up' | 'down') {
    const newOrder = [...orderDraft]
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= newOrder.length) return
    const temp = newOrder[index]
    const swapWith = newOrder[newIndex]
    if (temp !== undefined && swapWith !== undefined) {
      newOrder[index] = swapWith
      newOrder[newIndex] = temp
    }
    setOrderDraft(newOrder)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-300">
        <Navigation currentPage="rubata" leagueId={leagueId} isLeagueAdmin={isAdmin} onNavigate={onNavigate} />
        <div className="flex items-center justify-center h-[80vh]">
          <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
        </div>
      </div>
    )
  }

  const isRubataPhase = status?.isRubataPhase || false
  const activeAuction = status?.activeAuction
  const isMyTurn = status?.currentTurn?.isMe || false

  return (
    <div className="min-h-screen bg-dark-300">
      <Navigation currentPage="rubata" leagueId={leagueId} isLeagueAdmin={isAdmin} onNavigate={onNavigate} />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {error && (
          <div className="bg-danger-50 text-danger-700 p-3 rounded mb-4">{error}</div>
        )}
        {success && (
          <div className="bg-success-50 text-success-700 p-3 rounded mb-4">{success}</div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Order Management (Admin) */}
          {isAdmin && (
            <Card>
              <CardHeader>
                <CardTitle>Ordine Rubata</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 mb-4">
                  {orderDraft.map((memberId, index) => {
                    const member = members.find(m => m.id === memberId)
                    return (
                      <div key={memberId} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm text-gray-500">{index + 1}.</span>
                          <span>{member?.username || 'Unknown'}</span>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => moveInOrder(index, 'up')}
                            disabled={index === 0}
                            className="px-2 py-1 text-sm bg-gray-200 rounded disabled:opacity-50"
                          >
                            &uarr;
                          </button>
                          <button
                            onClick={() => moveInOrder(index, 'down')}
                            disabled={index === orderDraft.length - 1}
                            className="px-2 py-1 text-sm bg-gray-200 rounded disabled:opacity-50"
                          >
                            &darr;
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <Button onClick={handleSetOrder} disabled={isSubmitting}>
                  Salva Ordine
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Current Turn */}
          <Card>
            <CardHeader>
              <CardTitle>Turno Corrente</CardTitle>
            </CardHeader>
            <CardContent>
              {!isRubataPhase ? (
                <p className="text-gray-500">La fase RUBATA non e' attiva</p>
              ) : !status?.currentTurn ? (
                <p className="text-gray-500">Nessun turno attivo. Imposta l'ordine rubata.</p>
              ) : (
                <div>
                  <div className={`p-4 rounded-lg ${isMyTurn ? 'bg-primary-50 border-2 border-primary-500' : 'bg-gray-50'}`}>
                    <p className="font-medium text-lg">
                      {status.currentTurn.username}
                      {isMyTurn && <span className="ml-2 text-primary-600">(Tocca a te!)</span>}
                    </p>
                    <p className="text-sm text-gray-500">
                      Turni rimanenti: {status.remainingTurns}
                    </p>
                  </div>
                  {isAdmin && !activeAuction && (
                    <Button variant="outline" className="mt-4" onClick={handleSkipTurn} disabled={isSubmitting}>
                      Salta Turno
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Active Auction */}
        {activeAuction && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-warning-600">Asta in Corso</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-xl font-bold">{activeAuction.player.name}</p>
                    <p className="text-gray-500">{activeAuction.player.team} - {activeAuction.player.position}</p>
                    <div className="mt-4 grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Base</p>
                        <p className="font-bold">{activeAuction.basePrice}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Offerta attuale</p>
                        <p className="font-bold text-primary-600">{activeAuction.currentPrice}</p>
                      </div>
                    </div>
                  </div>

                  {/* Bid Form */}
                  <div className="mt-4 flex gap-2">
                    <input
                      type="number"
                      value={bidAmount}
                      onChange={(e) => setBidAmount(parseInt(e.target.value) || 0)}
                      placeholder={`Min: ${activeAuction.currentPrice + 1}`}
                      className="flex-1 px-3 py-2 border rounded-lg"
                      min={activeAuction.currentPrice + 1}
                    />
                    <Button onClick={handleBid} disabled={isSubmitting || bidAmount <= activeAuction.currentPrice}>
                      Offri
                    </Button>
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

        {/* Rubable Players (only when it's current turn's member and no active auction) */}
        {isRubataPhase && status?.currentTurn && !activeAuction && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>
                Giocatori Rubabili di {status.currentTurn.username}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {rubablePlayers.length === 0 ? (
                <p className="text-gray-500">Nessun giocatore rubabile</p>
              ) : (
                <div className="space-y-2">
                  {rubablePlayers.map(rp => (
                    <div key={rp.rosterId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">{rp.player.name}</p>
                        <p className="text-sm text-gray-500">
                          {rp.player.position} - {rp.player.team}
                        </p>
                        {rp.contract && (
                          <p className="text-xs text-gray-400">
                            Clausola: {rp.contract.rescissionClause} + Ingaggio: {rp.contract.salary}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-primary-600">
                          Base: {rp.rubataBasePrice}
                        </p>
                        {(isAdmin || isMyTurn) && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-2"
                            onClick={() => handlePutOnPlate(rp.rosterId)}
                            disabled={isSubmitting}
                          >
                            Metti sul piatto
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
