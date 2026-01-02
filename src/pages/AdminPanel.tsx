import { useState, useEffect } from 'react'
import { leagueApi, auctionApi, adminApi, inviteApi, contractApi, chatApi } from '../services/api'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Navigation } from '../components/Navigation'

interface AdminPanelProps {
  leagueId: string
  initialTab?: string
  onNavigate: (page: string, params?: Record<string, string>) => void
}

interface League {
  id: string
  name: string
  description?: string
  maxParticipants: number
  minParticipants: number
  requireEvenNumber: boolean
  initialBudget: number
  status: string
  goalkeeperSlots: number
  defenderSlots: number
  midfielderSlots: number
  forwardSlots: number
}

interface Member {
  id: string
  role: string
  status: string
  currentBudget: number
  teamName?: string
  user: { id: string; username: string; email: string }
}

interface MarketSession {
  id: string
  type: string
  status: string
  currentPhase: string | null
  season: number
  semester: number
  createdAt: string
}

interface Invite {
  id: string
  email: string
  status: string
  createdAt: string
  expiresAt: string
}

interface ConsolidationManager {
  memberId: string
  username: string
  playerCount: number
  isConsolidated: boolean
  consolidatedAt: string | null
}

interface ConsolidationStatus {
  inContrattiPhase: boolean
  sessionId?: string
  managers: ConsolidationManager[]
  consolidatedCount: number
  totalCount: number
  allConsolidated: boolean
}

interface Appeal {
  id: string
  content: string
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED'
  resolutionNote?: string
  createdAt: string
  resolvedAt?: string
  auction: {
    id: string
    currentPrice: number
    basePrice: number
    player: { id: string; name: string; team: string; position: string }
    winner?: { user: { username: string } }
    bids: Array<{ amount: number; bidder: { user: { username: string } } }>
  }
  member: { user: { username: string } }
  resolvedBy?: { user: { username: string } }
}

const MARKET_PHASES = [
  { value: 'ASTA_LIBERA', label: 'Asta Libera', onlyFirst: true },
  { value: 'SCAMBI_OFFERTE_1', label: 'Scambi/Offerte (1)', onlyFirst: false },
  { value: 'CONTRATTI', label: 'Contratti', onlyFirst: false },
  { value: 'RUBATA', label: 'Rubata', onlyFirst: false },
  { value: 'SVINCOLATI', label: 'Svincolati', onlyFirst: false },
  { value: 'SCAMBI_OFFERTE_2', label: 'Scambi/Offerte (2)', onlyFirst: false },
]

const TABS = [
  { id: 'overview', label: 'Panoramica', icon: '📊' },
  { id: 'members', label: 'Membri', icon: '👥' },
  { id: 'prizes', label: 'Premi', icon: '🏆' },
  { id: 'appeals', label: 'Ricorsi', icon: '⚖️' },
  { id: 'invites', label: 'Inviti', icon: '✉️' },
  { id: 'sessions', label: 'Sessioni', icon: '📅' },
  { id: 'export', label: 'Export', icon: '📤' },
] as const

export function AdminPanel({ leagueId, initialTab, onNavigate }: AdminPanelProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [league, setLeague] = useState<League | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [sessions, setSessions] = useState<MarketSession[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [isAdmin, setIsAdmin] = useState(false)

  const [activeTab, setActiveTab] = useState<typeof TABS[number]['id']>(
    (initialTab as typeof TABS[number]['id']) || 'overview'
  )
  const [newInviteEmail, setNewInviteEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [consolidationStatus, setConsolidationStatus] = useState<ConsolidationStatus | null>(null)

  // Prize state
  const [selectedPrizeMemberId, setSelectedPrizeMemberId] = useState('')
  const [prizeAmount, setPrizeAmount] = useState('')
  const [prizeReason, setPrizeReason] = useState('')
  const [prizeHistory, setPrizeHistory] = useState<Array<{
    id: string
    teamName: string
    username: string
    adminUsername: string
    amount: number
    reason: string | null
    createdAt: string
  }>>([])
  const [isLoadingPrizes, setIsLoadingPrizes] = useState(false)

  // Appeals state
  const [appeals, setAppeals] = useState<Appeal[]>([])
  const [isLoadingAppeals, setIsLoadingAppeals] = useState(false)
  const [appealFilter, setAppealFilter] = useState<'PENDING' | 'ACCEPTED' | 'REJECTED' | ''>('')
  const [resolutionNote, setResolutionNote] = useState('')
  const [selectedAppealId, setSelectedAppealId] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [leagueId])

  useEffect(() => {
    if (activeTab === 'prizes') {
      loadPrizeHistory()
    }
  }, [activeTab, leagueId])

  useEffect(() => {
    if (activeTab === 'appeals') {
      loadAppeals()
    }
  }, [activeTab, leagueId, appealFilter])

  async function loadAppeals() {
    setIsLoadingAppeals(true)
    const res = await auctionApi.getAppeals(leagueId, appealFilter || undefined)
    if (res.success && res.data) {
      setAppeals((res.data as { appeals: Appeal[] }).appeals || [])
    }
    setIsLoadingAppeals(false)
  }

  async function handleResolveAppeal(appealId: string, decision: 'ACCEPTED' | 'REJECTED') {
    setError('')
    setSuccess('')
    setIsSubmitting(true)

    const res = await auctionApi.resolveAppeal(appealId, decision, resolutionNote || undefined)
    if (res.success) {
      setSuccess(res.message || 'Ricorso gestito')
      setResolutionNote('')
      setSelectedAppealId(null)

      // Se il ricorso è accettato, naviga alla stanza d'asta
      if (decision === 'ACCEPTED' && res.data) {
        const data = res.data as { sessionId: string; auctionId: string }
        if (data.sessionId) {
          onNavigate('auction-room', { sessionId: data.sessionId })
          return
        }
      }

      loadAppeals()
    } else {
      setError(res.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  async function handleSimulateAppeal() {
    setError('')
    setSuccess('')
    setIsSubmitting(true)

    const res = await auctionApi.simulateAppeal(leagueId)
    if (res.success) {
      setSuccess(res.message || 'Ricorso simulato creato')
      loadAppeals()
    } else {
      setError(res.message || 'Errore nella simulazione')
    }
    setIsSubmitting(false)
  }

  async function handleSimulateChatMessage() {
    if (!activeSession) return
    setError('')
    setIsSubmitting(true)

    const res = await chatApi.simulateMessage(activeSession.id)
    if (res.success) {
      setSuccess('Messaggio chat simulato!')
    } else {
      setError(res.message || 'Errore nella simulazione chat')
    }
    setIsSubmitting(false)
  }

  async function loadData() {
    setIsLoading(true)

    const [leagueRes, membersRes, sessionsRes, invitesRes, consolidationRes] = await Promise.all([
      leagueApi.getById(leagueId),
      leagueApi.getMembers(leagueId),
      auctionApi.getSessions(leagueId),
      inviteApi.getPending(leagueId),
      contractApi.getAllConsolidationStatus(leagueId),
    ])

    if (leagueRes.success && leagueRes.data) {
      const data = leagueRes.data as { league: League; isAdmin: boolean }
      setLeague(data.league)
      setIsAdmin(data.isAdmin)
    }

    if (membersRes.success && membersRes.data) {
      const data = membersRes.data as { members: Member[] }
      setMembers(data.members || [])
    }

    if (sessionsRes.success && sessionsRes.data) {
      setSessions(sessionsRes.data as MarketSession[])
    }

    if (invitesRes.success && invitesRes.data) {
      setInvites(invitesRes.data as Invite[])
    }

    if (consolidationRes.success && consolidationRes.data) {
      setConsolidationStatus(consolidationRes.data as ConsolidationStatus)
    }

    setIsLoading(false)
  }

  async function loadPrizeHistory() {
    setIsLoadingPrizes(true)
    const res = await adminApi.getPrizeHistory(leagueId)
    if (res.success && res.data) {
      setPrizeHistory(res.data as typeof prizeHistory)
    }
    setIsLoadingPrizes(false)
  }

  async function handleCreateSession(isRegularMarket: boolean) {
    setError('')
    setSuccess('')
    setIsSubmitting(true)

    const res = await auctionApi.createSession(leagueId, isRegularMarket)
    if (res.success) {
      setSuccess(isRegularMarket ? 'Mercato ricorrente creato!' : 'Primo mercato creato!')
      loadData()
    } else {
      setError(res.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  async function handleCloseSession(sessionId: string) {
    setError('')
    setIsSubmitting(true)

    const res = await auctionApi.closeSession(sessionId)
    if (res.success) {
      setSuccess('Sessione chiusa')
      loadData()
    } else {
      setError(res.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  async function handleSetPhase(sessionId: string, phase: string) {
    setError('')
    setIsSubmitting(true)

    const res = await auctionApi.setPhase(sessionId, phase)
    if (res.success) {
      setSuccess(`Fase impostata: ${phase}`)
      loadData()
    } else {
      setError(res.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  async function handleMemberAction(memberId: string, action: 'accept' | 'reject' | 'kick') {
    setError('')
    setIsSubmitting(true)

    const res = await leagueApi.updateMember(leagueId, memberId, action)
    if (res.success) {
      setSuccess(action === 'accept' ? 'Membro accettato' : action === 'reject' ? 'Richiesta rifiutata' : 'Membro espulso')
      loadData()
    } else {
      setError(res.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  async function handleCreateInvite() {
    if (!newInviteEmail.trim()) return

    setError('')
    setIsSubmitting(true)

    const res = await inviteApi.create(leagueId, newInviteEmail.trim())
    if (res.success) {
      setSuccess(`Invito inviato a ${newInviteEmail}`)
      setNewInviteEmail('')
      loadData()
    } else {
      setError(res.message || 'Errore nell\'invio dell\'invito')
    }
    setIsSubmitting(false)
  }

  async function handleCancelInvite(inviteId: string) {
    setError('')
    setIsSubmitting(true)

    const res = await inviteApi.cancel(inviteId)
    if (res.success) {
      setSuccess('Invito annullato')
      loadData()
    } else {
      setError(res.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  async function handleStartLeague() {
    setError('')
    setIsSubmitting(true)

    const res = await leagueApi.start(leagueId)
    if (res.success) {
      setSuccess('Lega avviata con successo!')
      loadData()
    } else {
      setError(res.message || 'Errore nell\'avvio della lega')
    }
    setIsSubmitting(false)
  }

  function exportToCSV() {
    const headers = ['Username', 'Team', 'Ruolo', 'Stato', 'Budget']
    const rows = members.map(m => [
      m.user.username,
      m.teamName || '-',
      m.role,
      m.status,
      m.currentBudget.toString(),
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(',')),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `lega_${league?.name || 'export'}_membri.csv`
    link.click()
  }

  async function exportRostersToCSV() {
    setIsSubmitting(true)
    const res = await adminApi.exportRosters(leagueId)

    if (!res.success) {
      setError(res.message || 'Errore durante l\'export')
      setIsSubmitting(false)
      return
    }

    const data = res.data as Array<{
      username: string
      teamName: string
      budget: number
      players: Array<{
        name: string
        team: string
        position: string
        quotation: number
        acquisitionPrice: number
        acquisitionType: string
        salary: number | null
        duration: number | null
        rescissionClause: number | null
      }>
    }>

    const headers = ['Manager', 'Team', 'Budget', 'Giocatore', 'Squadra', 'Ruolo', 'Quotazione', 'Costo Acquisto', 'Tipo', 'Ingaggio', 'Durata', 'Clausola']
    const rows: string[][] = []

    data.forEach(member => {
      if (member.players.length === 0) {
        rows.push([member.username, member.teamName || '-', member.budget.toString(), '', '', '', '', '', '', '', '', ''])
      } else {
        member.players.forEach((p, i) => {
          rows.push([
            i === 0 ? member.username : '',
            i === 0 ? (member.teamName || '-') : '',
            i === 0 ? member.budget.toString() : '',
            p.name,
            p.team,
            p.position,
            p.quotation.toString(),
            p.acquisitionPrice.toString(),
            p.acquisitionType,
            p.salary?.toString() || '-',
            p.duration?.toString() || '-',
            p.rescissionClause?.toString() || '-',
          ])
        })
      }
    })

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(cell => `"${cell}"`).join(',')),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `lega_${league?.name || 'export'}_rose.csv`
    link.click()

    setIsSubmitting(false)
  }

  async function handleAssignPrize() {
    if (!selectedPrizeMemberId || !prizeAmount) {
      setError('Seleziona un manager e inserisci un importo')
      return
    }

    const amount = parseInt(prizeAmount)
    if (isNaN(amount) || amount <= 0) {
      setError('L\'importo deve essere un numero intero positivo')
      return
    }

    setError('')
    setIsSubmitting(true)

    const res = await adminApi.assignPrize(leagueId, selectedPrizeMemberId, amount, prizeReason || undefined)
    if (res.success) {
      setSuccess(res.message || 'Premio assegnato!')
      setSelectedPrizeMemberId('')
      setPrizeAmount('')
      setPrizeReason('')
      loadData() // Refresh member budgets
      loadPrizeHistory() // Refresh prize history
    } else {
      setError(res.message || 'Errore nell\'assegnazione del premio')
    }
    setIsSubmitting(false)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-300 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-accent-500/30 border-t-accent-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg text-gray-400">Caricamento pannello admin...</p>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-dark-300 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">🔒</div>
          <p className="text-xl text-danger-400">Accesso non autorizzato</p>
        </div>
      </div>
    )
  }

  const activeSession = sessions.find(s => s.status === 'ACTIVE')
  const pendingMembers = members.filter(m => m.status === 'PENDING')
  const activeMembers = members.filter(m => m.status === 'ACTIVE')

  return (
    <div className="min-h-screen bg-dark-300">
      <Navigation currentPage="adminPanel" leagueId={leagueId} isLeagueAdmin={true} onNavigate={onNavigate} />

      {/* Page Header */}
      <div className="bg-gradient-to-r from-dark-200 via-surface-200 to-dark-200 border-b border-surface-50/20">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex justify-between items-end">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-accent-500 to-accent-700 flex items-center justify-center shadow-glow-gold">
                <span className="text-3xl">⚙️</span>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Pannello Admin</h1>
                <p className="text-gray-400 mt-1">{league?.name}</p>
              </div>
            </div>
            <div className="px-4 py-2 bg-accent-500/20 text-accent-400 rounded-full text-sm font-bold border border-accent-500/40">
              Admin di Lega
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Alerts */}
        {error && (
          <div className="bg-danger-500/20 border border-danger-500/50 text-danger-400 p-4 rounded-xl mb-6">{error}</div>
        )}
        {success && (
          <div className="bg-secondary-500/20 border border-secondary-500/50 text-secondary-400 p-4 rounded-xl mb-6">{success}</div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-8 flex-wrap">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-glow'
                  : 'bg-surface-200 text-gray-400 border border-surface-50/20 hover:border-primary-500/50 hover:text-white'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
              {tab.id === 'members' && <span className="bg-surface-300 px-2 py-0.5 rounded-full text-xs">{members.length}</span>}
              {tab.id === 'invites' && invites.length > 0 && <span className="bg-accent-500/20 text-accent-400 px-2 py-0.5 rounded-full text-xs">{invites.length}</span>}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid md:grid-cols-4 gap-4">
              <div className="bg-surface-200 rounded-xl border border-surface-50/20 p-5 text-center">
                <p className="text-4xl font-bold text-primary-400">{activeMembers.length}/{league?.maxParticipants}</p>
                <p className="text-sm text-gray-400 mt-1">Partecipanti attivi</p>
              </div>
              <div className="bg-surface-200 rounded-xl border border-accent-500/30 p-5 text-center">
                <p className="text-4xl font-bold text-accent-400">{pendingMembers.length}</p>
                <p className="text-sm text-gray-400 mt-1">Richieste in attesa</p>
              </div>
              <div className="bg-surface-200 rounded-xl border border-secondary-500/30 p-5 text-center">
                <p className="text-4xl font-bold text-secondary-400">{league?.initialBudget}</p>
                <p className="text-sm text-gray-400 mt-1">Budget iniziale</p>
              </div>
              <div className="bg-surface-200 rounded-xl border border-surface-50/20 p-5 text-center">
                <p className="text-4xl font-bold text-blue-400">{sessions.length}</p>
                <p className="text-sm text-gray-400 mt-1">Sessioni totali</p>
              </div>
            </div>

            {/* League Config */}
            <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
              <div className="p-5 border-b border-surface-50/20">
                <h3 className="text-xl font-bold text-white flex items-center gap-3">
                  <span>📋</span> Configurazione Lega
                </h3>
              </div>
              <div className="p-5">
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="bg-surface-300 rounded-lg p-4">
                    <p className="text-sm text-gray-400 mb-1">Nome</p>
                    <p className="font-semibold text-white text-lg">{league?.name}</p>
                  </div>
                  <div className="bg-surface-300 rounded-lg p-4">
                    <p className="text-sm text-gray-400 mb-1">Stato</p>
                    <p className={`font-semibold text-lg ${league?.status === 'ACTIVE' ? 'text-secondary-400' : 'text-primary-400'}`}>
                      {league?.status === 'DRAFT' ? 'Creazione Lega' : league?.status === 'ACTIVE' ? 'Primo Mercato' : league?.status}
                    </p>
                  </div>
                  <div className="bg-surface-300 rounded-lg p-4">
                    <p className="text-sm text-gray-400 mb-1">Codice Invito</p>
                    <p className="font-mono text-lg text-primary-400">{league?.id.slice(0, 8)}</p>
                  </div>
                  <div className="bg-surface-300 rounded-lg p-4">
                    <p className="text-sm text-gray-400 mb-1">Partecipanti</p>
                    <p className="font-semibold text-white text-lg">{activeMembers.length} / {league?.maxParticipants}</p>
                  </div>
                  <div className="bg-surface-300 rounded-lg p-4">
                    <p className="text-sm text-gray-400 mb-1">Minimo Richiesto</p>
                    <p className="font-semibold text-white text-lg">{league?.minParticipants || 6}</p>
                  </div>
                  <div className="bg-surface-300 rounded-lg p-4">
                    <p className="text-sm text-gray-400 mb-1">Slot Rosa</p>
                    <p className="font-semibold text-lg">
                      <span className="text-amber-400">P:{league?.goalkeeperSlots}</span>{' '}
                      <span className="text-blue-400">D:{league?.defenderSlots}</span>{' '}
                      <span className="text-emerald-400">C:{league?.midfielderSlots}</span>{' '}
                      <span className="text-red-400">A:{league?.forwardSlots}</span>
                    </p>
                  </div>
                </div>

                {/* Start League */}
                {league?.status === 'DRAFT' && (
                  <div className="mt-6 p-5 bg-primary-500/10 border border-primary-500/30 rounded-xl">
                    <h4 className="font-bold text-white text-lg mb-3">Avvia Lega</h4>
                    <p className="text-gray-300 mb-4">
                      Per passare al <span className="text-primary-400 font-semibold">Primo Mercato</span> servono almeno {league?.minParticipants || 6} partecipanti.
                      Attualmente: <span className="font-bold text-white">{activeMembers.length}</span> partecipanti.
                    </p>
                    <div className="bg-accent-500/10 border border-accent-500/30 rounded-lg p-4 mb-4">
                      <p className="text-accent-400 text-sm">
                        <strong>Attenzione:</strong> Una volta passati al Primo Mercato, non sarà più possibile
                        aggiungere nuovi manager.
                      </p>
                    </div>
                    {activeMembers.length >= (league?.minParticipants || 6) ? (
                      <Button variant="accent" size="lg" onClick={handleStartLeague} disabled={isSubmitting}>
                        {isSubmitting ? 'Avvio...' : 'Passa al Primo Mercato'}
                      </Button>
                    ) : (
                      <p className="text-danger-400 font-medium">
                        Mancano {(league?.minParticipants || 6) - activeMembers.length} partecipanti
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Active Session */}
            <div className={`bg-surface-200 rounded-xl border overflow-hidden ${activeSession ? 'border-secondary-500/50' : 'border-surface-50/20'}`}>
              <div className="p-5 border-b border-surface-50/20">
                <h3 className="text-xl font-bold text-white flex items-center gap-3">
                  <span>🔨</span> Sessione Corrente
                </h3>
              </div>
              <div className="p-5">
                {activeSession ? (
                  <div>
                    <div className="flex items-center gap-4 mb-5">
                      <span className="px-4 py-2 bg-secondary-500/20 text-secondary-400 rounded-full font-semibold border border-secondary-500/40">
                        {activeSession.type === 'PRIMO_MERCATO' ? 'Primo Mercato' : 'Mercato Ricorrente'}
                      </span>
                      <span className="text-gray-300">
                        Fase: <strong className="text-white">{activeSession.currentPhase || 'Non impostata'}</strong>
                      </span>
                    </div>

                    {/* Consolidation Status for CONTRATTI phase */}
                    {activeSession.currentPhase === 'CONTRATTI' && consolidationStatus?.inContrattiPhase && (
                      <div className="mb-5 p-4 bg-surface-300 rounded-xl border border-surface-50/20">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-white font-semibold">Stato Consolidamento Contratti</h4>
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            consolidationStatus.allConsolidated
                              ? 'bg-secondary-500/20 text-secondary-400 border border-secondary-500/40'
                              : 'bg-warning-500/20 text-warning-400 border border-warning-500/40'
                          }`}>
                            {consolidationStatus.consolidatedCount}/{consolidationStatus.totalCount} completati
                          </span>
                        </div>
                        <div className="space-y-2">
                          {consolidationStatus.managers.map(m => (
                            <div key={m.memberId} className="flex items-center justify-between p-2 bg-surface-200 rounded-lg">
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${m.isConsolidated ? 'bg-secondary-400' : 'bg-warning-400'}`}></span>
                                <span className="text-white">{m.username}</span>
                                <span className="text-gray-500 text-xs">({m.playerCount} giocatori)</span>
                              </div>
                              {m.isConsolidated ? (
                                <span className="text-secondary-400 text-xs">
                                  Consolidato {m.consolidatedAt ? new Date(m.consolidatedAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : ''}
                                </span>
                              ) : (
                                <span className="text-warning-400 text-xs">In attesa</span>
                              )}
                            </div>
                          ))}
                        </div>
                        {!consolidationStatus.allConsolidated && (
                          <p className="text-warning-400 text-sm mt-3">
                            Non puoi passare alla fase successiva finché tutti i manager non hanno consolidato.
                          </p>
                        )}
                      </div>
                    )}

                    <div className="mb-5">
                      <p className="text-sm text-gray-400 mb-3 uppercase tracking-wide">Cambia fase</p>
                      <div className="flex flex-wrap gap-2">
                        {MARKET_PHASES.filter(p => activeSession.type === 'PRIMO_MERCATO' || !p.onlyFirst).map(phase => {
                          // Disable phase change from CONTRATTI if not all consolidated
                          const isDisabled = isSubmitting || (
                            activeSession.currentPhase === 'CONTRATTI' &&
                            phase.value !== 'CONTRATTI' &&
                            !consolidationStatus?.allConsolidated
                          )
                          return (
                            <Button
                              key={phase.value}
                              size="sm"
                              variant={activeSession.currentPhase === phase.value ? 'primary' : 'outline'}
                              onClick={() => handleSetPhase(activeSession.id, phase.value)}
                              disabled={isDisabled}
                              className={isDisabled && phase.value !== activeSession.currentPhase ? 'opacity-50' : ''}
                            >
                              {phase.label}
                            </Button>
                          )
                        })}
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Button variant="danger" onClick={() => handleCloseSession(activeSession.id)} disabled={isSubmitting}>
                        Chiudi Sessione
                      </Button>
                      <Button variant="outline" onClick={handleSimulateChatMessage} disabled={isSubmitting} className="border-purple-500/50 text-purple-400">
                        Simula Messaggio Chat
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-gray-400 mb-5">Nessuna sessione attiva</p>
                    {(() => {
                      const hasPrimoMercato = sessions.some(s => s.type === 'PRIMO_MERCATO')
                      return (
                        <div className="flex gap-3">
                          {!hasPrimoMercato && (
                            <Button size="lg" onClick={() => handleCreateSession(false)} disabled={isSubmitting}>
                              Avvia Primo Mercato
                            </Button>
                          )}
                          {hasPrimoMercato && (
                            <Button size="lg" onClick={() => handleCreateSession(true)} disabled={isSubmitting}>
                              Avvia Mercato Ricorrente
                            </Button>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Members Tab */}
        {activeTab === 'members' && (
          <div className="space-y-6">
            {pendingMembers.length > 0 && (
              <div className="bg-surface-200 rounded-xl border border-accent-500/50 overflow-hidden">
                <div className="p-5 border-b border-surface-50/20 bg-accent-500/10">
                  <h3 className="text-xl font-bold text-accent-400">Richieste in Attesa ({pendingMembers.length})</h3>
                </div>
                <div className="p-5 space-y-3">
                  {pendingMembers.map(member => (
                    <div key={member.id} className="flex justify-between items-center p-4 bg-surface-300 rounded-lg">
                      <div>
                        <p className="font-semibold text-white text-lg">{member.user.username}</p>
                        <p className="text-sm text-gray-400">{member.user.email}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={() => handleMemberAction(member.id, 'accept')} disabled={isSubmitting}>
                          Accetta
                        </Button>
                        <Button variant="outline" onClick={() => handleMemberAction(member.id, 'reject')} disabled={isSubmitting}>
                          Rifiuta
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
              <div className="p-5 border-b border-surface-50/20">
                <h3 className="text-xl font-bold text-white">Membri Attivi ({activeMembers.length})</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-surface-300">
                    <tr>
                      <th className="px-5 py-4 text-left text-sm text-gray-400 font-semibold">Username</th>
                      <th className="px-5 py-4 text-left text-sm text-gray-400 font-semibold">Team</th>
                      <th className="px-5 py-4 text-center text-sm text-gray-400 font-semibold">Ruolo</th>
                      <th className="px-5 py-4 text-right text-sm text-gray-400 font-semibold">Budget</th>
                      <th className="px-5 py-4 text-right text-sm text-gray-400 font-semibold">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-50/10">
                    {activeMembers.map(member => (
                      <tr key={member.id} className="hover:bg-surface-300/50 transition-colors">
                        <td className="px-5 py-4">
                          <p className="font-semibold text-white">{member.user.username}</p>
                          <p className="text-xs text-gray-500">{member.user.email}</p>
                        </td>
                        <td className="px-5 py-4 text-gray-300">{member.teamName || '-'}</td>
                        <td className="px-5 py-4 text-center">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            member.role === 'ADMIN'
                              ? 'bg-accent-500/20 text-accent-400 border border-accent-500/40'
                              : 'bg-surface-300 text-gray-400'
                          }`}>
                            {member.role === 'ADMIN' ? 'Presidente' : 'Manager'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right font-mono text-accent-400 text-lg">{member.currentBudget}</td>
                        <td className="px-5 py-4 text-right">
                          {member.role !== 'ADMIN' && (
                            <Button size="sm" variant="outline" className="border-danger-500/50 text-danger-400" onClick={() => handleMemberAction(member.id, 'kick')} disabled={isSubmitting}>
                              Espelli
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Invites Tab */}
        {activeTab === 'invites' && (
          <div className="space-y-6">
            <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
              <div className="p-5 border-b border-surface-50/20">
                <h3 className="text-xl font-bold text-white">Invia Nuovo Invito</h3>
              </div>
              <div className="p-5">
                <div className="flex gap-4">
                  <Input
                    type="email"
                    value={newInviteEmail}
                    onChange={(e) => setNewInviteEmail(e.target.value)}
                    placeholder="Email dell'invitato..."
                    className="flex-1"
                  />
                  <Button onClick={handleCreateInvite} disabled={!newInviteEmail.trim() || isSubmitting}>
                    {isSubmitting ? 'Invio...' : 'Invia Invito'}
                  </Button>
                </div>
                <p className="text-sm text-gray-400 mt-3">
                  L'utente invitato riceverà un link per entrare direttamente nella lega.
                </p>
              </div>
            </div>

            <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
              <div className="p-5 border-b border-surface-50/20">
                <h3 className="text-xl font-bold text-white">Inviti in Attesa ({invites.length})</h3>
              </div>
              <div className="p-5">
                {invites.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-3 opacity-50">📭</div>
                    <p className="text-gray-500">Nessun invito in attesa</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {invites.map(invite => (
                      <div key={invite.id} className="flex justify-between items-center p-4 bg-surface-300 rounded-lg">
                        <div>
                          <p className="font-semibold text-white">{invite.email}</p>
                          <p className="text-xs text-gray-500">
                            Inviato: {new Date(invite.createdAt).toLocaleDateString('it-IT')} - Scade: {new Date(invite.expiresAt).toLocaleDateString('it-IT')}
                          </p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => handleCancelInvite(invite.id)} disabled={isSubmitting}>
                          Annulla
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Sessions Tab */}
        {activeTab === 'sessions' && (
          <div className="space-y-6">
            <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
              <div className="p-5 border-b border-surface-50/20">
                <h3 className="text-xl font-bold text-white">Storico Sessioni</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-surface-300">
                    <tr>
                      <th className="px-5 py-4 text-left text-sm text-gray-400 font-semibold">Tipo</th>
                      <th className="px-5 py-4 text-center text-sm text-gray-400 font-semibold">Stagione</th>
                      <th className="px-5 py-4 text-center text-sm text-gray-400 font-semibold">Semestre</th>
                      <th className="px-5 py-4 text-center text-sm text-gray-400 font-semibold">Fase</th>
                      <th className="px-5 py-4 text-center text-sm text-gray-400 font-semibold">Stato</th>
                      <th className="px-5 py-4 text-right text-sm text-gray-400 font-semibold">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-50/10">
                    {sessions.map(session => (
                      <tr key={session.id} className="hover:bg-surface-300/50 transition-colors">
                        <td className="px-5 py-4 font-semibold text-white">
                          {session.type === 'PRIMO_MERCATO' ? 'Primo Mercato' : 'Mercato Ricorrente'}
                        </td>
                        <td className="px-5 py-4 text-center text-gray-300">{session.season}</td>
                        <td className="px-5 py-4 text-center text-gray-300">{session.semester}</td>
                        <td className="px-5 py-4 text-center text-gray-300">{session.currentPhase || '-'}</td>
                        <td className="px-5 py-4 text-center">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            session.status === 'ACTIVE' ? 'bg-secondary-500/20 text-secondary-400' :
                            session.status === 'COMPLETED' ? 'bg-gray-500/20 text-gray-400' :
                            'bg-accent-500/20 text-accent-400'
                          }`}>
                            {session.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right text-gray-400">
                          {new Date(session.createdAt).toLocaleDateString('it-IT')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {sessions.length === 0 && (
                  <div className="text-center py-12">
                    <div className="text-4xl mb-3 opacity-50">📭</div>
                    <p className="text-gray-500">Nessuna sessione creata</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Prizes Tab */}
        {activeTab === 'prizes' && (
          <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
            <div className="p-5 border-b border-surface-50/20">
              <h3 className="text-xl font-bold text-white">Assegna Premi</h3>
              <p className="text-sm text-gray-400 mt-1">
                Incrementa il budget dei manager come premio per i risultati del semestre
              </p>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Form per assegnare premio */}
                <div className="bg-surface-300 rounded-lg p-5">
                  <h4 className="font-semibold text-white mb-4">Nuovo Premio</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Manager</label>
                      <select
                        value={selectedPrizeMemberId}
                        onChange={(e) => setSelectedPrizeMemberId(e.target.value)}
                        className="w-full bg-surface-200 border border-surface-50/30 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-accent-500/50"
                      >
                        <option value="">Seleziona manager...</option>
                        {activeMembers.map(m => (
                          <option key={m.id} value={m.id}>
                            {m.teamName} ({m.user.username}) - {m.currentBudget}M
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Importo (M)</label>
                      <Input
                        type="number"
                        value={prizeAmount}
                        onChange={(e) => setPrizeAmount(e.target.value)}
                        placeholder="es. 50"
                        min="1"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Motivazione (opzionale)</label>
                      <Input
                        type="text"
                        value={prizeReason}
                        onChange={(e) => setPrizeReason(e.target.value)}
                        placeholder="es. 1° classificato, miglior attacco..."
                      />
                    </div>
                    <Button
                      onClick={handleAssignPrize}
                      disabled={isSubmitting || !selectedPrizeMemberId || !prizeAmount}
                      className="w-full"
                    >
                      {isSubmitting ? 'Assegnando...' : 'Assegna Premio'}
                    </Button>
                  </div>
                </div>

                {/* Riepilogo budget attuali */}
                <div className="bg-surface-300 rounded-lg p-5">
                  <h4 className="font-semibold text-white mb-4">Budget Attuali</h4>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {activeMembers
                      .sort((a, b) => b.currentBudget - a.currentBudget)
                      .map(m => (
                        <div
                          key={m.id}
                          className="flex items-center justify-between p-3 bg-surface-200 rounded-lg"
                        >
                          <div>
                            <span className="text-white font-medium">{m.teamName}</span>
                            <span className="text-gray-500 text-sm ml-2">({m.user.username})</span>
                          </div>
                          <span className={`font-bold ${m.currentBudget < 0 ? 'text-danger-400' : 'text-secondary-400'}`}>
                            {m.currentBudget}M
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>

              {/* Storico premi */}
              <div className="mt-6">
                <h4 className="font-semibold text-white mb-4">Storico Premi</h4>
                {isLoadingPrizes ? (
                  <div className="text-center py-8">
                    <div className="w-8 h-8 border-2 border-accent-500/30 border-t-accent-500 rounded-full animate-spin mx-auto"></div>
                  </div>
                ) : prizeHistory.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    Nessun premio assegnato
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-surface-300">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Data</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Manager</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-gray-300">Importo</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Motivazione</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Assegnato da</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-50/10">
                        {prizeHistory.map(prize => (
                          <tr key={prize.id} className="hover:bg-surface-300/50">
                            <td className="px-4 py-3 text-sm text-gray-400">
                              {new Date(prize.createdAt).toLocaleDateString('it-IT', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-white font-medium">{prize.teamName}</span>
                              <span className="text-gray-500 text-sm ml-2">({prize.username})</span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="text-secondary-400 font-bold">+{prize.amount}M</span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-400">
                              {prize.reason || '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {prize.adminUsername}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Appeals Tab */}
        {activeTab === 'appeals' && (
          <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
            <div className="p-5 border-b border-surface-50/20">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">Gestione Ricorsi</h3>
                <div className="flex items-center gap-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setAppealFilter('')}
                      className={`px-3 py-1 rounded-lg text-sm ${appealFilter === '' ? 'bg-primary-500 text-white' : 'bg-surface-300 text-gray-400 hover:bg-surface-400'}`}
                    >
                      Tutti
                    </button>
                    <button
                      onClick={() => setAppealFilter('PENDING')}
                      className={`px-3 py-1 rounded-lg text-sm ${appealFilter === 'PENDING' ? 'bg-amber-500 text-white' : 'bg-surface-300 text-gray-400 hover:bg-surface-400'}`}
                    >
                      In Attesa
                    </button>
                    <button
                      onClick={() => setAppealFilter('ACCEPTED')}
                      className={`px-3 py-1 rounded-lg text-sm ${appealFilter === 'ACCEPTED' ? 'bg-green-500 text-white' : 'bg-surface-300 text-gray-400 hover:bg-surface-400'}`}
                    >
                      Accettati
                    </button>
                    <button
                      onClick={() => setAppealFilter('REJECTED')}
                      className={`px-3 py-1 rounded-lg text-sm ${appealFilter === 'REJECTED' ? 'bg-red-500 text-white' : 'bg-surface-300 text-gray-400 hover:bg-surface-400'}`}
                    >
                      Respinti
                    </button>
                  </div>
                  <button
                    onClick={handleSimulateAppeal}
                    disabled={isSubmitting}
                    className="px-3 py-1 rounded-lg text-sm bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1"
                  >
                    {isSubmitting ? '...' : 'Simula Ricorso'}
                  </button>
                </div>
              </div>
            </div>
            <div className="p-5">
              {isLoadingAppeals ? (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-2 border-accent-500/30 border-t-accent-500 rounded-full animate-spin mx-auto"></div>
                </div>
              ) : appeals.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {appealFilter === 'PENDING' ? 'Nessun ricorso in attesa' : 'Nessun ricorso trovato'}
                </div>
              ) : (
                <div className="space-y-4">
                  {appeals.map(appeal => (
                    <div key={appeal.id} className={`border rounded-xl p-4 ${
                      appeal.status === 'PENDING' ? 'border-amber-500/50 bg-amber-500/10' :
                      appeal.status === 'ACCEPTED' ? 'border-green-500/50 bg-green-500/10' :
                      'border-red-500/50 bg-red-500/10'
                    }`}>
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                            appeal.status === 'PENDING' ? 'bg-amber-500 text-white' :
                            appeal.status === 'ACCEPTED' ? 'bg-green-500 text-white' :
                            'bg-red-500 text-white'
                          }`}>
                            {appeal.status === 'PENDING' ? 'IN ATTESA' : appeal.status === 'ACCEPTED' ? 'ACCETTATO' : 'RESPINTO'}
                          </span>
                          <span className="text-gray-400 text-sm ml-3">
                            {new Date(appeal.createdAt).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <span className="text-gray-400 text-sm">
                          da <span className="text-white font-medium">{appeal.member.user.username}</span>
                        </span>
                      </div>

                      {/* Dettagli Asta */}
                      <div className="bg-surface-300 rounded-lg p-3 mb-3">
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                            appeal.auction.player.position === 'P' ? 'bg-amber-500' :
                            appeal.auction.player.position === 'D' ? 'bg-blue-500' :
                            appeal.auction.player.position === 'C' ? 'bg-green-500' : 'bg-red-500'
                          }`}>{appeal.auction.player.position}</span>
                          <div>
                            <p className="font-bold text-white">{appeal.auction.player.name}</p>
                            <p className="text-sm text-gray-400">{appeal.auction.player.team}</p>
                          </div>
                          <div className="ml-auto text-right">
                            <p className="text-accent-400 font-bold">{appeal.auction.currentPrice}M</p>
                            {appeal.auction.winner && (
                              <p className="text-sm text-gray-400">Vinta da: {appeal.auction.winner.user.username}</p>
                            )}
                          </div>
                        </div>
                        {appeal.auction.bids.length > 0 && (
                          <div className="text-xs text-gray-500 mt-2">
                            Ultime offerte: {appeal.auction.bids.slice(0, 3).map(b => `${b.bidder.user.username} (${b.amount})`).join(', ')}
                          </div>
                        )}
                      </div>

                      {/* Motivazione Ricorso */}
                      <div className="mb-3">
                        <p className="text-sm text-gray-400 mb-1">Motivazione:</p>
                        <p className="text-white bg-surface-400 rounded-lg p-3 italic">"{appeal.content}"</p>
                      </div>

                      {/* Risoluzione */}
                      {appeal.status !== 'PENDING' && appeal.resolvedBy && (
                        <div className="bg-surface-400 rounded-lg p-3 mb-3">
                          <p className="text-sm text-gray-400">
                            Risolto da <span className="text-white">{appeal.resolvedBy.user.username}</span> il {new Date(appeal.resolvedAt!).toLocaleDateString('it-IT')}
                          </p>
                          {appeal.resolutionNote && (
                            <p className="text-sm text-white mt-1">Nota: {appeal.resolutionNote}</p>
                          )}
                        </div>
                      )}

                      {/* Azioni Admin */}
                      {appeal.status === 'PENDING' && (
                        <div className="border-t border-surface-50/20 pt-3 mt-3">
                          {selectedAppealId === appeal.id ? (
                            <div className="space-y-3">
                              <textarea
                                className="w-full bg-surface-400 border border-surface-50/20 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm"
                                placeholder="Nota di risoluzione (opzionale)"
                                rows={2}
                                value={resolutionNote}
                                onChange={(e) => setResolutionNote(e.target.value)}
                              />
                              <div className="flex gap-2">
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => handleResolveAppeal(appeal.id, 'ACCEPTED')}
                                  disabled={isSubmitting}
                                >
                                  Accetta (Riapri Asta)
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleResolveAppeal(appeal.id, 'REJECTED')}
                                  disabled={isSubmitting}
                                >
                                  Respingi
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => { setSelectedAppealId(null); setResolutionNote('') }}
                                >
                                  Annulla
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => setSelectedAppealId(appeal.id)}
                            >
                              Gestisci Ricorso
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Export Tab */}
        {activeTab === 'export' && (
          <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
            <div className="p-5 border-b border-surface-50/20">
              <h3 className="text-xl font-bold text-white">Esporta Dati</h3>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between p-5 bg-surface-300 rounded-lg">
                <div>
                  <p className="font-semibold text-white text-lg">Lista Membri</p>
                  <p className="text-sm text-gray-400">Username, team, ruolo, budget</p>
                </div>
                <Button onClick={exportToCSV}>Scarica CSV</Button>
              </div>
              <div className="flex items-center justify-between p-5 bg-surface-300 rounded-lg">
                <div>
                  <p className="font-semibold text-white text-lg">Tutte le Rose</p>
                  <p className="text-sm text-gray-400">Giocatori, contratti, valori</p>
                </div>
                <Button variant="outline" onClick={exportRostersToCSV} disabled={isSubmitting}>
                  {isSubmitting ? 'Export...' : 'Scarica CSV'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
