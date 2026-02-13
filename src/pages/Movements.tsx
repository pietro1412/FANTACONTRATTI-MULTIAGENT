import { useState, useEffect, useMemo } from 'react'
import { movementApi, leagueApi } from '../services/api'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { Navigation } from '../components/Navigation'
import { PullToRefresh } from '../components/PullToRefresh'
import { BottomSheet } from '../components/ui/BottomSheet'
import { getTeamLogo } from '../utils/teamLogos'
import { ChevronDown, SlidersHorizontal } from 'lucide-react'
import { SkeletonPlayerRow } from '../components/ui/Skeleton'
import { MOVEMENT_TYPE_LABELS, MOVEMENT_TYPE_SHORT, MOVEMENT_TYPE_COLORS } from '../utils/movement-constants'

interface MovementsProps {
  leagueId: string
  onNavigate: (page: string, params?: Record<string, string>) => void
}

interface Player {
  id: string
  name: string
  team: string
  position: string
}

interface MemberInfo {
  memberId: string
  username: string
  teamName: string | null
}

interface ContractInfo {
  salary: number
  duration: number
  clause: number | null
}

interface Prophecy {
  id: string
  content: string
  authorRole: 'BUYER' | 'SELLER'
  author: MemberInfo
  createdAt: string
}

interface Movement {
  id: string
  type: string
  player: Player
  from: MemberInfo | null
  to: MemberInfo | null
  price: number | null
  oldContract: ContractInfo | null
  newContract: ContractInfo | null
  prophecies: Prophecy[]
  createdAt: string
  // Aggiunti per stagione/semestre
  season?: number
  semester?: number
}

const POSITION_COLORS: Record<string, string> = {
  P: 'text-amber-400',
  D: 'text-blue-400',
  C: 'text-emerald-400',
  A: 'text-red-400',
}

// Formatta stagione (es. 25/26)
function formatSeason(season?: number): string {
  if (!season) return '25/26' // Default stagione corrente
  const nextYear = (season % 100) + 1
  return `${season % 100}/${nextYear.toString().padStart(2, '0')}`
}

export function Movements({ leagueId, onNavigate }: MovementsProps) {
  const [movements, setMovements] = useState<Movement[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterType, setFilterType] = useState<string>('')
  const [filterSemester, setFilterSemester] = useState<string>('')
  const [filterDateFrom, setFilterDateFrom] = useState<string>('')
  const [filterDateTo, setFilterDateTo] = useState<string>('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [isLeagueAdmin, setIsLeagueAdmin] = useState(false)

  // Prophecy
  const [expandedMovement, setExpandedMovement] = useState<string | null>(null)
  const [prophecyContent, setProphecyContent] = useState('')
  const [canMakeProphecy, setCanMakeProphecy] = useState<Record<string, { can: boolean; role?: string }>>({})
  const [isSubmittingProphecy, setIsSubmittingProphecy] = useState(false)

  useEffect(() => {
    loadLeagueInfo()
  }, [leagueId])

  useEffect(() => {
    loadMovements()
  }, [leagueId, filterType, filterSemester])

  async function loadLeagueInfo() {
    const result = await leagueApi.getById(leagueId)
    if (result.success && result.data) {
      const data = result.data as { isAdmin: boolean }
      setIsLeagueAdmin(data.isAdmin)
    }
  }

  async function loadMovements() {
    setIsLoading(true)
    setError('')

    const options: { movementType?: string; semester?: number } = {}
    if (filterType) options.movementType = filterType
    if (filterSemester) options.semester = parseInt(filterSemester)

    const result = await movementApi.getLeagueMovements(leagueId, options)

    if (result.success && result.data) {
      const movementList = result.data as Movement[]
      movementList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      setMovements(movementList)

      // Check prophecy eligibility
      const eligibility: Record<string, { can: boolean; role?: string }> = {}
      for (const movement of movementList) {
        const canRes = await movementApi.canMakeProphecy(movement.id)
        if (canRes.success && canRes.data) {
          const data = canRes.data as { canMakeProphecy: boolean; role?: string }
          eligibility[movement.id] = { can: data.canMakeProphecy, role: data.role }
        }
      }
      setCanMakeProphecy(eligibility)
    } else {
      setError(result.message || 'Errore nel caricamento')
    }

    setIsLoading(false)
  }

  async function handleAddProphecy(movementId: string) {
    if (!prophecyContent.trim()) return

    setIsSubmittingProphecy(true)
    const result = await movementApi.addProphecy(movementId, prophecyContent)

    if (result.success) {
      setProphecyContent('')
      setExpandedMovement(null)
      loadMovements()
    } else {
      setError(result.message || 'Errore nell\'aggiunta della profezia')
    }

    setIsSubmittingProphecy(false)
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    })
  }

  function formatTime(dateString: string): string {
    return new Date(dateString).toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Client-side date range filtering
  const filteredMovements = useMemo(() => {
    if (!filterDateFrom && !filterDateTo) return movements
    return movements.filter(m => {
      const date = new Date(m.createdAt)
      if (filterDateFrom && date < new Date(filterDateFrom)) return false
      if (filterDateTo) {
        const endOfDay = new Date(filterDateTo)
        endOfDay.setHours(23, 59, 59, 999)
        if (date > endOfDay) return false
      }
      return true
    })
  }, [movements, filterDateFrom, filterDateTo])

  const activeFilterCount = [filterType, filterSemester, filterDateFrom, filterDateTo].filter(Boolean).length

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Navigation currentPage="movements" leagueId={leagueId} isLeagueAdmin={isLeagueAdmin} onNavigate={onNavigate} />
        <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-4 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonPlayerRow key={i} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <Navigation currentPage="movements" leagueId={leagueId} isLeagueAdmin={isLeagueAdmin} onNavigate={onNavigate} />

      <PullToRefresh onRefresh={loadMovements}>
      {/* Header compatto */}
      <div className="bg-surface-200 border-b border-surface-50/20">
        <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-shrink-0">
                <span className="text-xl">📜</span>
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-white">Storico Movimenti</h1>
                <p className="text-xs text-gray-500">Stagione {formatSeason(2025)} · {filteredMovements.length} mov.{filteredMovements.length !== movements.length ? ` (${movements.length} tot.)` : ''}</p>
              </div>
            </div>

            {/* Filtri — Mobile: button, Desktop: inline */}
            <div className="flex items-center gap-2">
              {/* Mobile: Filtri button */}
              <button
                onClick={() => setFiltersOpen(true)}
                className="md:hidden flex items-center gap-1.5 px-3 py-1.5 bg-surface-300 border border-surface-50/30 rounded-lg text-xs text-gray-300 hover:text-white transition-colors"
              >
                <SlidersHorizontal size={14} />
                Filtri{activeFilterCount > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.5 text-[10px] font-bold bg-primary-500/30 text-primary-400 rounded-full">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {/* Desktop: inline selects */}
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="hidden md:block bg-surface-300 border border-surface-50/30 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none"
              >
                <option value="">Tutti i tipi</option>
                <option value="FIRST_MARKET">Primo Mercato</option>
                <option value="TRADE">Scambi</option>
                <option value="RUBATA">Rubate</option>
                <option value="SVINCOLATI">Svincolati</option>
                <option value="RELEASE">Tagli</option>
                <option value="CONTRACT_RENEW">Rinnovi</option>
              </select>
              <select
                value={filterSemester}
                onChange={(e) => setFilterSemester(e.target.value)}
                className="hidden md:block bg-surface-300 border border-surface-50/30 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none"
              >
                <option value="">Tutti</option>
                <option value="1">1° Sem</option>
                <option value="2">2° Sem</option>
              </select>
              <div className="hidden md:flex items-center gap-1.5">
                <span className="text-xs text-gray-500">Dal</span>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="bg-surface-300 border border-surface-50/30 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none [color-scheme:dark]"
                />
                <span className="text-xs text-gray-500">al</span>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="bg-surface-300 border border-surface-50/30 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none [color-scheme:dark]"
                />
                {(filterDateFrom || filterDateTo) && (
                  <button
                    onClick={() => { setFilterDateFrom(''); setFilterDateTo('') }}
                    className="text-xs text-gray-500 hover:text-white px-1"
                    title="Reset date"
                    aria-label="Ripristina filtro date"
                  >
                    x
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Filters BottomSheet */}
      <BottomSheet isOpen={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filtri Movimenti">
        <div className="p-4 space-y-5">
          <div>
            <label className="block text-xs text-gray-400 mb-2 uppercase tracking-wider">Tipo Movimento</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-3 py-2.5 bg-surface-300 border border-surface-50/30 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Tutti i tipi</option>
              <option value="FIRST_MARKET">Primo Mercato</option>
              <option value="TRADE">Scambi</option>
              <option value="RUBATA">Rubate</option>
              <option value="SVINCOLATI">Svincolati</option>
              <option value="RELEASE">Tagli</option>
              <option value="CONTRACT_RENEW">Rinnovi</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-2 uppercase tracking-wider">Semestre</label>
            <select
              value={filterSemester}
              onChange={(e) => setFilterSemester(e.target.value)}
              className="w-full px-3 py-2.5 bg-surface-300 border border-surface-50/30 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Tutti i semestri</option>
              <option value="1">1° Semestre</option>
              <option value="2">2° Semestre</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-2 uppercase tracking-wider">Periodo</label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-xs text-gray-500 mb-1 block">Dal</span>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="w-full px-3 py-2.5 bg-surface-300 border border-surface-50/30 rounded-lg text-white text-sm [color-scheme:dark]"
                />
              </div>
              <div>
                <span className="text-xs text-gray-500 mb-1 block">Al</span>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="w-full px-3 py-2.5 bg-surface-300 border border-surface-50/30 rounded-lg text-white text-sm [color-scheme:dark]"
                />
              </div>
            </div>
          </div>

          <button
            onClick={() => setFiltersOpen(false)}
            className="w-full py-3 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-xl transition-colors"
          >
            Applica Filtri
          </button>
        </div>
      </BottomSheet>

      <main className="max-w-[1600px] mx-auto px-4 md:px-6 py-4">
        {error && (
          <div className="bg-danger-500/20 border border-danger-500/50 text-danger-400 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        {movements.length === 0 ? (
          <EmptyState icon="📭" title="Nessun movimento registrato" description="I movimenti appariranno qui dopo aste, scambi e altre operazioni." />
        ) : (
          <>
            {/* ====== MOBILE CARD VIEW (<md) ====== */}
            <div className="md:hidden space-y-2">
              {filteredMovements.map((movement) => {
                const typeColor = MOVEMENT_TYPE_COLORS[movement.type] || 'bg-gray-500/20 text-gray-400'
                const posColor = POSITION_COLORS[movement.player.position] || 'text-gray-400'
                const hasProphecies = movement.prophecies.length > 0
                const canAdd = canMakeProphecy[movement.id]?.can
                const isExpanded = expandedMovement === movement.id

                return (
                  <div key={movement.id} className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
                    {/* Card Header — always visible */}
                    <div
                      className={`px-4 py-3 cursor-pointer ${isExpanded ? 'bg-surface-300/30' : ''}`}
                      onClick={() => setExpandedMovement(isExpanded ? null : movement.id)}
                    >
                      <div className="flex items-center gap-3">
                        {/* Type badge */}
                        <span className={`px-2 py-1 rounded text-xs font-bold flex-shrink-0 ${typeColor}`}>
                          {MOVEMENT_TYPE_SHORT[movement.type] || movement.type.slice(0, 2)}
                        </span>

                        {/* Player info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 bg-white rounded flex items-center justify-center p-0.5 flex-shrink-0">
                              <img
                                src={getTeamLogo(movement.player.team)}
                                alt=""
                                className="w-4 h-4 object-contain"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                              />
                            </div>
                            <span className={`font-bold text-xs ${posColor}`}>{movement.player.position}</span>
                            <span className="text-white font-medium text-sm truncate">{movement.player.name}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                            <span>{formatDate(movement.createdAt)}</span>
                            <span>•</span>
                            <span>{movement.from?.username || '—'} → {movement.to?.username || '—'}</span>
                          </div>
                        </div>

                        {/* Price + expand indicator */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {movement.price ? (
                            <span className="text-accent-400 font-bold text-sm">{movement.price}cr</span>
                          ) : (
                            <span className="text-gray-600 text-sm">—</span>
                          )}
                          <ChevronDown size={16} className={`text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </div>
                      </div>
                    </div>

                    {/* Card Expanded Details */}
                    {isExpanded && (
                      <div className="px-4 py-3 border-t border-surface-50/10 space-y-3">
                        {/* Detail rows */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-gray-500">Tipo</span>
                            <p className="text-gray-300 font-medium">{MOVEMENT_TYPE_LABELS[movement.type]}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Stagione</span>
                            <p className="text-gray-300">{formatSeason(movement.season || 2025)} · {movement.semester || 1}° sem</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Squadra reale</span>
                            <p className="text-gray-300">{movement.player.team}</p>
                          </div>
                          {movement.newContract && (
                            <div>
                              <span className="text-gray-500">Contratto</span>
                              <p className="text-gray-300">{movement.newContract.salary}M × {movement.newContract.duration}sem</p>
                            </div>
                          )}
                        </div>

                        {/* Prophecies */}
                        {hasProphecies && (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-accent-400 uppercase">Profezie</p>
                            {movement.prophecies.map((p) => (
                              <div key={p.id} className="bg-accent-500/10 border border-accent-500/20 rounded-lg p-2">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-semibold text-white">{p.author.username}</span>
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${p.authorRole === 'BUYER' ? 'bg-secondary-500/20 text-secondary-400' : 'bg-red-500/20 text-red-400'}`}>
                                    {p.authorRole === 'BUYER' ? 'Acq.' : 'Ven.'}
                                  </span>
                                </div>
                                <p className="text-gray-300 text-sm italic">"{p.content}"</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Add Prophecy */}
                        {canAdd && (
                          <div>
                            <textarea
                              value={prophecyContent}
                              onChange={(e) => setProphecyContent(e.target.value)}
                              placeholder="Scrivi una profezia..."
                              className="w-full bg-surface-300 border border-surface-50/30 rounded-lg p-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-500/50"
                              rows={2}
                              maxLength={500}
                            />
                            <div className="flex justify-between items-center mt-2">
                              <span className="text-xs text-gray-500">
                                {canMakeProphecy[movement.id]?.role === 'BUYER' ? 'Acquirente' : 'Venditore'} • {prophecyContent.length}/500
                              </span>
                              <Button
                                size="sm"
                                variant="accent"
                                onClick={() => handleAddProphecy(movement.id)}
                                disabled={!prophecyContent.trim() || isSubmittingProphecy}
                              >
                                {isSubmittingProphecy ? '...' : 'Pubblica'}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* ====== DESKTOP TABLE (md+) ====== */}
            <div className="hidden md:block bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
              {/* Table Header */}
              <div role="row" className="grid grid-cols-12 gap-2 px-4 py-2 bg-surface-300 border-b border-surface-50/20 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                <div role="columnheader" className="col-span-1">Tipo</div>
                <div role="columnheader" className="col-span-1">Stag.</div>
                <div role="columnheader" className="col-span-1">Sem.</div>
                <div role="columnheader" className="col-span-3">Giocatore</div>
                <div role="columnheader" className="col-span-2">Da &rarr; A</div>
                <div role="columnheader" className="col-span-1 text-right">Prezzo</div>
                <div role="columnheader" className="col-span-2">Contratto</div>
                <div role="columnheader" className="col-span-1 text-right">Data</div>
              </div>

              {/* Table Rows */}
              <div className="divide-y divide-surface-50/10">
                {filteredMovements.map((movement) => {
                  const typeColor = MOVEMENT_TYPE_COLORS[movement.type] || 'bg-gray-500/20 text-gray-400'
                  const posColor = POSITION_COLORS[movement.player.position] || 'text-gray-400'
                  const hasProphecies = movement.prophecies.length > 0
                  const canAdd = canMakeProphecy[movement.id]?.can
                  const isExpanded = expandedMovement === movement.id

                  return (
                    <div key={movement.id}>
                      {/* Main Row */}
                      <div
                        className={`grid grid-cols-12 gap-2 px-4 py-2.5 items-center text-sm hover:bg-surface-300/30 transition-colors cursor-pointer ${isExpanded ? 'bg-surface-300/50' : ''}`}
                        onClick={() => setExpandedMovement(isExpanded ? null : movement.id)}
                      >
                        {/* Tipo */}
                        <div className="col-span-1">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${typeColor}`}>
                            {MOVEMENT_TYPE_SHORT[movement.type] || movement.type.slice(0, 2)}
                          </span>
                        </div>

                        {/* Stagione */}
                        <div className="col-span-1 text-xs text-gray-500">
                          {formatSeason(movement.season || 2025)}
                        </div>

                        {/* Semestre */}
                        <div className="col-span-1 text-xs text-gray-500">
                          {movement.semester || 1}°
                        </div>

                        {/* Giocatore */}
                        <div className="col-span-3 flex items-center gap-2">
                          <div className="w-6 h-6 bg-white rounded flex items-center justify-center p-0.5 flex-shrink-0">
                            <img
                              src={getTeamLogo(movement.player.team)}
                              alt=""
                              className="w-5 h-5 object-contain"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                            />
                          </div>
                          <span className={`font-bold text-xs ${posColor}`}>{movement.player.position}</span>
                          <span className="text-white font-medium truncate">{movement.player.name}</span>
                        </div>

                        {/* Da → A */}
                        <div className="col-span-2 text-xs">
                          <span className="text-gray-500">{movement.from?.username || '—'}</span>
                          <span className="text-gray-600 mx-1">→</span>
                          <span className="text-white">{movement.to?.username || '—'}</span>
                        </div>

                        {/* Prezzo */}
                        <div className="col-span-1 text-right">
                          {movement.price ? (
                            <span className="text-accent-400 font-semibold">{movement.price}</span>
                          ) : (
                            <span className="text-gray-600">—</span>
                          )}
                        </div>

                        {/* Contratto */}
                        <div className="col-span-2 text-xs">
                          {movement.newContract ? (
                            <span className="text-gray-300">
                              {movement.newContract.salary}M × {movement.newContract.duration}sem
                            </span>
                          ) : (
                            <span className="text-gray-600">—</span>
                          )}
                        </div>

                        {/* Data */}
                        <div className="col-span-1 text-right text-xs text-gray-500">
                          <div>{formatDate(movement.createdAt)}</div>
                          <div className="text-gray-600">{formatTime(movement.createdAt)}</div>
                        </div>
                      </div>

                      {/* Expanded Section - Prophecies */}
                      {isExpanded && (
                        <div className="px-4 py-3 bg-surface-300/30 border-t border-surface-50/10">
                          <div className="flex items-start gap-4">
                            {/* Details */}
                            <div className="flex-1">
                              <div className="text-xs text-gray-400 mb-2">
                                <span className="font-semibold">{MOVEMENT_TYPE_LABELS[movement.type]}</span>
                                {' • '}
                                {movement.player.team}
                              </div>

                              {/* Prophecies */}
                              {hasProphecies && (
                                <div className="space-y-2 mb-3">
                                  <p className="text-xs font-semibold text-accent-400 uppercase">Profezie</p>
                                  {movement.prophecies.map((p) => (
                                    <div key={p.id} className="bg-accent-500/10 border border-accent-500/20 rounded-lg p-2">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-semibold text-white">{p.author.username}</span>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${p.authorRole === 'BUYER' ? 'bg-secondary-500/20 text-secondary-400' : 'bg-red-500/20 text-red-400'}`}>
                                          {p.authorRole === 'BUYER' ? 'Acq.' : 'Ven.'}
                                        </span>
                                      </div>
                                      <p className="text-gray-300 text-sm italic">"{p.content}"</p>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Add Prophecy */}
                              {canAdd && (
                                <div className="mt-2">
                                  <textarea
                                    value={prophecyContent}
                                    onChange={(e) => setProphecyContent(e.target.value)}
                                    placeholder="Scrivi una profezia..."
                                    className="w-full bg-surface-300 border border-surface-50/30 rounded-lg p-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-500/50"
                                    rows={2}
                                    maxLength={500}
                                  />
                                  <div className="flex justify-between items-center mt-2">
                                    <span className="text-xs text-gray-500">
                                      {canMakeProphecy[movement.id]?.role === 'BUYER' ? 'Acquirente' : 'Venditore'} • {prophecyContent.length}/500
                                    </span>
                                    <Button
                                      size="sm"
                                      variant="accent"
                                      onClick={() => handleAddProphecy(movement.id)}
                                      disabled={!prophecyContent.trim() || isSubmittingProphecy}
                                    >
                                      {isSubmittingProphecy ? '...' : 'Pubblica'}
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-3 text-xs">
          {Object.entries(MOVEMENT_TYPE_LABELS).map(([key, label]) => (
            <div key={key} className="flex items-center gap-1.5">
              <span className={`px-1.5 py-0.5 rounded font-bold ${MOVEMENT_TYPE_COLORS[key]}`}>
                {MOVEMENT_TYPE_SHORT[key]}
              </span>
              <span className="text-gray-500">{label}</span>
            </div>
          ))}
        </div>
      </main>
      </PullToRefresh>
    </div>
  )
}
