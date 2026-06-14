import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react'
import * as XLSX from 'xlsx'
import { useConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { CockpitShell } from '@/components/cockpit/CockpitShell'
import { LeagueCrest } from '@/components/ui/LeagueCrest'
import { leagueApi, auctionApi, adminApi, inviteApi, contractApi } from '../services/api'
import { Button } from '../components/ui/Button'
import { Navigation } from '../components/Navigation'
import { useSwipeGesture } from '../hooks/useSwipeGesture'
import haptic from '../utils/haptics'
import type { League, Member, MarketSession, Invite, ConsolidationStatus, Appeal } from '../components/admin/types'

// Lazy-loaded tab components
const AdminPhasesTab = lazy(() => import('../components/admin/AdminPhasesTab').then(m => ({ default: m.AdminPhasesTab })))
const AdminMembersTab = lazy(() => import('../components/admin/AdminMembersTab').then(m => ({ default: m.AdminMembersTab })))
const AdminRequestsTab = lazy(() => import('../components/admin/AdminRequestsTab').then(m => ({ default: m.AdminRequestsTab })))
const AdminAppealsTab = lazy(() => import('../components/admin/AdminAppealsTab').then(m => ({ default: m.AdminAppealsTab })))
const AdminExportTab = lazy(() => import('../components/admin/AdminExportTab').then(m => ({ default: m.AdminExportTab })))

interface AdminPanelProps {
  leagueId: string
  initialTab?: string
  onNavigate: (page: string, params?: Record<string, string>) => void
}

type TabId = 'phases' | 'members' | 'appeals' | 'export'

interface TabDef {
  id: TabId
  label: string
  icon: React.ReactNode
}

const TABS: TabDef[] = [
  {
    id: 'phases',
    label: 'Fasi & Stato',
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    id: 'members',
    label: 'Gestione Membri',
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4zm6 0a3 3 0 10-3-3" />
      </svg>
    ),
  },
  {
    id: 'appeals',
    label: 'Ricorsi',
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l9-2 9 2M12 4v16m-7-4l-2-6h4l-2 6zm14 0l-2-6h4l-2 6z" />
      </svg>
    ),
  },
  {
    id: 'export',
    label: 'Export Dati',
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    ),
  },
]

function TabLoadingFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-8 h-8 border-2 border-accent-500/30 border-t-accent-500 rounded-full animate-spin"></div>
    </div>
  )
}

export function AdminPanel({ leagueId, initialTab, onNavigate }: AdminPanelProps) {
  const { confirm: confirmDialog } = useConfirmDialog()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(true)
  const [league, setLeague] = useState<League | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [sessions, setSessions] = useState<MarketSession[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [isAdmin, setIsAdmin] = useState(false)

  // Map old tab IDs to new ones for backwards compatibility
  const mapTab = (tab?: string): TabId => {
    switch (tab) {
      case 'market':
      case 'overview':
      case 'sessions':
        return 'phases'
      // Gestione Membri ora include le richieste di adesione e gli inviti
      case 'members':
      case 'requests':
      case 'invites':
        return 'members'
      case 'appeals':
        return 'appeals'
      case 'export':
        return 'export'
      case 'phases':
        return 'phases'
      default:
        return 'phases'
    }
  }

  const [activeTab, setActiveTab] = useState<TabId>(mapTab(initialTab))

  // Redirect to prizes page if initialTab is 'prizes'
  useEffect(() => {
    if (initialTab === 'prizes') {
      onNavigate('prizes', { leagueId })
    }
  }, [initialTab, leagueId, onNavigate])

  // Swipe gesture for tab navigation (mobile)
  const swipeToNextTab = useCallback(() => {
    const idx = TABS.findIndex(t => t.id === activeTab)
    const nextTab = TABS[idx + 1]
    if (idx < TABS.length - 1 && nextTab) setActiveTab(nextTab.id)
  }, [activeTab])

  const swipeToPrevTab = useCallback(() => {
    const idx = TABS.findIndex(t => t.id === activeTab)
    const prevTab = TABS[idx - 1]
    if (idx > 0 && prevTab) setActiveTab(prevTab.id)
  }, [activeTab])

  const { handlers: swipeHandlers } = useSwipeGesture({
    onSwipeLeft: swipeToNextTab,
    onSwipeRight: swipeToPrevTab,
  })

  const [newInviteEmail, setNewInviteEmail] = useState('')
  const [inviteDuration, setInviteDuration] = useState(7)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [auctionMode, setAuctionMode] = useState<'REMOTE' | 'IN_PRESENCE'>('REMOTE')
  const [consolidationStatus, setConsolidationStatus] = useState<ConsolidationStatus | null>(null)

  // Appeals state
  const [appeals, setAppeals] = useState<Appeal[]>([])
  const [isLoadingAppeals, setIsLoadingAppeals] = useState(false)
  const [appealFilter, setAppealFilter] = useState<'PENDING' | 'ACCEPTED' | 'REJECTED' | ''>('')
  const [resolutionNote, setResolutionNote] = useState('')
  const [selectedAppealId, setSelectedAppealId] = useState<string | null>(null)

  // Roster incomplete modal state (blocco con recovery → resta modale)
  const [showRosterIncompleteModal, setShowRosterIncompleteModal] = useState(false)
  const [rosterIncompleteDetails, setRosterIncompleteDetails] = useState<string>('')

  // League image upload
  const leagueImageInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void loadData()
  }, [leagueId])

  useEffect(() => {
    if (activeTab === 'appeals') {
      void loadAppeals()
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
    setIsSubmitting(true)

    const res = await auctionApi.resolveAppeal(appealId, decision, resolutionNote || undefined)
    if (res.success) {
      toast.success(res.message || 'Ricorso gestito')
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

      void loadAppeals()
    } else {
      toast.error(res.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  async function handleSimulateAppeal() {
    setIsSubmitting(true)

    const res = await auctionApi.simulateAppeal(leagueId)
    if (res.success) {
      toast.success(res.message || 'Ricorso simulato creato')
      void loadAppeals()
    } else {
      toast.error(res.message || 'Errore nella simulazione')
    }
    setIsSubmitting(false)
  }

  async function handleSimulateAllConsolidation() {
    setIsSubmitting(true)

    const res = await contractApi.simulateAllConsolidation(leagueId)
    if (res.success) {
      toast.success(res.message || 'Consolidamento simulato per tutti i manager')
      void loadData()
    } else {
      toast.error(res.message || 'Errore nella simulazione')
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

  async function handleCreateSession(isRegularMarket: boolean) {
    setIsSubmitting(true)

    const res = await auctionApi.createSession(leagueId, isRegularMarket, auctionMode)
    if (res.success) {
      toast.success(isRegularMarket ? 'Mercato ricorrente creato!' : 'Primo mercato creato!')
      void loadData()
    } else {
      toast.error(res.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  async function handleCloseSession(sessionId: string) {
    setIsSubmitting(true)

    const res = await auctionApi.closeSession(sessionId)
    if (res.success) {
      toast.success('Sessione chiusa')
      void loadData()
    } else {
      if (res.message?.startsWith('Rose incomplete')) {
        setRosterIncompleteDetails(res.message)
        setShowRosterIncompleteModal(true)
      } else {
        toast.error(res.message || 'Errore')
      }
    }
    setIsSubmitting(false)
  }

  async function handleSetPhase(sessionId: string, phase: string) {
    setIsSubmitting(true)

    const res = await auctionApi.setPhase(sessionId, phase)
    if (res.success) {
      toast.success(`Fase impostata: ${phase}`)
      void loadData()
    } else {
      if (res.message?.startsWith('Rose incomplete')) {
        setRosterIncompleteDetails(res.message)
        setShowRosterIncompleteModal(true)
      } else {
        toast.error(res.message || 'Errore')
      }
    }
    setIsSubmitting(false)
  }

  async function handleMemberAction(memberId: string, action: 'accept' | 'reject' | 'kick') {
    setIsSubmitting(true)

    const res = await leagueApi.updateMember(leagueId, memberId, action)
    if (res.success) {
      if (action === 'accept') haptic.approve()
      else haptic.reject()
      toast.success(action === 'accept' ? 'Membro accettato' : action === 'reject' ? 'Richiesta rifiutata' : 'Membro espulso')
      void loadData()
    } else {
      toast.error(res.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  async function confirmKick(memberId: string, username: string) {
    const ok = await confirmDialog({
      title: 'Espelli membro',
      message: `Sei sicuro di voler espellere ${username}? Questa azione non può essere annullata.`,
      confirmLabel: 'Espelli',
      variant: 'danger'
    })
    if (ok) {
      void handleMemberAction(memberId, 'kick')
    }
  }

  async function handleCreateInvite() {
    if (!newInviteEmail.trim()) return

    setIsSubmitting(true)

    const res = await inviteApi.create(leagueId, newInviteEmail.trim(), inviteDuration)
    if (res.success) {
      toast.success(`Invito inviato a ${newInviteEmail} (valido ${inviteDuration} giorni)`)
      setNewInviteEmail('')
      void loadData()
    } else {
      toast.error(res.message || 'Errore nell\'invio dell\'invito')
    }
    setIsSubmitting(false)
  }

  async function handleCancelInvite(inviteId: string) {
    setIsSubmitting(true)

    const res = await inviteApi.cancel(inviteId)
    if (res.success) {
      toast.success('Invito annullato')
      void loadData()
    } else {
      toast.error(res.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  async function handleStartLeague() {
    setIsSubmitting(true)

    const res = await leagueApi.start(leagueId)
    if (res.success) {
      toast.success('Lega avviata con successo!')
      void loadData()
    } else {
      toast.error(res.message || 'Errore nell\'avvio della lega')
    }
    setIsSubmitting(false)
  }

  async function handleCompleteWithTestUsers() {
    setIsSubmitting(true)

    const res = await adminApi.completeWithTestUsers(leagueId)
    if (res.success) {
      toast.success(res.message || 'Manager di test aggiunti!')
      void loadData()
    } else {
      toast.error(res.message || 'Errore nell\'aggiunta dei manager di test')
    }
    setIsSubmitting(false)
  }

  function handleLeagueImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Il file deve essere un\'immagine')
      return
    }
    // Max 500KB (same threshold as profile photo)
    if (file.size > 500 * 1024) {
      toast.error('L\'immagine deve essere inferiore a 500KB')
      return
    }

    const reader = new FileReader()
    reader.onload = async (event) => {
      const base64 = event.target?.result as string
      setIsSubmitting(true)
      const res = await leagueApi.updateImage(leagueId, base64)
      if (res.success) {
        toast.success('Immagine della lega aggiornata!')
        window.dispatchEvent(new CustomEvent('league-identity-updated', { detail: { leagueId } }))
        void loadData()
      } else {
        toast.error(res.message || 'Errore nel caricamento dell\'immagine')
      }
      setIsSubmitting(false)
    }
    reader.readAsDataURL(file)
    // allow re-selecting the same file later
    e.target.value = ''
  }

  async function handleRemoveLeagueImage() {
    setIsSubmitting(true)
    const res = await leagueApi.removeImage(leagueId)
    if (res.success) {
      toast.success('Immagine della lega rimossa')
      window.dispatchEvent(new CustomEvent('league-identity-updated', { detail: { leagueId } }))
      void loadData()
    } else {
      toast.error(res.message || 'Errore nella rimozione dell\'immagine')
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
      toast.error(res.message || 'Errore durante l\'export')
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-accent-500/30 border-t-accent-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg text-gray-400">Caricamento pannello admin...</p>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-surface-200 border border-surface-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-danger-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <p className="text-xl text-danger-400">Accesso non autorizzato</p>
        </div>
      </div>
    )
  }

  const activeSession = sessions.find(s => s.status === 'ACTIVE')
  const pendingMembers = members.filter(m => m.status === 'PENDING')
  const activeMembers = members.filter(m => m.status === 'ACTIVE')
  // Badge "Gestione Membri": richieste di adesione pendenti + inviti in attesa
  const requestsBadge = pendingMembers.length + invites.length
  const pendingAppealsBadge = appeals.filter(a => a.status === 'PENDING').length

  // Phase label per la pillola in testata (deriva da stato lega / sessione attiva)
  const phaseLabel = league?.status === 'DRAFT'
    ? 'ISCRIZIONI'
    : activeSession
      ? activeSession.type === 'PRIMO_MERCATO' ? 'PRIMO MERCATO' : 'MERCATO RICORRENTE'
      : 'CAMPIONATO'
  const phaseActive = league?.status !== 'DRAFT' && !!activeSession

  // ===== Cockpit testata (crest + nome lega + badge admin) — shell riusabile per SuperAdmin =====
  const header = (
    <div className="bg-surface-200 border border-surface-50 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap min-h-[56px]">
      <div className="relative flex-shrink-0">
        <button
          type="button"
          onClick={() => leagueImageInputRef.current?.click()}
          disabled={isSubmitting}
          title={league?.imageUrl ? 'Cambia il logo della lega' : 'Carica il logo della lega'}
          className="group relative block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
        >
          <LeagueCrest name={league?.name || 'Lega'} imageUrl={league?.imageUrl} size="md" />
          <span className="absolute inset-0 rounded-xl bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[9px] font-semibold text-white">
            {league?.imageUrl ? 'Cambia' : 'Carica'}
          </span>
        </button>
        <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-primary-500 border-2 border-surface-200 flex items-center justify-center shadow-md pointer-events-none">
          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <circle cx="12" cy="13" r="3" />
          </svg>
        </span>
        <input
          ref={leagueImageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleLeagueImageChange}
        />
      </div>

      <div className="flex flex-col min-w-0">
        <h1 className="font-display font-bold text-sm sm:text-base text-white leading-tight flex items-center gap-2 flex-wrap">
          <span className="truncate">{league?.name}</span>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-[10.5px] font-bold tracking-[0.08em] border ${
            phaseActive
              ? 'text-secondary-400 bg-secondary-500/10 border-secondary-500/40'
              : 'text-gray-400 bg-surface-300 border-surface-50'
          }`}>
            <span className={phaseActive ? 'dot-live bg-secondary-500 shadow-[0_0_8px_theme(colors.secondary.500)]' : 'w-1.5 h-1.5 rounded-full bg-gray-500'} />
            {phaseLabel}
          </span>
        </h1>
        <div className="text-sm text-gray-500 leading-tight flex items-center gap-2 flex-wrap mt-0.5">
          <span>Console amministratore</span>
          <span aria-hidden="true">·</span>
          <span>{activeMembers.length} manager attivi</span>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={() => leagueImageInputRef.current?.click()}
            disabled={isSubmitting}
            className="text-primary-400 hover:text-primary-300 disabled:opacity-50"
          >
            {league?.imageUrl ? 'Cambia logo' : 'Carica logo'}
          </button>
          {league?.imageUrl && (
            <>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() => { void handleRemoveLeagueImage() }}
                disabled={isSubmitting}
                className="text-danger-400 hover:text-danger-300 disabled:opacity-50"
              >
                Rimuovi
              </button>
            </>
          )}
        </div>
      </div>

      <div className="ml-auto flex items-center">
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-bold font-display text-accent-400 bg-accent-500/[0.13] border border-accent-500/40">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
          Admin di Lega
        </span>
      </div>
    </div>
  )

  // ===== Cockpit barra tab admin (PanelTabs — sottolineatura oro, badge contatori) =====
  const adminBar = (
    <div className="mt-2 flex items-stretch gap-1 sm:gap-2 overflow-x-auto scrollbar-hide bg-surface-200 border border-surface-50 rounded-xl px-2 sm:px-3">
      {TABS.map(tab => {
        const isActive = tab.id === activeTab
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => { setActiveTab(tab.id); }}
            className={`relative whitespace-nowrap flex-shrink-0 flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-3 font-display text-sm font-semibold min-h-[44px] border-b-2 transition-colors ${
              isActive
                ? 'text-white border-accent-400'
                : 'text-gray-500 border-transparent hover:text-gray-200'
            }`}
          >
            <span className={`w-4 h-4 flex-shrink-0 ${isActive ? 'opacity-100' : 'opacity-80'}`}>{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.id === 'members' && (
              <span className="font-mono text-[10px] font-bold text-gray-400 bg-surface-300 border border-surface-50 px-1.5 py-0.5 rounded-full">
                {activeMembers.length}
              </span>
            )}
            {tab.id === 'members' && requestsBadge > 0 && (
              <span className="font-mono text-[10px] font-bold text-accent-400 bg-accent-500/20 border border-accent-500/40 px-1.5 py-0.5 rounded-full">
                {requestsBadge}
              </span>
            )}
            {tab.id === 'appeals' && pendingAppealsBadge > 0 && (
              <span className="font-mono text-[10px] font-bold text-amber-400 bg-amber-500/20 border border-amber-500/40 px-1.5 py-0.5 rounded-full">
                {pendingAppealsBadge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )

  return (
    <div className="min-h-screen lg:h-dvh lg:flex lg:flex-col lg:overflow-hidden">
      <Navigation currentPage="adminPanel" leagueId={leagueId} isLeagueAdmin={true} onNavigate={onNavigate} />

      <main className="w-full max-w-full mx-auto px-3 lg:px-4 py-3 lg:flex-1 lg:min-h-0 lg:flex lg:flex-col lg:overflow-hidden">
        <CockpitShell header={header} adminBar={adminBar}>
          {/* Pannello unico con scroll interno (cockpit): testata e tab restano fissi */}
          <div className="mt-3 lg:h-full lg:min-h-0 lg:flex lg:flex-col bg-surface-200 border border-surface-50 rounded-xl overflow-hidden">
            <div
              className="lg:flex-1 lg:min-h-0 panel-scroll p-3 sm:p-4"
              onTouchStart={swipeHandlers.onTouchStart}
              onTouchEnd={swipeHandlers.onTouchEnd}
            >
              <Suspense fallback={<TabLoadingFallback />}>
                {activeTab === 'phases' && (
                  <AdminPhasesTab
                    league={league}
                    activeMembers={activeMembers}
                    pendingMembers={pendingMembers}
                    sessions={sessions}
                    activeSession={activeSession}
                    consolidationStatus={consolidationStatus}
                    isSubmitting={isSubmitting}
                    auctionMode={auctionMode}
                    setAuctionMode={setAuctionMode}
                    handleStartLeague={() => void handleStartLeague()}
                    handleSetPhase={(sessionId, phase) => void handleSetPhase(sessionId, phase)}
                    handleCloseSession={(sessionId) => void handleCloseSession(sessionId)}
                    handleCreateSession={(isRegularMarket) => void handleCreateSession(isRegularMarket)}
                    handleSimulateAllConsolidation={() => void handleSimulateAllConsolidation()}
                  />
                )}

                {activeTab === 'members' && (
                  <div className="space-y-4">
                    <AdminMembersTab
                      activeMembers={activeMembers}
                      isSubmitting={isSubmitting}
                      confirmKick={(memberId, username) => void confirmKick(memberId, username)}
                      handleCompleteWithTestUsers={() => void handleCompleteWithTestUsers()}
                    />
                    <AdminRequestsTab
                      pendingMembers={pendingMembers}
                      invites={invites}
                      newInviteEmail={newInviteEmail}
                      setNewInviteEmail={setNewInviteEmail}
                      inviteDuration={inviteDuration}
                      setInviteDuration={setInviteDuration}
                      isSubmitting={isSubmitting}
                      handleMemberAction={(memberId, action) => void handleMemberAction(memberId, action)}
                      handleCreateInvite={() => void handleCreateInvite()}
                      handleCancelInvite={(inviteId) => void handleCancelInvite(inviteId)}
                    />
                  </div>
                )}

                {activeTab === 'appeals' && (
                  <AdminAppealsTab
                    isSubmitting={isSubmitting}
                    appeals={appeals}
                    isLoadingAppeals={isLoadingAppeals}
                    appealFilter={appealFilter}
                    setAppealFilter={setAppealFilter}
                    resolutionNote={resolutionNote}
                    setResolutionNote={setResolutionNote}
                    selectedAppealId={selectedAppealId}
                    setSelectedAppealId={setSelectedAppealId}
                    handleResolveAppeal={(appealId, decision) => void handleResolveAppeal(appealId, decision)}
                    handleSimulateAppeal={() => void handleSimulateAppeal()}
                  />
                )}

                {activeTab === 'export' && (
                  <AdminExportTab
                    isSubmitting={isSubmitting}
                    exportToExcel={exportToExcel}
                    exportRostersToExcel={() => void exportRostersToExcel()}
                  />
                )}
              </Suspense>
            </div>
          </div>
        </CockpitShell>
      </main>

      {/* Roster Incomplete Modal (blocco con recovery → resta modale) */}
      <Modal isOpen={showRosterIncompleteModal} onClose={() => { setShowRosterIncompleteModal(false); }} size="lg">
        <ModalHeader>Rose Incomplete</ModalHeader>
        <ModalBody>
          <div className="text-center mb-4">
            <div className="w-16 h-16 rounded-full bg-warning-500/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-warning-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5.07 19h13.86a2 2 0 001.74-3l-6.93-12a2 2 0 00-3.48 0l-6.93 12a2 2 0 001.74 3z" />
              </svg>
            </div>
            <p className="text-gray-400">Non puoi chiudere l'asta finché tutte le rose non sono complete.</p>
          </div>

          <div className="bg-surface-300 rounded-xl p-4">
            <h4 className="micro-label text-warning-400 mb-3">Dettaglio Mancanti</h4>
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
        </ModalBody>
        <ModalFooter>
          <Button
            size="lg"
            className="w-full"
            onClick={() => { setShowRosterIncompleteModal(false); }}
          >
            Ho capito
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  )
}
