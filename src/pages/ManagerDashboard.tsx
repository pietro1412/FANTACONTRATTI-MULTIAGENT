import { useState, useEffect } from 'react'
import { auctionApi, leagueApi } from '../services/api'
import { Button } from '../components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'
import { Navigation } from '../components/Navigation'

interface ManagerDashboardProps {
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

interface Contract {
  id: string
  salary: number
  duration: number
  initialSalary: number
  rescissionClause: number
  signedAt: string
}

interface RosterEntry {
  id: string
  acquisitionPrice: number
  acquisitionType: string
  acquiredAt: string
  player: Player
  contract?: Contract
}

interface BudgetMovement {
  type: 'IN' | 'OUT'
  amount: number
  description: string
  date: string
}

interface LeagueMember {
  id: string
  currentBudget: number
  teamName?: string
  user: { username: string }
  league: {
    initialBudget: number
    goalkeeperSlots: number
    defenderSlots: number
    midfielderSlots: number
    forwardSlots: number
  }
}

const POSITION_CONFIG = {
  P: { name: 'Portieri', color: 'yellow', bgClass: 'bg-yellow-50', textClass: 'text-yellow-700' },
  D: { name: 'Difensori', color: 'blue', bgClass: 'bg-blue-50', textClass: 'text-blue-700' },
  C: { name: 'Centrocampisti', color: 'green', bgClass: 'bg-green-50', textClass: 'text-green-700' },
  A: { name: 'Attaccanti', color: 'red', bgClass: 'bg-red-50', textClass: 'text-red-700' },
}

export function ManagerDashboard({ leagueId, onNavigate }: ManagerDashboardProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [isLeagueAdmin, setIsLeagueAdmin] = useState(false)
  const [member, setMember] = useState<LeagueMember | null>(null)
  const [roster, setRoster] = useState<Record<string, RosterEntry[]>>({ P: [], D: [], C: [], A: [] })
  const [totals, setTotals] = useState({ P: 0, D: 0, C: 0, A: 0, total: 0 })
  const [slots, setSlots] = useState({ P: 0, D: 0, C: 0, A: 0 })
  const [budgetMovements, setBudgetMovements] = useState<BudgetMovement[]>([])
  const [activeTab, setActiveTab] = useState<'overview' | 'roster' | 'contracts' | 'budget'>('overview')
  const [isAfterFirstMarket, setIsAfterFirstMarket] = useState(false)

  useEffect(() => {
    loadData()
  }, [leagueId])

  async function loadData() {
    setIsLoading(true)

    // Check league admin status and market sessions
    const [leagueRes, sessionsRes, rosterRes] = await Promise.all([
      leagueApi.getById(leagueId),
      auctionApi.getSessions(leagueId),
      auctionApi.getRoster(leagueId)
    ])

    if (leagueRes.success && leagueRes.data) {
      const data = leagueRes.data as { userMembership?: { role: string } }
      setIsLeagueAdmin(data.userMembership?.role === 'ADMIN')
    }

    if (sessionsRes.success && sessionsRes.data) {
      const sessions = sessionsRes.data as Array<{ type: string; status: string }>
      const firstMarket = sessions.find(s => s.type === 'PRIMO_MERCATO')
      const recurringMarket = sessions.find(s => s.type === 'MERCATO_RICORRENTE')
      setIsAfterFirstMarket(firstMarket?.status === 'COMPLETED' || !!recurringMarket)
    }

    if (rosterRes.success && rosterRes.data) {
      const data = rosterRes.data as {
        member: LeagueMember
        roster: Record<string, RosterEntry[]>
        totals: { P: number; D: number; C: number; A: number; total: number }
        slots: { P: number; D: number; C: number; A: number }
      }
      setMember(data.member)
      setRoster(data.roster)
      setTotals(data.totals)
      setSlots(data.slots)

      // Calculate budget movements from roster
      const movements: BudgetMovement[] = []
      const allPlayers = [...(data.roster.P ?? []), ...(data.roster.D ?? []), ...(data.roster.C ?? []), ...(data.roster.A ?? [])]

      // Initial budget
      movements.push({
        type: 'IN',
        amount: data.member.league.initialBudget,
        description: 'Budget iniziale',
        date: new Date().toISOString(),
      })

      // Acquisitions
      allPlayers.forEach(entry => {
        movements.push({
          type: 'OUT',
          amount: entry.acquisitionPrice,
          description: `Acquisto ${entry.player.name} (${entry.acquisitionType})`,
          date: entry.acquiredAt,
        })
      })

      // Contracts (salaries)
      allPlayers.forEach(entry => {
        if (entry.contract) {
          const totalContractCost = entry.contract.salary * entry.contract.duration
          movements.push({
            type: 'OUT',
            amount: totalContractCost,
            description: `Contratto ${entry.player.name} (${entry.contract.salary}x${entry.contract.duration})`,
            date: entry.contract.signedAt,
          })
        }
      })

      // Sort by date descending
      movements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      setBudgetMovements(movements)
    }

    setIsLoading(false)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-300">
        <Navigation currentPage="managerDashboard" leagueId={leagueId} isLeagueAdmin={isLeagueAdmin} onNavigate={onNavigate} />
        <div className="flex items-center justify-center h-[80vh]">
          <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
        </div>
      </div>
    )
  }

  if (!member) {
    return (
      <div className="min-h-screen bg-dark-300">
        <Navigation currentPage="managerDashboard" leagueId={leagueId} isLeagueAdmin={isLeagueAdmin} onNavigate={onNavigate} />
        <div className="flex items-center justify-center h-[80vh]">
          <p className="text-danger-500">Errore nel caricamento dei dati</p>
        </div>
      </div>
    )
  }

  const totalSlots = slots.P + slots.D + slots.C + slots.A
  const allPlayers = [...(roster.P ?? []), ...(roster.D ?? []), ...(roster.C ?? []), ...(roster.A ?? [])]
  const expiringContracts = allPlayers.filter(e => e.contract && e.contract.duration <= 1)
  const totalSalaries = allPlayers.reduce((sum, e) => sum + (e.contract?.salary || 0), 0)
  const totalClausole = allPlayers.reduce((sum, e) => sum + (e.contract?.rescissionClause || 0), 0)

  return (
    <div className="min-h-screen bg-dark-300">
      <Navigation currentPage="managerDashboard" leagueId={leagueId} isLeagueAdmin={isLeagueAdmin} onNavigate={onNavigate} />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <Button
            variant={activeTab === 'overview' ? 'primary' : 'outline'}
            onClick={() => setActiveTab('overview')}
          >
            Panoramica
          </Button>
          <Button
            variant={activeTab === 'roster' ? 'primary' : 'outline'}
            onClick={() => setActiveTab('roster')}
          >
            Rosa Completa
          </Button>
          <Button
            variant={activeTab === 'contracts' ? 'primary' : 'outline'}
            onClick={() => setActiveTab('contracts')}
          >
            Contratti
          </Button>
          <Button
            variant={activeTab === 'budget' ? 'primary' : 'outline'}
            onClick={() => setActiveTab('budget')}
          >
            Budget
          </Button>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="py-4 text-center">
                  <p className="text-3xl font-bold text-primary-600">{totals.total}/{totalSlots}</p>
                  <p className="text-sm text-gray-500">Giocatori in rosa</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4 text-center">
                  <p className="text-3xl font-bold text-green-600">{member.currentBudget}</p>
                  <p className="text-sm text-gray-500">Budget disponibile</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4 text-center">
                  <p className="text-3xl font-bold text-orange-600">{totalSalaries}</p>
                  <p className="text-sm text-gray-500">Totale ingaggi</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4 text-center">
                  <p className="text-3xl font-bold text-purple-600">{totalClausole}</p>
                  <p className="text-sm text-gray-500">Valore clausole</p>
                </CardContent>
              </Card>
            </div>

            {/* Roster Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Composizione Rosa</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4">
                  {(['P', 'D', 'C', 'A'] as const).map(pos => {
                    const config = POSITION_CONFIG[pos]
                    const isFull = totals[pos] >= slots[pos]
                    return (
                      <div key={pos} className={`p-4 rounded-lg ${config.bgClass}`}>
                        <div className="flex justify-between items-center mb-2">
                          <span className={`font-bold ${config.textClass}`}>{config.name}</span>
                          <span className={`text-sm ${isFull && !isAfterFirstMarket ? 'text-green-600' : 'text-gray-500'}`}>
                            {isAfterFirstMarket ? totals[pos] : `${totals[pos]}/${slots[pos]}`}
                          </span>
                        </div>
                        <div className="space-y-1">
                          {(roster[pos] ?? []).slice(0, 3).map(entry => (
                            <p key={entry.id} className="text-sm truncate">{entry.player.name}</p>
                          ))}
                          {(roster[pos]?.length ?? 0) > 3 && (
                            <p className="text-xs text-gray-400">+{(roster[pos]?.length ?? 0) - 3} altri</p>
                          )}
                          {(roster[pos]?.length ?? 0) === 0 && (
                            <p className="text-xs text-gray-400">Nessun giocatore</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Expiring Contracts Alert */}
            {expiringContracts.length > 0 && (
              <Card className="border-warning-300 bg-warning-50">
                <CardHeader>
                  <CardTitle className="text-warning-700">Contratti in Scadenza</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {expiringContracts.map(entry => (
                      <div key={entry.id} className="flex justify-between items-center p-2 bg-white rounded">
                        <div>
                          <p className="font-medium">{entry.player.name}</p>
                          <p className="text-sm text-gray-500">{entry.player.position} - {entry.player.team}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-warning-600 font-medium">
                            {entry.contract?.duration === 0 ? 'SCADUTO' : '1 semestre'}
                          </p>
                          <p className="text-sm text-gray-500">Ingaggio: {entry.contract?.salary}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => onNavigate('contracts', { leagueId })}
                  >
                    Gestisci Contratti
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Roster Tab */}
        {activeTab === 'roster' && (
          <div className="grid md:grid-cols-2 gap-6">
            {(['P', 'D', 'C', 'A'] as const).map(pos => {
              const config = POSITION_CONFIG[pos]
              return (
                <Card key={pos}>
                  <CardHeader className={config.bgClass}>
                    <CardTitle className={config.textClass}>
                      {config.name} ({isAfterFirstMarket ? totals[pos] : `${totals[pos]}/${slots[pos]}`})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {(roster[pos]?.length ?? 0) === 0 ? (
                      <p className="p-4 text-gray-400 text-sm text-center">Nessun giocatore</p>
                    ) : (
                      <>
                        {/* Mobile Card Layout */}
                        <div className="md:hidden divide-y">
                          {(roster[pos] ?? []).map(entry => (
                            <div key={entry.id} className="p-3 flex items-center justify-between">
                              <div className="min-w-0 flex-1">
                                <p className="font-medium truncate">{entry.player.name}</p>
                                <p className="text-xs text-gray-500">{entry.player.team}</p>
                              </div>
                              <div className="flex gap-3 text-right text-sm">
                                <div>
                                  <div className="text-[10px] text-gray-500 uppercase">Costo</div>
                                  <div className="font-mono">{entry.acquisitionPrice}</div>
                                </div>
                                <div>
                                  <div className="text-[10px] text-gray-500 uppercase">Quot.</div>
                                  <div className="font-mono text-gray-500">{entry.player.quotation}</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        {/* Desktop Table */}
                        <table className="hidden md:table w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs text-gray-500">Giocatore</th>
                              <th className="px-4 py-2 text-right text-xs text-gray-500">Costo</th>
                              <th className="px-4 py-2 text-right text-xs text-gray-500">Quot.</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {(roster[pos] ?? []).map(entry => (
                              <tr key={entry.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3">
                                  <p className="font-medium">{entry.player.name}</p>
                                  <p className="text-xs text-gray-500">{entry.player.team}</p>
                                </td>
                                <td className="px-4 py-3 text-right font-mono">
                                  {entry.acquisitionPrice}
                                </td>
                                <td className="px-4 py-3 text-right font-mono text-gray-500">
                                  {entry.player.quotation}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* Contracts Tab */}
        {activeTab === 'contracts' && (
          <Card>
            <CardHeader>
              <CardTitle>Tutti i Contratti</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {/* Mobile Card Layout */}
              <div className="md:hidden divide-y">
                {allPlayers.map(entry => {
                  const posConfig = POSITION_CONFIG[entry.player.position as keyof typeof POSITION_CONFIG]
                  return (
                    <div key={entry.id} className="p-3">
                      {/* Header: Position + Player */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${posConfig.bgClass} ${posConfig.textClass}`}>
                          {entry.player.position}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{entry.player.name}</p>
                          <p className="text-xs text-gray-500">{entry.player.team}</p>
                        </div>
                        {/* Status Badge */}
                        {!entry.contract ? (
                          <span className="px-2 py-1 bg-danger-100 text-danger-700 rounded text-xs">Da impostare</span>
                        ) : entry.contract.duration === 0 ? (
                          <span className="px-2 py-1 bg-danger-100 text-danger-700 rounded text-xs">Scaduto</span>
                        ) : entry.contract.duration === 1 ? (
                          <span className="px-2 py-1 bg-warning-100 text-warning-700 rounded text-xs">In scadenza</span>
                        ) : (
                          <span className="px-2 py-1 bg-success-100 text-success-700 rounded text-xs">Attivo</span>
                        )}
                      </div>
                      {/* Contract Data */}
                      {entry.contract && (
                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                          <div className="bg-gray-50 rounded p-1.5">
                            <div className="text-gray-500 text-[10px] uppercase">Ing</div>
                            <div className="font-mono">{entry.contract.salary}</div>
                          </div>
                          <div className="bg-gray-50 rounded p-1.5">
                            <div className="text-gray-500 text-[10px] uppercase">Dur</div>
                            <div className={entry.contract.duration <= 1 ? 'text-warning-600 font-medium' : ''}>
                              {entry.contract.duration} sem.
                            </div>
                          </div>
                          <div className="bg-gray-50 rounded p-1.5">
                            <div className="text-gray-500 text-[10px] uppercase">Cls</div>
                            <div className="font-mono">{entry.contract.rescissionClause}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              {/* Desktop Table */}
              <table className="hidden md:table w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs text-gray-500">Giocatore</th>
                    <th className="px-4 py-3 text-center text-xs text-gray-500">Ruolo</th>
                    <th className="px-4 py-3 text-right text-xs text-gray-500">Ingaggio</th>
                    <th className="px-4 py-3 text-right text-xs text-gray-500">Durata</th>
                    <th className="px-4 py-3 text-right text-xs text-gray-500">Clausola</th>
                    <th className="px-4 py-3 text-right text-xs text-gray-500">Stato</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {allPlayers.map(entry => (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium">{entry.player.name}</p>
                        <p className="text-xs text-gray-500">{entry.player.team}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${POSITION_CONFIG[entry.player.position as keyof typeof POSITION_CONFIG].bgClass} ${POSITION_CONFIG[entry.player.position as keyof typeof POSITION_CONFIG].textClass}`}>
                          {entry.player.position}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {entry.contract?.salary || '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {entry.contract ? (
                          <span className={entry.contract.duration <= 1 ? 'text-warning-600 font-medium' : ''}>
                            {entry.contract.duration} sem.
                          </span>
                        ) : (
                          <span className="text-danger-500">No contratto</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {entry.contract?.rescissionClause || '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!entry.contract ? (
                          <span className="px-2 py-1 bg-danger-100 text-danger-700 rounded text-xs">Da impostare</span>
                        ) : entry.contract.duration === 0 ? (
                          <span className="px-2 py-1 bg-danger-100 text-danger-700 rounded text-xs">Scaduto</span>
                        ) : entry.contract.duration === 1 ? (
                          <span className="px-2 py-1 bg-warning-100 text-warning-700 rounded text-xs">In scadenza</span>
                        ) : (
                          <span className="px-2 py-1 bg-success-100 text-success-700 rounded text-xs">Attivo</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {allPlayers.length === 0 && (
                <p className="p-8 text-center text-gray-400">Nessun giocatore in rosa</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Budget Tab */}
        {activeTab === 'budget' && (
          <div className="space-y-6">
            {/* Budget Summary */}
            <div className="grid md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="py-4 text-center">
                  <p className="text-2xl font-bold text-gray-600">{member.league.initialBudget}</p>
                  <p className="text-sm text-gray-500">Budget iniziale</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4 text-center">
                  <p className="text-2xl font-bold text-red-600">
                    -{member.league.initialBudget - member.currentBudget}
                  </p>
                  <p className="text-sm text-gray-500">Speso</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4 text-center">
                  <p className="text-2xl font-bold text-green-600">{member.currentBudget}</p>
                  <p className="text-sm text-gray-500">Disponibile</p>
                </CardContent>
              </Card>
            </div>

            {/* Movements List */}
            <Card>
              <CardHeader>
                <CardTitle>Movimenti Budget</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y max-h-96 overflow-y-auto">
                  {budgetMovements.map((mov, i) => (
                    <div key={i} className="px-4 py-3 flex justify-between items-center hover:bg-gray-50">
                      <div>
                        <p className="font-medium">{mov.description}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(mov.date).toLocaleDateString('it-IT')}
                        </p>
                      </div>
                      <p className={`font-mono font-bold ${mov.type === 'IN' ? 'text-green-600' : 'text-red-600'}`}>
                        {mov.type === 'IN' ? '+' : '-'}{mov.amount}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  )
}
