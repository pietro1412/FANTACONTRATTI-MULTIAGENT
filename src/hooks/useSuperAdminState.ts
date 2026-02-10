import { useState, useEffect, useRef } from 'react'
import { superadminApi, playerApi } from '../services/api'
import type {
  PlayersStats,
  PlayersListData,
  League,
  User,
  UploadRecord,
  ExitedPlayerInfo,
  ExitReason,
  MemberRosterData,
  MatchProposal,
  MatchedPlayer,
} from '../types/superadmin.types'

export function useSuperAdminState(initialTab?: 'upload' | 'players' | 'leagues' | 'users' | 'stats') {
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
  const [activeTab, setActiveTab] = useState<'upload' | 'players' | 'leagues' | 'users' | 'stats'>(initialTab || 'upload')

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

  // API-Football state
  const [apiFootballStatus, setApiFootballStatus] = useState<{
    totalPlayers: number
    matched: number
    unmatched: number
    withStats: number
    withoutStats: number
    lastSync: string | null
  } | null>(null)
  const [apiFootballLoading, setApiFootballLoading] = useState(false)
  const [matchingResult, setMatchingResult] = useState<{
    matched: number
    unmatched: Array<{ id: string; name: string; team: string }>
    ambiguous: Array<{ player: { id: string; name: string; team: string }; candidates: Array<{ apiId: number; name: string }> }>
  } | null>(null)
  const [syncResult, setSyncResult] = useState<{
    synced: number
    notFound: number
    apiCallsUsed: number
  } | null>(null)
  const [manualMatchPlayerId, setManualMatchPlayerId] = useState<string>('')
  const [manualMatchApiId, setManualMatchApiId] = useState<string>('')

  // Matching Assistito state
  const [matchProposals, setMatchProposals] = useState<MatchProposal[]>([])
  const [proposalsLoading, setProposalsLoading] = useState(false)
  const [proposalsError, setProposalsError] = useState<string | null>(null)
  const [cacheRefreshing, setCacheRefreshing] = useState(false)
  const [cacheStatus, setCacheStatus] = useState<{ count: number; refreshed: boolean } | null>(null)
  const [searchModalOpen, setSearchModalOpen] = useState(false)
  const [searchModalPlayer, setSearchModalPlayer] = useState<MatchProposal['dbPlayer'] | null>(null)
  const [apiSearchQuery, setApiSearchQuery] = useState('')
  const [apiSearchResults, setApiSearchResults] = useState<Array<{ id: number; name: string; team: string; position: string }>>([])
  const [apiSearchLoading, setApiSearchLoading] = useState(false)
  const [selectedApiPlayer, setSelectedApiPlayer] = useState<number | null>(null)
  const [confirmingMatch, setConfirmingMatch] = useState(false)

  // Matched players state (for viewing/editing existing matches)
  const [matchedPlayers, setMatchedPlayers] = useState<MatchedPlayer[]>([])
  const [matchedLoading, setMatchedLoading] = useState(false)
  const [matchedSearch, setMatchedSearch] = useState('')
  const [removingMatch, setRemovingMatch] = useState<string | null>(null)

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
      if (activeTab === 'stats') {
        loadApiFootballStatus()
        loadMatchProposals() // Auto-load proposals
        loadMatchedPlayers() // Auto-load matched players
      }
    }
  }, [isSuperAdmin, activeTab, filters, leagueSearch])

  async function loadApiFootballStatus() {
    setApiFootballLoading(true)
    try {
      const res = await superadminApi.getApiFootballStatus()
      if (res.success && res.data) {
        setApiFootballStatus(res.data)
      }
    } catch (err) {
      console.error('Error loading API-Football status:', err)
    } finally {
      setApiFootballLoading(false)
    }
  }

  async function loadMatchProposals() {
    setProposalsLoading(true)
    setProposalsError(null)
    try {
      const res = await superadminApi.getMatchProposals()
      if (res.success && res.data) {
        setMatchProposals(res.data.proposals)
        setCacheStatus({ count: res.data.proposals.length, refreshed: res.data.cacheRefreshed })
      } else {
        setProposalsError(res.message || 'Errore nel caricamento delle proposte')
      }
    } catch (err) {
      console.error('Error loading match proposals:', err)
      setProposalsError('Errore di rete nel caricamento delle proposte')
    } finally {
      setProposalsLoading(false)
    }
  }

  async function handleRefreshCache() {
    setCacheRefreshing(true)
    setProposalsError(null)
    try {
      const res = await superadminApi.refreshApiFootballCache()
      if (res.success) {
        // After cache refresh, reload proposals
        await loadMatchProposals()
      } else {
        setProposalsError(res.message || 'Errore nel refresh della cache')
      }
    } catch (err) {
      console.error('Error refreshing cache:', err)
      setProposalsError('Errore di rete nel refresh della cache')
    } finally {
      setCacheRefreshing(false)
    }
  }

  async function handleConfirmProposal(dbPlayerId: string, apiFootballId: number) {
    setConfirmingMatch(true)
    try {
      const res = await superadminApi.confirmMatch(dbPlayerId, apiFootballId)
      if (res.success) {
        // Remove from proposals
        setMatchProposals(prev => prev.filter(p => p.dbPlayer.id !== dbPlayerId))
        // Refresh status
        loadApiFootballStatus()
      }
    } catch (err) {
      console.error('Error confirming match:', err)
    } finally {
      setConfirmingMatch(false)
    }
  }

  async function handleApiSearch() {
    if (apiSearchQuery.length < 2) return
    setApiSearchLoading(true)
    try {
      const res = await superadminApi.searchApiFootballPlayers(apiSearchQuery)
      if (res.success && res.data) {
        setApiSearchResults(res.data.players)
      }
    } catch (err) {
      console.error('Error searching API players:', err)
    } finally {
      setApiSearchLoading(false)
    }
  }

  function openSearchModal(dbPlayer: MatchProposal['dbPlayer']) {
    setSearchModalPlayer(dbPlayer)
    setSearchModalOpen(true)
    setApiSearchQuery('')
    setApiSearchResults([])
    setSelectedApiPlayer(null)
  }

  function closeSearchModal() {
    setSearchModalOpen(false)
    setSearchModalPlayer(null)
    setApiSearchQuery('')
    setApiSearchResults([])
    setSelectedApiPlayer(null)
  }

  async function loadMatchedPlayers(search?: string) {
    setMatchedLoading(true)
    try {
      const res = await superadminApi.getMatchedPlayers(search)
      if (res.success && res.data) {
        setMatchedPlayers(res.data.players)
      }
    } catch (err) {
      console.error('Error loading matched players:', err)
    } finally {
      setMatchedLoading(false)
    }
  }

  async function handleRemoveMatch(playerId: string) {
    setRemovingMatch(playerId)
    try {
      const res = await superadminApi.removeMatch(playerId)
      if (res.success) {
        // Remove from matched list
        setMatchedPlayers(prev => prev.filter(p => p.id !== playerId))
        // Refresh proposals and status
        loadMatchProposals()
        loadApiFootballStatus()
      }
    } catch (err) {
      console.error('Error removing match:', err)
    } finally {
      setRemovingMatch(null)
    }
  }

  async function handleManualAssociation() {
    if (!searchModalPlayer || !selectedApiPlayer) return
    setConfirmingMatch(true)
    try {
      const res = await superadminApi.confirmMatch(searchModalPlayer.id, selectedApiPlayer)
      if (res.success) {
        // Remove from proposals
        setMatchProposals(prev => prev.filter(p => p.dbPlayer.id !== searchModalPlayer.id))
        closeSearchModal()
        loadApiFootballStatus()
        loadMatchedPlayers(matchedSearch) // Refresh matched list
      }
    } catch (err) {
      console.error('Error manual association:', err)
    } finally {
      setConfirmingMatch(false)
    }
  }

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

  // Derived state: Get stats by position
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

  return {
    // Core state
    isSuperAdmin,
    isLoading,
    stats,
    sheetName,
    setSheetName,
    importing,
    deleting,
    showDeleteConfirm,
    setShowDeleteConfirm,
    importResult,
    fileInputRef,

    // Upload history
    uploadHistory,
    historyLoading,

    // Tab state
    activeTab,
    setActiveTab,

    // Players list
    playersData,
    playersLoading,
    filters,
    setFilters,
    teamDropdownOpen,
    setTeamDropdownOpen,
    availableTeams,

    // Leagues
    leagues,
    leaguesLoading,
    expandedLeague,
    setExpandedLeague,
    leagueSearch,
    setLeagueSearch,
    leagueSearchInput,
    setLeagueSearchInput,

    // Roster modal
    selectedMember,
    rosterData,
    rosterLoading,

    // Users
    users,
    usersLoading,

    // Classification
    playersNeedingClassification,
    classificationLoading,
    showClassificationModal,
    classifications,
    classifyingPlayers,
    classificationResult,
    classificationStep,
    submittedClassifications,
    classifiedCount,

    // API-Football
    apiFootballStatus,
    setApiFootballStatus,
    apiFootballLoading,
    setApiFootballLoading,
    matchingResult,
    setMatchingResult,
    syncResult,
    setSyncResult,
    manualMatchPlayerId,
    setManualMatchPlayerId,
    manualMatchApiId,
    setManualMatchApiId,

    // Matching Assistito
    matchProposals,
    proposalsLoading,
    proposalsError,
    cacheRefreshing,
    cacheStatus,
    searchModalOpen,
    searchModalPlayer,
    apiSearchQuery,
    setApiSearchQuery,
    apiSearchResults,
    apiSearchLoading,
    selectedApiPlayer,
    setSelectedApiPlayer,
    confirmingMatch,

    // Matched players
    matchedPlayers,
    matchedLoading,
    matchedSearch,
    setMatchedSearch,
    removingMatch,

    // Derived state
    positionStats,

    // Handlers
    handleFileUpload,
    handleDeleteAllPlayers,
    handleRefreshCache,
    handleConfirmProposal,
    handleApiSearch,
    openSearchModal,
    closeSearchModal,
    handleRemoveMatch,
    handleManualAssociation,
    loadMemberRoster,
    closeRosterModal,
    handleLeagueSearch,
    openClassificationModal,
    closeClassificationModal,
    handleClassificationChange,
    goToConfirmStep,
    goBackToEdit,
    handleSubmitClassifications,
    loadMatchProposals,
    loadMatchedPlayers,
    loadApiFootballStatus,

    // API references for inline handlers in JSX
    superadminApi,
  }
}
