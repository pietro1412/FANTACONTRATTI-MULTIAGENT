import { useState, useEffect, useRef } from 'react'
import { superadminApi, playerApi } from '../services/api'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card } from '../components/ui/Card'
import { Navigation } from '../components/Navigation'
import { getTeamLogo } from '../utils/teamLogos'

interface SuperAdminProps {
  onNavigate: (page: string, params?: Record<string, string>) => void
  initialTab?: 'upload' | 'players' | 'leagues' | 'users'
}

interface PlayersStats {
  totalPlayers: number
  inList: number
  notInList: number
  byPosition: Array<{
    position: string
    listStatus: string
    _count: number
  }>
}

interface Player {
  id: string
  externalId: string | null
  name: string
  team: string
  position: string
  quotation: number
  listStatus: string
}

interface PlayersListData {
  players: Player[]
  total: number
  page: number
  limit: number
  totalPages: number
}

interface LeagueMember {
  id: string
  role: string
  status: string
  currentBudget: number
  user: {
    id: string
    username: string
    email: string
  }
}

interface League {
  id: string
  name: string
  status: string
  maxParticipants: number
  initialBudget: number
  createdAt: string
  members: LeagueMember[]
  _count: {
    members: number
    marketSessions: number
  }
}

interface User {
  id: string
  username: string
  email: string
  emailVerified: boolean
  isSuperAdmin: boolean
  createdAt: string
  _count: {
    leagueMemberships: number
  }
}

interface RosterEntry {
  id: string
  player: {
    id: string
    name: string
    team: string
    position: string
    quotation: number
  }
  contract: {
    id: string
    purchasePrice: number
    acquiredAt: string
  } | null
}

interface MemberRosterData {
  member: {
    id: string
    username: string
    email: string
    currentBudget: number
    role: string
    league: {
      id: string
      name: string
    }
  }
  roster: RosterEntry[]
}

interface UploadRecord {
  id: string
  fileName: string
  sheetName: string
  playersCreated: number
  playersUpdated: number
  playersNotInList: number
  totalProcessed: number
  errors: string[] | null
  createdAt: string
  uploadedBy: {
    id: string
    username: string
  }
}

interface ExitedPlayerInfo {
  playerId: string
  playerName: string
  position: string
  team: string
  lastQuotation: number
  contracts: Array<{
    leagueId: string
    leagueName: string
    memberId: string
    memberUsername: string
    salary: number
    duration: number
  }>
}

type ExitReason = 'RITIRATO' | 'RETROCESSO' | 'ESTERO'

const EXIT_REASON_COLORS: Record<ExitReason, string> = {
  RITIRATO: 'bg-gray-500/20 text-gray-400 border-gray-500/40',
  RETROCESSO: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
  ESTERO: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
}

const POSITION_COLORS: Record<string, string> = {
  P: 'from-amber-500 to-amber-600',
  D: 'from-blue-500 to-blue-600',
  C: 'from-emerald-500 to-emerald-600',
  A: 'from-red-500 to-red-600',
}

const POSITION_NAMES: Record<string, string> = {
  P: 'Portieri',
  D: 'Difensori',
  C: 'Centrocampisti',
  A: 'Attaccanti',
}


const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'In preparazione',
  ACTIVE: 'Attiva',
  COMPLETED: 'Completata',
}

export function SuperAdmin({ onNavigate, initialTab }: SuperAdminProps) {
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState<PlayersStats | null>(null)
  const [sheetName, setSheetName] = useState('Tutti')
  const [importing, setImporting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [importResult, setImportResult] = useState<{ success: boolean; message: string; data?: unknown } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Upload history state
  const [uploadHistory, setUploadHistory] = useState<UploadRecord[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // Tab state - use initialTab if provided
  const [activeTab, setActiveTab] = useState<'upload' | 'players' | 'leagues' | 'users'>(initialTab || 'upload')

  // Players list state
  const [playersData, setPlayersData] = useState<PlayersListData | null>(null)
  const [playersLoading, setPlayersLoading] = useState(false)
  const [filters, setFilters] = useState({
    position: '',
    listStatus: '',
    search: '',
    team: '',
    page: 1,
  })
  const [teamDropdownOpen, setTeamDropdownOpen] = useState(false)
  const [availableTeams, setAvailableTeams] = useState<Array<{ name: string; playerCount: number }>>([])
  const [_teamsLoading, setTeamsLoading] = useState(false)

  // Leagues state
  const [leagues, setLeagues] = useState<League[]>([])
  const [leaguesLoading, setLeaguesLoading] = useState(false)
  const [expandedLeague, setExpandedLeague] = useState<string | null>(null)
  const [leagueSearch, setLeagueSearch] = useState('')
  const [leagueSearchInput, setLeagueSearchInput] = useState('')

  // Roster modal state
  const [selectedMember, setSelectedMember] = useState<string | null>(null)
  const [rosterData, setRosterData] = useState<MemberRosterData | null>(null)
  const [rosterLoading, setRosterLoading] = useState(false)

  // Users state
  const [users, setUsers] = useState<User[]>([])
  const [usersLoading, setUsersLoading] = useState(false)

  // Classification state
  const [playersNeedingClassification, setPlayersNeedingClassification] = useState<ExitedPlayerInfo[]>([])
  const [classificationLoading, setClassificationLoading] = useState(false)
  const [showClassificationModal, setShowClassificationModal] = useState(false)
  const [classifications, setClassifications] = useState<Record<string, ExitReason>>({})
  const [classifyingPlayers, setClassifyingPlayers] = useState(false)
  const [classificationResult, setClassificationResult] = useState<{ success: boolean; message: string } | null>(null)
  const [classificationStep, setClassificationStep] = useState<'edit' | 'confirm' | 'success'>('edit')
  const [submittedClassifications, setSubmittedClassifications] = useState<Array<{ player: ExitedPlayerInfo; reason: ExitReason }>>([])
  const [classifiedCount, setClassifiedCount] = useState(0)

  useEffect(() => {
    loadStatus()
  }, [])

  // Sync activeTab with URL parameter
  useEffect(() => {
    if (initialTab && initialTab !== activeTab) {
      setActiveTab(initialTab)
    }
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
    return () => document.removeEventListener('click', handleClickOutside)
  }, [teamDropdownOpen])

  useEffect(() => {
    if (isSuperAdmin) {
      if (activeTab === 'upload') {
        loadUploadHistory()
        loadPlayersNeedingClassification()
      }
      if (activeTab === 'players') {
        loadPlayers()
        loadTeams()
      }
      if (activeTab === 'leagues') loadLeagues()
      if (activeTab === 'users') loadUsers()
    }
  }, [isSuperAdmin, activeTab, filters, leagueSearch])

  async function loadStatus() {
    setIsLoading(true)
    const result = await superadminApi.getStatus()
    if (result.success && result.data) {
      setIsSuperAdmin((result.data as { isSuperAdmin: boolean }).isSuperAdmin)
      if ((result.data as { isSuperAdmin: boolean }).isSuperAdmin) {
        loadStats()
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
      // Initialize classifications with empty values
      const initialClassifications: Record<string, ExitReason> = {}
      players.forEach(p => {
        initialClassifications[p.playerId] = 'RITIRATO' // Default value
      })
      setClassifications(initialClassifications)
    }
    setClassificationLoading(false)
  }

  function openClassificationModal() {
    setShowClassificationModal(true)
    setClassificationResult(null)
    setClassificationStep('edit')
    setSubmittedClassifications([])
  }

  function closeClassificationModal() {
    setShowClassificationModal(false)
    setClassificationResult(null)
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
    // Build recap of classifications
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
    setClassificationResult(null)

    const classificationArray = Object.entries(classifications).map(([playerId, exitReason]) => ({
      playerId,
      exitReason
    }))

    try {
      const result = await superadminApi.classifyExitedPlayers(classificationArray)

      if (result.success) {
        // Store the count before reloading
        setClassifiedCount(classificationArray.length)
        setClassificationStep('success')
        // Reload data after successful classification
        loadPlayersNeedingClassification()
        loadStats()
      } else {
        setClassificationResult({
          success: false,
          message: result.message || 'Errore sconosciuto'
        })
      }
    } catch (error) {
      setClassificationResult({
        success: false,
        message: 'Errore durante la classificazione'
      })
    }

    setClassifyingPlayers(false)
  }

  async function handleFileUpload() {
    const file = fileInputRef.current?.files?.[0]
    if (!file) {
      setImportResult({ success: false, message: 'Seleziona un file .xlsx' })
      return
    }

    setImporting(true)
    setImportResult(null)

    try {
      const result = await superadminApi.importQuotazioni(file, sheetName)
      setImportResult({
        success: result.success,
        message: result.message || 'Errore sconosciuto',
        data: result.data
      })
      if (result.success) {
        loadStats()
        loadUploadHistory()
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
          // Initialize classifications with default value
          const initialClassifications: Record<string, ExitReason> = {}
          for (const player of playersData) {
            initialClassifications[player.playerId] = 'ESTERO' // Default to ESTERO
          }
          setClassifications(initialClassifications)
          openClassificationModal()
        }
      }
    } catch (error) {
      setImportResult({ success: false, message: 'Errore durante l\'upload' })
    }

    setImporting(false)
  }

  async function handleDeleteAllPlayers() {
    setDeleting(true)
    setImportResult(null)

    try {
      const result = await superadminApi.deleteAllPlayers()
      setImportResult({
        success: result.success,
        message: result.message || 'Errore sconosciuto',
        data: result.data
      })
      if (result.success) {
        loadStats()
        loadUploadHistory()
      }
    } catch (error) {
      setImportResult({ success: false, message: 'Errore durante la cancellazione' })
    }

    setDeleting(false)
    setShowDeleteConfirm(false)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-300 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Verifica permessi...</p>
        </div>
      </div>
    )
  }

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen bg-dark-300 flex items-center justify-center">
        <Card className="max-w-md text-center p-8">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-white mb-2">Accesso Negato</h1>
          <p className="text-gray-400 mb-6">Non hai i permessi di Superadmin per accedere a questa area.</p>
          <Button onClick={() => onNavigate('dashboard')} variant="primary">
            Torna alla Dashboard
          </Button>
        </Card>
      </div>
    )
  }

  // Get stats by position
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

  return (
    <div className="min-h-screen bg-dark-300">
      <Navigation
        currentPage="superadmin"
        activeTab={activeTab}
        onNavigate={onNavigate}
      />

      {/* Page Header */}
      <div className="bg-gradient-to-r from-dark-200 via-surface-200 to-dark-200 border-b border-surface-50/20">
        <div className="max-w-[1600px] mx-auto px-6 py-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-accent-500 to-accent-700 flex items-center justify-center shadow-glow-gold">
              <span className="text-3xl">👑</span>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Pannello Super Admin</h1>
              <p className="text-gray-400 mt-1">Gestione piattaforma Fantacontratti</p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">
        {/* UPLOAD TAB */}
        {activeTab === 'upload' && (
          <>
            {/* Stats */}
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-4 text-center">
                  <p className="text-3xl font-bold text-white">{stats.totalPlayers}</p>
                  <p className="text-sm text-gray-400">Totale Giocatori</p>
                </Card>
                <Card className="p-4 text-center">
                  <p className="text-3xl font-bold text-secondary-400">{stats.inList}</p>
                  <p className="text-sm text-gray-400">In Lista</p>
                </Card>
                <Card className="p-4 text-center">
                  <p className="text-3xl font-bold text-danger-400">{stats.notInList}</p>
                  <p className="text-sm text-gray-400">Non in Lista</p>
                </Card>
                <Card className="p-4 text-center">
                  <p className="text-3xl font-bold text-accent-400">
                    {stats.totalPlayers > 0 ? ((stats.inList / stats.totalPlayers) * 100).toFixed(0) : 0}%
                  </p>
                  <p className="text-sm text-gray-400">Attivi</p>
                </Card>
              </div>
            )}

            {/* Position breakdown */}
            {stats && stats.totalPlayers > 0 && (
              <Card className="p-6">
                <h2 className="text-lg font-bold text-white mb-4">Giocatori per Ruolo</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {(['P', 'D', 'C', 'A'] as const).map(pos => (
                    <div key={pos} className="bg-surface-300 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`w-8 h-8 rounded-full bg-gradient-to-br ${POSITION_COLORS[pos]} flex items-center justify-center text-white font-bold text-sm`}>{pos}</span>
                        <span className="text-gray-300 font-medium">{POSITION_NAMES[pos]}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-secondary-400">{positionStats[pos].inList} attivi</span>
                        <span className="text-gray-500">{positionStats[pos].notInList} rimossi</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Upload Section */}
            <Card className="p-6">
              <h2 className="text-lg font-bold text-white mb-4">Carica Quotazioni</h2>
              <p className="text-gray-400 text-sm mb-4">
                Carica un file Excel (.xlsx) con le quotazioni Fantacalcio.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Nome Foglio</label>
                  <Input
                    value={sheetName}
                    onChange={(e) => setSheetName(e.target.value)}
                    placeholder="Es: Tutti"
                    className="max-w-xs"
                  />
                  <p className="text-xs text-gray-500 mt-1">Il nome del foglio Excel da leggere (default: "Tutti")</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">File Quotazioni</label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".xlsx"
                    className="block w-full text-sm text-gray-400
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-lg file:border-0
                      file:text-sm file:font-semibold
                      file:bg-primary-500/20 file:text-primary-400
                      hover:file:bg-primary-500/30
                      cursor-pointer"
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={handleFileUpload}
                    disabled={importing || deleting}
                    className="btn-primary"
                  >
                    {importing ? 'Importazione in corso...' : 'Importa Quotazioni'}
                  </Button>
                  <Button
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={importing || deleting || !stats || stats.totalPlayers === 0}
                    variant="outline"
                    className="border-danger-500/50 text-danger-400 hover:bg-danger-500/20"
                  >
                    {deleting ? 'Cancellazione...' : 'Cancella Tutti i Giocatori'}
                  </Button>
                </div>

                {/* Delete Confirmation Modal */}
                {showDeleteConfirm && (
                  <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                    <div className="bg-surface-200 rounded-xl border border-surface-50/20 p-6 max-w-md">
                      <div className="text-center mb-6">
                        <div className="w-16 h-16 rounded-full bg-danger-500/20 flex items-center justify-center mx-auto mb-4">
                          <span className="text-3xl">⚠️</span>
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Conferma Cancellazione</h3>
                        <p className="text-gray-400">
                          Sei sicuro di voler cancellare tutti i <strong className="text-white">{stats?.totalPlayers}</strong> giocatori?
                          <br />
                          <span className="text-danger-400">Questa azione non può essere annullata.</span>
                        </p>
                      </div>
                      <div className="flex gap-3">
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => setShowDeleteConfirm(false)}
                          disabled={deleting}
                        >
                          Annulla
                        </Button>
                        <Button
                          className="flex-1 bg-danger-500 hover:bg-danger-600"
                          onClick={handleDeleteAllPlayers}
                          disabled={deleting}
                        >
                          {deleting ? 'Cancellazione...' : 'Conferma'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {importResult && (
                  <div className={`p-4 rounded-lg ${importResult.success ? 'bg-secondary-500/20 border border-secondary-500/50 text-secondary-400' : 'bg-danger-500/20 border border-danger-500/50 text-danger-400'}`}>
                    <p className="font-medium">{importResult.message}</p>
                    {importResult.data ? (
                      <pre className="mt-2 text-xs opacity-75 overflow-auto max-h-40">
                        {JSON.stringify(importResult.data as object, null, 2)}
                      </pre>
                    ) : null}
                  </div>
                )}
              </div>
            </Card>

            {/* Upload History */}
            <Card className="p-6">
              <h2 className="text-lg font-bold text-white mb-4">Storico Caricamenti</h2>
              {historyLoading ? (
                <div className="py-8 text-center">
                  <div className="w-10 h-10 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto"></div>
                </div>
              ) : uploadHistory.length > 0 ? (
                <div className="space-y-3">
                  {uploadHistory.map((upload) => (
                    <div key={upload.id} className="bg-surface-300 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium text-white">{upload.fileName}</p>
                          <p className="text-xs text-gray-400">
                            Foglio: {upload.sheetName} · Caricato da {upload.uploadedBy.username}
                          </p>
                        </div>
                        <p className="text-xs text-gray-500">
                          {new Date(upload.createdAt).toLocaleString('it-IT', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                      <div className="flex gap-4 text-sm">
                        <span className="text-secondary-400">
                          +{upload.playersCreated} nuovi
                        </span>
                        <span className="text-primary-400">
                          {upload.playersUpdated} aggiornati
                        </span>
                        <span className="text-gray-400">
                          {upload.playersNotInList} non in lista
                        </span>
                        <span className="text-gray-500">
                          ({upload.totalProcessed} totali)
                        </span>
                      </div>
                      {upload.errors && upload.errors.length > 0 && (
                        <div className="mt-2 text-xs text-danger-400">
                          {upload.errors.length} errori durante l'import
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-center py-4">
                  Nessun caricamento effettuato
                </p>
              )}
            </Card>

            {/* Players Needing Classification */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-warning-500/20 flex items-center justify-center">
                    <span className="text-xl">⚠️</span>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Giocatori da Classificare</h2>
                    <p className="text-sm text-gray-400">Giocatori usciti dalla lista con contratti attivi</p>
                  </div>
                </div>
                {playersNeedingClassification.length > 0 && (
                  <Button
                    onClick={openClassificationModal}
                    className="btn-primary"
                  >
                    Classifica ({playersNeedingClassification.length})
                  </Button>
                )}
              </div>

              {classificationLoading ? (
                <div className="py-8 text-center">
                  <div className="w-10 h-10 border-4 border-warning-500/30 border-t-warning-500 rounded-full animate-spin mx-auto"></div>
                </div>
              ) : playersNeedingClassification.length > 0 ? (
                <div className="space-y-3">
                  {playersNeedingClassification.slice(0, 5).map((player) => (
                    <div key={player.playerId} className="bg-surface-300 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <span className={`w-8 h-8 rounded-full bg-gradient-to-br ${POSITION_COLORS[player.position]} flex items-center justify-center text-white font-bold text-xs`}>
                            {player.position}
                          </span>
                          <div>
                            <p className="font-medium text-white">{player.playerName}</p>
                            <p className="text-xs text-gray-400">{player.team}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-400">Quotazione</p>
                          <p className="font-mono text-accent-400">{player.lastQuotation}</p>
                        </div>
                      </div>
                      <div className="text-xs text-gray-400">
                        <span className="text-warning-400">{player.contracts.length} contratt{player.contracts.length === 1 ? 'o' : 'i'} attiv{player.contracts.length === 1 ? 'o' : 'i'}</span>
                        {' in '}
                        {player.contracts.map((c, i) => (
                          <span key={c.memberId}>
                            {i > 0 && ', '}
                            <span className="text-white">{c.leagueName}</span>
                            {' ('}
                            <span className="text-primary-400">{c.memberUsername}</span>
                            {')'}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                  {playersNeedingClassification.length > 5 && (
                    <p className="text-sm text-gray-400 text-center py-2">
                      ...e altri {playersNeedingClassification.length - 5} giocatori
                    </p>
                  )}
                </div>
              ) : (
                <div className="py-8 text-center text-gray-400">
                  <p className="text-4xl mb-2">✅</p>
                  <p>Nessun giocatore da classificare</p>
                  <p className="text-sm mt-1">Tutti i giocatori usciti dalla lista sono stati classificati</p>
                </div>
              )}
            </Card>
          </>
        )}

        {/* PLAYERS TAB */}
        {activeTab === 'players' && (
          <>
            {/* Filters */}
            <Card className="p-4">
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Cerca</label>
                  <Input
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
                    placeholder="Nome giocatore..."
                    className="w-48"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Ruolo</label>
                  <select
                    value={filters.position}
                    onChange={(e) => setFilters({ ...filters, position: e.target.value, page: 1 })}
                    className="bg-surface-300 border border-surface-50/30 text-white rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Tutti</option>
                    <option value="P">Portieri</option>
                    <option value="D">Difensori</option>
                    <option value="C">Centrocampisti</option>
                    <option value="A">Attaccanti</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Stato</label>
                  <select
                    value={filters.listStatus}
                    onChange={(e) => setFilters({ ...filters, listStatus: e.target.value, page: 1 })}
                    className="bg-surface-300 border border-surface-50/30 text-white rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Tutti</option>
                    <option value="IN_LIST">In Lista</option>
                    <option value="NOT_IN_LIST">Non in Lista</option>
                  </select>
                </div>
                <div className="relative" data-team-dropdown>
                  <label className="block text-xs text-gray-400 mb-1">Squadra</label>
                  <button
                    type="button"
                    onClick={() => setTeamDropdownOpen(!teamDropdownOpen)}
                    className="bg-surface-300 border border-surface-50/30 text-white rounded-lg px-3 py-2 text-sm flex items-center gap-2 min-w-[160px] justify-between"
                  >
                    <div className="flex items-center gap-2">
                      {filters.team ? (
                        <>
                          <div className="w-5 h-5 bg-white/90 rounded flex items-center justify-center p-0.5">
                            <img src={getTeamLogo(filters.team)} alt={filters.team} className="w-4 h-4 object-contain" />
                          </div>
                          <span>{filters.team}</span>
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
                        onClick={() => { setFilters({ ...filters, team: '', page: 1 }); setTeamDropdownOpen(false) }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-300 flex items-center gap-2 ${!filters.team ? 'bg-primary-500/20 text-primary-400' : 'text-white'}`}
                      >
                        Tutte le squadre
                      </button>
                      {availableTeams.map(teamData => (
                        <button
                          key={teamData.name}
                          type="button"
                          onClick={() => { setFilters({ ...filters, team: teamData.name, page: 1 }); setTeamDropdownOpen(false) }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-300 flex items-center gap-2 ${filters.team === teamData.name ? 'bg-primary-500/20 text-primary-400' : 'text-white'}`}
                        >
                          <div className="w-6 h-6 bg-white/90 rounded flex items-center justify-center p-0.5 flex-shrink-0">
                            <img src={getTeamLogo(teamData.name)} alt={teamData.name} className="w-5 h-5 object-contain" />
                          </div>
                          <span>{teamData.name}</span>
                          <span className="text-xs text-gray-500 ml-auto">({teamData.playerCount})</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFilters({ position: '', listStatus: '', search: '', team: '', page: 1 })}
                >
                  Reset
                </Button>
              </div>
            </Card>

            {/* Players Table */}
            <Card className="overflow-hidden">
              {playersLoading ? (
                <div className="p-8 text-center">
                  <div className="w-10 h-10 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto"></div>
                </div>
              ) : playersData && playersData.players.length > 0 ? (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-surface-300">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">Ruolo</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">Nome</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">Squadra</th>
                          <th className="px-4 py-3 text-center text-xs font-bold text-gray-400 uppercase">Quot.</th>
                          <th className="px-4 py-3 text-center text-xs font-bold text-gray-400 uppercase">Stato</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-50/10">
                        {playersData.players.map((player) => {
                          const isNotInList = player.listStatus !== 'IN_LIST'
                          return (
                            <tr key={player.id} className={`hover:bg-surface-300/50 ${isNotInList ? 'opacity-50' : ''}`}>
                              <td className="px-4 py-3">
                                <span className={`w-8 h-8 rounded-full bg-gradient-to-br ${POSITION_COLORS[player.position]} flex items-center justify-center text-white font-bold text-xs`}>
                                  {player.position}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`font-medium ${isNotInList ? 'text-gray-500 line-through' : 'text-white'}`}>
                                  {player.name}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="relative w-7 h-7 bg-white/90 rounded flex items-center justify-center p-0.5 flex-shrink-0">
                                    <img
                                      src={getTeamLogo(player.team)}
                                      alt={player.team}
                                      className={`w-6 h-6 object-contain ${isNotInList ? 'grayscale' : ''}`}
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%236b7280"%3E%3Cpath d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/%3E%3C/svg%3E'
                                      }}
                                    />
                                  </div>
                                  <span className={isNotInList ? 'text-gray-500' : 'text-gray-400'}>{player.team}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`font-mono ${isNotInList ? 'text-gray-500' : 'text-accent-400'}`}>{player.quotation}</span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  player.listStatus === 'IN_LIST'
                                    ? 'bg-secondary-500/20 text-secondary-400'
                                    : 'bg-danger-500/20 text-danger-400'
                                }`}>
                                  {player.listStatus === 'IN_LIST' ? 'In Lista' : 'Non in Lista'}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  <div className="px-4 py-3 border-t border-surface-50/20 flex items-center justify-between">
                    <p className="text-sm text-gray-400">
                      {playersData.total} giocatori totali
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={playersData.page <= 1}
                        onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
                      >
                        Prec.
                      </Button>
                      <span className="px-3 py-1 text-sm text-gray-400">
                        {playersData.page} / {playersData.totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={playersData.page >= playersData.totalPages}
                        onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
                      >
                        Succ.
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-8 text-center text-gray-400">
                  <p>Nessun giocatore trovato</p>
                  <p className="text-sm mt-1">Carica un file quotazioni per popolare la lista</p>
                </div>
              )}
            </Card>
          </>
        )}

        {/* LEAGUES TAB */}
        {activeTab === 'leagues' && (
          <>
            {/* Search */}
            <Card className="p-4">
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1">Cerca lega o utente</label>
                  <Input
                    value={leagueSearchInput}
                    onChange={(e) => setLeagueSearchInput(e.target.value)}
                    placeholder="Nome lega o username..."
                    onKeyDown={(e) => e.key === 'Enter' && handleLeagueSearch()}
                  />
                </div>
                <Button onClick={handleLeagueSearch} variant="primary">
                  Cerca
                </Button>
                {leagueSearch && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setLeagueSearchInput('')
                      setLeagueSearch('')
                    }}
                  >
                    Reset
                  </Button>
                )}
              </div>
              {leagueSearch && (
                <p className="text-sm text-gray-400 mt-2">
                  Risultati per: <span className="text-primary-400">"{leagueSearch}"</span>
                </p>
              )}
            </Card>

            <Card className="overflow-hidden">
              {leaguesLoading ? (
                <div className="p-8 text-center">
                  <div className="w-10 h-10 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto"></div>
                </div>
              ) : leagues.length > 0 ? (
                <div className="divide-y divide-surface-50/10">
                  {leagues.map((league) => (
                    <div key={league.id}>
                      <button
                        onClick={() => setExpandedLeague(expandedLeague === league.id ? null : league.id)}
                        className="w-full px-6 py-4 flex items-center justify-between hover:bg-surface-300/50 transition-colors text-left"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
                            <span className="text-xl">🏟️</span>
                          </div>
                          <div>
                            <h3 className="font-bold text-white">{league.name}</h3>
                            <p className="text-sm text-gray-400">
                              {league._count.members} membri · {STATUS_LABELS[league.status] || league.status}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm text-gray-400">Budget iniziale</p>
                            <p className="font-bold text-accent-400">{league.initialBudget}</p>
                          </div>
                          <span className={`text-gray-400 transition-transform ${expandedLeague === league.id ? 'rotate-180' : ''}`}>
                            ▼
                          </span>
                        </div>
                      </button>

                      {expandedLeague === league.id && (
                        <div className="px-6 pb-4 bg-surface-300/30">
                          <h4 className="text-sm font-bold text-gray-400 uppercase mb-3">Membri della Lega</h4>
                          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {league.members.map((member) => (
                              <div key={member.id} className="bg-surface-200 rounded-lg p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <div>
                                    <p className="font-medium text-white">{member.user.username}</p>
                                    <p className="text-xs text-gray-400">{member.user.email}</p>
                                  </div>
                                  <div className="text-right">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                      member.role === 'ADMIN'
                                        ? 'bg-accent-500/20 text-accent-400 border border-accent-500/40'
                                        : 'bg-surface-50/20 text-gray-400 border border-surface-50/30'
                                    }`}>
                                      {member.role === 'ADMIN' ? 'Presidente' : 'DG'}
                                    </span>
                                    <p className="text-sm font-mono text-accent-400 mt-1">{member.currentBudget}</p>
                                  </div>
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    loadMemberRoster(member.id)
                                  }}
                                >
                                  Vedi Rosa
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-gray-400">
                  <p>Nessuna lega trovata</p>
                  {leagueSearch && <p className="text-sm mt-1">Prova a cercare con altri termini</p>}
                </div>
              )}
            </Card>
          </>
        )}

        {/* USERS TAB */}
        {activeTab === 'users' && (
          <Card className="overflow-hidden">
            {usersLoading ? (
              <div className="p-8 text-center">
                <div className="w-10 h-10 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto"></div>
              </div>
            ) : users.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-surface-300">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">Username</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">Email</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-400 uppercase">Leghe</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-400 uppercase">Stato</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-400 uppercase">Ruolo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-50/10">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-surface-300/50">
                        <td className="px-4 py-3">
                          <span className="font-medium text-white">{user.username}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-400">{user.email}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-mono text-primary-400">{user._count.leagueMemberships}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            user.emailVerified
                              ? 'bg-secondary-500/20 text-secondary-400'
                              : 'bg-warning-500/20 text-warning-400'
                          }`}>
                            {user.emailVerified ? 'Verificato' : 'Non verificato'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {user.isSuperAdmin && (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-accent-500/20 text-accent-400">
                              SuperAdmin
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-gray-400">
                <p>Nessun utente trovato</p>
              </div>
            )}
          </Card>
        )}
      </main>

      {/* Classification Modal */}
      {showClassificationModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-200 rounded-xl border border-surface-50/20 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className={`p-6 border-b border-surface-50/20 bg-gradient-to-r ${
              classificationStep === 'success'
                ? 'from-secondary-500/10 to-surface-200'
                : classificationStep === 'confirm'
                ? 'from-primary-500/10 to-surface-200'
                : 'from-warning-500/10 to-surface-200'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    classificationStep === 'success'
                      ? 'bg-secondary-500/20'
                      : classificationStep === 'confirm'
                      ? 'bg-primary-500/20'
                      : 'bg-warning-500/20'
                  }`}>
                    <span className="text-2xl">
                      {classificationStep === 'success' ? '✅' : classificationStep === 'confirm' ? '📋' : '⚠️'}
                    </span>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">
                      {classificationStep === 'success'
                        ? 'Classificazione Completata'
                        : classificationStep === 'confirm'
                        ? 'Conferma Classificazioni'
                        : 'Classifica Giocatori Usciti'}
                    </h2>
                    <p className="text-sm text-gray-400">
                      {classificationStep === 'success'
                        ? `${classifiedCount} giocatori classificati con successo`
                        : classificationStep === 'confirm'
                        ? 'Verifica le classificazioni prima di confermare'
                        : 'Indica il motivo per cui ogni giocatore non e\' piu\' in lista'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeClassificationModal}
                  className="w-10 h-10 rounded-lg bg-surface-300 hover:bg-surface-50/20 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto flex-1">
              {/* Step 1: Edit Classifications */}
              {classificationStep === 'edit' && (
                <>
                  {/* Legend */}
                  <div className="bg-surface-300 rounded-lg p-4 mb-6">
                    <h3 className="text-sm font-bold text-gray-400 uppercase mb-3">Legenda Classificazioni</h3>
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="flex items-start gap-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium border ${EXIT_REASON_COLORS.RITIRATO}`}>RITIRATO</span>
                        <p className="text-xs text-gray-400">Il giocatore ha smesso di giocare. Contratto terminato senza compenso.</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium border ${EXIT_REASON_COLORS.RETROCESSO}`}>RETROCESSO</span>
                        <p className="text-xs text-gray-400">Il giocatore e' sceso in Serie B o inferiore. Il manager decidera' se tenerlo.</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium border ${EXIT_REASON_COLORS.ESTERO}`}>ESTERO</span>
                        <p className="text-xs text-gray-400">Il giocatore e' andato all'estero. Il manager ricevera' un compenso se rilascia.</p>
                      </div>
                    </div>
                  </div>

                  {/* Players List */}
                  <div className="space-y-3">
                    {playersNeedingClassification.map((player) => (
                      <div key={player.playerId} className="bg-surface-300 rounded-lg p-4">
                        <div className="flex items-center justify-between flex-wrap gap-4">
                          <div className="flex items-center gap-3">
                            <span className={`w-10 h-10 rounded-full bg-gradient-to-br ${POSITION_COLORS[player.position]} flex items-center justify-center text-white font-bold text-sm`}>
                              {player.position}
                            </span>
                            <div>
                              <p className="font-medium text-white">{player.playerName}</p>
                              <p className="text-sm text-gray-400">{player.team} · Quot. <span className="text-accent-400">{player.lastQuotation}</span></p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="text-right mr-4">
                              <p className="text-xs text-gray-500">Contratti attivi</p>
                              <p className="text-sm">
                                {player.contracts.map((c, i) => (
                                  <span key={c.memberId} className="text-primary-400">
                                    {i > 0 && ', '}
                                    {c.memberUsername}
                                  </span>
                                ))}
                              </p>
                            </div>

                            <select
                              value={classifications[player.playerId] || 'RITIRATO'}
                              onChange={(e) => handleClassificationChange(player.playerId, e.target.value as ExitReason)}
                              className={`px-4 py-2 rounded-lg border text-sm font-medium ${
                                EXIT_REASON_COLORS[classifications[player.playerId] || 'RITIRATO']
                              } bg-surface-200 cursor-pointer min-w-[140px]`}
                            >
                              <option value="RITIRATO">Ritirato</option>
                              <option value="RETROCESSO">Retrocesso</option>
                              <option value="ESTERO">Estero</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Step 2: Confirm - Recap */}
              {classificationStep === 'confirm' && (
                <>
                  {/* Summary by type */}
                  <div className="grid md:grid-cols-3 gap-4 mb-6">
                    {(['RITIRATO', 'RETROCESSO', 'ESTERO'] as ExitReason[]).map(reason => {
                      const count = submittedClassifications.filter(c => c.reason === reason).length
                      return (
                        <div key={reason} className={`p-4 rounded-lg border ${EXIT_REASON_COLORS[reason]} bg-surface-300`}>
                          <div className="text-2xl font-bold">{count}</div>
                          <div className="text-sm opacity-80">
                            {reason === 'RITIRATO' ? 'Ritirati' : reason === 'RETROCESSO' ? 'Retrocessi' : 'Estero'}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Detailed List */}
                  <h4 className="text-sm font-bold text-gray-400 uppercase mb-3">Riepilogo Classificazioni</h4>
                  <div className="space-y-2">
                    {submittedClassifications.map(({ player, reason }) => (
                      <div key={player.playerId} className="bg-surface-300 rounded-lg p-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className={`w-8 h-8 rounded-full bg-gradient-to-br ${POSITION_COLORS[player.position]} flex items-center justify-center text-white font-bold text-xs`}>
                            {player.position}
                          </span>
                          <div>
                            <p className="font-medium text-white text-sm">{player.playerName}</p>
                            <p className="text-xs text-gray-500">{player.team}</p>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded text-xs font-medium border ${EXIT_REASON_COLORS[reason]}`}>
                          {reason === 'RITIRATO' ? 'Ritirato' : reason === 'RETROCESSO' ? 'Retrocesso' : 'Estero'}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Error message */}
                  {classificationResult && !classificationResult.success && (
                    <div className="mt-4 p-4 rounded-lg bg-danger-500/20 border border-danger-500/50 text-danger-400">
                      <p className="font-medium">{classificationResult.message}</p>
                    </div>
                  )}
                </>
              )}

              {/* Step 3: Success */}
              {classificationStep === 'success' && (
                <div className="text-center py-8">
                  <div className="w-20 h-20 bg-secondary-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <span className="text-5xl">✅</span>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">Classificazione Salvata!</h3>
                  <p className="text-gray-400 mb-8">
                    {classifiedCount} giocatori sono stati classificati correttamente.
                    <br />
                    I manager interessati vedranno i loro giocatori nella fase Indennizzi.
                  </p>

                  {/* Summary by type */}
                  <div className="grid md:grid-cols-3 gap-4 max-w-lg mx-auto">
                    {(['RITIRATO', 'RETROCESSO', 'ESTERO'] as ExitReason[]).map(reason => {
                      const count = submittedClassifications.filter(c => c.reason === reason).length
                      if (count === 0) return null
                      return (
                        <div key={reason} className={`p-3 rounded-lg border ${EXIT_REASON_COLORS[reason]} bg-surface-300`}>
                          <div className="text-xl font-bold">{count}</div>
                          <div className="text-xs opacity-80">
                            {reason === 'RITIRATO' ? 'Ritirati' : reason === 'RETROCESSO' ? 'Retrocessi' : 'Estero'}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-surface-50/20 bg-surface-300 flex gap-3">
              {classificationStep === 'edit' && (
                <>
                  <Button variant="outline" className="flex-1" onClick={closeClassificationModal}>
                    Annulla
                  </Button>
                  <Button
                    className="flex-1 btn-primary"
                    onClick={goToConfirmStep}
                    disabled={playersNeedingClassification.length === 0}
                  >
                    Prosegui ({playersNeedingClassification.length})
                  </Button>
                </>
              )}

              {classificationStep === 'confirm' && (
                <>
                  <Button variant="outline" className="flex-1" onClick={goBackToEdit}>
                    Modifica
                  </Button>
                  <Button
                    className="flex-1 btn-primary"
                    onClick={handleSubmitClassifications}
                    disabled={classifyingPlayers}
                  >
                    {classifyingPlayers ? 'Salvataggio...' : 'Conferma e Salva'}
                  </Button>
                </>
              )}

              {classificationStep === 'success' && (
                <Button className="flex-1 btn-primary" onClick={closeClassificationModal}>
                  Chiudi
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Roster Modal */}
      {selectedMember && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-200 rounded-xl border border-surface-50/20 max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-6 border-b border-surface-50/20 bg-gradient-to-r from-surface-300 to-surface-200">
              <div className="flex items-center justify-between">
                <div>
                  {rosterData ? (
                    <>
                      <h2 className="text-xl font-bold text-white">
                        Rosa di {rosterData.member.username}
                      </h2>
                      <p className="text-sm text-gray-400">
                        {rosterData.member.league.name} · Budget: <span className="text-accent-400 font-mono">{rosterData.member.currentBudget}</span>
                      </p>
                    </>
                  ) : (
                    <h2 className="text-xl font-bold text-white">Caricamento rosa...</h2>
                  )}
                </div>
                <button
                  onClick={closeRosterModal}
                  className="w-10 h-10 rounded-lg bg-surface-300 hover:bg-surface-50/20 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto flex-1">
              {rosterLoading ? (
                <div className="py-12 text-center">
                  <div className="w-12 h-12 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-400">Caricamento rosa...</p>
                </div>
              ) : rosterData && rosterData.roster.length > 0 ? (
                <div className="space-y-4">
                  {(['P', 'D', 'C', 'A'] as const).map(pos => {
                    const posPlayers = rosterData.roster.filter(r => r.player.position === pos)
                    if (posPlayers.length === 0) return null
                    return (
                      <div key={pos}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`w-7 h-7 rounded-full bg-gradient-to-br ${POSITION_COLORS[pos]} flex items-center justify-center text-white font-bold text-xs`}>
                            {pos}
                          </span>
                          <span className="text-sm font-bold text-gray-300">{POSITION_NAMES[pos]} ({posPlayers.length})</span>
                        </div>
                        <div className="grid gap-2">
                          {posPlayers.map((entry) => (
                            <div key={entry.id} className="bg-surface-300 rounded-lg p-3 flex items-center justify-between">
                              <div>
                                <p className="font-medium text-white">{entry.player.name}</p>
                                <p className="text-xs text-gray-400">{entry.player.team}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm text-gray-400">
                                  Quot. <span className="text-accent-400 font-mono">{entry.player.quotation}</span>
                                </p>
                                {entry.contract && (
                                  <p className="text-xs text-gray-500">
                                    Pagato: <span className="text-primary-400">{entry.contract.purchasePrice}</span>
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : rosterData ? (
                <div className="py-12 text-center text-gray-400">
                  <p className="text-5xl mb-4">📋</p>
                  <p>Questo Direttore Generale non ha ancora giocatori in rosa</p>
                </div>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-surface-50/20 bg-surface-300">
              <Button variant="outline" className="w-full" onClick={closeRosterModal}>
                Chiudi
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
