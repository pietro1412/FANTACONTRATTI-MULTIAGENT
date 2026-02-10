import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import * as XLSX from 'xlsx'
import { leagueApi, auctionApi, adminApi, inviteApi, contractApi } from '../services/api'
import { Button } from '../components/ui/Button'
import { Navigation } from '../components/Navigation'
import { useSwipeGesture } from '../hooks/useSwipeGesture'
import haptic from '../utils/haptics'
import type { League, Member, MarketSession, Invite, ConsolidationStatus, Appeal, PrizeHistoryItem } from '../components/admin/types'

// Lazy-loaded tab components
const AdminMarketTab = lazy(() => import('../components/admin/AdminMarketTab').then(m => ({ default: m.AdminMarketTab })))
const AdminOverviewTab = lazy(() => import('../components/admin/AdminOverviewTab').then(m => ({ default: m.AdminOverviewTab })))
const AdminMembersTab = lazy(() => import('../components/admin/AdminMembersTab').then(m => ({ default: m.AdminMembersTab })))
const AdminPrizesTab = lazy(() => import('../components/admin/AdminPrizesTab').then(m => ({ default: m.AdminPrizesTab })))
const AdminAppealsTab = lazy(() => import('../components/admin/AdminAppealsTab').then(m => ({ default: m.AdminAppealsTab })))
const AdminInvitesTab = lazy(() => import('../components/admin/AdminInvitesTab').then(m => ({ default: m.AdminInvitesTab })))
const AdminSessionsTab = lazy(() => import('../components/admin/AdminSessionsTab').then(m => ({ default: m.AdminSessionsTab })))
const AdminExportTab = lazy(() => import('../components/admin/AdminExportTab').then(m => ({ default: m.AdminExportTab })))

interface AdminPanelProps {
  leagueId: string
  initialTab?: string
  onNavigate: (page: string, params?: Record<string, string>) => void
}

const TABS = [
  { id: 'market', label: 'Mercato', icon: '🏪' },
  { id: 'overview', label: 'Panoramica', icon: '📊' },
  { id: 'members', label: 'Membri', icon: '👥' },
  { id: 'prizes', label: 'Premi', icon: '🏆' },
  { id: 'appeals', label: 'Ricorsi', icon: '⚖️' },
  { id: 'invites', label: 'Inviti', icon: '✉️' },
  { id: 'sessions', label: 'Storico', icon: '📅' },
  { id: 'export', label: 'Export', icon: '📤' },
] as const

function TabLoadingFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-8 h-8 border-2 border-accent-500/30 border-t-accent-500 rounded-full animate-spin"></div>
    </div>
  )
}

export function AdminPanel({ leagueId, initialTab, onNavigate }: AdminPanelProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [league, setLeague] = useState<League | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [sessions, setSessions] = useState<MarketSession[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [isAdmin, setIsAdmin] = useState(false)

  const [activeTab, setActiveTab] = useState<typeof TABS[number]['id']>(
    (initialTab as typeof TABS[number]['id']) || 'market'
  )

  // Redirect to prizes page if initialTab is 'prizes'
  useEffect(() => {
    if (initialTab === 'prizes') {
      onNavigate('prizes', { leagueId })
    }
  }, [initialTab, leagueId, onNavigate])

  // Swipe gesture for tab navigation (mobile)
  const swipeToNextTab = useCallback(() => {
    const idx = TABS.findIndex(t => t.id === activeTab)
    if (idx < TABS.length - 1) setActiveTab(TABS[idx + 1].id)
  }, [activeTab])

  const swipeToPrevTab = useCallback(() => {
    const idx = TABS.findIndex(t => t.id === activeTab)
    if (idx > 0) setActiveTab(TABS[idx - 1].id)
  }, [activeTab])

  const { handlers: swipeHandlers } = useSwipeGesture({
    onSwipeLeft: swipeToNextTab,
    onSwipeRight: swipeToPrevTab,
  })

  const [newInviteEmail, setNewInviteEmail] = useState('')
  const [inviteDuration, setInviteDuration] = useState(7)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [auctionMode, setAuctionMode] = useState<'REMOTE' | 'IN_PRESENCE'>('REMOTE')
  const [consolidationStatus, setConsolidationStatus] = useState<ConsolidationStatus | null>(null)

  // Prize state
  const [selectedPrizeMemberId, setSelectedPrizeMemberId] = useState('')
  const [prizeAmount, setPrizeAmount] = useState('')
  const [prizeReason, setPrizeReason] = useState('')
  const [prizeHistory, setPrizeHistory] = useState<PrizeHistoryItem[]>([])
  const [isLoadingPrizes, setIsLoadingPrizes] = useState(false)

  // Appeals state
  const [appeals, setAppeals] = useState<Appeal[]>([])
  const [isLoadingAppeals, setIsLoadingAppeals] = useState(false)
  const [appealFilter, setAppealFilter] = useState<'PENDING' | 'ACCEPTED' | 'REJECTED' | ''>('')
  const [resolutionNote, setResolutionNote] = useState('')
  const [selectedAppealId, setSelectedAppealId] = useState<string | null>(null)

  // Roster incomplete modal state
  const [showRosterIncompleteModal, setShowRosterIncompleteModal] = useState(false)
  const [rosterIncompleteDetails, setRosterIncompleteDetails] = useState<string>('')

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

      // Se il ricorso è accettato, naviga alla stanza d'asta corretta
      if (decision === 'ACCEPTED' && res.data) {
        const data = res.data as { sessionId: string; auctionId: string; leagueId: string; isSvincolati: boolean }
        if (data.isSvincolati && data.leagueId) {
          onNavigate('svincolati', { leagueId: data.leagueId })
          return
        } else if (data.sessionId) {
          onNavigate('auction', { sessionId: data.sessionId })
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

  async function handleSimulateAllConsolidation() {
    setError('')
    setSuccess('')
    setIsSubmitting(true)

    const res = await contractApi.simulateAllConsolidation(leagueId)
    if (res.success) {
      setSuccess(res.message || 'Consolidamento simulato per tutti i manager')
      loadData()
    } else {
      setError(res.message || 'Errore nella simulazione')
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

    const res = await auctionApi.createSession(leagueId, isRegularMarket, auctionMode)
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
      if (res.message?.startsWith('Rose incomplete')) {
        setRosterIncompleteDetails(res.message)
        setShowRosterIncompleteModal(true)
      } else {
        setError(res.message || 'Errore')
      }
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
      if (res.message?.startsWith('Rose incomplete')) {
        setRosterIncompleteDetails(res.message)
        setShowRosterIncompleteModal(true)
      } else {
        setError(res.message || 'Errore')
      }
    }
    setIsSubmitting(false)
  }

  async function handleMemberAction(memberId: string, action: 'accept' | 'reject' | 'kick') {
    setError('')
    setIsSubmitting(true)

    const res = await leagueApi.updateMember(leagueId, memberId, action)
    if (res.success) {
      if (action === 'accept') haptic.approve()
      else haptic.reject()
      setSuccess(action === 'accept' ? 'Membro accettato' : action === 'reject' ? 'Richiesta rifiutata' : 'Membro espulso')
      loadData()
    } else {
      setError(res.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  function confirmKick(memberId: string, username: string) {
    if (window.confirm(`Sei sicuro di voler espellere ${username}? Questa azione non può essere annullata.`)) {
      handleMemberAction(memberId, 'kick')
    }
  }

  async function handleCreateInvite() {
    if (!newInviteEmail.trim()) return

    setError('')
    setIsSubmitting(true)

    const res = await inviteApi.create(leagueId, newInviteEmail.trim(), inviteDuration)
    if (res.success) {
      setSuccess(`Invito inviato a ${newInviteEmail} (valido ${inviteDuration} giorni)`)
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

  async function handleCompleteWithTestUsers() {
    setError('')
    setSuccess('')
    setIsSubmitting(true)

    const res = await adminApi.completeWithTestUsers(leagueId)
    if (res.success) {
      setSuccess(res.message || 'Manager di test aggiunti!')
      loadData()
    } else {
      setError(res.message || 'Errore nell\'aggiunta dei manager di test')
    }
    setIsSubmitting(false)
  }

  function exportToExcel() {
    const headers = ['Username', 'Team', 'Ruolo', 'Stato', 'Budget']
    const rows = members.map(m => [
      m.user.username,
      m.teamName || '-',
      m.role === 'ADMIN' ? 'Presidente' : 'DG',
      m.status === 'ACTIVE' ? 'Attivo' : m.status,
      m.currentBudget,
    ])

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    ws['!cols'] = [
      { wch: 20 }, { wch: 25 }, { wch: 12 }, { wch: 10 }, { wch: 10 },
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Membri')
    XLSX.writeFile(wb, `lega_${league?.name || 'export'}_membri.xlsx`)
  }

  async function exportRostersToExcel() {
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
        name: string; team: string; position: string; quotation: number
        acquisitionPrice: number; acquisitionType: string
        salary: number | null; duration: number | null; rescissionClause: number | null
      }>
    }>

    const headers = ['DG', 'Team', 'Budget', 'Giocatore', 'Squadra', 'Ruolo', 'Quotazione', 'Costo Acquisto', 'Tipo', 'Ingaggio', 'Durata', 'Clausola']
    const rows: (string | number | null)[][] = []

    data.forEach(member => {
      if (member.players.length === 0) {
        rows.push([member.username, member.teamName || '-', member.budget, '', '', '', null, null, '', null, null, null])
      } else {
        member.players.forEach((p, i) => {
          rows.push([
            i === 0 ? member.username : '',
            i === 0 ? (member.teamName || '-') : '',
            i === 0 ? member.budget : null,
            p.name, p.team, p.position, p.quotation, p.acquisitionPrice,
            p.acquisitionType === 'ASTA' ? 'Asta' : p.acquisitionType === 'RUBATA' ? 'Rubata' : p.acquisitionType,
            p.salary, p.duration, p.rescissionClause,
          ])
        })
      }
    })

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    ws['!cols'] = [
      { wch: 18 }, { wch: 22 }, { wch: 10 }, { wch: 25 }, { wch: 18 }, { wch: 8 },
      { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 10 },
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Rose')
    XLSX.writeFile(wb, `lega_${league?.name || 'export'}_rose.xlsx`)

    setIsSubmitting(false)
  }

  async function handleAssignPrize() {
    if (!selectedPrizeMemberId || !prizeAmount) {
      setError('Seleziona un Direttore Generale e inserisci un importo')
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
      loadData()
      loadPrizeHistory()
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
        <div className="max-w-[1600px] mx-auto px-6 py-6">
          <div className="flex justify-between items-end">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-accent-500 to-accent-700 flex items-center justify-center shadow-glow-gold">
                <span className="text-3xl">⚙️</span>
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white">Pannello Admin</h1>
                <p className="text-gray-400 mt-1">{league?.name}</p>
              </div>
            </div>
            <div className="px-4 py-2 bg-accent-500/20 text-accent-400 rounded-full text-sm font-bold border border-accent-500/40">
              Admin di Lega
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-[1600px] mx-auto px-4 md:px-6 py-4 md:py-8">
        {/* Alerts */}
        {error && (
          <div className="bg-danger-500/20 border border-danger-500/50 text-danger-400 p-3 md:p-4 rounded-xl mb-4 md:mb-6 text-sm">{error}</div>
        )}
        {success && (
          <div className="bg-secondary-500/20 border border-secondary-500/50 text-secondary-400 p-3 md:p-4 rounded-xl mb-4 md:mb-6 text-sm">{success}</div>
        )}

        {/* Tabs - scrollable on mobile, flex-wrap on desktop */}
        <div className="flex gap-2 mb-6 md:mb-8 overflow-x-auto md:overflow-x-visible md:flex-wrap scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                if (tab.id === 'prizes') {
                  onNavigate('prizes', { leagueId })
                } else {
                  setActiveTab(tab.id)
                }
              }}
              className={`whitespace-nowrap flex-shrink-0 px-3 md:px-5 py-2 md:py-3 rounded-xl font-semibold flex items-center gap-1.5 md:gap-2 transition-all text-sm md:text-base min-h-[44px] ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-glow'
                  : 'bg-surface-200 text-gray-400 border border-surface-50/20 hover:border-primary-500/50 hover:text-white'
              }`}
            >
              <span>{tab.icon}</span>
              <span className="hidden md:inline">{tab.label}</span>
              <span className="md:hidden">{tab.label.slice(0, 6)}{tab.label.length > 6 ? '.' : ''}</span>
              {tab.id === 'members' && <span className="bg-surface-300 px-1.5 py-0.5 rounded-full text-xs">{activeMembers.length}</span>}
              {tab.id === 'invites' && invites.length > 0 && <span className="bg-accent-500/20 text-accent-400 px-1.5 py-0.5 rounded-full text-xs">{invites.length}</span>}
            </button>
          ))}
        </div>

        {/* Tab content with swipe gesture */}
        <div onTouchStart={swipeHandlers.onTouchStart} onTouchEnd={swipeHandlers.onTouchEnd}>
          <Suspense fallback={<TabLoadingFallback />}>
            {activeTab === 'market' && (
              <AdminMarketTab
                league={league}
                activeMembers={activeMembers}
                activeSession={activeSession}
                sessions={sessions}
                consolidationStatus={consolidationStatus}
                isSubmitting={isSubmitting}
                handleStartLeague={handleStartLeague}
                handleSetPhase={handleSetPhase}
                handleCloseSession={handleCloseSession}
                handleCreateSession={handleCreateSession}
                handleSimulateAllConsolidation={handleSimulateAllConsolidation}
                auctionMode={auctionMode}
                setAuctionMode={setAuctionMode}
              />
            )}

            {activeTab === 'overview' && (
              <AdminOverviewTab
                league={league}
                activeMembers={activeMembers}
                pendingMembers={pendingMembers}
                sessions={sessions}
                activeSession={activeSession}
                consolidationStatus={consolidationStatus}
                isSubmitting={isSubmitting}
                auctionMode={auctionMode}
                setAuctionMode={setAuctionMode}
                handleStartLeague={handleStartLeague}
                handleSetPhase={handleSetPhase}
                handleCloseSession={handleCloseSession}
                handleCreateSession={handleCreateSession}
                handleSimulateAllConsolidation={handleSimulateAllConsolidation}
              />
            )}

            {activeTab === 'members' && (
              <AdminMembersTab
                activeMembers={activeMembers}
                pendingMembers={pendingMembers}
                isSubmitting={isSubmitting}
                handleMemberAction={handleMemberAction}
                confirmKick={confirmKick}
                handleCompleteWithTestUsers={handleCompleteWithTestUsers}
              />
            )}

            {activeTab === 'prizes' && (
              <AdminPrizesTab
                activeMembers={activeMembers}
                selectedPrizeMemberId={selectedPrizeMemberId}
                setSelectedPrizeMemberId={setSelectedPrizeMemberId}
                prizeAmount={prizeAmount}
                setPrizeAmount={setPrizeAmount}
                prizeReason={prizeReason}
                setPrizeReason={setPrizeReason}
                prizeHistory={prizeHistory}
                isLoadingPrizes={isLoadingPrizes}
                isSubmitting={isSubmitting}
                handleAssignPrize={handleAssignPrize}
              />
            )}

            {activeTab === 'appeals' && (
              <AdminAppealsTab
                appeals={appeals}
                isLoadingAppeals={isLoadingAppeals}
                isSubmitting={isSubmitting}
                appealFilter={appealFilter}
                setAppealFilter={setAppealFilter}
                resolutionNote={resolutionNote}
                setResolutionNote={setResolutionNote}
                selectedAppealId={selectedAppealId}
                setSelectedAppealId={setSelectedAppealId}
                handleResolveAppeal={handleResolveAppeal}
                handleSimulateAppeal={handleSimulateAppeal}
              />
            )}

            {activeTab === 'invites' && (
              <AdminInvitesTab
                invites={invites}
                newInviteEmail={newInviteEmail}
                setNewInviteEmail={setNewInviteEmail}
                inviteDuration={inviteDuration}
                setInviteDuration={setInviteDuration}
                isSubmitting={isSubmitting}
                handleCreateInvite={handleCreateInvite}
                handleCancelInvite={handleCancelInvite}
              />
            )}

            {activeTab === 'sessions' && (
              <AdminSessionsTab sessions={sessions} />
            )}

            {activeTab === 'export' && (
              <AdminExportTab
                isSubmitting={isSubmitting}
                exportToExcel={exportToExcel}
                exportRostersToExcel={exportRostersToExcel}
              />
            )}
          </Suspense>
        </div>{/* end swipe gesture wrapper */}
      </main>

      {/* Roster Incomplete Modal */}
      {showRosterIncompleteModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-200 rounded-2xl p-6 max-w-lg w-full border border-surface-50/20 shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-warning-500/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">⚠️</span>
              </div>
              <h3 className="text-2xl font-bold text-white">Rose Incomplete</h3>
              <p className="text-gray-400 mt-2">Non puoi chiudere l'asta finché tutte le rose non sono complete.</p>
            </div>

            <div className="bg-surface-300 rounded-xl p-4 mb-6">
              <h4 className="text-sm font-semibold text-warning-400 uppercase tracking-wide mb-3">Dettaglio Mancanti</h4>
              <div className="space-y-2">
                {rosterIncompleteDetails
                  .replace('Rose incomplete. ', '')
                  .split('; ')
                  .map((detail, idx) => {
                    const [manager, missing] = detail.split(': mancano ')
                    return (
                      <div key={idx} className="flex justify-between items-start py-2 border-b border-surface-50/10 last:border-0">
                        <span className="font-medium text-white">{manager}</span>
                        <span className="text-sm text-gray-400 text-right">{missing}</span>
                      </div>
                    )
                  })}
              </div>
            </div>

            <Button
              size="lg"
              className="w-full"
              onClick={() => setShowRosterIncompleteModal(false)}
            >
              Ho capito
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
