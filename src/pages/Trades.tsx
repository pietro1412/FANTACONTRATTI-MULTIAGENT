import { useState, useEffect, useMemo } from 'react'
import { tradeApi, auctionApi, leagueApi, contractApi, movementApi } from '../services/api'
import { Button } from '../components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'
import { Navigation } from '../components/Navigation'
import { getTeamLogo } from '../utils/teamLogos'
import { getPlayerPhotoUrl } from '../utils/player-images'
import { POSITION_GRADIENTS } from '../components/ui/PositionBadge'
import { ContractModifierModal, type PlayerInfo, type ContractData } from '../components/ContractModifier'
import { EmptyState } from '../components/ui/EmptyState'

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
  quotation?: number
  age?: number | null
  apiFootballId?: number | null
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
  // Financial data from getFinancials API
  annualContractCost?: number
  slotCount?: number
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

function getAgeColor(age: number | null | undefined): string {
  if (age === null || age === undefined) return 'text-gray-500'
  if (age < 20) return 'text-emerald-400 font-bold'
  if (age < 25) return 'text-green-400'
  if (age < 30) return 'text-yellow-400'
  if (age < 35) return 'text-orange-400'
  return 'text-red-400'
}

// ============================================================================
// TradeMovement interface
// ============================================================================
interface TradeMovement {
  id: string
  movementType: string
  player: { id: string; name: string; position: string; team: string }
  fromMember: { id: string; username: string; teamName: string } | null
  toMember: { id: string; username: string; teamName: string } | null
  price: number | null
  oldSalary: number | null
  newSalary: number | null
  createdAt: string
}

// ============================================================================
// SVG Chart Components for Financial Dashboard
// ============================================================================

// BilancioGauge - Semicircle gauge showing bilancio position
function BilancioGauge({ bilancio, budget, size = 130 }: { bilancio: number; budget: number; size?: number }) {
  const height = size * 0.58
  const cx = size / 2
  const cy = height - 4
  const radius = size / 2 - 8

  // ratio clamped between 0 and 1
  const maxVal = Math.max(budget, 1)
  const ratio = Math.max(0, Math.min(1, bilancio / maxVal))

  // Semicircle from PI to 0 (left to right)
  const startAngle = Math.PI
  const strokeW = 10

  // Three arc zones: red (0-0.15), yellow (0.15-0.35), green (0.35-1)
  const zones = [
    { from: 0, to: 0.15, color: '#ef4444' },     // red
    { from: 0.15, to: 0.35, color: '#eab308' },   // yellow
    { from: 0.35, to: 1, color: '#22c55e' },       // green
  ]

  function arcPath(fromRatio: number, toRatio: number) {
    const a1 = startAngle - fromRatio * Math.PI
    const a2 = startAngle - toRatio * Math.PI
    const x1 = cx + radius * Math.cos(a1)
    const y1 = cy + radius * Math.sin(a1)
    const x2 = cx + radius * Math.cos(a2)
    const y2 = cy + radius * Math.sin(a2)
    const largeArc = toRatio - fromRatio > 0.5 ? 1 : 0
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 0 ${x2} ${y2}`
  }

  // Needle angle
  const needleAngle = startAngle - ratio * Math.PI
  const needleLen = radius - 4
  const nx = cx + needleLen * Math.cos(needleAngle)
  const ny = cy + needleLen * Math.sin(needleAngle)

  // Semantic color for value
  const valueColor = bilancio < 0 ? '#ef4444' : bilancio < 30 ? '#eab308' : '#4ade80'

  return (
    <svg width={size} height={height} viewBox={`0 0 ${size} ${height}`}>
      {/* Background track */}
      <path d={arcPath(0, 1)} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={strokeW} strokeLinecap="round" />
      {/* Color zones */}
      {zones.map((z, i) => (
        <path key={i} d={arcPath(z.from, z.to)} fill="none" stroke={z.color} strokeWidth={strokeW} strokeLinecap="round" opacity={0.35} />
      ))}
      {/* Active arc up to current ratio */}
      <path d={arcPath(0, ratio)} fill="none" stroke={valueColor} strokeWidth={strokeW} strokeLinecap="round" opacity={0.9} />
      {/* Needle */}
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="white" strokeWidth={2} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={3} fill="white" />
      {/* Value text */}
      <text x={cx} y={cy - 14} textAnchor="middle" fill={valueColor} fontSize={size > 120 ? 20 : 16} fontWeight="bold">{bilancio}</text>
      <text x={cx} y={cy - 28} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize={8} style={{ textTransform: 'uppercase' }}>BILANCIO</text>
    </svg>
  )
}

// CompactBudgetBar - Horizontal bar for Budget vs Ingaggi
function CompactBudgetBar({ budget, ingaggi }: { budget: number; ingaggi: number }) {
  const maxVal = Math.max(budget, ingaggi, 1)
  const budgetPct = (budget / maxVal) * 100
  const ingaggiPct = (ingaggi / maxVal) * 100

  return (
    <div className="flex flex-col gap-1.5 w-full" style={{ minHeight: 44 }}>
      <div className="flex flex-col gap-0.5">
        <div className="flex justify-between text-[10px]">
          <span className="text-gray-500">Budget</span>
          <span className="text-primary-400 font-medium">{budget}</span>
        </div>
        <div className="h-3 bg-surface-100/50 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-primary-600 to-primary-400 rounded-full transition-all duration-500" style={{ width: `${budgetPct}%` }} />
        </div>
      </div>
      <div className="flex flex-col gap-0.5">
        <div className="flex justify-between text-[10px]">
          <span className="text-gray-500">Ingaggi</span>
          <span className="text-accent-400 font-medium">{ingaggi}</span>
        </div>
        <div className="h-3 bg-surface-100/50 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-accent-600 to-accent-400 rounded-full transition-all duration-500" style={{ width: `${ingaggiPct}%` }} />
        </div>
      </div>
    </div>
  )
}

// DeltaBar - Shows before/after impact on bilancio
function DeltaBar({ before, after, label }: { before: number; after: number; label?: string }) {
  const delta = after - before
  const maxAbs = Math.max(Math.abs(before), Math.abs(after), 1)
  const beforePct = Math.max(0, (before / maxAbs) * 100)
  const afterPct = Math.max(0, (after / maxAbs) * 100)
  const improves = delta >= 0
  const deltaColor = improves ? 'text-secondary-400' : 'text-danger-400'
  const barColor = improves ? 'bg-secondary-500' : 'bg-danger-500'

  return (
    <div className="flex flex-col gap-1">
      {label && <span className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</span>}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400 w-8 text-right font-medium">{before}</span>
        <div className="flex-1 relative h-4 bg-surface-100/30 rounded-full overflow-hidden">
          {/* Before marker */}
          <div className="absolute top-0 h-full bg-gray-500/40 rounded-full transition-all duration-500" style={{ width: `${beforePct}%` }} />
          {/* After marker */}
          <div className={`absolute top-0 h-full ${barColor}/60 rounded-full transition-all duration-500`} style={{ width: `${afterPct}%` }} />
        </div>
        <span className={`text-xs font-semibold w-8 ${deltaColor}`}>{after}</span>
        <span className={`text-[10px] font-bold ${deltaColor} min-w-[40px]`}>
          {delta > 0 ? '+' : ''}{delta}
        </span>
      </div>
    </div>
  )
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
  const [myFinancials, setMyFinancials] = useState<{ annualContractCost: number; slotCount: number }>({ annualContractCost: 0, slotCount: 0 })
  const [isInTradePhase, setIsInTradePhase] = useState(false)
  const [currentSession, setCurrentSession] = useState<MarketSession | null>(null)
  const [tradeMovements, setTradeMovements] = useState<TradeMovement[]>([])
  const [historyFilter, setHistoryFilter] = useState<'all' | 'offers' | 'movements'>('all')

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
    const [receivedRes, sentRes, historyRes, membersRes, rosterRes, sessionsRes, leagueRes, allRostersRes, financialsRes, movementsRes] = await Promise.all([
      tradeApi.getReceived(leagueId),
      tradeApi.getSent(leagueId),
      tradeApi.getHistory(leagueId),
      leagueApi.getMembers(leagueId),
      auctionApi.getRoster(leagueId),
      auctionApi.getSessions(leagueId),
      leagueApi.getById(leagueId),
      auctionApi.getLeagueRosters(leagueId),
      leagueApi.getFinancials(leagueId),
      movementApi.getLeagueMovements(leagueId, { movementType: 'TRADE', limit: 50 }),
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

    // Build financials lookup from getFinancials API
    const financialsMap = new Map<string, { budget: number; annualContractCost: number; slotCount: number }>()
    if (financialsRes.success && financialsRes.data) {
      const fData = financialsRes.data as { teams: Array<{ memberId: string; budget: number; annualContractCost: number; slotCount: number }> }
      for (const t of fData.teams || []) {
        financialsMap.set(t.memberId, { budget: t.budget, annualContractCost: t.annualContractCost, slotCount: t.slotCount })
      }
    }

    if (membersRes.success && membersRes.data) {
      const allMembers = (membersRes.data as { members: LeagueMember[] }).members || []
      // Merge financial data into members
      const enriched = allMembers.map(m => {
        const fin = financialsMap.get(m.id)
        return fin
          ? { ...m, currentBudget: fin.budget, annualContractCost: fin.annualContractCost, slotCount: fin.slotCount }
          : m
      })
      setMembers(enriched.filter(m => m.id !== currentMemberId))
    }

    // Also fix myBudget from financials if available
    if (currentMemberId && financialsMap.has(currentMemberId)) {
      const myFin = financialsMap.get(currentMemberId)!
      setMyBudget(myFin.budget)
      setMyFinancials({ annualContractCost: myFin.annualContractCost, slotCount: myFin.slotCount })
    }

    if (rosterRes.success && rosterRes.data) {
      interface RosterApiEntry {
        id: string
        player: { id: string; name: string; team: string; position: string; quotation?: number; age?: number | null; apiFootballId?: number | null }
        contract?: { salary: number; duration: number; rescissionClause?: number } | null
        acquisitionPrice: number
      }
      const data = rosterRes.data as {
        member: { currentBudget: number }
        roster: { P: RosterApiEntry[], D: RosterApiEntry[], C: RosterApiEntry[], A: RosterApiEntry[] }
      }
      // Only set budget from roster if financials didn't provide it
      if (!financialsMap.has(currentMemberId)) {
        setMyBudget(data.member.currentBudget)
      }
      // Map roster entries to include contract inside player
      const mapEntry = (r: RosterApiEntry): RosterEntry => ({
        id: r.id,
        player: {
          id: r.player.id,
          name: r.player.name,
          team: r.player.team,
          position: r.player.position,
          contract: r.contract,
          quotation: r.player.quotation,
          age: r.player.age,
          apiFootballId: r.player.apiFootballId,
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
          player: { id: string; name: string; position: string; team: string; quotation?: number; age?: number | null; apiFootballId?: number | null }
          contract?: { salary: number; duration: number; rescissionClause?: number } | null
        }>
        players?: Array<{
          id: string
          rosterId: string
          name: string
          position: string
          team: string
          quotation?: number
          age?: number | null
          apiFootballId?: number | null
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
          quotation: r.player.quotation,
          age: r.player.age,
          apiFootballId: r.player.apiFootballId,
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
              quotation: p.quotation,
              age: p.age,
              apiFootballId: p.apiFootballId,
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

    if (movementsRes.success && movementsRes.data) {
      setTradeMovements((movementsRes.data as { movements: TradeMovement[] }).movements || [])
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

  // Financial calculations - use API data from getFinancials for consistency with Finanze page
  const myTotalSalary = myFinancials.annualContractCost
  const targetTotalSalary = targetMember?.annualContractCost ?? 0
  const targetRosterCount = targetMember?.slotCount ?? 0

  // Simulated post-trade impact
  const offeredSalaryTotal = useMemo(() =>
    selectedOfferedPlayers.reduce((sum, id) => {
      const r = myRoster.find(e => e.id === id)
      return sum + (r?.player.contract?.salary || 0)
    }, 0),
    [selectedOfferedPlayers, myRoster]
  )
  const requestedSalaryTotal = useMemo(() =>
    selectedRequestedPlayers.reduce((sum, id) => {
      const r = allOtherPlayers.find(e => e.id === id)
      return sum + (r?.player.contract?.salary || 0)
    }, 0),
    [selectedRequestedPlayers, allOtherPlayers]
  )
  const myPostTradeBudget = myBudget - offeredBudget + requestedBudget
  const myPostTradeSalary = myTotalSalary - offeredSalaryTotal + requestedSalaryTotal

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
              <EmptyState icon="📥" title="Nessuna offerta ricevuta" description="Le offerte che riceverai appariranno qui" />
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
              <EmptyState icon="📤" title="Nessuna offerta inviata" description="Le tue offerte appariranno qui" />
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
                {/* Financial Dashboard - Bilancio Hero */}
                <Card className="bg-gradient-to-r from-surface-200 to-surface-300 border-accent-500/30">
                  <CardContent className="py-4">
                    <div className="flex flex-col gap-3">
                      {/* Row 1: My finances vs Target finances */}
                      <div className={`flex flex-col md:flex-row items-start gap-4 ${selectedMemberId && targetMember ? 'md:justify-between' : ''}`}>
                        {/* My finances panel */}
                        <div className="flex items-start gap-4 flex-1 min-w-0">
                          <div className="flex flex-col items-center flex-shrink-0">
                            <BilancioGauge bilancio={myBudget - myTotalSalary} budget={myBudget} size={130} />
                          </div>
                          <div className="flex flex-col gap-2 min-w-0 flex-1 pt-1">
                            <p className="text-[10px] text-gray-500 uppercase tracking-wide">Bilancio</p>
                            <p className={`text-3xl font-bold ${
                              myBudget - myTotalSalary < 0 ? 'text-danger-400' : myBudget - myTotalSalary < 30 ? 'text-warning-400' : 'text-secondary-400'
                            }`}>
                              {myBudget - myTotalSalary} <span className="text-sm text-gray-500">crediti</span>
                            </p>
                            <div className="flex gap-4 text-xs text-gray-400">
                              <span>Budget: <span className="text-primary-400 font-medium">{myBudget}</span></span>
                              <span>Ingaggi: <span className="text-warning-400 font-medium">{myTotalSalary}</span></span>
                              <span>Rosa: <span className="text-white font-medium">{myRoster.length}</span></span>
                            </div>
                            <CompactBudgetBar budget={myBudget} ingaggi={myTotalSalary} />
                          </div>
                        </div>

                        {/* Target finances panel */}
                        {selectedMemberId && targetMember && (() => {
                          const targetBilancio = targetMember.currentBudget - targetTotalSalary
                          return (
                            <div className="flex items-start gap-4 flex-1 min-w-0 md:pl-6 md:border-l border-surface-50/30 pt-3 md:pt-0 border-t md:border-t-0">
                              <div className="flex flex-col items-center flex-shrink-0">
                                <BilancioGauge bilancio={targetBilancio} budget={targetMember.currentBudget} size={130} />
                              </div>
                              <div className="flex flex-col gap-2 min-w-0 flex-1 pt-1">
                                <p className="text-[10px] text-gray-500 uppercase tracking-wide">{targetMember.user.username}</p>
                                <p className={`text-3xl font-bold ${
                                  targetBilancio < 0 ? 'text-danger-400' : targetBilancio < 30 ? 'text-warning-400' : 'text-secondary-400'
                                }`}>
                                  {targetBilancio} <span className="text-sm text-gray-500">crediti</span>
                                </p>
                                <div className="flex gap-4 text-xs text-gray-400">
                                  <span>Budget: <span className="text-primary-400 font-medium">{targetMember.currentBudget}</span></span>
                                  <span>Ingaggi: <span className="text-warning-400 font-medium">{targetTotalSalary}</span></span>
                                  <span>Rosa: <span className="text-white font-medium">{targetRosterCount}</span></span>
                                </div>
                                <CompactBudgetBar budget={targetMember.currentBudget} ingaggi={targetTotalSalary} />
                              </div>
                            </div>
                          )
                        })()}
                      </div>

                      {/* Row 2: Post-trade impact with DeltaBar (only when composing offer) */}
                      {(selectedOfferedPlayers.length > 0 || selectedRequestedPlayers.length > 0 || offeredBudget > 0 || requestedBudget > 0) && (
                        <div className="pt-3 border-t border-surface-50/20">
                          <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Impatto post-scambio</p>
                          <div className="flex flex-col gap-2">
                            <DeltaBar before={myBudget - myTotalSalary} after={myPostTradeBudget - myPostTradeSalary} label="Bilancio" />
                            <div className="grid grid-cols-2 gap-4">
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-gray-500">Budget:</span>
                                <span className="text-primary-400 font-medium">{myBudget}</span>
                                <span className="text-gray-600">→</span>
                                <span className={`font-semibold ${myPostTradeBudget >= 0 ? 'text-primary-400' : 'text-danger-400'}`}>{myPostTradeBudget}</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-gray-500">Ingaggi:</span>
                                <span className="text-warning-400 font-medium">{myTotalSalary}</span>
                                <span className="text-gray-600">→</span>
                                <span className="text-warning-400 font-semibold">{myPostTradeSalary}</span>
                              </div>
                            </div>
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
                      <div className="max-h-[480px] overflow-y-auto border border-surface-50/30 rounded-lg bg-surface-300 divide-y divide-surface-50/10">
                        {filteredOtherPlayers.length === 0 ? (
                          <p className="text-gray-500 text-sm p-4 text-center">
                            {selectedMemberId ? 'Nessun giocatore trovato' : 'Cerca o seleziona un DG'}
                          </p>
                        ) : (
                          filteredOtherPlayers.map(entry => {
                            const isSelected = selectedRequestedPlayers.includes(entry.id)
                            return (
                              <div
                                key={entry.id}
                                onClick={() => handleSelectRequestedPlayer(entry)}
                                className={`px-3 py-2.5 cursor-pointer hover:bg-surface-200 transition-colors flex items-center justify-between ${
                                  isSelected ? 'bg-primary-500/20' : ''
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  {isSelected && <span className="text-primary-400 font-bold text-sm">✓</span>}
                                  {/* Player photo with position badge */}
                                  <div className="relative flex-shrink-0">
                                    {entry.player.apiFootballId ? (
                                      <img
                                        src={getPlayerPhotoUrl(entry.player.apiFootballId)}
                                        alt={entry.player.name}
                                        className="w-9 h-9 rounded-full object-cover bg-surface-300 border-2 border-surface-50/20"
                                        onError={(e) => {
                                          (e.target as HTMLImageElement).style.display = 'none'
                                          const fallback = (e.target as HTMLImageElement).nextElementSibling as HTMLElement
                                          if (fallback) fallback.style.display = 'flex'
                                        }}
                                      />
                                    ) : null}
                                    <div
                                      className={`w-9 h-9 rounded-full bg-gradient-to-br ${POSITION_GRADIENTS[entry.player.position as keyof typeof POSITION_GRADIENTS] || 'from-gray-500 to-gray-600'} items-center justify-center text-xs font-bold text-white ${entry.player.apiFootballId ? 'hidden' : 'flex'}`}
                                    >
                                      {entry.player.position}
                                    </div>
                                    <span
                                      className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-gradient-to-br ${POSITION_GRADIENTS[entry.player.position as keyof typeof POSITION_GRADIENTS] || 'from-gray-500 to-gray-600'} flex items-center justify-center text-white font-bold text-[8px] border border-surface-200`}
                                    >
                                      {entry.player.position}
                                    </span>
                                  </div>
                                  <div className="min-w-0">
                                    <span className="text-gray-200 text-xs font-medium block truncate">{entry.player.name}</span>
                                    <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                                      <span>{entry.player.team}</span>
                                      {entry.player.age != null && (
                                        <span className={getAgeColor(entry.player.age)}>• {entry.player.age}a</span>
                                      )}
                                      <span className="text-gray-600">• {entry.memberUsername}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 text-[10px] flex-shrink-0">
                                  {entry.player.quotation != null && (
                                    <span className="text-gray-400" title="Quotazione">{entry.player.quotation}</span>
                                  )}
                                  <span className="text-accent-400 font-semibold" title="Ingaggio">{entry.player.contract?.salary ?? '-'}</span>
                                  <span className="text-white" title="Durata">{entry.player.contract?.duration ?? '-'}A</span>
                                  <span className="text-warning-400" title="Clausola">{entry.player.contract?.rescissionClause ?? '-'}</span>
                                </div>
                              </div>
                            )
                          })
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
                      <div className="max-h-[480px] overflow-y-auto border border-surface-50/30 rounded-lg bg-surface-300 divide-y divide-surface-50/10">
                        {myRoster.length === 0 ? (
                          <p className="text-gray-500 text-sm p-4 text-center">Nessun giocatore in rosa</p>
                        ) : (
                          myRoster.map(entry => {
                            const isSelected = selectedOfferedPlayers.includes(entry.id)
                            return (
                              <div
                                key={entry.id}
                                onClick={() => togglePlayer(selectedOfferedPlayers, setSelectedOfferedPlayers, entry.id)}
                                className={`px-3 py-2.5 cursor-pointer hover:bg-surface-200 transition-colors flex items-center justify-between ${
                                  isSelected ? 'bg-danger-500/20' : ''
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  {isSelected && <span className="text-danger-400 font-bold text-sm">✓</span>}
                                  {/* Player photo with position badge */}
                                  <div className="relative flex-shrink-0">
                                    {entry.player.apiFootballId ? (
                                      <img
                                        src={getPlayerPhotoUrl(entry.player.apiFootballId)}
                                        alt={entry.player.name}
                                        className="w-9 h-9 rounded-full object-cover bg-surface-300 border-2 border-surface-50/20"
                                        onError={(e) => {
                                          (e.target as HTMLImageElement).style.display = 'none'
                                          const fallback = (e.target as HTMLImageElement).nextElementSibling as HTMLElement
                                          if (fallback) fallback.style.display = 'flex'
                                        }}
                                      />
                                    ) : null}
                                    <div
                                      className={`w-9 h-9 rounded-full bg-gradient-to-br ${POSITION_GRADIENTS[entry.player.position as keyof typeof POSITION_GRADIENTS] || 'from-gray-500 to-gray-600'} items-center justify-center text-xs font-bold text-white ${entry.player.apiFootballId ? 'hidden' : 'flex'}`}
                                    >
                                      {entry.player.position}
                                    </div>
                                    <span
                                      className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-gradient-to-br ${POSITION_GRADIENTS[entry.player.position as keyof typeof POSITION_GRADIENTS] || 'from-gray-500 to-gray-600'} flex items-center justify-center text-white font-bold text-[8px] border border-surface-200`}
                                    >
                                      {entry.player.position}
                                    </span>
                                  </div>
                                  <div className="min-w-0">
                                    <span className="text-gray-200 text-xs font-medium block truncate">{entry.player.name}</span>
                                    <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                                      <span>{entry.player.team}</span>
                                      {entry.player.age != null && (
                                        <span className={getAgeColor(entry.player.age)}>• {entry.player.age}a</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 text-[10px] flex-shrink-0">
                                  {entry.player.quotation != null && (
                                    <span className="text-gray-400" title="Quotazione">{entry.player.quotation}</span>
                                  )}
                                  <span className="text-accent-400 font-semibold" title="Ingaggio">{entry.player.contract?.salary ?? '-'}</span>
                                  <span className="text-white" title="Durata">{entry.player.contract?.duration ?? '-'}A</span>
                                  <span className="text-warning-400" title="Clausola">{entry.player.contract?.rescissionClause ?? '-'}</span>
                                </div>
                              </div>
                            )
                          })
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
        {activeTab === 'history' && (() => {
          // Build combined timeline
          type TimelineOffer = TradeOffer & { _type: 'offer' }
          type TimelineMovement = TradeMovement & { _type: 'movement' }
          type TimelineItem = TimelineOffer | TimelineMovement

          const timelineItems: TimelineItem[] = []

          if (historyFilter !== 'movements') {
            for (const t of tradeHistory) {
              timelineItems.push({ ...t, _type: 'offer' })
            }
          }
          if (historyFilter !== 'offers') {
            for (const m of tradeMovements) {
              timelineItems.push({ ...m, _type: 'movement' })
            }
          }

          // Sort by date descending
          timelineItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

          return (
            <div className="space-y-4">
              {/* Filter pills */}
              <div className="flex gap-2">
                {([['all', 'Tutto'], ['offers', 'Offerte'], ['movements', 'Movimenti']] as const).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setHistoryFilter(key)}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
                      historyFilter === key
                        ? 'bg-accent-500/20 text-accent-400 border-accent-500/40'
                        : 'bg-surface-200 text-gray-400 border-surface-50/20 hover:border-surface-50/40'
                    }`}
                  >
                    {label}
                    {key === 'offers' && <span className="ml-1 text-gray-500">({tradeHistory.length})</span>}
                    {key === 'movements' && <span className="ml-1 text-gray-500">({tradeMovements.length})</span>}
                  </button>
                ))}
              </div>

              {timelineItems.length === 0 ? (
                <EmptyState icon="🕐" title="Nessun elemento nello storico" description="Gli scambi completati, rifiutati e i movimenti appariranno qui" />
              ) : (
                <div className="space-y-4">
                  {timelineItems.map(item => {
                    if (item._type === 'movement') {
                      // Movement row - compact
                      const mov = item as TimelineMovement
                      const roleStyle = getRoleStyle(mov.player.position)
                      return (
                        <Card key={`mov-${mov.id}`} className="overflow-hidden border-l-4 border-l-secondary-500/60">
                          <CardContent className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              {/* Badge */}
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-secondary-500/20 text-secondary-400 uppercase tracking-wide flex-shrink-0">
                                Trade
                              </span>
                              {/* Player info */}
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <div className={`w-8 h-8 rounded-full ${roleStyle.bg} flex items-center justify-center flex-shrink-0`}>
                                  <span className={`text-xs font-bold ${roleStyle.text}`}>{mov.player.name.charAt(0)}</span>
                                </div>
                                <span className={`w-7 h-5 flex items-center justify-center text-[9px] font-bold rounded ${roleStyle.bg} ${roleStyle.text} flex-shrink-0`}>
                                  {roleStyle.label}
                                </span>
                                <span className="text-sm text-white font-medium truncate">{mov.player.name}</span>
                              </div>
                              {/* From → To */}
                              <div className="flex items-center gap-1.5 text-xs flex-shrink-0">
                                {mov.fromMember && (
                                  <span className="text-gray-400">{mov.fromMember.username}</span>
                                )}
                                <svg className="w-3.5 h-3.5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                                {mov.toMember && (
                                  <span className="text-white font-medium">{mov.toMember.username}</span>
                                )}
                              </div>
                              {/* Contract details */}
                              {mov.newSalary != null && (
                                <div className="flex items-center gap-1.5 text-xs flex-shrink-0 pl-2 border-l border-surface-50/20">
                                  <span className="text-accent-400 font-medium">{mov.newSalary}M</span>
                                </div>
                              )}
                              {/* Timestamp */}
                              <span className="text-[10px] text-gray-600 flex-shrink-0 ml-auto">
                                {new Date(mov.createdAt).toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    }

                    // Offer card - existing rendering
                    const trade = item as TimelineOffer
                    return (
                      <Card key={`offer-${trade.id}`} className={`overflow-hidden border-l-4 ${trade.status === 'ACCEPTED' ? 'border-l-secondary-500' : 'border-l-danger-500'}`}>
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

                          {/* Budget transfer summary - only for accepted trades with budget movement */}
                          {trade.status === 'ACCEPTED' && (trade.offeredBudget > 0 || trade.requestedBudget > 0) && (
                            <div className="mt-5 p-4 bg-accent-500/5 rounded-lg border border-accent-500/20">
                              <div className="flex items-center gap-2 mb-3">
                                <svg className="w-4 h-4 text-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="text-xs font-semibold text-accent-400 uppercase tracking-wide">Trasferimento crediti</span>
                              </div>
                              <div className="flex flex-col gap-2">
                                {trade.offeredBudget > 0 && (
                                  <div className="flex items-center gap-2 text-sm">
                                    <span className="text-gray-400">{trade.sender?.username}</span>
                                    <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-danger-500/10 border border-danger-500/20">
                                      <span className="text-danger-400 font-bold">-{trade.offeredBudget}</span>
                                      <span className="text-danger-400/70 text-xs">crediti</span>
                                    </div>
                                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                    </svg>
                                    <span className="text-gray-400">{trade.receiver?.username}</span>
                                    <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-secondary-500/10 border border-secondary-500/20">
                                      <span className="text-secondary-400 font-bold">+{trade.offeredBudget}</span>
                                      <span className="text-secondary-400/70 text-xs">crediti</span>
                                    </div>
                                  </div>
                                )}
                                {trade.requestedBudget > 0 && (
                                  <div className="flex items-center gap-2 text-sm">
                                    <span className="text-gray-400">{trade.receiver?.username}</span>
                                    <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-danger-500/10 border border-danger-500/20">
                                      <span className="text-danger-400 font-bold">-{trade.requestedBudget}</span>
                                      <span className="text-danger-400/70 text-xs">crediti</span>
                                    </div>
                                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                    </svg>
                                    <span className="text-gray-400">{trade.sender?.username}</span>
                                    <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-secondary-500/10 border border-secondary-500/20">
                                      <span className="text-secondary-400 font-bold">+{trade.requestedBudget}</span>
                                      <span className="text-secondary-400/70 text-xs">crediti</span>
                                    </div>
                                  </div>
                                )}
                                {/* Net transfer summary */}
                                {trade.offeredBudget > 0 && trade.requestedBudget > 0 && (
                                  <div className="flex items-center gap-2 pt-2 mt-1 border-t border-surface-50/20 text-xs text-gray-500">
                                    <span>Netto:</span>
                                    <span className="text-white font-medium">
                                      {trade.sender?.username} {trade.offeredBudget - trade.requestedBudget >= 0 ? '-' : '+'}{Math.abs(trade.offeredBudget - trade.requestedBudget)} crediti
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Message */}
                          {trade.message && (
                            <div className="mt-5 p-4 bg-surface-200/50 rounded-lg border-l-2 border-gray-500">
                              <p className="text-sm text-gray-400 italic">"{trade.message}"</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })()}
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
