import { useState, useEffect } from 'react'
import { tradeApi, auctionApi, leagueApi, contractApi } from '../services/api'
import { Button } from '../components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'
import { Navigation } from '../components/Navigation'
import { getTeamLogo } from '../utils/teamLogos'
import { ContractModifierModal, type PlayerInfo, type ContractData } from '../components/ContractModifier'

interface TradesProps {
  leagueId: string
  onNavigate: (page: string, params?: Record<string, string>) => void
  highlightOfferId?: string
}

interface PlayerContract {
  salary: number
  duration: number
  rescissionClause?: number
}

interface Player {
  id: string
  name: string
  team: string
  position: string
  contract?: PlayerContract | null
}

interface RosterEntry {
  id: string
  player: Player
  acquisitionPrice: number
  memberId?: string
  memberUsername?: string
}

interface LeagueMember {
  id: string
  currentBudget: number
  user: { username: string }
}

interface TradeOffer {
  id: string
  offeredPlayerIds: string[]
  requestedPlayerIds: string[]
  offeredBudget: number
  requestedBudget: number
  message?: string
  status: string
  createdAt: string
  expiresAt?: string
  fromMember?: { user: { username: string } }
  toMember?: { user: { username: string } }
  // API returns these for sent offers and history:
  sender?: { id: string; username: string }
  receiver?: { id: string; username: string }
  offeredPlayerDetails?: Player[]
  requestedPlayerDetails?: Player[]
  // API returns these for received offers:
  offeredPlayers?: Player[]
  requestedPlayers?: Player[]
}

// Helper per calcolare il tempo rimanente
function getTimeRemaining(expiresAt: string | undefined): { text: string; isUrgent: boolean; isExpired: boolean } {
  if (!expiresAt) return { text: 'Nessuna scadenza', isUrgent: false, isExpired: false }

  const now = new Date()
  const expires = new Date(expiresAt)
  const diffMs = expires.getTime() - now.getTime()

  if (diffMs <= 0) {
    return { text: 'Scaduta', isUrgent: true, isExpired: true }
  }

  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    return { text: `${days}g ${hours % 24}h`, isUrgent: false, isExpired: false }
  } else if (hours >= 1) {
    return { text: `${hours}h ${minutes}m`, isUrgent: hours < 6, isExpired: false }
  } else {
    return { text: `${minutes}m`, isUrgent: true, isExpired: false }
  }
}

interface MarketSession {
  id: string
  currentPhase: string
  status: string
}

// Helper per ottenere il colore del ruolo
function getRoleStyle(position: string) {
  switch (position) {
    case 'P': return { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/40', label: 'POR' }
    case 'D': return { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/40', label: 'DIF' }
    case 'C': return { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/40', label: 'CEN' }
    case 'A': return { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/40', label: 'ATT' }
    default: return { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/40', label: position }
  }
}

// Componente logo squadra
function TeamLogo({ team, size = 'md' }: { team: string, size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = size === 'sm' ? 'w-5 h-5' : size === 'lg' ? 'w-10 h-10' : 'w-7 h-7'
  return (
    <img
      src={getTeamLogo(team)}
      alt={team}
      className={`${sizeClass} object-contain`}
      onError={(e) => {
        // Fallback to text if image fails to load
        (e.target as HTMLImageElement).style.display = 'none'
      }}
    />
  )
}

// Componente per visualizzare un giocatore con tutte le info
function PlayerCard({ player, compact = false }: { player: Player, compact?: boolean }) {
  const roleStyle = getRoleStyle(player.position)

  if (compact) {
    return (
      <div className="flex items-center gap-2 py-1.5">
        <TeamLogo team={player.team} size="sm" />
        <span className={`w-8 h-5 flex items-center justify-center text-[10px] font-bold rounded ${roleStyle.bg} ${roleStyle.text} ${roleStyle.border} border`}>
          {roleStyle.label}
        </span>
        <span className="text-white font-medium text-sm">{player.name}</span>
        {player.contract ? (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-accent-400">{player.contract.salary}M</span>
            <span className="text-xs text-gray-500">|</span>
            <span className="text-xs text-warning-400" title="Clausola Rubata">
              R: {player.contract.rescissionClause || '-'}M
            </span>
          </div>
        ) : (
          <span className="text-xs text-gray-600 italic ml-auto">n.d.</span>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-surface-200/50 rounded-lg border border-surface-50/20 hover:border-surface-50/40 transition-colors">
      {/* Team Logo */}
      <div className="w-10 h-10 flex items-center justify-center bg-white/10 rounded-lg p-1">
        <TeamLogo team={player.team} size="md" />
      </div>
      {/* Role Badge */}
      <div className={`w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-lg ${roleStyle.bg} ${roleStyle.border} border`}>
        <span className={`text-sm font-bold ${roleStyle.text}`}>{roleStyle.label}</span>
      </div>
      {/* Player Info */}
      <div className="flex-1 min-w-0">
        <p className="text-white font-medium truncate">{player.name}</p>
        <p className="text-gray-500 text-xs">{player.team}</p>
      </div>
      {/* Contract Info */}
      <div className="text-right flex-shrink-0">
        {player.contract ? (
          <div className="space-y-0.5">
            <div className="flex items-center justify-end gap-2">
              <span className="text-accent-400 font-semibold text-sm">{player.contract.salary}M</span>
              <span className="text-gray-600">•</span>
              <span className="text-gray-400 text-xs">{player.contract.duration}sem</span>
            </div>
            <div className="flex items-center justify-end gap-1">
              <span className="text-[10px] text-gray-500 uppercase">Rubata:</span>
              <span className="text-warning-400 font-medium text-xs">
                {player.contract.rescissionClause ? `${player.contract.rescissionClause}M` : '-'}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-gray-600 text-xs italic">Contratto n.d.</p>
        )}
      </div>
    </div>
  )
}

// Helper component to render players in table format (for offers display)
function PlayersTable({ players }: { players: Player[] }) {
  if (!players || players.length === 0) return null

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-gray-500 text-[10px] uppercase">
          <th className="text-left font-medium pb-1">Giocatore</th>
          <th className="text-center font-medium pb-1 w-10">Ruolo</th>
          <th className="text-center font-medium pb-1 w-10">Ing.</th>
          <th className="text-center font-medium pb-1 w-8">Dur.</th>
          <th className="text-center font-medium pb-1 w-12">Claus.</th>
        </tr>
      </thead>
      <tbody>
        {players.map(p => {
          const roleStyle = getRoleStyle(p.position)
          return (
            <tr key={p.id} className="border-t border-surface-50/10">
              <td className="py-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 bg-white/90 rounded flex items-center justify-center flex-shrink-0">
                    <img src={getTeamLogo(p.team)} alt={p.team} className="w-4 h-4 object-contain" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-gray-200 truncate block">{p.name}</span>
                    <span className="text-[9px] text-gray-500 truncate block">{p.team}</span>
                  </div>
                </div>
              </td>
              <td className="text-center">
                <span className={`inline-block px-1.5 py-0.5 text-[9px] font-bold rounded ${roleStyle.bg} ${roleStyle.text}`}>
                  {roleStyle.label}
                </span>
              </td>
              <td className="text-center text-accent-400 font-semibold">{p.contract?.salary ?? '-'}</td>
              <td className="text-center text-white">{p.contract?.duration ?? '-'}</td>
              <td className="text-center text-warning-400">{p.contract?.rescissionClause ?? '-'}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export function Trades({ leagueId, onNavigate, highlightOfferId }: TradesProps) {
  const [isLoading, setIsLoading] = useState(true)
  // If we have a highlighted offer, start on 'received' tab
  const [activeTab, setActiveTab] = useState<'received' | 'sent' | 'create' | 'history'>(highlightOfferId ? 'received' : 'create')
  const [highlightedOfferId, setHighlightedOfferId] = useState<string | undefined>(highlightOfferId)
  const [isLeagueAdmin, setIsLeagueAdmin] = useState(false)

  // Data
  const [receivedOffers, setReceivedOffers] = useState<TradeOffer[]>([])
  const [sentOffers, setSentOffers] = useState<TradeOffer[]>([])
  const [tradeHistory, setTradeHistory] = useState<TradeOffer[]>([])
  const [members, setMembers] = useState<LeagueMember[]>([])
  const [myRoster, setMyRoster] = useState<RosterEntry[]>([])
  const [allOtherPlayers, setAllOtherPlayers] = useState<RosterEntry[]>([])
  const [myBudget, setMyBudget] = useState(0)
  const [isInTradePhase, setIsInTradePhase] = useState(false)
  const [currentSession, setCurrentSession] = useState<MarketSession | null>(null)

  // Create offer form
  const [selectedMemberId, setSelectedMemberId] = useState('')
  const [selectedOfferedPlayers, setSelectedOfferedPlayers] = useState<string[]>([])
  const [selectedRequestedPlayers, setSelectedRequestedPlayers] = useState<string[]>([])
  const [offeredBudget, setOfferedBudget] = useState(0)
  const [requestedBudget, setRequestedBudget] = useState(0)
  const [message, setMessage] = useState('')
  const [offerDuration, setOfferDuration] = useState(24) // Default 24 hours
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Search filters for create offer
  const [searchQuery, setSearchQuery] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [filterManager, setFilterManager] = useState('')

  // Contract modification after trade acceptance
  interface ReceivedPlayerForModification {
    rosterId: string
    contractId?: string
    playerId: string
    playerName: string
    playerTeam: string
    playerPosition: string
    contract: {
      salary: number
      duration: number
      initialSalary: number
      rescissionClause: number
    } | null
  }
  const [pendingContractModifications, setPendingContractModifications] = useState<ReceivedPlayerForModification[]>([])
  const [currentModificationIndex, setCurrentModificationIndex] = useState(0)
  const [isModifyingContract, setIsModifyingContract] = useState(false)

  useEffect(() => {
    loadData()
  }, [leagueId])

  // Scroll to highlighted offer and clear highlight after a few seconds
  useEffect(() => {
    if (highlightedOfferId && !isLoading) {
      const element = document.getElementById(`offer-${highlightedOfferId}`)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      // Clear highlight after 5 seconds
      const timer = setTimeout(() => {
        setHighlightedOfferId(undefined)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [highlightedOfferId, isLoading])

  async function loadData() {
    setIsLoading(true)

    // Load all data in parallel
    const [receivedRes, sentRes, historyRes, membersRes, rosterRes, sessionsRes, leagueRes, allRostersRes] = await Promise.all([
      tradeApi.getReceived(leagueId),
      tradeApi.getSent(leagueId),
      tradeApi.getHistory(leagueId),
      leagueApi.getMembers(leagueId),
      auctionApi.getRoster(leagueId),
      auctionApi.getSessions(leagueId),
      leagueApi.getById(leagueId),
      auctionApi.getLeagueRosters(leagueId),
    ])

    if (leagueRes.success && leagueRes.data) {
      const data = leagueRes.data as { userMembership?: { role: string } }
      setIsLeagueAdmin(data.userMembership?.role === 'ADMIN')
    }

    if (receivedRes.success && receivedRes.data) {
      setReceivedOffers(receivedRes.data as TradeOffer[])
    }
    if (sentRes.success && sentRes.data) {
      setSentOffers(sentRes.data as TradeOffer[])
    }
    if (historyRes.success && historyRes.data) {
      setTradeHistory(historyRes.data as TradeOffer[])
    }

    // Get my member ID first
    const rosterData = rosterRes.data as { member?: { id: string, currentBudget: number } } | undefined
    const currentMemberId = rosterData?.member?.id || ''

    if (membersRes.success && membersRes.data) {
      const allMembers = (membersRes.data as { members: LeagueMember[] }).members || []
      setMembers(allMembers.filter(m => m.id !== currentMemberId))
    }

    if (rosterRes.success && rosterRes.data) {
      interface RosterApiEntry {
        id: string
        player: { id: string; name: string; team: string; position: string }
        contract?: { salary: number; duration: number; rescissionClause?: number } | null
        acquisitionPrice: number
      }
      const data = rosterRes.data as {
        member: { currentBudget: number }
        roster: { P: RosterApiEntry[], D: RosterApiEntry[], C: RosterApiEntry[], A: RosterApiEntry[] }
      }
      setMyBudget(data.member.currentBudget)
      // Map roster entries to include contract inside player
      const mapEntry = (r: RosterApiEntry): RosterEntry => ({
        id: r.id,
        player: {
          id: r.player.id,
          name: r.player.name,
          team: r.player.team,
          position: r.player.position,
          contract: r.contract,
        },
        acquisitionPrice: r.acquisitionPrice,
      })
      const allPlayers = [
        ...data.roster.P.map(mapEntry),
        ...data.roster.D.map(mapEntry),
        ...data.roster.C.map(mapEntry),
        ...data.roster.A.map(mapEntry),
      ]
      setMyRoster(allPlayers)
    }

    // Load all other players from all rosters
    // Handle both formats: { data: [...] } (auctions.ts) and { data: { members: [...] } } (leagues.ts)
    if (allRostersRes.success && allRostersRes.data) {
      let rostersData: Array<{
        id?: string
        memberId?: string
        username?: string
        user?: { username: string }
        roster?: Array<{
          id: string
          player: { id: string; name: string; position: string; team: string }
          contract?: { salary: number; duration: number; rescissionClause?: number } | null
        }>
        players?: Array<{
          id: string
          rosterId: string
          name: string
          position: string
          team: string
          contract?: { salary: number; duration: number; rescissionClause?: number } | null
        }>
      }> = []

      // Check which format we received
      if (Array.isArray(allRostersRes.data)) {
        // Format from auctions.ts: data is array directly
        rostersData = allRostersRes.data
      } else if ((allRostersRes.data as { members?: unknown }).members) {
        // Format from leagues.ts: data.members is the array
        rostersData = (allRostersRes.data as { members: typeof rostersData }).members
      }

      const otherPlayers: RosterEntry[] = []
      for (const memberRoster of rostersData) {
        const memberId = memberRoster.memberId || memberRoster.id || ''
        const username = memberRoster.username || memberRoster.user?.username || ''

        if (memberId === currentMemberId) continue

        // Handle both player formats
        const players = memberRoster.players || memberRoster.roster?.map(r => ({
          id: r.player.id,
          rosterId: r.id,
          name: r.player.name,
          position: r.player.position,
          team: r.player.team,
          contract: r.contract,
        })) || []

        for (const p of players) {
          otherPlayers.push({
            id: p.rosterId || p.id,
            player: {
              id: p.id,
              name: p.name,
              position: p.position,
              team: p.team,
              contract: p.contract,
            },
            acquisitionPrice: 0,
            memberId: memberId,
            memberUsername: username,
          })
        }
      }
      setAllOtherPlayers(otherPlayers)
    }

    if (sessionsRes.success && sessionsRes.data) {
      const sessions = sessionsRes.data as MarketSession[]
      const active = sessions.find(s => s.status === 'ACTIVE')
      setCurrentSession(active || null)
      setIsInTradePhase(
        !!active &&
        (active.currentPhase === 'OFFERTE_PRE_RINNOVO' || active.currentPhase === 'OFFERTE_POST_ASTA_SVINCOLATI')
      )
    }

    setIsLoading(false)
  }

  // Helper to select a requested player and auto-set the target member
  function handleSelectRequestedPlayer(entry: RosterEntry) {
    if (!entry.memberId) return

    // If no member selected yet, or same member, just toggle the player
    if (!selectedMemberId || selectedMemberId === entry.memberId) {
      setSelectedMemberId(entry.memberId)
      if (selectedRequestedPlayers.includes(entry.id)) {
        setSelectedRequestedPlayers(selectedRequestedPlayers.filter(id => id !== entry.id))
      } else {
        setSelectedRequestedPlayers([...selectedRequestedPlayers, entry.id])
      }
    } else {
      // Different member - ask to switch or ignore
      // For simplicity, we'll switch to new member and reset requested players
      setSelectedMemberId(entry.memberId)
      setSelectedRequestedPlayers([entry.id])
    }
  }

  // Filter other players based on search criteria
  const filteredOtherPlayers = allOtherPlayers.filter(entry => {
    // Filter by selected member if already selected
    if (selectedMemberId && entry.memberId !== selectedMemberId) return false

    // Filter by DG dropdown
    if (filterManager && entry.memberId !== filterManager) return false

    // Filter by role
    if (filterRole && entry.player.position !== filterRole) return false

    // Filter by search query (name or team)
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      if (!entry.player.name.toLowerCase().includes(query) &&
          !entry.player.team.toLowerCase().includes(query)) {
        return false
      }
    }

    return true
  })

  // Get target member info
  const targetMember = members.find(m => m.id === selectedMemberId)

  async function handleCreateOffer(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setIsSubmitting(true)

    const res = await tradeApi.create(leagueId, {
      toMemberId: selectedMemberId,
      offeredPlayerIds: selectedOfferedPlayers,
      requestedPlayerIds: selectedRequestedPlayers,
      offeredBudget,
      requestedBudget,
      message: message || undefined,
      durationHours: offerDuration,
    })

    if (res.success) {
      setSuccess('Offerta inviata!')
      // Reset form
      setSelectedMemberId('')
      setSelectedOfferedPlayers([])
      setSelectedRequestedPlayers([])
      setOfferedBudget(0)
      setRequestedBudget(0)
      setMessage('')
      setOfferDuration(24)
      setSearchQuery('')
      setFilterRole('')
      setFilterManager('')
      // Reload sent offers
      const sentRes = await tradeApi.getSent(leagueId)
      if (sentRes.success && sentRes.data) {
        setSentOffers(sentRes.data as TradeOffer[])
      }
      setActiveTab('sent')
    } else {
      setError(res.message || 'Errore durante l\'invio dell\'offerta')
    }

    setIsSubmitting(false)
  }

  async function handleAccept(tradeId: string) {
    const res = await tradeApi.accept(tradeId)
    if (res.success) {
      // #135: I contratti dei giocatori ricevuti NON vengono modificati
      // Il contratto rimane quello originale - la modifica avverrà nella fase CONTRATTI
      setSuccess('Scambio accettato! I contratti dei giocatori ricevuti saranno modificabili nella fase di rinnovo contratti.')
      loadData()
    } else {
      alert(res.message || 'Errore')
    }
  }

  // Get current player for contract modification
  const currentPlayerForModification = pendingContractModifications[currentModificationIndex]

  async function handleContractModification(newSalary: number, newDuration: number) {
    if (!currentPlayerForModification?.contractId) return

    const res = await contractApi.modify(currentPlayerForModification.contractId, newSalary, newDuration)

    if (res.success) {
      // Move to next player or finish
      if (currentModificationIndex < pendingContractModifications.length - 1) {
        setCurrentModificationIndex(currentModificationIndex + 1)
      } else {
        // All done
        setIsModifyingContract(false)
        setPendingContractModifications([])
        setCurrentModificationIndex(0)
        loadData()
      }
    } else {
      alert(res.message || 'Errore durante la modifica del contratto')
    }
  }

  function handleSkipContractModification() {
    // Move to next player or finish
    if (currentModificationIndex < pendingContractModifications.length - 1) {
      setCurrentModificationIndex(currentModificationIndex + 1)
    } else {
      // All done
      setIsModifyingContract(false)
      setPendingContractModifications([])
      setCurrentModificationIndex(0)
      loadData()
    }
  }

  async function handleReject(tradeId: string) {
    const res = await tradeApi.reject(tradeId)
    if (res.success) {
      loadData()
    } else {
      alert(res.message || 'Errore')
    }
  }

  async function handleCancel(tradeId: string) {
    const res = await tradeApi.cancel(tradeId)
    if (res.success) {
      loadData()
    } else {
      alert(res.message || 'Errore')
    }
  }

  function togglePlayer(list: string[], setList: (l: string[]) => void, playerId: string) {
    if (list.includes(playerId)) {
      setList(list.filter(id => id !== playerId))
    } else {
      setList([...list, playerId])
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-300">
        <Navigation currentPage="trades" leagueId={leagueId} isLeagueAdmin={isLeagueAdmin} onNavigate={onNavigate} />
        <div className="flex items-center justify-center h-[80vh]">
          <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark-300">
      <Navigation currentPage="trades" leagueId={leagueId} isLeagueAdmin={isLeagueAdmin} onNavigate={onNavigate} />

      <main className="max-w-[1600px] mx-auto px-4 py-8">
        {/* Phase Status */}
        <Card className="mb-6">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-white">Fase corrente</p>
                <p className={`text-sm ${isInTradePhase ? 'text-secondary-400' : 'text-gray-400'}`}>
                  {currentSession ? currentSession.currentPhase : 'Nessuna sessione attiva'}
                </p>
              </div>
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                isInTradePhase
                  ? 'bg-secondary-500/20 text-secondary-400 border border-secondary-500/40'
                  : 'bg-surface-300 text-gray-400'
              }`}>
                {isInTradePhase ? 'Scambi Attivi' : 'Scambi Non Disponibili'}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <Button
            variant={activeTab === 'create' ? 'primary' : 'outline'}
            onClick={() => setActiveTab('create')}
            disabled={!isInTradePhase}
          >
            + Nuova Offerta
          </Button>
          <Button
            variant={activeTab === 'received' ? 'primary' : 'outline'}
            onClick={() => setActiveTab('received')}
          >
            Ricevute ({receivedOffers.length})
          </Button>
          <Button
            variant={activeTab === 'sent' ? 'primary' : 'outline'}
            onClick={() => setActiveTab('sent')}
          >
            Inviate ({sentOffers.length})
          </Button>
          <Button
            variant={activeTab === 'history' ? 'primary' : 'outline'}
            onClick={() => setActiveTab('history')}
          >
            Storico
          </Button>
        </div>

        {/* Received Offers */}
        {activeTab === 'received' && (
          <div className="space-y-6">
            {receivedOffers.length === 0 ? (
              <Card className="border-dashed border-2 border-surface-50/30">
                <CardContent className="py-12 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-300 flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                  </div>
                  <p className="text-gray-500 text-lg">Nessuna offerta ricevuta</p>
                  <p className="text-gray-600 text-sm mt-1">Le offerte che riceverai appariranno qui</p>
                </CardContent>
              </Card>
            ) : (
              receivedOffers.map(offer => {
                const timeRemaining = getTimeRemaining(offer.expiresAt)
                const isHighlighted = offer.id === highlightedOfferId
                return (
                <Card
                  key={offer.id}
                  id={`offer-${offer.id}`}
                  className={`overflow-hidden border-l-4 ${isHighlighted ? 'border-l-primary-500 ring-2 ring-primary-500/50 bg-primary-500/5' : 'border-l-accent-500'}`}
                >
                  {/* Header */}
                  <div className="bg-gradient-to-r from-surface-200 to-transparent px-5 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-accent-500/20 flex items-center justify-center">
                        <span className="text-accent-400 font-bold text-sm">
                          {(offer.sender?.username?.[0] || offer.fromMember?.user?.username?.[0] || '?').toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold text-white">{offer.sender?.username || offer.fromMember?.user?.username}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(offer.createdAt).toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Timer scadenza */}
                      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                        timeRemaining.isExpired
                          ? 'bg-danger-500/20 text-danger-400 border border-danger-500/40'
                          : timeRemaining.isUrgent
                            ? 'bg-warning-500/20 text-warning-400 border border-warning-500/40'
                            : 'bg-surface-300 text-gray-400 border border-surface-50/30'
                      }`}>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{timeRemaining.text}</span>
                      </div>
                      <span className="px-3 py-1.5 bg-accent-500/20 text-accent-400 text-xs font-semibold rounded-full border border-accent-500/40 uppercase tracking-wide">
                        In attesa
                      </span>
                    </div>
                  </div>

                  <CardContent className="py-5">
                    {/* Trade visualization */}
                    <div className="grid md:grid-cols-2 gap-6">
                      {/* What you receive */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-secondary-500/20 flex items-center justify-center">
                            <svg className="w-3 h-3 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                            </svg>
                          </div>
                          <p className="text-sm font-semibold text-secondary-400 uppercase tracking-wide">Riceveresti</p>
                        </div>
                        <div className="pl-8">
                          <PlayersTable players={offer.offeredPlayerDetails || offer.offeredPlayers || []} />
                          {offer.offeredBudget > 0 && (
                            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-surface-50/20">
                              <div className="w-6 h-6 rounded bg-secondary-500/20 flex items-center justify-center">
                                <span className="text-secondary-400 font-bold text-xs">€</span>
                              </div>
                              <span className="text-sm text-secondary-400 font-medium">+ {offer.offeredBudget} crediti</span>
                            </div>
                          )}
                          {(!offer.offeredPlayerDetails?.length && !offer.offeredPlayers?.length && offer.offeredBudget === 0) && (
                            <p className="text-gray-600 text-sm italic py-2">Nessun giocatore o credito offerto</p>
                          )}
                        </div>
                      </div>

                      {/* What you give */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-danger-500/20 flex items-center justify-center">
                            <svg className="w-3 h-3 text-danger-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                            </svg>
                          </div>
                          <p className="text-sm font-semibold text-danger-400 uppercase tracking-wide">Cederesti</p>
                        </div>
                        <div className="pl-8">
                          <PlayersTable players={offer.requestedPlayerDetails || offer.requestedPlayers || []} />
                          {offer.requestedBudget > 0 && (
                            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-surface-50/20">
                              <div className="w-6 h-6 rounded bg-danger-500/20 flex items-center justify-center">
                                <span className="text-danger-400 font-bold text-xs">€</span>
                              </div>
                              <span className="text-sm text-danger-400 font-medium">+ {offer.requestedBudget} crediti</span>
                            </div>
                          )}
                          {(!offer.requestedPlayerDetails?.length && !offer.requestedPlayers?.length && offer.requestedBudget === 0) && (
                            <p className="text-gray-600 text-sm italic py-2">Nessun giocatore o credito richiesto</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Message */}
                    {offer.message && (
                      <div className="mt-5 p-4 bg-surface-200/50 rounded-lg border-l-2 border-gray-500">
                        <p className="text-sm text-gray-400 italic">"{offer.message}"</p>
                      </div>
                    )}

                    {/* Actions */}
                    {isInTradePhase && !timeRemaining.isExpired && (
                      <div className="flex gap-3 mt-6 pt-5 border-t border-surface-50/20">
                        <Button variant="primary" onClick={() => handleAccept(offer.id)} className="flex-1">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Accetta Scambio
                        </Button>
                        <Button variant="outline" onClick={() => handleReject(offer.id)} className="flex-1">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Rifiuta
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )})
            )}
          </div>
        )}

        {/* Sent Offers */}
        {activeTab === 'sent' && (
          <div className="space-y-6">
            {sentOffers.length === 0 ? (
              <Card className="border-dashed border-2 border-surface-50/30">
                <CardContent className="py-12 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-300 flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </div>
                  <p className="text-gray-500 text-lg">Nessuna offerta inviata</p>
                  <p className="text-gray-600 text-sm mt-1">Le tue offerte appariranno qui</p>
                </CardContent>
              </Card>
            ) : (
              sentOffers.map(offer => {
                const timeRemaining = getTimeRemaining(offer.expiresAt)
                return (
                <Card key={offer.id} className="overflow-hidden border-l-4 border-l-primary-500">
                  {/* Header */}
                  <div className="bg-gradient-to-r from-surface-200 to-transparent px-5 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary-500/20 flex items-center justify-center">
                        <span className="text-primary-400 font-bold text-sm">
                          {(offer.receiver?.username?.[0] || offer.toMember?.user?.username?.[0] || '?').toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold text-white">A: {offer.receiver?.username || offer.toMember?.user?.username}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(offer.createdAt).toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Timer scadenza */}
                      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                        timeRemaining.isExpired
                          ? 'bg-danger-500/20 text-danger-400 border border-danger-500/40'
                          : timeRemaining.isUrgent
                            ? 'bg-warning-500/20 text-warning-400 border border-warning-500/40'
                            : 'bg-surface-300 text-gray-400 border border-surface-50/30'
                      }`}>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{timeRemaining.text}</span>
                      </div>
                      <span className={`px-3 py-1.5 text-xs font-semibold rounded-full uppercase tracking-wide border ${
                        offer.status === 'PENDING'
                          ? 'bg-accent-500/20 text-accent-400 border-accent-500/40'
                          : 'bg-primary-500/20 text-primary-400 border-primary-500/40'
                      }`}>
                        {offer.status === 'PENDING' ? 'In attesa' : 'Controfferta'}
                      </span>
                    </div>
                  </div>

                  <CardContent className="py-5">
                    {/* Trade visualization */}
                    <div className="grid md:grid-cols-2 gap-6">
                      {/* What you offer */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-danger-500/20 flex items-center justify-center">
                            <svg className="w-3 h-3 text-danger-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                            </svg>
                          </div>
                          <p className="text-sm font-semibold text-danger-400 uppercase tracking-wide">Offri</p>
                        </div>
                        <div className="pl-8">
                          <PlayersTable players={offer.offeredPlayerDetails || offer.offeredPlayers || []} />
                          {offer.offeredBudget > 0 && (
                            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-surface-50/20">
                              <div className="w-6 h-6 rounded bg-danger-500/20 flex items-center justify-center">
                                <span className="text-danger-400 font-bold text-xs">€</span>
                              </div>
                              <span className="text-sm text-danger-400 font-medium">+ {offer.offeredBudget} crediti</span>
                            </div>
                          )}
                          {(!offer.offeredPlayerDetails?.length && !offer.offeredPlayers?.length && offer.offeredBudget === 0) && (
                            <p className="text-gray-600 text-sm italic py-2">Nessun giocatore o credito offerto</p>
                          )}
                        </div>
                      </div>

                      {/* What you request */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-secondary-500/20 flex items-center justify-center">
                            <svg className="w-3 h-3 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                            </svg>
                          </div>
                          <p className="text-sm font-semibold text-secondary-400 uppercase tracking-wide">Richiedi</p>
                        </div>
                        <div className="pl-8">
                          <PlayersTable players={offer.requestedPlayerDetails || offer.requestedPlayers || []} />
                          {offer.requestedBudget > 0 && (
                            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-surface-50/20">
                              <div className="w-6 h-6 rounded bg-secondary-500/20 flex items-center justify-center">
                                <span className="text-secondary-400 font-bold text-xs">€</span>
                              </div>
                              <span className="text-sm text-secondary-400 font-medium">+ {offer.requestedBudget} crediti</span>
                            </div>
                          )}
                          {(!offer.requestedPlayerDetails?.length && !offer.requestedPlayers?.length && offer.requestedBudget === 0) && (
                            <p className="text-gray-600 text-sm italic py-2">Nessun giocatore o credito richiesto</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Cancel button */}
                    {offer.status === 'PENDING' && !timeRemaining.isExpired && (
                      <div className="mt-6 pt-5 border-t border-surface-50/20">
                        <Button variant="outline" onClick={() => handleCancel(offer.id)} className="text-danger-400 border-danger-500/40 hover:bg-danger-500/10">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Annulla Offerta
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )})
            )}
          </div>
        )}

        {/* Create Offer */}
        {activeTab === 'create' && (
          <div className="space-y-6">
            {!isInTradePhase ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-accent-400">
                    Puoi creare offerte solo durante la fase SCAMBI/OFFERTE
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Budget Overview - Always Visible */}
                <Card className="bg-gradient-to-r from-surface-200 to-surface-300 border-accent-500/30">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-accent-500/20 flex items-center justify-center">
                          <span className="text-accent-400 font-bold text-lg">€</span>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide">Il tuo budget disponibile</p>
                          <p className="text-3xl font-bold text-accent-400">{myBudget} <span className="text-lg text-gray-500">crediti</span></p>
                        </div>
                      </div>
                      {selectedMemberId && targetMember && (
                        <div className="flex items-center gap-4 pl-6 border-l border-surface-50/30">
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide text-right">Budget di {targetMember.user.username}</p>
                            <p className="text-3xl font-bold text-primary-400 text-right">{targetMember.currentBudget} <span className="text-lg text-gray-500">crediti</span></p>
                          </div>
                          <div className="w-12 h-12 rounded-full bg-primary-500/20 flex items-center justify-center">
                            <span className="text-primary-400 font-bold text-lg">€</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {error && (
                  <div className="bg-danger-500/20 border border-danger-500/50 text-danger-400 p-3 rounded">
                    {error}
                  </div>
                )}
                {success && (
                  <div className="bg-secondary-500/20 border border-secondary-500/50 text-secondary-400 p-3 rounded">
                    {success}
                  </div>
                )}

                {/* Target Member Info */}
                {selectedMemberId && targetMember && (
                  <Card className="border-primary-500/50">
                    <CardContent className="py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary-500/20 flex items-center justify-center">
                            <span className="text-primary-400 font-bold">
                              {(targetMember.user.username?.[0] || '?').toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Offerta destinata a:</p>
                            <p className="text-lg font-bold text-white">{targetMember.user.username}</p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedMemberId('')
                            setSelectedRequestedPlayers([])
                            setFilterManager('')
                          }}
                        >
                          Cambia DG
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="grid lg:grid-cols-2 gap-6">
                  {/* Left Column - Search and Request Players */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Cerca Giocatori da Richiedere</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {/* Search Filters */}
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        <div>
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Nome o squadra..."
                            className="w-full px-3 py-2 bg-surface-300 border border-surface-50/30 rounded-lg text-white text-sm focus:border-primary-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <select
                            value={filterRole}
                            onChange={e => setFilterRole(e.target.value)}
                            className="w-full px-3 py-2 bg-surface-300 border border-surface-50/30 rounded-lg text-white text-sm focus:border-primary-500 focus:outline-none"
                          >
                            <option value="">Tutti i ruoli</option>
                            <option value="P">Portieri</option>
                            <option value="D">Difensori</option>
                            <option value="C">Centrocampisti</option>
                            <option value="A">Attaccanti</option>
                          </select>
                        </div>
                        <div>
                          <select
                            value={selectedMemberId || filterManager}
                            onChange={e => {
                              const newMemberId = e.target.value
                              setFilterManager(newMemberId)
                              if (newMemberId !== selectedMemberId) {
                                // Cambio DG: resetta i giocatori richiesti
                                setSelectedMemberId(newMemberId)
                                setSelectedRequestedPlayers([])
                              }
                            }}
                            className="w-full px-3 py-2 bg-surface-300 border border-surface-50/30 rounded-lg text-white text-sm focus:border-primary-500 focus:outline-none"
                          >
                            <option value="">Tutti i DG</option>
                            {members.map(m => (
                              <option key={m.id} value={m.id}>{m.user.username}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Players List */}
                      <div className="max-h-96 overflow-y-auto border border-surface-50/30 rounded-lg bg-surface-300">
                        {filteredOtherPlayers.length === 0 ? (
                          <p className="text-gray-500 text-sm p-4 text-center">
                            {selectedMemberId ? 'Nessun giocatore trovato' : 'Cerca o seleziona un DG'}
                          </p>
                        ) : (
                          <table className="w-full text-xs">
                            <thead className="sticky top-0 bg-surface-300 z-10">
                              <tr className="text-gray-500 text-[10px] uppercase">
                                <th className="text-left font-medium py-2 px-2 w-6"></th>
                                <th className="text-left font-medium py-2">Giocatore</th>
                                <th className="text-center font-medium py-2 w-10">Ruolo</th>
                                <th className="text-center font-medium py-2 w-10">Ing.</th>
                                <th className="text-center font-medium py-2 w-8">Dur.</th>
                                <th className="text-center font-medium py-2 w-12">Claus.</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredOtherPlayers.map(entry => {
                                const roleStyle = getRoleStyle(entry.player.position)
                                const isSelected = selectedRequestedPlayers.includes(entry.id)
                                return (
                                  <tr
                                    key={entry.id}
                                    onClick={() => handleSelectRequestedPlayer(entry)}
                                    className={`cursor-pointer hover:bg-surface-200 border-t border-surface-50/10 transition-colors ${
                                      isSelected ? 'bg-primary-500/20' : ''
                                    }`}
                                  >
                                    <td className="py-2 px-2 text-center">
                                      {isSelected && <span className="text-primary-400 font-bold">✓</span>}
                                    </td>
                                    <td className="py-2">
                                      <div className="flex items-center gap-1.5">
                                        <div className="w-5 h-5 bg-white/90 rounded flex items-center justify-center flex-shrink-0">
                                          <img src={getTeamLogo(entry.player.team)} alt={entry.player.team} className="w-4 h-4 object-contain" />
                                        </div>
                                        <div className="min-w-0">
                                          <span className="text-gray-200 truncate block text-xs">{entry.player.name}</span>
                                          <span className="text-[9px] text-gray-500 truncate block">{entry.memberUsername}</span>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="text-center">
                                      <span className={`inline-block px-1.5 py-0.5 text-[9px] font-bold rounded ${roleStyle.bg} ${roleStyle.text}`}>
                                        {roleStyle.label}
                                      </span>
                                    </td>
                                    <td className="text-center text-accent-400 font-semibold">{entry.player.contract?.salary ?? '-'}</td>
                                    <td className="text-center text-white">{entry.player.contract?.duration ?? '-'}</td>
                                    <td className="text-center text-warning-400">{entry.player.contract?.rescissionClause ?? '-'}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>

                      {/* Selected count */}
                      {selectedRequestedPlayers.length > 0 && (
                        <p className="text-sm text-primary-400 mt-2">
                          {selectedRequestedPlayers.length} giocatore/i selezionato/i
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Right Column - My Players to Offer */}
                  <Card>
                    <CardHeader>
                      <CardTitle>I Tuoi Giocatori da Offrire</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="max-h-96 overflow-y-auto border border-surface-50/30 rounded-lg bg-surface-300">
                        {myRoster.length === 0 ? (
                          <p className="text-gray-500 text-sm p-4 text-center">Nessun giocatore in rosa</p>
                        ) : (
                          <table className="w-full text-xs">
                            <thead className="sticky top-0 bg-surface-300 z-10">
                              <tr className="text-gray-500 text-[10px] uppercase">
                                <th className="text-left font-medium py-2 px-2 w-6"></th>
                                <th className="text-left font-medium py-2">Giocatore</th>
                                <th className="text-center font-medium py-2 w-10">Ruolo</th>
                                <th className="text-center font-medium py-2 w-10">Ing.</th>
                                <th className="text-center font-medium py-2 w-8">Dur.</th>
                                <th className="text-center font-medium py-2 w-12">Claus.</th>
                              </tr>
                            </thead>
                            <tbody>
                              {myRoster.map(entry => {
                                const roleStyle = getRoleStyle(entry.player.position)
                                const isSelected = selectedOfferedPlayers.includes(entry.id)
                                return (
                                  <tr
                                    key={entry.id}
                                    onClick={() => togglePlayer(selectedOfferedPlayers, setSelectedOfferedPlayers, entry.id)}
                                    className={`cursor-pointer hover:bg-surface-200 border-t border-surface-50/10 transition-colors ${
                                      isSelected ? 'bg-danger-500/20' : ''
                                    }`}
                                  >
                                    <td className="py-2 px-2 text-center">
                                      {isSelected && <span className="text-danger-400 font-bold">✓</span>}
                                    </td>
                                    <td className="py-2">
                                      <div className="flex items-center gap-1.5">
                                        <div className="w-5 h-5 bg-white/90 rounded flex items-center justify-center flex-shrink-0">
                                          <img src={getTeamLogo(entry.player.team)} alt={entry.player.team} className="w-4 h-4 object-contain" />
                                        </div>
                                        <div className="min-w-0">
                                          <span className="text-gray-200 truncate block text-xs">{entry.player.name}</span>
                                          <span className="text-[9px] text-gray-500 truncate block">{entry.player.team}</span>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="text-center">
                                      <span className={`inline-block px-1.5 py-0.5 text-[9px] font-bold rounded ${roleStyle.bg} ${roleStyle.text}`}>
                                        {roleStyle.label}
                                      </span>
                                    </td>
                                    <td className="text-center text-accent-400 font-semibold">{entry.player.contract?.salary ?? '-'}</td>
                                    <td className="text-center text-white">{entry.player.contract?.duration ?? '-'}</td>
                                    <td className="text-center text-warning-400">{entry.player.contract?.rescissionClause ?? '-'}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>

                      {/* Selected count */}
                      {selectedOfferedPlayers.length > 0 && (
                        <p className="text-sm text-danger-400 mt-2">
                          {selectedOfferedPlayers.length} giocatore/i da cedere
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Budget, Duration and Message */}
                <Card>
                  <CardContent className="py-4">
                    <form onSubmit={handleCreateOffer}>
                      <div className="grid md:grid-cols-4 gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Crediti che offri (max: {myBudget})
                          </label>
                          <div className="flex items-center">
                            <button
                              type="button"
                              onClick={() => setOfferedBudget(Math.max(0, offeredBudget - 1))}
                              disabled={offeredBudget <= 0}
                              className="px-3 py-2 bg-surface-300 border border-danger-500/30 rounded-l-lg text-white font-bold disabled:opacity-30 hover:bg-surface-300/80 transition-colors"
                            >−</button>
                            <div className="flex-1 px-2 py-2 bg-surface-300 border-y border-danger-500/30 text-white text-center font-medium">
                              {offeredBudget}
                            </div>
                            <button
                              type="button"
                              onClick={() => setOfferedBudget(Math.min(myBudget, offeredBudget + 1))}
                              disabled={offeredBudget >= myBudget}
                              className="px-3 py-2 bg-surface-300 border border-danger-500/30 rounded-r-lg text-white font-bold disabled:opacity-30 hover:bg-surface-300/80 transition-colors"
                            >+</button>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Crediti che richiedi
                          </label>
                          <div className="flex items-center">
                            <button
                              type="button"
                              onClick={() => setRequestedBudget(Math.max(0, requestedBudget - 1))}
                              disabled={requestedBudget <= 0}
                              className="px-3 py-2 bg-surface-300 border border-primary-500/30 rounded-l-lg text-white font-bold disabled:opacity-30 hover:bg-surface-300/80 transition-colors"
                            >−</button>
                            <div className="flex-1 px-2 py-2 bg-surface-300 border-y border-primary-500/30 text-white text-center font-medium">
                              {requestedBudget}
                            </div>
                            <button
                              type="button"
                              onClick={() => setRequestedBudget(requestedBudget + 1)}
                              className="px-3 py-2 bg-surface-300 border border-primary-500/30 rounded-r-lg text-white font-bold hover:bg-surface-300/80 transition-colors"
                            >+</button>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Durata offerta
                          </label>
                          <div className="flex items-center">
                            <button
                              type="button"
                              onClick={() => {
                                const durations = [6, 12, 24, 48, 72, 168]
                                const currentIndex = durations.indexOf(offerDuration)
                                if (currentIndex > 0) setOfferDuration(durations[currentIndex - 1])
                              }}
                              disabled={offerDuration === 6}
                              className="px-3 py-2 bg-surface-300 border border-accent-500/30 rounded-l-lg text-white font-bold disabled:opacity-30 hover:bg-surface-300/80 transition-colors"
                            >−</button>
                            <div className="flex-1 px-2 py-2 bg-surface-300 border-y border-accent-500/30 text-white text-center font-medium text-sm">
                              {offerDuration < 24 ? `${offerDuration}h` : offerDuration === 24 ? '24h' : offerDuration === 48 ? '2gg' : offerDuration === 72 ? '3gg' : '7gg'}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const durations = [6, 12, 24, 48, 72, 168]
                                const currentIndex = durations.indexOf(offerDuration)
                                if (currentIndex < durations.length - 1) setOfferDuration(durations[currentIndex + 1])
                              }}
                              disabled={offerDuration === 168}
                              className="px-3 py-2 bg-surface-300 border border-accent-500/30 rounded-r-lg text-white font-bold disabled:opacity-30 hover:bg-surface-300/80 transition-colors"
                            >+</button>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">
                            Messaggio (opzionale)
                          </label>
                          <input
                            type="text"
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                            className="w-full px-3 py-2 bg-surface-300 border border-surface-50/30 rounded-lg text-white focus:border-primary-500 focus:outline-none"
                            placeholder="Aggiungi un messaggio..."
                          />
                        </div>
                      </div>

                      {/* Riepilogo Offerta */}
                      {(selectedOfferedPlayers.length > 0 || selectedRequestedPlayers.length > 0 || offeredBudget > 0 || requestedBudget > 0) && (
                        <div className="mb-4 p-4 bg-surface-300 rounded-lg border border-surface-50/30">
                          <p className="text-sm font-medium text-white mb-3">Riepilogo Offerta:</p>
                          <div className="grid md:grid-cols-2 gap-6">
                            {/* OFFRI */}
                            <div>
                              <p className="text-xs text-danger-400 font-semibold mb-2 uppercase tracking-wide">Offri</p>
                              {selectedOfferedPlayers.length > 0 ? (
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-gray-500 text-[10px] uppercase">
                                      <th className="text-left font-medium pb-1">Giocatore</th>
                                      <th className="text-center font-medium pb-1 w-10">Ruolo</th>
                                      <th className="text-center font-medium pb-1 w-10">Ing.</th>
                                      <th className="text-center font-medium pb-1 w-8">Dur.</th>
                                      <th className="text-center font-medium pb-1 w-12">Claus.</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {selectedOfferedPlayers.map(id => {
                                      const entry = myRoster.find(r => r.id === id)
                                      if (!entry) return null
                                      const roleStyle = getRoleStyle(entry.player.position)
                                      return (
                                        <tr key={id} className="border-t border-surface-50/10">
                                          <td className="py-1.5">
                                            <div className="flex items-center gap-1.5">
                                              <div className="w-5 h-5 bg-white/90 rounded flex items-center justify-center flex-shrink-0">
                                                <img src={getTeamLogo(entry.player.team)} alt={entry.player.team} className="w-4 h-4 object-contain" />
                                              </div>
                                              <div className="min-w-0">
                                                <span className="text-gray-200 truncate block">{entry.player.name}</span>
                                                <span className="text-[9px] text-gray-500 truncate block">{entry.player.team}</span>
                                              </div>
                                            </div>
                                          </td>
                                          <td className="text-center">
                                            <span className={`inline-block px-1.5 py-0.5 text-[9px] font-bold rounded ${roleStyle.bg} ${roleStyle.text}`}>
                                              {roleStyle.label}
                                            </span>
                                          </td>
                                          <td className="text-center text-accent-400 font-semibold">{entry.player.contract?.salary ?? '-'}</td>
                                          <td className="text-center text-white">{entry.player.contract?.duration ?? '-'}</td>
                                          <td className="text-center text-warning-400">{entry.player.contract?.rescissionClause ?? '-'}</td>
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                </table>
                              ) : (
                                <p className="text-sm text-gray-500 italic">Nessun giocatore</p>
                              )}
                              {offeredBudget > 0 && (
                                <div className="mt-2 pt-2 border-t border-surface-50/20 flex items-center gap-2">
                                  <div className="w-6 h-6 rounded bg-accent-500/20 flex items-center justify-center">
                                    <span className="text-accent-400 font-bold text-xs">€</span>
                                  </div>
                                  <span className="text-sm text-accent-400 font-medium">+ {offeredBudget} crediti</span>
                                </div>
                              )}
                            </div>
                            {/* RICHIEDI */}
                            <div>
                              <p className="text-xs text-primary-400 font-semibold mb-2 uppercase tracking-wide">Richiedi</p>
                              {selectedRequestedPlayers.length > 0 ? (
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-gray-500 text-[10px] uppercase">
                                      <th className="text-left font-medium pb-1">Giocatore</th>
                                      <th className="text-center font-medium pb-1 w-10">Ruolo</th>
                                      <th className="text-center font-medium pb-1 w-10">Ing.</th>
                                      <th className="text-center font-medium pb-1 w-8">Dur.</th>
                                      <th className="text-center font-medium pb-1 w-12">Claus.</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {selectedRequestedPlayers.map(id => {
                                      const entry = allOtherPlayers.find(r => r.id === id)
                                      if (!entry) return null
                                      const roleStyle = getRoleStyle(entry.player.position)
                                      return (
                                        <tr key={id} className="border-t border-surface-50/10">
                                          <td className="py-1.5">
                                            <div className="flex items-center gap-1.5">
                                              <div className="w-5 h-5 bg-white/90 rounded flex items-center justify-center flex-shrink-0">
                                                <img src={getTeamLogo(entry.player.team)} alt={entry.player.team} className="w-4 h-4 object-contain" />
                                              </div>
                                              <div className="min-w-0">
                                                <span className="text-gray-200 truncate block">{entry.player.name}</span>
                                                <span className="text-[9px] text-gray-500 truncate block">{entry.player.team}</span>
                                              </div>
                                            </div>
                                          </td>
                                          <td className="text-center">
                                            <span className={`inline-block px-1.5 py-0.5 text-[9px] font-bold rounded ${roleStyle.bg} ${roleStyle.text}`}>
                                              {roleStyle.label}
                                            </span>
                                          </td>
                                          <td className="text-center text-accent-400 font-semibold">{entry.player.contract?.salary ?? '-'}</td>
                                          <td className="text-center text-white">{entry.player.contract?.duration ?? '-'}</td>
                                          <td className="text-center text-warning-400">{entry.player.contract?.rescissionClause ?? '-'}</td>
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                </table>
                              ) : (
                                <p className="text-sm text-gray-500 italic">Nessun giocatore</p>
                              )}
                              {requestedBudget > 0 && (
                                <div className="mt-2 pt-2 border-t border-surface-50/20 flex items-center gap-2">
                                  <div className="w-6 h-6 rounded bg-accent-500/20 flex items-center justify-center">
                                    <span className="text-accent-400 font-bold text-xs">€</span>
                                  </div>
                                  <span className="text-sm text-accent-400 font-medium">+ {requestedBudget} crediti</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-400">
                          {selectedMemberId && targetMember ? (
                            <span>Offerta per <span className="text-white font-medium">{targetMember.user.username}</span></span>
                          ) : (
                            <span>Seleziona almeno un giocatore da richiedere</span>
                          )}
                        </div>
                        <Button
                          type="submit"
                          disabled={isSubmitting || !selectedMemberId || (selectedOfferedPlayers.length === 0 && offeredBudget === 0 && selectedRequestedPlayers.length === 0 && requestedBudget === 0)}
                        >
                          {isSubmitting ? 'Invio...' : 'Invia Offerta'}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}

        {/* History */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            {tradeHistory.length === 0 ? (
              <Card className="border-dashed border-2 border-surface-50/30">
                <CardContent className="py-12 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-300 flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-gray-500 text-lg">Nessuno scambio nello storico</p>
                  <p className="text-gray-600 text-sm mt-1">Gli scambi completati o rifiutati appariranno qui</p>
                </CardContent>
              </Card>
            ) : (
              tradeHistory.map(trade => (
                <Card key={trade.id} className={`overflow-hidden border-l-4 ${trade.status === 'ACCEPTED' ? 'border-l-secondary-500' : 'border-l-danger-500'}`}>
                  {/* Header */}
                  <div className="bg-gradient-to-r from-surface-200 to-transparent px-5 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        trade.status === 'ACCEPTED' ? 'bg-secondary-500/20' : 'bg-danger-500/20'
                      }`}>
                        {trade.status === 'ACCEPTED' ? (
                          <svg className="w-5 h-5 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-danger-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-white">
                          {trade.sender?.username || trade.fromMember?.user.username} → {trade.receiver?.username || trade.toMember?.user.username}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(trade.createdAt).toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <span className={`px-3 py-1.5 text-xs font-semibold rounded-full uppercase tracking-wide border ${
                      trade.status === 'ACCEPTED'
                        ? 'bg-secondary-500/20 text-secondary-400 border-secondary-500/40'
                        : 'bg-danger-500/20 text-danger-400 border-danger-500/40'
                    }`}>
                      {trade.status === 'ACCEPTED' ? 'Accettato' : 'Rifiutato'}
                    </span>
                  </div>

                  <CardContent className="py-5">
                    {/* Trade visualization */}
                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Offered */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-danger-500/20 flex items-center justify-center">
                            <svg className="w-3 h-3 text-danger-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                            </svg>
                          </div>
                          <p className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Offerto da {trade.sender?.username}</p>
                        </div>
                        <div className="pl-8">
                          <PlayersTable players={trade.offeredPlayerDetails || []} />
                          {trade.offeredBudget > 0 && (
                            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-surface-50/20">
                              <div className="w-6 h-6 rounded bg-danger-500/20 flex items-center justify-center">
                                <span className="text-danger-400 font-bold text-xs">€</span>
                              </div>
                              <span className="text-sm text-danger-400 font-medium">+ {trade.offeredBudget} crediti</span>
                            </div>
                          )}
                          {(!trade.offeredPlayerDetails?.length && trade.offeredBudget === 0) && (
                            <p className="text-gray-600 text-sm italic py-1">Nessun giocatore o credito</p>
                          )}
                        </div>
                      </div>

                      {/* Requested */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-secondary-500/20 flex items-center justify-center">
                            <svg className="w-3 h-3 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                            </svg>
                          </div>
                          <p className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Richiesto a {trade.receiver?.username}</p>
                        </div>
                        <div className="pl-8">
                          <PlayersTable players={trade.requestedPlayerDetails || []} />
                          {trade.requestedBudget > 0 && (
                            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-surface-50/20">
                              <div className="w-6 h-6 rounded bg-secondary-500/20 flex items-center justify-center">
                                <span className="text-secondary-400 font-bold text-xs">€</span>
                              </div>
                              <span className="text-sm text-secondary-400 font-medium">+ {trade.requestedBudget} crediti</span>
                            </div>
                          )}
                          {(!trade.requestedPlayerDetails?.length && trade.requestedBudget === 0) && (
                            <p className="text-gray-600 text-sm italic py-1">Nessun giocatore o credito</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Message */}
                    {trade.message && (
                      <div className="mt-5 p-4 bg-surface-200/50 rounded-lg border-l-2 border-gray-500">
                        <p className="text-sm text-gray-400 italic">"{trade.message}"</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </main>

      {/* Contract Modification Modal after Trade Acceptance */}
      {isModifyingContract && currentPlayerForModification && currentPlayerForModification.contract && (
        <ContractModifierModal
          isOpen={true}
          onClose={handleSkipContractModification}
          player={{
            id: currentPlayerForModification.playerId,
            name: currentPlayerForModification.playerName,
            team: currentPlayerForModification.playerTeam,
            position: currentPlayerForModification.playerPosition,
          }}
          contract={{
            salary: currentPlayerForModification.contract.salary,
            duration: currentPlayerForModification.contract.duration,
            initialSalary: currentPlayerForModification.contract.initialSalary,
            rescissionClause: currentPlayerForModification.contract.rescissionClause,
          }}
          onConfirm={handleContractModification}
          title={`Modifica Contratto (${currentModificationIndex + 1}/${pendingContractModifications.length})`}
          description="Hai appena ricevuto questo giocatore via scambio. Puoi modificare il suo contratto seguendo le regole del rinnovo."
        />
      )}
    </div>
  )
}
