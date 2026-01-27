import { useState, useEffect, useCallback } from 'react'
import { Button } from './ui/Button'
import { prizePhaseApi } from '../services/api'
import { getTeamLogo } from '../utils/teamLogos'

// Team logo component
function TeamLogo({ team }: { team: string }) {
  return (
    <img
      src={getTeamLogo(team)}
      alt={team}
      className="w-full h-full object-contain"
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = 'none'
      }}
    />
  )
}

interface PrizePhaseConfig {
  id: string
  baseReincrement: number
  indemnityConsolidated: boolean
  indemnityConsolidatedAt: string | null
  isFinalized: boolean
  finalizedAt: string | null
}

interface PrizeCategory {
  id: string
  name: string
  isSystemPrize: boolean
  prizes: Array<{
    memberId: string
    teamName: string
    username: string
    amount: number
  }>
}

interface IndemnityPlayer {
  playerId: string
  playerName: string
  position: string
  team: string
  quotation: number
  exitReason: 'RITIRATO' | 'RETROCESSO' | 'ESTERO'
  contract: {
    salary: number
    duration: number
    rescissionClause: number | null
  } | null
}

interface IndemnityStats {
  totalPlayers: number
  byReason: {
    RITIRATO: number
    RETROCESSO: number
    ESTERO: number
  }
}

interface MemberInfo {
  id: string
  teamName: string
  username: string
  currentBudget: number
  totalPrize: number | null
  baseOnly: boolean
  indemnityPlayers: IndemnityPlayer[]
}

interface PrizePhaseData {
  config: PrizePhaseConfig
  categories: PrizeCategory[]
  members: MemberInfo[]
  isAdmin: boolean
  indemnityStats: IndemnityStats
}

interface PrizePhaseManagerProps {
  sessionId: string
  isAdmin: boolean
  onUpdate?: () => void
}

export function PrizePhaseManager({ sessionId, isAdmin, onUpdate }: PrizePhaseManagerProps) {
  const [data, setData] = useState<PrizePhaseData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form states
  const [newCategoryName, setNewCategoryName] = useState('')
  const [editingBaseReincrement, setEditingBaseReincrement] = useState(false)
  const [baseReincrementValue, setBaseReincrementValue] = useState(100)
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false)

  // Editing prizes state: { categoryId: { memberId: value } }
  const [editingPrizes, setEditingPrizes] = useState<Record<string, Record<string, number>>>({})

  // Focus state for inputs: stores original value when input is focused
  const [focusedInput, setFocusedInput] = useState<{ catId: string; memberId: string; originalValue: number } | null>(null)
  const [inputDisplayValue, setInputDisplayValue] = useState<string>('')

  // Custom indemnity amounts: { playerId: amount }
  const [customIndemnities, setCustomIndemnities] = useState<Record<string, number>>({})
  const [savingIndemnity, setSavingIndemnity] = useState<string | null>(null)
  const [consolidatingIndemnities, setConsolidatingIndemnities] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await prizePhaseApi.getData(sessionId)
      if (result.success && result.data) {
        setData(result.data as PrizePhaseData)
        setBaseReincrementValue((result.data as PrizePhaseData).config.baseReincrement)

        // Also load custom indemnities
        try {
          const indemnityResult = await prizePhaseApi.getCustomIndemnities(sessionId)
          if (indemnityResult.success && indemnityResult.data) {
            setCustomIndemnities((indemnityResult.data as { customIndemnities: Record<string, number> }).customIndemnities)
          }
        } catch {
          // Custom indemnities are optional, ignore errors
        }
      } else if (result.message === 'Fase premi non inizializzata') {
        // Need to initialize
        if (isAdmin) {
          const initResult = await prizePhaseApi.initialize(sessionId)
          if (initResult.success) {
            // Fetch again
            const refreshResult = await prizePhaseApi.getData(sessionId)
            if (refreshResult.success && refreshResult.data) {
              setData(refreshResult.data as PrizePhaseData)
              setBaseReincrementValue((refreshResult.data as PrizePhaseData).config.baseReincrement)
            }
          } else {
            setError(initResult.message || 'Errore inizializzazione')
          }
        } else {
          setError('Fase premi non ancora inizializzata dall\'admin')
        }
      } else {
        setError(result.message || 'Errore caricamento dati')
      }
    } catch (err) {
      setError('Errore di connessione')
    } finally {
      setLoading(false)
    }
  }, [sessionId, isAdmin])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleUpdateBaseReincrement = async () => {
    setIsSubmitting(true)
    try {
      const result = await prizePhaseApi.updateBaseReincrement(sessionId, baseReincrementValue)
      if (result.success) {
        setEditingBaseReincrement(false)
        fetchData()
        onUpdate?.()
      } else {
        setError(result.message || 'Errore aggiornamento')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return
    setIsSubmitting(true)
    try {
      const result = await prizePhaseApi.createCategory(sessionId, newCategoryName.trim())
      if (result.success) {
        setNewCategoryName('')
        fetchData()
        onUpdate?.()
      } else {
        setError(result.message || 'Errore creazione categoria')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa categoria?')) return
    setIsSubmitting(true)
    try {
      const result = await prizePhaseApi.deleteCategory(categoryId)
      if (result.success) {
        fetchData()
        onUpdate?.()
      } else {
        setError(result.message || 'Errore eliminazione')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePrizeChange = (categoryId: string, memberId: string, value: number) => {
    setEditingPrizes(prev => ({
      ...prev,
      [categoryId]: {
        ...(prev[categoryId] || {}),
        [memberId]: value
      }
    }))
  }

  const handleSavePrize = async (categoryId: string, memberId: string, directValue?: number) => {
    const value = directValue ?? editingPrizes[categoryId]?.[memberId]
    if (value === undefined) return

    // Update local state immediately (optimistic update)
    setData(prev => {
      if (!prev) return prev
      return {
        ...prev,
        categories: prev.categories.map(cat => {
          if (cat.id !== categoryId) return cat
          const existingPrize = cat.prizes.find(p => p.memberId === memberId)
          if (existingPrize) {
            return {
              ...cat,
              prizes: cat.prizes.map(p =>
                p.memberId === memberId ? { ...p, amount: value } : p
              )
            }
          } else {
            // Add new prize entry
            const member = prev.members.find(m => m.id === memberId)
            return {
              ...cat,
              prizes: [...cat.prizes, {
                memberId,
                teamName: member?.teamName || '',
                username: member?.username || '',
                amount: value
              }]
            }
          }
        })
      }
    })

    // Clear editing state for this cell
    setEditingPrizes(prev => {
      const newState = { ...prev }
      if (newState[categoryId]) {
        delete newState[categoryId][memberId]
        if (Object.keys(newState[categoryId]).length === 0) {
          delete newState[categoryId]
        }
      }
      return newState
    })

    // Save to server in background (no loading state)
    try {
      const result = await prizePhaseApi.setMemberPrize(categoryId, memberId, value)
      if (!result.success) {
        setError(result.message || 'Errore salvataggio')
        // Revert on error by fetching fresh data
        fetchData()
      }
    } catch {
      setError('Errore di connessione')
      fetchData()
    }
  }

  const handleFinalize = async () => {
    setIsSubmitting(true)
    try {
      const result = await prizePhaseApi.finalize(sessionId)
      if (result.success) {
        setShowFinalizeConfirm(false)
        fetchData()
        onUpdate?.()
      } else {
        setError(result.message || 'Errore finalizzazione')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle custom indemnity change for ESTERO players
  const handleIndemnityChange = async (playerId: string, delta: number) => {
    const currentAmount = customIndemnities[playerId] ?? 50
    const newAmount = Math.max(0, currentAmount + delta)

    // Optimistic update
    setCustomIndemnities(prev => ({ ...prev, [playerId]: newAmount }))
    setSavingIndemnity(playerId)

    try {
      const result = await prizePhaseApi.setCustomIndemnity(sessionId, playerId, newAmount)
      if (!result.success) {
        // Revert on error
        setCustomIndemnities(prev => ({ ...prev, [playerId]: currentAmount }))
        setError(result.message || 'Errore salvataggio indennizzo')
      }
    } catch {
      // Revert on error
      setCustomIndemnities(prev => ({ ...prev, [playerId]: currentAmount }))
      setError('Errore di connessione')
    } finally {
      setSavingIndemnity(null)
    }
  }

  // Get indemnity amount for a player (custom or default 50)
  const getIndemnityAmount = (playerId: string) => {
    return customIndemnities[playerId] ?? 50
  }

  // Handle consolidate indemnities
  const handleConsolidateIndemnities = async () => {
    if (!confirm('Sei sicuro di voler consolidare gli indennizzi? Una volta consolidati, gli importi verranno mostrati nella tabella premi e non potranno essere modificati.')) return

    setConsolidatingIndemnities(true)
    try {
      const result = await prizePhaseApi.consolidateIndemnities(sessionId)
      if (result.success) {
        fetchData()
        onUpdate?.()
      } else {
        setError(result.message || 'Errore consolidamento indennizzi')
      }
    } catch {
      setError('Errore di connessione')
    } finally {
      setConsolidatingIndemnities(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-surface-200 rounded-2xl border border-surface-50/20 p-8 text-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-gray-400">Caricamento fase premi...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-danger-500/20 border border-danger-500/30 rounded-xl p-6">
        <p className="text-danger-400 mb-4">{error}</p>
        <Button variant="outline" onClick={fetchData}>Riprova</Button>
      </div>
    )
  }

  if (!data) return null

  const { config, categories, members } = data

  // Separate regular categories from indemnity-related categories
  // Indemnity categories include:
  // - "Indennizzo Partenza Estero" (base system category - should not show per-manager)
  // - "Indennizzo - PlayerName" (individual player indemnities)
  const isIndemnityCategory = (cat: { name: string }) =>
    cat.name.startsWith('Indennizzo - ') || cat.name === 'Indennizzo Partenza Estero'

  const regularCategories = categories.filter(cat => !isIndemnityCategory(cat))
  const indemnityCategories = categories.filter(cat => cat.name.startsWith('Indennizzo - '))

  // Calculate indemnity total per member (sum of all "Indennizzo - X" categories)
  const calculateMemberIndemnityTotal = (memberId: string) => {
    let total = 0
    for (const cat of indemnityCategories) {
      const prize = cat.prizes.find(p => p.memberId === memberId)
      if (prize) {
        total += prize.amount
      }
    }
    return total
  }

  // Calculate totals for display
  // Includes regular categories + individual indemnities (but NOT the base "Indennizzo Partenza Estero")
  // Indemnities are only included when consolidated
  const calculateMemberTotal = (memberId: string) => {
    let total = config.baseReincrement

    // Add regular category prizes
    for (const cat of regularCategories) {
      const prize = cat.prizes.find(p => p.memberId === memberId)
      if (prize) {
        total += prize.amount
      }
    }

    // Add individual indemnity prizes only if consolidated
    if (config.indemnityConsolidated) {
      total += calculateMemberIndemnityTotal(memberId)
    }

    return total
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-yellow-600/20 to-yellow-500/10 border border-yellow-500/30 rounded-2xl p-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-yellow-500/20 flex items-center justify-center">
            <span className="text-3xl">🏆</span>
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-white">Gestione Premi Budget</h2>
            <p className="text-gray-400">
              {config.isFinalized
                ? `Premi finalizzati il ${new Date(config.finalizedAt!).toLocaleString('it-IT')}`
                : 'Configura i premi da assegnare ai manager'}
            </p>
          </div>
          {config.isFinalized && (
            <span className="px-4 py-2 bg-green-500/30 text-green-400 text-sm font-bold rounded-full uppercase">
              Finalizzato
            </span>
          )}
        </div>
      </div>

      {/* Base Reincrement - Read-only for non-admin or when finalized */}
      <div className="bg-surface-200 rounded-2xl border border-surface-50/20 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-white">Re-incremento Budget Base</h3>
            <p className="text-sm text-gray-400">Importo base uguale per tutti i manager</p>
          </div>
          {isAdmin && !config.isFinalized && !editingBaseReincrement && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditingBaseReincrement(true)}
            >
              Modifica
            </Button>
          )}
        </div>

        {editingBaseReincrement ? (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setBaseReincrementValue(Math.max(0, baseReincrementValue - 10))}
              className="w-10 h-10 bg-surface-400 hover:bg-surface-500 text-white rounded-lg text-xl font-bold flex items-center justify-center"
              disabled={baseReincrementValue === 0}
            >
              -
            </button>
            <input
              type="number"
              value={baseReincrementValue}
              onChange={(e) => setBaseReincrementValue(Number(e.target.value))}
              onFocus={(e) => e.target.select()}
              className="w-24 px-3 py-2 bg-surface-300 border border-surface-50/20 rounded-lg text-white text-center text-xl font-bold"
              min={0}
            />
            <button
              onClick={() => setBaseReincrementValue(baseReincrementValue + 10)}
              className="w-10 h-10 bg-surface-400 hover:bg-surface-500 text-white rounded-lg text-xl font-bold flex items-center justify-center"
            >
              +
            </button>
            <span className="text-gray-400 text-lg">M</span>
            <Button
              size="sm"
              onClick={handleUpdateBaseReincrement}
              disabled={isSubmitting}
            >
              Salva
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditingBaseReincrement(false)
                setBaseReincrementValue(config.baseReincrement)
              }}
            >
              Annulla
            </Button>
          </div>
        ) : (
          <div className="text-3xl font-bold text-primary-400">
            {config.baseReincrement}M
          </div>
        )}
      </div>

      {/* Indemnity Details Section - Show if there are affected players */}
      {data.indemnityStats.totalPlayers > 0 && (
        <div className="bg-surface-200 rounded-2xl border border-surface-50/20 overflow-hidden">
          <div className="p-4 border-b border-surface-50/20 bg-gradient-to-r from-cyan-500/10 to-surface-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                  <span className="text-xl">⚠️</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Giocatori Usciti dalla Lista</h3>
                  <p className="text-sm text-gray-400">
                    {data.indemnityStats.totalPlayers} giocatori con contratti attivi
                  </p>
                  <p className="text-xs text-cyan-400 mt-0.5">
                    Importi potenziali — pagati al consolidamento contratti se il manager rilascia il giocatore
                  </p>
                </div>
              </div>
              {/* Stats badges */}
              <div className="flex items-center gap-2">
                {data.indemnityStats.byReason.RITIRATO > 0 && (
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-500/20 text-gray-400 border border-gray-500/30">
                    {data.indemnityStats.byReason.RITIRATO} Ritirati
                  </span>
                )}
                {data.indemnityStats.byReason.RETROCESSO > 0 && (
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    {data.indemnityStats.byReason.RETROCESSO} Retrocessi
                  </span>
                )}
                {data.indemnityStats.byReason.ESTERO > 0 && (
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                    {data.indemnityStats.byReason.ESTERO} Estero
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-300/50">
                <tr className="text-xs text-gray-400 uppercase">
                  <th className="text-left py-3 px-4">Manager</th>
                  <th className="text-center py-3 px-2 w-10">R</th>
                  <th className="text-left py-3 px-3">Giocatore</th>
                  <th className="text-center py-3 px-2 hidden lg:table-cell">Quot.</th>
                  <th className="text-center py-3 px-2 hidden lg:table-cell">Contratto</th>
                  <th className="text-center py-3 px-3">Motivo</th>
                  <th className="text-right py-3 px-4">Indennizzo</th>
                </tr>
              </thead>
              <tbody>
                {members.filter(m => m.indemnityPlayers.length > 0).flatMap(member =>
                  member.indemnityPlayers.map((player, idx) => {
                    const posColorMap: Record<string, { bg: string; text: string }> = {
                      P: { bg: 'bg-gradient-to-r from-amber-500 to-amber-600', text: 'text-white' },
                      D: { bg: 'bg-gradient-to-r from-blue-500 to-blue-600', text: 'text-white' },
                      C: { bg: 'bg-gradient-to-r from-emerald-500 to-emerald-600', text: 'text-white' },
                      A: { bg: 'bg-gradient-to-r from-red-500 to-red-600', text: 'text-white' },
                    }
                    const exitConfig: Record<string, { bg: string; text: string; label: string; indemnity: string }> = {
                      RITIRATO: { bg: 'bg-gray-500/10', text: 'text-gray-400', label: 'Ritirato', indemnity: '-' },
                      RETROCESSO: { bg: 'bg-amber-500/10', text: 'text-amber-400', label: 'Retrocesso', indemnity: '-' },
                      ESTERO: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', label: 'Estero', indemnity: '50M' },
                    }
                    const posColors = posColorMap[player.position] || { bg: 'bg-gradient-to-r from-gray-500 to-gray-600', text: 'text-white' }
                    const cfg = exitConfig[player.exitReason]
                    const isFirstOfMember = idx === 0
                    const memberRowSpan = member.indemnityPlayers.length

                    return (
                      <tr key={`${member.id}-${player.playerId}`} className={`border-t border-surface-50/10 ${cfg.bg}`}>
                        {isFirstOfMember && (
                          <td rowSpan={memberRowSpan} className="py-2 px-4 border-r border-surface-50/10 align-top">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500/30 to-accent-500/30 flex items-center justify-center text-white font-bold text-xs">
                                {member.teamName?.charAt(0) || '?'}
                              </div>
                              <div>
                                <p className="font-medium text-white text-sm">{member.teamName}</p>
                                <p className="text-[10px] text-gray-500">@{member.username}</p>
                              </div>
                            </div>
                          </td>
                        )}
                        <td className="py-2 px-2 text-center">
                          <div className={`w-7 h-7 mx-auto rounded-full ${posColors.bg} ${posColors.text} flex items-center justify-center text-xs font-bold`}>
                            {player.position}
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 bg-white rounded p-0.5 flex-shrink-0">
                              <TeamLogo team={player.team} />
                            </div>
                            <div className="min-w-0">
                              <span className="font-medium text-white text-sm">{player.playerName}</span>
                              <div className="text-xs text-gray-500">{player.team}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-2 text-center text-gray-400 hidden lg:table-cell">
                          {player.quotation}M
                        </td>
                        <td className="py-2 px-2 text-center text-primary-400 hidden lg:table-cell">
                          {player.contract ? `${player.contract.salary}M/${player.contract.duration}a` : '-'}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${cfg.text} ${cfg.bg} border border-current/30`}>
                            {cfg.label}
                          </span>
                        </td>
                        <td className="py-2 px-4 text-right">
                          {player.exitReason === 'ESTERO' ? (
                            isAdmin && !config.isFinalized && !config.indemnityConsolidated ? (
                              <div className="flex items-center justify-end gap-0.5">
                                <button
                                  type="button"
                                  className="w-6 h-6 bg-surface-400 hover:bg-surface-500 text-white rounded text-sm font-bold flex items-center justify-center transition-colors disabled:opacity-50"
                                  onClick={() => handleIndemnityChange(player.playerId, -1)}
                                  disabled={savingIndemnity === player.playerId || getIndemnityAmount(player.playerId) <= 0}
                                >
                                  −
                                </button>
                                <span className={`w-14 px-1 py-1 bg-surface-300 border border-cyan-500/30 rounded text-cyan-400 text-center text-sm font-medium ${savingIndemnity === player.playerId ? 'opacity-50' : ''}`}>
                                  {getIndemnityAmount(player.playerId)}
                                </span>
                                <button
                                  type="button"
                                  className="w-6 h-6 bg-surface-400 hover:bg-surface-500 text-white rounded text-sm font-bold flex items-center justify-center transition-colors disabled:opacity-50"
                                  onClick={() => handleIndemnityChange(player.playerId, 1)}
                                  disabled={savingIndemnity === player.playerId}
                                >
                                  +
                                </button>
                              </div>
                            ) : (
                              <span className="text-cyan-400 font-bold">{getIndemnityAmount(player.playerId)}M</span>
                            )
                          ) : (
                            <span className="text-gray-500">−</span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
              {/* Footer with totals */}
              <tfoot>
                <tr className="border-t-2 border-surface-50/30 bg-surface-300/30">
                  <td colSpan={6} className="py-3 px-4 text-right text-gray-400 font-medium">
                    Totale Indennizzi Estero:
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="text-cyan-400 font-bold text-lg">
                      {members.flatMap(m => m.indemnityPlayers)
                        .filter(p => p.exitReason === 'ESTERO')
                        .reduce((sum, p) => sum + getIndemnityAmount(p.playerId), 0)}M
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Consolidate Indemnities Button - Only for admin when not yet consolidated and not finalized */}
          {isAdmin && !config.indemnityConsolidated && !config.isFinalized && data.indemnityStats.byReason.ESTERO > 0 && (
            <div className="p-4 border-t border-surface-50/20 bg-cyan-500/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                    <span className="text-lg">💾</span>
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm">Consolida gli indennizzi</p>
                    <p className="text-gray-500 text-xs">Conferma gli importi impostati sopra per mostrarli nella tabella premi</p>
                  </div>
                </div>
                <Button
                  onClick={handleConsolidateIndemnities}
                  disabled={consolidatingIndemnities}
                  className="bg-cyan-600 hover:bg-cyan-500"
                >
                  {consolidatingIndemnities ? 'Consolidamento...' : 'Consolida Indennizzi'}
                </Button>
              </div>
            </div>
          )}

          {/* Consolidated badge */}
          {config.indemnityConsolidated && (
            <div className="p-4 border-t border-surface-50/20 bg-green-500/5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <span className="text-lg">✅</span>
                </div>
                <div>
                  <p className="text-green-400 font-medium text-sm">Indennizzi consolidati</p>
                  <p className="text-gray-500 text-xs">
                    Consolidati il {config.indemnityConsolidatedAt ? new Date(config.indemnityConsolidatedAt).toLocaleString('it-IT') : '-'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="p-4 border-t border-surface-50/20 bg-surface-300/20">
            <div className="flex flex-wrap gap-6 text-xs text-gray-400">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-gray-500/30"></span>
                <span><strong>Ritirato:</strong> Contratto terminato, nessun compenso</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-amber-500/30"></span>
                <span><strong>Retrocesso:</strong> Il manager deciderà se mantenere o rilasciare</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-cyan-500/30"></span>
                <span><strong>Estero:</strong> Se il manager rilascia, riceve l'indennizzo</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Categories and Prizes Table - Admin only */}
      {isAdmin && (
        <div className="bg-surface-200 rounded-2xl border border-surface-50/20 overflow-hidden">
          <div className="p-4 border-b border-surface-50/20">
            <h3 className="text-lg font-bold text-white">Assegnazione Premi per Manager</h3>
            <p className="text-sm text-gray-400 mt-1">Configura i premi budget per ogni manager</p>
          </div>

          {/* Desktop: Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-yellow-500/10 text-xs text-gray-400 uppercase">
                  <th className="text-left p-3">Manager / Squadra</th>
                  <th className="text-center p-2 border-l border-surface-50/20">Budget</th>
                  {regularCategories.map(cat => (
                    <th key={cat.id} className="text-center p-2 min-w-[100px]">
                      <div className="flex items-center justify-center gap-1">
                        <span className="truncate">{cat.name}</span>
                        {!cat.isSystemPrize && !config.isFinalized && (
                          <button
                            onClick={() => handleDeleteCategory(cat.id)}
                            className="text-danger-400 hover:text-danger-300 text-sm"
                            title="Elimina categoria"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </th>
                  ))}
                  {/* Single column for total indemnities (read-only) - only show when consolidated */}
                  {indemnityCategories.length > 0 && config.indemnityConsolidated && (
                    <th className="text-center p-2 min-w-[100px] text-cyan-400">
                      <span>Indennizzi</span>
                    </th>
                  )}
                  <th className="text-center p-2 text-primary-400 font-bold border-l border-surface-50/20">Premio Tot.</th>
                  <th className="text-center p-2 text-emerald-400 font-bold border-l border-surface-50/20">Budget Tot.</th>
                </tr>
              </thead>
              <tbody>
                {members.map(member => (
                  <tr key={member.id} className="border-t border-surface-50/10 hover:bg-surface-300/30">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500/30 to-accent-500/30 flex items-center justify-center text-white font-bold">
                          {member.teamName?.charAt(0) || '?'}
                        </div>
                        <div>
                          <p className="text-white font-medium">{member.teamName || 'Senza nome'}</p>
                          <p className="text-gray-500 text-xs">@{member.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-2 text-center border-l border-surface-50/20">
                      <span className="text-accent-400 font-medium">{member.currentBudget}M</span>
                    </td>
                    {regularCategories.map(cat => {
                      const prize = cat.prizes.find(p => p.memberId === member.id)
                      const savedValue = editingPrizes[cat.id]?.[member.id] ?? prize?.amount ?? 0
                      const isFocused = focusedInput?.catId === cat.id && focusedInput?.memberId === member.id

                      const handleFocus = () => {
                        setFocusedInput({ catId: cat.id, memberId: member.id, originalValue: savedValue })
                        setInputDisplayValue('')
                      }

                      const handleBlur = () => {
                        if (inputDisplayValue === '' && focusedInput) {
                          // Restore original value if nothing was entered
                          setFocusedInput(null)
                          setInputDisplayValue('')
                        } else if (inputDisplayValue !== '') {
                          // Save the new value
                          const newValue = parseInt(inputDisplayValue, 10)
                          if (!isNaN(newValue) && newValue >= 0) {
                            handlePrizeChange(cat.id, member.id, newValue)
                            handleSavePrize(cat.id, member.id, newValue)
                          }
                          setFocusedInput(null)
                          setInputDisplayValue('')
                        } else {
                          setFocusedInput(null)
                        }
                      }

                      const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
                        setInputDisplayValue(e.target.value)
                      }

                      const handleIncrement = () => {
                        const newValue = savedValue + 1
                        handlePrizeChange(cat.id, member.id, newValue)
                        handleSavePrize(cat.id, member.id, newValue)
                      }

                      const handleDecrement = () => {
                        const newValue = Math.max(0, savedValue - 1)
                        handlePrizeChange(cat.id, member.id, newValue)
                        handleSavePrize(cat.id, member.id, newValue)
                      }

                      return (
                        <td key={cat.id} className="text-center py-2 px-1">
                          {config.isFinalized ? (
                            <span className="text-gray-300">{prize?.amount ?? 0}M</span>
                          ) : (
                            <div className="flex items-center justify-center gap-0.5">
                              <button
                                onClick={handleDecrement}
                                className="w-6 h-6 bg-surface-400 hover:bg-surface-500 text-white rounded text-sm font-bold flex items-center justify-center"
                                disabled={isSubmitting || savedValue === 0}
                              >
                                -
                              </button>
                              <input
                                type="number"
                                value={isFocused ? inputDisplayValue : savedValue}
                                onChange={handleInputChange}
                                onFocus={handleFocus}
                                onBlur={handleBlur}
                                className="w-14 px-1 py-1 bg-surface-300 border border-surface-50/20 rounded text-white text-center text-sm"
                                min={0}
                                placeholder={isFocused ? String(focusedInput?.originalValue) : ''}
                              />
                              <button
                                onClick={handleIncrement}
                                className="w-6 h-6 bg-surface-400 hover:bg-surface-500 text-white rounded text-sm font-bold flex items-center justify-center"
                                disabled={isSubmitting}
                              >
                                +
                              </button>
                            </div>
                          )}
                        </td>
                      )
                    })}
                    {/* Single column showing total indemnities (read-only) - only show when consolidated */}
                    {indemnityCategories.length > 0 && config.indemnityConsolidated && (
                      <td className="text-center py-2 px-1">
                        <span className="text-cyan-400 font-medium">
                          {calculateMemberIndemnityTotal(member.id)}M
                        </span>
                      </td>
                    )}
                    <td className="text-center p-2 border-l border-surface-50/20">
                      <span className="text-primary-400 font-bold text-lg">
                        {calculateMemberTotal(member.id)}M
                      </span>
                    </td>
                    <td className="text-center p-2 border-l border-surface-50/20">
                      <span className="text-emerald-400 font-bold text-lg">
                        {member.currentBudget + calculateMemberTotal(member.id)}M
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: Card View */}
          <div className="md:hidden p-4 space-y-4">
            {members.map(member => (
              <div key={member.id} className="bg-surface-300 rounded-xl p-4 border border-surface-50/20">
                {/* Header: Manager info */}
                <div className="flex items-center gap-3 mb-3 pb-3 border-b border-surface-50/20">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500/30 to-accent-500/30 flex items-center justify-center text-white font-bold text-lg">
                    {member.teamName?.charAt(0) || '?'}
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-bold">{member.teamName || 'Senza nome'}</p>
                    <p className="text-gray-400 text-sm">@{member.username}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-primary-400 font-bold text-lg">{calculateMemberTotal(member.id)}M</p>
                    <p className="text-gray-500 text-xs">Premio totale</p>
                  </div>
                </div>

                {/* Budget */}
                <div className="flex items-center justify-between mb-2 text-sm">
                  <span className="text-gray-400">Budget attuale:</span>
                  <span className="text-accent-400 font-medium">{member.currentBudget}M</span>
                </div>
                <div className="flex items-center justify-between mb-3 text-sm">
                  <span className="text-gray-400">Budget totale:</span>
                  <span className="text-emerald-400 font-bold">{member.currentBudget + calculateMemberTotal(member.id)}M</span>
                </div>

                {/* Prizes */}
                <div className="space-y-2">
                  {regularCategories.map(cat => {
                    const prize = cat.prizes.find(p => p.memberId === member.id)
                    const savedValue = editingPrizes[cat.id]?.[member.id] ?? prize?.amount ?? 0

                    return (
                      <div key={cat.id} className="flex items-center justify-between">
                        <span className="text-gray-300 text-sm truncate flex-1">{cat.name}</span>
                        {config.isFinalized ? (
                          <span className="text-gray-300 font-medium">{savedValue}M</span>
                        ) : (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                const newValue = Math.max(0, savedValue - 1)
                                handlePrizeChange(cat.id, member.id, newValue)
                                handleSavePrize(cat.id, member.id, newValue)
                              }}
                              className="w-8 h-8 bg-surface-400 text-white rounded font-bold"
                              disabled={isSubmitting || savedValue === 0}
                            >-</button>
                            <span className="w-14 text-center text-white font-medium">{savedValue}M</span>
                            <button
                              onClick={() => {
                                const newValue = savedValue + 1
                                handlePrizeChange(cat.id, member.id, newValue)
                                handleSavePrize(cat.id, member.id, newValue)
                              }}
                              className="w-8 h-8 bg-surface-400 text-white rounded font-bold"
                              disabled={isSubmitting}
                            >+</button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {/* Single row for total indemnities (read-only) - only show when consolidated */}
                  {indemnityCategories.length > 0 && config.indemnityConsolidated && (
                    <div className="flex items-center justify-between pt-2 border-t border-surface-50/20">
                      <span className="text-cyan-400 text-sm font-medium">Indennizzi</span>
                      <span className="text-cyan-400 font-medium">{calculateMemberIndemnityTotal(member.id)}M</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Add category - only if not finalized */}
          {!config.isFinalized && (
            <div className="mt-4 pt-4 border-t border-surface-50/20">
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Nome nuova categoria (es. Classifica Portieri)"
                  className="flex-1 px-3 py-2 bg-surface-300 border border-surface-50/20 rounded-lg text-white placeholder-gray-500"
                />
                <Button
                  onClick={handleCreateCategory}
                  disabled={!newCategoryName.trim() || isSubmitting}
                >
                  Aggiungi Categoria
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Summary for managers (non-admin) */}
      {!isAdmin && (
        <div className="bg-surface-200 rounded-2xl border border-surface-50/20 overflow-hidden">
          {/* Header with status */}
          <div className={`p-4 border-b border-surface-50/20 ${config.isFinalized ? 'bg-green-500/10' : 'bg-yellow-500/10'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${config.isFinalized ? 'bg-green-500/20' : 'bg-yellow-500/20'}`}>
                  <span className="text-xl">{config.isFinalized ? '✅' : '⏳'}</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Assegnazione Premi</h3>
                  <p className="text-sm text-gray-400">
                    {config.isFinalized
                      ? `Convalidati il ${new Date(config.finalizedAt!).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                      : 'In attesa di convalida da parte dell\'admin lega'}
                  </p>
                </div>
              </div>
              <span className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase ${
                config.isFinalized
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
              }`}>
                {config.isFinalized ? 'Convalidato' : 'In attesa'}
              </span>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {config.isFinalized ? (
              <div className="space-y-3">
                {members.map(member => (
                  <div key={member.id} className="flex items-center justify-between p-3 bg-surface-300 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500/30 to-accent-500/30 flex items-center justify-center text-white font-bold">
                        {member.teamName?.charAt(0) || '?'}
                      </div>
                      <div>
                        <p className="text-white font-medium">{member.teamName}</p>
                        <p className="text-gray-500 text-xs">@{member.username}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-green-400 font-bold text-lg">+{member.totalPrize}M</p>
                      <p className="text-gray-500 text-xs">Budget: {member.currentBudget}M</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">⏳</span>
                </div>
                <p className="text-gray-300 font-medium mb-2">Premi non ancora convalidati</p>
                <p className="text-gray-500 text-sm">L'admin della lega deve ancora finalizzare l'assegnazione dei premi.</p>
                <div className="mt-4 p-3 bg-surface-300 rounded-lg inline-block">
                  <p className="text-gray-400 text-sm">Re-incremento base garantito:</p>
                  <p className="text-primary-400 font-bold text-xl">{config.baseReincrement}M</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Finalize button - Admin only */}
      {isAdmin && !config.isFinalized && (
        <div className="bg-surface-200 rounded-2xl border border-surface-50/20 p-6">
          <h3 className="text-lg font-bold text-white mb-4">Finalizza Premi</h3>
          <p className="text-gray-400 mb-4">
            Una volta finalizzati, i premi verranno accreditati sui budget dei manager e non potranno essere modificati.
          </p>

          {!showFinalizeConfirm ? (
            <Button
              onClick={() => setShowFinalizeConfirm(true)}
              disabled={isSubmitting}
            >
              Finalizza Premi
            </Button>
          ) : (
            <div className="flex items-center gap-3 bg-warning-500/20 p-4 rounded-lg">
              <span className="text-warning-400">Confermi la finalizzazione dei premi?</span>
              <Button
                size="sm"
                onClick={handleFinalize}
                disabled={isSubmitting}
              >
                Conferma
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowFinalizeConfirm(false)}
              >
                Annulla
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
