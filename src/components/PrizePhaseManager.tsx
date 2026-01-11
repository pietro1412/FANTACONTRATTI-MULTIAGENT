import { useState, useEffect, useCallback } from 'react'
import { Button } from './ui/Button'
import { prizePhaseApi } from '../services/api'

interface PrizePhaseConfig {
  id: string
  baseReincrement: number
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

interface MemberInfo {
  id: string
  teamName: string
  username: string
  currentBudget: number
  totalPrize: number | null
  baseOnly: boolean
}

interface PrizePhaseData {
  config: PrizePhaseConfig
  categories: PrizeCategory[]
  members: MemberInfo[]
  isAdmin: boolean
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

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await prizePhaseApi.getData(sessionId)
      if (result.success && result.data) {
        setData(result.data as PrizePhaseData)
        setBaseReincrementValue((result.data as PrizePhaseData).config.baseReincrement)
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

    setIsSubmitting(true)
    try {
      const result = await prizePhaseApi.setMemberPrize(categoryId, memberId, value)
      if (result.success) {
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
        fetchData()
        onUpdate?.()
      } else {
        setError(result.message || 'Errore salvataggio')
      }
    } finally {
      setIsSubmitting(false)
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

  // Calculate totals for display
  const calculateMemberTotal = (memberId: string) => {
    let total = config.baseReincrement
    for (const cat of categories) {
      const prize = cat.prizes.find(p => p.memberId === memberId)
      if (prize) {
        total += prize.amount
      }
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

      {/* Categories and Prizes Table - Admin only */}
      {isAdmin && (
        <div className="bg-surface-200 rounded-2xl border border-surface-50/20 p-6">
          <h3 className="text-lg font-bold text-white mb-4">Categorie Premi</h3>

          {/* Categories table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-50/20">
                  <th className="text-left py-3 px-2 text-gray-400 font-medium">Manager</th>
                  {categories.map(cat => (
                    <th key={cat.id} className="text-center py-3 px-2 min-w-[120px]">
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-gray-300 font-medium truncate">{cat.name}</span>
                        {!cat.isSystemPrize && !config.isFinalized && (
                          <button
                            onClick={() => handleDeleteCategory(cat.id)}
                            className="text-danger-400 hover:text-danger-300 text-xs"
                            title="Elimina categoria"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </th>
                  ))}
                  <th className="text-center py-3 px-2 text-primary-400 font-bold">Totale</th>
                </tr>
              </thead>
              <tbody>
                {members.map(member => (
                  <tr key={member.id} className="border-b border-surface-50/10">
                    <td className="py-3 px-2">
                      <div>
                        <p className="text-white font-medium">{member.teamName}</p>
                        <p className="text-gray-500 text-xs">{member.username}</p>
                      </div>
                    </td>
                    {categories.map(cat => {
                      const prize = cat.prizes.find(p => p.memberId === member.id)
                      const savedValue = editingPrizes[cat.id]?.[member.id] ?? prize?.amount ?? 0
                      const isEditing = editingPrizes[cat.id]?.[member.id] !== undefined
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
                        const newValue = savedValue + 5
                        handlePrizeChange(cat.id, member.id, newValue)
                        handleSavePrize(cat.id, member.id, newValue)
                      }

                      const handleDecrement = () => {
                        const newValue = Math.max(0, savedValue - 5)
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
                    <td className="text-center py-3 px-2">
                      <span className="text-primary-400 font-bold text-lg">
                        {calculateMemberTotal(member.id)}M
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
        <div className="bg-surface-200 rounded-2xl border border-surface-50/20 p-6">
          <h3 className="text-lg font-bold text-white mb-4">Riepilogo Budget</h3>
          {config.isFinalized ? (
            <div className="space-y-3">
              {members.map(member => (
                <div key={member.id} className="flex items-center justify-between p-3 bg-surface-300 rounded-lg">
                  <div>
                    <p className="text-white font-medium">{member.teamName}</p>
                    <p className="text-gray-500 text-xs">{member.username}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-primary-400 font-bold text-lg">+{member.totalPrize}M</p>
                    <p className="text-gray-500 text-xs">Budget: {member.currentBudget}M</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-400">I premi saranno visibili dopo la finalizzazione da parte dell'admin.</p>
              <p className="text-gray-500 text-sm mt-2">Re-incremento base: <span className="text-primary-400">{config.baseReincrement}M</span></p>
            </div>
          )}
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
