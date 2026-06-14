import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { superadminApi, playerApi } from '@/services/api'
import { Button } from '@/components/ui/Button'
import { Navigation } from '@/components/Navigation'
import { CockpitShell } from '@/components/cockpit/CockpitShell'
import { useToast } from '@/components/ui/Toast'
import { useConfirmDialog } from '@/components/ui/ConfirmDialog'
import { UploadTab } from '@/components/superadmin/UploadTab'
import { PlayersTab } from '@/components/superadmin/PlayersTab'
import { LeaguesTab } from '@/components/superadmin/LeaguesTab'
import { UsersTab } from '@/components/superadmin/UsersTab'
import { ClassificationModal } from '@/components/superadmin/ClassificationModal'
import { RosterModal } from '@/components/superadmin/RosterModal'
import type {
  PlayersStats,
  PlayersListData,
  League,
  User,
  MemberRosterData,
  UploadRecord,
  ExitedPlayerInfo,
  ExitReason,
  PlayerFilters,
} from '@/components/superadmin/types'

const StatsTab = lazy(() => import('@/components/superadmin/StatsTab').then(m => ({ default: m.StatsTab })))

type TabId = 'upload' | 'players' | 'leagues' | 'users' | 'stats'

interface SuperAdminProps {
  onNavigate: (page: string, params?: Record<string, string>) => void
  initialTab?: TabId
}

interface TabDef {
  id: TabId
  label: string
  icon: React.ReactNode
}

const TABS: TabDef[] = [
  {
    id: 'upload',
    label: 'Import',
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    ),
  },
  {
    id: 'players',
    label: 'Anagrafica',
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
  {
    id: 'leagues',
    label: 'Leghe',
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-3M9 9v.01M9 12v.01M9 15v.01M9 18v.01" />
      </svg>
    ),
  },
  {
    id: 'users',
    label: 'Utenti',
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4zm6 0a3 3 0 10-3-3" />
      </svg>
    ),
  },
  {
    id: 'stats',
    label: 'Statistiche',
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
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

export function SuperAdmin({ onNavigate, initialTab }: SuperAdminProps) {
  const { toast } = useToast()
  const { confirm: confirmDialog } = useConfirmDialog()

  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState<PlayersStats | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>(initialTab || 'upload')

  // Upload tab
  const [sheetName, setSheetName] = useState('Tutti')
  const [importing, setImporting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadHistory, setUploadHistory] = useState<UploadRecord[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // Players tab
  const [playersData, setPlayersData] = useState<PlayersListData | null>(null)
  const [playersLoading, setPlayersLoading] = useState(false)
  const [filters, setFilters] = useState<PlayerFilters>({
    position: '',
    listStatus: '',
    search: '',
    team: '',
    page: 1,
  })
  const [teamDropdownOpen, setTeamDropdownOpen] = useState(false)
  const [availableTeams, setAvailableTeams] = useState<Array<{ name: string; playerCount: number }>>([])
  const [, setTeamsLoading] = useState(false)

  // Leagues tab
  const [leagues, setLeagues] = useState<League[]>([])
  const [leaguesLoading, setLeaguesLoading] = useState(false)
  const [expandedLeague, setExpandedLeague] = useState<string | null>(null)
  const [leagueSearch, setLeagueSearch] = useState('')
  const [leagueSearchInput, setLeagueSearchInput] = useState('')

  // Roster modal
  const [selectedMember, setSelectedMember] = useState<string | null>(null)
  const [rosterData, setRosterData] = useState<MemberRosterData | null>(null)
  const [rosterLoading, setRosterLoading] = useState(false)

  // Users tab
  const [users, setUsers] = useState<User[]>([])
  const [usersLoading, setUsersLoading] = useState(false)

  // Classification
  const [playersNeedingClassification, setPlayersNeedingClassification] = useState<ExitedPlayerInfo[]>([])
  const [classificationLoading, setClassificationLoading] = useState(false)
  const [showClassificationModal, setShowClassificationModal] = useState(false)
  const [classifications, setClassifications] = useState<Record<string, ExitReason>>({})
  const [classifyingPlayers, setClassifyingPlayers] = useState(false)
  const [classificationError, setClassificationError] = useState<string | null>(null)
  const [classificationStep, setClassificationStep] = useState<'edit' | 'confirm' | 'success'>('edit')
  const [submittedClassifications, setSubmittedClassifications] = useState<Array<{ player: ExitedPlayerInfo; reason: ExitReason }>>([])
  const [classifiedCount, setClassifiedCount] = useState(0)

  useEffect(() => {
    void loadStatus()
  }, [])

  // Sync activeTab with URL parameter
  useEffect(() => {
    if (initialTab && initialTab !== activeTab) {
      setActiveTab(initialTab)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTab])

  // Close team dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (teamDropdownOpen && !target.closest('[data-team-dropdown]')) {
        setTeamDropdownOpen(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => { document.removeEventListener('click', handleClickOutside); }
  }, [teamDropdownOpen])

  useEffect(() => {
    if (isSuperAdmin) {
      if (activeTab === 'upload') {
        void loadUploadHistory()
        void loadPlayersNeedingClassification()
      }
      if (activeTab === 'players') {
        void loadPlayers()
        void loadTeams()
      }
      if (activeTab === 'leagues') void loadLeagues()
      if (activeTab === 'users') void loadUsers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin, activeTab, filters, leagueSearch])

  async function loadStatus() {
    setIsLoading(true)
    const result = await superadminApi.getStatus()
    if (result.success && result.data) {
      setIsSuperAdmin((result.data as { isSuperAdmin: boolean }).isSuperAdmin)
      if ((result.data as { isSuperAdmin: boolean }).isSuperAdmin) {
        void loadStats()
      }
    }
    setIsLoading(false)
  }

  async function loadStats() {
    const result = await superadminApi.getPlayersStats()
    if (result.success && result.data) {
      setStats(result.data as PlayersStats)
    }
  }

  async function loadUploadHistory() {
    setHistoryLoading(true)
    const result = await superadminApi.getUploadHistory()
    if (result.success && result.data) {
      setUploadHistory((result.data as { uploads: UploadRecord[] }).uploads)
    }
    setHistoryLoading(false)
  }

  async function loadPlayers() {
    setPlayersLoading(true)
    const result = await superadminApi.getPlayers({
      position: filters.position || undefined,
      listStatus: filters.listStatus || undefined,
      search: filters.search || undefined,
      team: filters.team || undefined,
      page: filters.page,
      limit: 50,
    })
    if (result.success && result.data) {
      setPlayersData(result.data as PlayersListData)
    }
    setPlayersLoading(false)
  }

  async function loadTeams() {
    setTeamsLoading(true)
    const result = await playerApi.getTeams()
    if (result.success && result.data) {
      setAvailableTeams(result.data as Array<{ name: string; playerCount: number }>)
    }
    setTeamsLoading(false)
  }

  async function loadLeagues() {
    setLeaguesLoading(true)
    const result = await superadminApi.getLeagues(leagueSearch || undefined)
    if (result.success && result.data) {
      setLeagues((result.data as { leagues: League[] }).leagues)
    }
    setLeaguesLoading(false)
  }

  async function handleDeleteLeague(leagueId: string): Promise<boolean> {
    try {
      const result = await superadminApi.deleteLeague(leagueId)
      if (result.success) {
        toast.success(result.message || 'Lega eliminata')
        setExpandedLeague(null)
        void loadLeagues()
        return true
      }
      toast.error(result.message || 'Errore durante l\'eliminazione')
      return false
    } catch {
      toast.error('Errore durante l\'eliminazione della lega')
      return false
    }
  }

  async function loadMemberRoster(memberId: string) {
    setSelectedMember(memberId)
    setRosterLoading(true)
    setRosterData(null)
    const result = await superadminApi.getMemberRoster(memberId)
    if (result.success && result.data) {
      setRosterData(result.data as MemberRosterData)
    }
    setRosterLoading(false)
  }

  function closeRosterModal() {
    setSelectedMember(null)
    setRosterData(null)
  }

  function handleLeagueSearch() {
    setLeagueSearch(leagueSearchInput)
  }

  function handleResetLeagueSearch() {
    setLeagueSearchInput('')
    setLeagueSearch('')
  }

  async function loadUsers() {
    setUsersLoading(true)
    const result = await superadminApi.getUsers()
    if (result.success && result.data) {
      setUsers((result.data as { users: User[] }).users)
    }
    setUsersLoading(false)
  }

  async function loadPlayersNeedingClassification() {
    setClassificationLoading(true)
    const result = await superadminApi.getPlayersNeedingClassification()
    if (result.success && result.data) {
      const players = (result.data as { players: ExitedPlayerInfo[] }).players
      setPlayersNeedingClassification(players)
      const initialClassifications: Record<string, ExitReason> = {}
      players.forEach(p => {
        initialClassifications[p.playerId] = 'RITIRATO'
      })
      setClassifications(initialClassifications)
    }
    setClassificationLoading(false)
  }

  function openClassificationModal() {
    setShowClassificationModal(true)
    setClassificationError(null)
    setClassificationStep('edit')
    setSubmittedClassifications([])
  }

  function closeClassificationModal() {
    setShowClassificationModal(false)
    setClassificationError(null)
    setClassificationStep('edit')
    setSubmittedClassifications([])
  }

  function handleClassificationChange(playerId: string, reason: ExitReason) {
    setClassifications(prev => ({
      ...prev,
      [playerId]: reason
    }))
  }

  function goToConfirmStep() {
    const recap = playersNeedingClassification.map(player => ({
      player,
      reason: classifications[player.playerId] || 'RITIRATO'
    }))
    setSubmittedClassifications(recap)
    setClassificationStep('confirm')
  }

  function goBackToEdit() {
    setClassificationStep('edit')
  }

  async function handleSubmitClassifications() {
    setClassifyingPlayers(true)
    setClassificationError(null)

    const classificationArray = Object.entries(classifications).map(([playerId, exitReason]) => ({
      playerId,
      exitReason
    }))

    try {
      const result = await superadminApi.classifyExitedPlayers(classificationArray)

      if (result.success) {
        setClassifiedCount(classificationArray.length)
        setClassificationStep('success')
        void loadPlayersNeedingClassification()
        void loadStats()
      } else {
        setClassificationError(result.message || 'Errore sconosciuto')
      }
    } catch {
      setClassificationError('Errore durante la classificazione')
    }

    setClassifyingPlayers(false)
  }

  async function handleFileUpload() {
    const file = fileInputRef.current?.files?.[0]
    if (!file) {
      toast.error('Seleziona un file .xlsx')
      return
    }

    setImporting(true)

    try {
      const result = await superadminApi.importQuotazioni(file, sheetName)
      if (result.success) {
        toast.success(result.message || 'Importazione completata')
        void loadStats()
        void loadUploadHistory()
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
        // Check if there are players needing classification and open modal automatically
        const classificationResult = await superadminApi.getPlayersNeedingClassification()
        const playersData = classificationResult.success && classificationResult.data
          ? (classificationResult.data as { players: ExitedPlayerInfo[] }).players
          : []
        if (playersData.length > 0) {
          setPlayersNeedingClassification(playersData)
          const initialClassifications: Record<string, ExitReason> = {}
          for (const player of playersData) {
            initialClassifications[player.playerId] = 'ESTERO'
          }
          setClassifications(initialClassifications)
          openClassificationModal()
        }
      } else {
        toast.error(result.message || 'Errore sconosciuto')
      }
    } catch {
      toast.error('Errore durante l\'upload')
    }

    setImporting(false)
  }

  async function handleRequestDeleteAllPlayers() {
    const ok = await confirmDialog({
      title: 'Conferma Cancellazione',
      message: `Sei sicuro di voler cancellare tutti i ${stats?.totalPlayers ?? 0} giocatori? Questa azione non può essere annullata.`,
      confirmLabel: 'Conferma',
      variant: 'danger',
    })
    if (!ok) return

    setDeleting(true)
    try {
      const result = await superadminApi.deleteAllPlayers()
      if (result.success) {
        toast.success(result.message || 'Giocatori eliminati')
        void loadStats()
        void loadUploadHistory()
      } else {
        toast.error(result.message || 'Errore sconosciuto')
      }
    } catch {
      toast.error('Errore durante la cancellazione')
    }
    setDeleting(false)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Verifica permessi...</p>
        </div>
      </div>
    )
  }

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md text-center bg-surface-200 border border-surface-50 rounded-xl p-8">
          <div className="w-16 h-16 rounded-2xl bg-surface-300 border border-surface-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-danger-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="font-display font-bold text-2xl text-white mb-2">Accesso Negato</h1>
          <p className="text-gray-400 mb-6">Non hai i permessi di Superadmin per accedere a questa area.</p>
          <Button onClick={() => { onNavigate('dashboard'); }} variant="primary">
            Torna alla Dashboard
          </Button>
        </div>
      </div>
    )
  }

  // Stats by position
  const positionStats = {
    P: { inList: 0, notInList: 0 },
    D: { inList: 0, notInList: 0 },
    C: { inList: 0, notInList: 0 },
    A: { inList: 0, notInList: 0 },
  }

  if (stats?.byPosition) {
    for (const item of stats.byPosition) {
      const pos = item.position as keyof typeof positionStats
      if (positionStats[pos]) {
        if (item.listStatus === 'IN_LIST') {
          positionStats[pos].inList = item._count
        } else {
          positionStats[pos].notInList = item._count
        }
      }
    }
  }

  // ===== Cockpit testata (piattaforma: monogramma + titolo console + badge Super Admin) =====
  const header = (
    <div className="bg-surface-200 border border-surface-50 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap min-h-[56px]">
      <span className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center font-display font-extrabold text-sm bg-surface-100 text-accent-400 border border-accent-500/40">
        FC
      </span>
      <div className="flex flex-col min-w-0">
        <h1 className="font-display font-bold text-sm sm:text-base text-white leading-tight flex items-center gap-2 flex-wrap">
          <span className="truncate">Pannello Super Admin</span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-[10.5px] font-bold tracking-[0.08em] border text-accent-400 bg-accent-500/10 border-accent-500/40">
            <span className="dot-live bg-accent-500 shadow-[0_0_8px_theme(colors.accent.500)]" />
            PIATTAFORMA
          </span>
        </h1>
        <div className="text-sm text-gray-500 leading-tight flex items-center gap-2 flex-wrap mt-0.5">
          <span>Gestione piattaforma Fantacontratti</span>
          {stats && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono">{`${stats.totalPlayers} giocatori`}</span>
            </>
          )}
        </div>
      </div>

      <div className="ml-auto flex items-center">
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-bold font-display text-accent-400 bg-accent-500/[0.13] border border-accent-500/40">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l2.5 14h9L19 3l-4.5 5L12 3 9.5 8 5 3z" />
          </svg>
          Super Admin
        </span>
      </div>
    </div>
  )

  // ===== Cockpit barra tab (PanelTabs — sottolineatura oro, badge contatori) =====
  const tabBar = (
    <div className="mt-2 flex items-stretch gap-1 sm:gap-2 overflow-x-auto scrollbar-hide bg-surface-200 border border-surface-50 rounded-xl px-2 sm:px-3">
      {TABS.map(tab => {
        const isActive = tab.id === activeTab
        const count = tab.id === 'players'
          ? stats?.totalPlayers
          : tab.id === 'leagues'
            ? leagues.length || undefined
            : tab.id === 'users'
              ? users.length || undefined
              : undefined
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
            {count !== undefined && count > 0 && (
              <span className="font-mono text-[10px] font-bold text-gray-400 bg-surface-300 border border-surface-50 px-1.5 py-0.5 rounded-full">
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )

  return (
    <div className="min-h-screen lg:h-dvh lg:flex lg:flex-col lg:overflow-hidden">
      <Navigation
        currentPage="superadmin"
        activeTab={activeTab}
        onNavigate={onNavigate}
      />

      <main className="w-full max-w-full mx-auto px-3 lg:px-4 py-3 lg:flex-1 lg:min-h-0 lg:flex lg:flex-col lg:overflow-hidden">
        <CockpitShell header={header} adminBar={tabBar}>
          <div className="mt-3 lg:h-full lg:min-h-0 lg:flex lg:flex-col bg-surface-200 border border-surface-50 rounded-xl overflow-hidden">
            <div className="lg:flex-1 lg:min-h-0 panel-scroll p-3 sm:p-4">
              {activeTab === 'upload' && (
                <UploadTab
                  stats={stats}
                  positionStats={positionStats}
                  sheetName={sheetName}
                  setSheetName={setSheetName}
                  fileInputRef={fileInputRef}
                  importing={importing}
                  deleting={deleting}
                  onImport={() => void handleFileUpload()}
                  onRequestDelete={() => void handleRequestDeleteAllPlayers()}
                  historyLoading={historyLoading}
                  uploadHistory={uploadHistory}
                  classificationLoading={classificationLoading}
                  playersNeedingClassification={playersNeedingClassification}
                  onOpenClassification={openClassificationModal}
                />
              )}

              {activeTab === 'players' && (
                <PlayersTab
                  filters={filters}
                  setFilters={setFilters}
                  teamDropdownOpen={teamDropdownOpen}
                  setTeamDropdownOpen={setTeamDropdownOpen}
                  availableTeams={availableTeams}
                  playersLoading={playersLoading}
                  playersData={playersData}
                />
              )}

              {activeTab === 'leagues' && (
                <LeaguesTab
                  leagueSearch={leagueSearch}
                  leagueSearchInput={leagueSearchInput}
                  setLeagueSearchInput={setLeagueSearchInput}
                  onSearch={handleLeagueSearch}
                  onResetSearch={handleResetLeagueSearch}
                  leaguesLoading={leaguesLoading}
                  leagues={leagues}
                  expandedLeague={expandedLeague}
                  setExpandedLeague={setExpandedLeague}
                  onViewRoster={(memberId) => void loadMemberRoster(memberId)}
                  onDeleteLeague={handleDeleteLeague}
                />
              )}

              {activeTab === 'users' && (
                <UsersTab usersLoading={usersLoading} users={users} />
              )}

              {activeTab === 'stats' && (
                <Suspense fallback={<TabLoadingFallback />}>
                  <StatsTab />
                </Suspense>
              )}
            </div>
          </div>
        </CockpitShell>
      </main>

      {/* Classification Modal */}
      {showClassificationModal && (
        <ClassificationModal
          step={classificationStep}
          players={playersNeedingClassification}
          classifications={classifications}
          submittedClassifications={submittedClassifications}
          classifiedCount={classifiedCount}
          classifyingPlayers={classifyingPlayers}
          errorMessage={classificationError}
          onClose={closeClassificationModal}
          onChange={handleClassificationChange}
          onGoToConfirm={goToConfirmStep}
          onGoBackToEdit={goBackToEdit}
          onSubmit={() => void handleSubmitClassifications()}
        />
      )}

      {/* Roster Modal */}
      {selectedMember && (
        <RosterModal
          rosterLoading={rosterLoading}
          rosterData={rosterData}
          onClose={closeRosterModal}
        />
      )}
    </div>
  )
}
