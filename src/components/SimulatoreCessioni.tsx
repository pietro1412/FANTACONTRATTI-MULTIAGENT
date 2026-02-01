import { useState, useMemo } from 'react'
import { simulatoreApi, type CessioneAnalysis, type SostitutoSuggestion } from '../services/api'
import { getTeamLogo } from '../utils/teamLogos'
import { POSITION_COLORS, POSITIONS } from './ui/PositionBadge'

type Position = typeof POSITIONS[number]

interface SimulatoreCessioniProps {
  leagueId: string
  cessioni: CessioneAnalysis[]
  onCessioneSelect?: (cessione: CessioneAnalysis) => void
}

type SortField = 'name' | 'position' | 'salary' | 'rescissionCost' | 'budgetImpact'
type SortDirection = 'asc' | 'desc'

export function SimulatoreCessioni({ leagueId, cessioni, onCessioneSelect }: SimulatoreCessioniProps) {
  const [positionFilter, setPositionFilter] = useState<string>('ALL')
  const [sortField, setSortField] = useState<SortField>('budgetImpact')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null)
  const [sostituti, setSostituti] = useState<SostitutoSuggestion[]>([])
  const [loadingSostituti, setLoadingSostituti] = useState(false)

  // Filter and sort cessioni
  const filteredCessioni = useMemo(() => {
    let result = [...cessioni]

    // Apply position filter
    if (positionFilter !== 'ALL') {
      result = result.filter(c => c.player.position === positionFilter)
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0
      switch (sortField) {
        case 'name':
          comparison = a.player.name.localeCompare(b.player.name)
          break
        case 'position':
          comparison = a.player.position.localeCompare(b.player.position)
          break
        case 'salary':
          comparison = a.currentSalary - b.currentSalary
          break
        case 'rescissionCost':
          comparison = a.rescissionCost - b.rescissionCost
          break
        case 'budgetImpact':
          // Budget impact = freed - cost
          const impactA = a.budgetFreed - a.rescissionCost
          const impactB = b.budgetFreed - b.rescissionCost
          comparison = impactA - impactB
          break
      }
      return sortDirection === 'asc' ? comparison : -comparison
    })

    return result
  }, [cessioni, positionFilter, sortField, sortDirection])

  // Handle row expansion to show sostituti
  const handleExpand = async (cessione: CessioneAnalysis) => {
    if (expandedPlayerId === cessione.player.id) {
      setExpandedPlayerId(null)
      setSostituti([])
      return
    }

    setExpandedPlayerId(cessione.player.id)
    setLoadingSostituti(true)
    setSostituti([])

    try {
      const response = await simulatoreApi.getSostituti(leagueId, cessione.player.id, 8)
      if (response.success && response.data) {
        setSostituti(response.data)
      }
    } catch (error) {
      console.error('Error loading sostituti:', error)
    } finally {
      setLoadingSostituti(false)
    }
  }

  // Handle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => (
    sortField === field ? (
      <span className="ml-1 text-primary-400">
        {sortDirection === 'asc' ? '\u2191' : '\u2193'}
      </span>
    ) : (
      <span className="ml-1 text-dark-100 opacity-30">\u2195</span>
    )
  )

  if (cessioni.length === 0) {
    return (
      <div className="text-center py-12 text-dark-100">
        <p className="text-lg">Nessun giocatore con contratto nella rosa.</p>
        <p className="text-sm mt-2">Acquista giocatori e definisci i loro contratti per simulare cessioni.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-dark-100">Ruolo:</label>
          <select
            value={positionFilter}
            onChange={(e) => setPositionFilter(e.target.value)}
            className="bg-dark-200 border border-dark-100 rounded px-3 py-1.5 text-sm text-white"
          >
            <option value="ALL">Tutti</option>
            <option value="P">Portieri</option>
            <option value="D">Difensori</option>
            <option value="C">Centrocampisti</option>
            <option value="A">Attaccanti</option>
          </select>
        </div>
        <div className="text-sm text-dark-100">
          {filteredCessioni.length} giocator{filteredCessioni.length === 1 ? 'e' : 'i'}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-dark-100 text-left text-dark-100">
              <th className="pb-3 font-medium">
                <button onClick={() => handleSort('position')} className="flex items-center hover:text-white">
                  Ruolo <SortIcon field="position" />
                </button>
              </th>
              <th className="pb-3 font-medium">
                <button onClick={() => handleSort('name')} className="flex items-center hover:text-white">
                  Giocatore <SortIcon field="name" />
                </button>
              </th>
              <th className="pb-3 font-medium text-right">
                <button onClick={() => handleSort('salary')} className="flex items-center justify-end hover:text-white ml-auto">
                  Ingaggio <SortIcon field="salary" />
                </button>
              </th>
              <th className="pb-3 font-medium text-right">Durata</th>
              <th className="pb-3 font-medium text-right">
                <button onClick={() => handleSort('rescissionCost')} className="flex items-center justify-end hover:text-white ml-auto">
                  Costo Taglio <SortIcon field="rescissionCost" />
                </button>
              </th>
              <th className="pb-3 font-medium text-right">
                <button onClick={() => handleSort('budgetImpact')} className="flex items-center justify-end hover:text-white ml-auto">
                  Impatto Budget <SortIcon field="budgetImpact" />
                </button>
              </th>
              <th className="pb-3 font-medium text-right">Nuovo Budget</th>
              <th className="pb-3"></th>
            </tr>
          </thead>
          <tbody>
            {filteredCessioni.map((cessione) => {
              const budgetImpact = cessione.budgetFreed - cessione.rescissionCost
              const isExpanded = expandedPlayerId === cessione.player.id
              const posColor = POSITION_COLORS[cessione.player.position as Position] || POSITION_COLORS.D

              return (
                <>
                  <tr
                    key={cessione.player.id}
                    className={`border-b border-dark-100/50 hover:bg-dark-200/50 cursor-pointer ${isExpanded ? 'bg-dark-200/30' : ''}`}
                    onClick={() => handleExpand(cessione)}
                  >
                    <td className="py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium`}
                        style={{ backgroundColor: posColor, color: 'white' }}
                      >
                        {cessione.player.position}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 flex-shrink-0">
                          <img
                            src={getTeamLogo(cessione.player.realTeam)}
                            alt={cessione.player.realTeam}
                            className="w-full h-full object-contain"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                          />
                        </div>
                        <span className="text-white font-medium">{cessione.player.name}</span>
                      </div>
                    </td>
                    <td className="py-3 text-right text-white">{cessione.currentSalary}</td>
                    <td className="py-3 text-right text-dark-100">{cessione.currentDuration} sem</td>
                    <td className="py-3 text-right text-red-400">-{cessione.rescissionCost}</td>
                    <td className="py-3 text-right">
                      <span className={budgetImpact >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {budgetImpact >= 0 ? '+' : ''}{budgetImpact}
                      </span>
                    </td>
                    <td className="py-3 text-right text-primary-400 font-medium">{cessione.newBudget}</td>
                    <td className="py-3 text-right">
                      <button
                        className="text-dark-100 hover:text-white transition-colors"
                        title={isExpanded ? 'Chiudi' : 'Vedi sostituti'}
                      >
                        {isExpanded ? '\u25B2' : '\u25BC'}
                      </button>
                    </td>
                  </tr>

                  {/* Expanded row with sostituti */}
                  {isExpanded && (
                    <tr key={`${cessione.player.id}-sostituti`}>
                      <td colSpan={8} className="bg-dark-200/50 p-4">
                        <div className="space-y-3">
                          <h4 className="text-sm font-medium text-primary-400">
                            Possibili sostituti per {cessione.player.name}
                          </h4>

                          {loadingSostituti ? (
                            <div className="flex items-center gap-2 text-dark-100">
                              <div className="w-4 h-4 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
                              Caricamento sostituti...
                            </div>
                          ) : sostituti.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                              {sostituti.map((sost) => (
                                <div
                                  key={sost.player.id}
                                  className={`p-3 rounded-lg border ${sost.isOwned ? 'bg-dark-300/50 border-orange-500/30' : 'bg-dark-300 border-dark-100/30'}`}
                                >
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className="w-5 h-5 flex-shrink-0">
                                      <img
                                        src={getTeamLogo(sost.player.realTeam)}
                                        alt={sost.player.realTeam}
                                        className="w-full h-full object-contain"
                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                                      />
                                    </div>
                                    <span className="text-white font-medium text-sm truncate">{sost.player.name}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-dark-100">Quot: {sost.quotation}</span>
                                    {sost.rating && (
                                      <span className="text-yellow-400">
                                        {'\u2605'} {sost.rating.toFixed(1)}
                                      </span>
                                    )}
                                  </div>
                                  {sost.isOwned && (
                                    <div className="mt-2 text-xs text-orange-400">
                                      {'\u26A0'} Di proprieta: {sost.ownerTeamName}
                                    </div>
                                  )}
                                  <div className="mt-2 flex items-center justify-between">
                                    <span className="text-xs text-dark-100">Match:</span>
                                    <div className="flex items-center gap-1">
                                      <div className="w-16 h-1.5 bg-dark-100 rounded-full overflow-hidden">
                                        <div
                                          className="h-full bg-primary-500 rounded-full"
                                          style={{ width: `${sost.matchScore}%` }}
                                        />
                                      </div>
                                      <span className="text-xs text-primary-400">{sost.matchScore}%</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-dark-100 text-sm">Nessun sostituto trovato per questo ruolo.</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="text-xs text-dark-100 space-y-1">
        <p><span className="text-green-400">Impatto positivo</span>: Il taglio libera piu budget del costo</p>
        <p><span className="text-red-400">Impatto negativo</span>: Il taglio costa piu del budget liberato</p>
        <p><span className="text-orange-400">{'\u26A0'} Di proprieta</span>: Giocatore gia acquistato da altro manager</p>
      </div>
    </div>
  )
}
