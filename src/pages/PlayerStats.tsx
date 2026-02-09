import { useState, useEffect, useMemo, useCallback } from 'react'
import { playerApi, leagueApi } from '../services/api'
import { Navigation } from '../components/Navigation'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import RadarChart from '../components/ui/RadarChart'
import { getPlayerPhotoUrl, getTeamLogoUrl } from '../utils/player-images'

// Position colors
const POSITION_COLORS: Record<string, string> = {
  P: 'from-yellow-500 to-yellow-600',
  D: 'from-green-500 to-green-600',
  C: 'from-blue-500 to-blue-600',
  A: 'from-red-500 to-red-600',
}

const POSITION_LABELS: Record<string, string> = {
  P: 'Portiere',
  D: 'Difensore',
  C: 'Centrocampista',
  A: 'Attaccante',
}

// Player colors for radar chart
const PLAYER_CHART_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#a855f7']

// Quotation styling based on value
function getQuotationStyle(quotation: number): { bg: string; text: string; glow: string } {
  if (quotation >= 40) return { bg: 'from-purple-600 to-purple-700', text: 'text-white', glow: 'shadow-purple-500/30' }
  if (quotation >= 25) return { bg: 'from-amber-500 to-amber-600', text: 'text-white', glow: 'shadow-amber-500/30' }
  if (quotation >= 15) return { bg: 'from-sky-500 to-sky-600', text: 'text-white', glow: 'shadow-sky-500/30' }
  if (quotation >= 8) return { bg: 'from-emerald-500 to-emerald-600', text: 'text-white', glow: 'shadow-emerald-500/30' }
  return { bg: 'from-gray-500 to-gray-600', text: 'text-white', glow: '' }
}

type PlayerWithStats = {
  id: string
  name: string
  team: string
  position: string
  quotation: number
  apiFootballId: number | null
  statsSyncedAt: string | null
  stats: {
    appearances: number
    minutes: number
    rating: number | null
    goals: number
    assists: number
    yellowCards: number
    redCards: number
    passesTotal: number
    passesKey: number
    passAccuracy: number | null
    shotsTotal: number
    shotsOn: number
    tacklesTotal: number
    interceptions: number
    dribblesAttempts: number
    dribblesSuccess: number
    penaltyScored: number
    penaltyMissed: number
  } | null
}

// ==================== COLUMN DEFINITIONS ====================

interface ColumnDef {
  key: string
  label: string
  shortLabel: string
  category: 'general' | 'attack' | 'defense' | 'passing' | 'discipline'
  getValue: (player: PlayerWithStats) => number | string | null
  format?: (val: number | null) => string
  colorClass?: string
  sortable?: boolean
}

const STAT_COLUMNS: ColumnDef[] = [
  // General
  { key: 'appearances', label: 'Presenze', shortLabel: 'Pres', category: 'general', getValue: p => p.stats?.appearances ?? null, sortable: true },
  { key: 'minutes', label: 'Minuti Giocati', shortLabel: 'Min', category: 'general', getValue: p => p.stats?.minutes ?? null, sortable: true },
  { key: 'rating', label: 'Rating Medio', shortLabel: 'Rating', category: 'general', getValue: p => p.stats?.rating ?? null, format: v => v?.toFixed(2) ?? '-', sortable: true },

  // Attack
  { key: 'goals', label: 'Gol', shortLabel: 'Gol', category: 'attack', getValue: p => p.stats?.goals ?? null, colorClass: 'text-secondary-400', sortable: true },
  { key: 'assists', label: 'Assist', shortLabel: 'Ass', category: 'attack', getValue: p => p.stats?.assists ?? null, colorClass: 'text-primary-400', sortable: true },
  { key: 'ga', label: 'Gol + Assist', shortLabel: 'G+A', category: 'attack', getValue: p => p.stats ? p.stats.goals + p.stats.assists : null, colorClass: 'text-white font-bold', sortable: true },
  { key: 'shotsTotal', label: 'Tiri Totali', shortLabel: 'Tiri', category: 'attack', getValue: p => p.stats?.shotsTotal ?? null, sortable: true },
  { key: 'shotsOn', label: 'Tiri in Porta', shortLabel: 'TiP', category: 'attack', getValue: p => p.stats?.shotsOn ?? null, sortable: true },
  { key: 'shotsAccuracy', label: 'Precisione Tiri %', shortLabel: 'Tiri%', category: 'attack', getValue: p => p.stats && p.stats.shotsTotal > 0 ? Math.round((p.stats.shotsOn / p.stats.shotsTotal) * 100) : null, format: v => v !== null ? `${v}%` : '-', sortable: true },
  { key: 'penaltyScored', label: 'Rigori Segnati', shortLabel: 'RigS', category: 'attack', getValue: p => p.stats?.penaltyScored ?? null, sortable: true },
  { key: 'penaltyMissed', label: 'Rigori Sbagliati', shortLabel: 'RigX', category: 'attack', getValue: p => p.stats?.penaltyMissed ?? null, colorClass: 'text-danger-400', sortable: true },

  // Defense
  { key: 'tacklesTotal', label: 'Contrasti', shortLabel: 'Tckl', category: 'defense', getValue: p => p.stats?.tacklesTotal ?? null, sortable: true },
  { key: 'interceptions', label: 'Intercetti', shortLabel: 'Int', category: 'defense', getValue: p => p.stats?.interceptions ?? null, sortable: true },

  // Passing
  { key: 'passesTotal', label: 'Passaggi Totali', shortLabel: 'Pass', category: 'passing', getValue: p => p.stats?.passesTotal ?? null, sortable: true },
  { key: 'passesKey', label: 'Passaggi Chiave', shortLabel: 'KeyP', category: 'passing', getValue: p => p.stats?.passesKey ?? null, colorClass: 'text-primary-400', sortable: true },
  { key: 'passAccuracy', label: 'Precisione Pass %', shortLabel: 'Pass%', category: 'passing', getValue: p => p.stats?.passAccuracy ?? null, format: v => v !== null ? `${v}%` : '-', sortable: true },
  { key: 'dribblesAttempts', label: 'Dribbling Tentati', shortLabel: 'DrbT', category: 'passing', getValue: p => p.stats?.dribblesAttempts ?? null, sortable: true },
  { key: 'dribblesSuccess', label: 'Dribbling Riusciti', shortLabel: 'DrbR', category: 'passing', getValue: p => p.stats?.dribblesSuccess ?? null, sortable: true },
  { key: 'dribblesAccuracy', label: 'Dribbling %', shortLabel: 'Drb%', category: 'passing', getValue: p => p.stats && p.stats.dribblesAttempts > 0 ? Math.round((p.stats.dribblesSuccess / p.stats.dribblesAttempts) * 100) : null, format: v => v !== null ? `${v}%` : '-', sortable: true },

  // Discipline
  { key: 'yellowCards', label: 'Ammonizioni', shortLabel: 'Amm', category: 'discipline', getValue: p => p.stats?.yellowCards ?? null, colorClass: 'text-warning-400', sortable: true },
  { key: 'redCards', label: 'Espulsioni', shortLabel: 'Esp', category: 'discipline', getValue: p => p.stats?.redCards ?? null, colorClass: 'text-danger-400', sortable: true },
]

// ==================== PRESETS ====================

const COLUMN_PRESETS: Record<string, { label: string; emoji: string; columns: string[] }> = {
  all: {
    label: 'Tutte',
    emoji: '📊',
    columns: STAT_COLUMNS.map(c => c.key),
  },
  P: {
    label: 'Portiere',
    emoji: '🧤',
    columns: ['appearances', 'minutes', 'rating', 'passesTotal', 'passAccuracy', 'yellowCards', 'redCards'],
  },
  D: {
    label: 'Difensore',
    emoji: '🛡️',
    columns: ['appearances', 'minutes', 'rating', 'tacklesTotal', 'interceptions', 'passesTotal', 'yellowCards', 'redCards', 'goals', 'assists'],
  },
  C: {
    label: 'Centrocampista',
    emoji: '🎯',
    columns: ['appearances', 'minutes', 'rating', 'assists', 'passesKey', 'passesTotal', 'passAccuracy', 'dribblesSuccess', 'tacklesTotal', 'goals', 'ga'],
  },
  A: {
    label: 'Attaccante',
    emoji: '⚽',
    columns: ['appearances', 'minutes', 'rating', 'goals', 'assists', 'ga', 'shotsTotal', 'shotsOn', 'shotsAccuracy', 'penaltyScored', 'dribblesSuccess'],
  },
  essential: {
    label: 'Essenziali',
    emoji: '✨',
    columns: ['appearances', 'rating', 'goals', 'assists', 'ga', 'yellowCards'],
  },
}

const LOCALSTORAGE_KEY = 'playerStats_visibleColumns'

// ==================== COMPONENT ====================

interface PlayerStatsProps {
  leagueId: string
  onNavigate: (page: string, params?: Record<string, string>) => void
}

export default function PlayerStats({ leagueId, onNavigate }: PlayerStatsProps) {
  const [players, setPlayers] = useState<PlayerWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [teams, setTeams] = useState<string[]>([])

  // League info for Navigation
  const [leagueName, setLeagueName] = useState<string>('')
  const [teamName, setTeamName] = useState<string>('')
  const [isLeagueAdmin, setIsLeagueAdmin] = useState(false)

  // Filters
  const [search, setSearch] = useState('')
  const [positionFilter, setPositionFilter] = useState<string>('')
  const [teamFilter, setTeamFilter] = useState<string>('')
  const [sortBy, setSortBy] = useState<string>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  // Pagination
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  // Comparison
  const [selectedForCompare, setSelectedForCompare] = useState<Set<string>>(new Set())
  const [showCompareModal, setShowCompareModal] = useState(false)

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(LOCALSTORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed
        }
      }
    } catch (e) {
      console.error('Error loading column preferences:', e)
    }
    return COLUMN_PRESETS.essential.columns
  })
  const [showColumnSelector, setShowColumnSelector] = useState(false)

  // Save column preferences to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(visibleColumns))
    } catch (e) {
      console.error('Error saving column preferences:', e)
    }
  }, [visibleColumns])

  // Backend-sortable columns
  const backendSortableColumns = ['name', 'team', 'position', 'quotation']

  // Get visible column definitions
  const visibleColumnDefs = useMemo(() => {
    return STAT_COLUMNS.filter(col => visibleColumns.includes(col.key))
  }, [visibleColumns])

  // Client-side sorted players (for stats columns)
  const sortedPlayers = useMemo(() => {
    if (backendSortableColumns.includes(sortBy)) {
      return players // Already sorted by backend
    }

    // Find the column definition for sorting
    const colDef = STAT_COLUMNS.find(c => c.key === sortBy)

    return [...players].sort((a, b) => {
      let aVal: number | null = 0
      let bVal: number | null = 0

      if (colDef) {
        const aRaw = colDef.getValue(a)
        const bRaw = colDef.getValue(b)
        aVal = typeof aRaw === 'number' ? aRaw : 0
        bVal = typeof bRaw === 'number' ? bRaw : 0
      }

      return sortOrder === 'asc' ? (aVal ?? 0) - (bVal ?? 0) : (bVal ?? 0) - (aVal ?? 0)
    })
  }, [players, sortBy, sortOrder])

  useEffect(() => {
    loadLeagueInfo()
    loadTeams()
  }, [leagueId])

  async function loadLeagueInfo() {
    try {
      const res = await leagueApi.getById(leagueId)
      if (res.success && res.data) {
        const data = res.data as { name: string; userMembership?: { role: string; teamName?: string } }
        setLeagueName(data.name)
        setTeamName(data.userMembership?.teamName || '')
        setIsLeagueAdmin(data.userMembership?.role === 'ADMIN')
      }
    } catch (err) {
      console.error('Error loading league info:', err)
    }
  }

  useEffect(() => {
    // Only reload from backend when filters, pagination, or backend-sortable columns change
    if (backendSortableColumns.includes(sortBy)) {
      loadPlayers()
    }
  }, [positionFilter, teamFilter, sortBy, sortOrder, page])

  // Initial load
  useEffect(() => {
    loadPlayers()
  }, [])

  async function loadTeams() {
    try {
      const res = await playerApi.getTeams()
      if (res.success && res.data) {
        // Extract team names from objects
        const teamNames = res.data.map((t: { name: string }) => t.name)
        setTeams(teamNames)
      }
    } catch (err) {
      console.error('Error loading teams:', err)
    }
  }

  async function loadPlayers() {
    setLoading(true)
    try {
      const res = await playerApi.getStats({
        position: positionFilter || undefined,
        team: teamFilter || undefined,
        search: search || undefined,
        sortBy,
        sortOrder,
        page,
        limit: 50,
      })
      if (res.success && res.data) {
        setPlayers(res.data.players)
        setTotalPages(res.data.pagination.totalPages)
        setTotal(res.data.pagination.total)
      }
    } catch (err) {
      console.error('Error loading players:', err)
    } finally {
      setLoading(false)
    }
  }

  function handleSearch() {
    setPage(1)
    loadPlayers()
  }

  function handleSort(column: string) {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('desc')
    }
  }

  function togglePlayerForCompare(playerId: string) {
    setSelectedForCompare((prev) => {
      const next = new Set(prev)
      if (next.has(playerId)) {
        next.delete(playerId)
      } else if (next.size < 4) {
        next.add(playerId)
      }
      return next
    })
  }

  function clearComparison() {
    setSelectedForCompare(new Set())
  }

  // Column toggle functions
  const toggleColumn = useCallback((columnKey: string) => {
    setVisibleColumns(prev => {
      if (prev.includes(columnKey)) {
        return prev.filter(k => k !== columnKey)
      } else {
        return [...prev, columnKey]
      }
    })
  }, [])

  const applyPreset = useCallback((presetKey: string) => {
    const preset = COLUMN_PRESETS[presetKey]
    if (preset) {
      setVisibleColumns(preset.columns)
    }
  }, [])

  const playersToCompare = sortedPlayers.filter((p) => selectedForCompare.has(p.id))

  const SortIcon = ({ column }: { column: string }) => {
    if (sortBy !== column) return <span className="text-gray-600 ml-1">↕</span>
    return <span className="text-primary-400 ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
  }

  // Group columns by category for the selector
  const columnsByCategory = useMemo(() => {
    const grouped: Record<string, ColumnDef[]> = {}
    for (const col of STAT_COLUMNS) {
      if (!grouped[col.category]) {
        grouped[col.category] = []
      }
      grouped[col.category].push(col)
    }
    return grouped
  }, [])

  const categoryLabels: Record<string, string> = {
    general: 'Generali',
    attack: 'Attacco',
    defense: 'Difesa',
    passing: 'Passaggi & Dribbling',
    discipline: 'Disciplina',
  }

  return (
    <div className="min-h-screen bg-surface-100">
      <Navigation
        currentPage="playerStats"
        leagueId={leagueId}
        leagueName={leagueName}
        teamName={teamName}
        isLeagueAdmin={isLeagueAdmin}
        onNavigate={onNavigate}
      />

      <div className="p-4 md:p-6">
        <div className="max-w-[1800px] mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-xl md:text-2xl font-bold text-white mb-2">Statistiche Serie A</h1>
            <p className="text-gray-400">
              Analizza le statistiche dei giocatori della Serie A ({total} giocatori con dati)
            </p>
          </div>

          {/* Filters */}
          <Card className="p-3 md:p-4 mb-4 overflow-x-auto">
            <div className="flex flex-col sm:flex-row flex-wrap gap-3 md:gap-4 items-stretch sm:items-end min-w-0">
              {/* Search */}
              <div className="flex-1 min-w-0 sm:min-w-[180px]">
                <label className="block text-xs text-gray-400 mb-1">Cerca giocatore</label>
                <div className="flex gap-2">
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Nome..."
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="min-w-0 flex-1"
                  />
                  <Button onClick={handleSearch} variant="outline" className="flex-shrink-0">
                    🔍
                  </Button>
                </div>
              </div>

              {/* Position + Team filters in row on mobile */}
              <div className="flex gap-2 sm:gap-4">
                <div className="flex-1 sm:flex-none sm:w-32">
                  <label className="block text-xs text-gray-400 mb-1">Ruolo</label>
                  <select
                    value={positionFilter}
                    onChange={(e) => {
                      setPositionFilter(e.target.value)
                      setPage(1)
                    }}
                    className="w-full px-2 py-2 bg-surface-300 border border-surface-50/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Tutti</option>
                    <option value="P">P</option>
                    <option value="D">D</option>
                    <option value="C">C</option>
                    <option value="A">A</option>
                  </select>
                </div>

                <div className="flex-1 sm:flex-none sm:w-40">
                  <label className="block text-xs text-gray-400 mb-1">Squadra</label>
                  <select
                    value={teamFilter}
                    onChange={(e) => {
                      setTeamFilter(e.target.value)
                      setPage(1)
                    }}
                    className="w-full px-2 py-2 bg-surface-300 border border-surface-50/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Tutte</option>
                    {teams.map((team) => (
                      <option key={team} value={team}>
                        {team}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Compare buttons */}
              {selectedForCompare.size > 0 && (
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button
                    onClick={() => setShowCompareModal(true)}
                    className="btn-primary flex-1 sm:flex-none"
                    disabled={selectedForCompare.size < 2}
                  >
                    Confronta ({selectedForCompare.size})
                  </Button>
                  <Button onClick={clearComparison} variant="outline" className="flex-shrink-0">
                    ✕
                  </Button>
                </div>
              )}
            </div>
          </Card>

          {/* Column Selector & Presets */}
          <Card className="p-3 md:p-4 mb-4 overflow-x-auto">
            <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3 min-w-0">
              {/* Preset buttons - scrollable on mobile */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 w-full sm:w-auto">
                <span className="text-xs text-gray-400 mr-1 flex-shrink-0">Preset:</span>
                <div className="flex gap-1.5">
                  {Object.entries(COLUMN_PRESETS).map(([key, preset]) => (
                    <button
                      key={key}
                      onClick={() => applyPreset(key)}
                      className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                        JSON.stringify(visibleColumns.sort()) === JSON.stringify(preset.columns.sort())
                          ? 'bg-primary-500/30 text-primary-400 border border-primary-500/50'
                          : 'bg-surface-300 text-gray-400 hover:text-white hover:bg-surface-50/20'
                      }`}
                      title={preset.label}
                    >
                      <span className="mr-1">{preset.emoji}</span>
                      <span className="hidden sm:inline">{preset.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="hidden sm:block w-px h-6 bg-surface-50/30 mx-2" />

              {/* Custom column selector */}
              <div className="relative w-full sm:w-auto">
                <button
                  onClick={() => setShowColumnSelector(!showColumnSelector)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-surface-300 hover:bg-surface-50/20 rounded-lg text-sm text-gray-300 transition-colors w-full sm:w-auto justify-center sm:justify-start"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                  Personalizza ({visibleColumns.length})
                </button>

                {/* Column selector dropdown */}
                {showColumnSelector && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowColumnSelector(false)}
                    />
                    <div className="absolute top-full left-0 mt-2 w-80 bg-surface-200 border border-surface-50/20 rounded-xl shadow-xl z-50 max-h-[60vh] overflow-y-auto">
                      <div className="p-3 border-b border-surface-50/20 sticky top-0 bg-surface-200">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-white">Seleziona Colonne</span>
                          <button
                            onClick={() => setShowColumnSelector(false)}
                            className="text-gray-400 hover:text-white"
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      <div className="p-3 space-y-4">
                        {Object.entries(columnsByCategory).map(([category, columns]) => (
                          <div key={category}>
                            <h4 className="text-xs font-semibold text-primary-400 uppercase tracking-wider mb-2">
                              {categoryLabels[category]}
                            </h4>
                            <div className="space-y-1">
                              {columns.map(col => (
                                <label
                                  key={col.key}
                                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-300/50 cursor-pointer transition-colors"
                                >
                                  <input
                                    type="checkbox"
                                    checked={visibleColumns.includes(col.key)}
                                    onChange={() => toggleColumn(col.key)}
                                    className="w-4 h-4 rounded border-surface-50/30 bg-surface-300 text-primary-500 focus:ring-primary-500 focus:ring-offset-0"
                                  />
                                  <div className="flex-1">
                                    <span className="text-sm text-white">{col.label}</span>
                                    <span className="text-xs text-gray-500 ml-2">({col.shortLabel})</span>
                                  </div>
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <span className="text-xs text-gray-500 ml-auto">
                {visibleColumns.length} colonne selezionate
              </span>
            </div>
          </Card>

          {/* Stats Table */}
          <Card className="overflow-hidden">
            {loading ? (
              <div className="p-8 text-center">
                <div className="w-10 h-10 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto"></div>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto -mx-0">
                  <table className="w-full min-w-[800px]">
                    <thead className="bg-surface-300 sticky top-0">
                      <tr>
                        <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-400 w-10">
                          <input
                            type="checkbox"
                            className="rounded"
                            checked={selectedForCompare.size > 0}
                            onChange={() => selectedForCompare.size > 0 ? clearComparison() : null}
                          />
                        </th>
                        <th
                          scope="col"
                          aria-sort={sortBy === 'name' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                          className="px-3 py-3 text-left text-xs font-medium text-gray-400 cursor-pointer hover:text-white min-w-[180px]"
                          onClick={() => handleSort('name')}
                        >
                          Giocatore <SortIcon column="name" />
                        </th>
                        <th
                          scope="col"
                          aria-sort={sortBy === 'team' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                          className="px-3 py-3 text-left text-xs font-medium text-gray-400 cursor-pointer hover:text-white min-w-[120px]"
                          onClick={() => handleSort('team')}
                        >
                          Squadra <SortIcon column="team" />
                        </th>
                        <th
                          scope="col"
                          aria-sort={sortBy === 'position' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                          className="px-3 py-3 text-center text-xs font-medium text-gray-400 cursor-pointer hover:text-white w-16"
                          onClick={() => handleSort('position')}
                        >
                          Pos <SortIcon column="position" />
                        </th>
                        <th
                          scope="col"
                          aria-sort={sortBy === 'quotation' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                          className="px-3 py-3 text-center text-xs font-medium text-gray-400 cursor-pointer hover:text-white w-16"
                          onClick={() => handleSort('quotation')}
                        >
                          Quot <SortIcon column="quotation" />
                        </th>
                        {/* Dynamic stat columns */}
                        {visibleColumnDefs.map(col => (
                          <th
                            key={col.key}
                            scope="col"
                            aria-sort={col.sortable && sortBy === col.key ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                            className="px-2 py-3 text-center text-xs font-medium text-gray-400 cursor-pointer hover:text-white whitespace-nowrap"
                            onClick={() => col.sortable && handleSort(col.key)}
                            title={col.label}
                          >
                            {col.shortLabel} {col.sortable && <SortIcon column={col.key} />}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-50/10">
                      {sortedPlayers.map((player) => {
                        const quotStyle = getQuotationStyle(player.quotation)
                        const playerPhotoUrl = getPlayerPhotoUrl(player.apiFootballId)
                        const teamLogoUrl = getTeamLogoUrl(player.team)

                        return (
                          <tr
                            key={player.id}
                            className={`hover:bg-surface-300/50 transition-colors ${
                              selectedForCompare.has(player.id) ? 'bg-primary-500/10' : ''
                            }`}
                          >
                            <td className="px-3 py-3">
                              <input
                                type="checkbox"
                                className="rounded"
                                checked={selectedForCompare.has(player.id)}
                                onChange={() => togglePlayerForCompare(player.id)}
                              />
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-3">
                                {/* Player photo */}
                                <div className="relative">
                                  {playerPhotoUrl ? (
                                    <img
                                      src={playerPhotoUrl}
                                      alt={player.name}
                                      className="w-10 h-10 rounded-full object-cover bg-surface-300 border-2 border-surface-50/20"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none'
                                      }}
                                    />
                                  ) : (
                                    <div className="w-10 h-10 rounded-full bg-surface-300 flex items-center justify-center text-gray-500">
                                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                      </svg>
                                    </div>
                                  )}
                                  {/* Position badge */}
                                  <span
                                    className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-br ${POSITION_COLORS[player.position]} flex items-center justify-center text-white font-bold text-[10px] border border-surface-200`}
                                  >
                                    {player.position}
                                  </span>
                                </div>
                                <span className="font-medium text-white">{player.name}</span>
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-2">
                                {teamLogoUrl && (
                                  <img
                                    src={teamLogoUrl}
                                    alt={player.team}
                                    className="w-6 h-6 object-contain"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = 'none'
                                    }}
                                  />
                                )}
                                <span className="text-gray-300">{player.team}</span>
                              </div>
                            </td>
                            <td className="px-3 py-3 text-center text-gray-400 text-sm">
                              {POSITION_LABELS[player.position]}
                            </td>
                            <td className="px-3 py-3 text-center">
                              <span
                                className={`inline-flex items-center justify-center min-w-[2.5rem] px-2 py-1 rounded-lg bg-gradient-to-r ${quotStyle.bg} ${quotStyle.text} font-bold text-sm shadow-lg ${quotStyle.glow}`}
                              >
                                {player.quotation}
                              </span>
                            </td>
                            {/* Dynamic stat columns */}
                            {visibleColumnDefs.map(col => {
                              const rawValue = col.getValue(player)
                              const displayValue = col.format
                                ? col.format(typeof rawValue === 'number' ? rawValue : null)
                                : rawValue ?? '-'

                              // Special formatting for rating
                              if (col.key === 'rating' && typeof rawValue === 'number') {
                                return (
                                  <td key={col.key} className="px-2 py-3 text-center">
                                    <span
                                      className={`inline-flex items-center justify-center px-2 py-0.5 rounded font-medium text-sm ${
                                        rawValue >= 7
                                          ? 'bg-secondary-500/20 text-secondary-400'
                                          : rawValue >= 6
                                          ? 'bg-gray-500/20 text-white'
                                          : 'bg-warning-500/20 text-warning-400'
                                      }`}
                                    >
                                      {rawValue.toFixed(2)}
                                    </span>
                                  </td>
                                )
                              }

                              // Special formatting for G+A
                              if (col.key === 'ga' && typeof rawValue === 'number') {
                                return (
                                  <td key={col.key} className="px-2 py-3 text-center">
                                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded bg-white/10 font-bold text-white text-sm">
                                      {rawValue}
                                    </span>
                                  </td>
                                )
                              }

                              return (
                                <td
                                  key={col.key}
                                  className={`px-2 py-3 text-center text-sm ${col.colorClass || 'text-gray-300'}`}
                                >
                                  {displayValue}
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-surface-50/10">
                    <p className="text-sm text-gray-400">
                      Pagina {page} di {totalPages} ({total} giocatori)
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        Precedente
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                      >
                        Successiva
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>

          {/* Compare Modal */}
          {showCompareModal && playersToCompare.length >= 2 && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
              <div className="bg-surface-200 rounded-xl border border-surface-50/20 max-w-4xl w-full max-h-[90vh] overflow-hidden">
                {/* Modal Header */}
                <div className="p-6 border-b border-surface-50/20 bg-gradient-to-r from-primary-500/10 to-surface-200">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-white">Confronto Giocatori</h2>
                    <button
                      onClick={() => setShowCompareModal(false)}
                      className="w-10 h-10 rounded-lg bg-surface-300 hover:bg-surface-50/20 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Modal Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                  {/* Player Cards Header */}
                  <div className="flex justify-center gap-6 mb-8">
                    {playersToCompare.map((player, idx) => {
                      const playerPhotoUrl = getPlayerPhotoUrl(player.apiFootballId)
                      const teamLogoUrl = getTeamLogoUrl(player.team)

                      return (
                        <div key={player.id} className="flex flex-col items-center gap-2">
                          <div
                            className="w-4 h-4 rounded-full mb-1"
                            style={{ backgroundColor: PLAYER_CHART_COLORS[idx % PLAYER_CHART_COLORS.length] }}
                          />
                          <div className="relative">
                            {playerPhotoUrl ? (
                              <img
                                src={playerPhotoUrl}
                                alt={player.name}
                                className="w-16 h-16 rounded-full object-cover bg-surface-300 border-3 border-surface-50/20"
                                style={{ borderColor: PLAYER_CHART_COLORS[idx % PLAYER_CHART_COLORS.length] }}
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none'
                                }}
                              />
                            ) : (
                              <div
                                className={`w-16 h-16 rounded-full bg-gradient-to-br ${POSITION_COLORS[player.position]} flex items-center justify-center text-white font-bold text-xl`}
                              >
                                {player.position}
                              </div>
                            )}
                            <span
                              className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-br ${POSITION_COLORS[player.position]} flex items-center justify-center text-white font-bold text-xs border-2 border-surface-200`}
                            >
                              {player.position}
                            </span>
                          </div>
                          <span className="font-medium text-white">{player.name}</span>
                          <div className="flex items-center gap-1">
                            {teamLogoUrl && (
                              <img
                                src={teamLogoUrl}
                                alt={player.team}
                                className="w-5 h-5 object-contain"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none'
                                }}
                              />
                            )}
                            <span className="text-sm text-gray-400">{player.team}</span>
                          </div>
                          <span className="text-lg font-bold text-primary-400">Quot. {player.quotation}</span>
                        </div>
                      )
                    })}
                  </div>

                  {/* Radar Charts */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    {/* Offensive Stats Radar */}
                    <div className="bg-surface-300/50 rounded-xl p-4">
                      <h3 className="text-center text-white font-semibold mb-4">Statistiche Offensive</h3>
                      <RadarChart
                        size={280}
                        players={playersToCompare.map((p, i) => ({
                          name: p.name,
                          color: PLAYER_CHART_COLORS[i % PLAYER_CHART_COLORS.length]
                        }))}
                        data={[
                          { label: 'Gol', values: playersToCompare.map(p => p.stats?.goals ?? 0) },
                          { label: 'Assist', values: playersToCompare.map(p => p.stats?.assists ?? 0) },
                          { label: 'Tiri', values: playersToCompare.map(p => p.stats?.shotsTotal ?? 0) },
                          { label: 'Tiri Porta', values: playersToCompare.map(p => p.stats?.shotsOn ?? 0) },
                          { label: 'Dribbling', values: playersToCompare.map(p => p.stats?.dribblesSuccess ?? 0) },
                          { label: 'Pass Chiave', values: playersToCompare.map(p => p.stats?.passesKey ?? 0) },
                        ]}
                      />
                    </div>

                    {/* Defensive/General Stats Radar */}
                    <div className="bg-surface-300/50 rounded-xl p-4">
                      <h3 className="text-center text-white font-semibold mb-4">Statistiche Difensive</h3>
                      <RadarChart
                        size={280}
                        players={playersToCompare.map((p, i) => ({
                          name: p.name,
                          color: PLAYER_CHART_COLORS[i % PLAYER_CHART_COLORS.length]
                        }))}
                        data={[
                          { label: 'Contrasti', values: playersToCompare.map(p => p.stats?.tacklesTotal ?? 0) },
                          { label: 'Intercetti', values: playersToCompare.map(p => p.stats?.interceptions ?? 0) },
                          { label: 'Passaggi', values: playersToCompare.map(p => Math.round((p.stats?.passesTotal ?? 0) / 10)) },
                          { label: 'Presenze', values: playersToCompare.map(p => p.stats?.appearances ?? 0) },
                          { label: 'Rating', values: playersToCompare.map(p => Math.round((p.stats?.rating ?? 0) * 10)) },
                          { label: 'Minuti', values: playersToCompare.map(p => Math.round((p.stats?.minutes ?? 0) / 100)) },
                        ]}
                      />
                    </div>
                  </div>

                  {/* Detailed Stats Table */}
                  <div className="bg-surface-300/30 rounded-xl overflow-hidden">
                    <h3 className="text-white font-semibold p-4 border-b border-surface-50/10">Dettaglio Statistiche</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-surface-300/50">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Statistica</th>
                            {playersToCompare.map((player, idx) => (
                              <th key={player.id} className="px-4 py-3 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: PLAYER_CHART_COLORS[idx % PLAYER_CHART_COLORS.length] }}
                                  />
                                  <span className="text-sm font-medium text-white">{player.name}</span>
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-50/10">
                          {[
                            { key: 'quotation', label: 'Quotazione', format: (v: number) => v },
                            ...STAT_COLUMNS.map(col => ({
                              key: col.key,
                              label: col.label,
                              stat: true,
                              format: col.format,
                              getValue: col.getValue,
                            }))
                          ].map((row) => {
                            const values = playersToCompare.map((p) => {
                              if ('getValue' in row && row.getValue) {
                                const val = row.getValue(p)
                                return typeof val === 'number' ? val : 0
                              }
                              if (row.key === 'quotation') return p.quotation
                              return 0
                            })
                            const maxVal = Math.max(...values.filter((v): v is number => v !== null && v > 0))

                            return (
                              <tr key={row.key} className="hover:bg-surface-300/30">
                                <td className="px-4 py-3 text-sm text-gray-300">{row.label}</td>
                                {playersToCompare.map((player, idx) => {
                                  const val = values[idx]
                                  const isMax = val === maxVal && maxVal > 0
                                  const formatted = row.format ? row.format(val) : val

                                  return (
                                    <td
                                      key={player.id}
                                      className={`px-4 py-3 text-center font-medium ${
                                        isMax ? 'text-secondary-400' : 'text-white'
                                      }`}
                                    >
                                      {isMax && maxVal > 0 && (
                                        <span className="inline-block w-2 h-2 rounded-full bg-secondary-400 mr-2" />
                                      )}
                                      {formatted}
                                    </td>
                                  )
                                })}
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
// Force redeploy 1769716853
