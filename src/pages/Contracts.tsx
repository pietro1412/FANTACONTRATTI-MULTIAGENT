import { useState, useEffect } from 'react'
import { contractApi, leagueApi } from '../services/api'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Navigation } from '../components/Navigation'
import { getTeamLogo } from '../utils/teamLogos'

interface ContractsProps {
  leagueId: string
  onNavigate: (page: string, params?: Record<string, string>) => void
}

interface Player {
  id: string
  name: string
  team: string
  position: string
}

interface Contract {
  id: string
  salary: number
  duration: number
  initialSalary: number
  initialDuration: number
  rescissionClause: number
  canRenew: boolean
  canSpalmare: boolean
  roster: {
    id: string
    player: Player
    acquisitionPrice: number
    acquisitionType: string
  }
}

interface PendingContract {
  rosterId: string
  player: Player
  acquisitionPrice: number
  acquisitionType: string
  minSalary: number
}

// Stile per ruolo
function getRoleStyle(position: string) {
  switch (position) {
    case 'P': return { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/40', label: 'POR' }
    case 'D': return { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/40', label: 'DIF' }
    case 'C': return { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/40', label: 'CEN' }
    case 'A': return { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/40', label: 'ATT' }
    default: return { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/40', label: position }
  }
}

// Componente logo squadra
function TeamLogo({ team }: { team: string }) {
  return (
    <img
      src={getTeamLogo(team)}
      alt={team}
      className="w-8 h-8 object-contain"
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = 'none'
      }}
    />
  )
}

// Moltiplicatori clausola per UI
const DURATION_MULTIPLIERS: Record<number, number> = {
  4: 11,
  3: 9,
  2: 7,
  1: 4,
}

type ViewMode = 'list' | 'contract-detail' | 'create-contract'

export function Contracts({ leagueId, onNavigate }: ContractsProps) {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [pendingContracts, setPendingContracts] = useState<PendingContract[]>([])
  const [memberBudget, setMemberBudget] = useState(0)
  const [inContrattiPhase, setInContrattiPhase] = useState(false)
  const [isLeagueAdmin, setIsLeagueAdmin] = useState(false)
  const [isConsolidated, setIsConsolidated] = useState(false)
  const [consolidatedAt, setConsolidatedAt] = useState<string | null>(null)
  const [isConsolidating, setIsConsolidating] = useState(false)

  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null)
  const [selectedPending, setSelectedPending] = useState<PendingContract | null>(null)

  const [isRenewing, setIsRenewing] = useState(false)
  const [isReleasing, setIsReleasing] = useState(false)

  const [newSalary, setNewSalary] = useState('')
  const [newDuration, setNewDuration] = useState('2')

  // Filtri
  const [searchQuery, setSearchQuery] = useState('')
  const [filterRole, setFilterRole] = useState('')

  const [previewData, setPreviewData] = useState<{
    renewalCost?: number
    newRescissionClause?: number
    rescissionClause?: number
    canAfford?: boolean
    isValid: boolean
    validationError?: string
    isSpalmaingaggi?: boolean
    initialSalary?: number
    minSalary?: number
  } | null>(null)

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadData()
  }, [leagueId])

  async function loadData() {
    const leagueResponse = await leagueApi.getById(leagueId)
    if (leagueResponse.success && leagueResponse.data) {
      const data = leagueResponse.data as { userMembership?: { role: string } }
      setIsLeagueAdmin(data.userMembership?.role === 'ADMIN')
    }
    await loadContracts()
    await loadConsolidationStatus()
  }

  async function loadConsolidationStatus() {
    const result = await contractApi.getConsolidationStatus(leagueId)
    if (result.success && result.data) {
      const data = result.data as {
        inContrattiPhase: boolean
        isConsolidated: boolean
        consolidatedAt: string | null
      }
      setIsConsolidated(data.isConsolidated)
      setConsolidatedAt(data.consolidatedAt)
    }
  }

  async function handleConsolidate() {
    setIsConsolidating(true)
    setError('')

    const result = await contractApi.consolidate(leagueId)
    if (result.success) {
      setSuccess(result.message || 'Contratti consolidati!')
      setIsConsolidated(true)
      const data = result.data as { consolidatedAt?: string }
      if (data?.consolidatedAt) {
        setConsolidatedAt(data.consolidatedAt)
      }
    } else {
      setError(result.message || 'Errore nel consolidamento')
    }
    setIsConsolidating(false)
  }

  async function loadContracts() {
    const result = await contractApi.getAll(leagueId)
    if (result.success && result.data) {
      const data = result.data as {
        contracts: Contract[]
        pendingContracts: PendingContract[]
        memberBudget: number
        inContrattiPhase: boolean
      }
      setContracts(data.contracts)
      setPendingContracts(data.pendingContracts)
      setMemberBudget(data.memberBudget)
      setInContrattiPhase(data.inContrattiPhase)
    }
    setIsLoading(false)
  }

  function handleSelectContract(contract: Contract) {
    setSelectedContract(contract)
    setSelectedPending(null)
    setViewMode('contract-detail')
    setNewSalary(String(contract.salary))
    setNewDuration(String(Math.min(contract.duration + 1, 4)))
    setPreviewData(null)
    setIsRenewing(false)
    setIsReleasing(false)
    setError('')
    setSuccess('')
  }

  function handleSelectPending(pending: PendingContract) {
    setSelectedPending(pending)
    setSelectedContract(null)
    setViewMode('create-contract')
    setNewSalary(String(pending.minSalary))
    setNewDuration('2')
    setPreviewData(null)
    setError('')
    setSuccess('')
  }

  function handleBackToList() {
    setViewMode('list')
    setSelectedContract(null)
    setSelectedPending(null)
    setIsRenewing(false)
    setIsReleasing(false)
    setPreviewData(null)
    setError('')
  }

  // =============== CREATE CONTRACT ===============
  async function handlePreviewCreate() {
    if (!selectedPending) return
    setError('')

    const salary = parseInt(newSalary)
    const duration = parseInt(newDuration)

    if (isNaN(salary) || isNaN(duration)) {
      setError('Valori non validi')
      return
    }

    const result = await contractApi.previewCreate(selectedPending.rosterId, salary, duration)
    if (result.success && result.data) {
      setPreviewData(result.data as typeof previewData)
    } else {
      setError(result.message || 'Errore nel calcolo')
    }
  }

  async function handleCreateContract() {
    if (!selectedPending) return
    setError('')

    const salary = parseInt(newSalary)
    const duration = parseInt(newDuration)

    const result = await contractApi.create(selectedPending.rosterId, salary, duration)
    if (result.success) {
      setSuccess(result.message || 'Contratto creato!')
      handleBackToList()
      loadContracts()
    } else {
      setError(result.message || 'Errore nella creazione')
    }
  }

  // =============== RENEWAL ===============
  async function handlePreviewRenewal() {
    if (!selectedContract) return
    setError('')

    const salary = parseInt(newSalary)
    const duration = parseInt(newDuration)

    if (isNaN(salary) || isNaN(duration)) {
      setError('Valori non validi')
      return
    }

    const result = await contractApi.preview(selectedContract.id, salary, duration)
    if (result.success && result.data) {
      setPreviewData(result.data as typeof previewData)
    } else {
      setError(result.message || 'Errore nel calcolo')
    }
  }

  async function handleRenew() {
    if (!selectedContract) return
    setError('')

    const salary = parseInt(newSalary)
    const duration = parseInt(newDuration)

    const result = await contractApi.renew(selectedContract.id, salary, duration)
    if (result.success) {
      setSuccess(result.message || 'Contratto rinnovato!')
      handleBackToList()
      loadContracts()
    } else {
      setError(result.message || 'Errore nel rinnovo')
    }
  }

  // =============== RELEASE ===============
  async function handleRelease() {
    if (!selectedContract) return
    setError('')

    const result = await contractApi.release(selectedContract.id)
    if (result.success) {
      setSuccess(result.message || 'Giocatore svincolato!')
      handleBackToList()
      loadContracts()
    } else {
      setError(result.message || 'Errore nello svincolo')
    }
  }

  // =============== HELPERS ===============
  function getDurationOptions(minDuration: number = 1) {
    const options = []
    for (let d = minDuration; d <= 4; d++) {
      options.push({
        value: String(d),
        label: `${d} semest${d === 1 ? 're' : 'ri'} (x${DURATION_MULTIPLIERS[d]})`,
      })
    }
    return options
  }

  // Combina tutti i giocatori per i filtri
  const allItems = [
    ...pendingContracts.map(p => ({ type: 'pending' as const, data: p, player: p.player })),
    ...contracts.map(c => ({ type: 'contract' as const, data: c, player: c.roster.player }))
  ]

  // Applica filtri
  const filteredItems = allItems.filter(item => {
    if (filterRole && item.player.position !== filterRole) return false
    if (searchQuery && !item.player.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  // Ordina per ruolo poi per nome
  const sortedItems = filteredItems.sort((a, b) => {
    const roleOrder = { P: 0, D: 1, C: 2, A: 3 }
    const roleA = roleOrder[a.player.position as keyof typeof roleOrder] ?? 4
    const roleB = roleOrder[b.player.position as keyof typeof roleOrder] ?? 4
    if (roleA !== roleB) return roleA - roleB
    return a.player.name.localeCompare(b.player.name)
  })

  const filteredPending = sortedItems.filter(i => i.type === 'pending')
  const filteredContracts = sortedItems.filter(i => i.type === 'contract')

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-300">
        <Navigation currentPage="contracts" leagueId={leagueId} isLeagueAdmin={isLeagueAdmin} onNavigate={onNavigate} />
        <div className="flex items-center justify-center h-[80vh]">
          <div className="w-16 h-16 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark-300">
      <Navigation currentPage="contracts" leagueId={leagueId} isLeagueAdmin={isLeagueAdmin} onNavigate={onNavigate} />

      {/* Page Header */}
      <div className="bg-gradient-to-r from-dark-200 via-surface-200 to-dark-200 border-b border-surface-50/20">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex justify-between items-end">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center shadow-glow">
                <span className="text-3xl">📝</span>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Gestione Contratti</h1>
                <p className="text-gray-400 mt-1">
                  {inContrattiPhase
                    ? <span className="text-secondary-400">Fase CONTRATTI attiva</span>
                    : <span className="text-warning-400">Fase CONTRATTI non attiva</span>
                  }
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="text-center bg-surface-200 rounded-xl px-4 py-3 border border-surface-50/20">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Budget</p>
                <p className="text-2xl font-bold text-accent-400">{memberBudget}M</p>
              </div>
              <div className="text-center bg-surface-200 rounded-xl px-4 py-3 border border-surface-50/20">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Ingaggi/Sem</p>
                <p className="text-2xl font-bold text-warning-400">-{contracts.reduce((sum, c) => sum + c.salary, 0)}M</p>
              </div>
              <div className={`text-center bg-surface-200 rounded-xl px-4 py-3 border ${
                memberBudget - contracts.reduce((sum, c) => sum + c.salary, 0) < 0
                  ? 'border-danger-500/30'
                  : 'border-secondary-500/30'
              }`}>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Dopo Ingaggi</p>
                <p className={`text-2xl font-bold ${
                  memberBudget - contracts.reduce((sum, c) => sum + c.salary, 0) < 0
                    ? 'text-danger-400'
                    : 'text-secondary-400'
                }`}>
                  {memberBudget - contracts.reduce((sum, c) => sum + c.salary, 0)}M
                </p>
              </div>
              {pendingContracts.length > 0 && (
                <div className="text-center bg-surface-200 rounded-xl px-4 py-3 border border-warning-500/30">
                  <p className="text-xs text-warning-400 uppercase tracking-wide">Da impostare</p>
                  <p className="text-2xl font-bold text-warning-400">{pendingContracts.length}</p>
                </div>
              )}
            </div>
          </div>

          {/* Consolidation Section */}
          {inContrattiPhase && (
            <div className="mt-4 pt-4 border-t border-surface-50/20">
              {isConsolidated ? (
                <div className="flex items-center gap-3 bg-secondary-500/10 border border-secondary-500/30 rounded-lg px-4 py-3">
                  <span className="text-2xl">✓</span>
                  <div>
                    <p className="text-secondary-400 font-medium">Contratti consolidati</p>
                    {consolidatedAt && (
                      <p className="text-gray-500 text-sm">
                        {new Date(consolidatedAt).toLocaleString('it-IT')}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between bg-surface-300/50 border border-surface-50/20 rounded-lg px-4 py-3">
                  <div>
                    <p className="text-gray-300 font-medium">Consolidamento contratti</p>
                    <p className="text-gray-500 text-sm">
                      {pendingContracts.length > 0
                        ? `Imposta prima tutti i ${pendingContracts.length} contratti mancanti`
                        : 'Tutti i contratti sono impostati. Conferma per consolidare.'}
                    </p>
                  </div>
                  <Button
                    onClick={handleConsolidate}
                    disabled={pendingContracts.length > 0 || isConsolidating}
                    className={pendingContracts.length > 0 ? 'opacity-50' : ''}
                  >
                    {isConsolidating ? 'Consolidamento...' : 'Consolida'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {success && (
          <div className="bg-secondary-500/20 border border-secondary-500/30 text-secondary-400 p-3 rounded-lg mb-6">
            {success}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Panel: Player List */}
          <div className="lg:col-span-2 space-y-6">
            {/* Filters */}
            <div className="bg-surface-200 rounded-xl border border-surface-50/20 p-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Cerca per nome</label>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Nome giocatore..."
                    className="w-full px-3 py-2 bg-surface-300 border border-surface-50/30 rounded-lg text-white text-sm focus:border-primary-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Ruolo</label>
                  <select
                    value={filterRole}
                    onChange={e => setFilterRole(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-300 border border-surface-50/30 rounded-lg text-white text-sm focus:border-primary-500 focus:outline-none"
                  >
                    <option value="">Tutti i ruoli</option>
                    <option value="P">Portieri</option>
                    <option value="D">Difensori</option>
                    <option value="C">Centrocampisti</option>
                    <option value="A">Attaccanti</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setSearchQuery(''); setFilterRole('') }}
                    className="w-full"
                  >
                    Resetta
                  </Button>
                </div>
              </div>
            </div>

            {/* Unified Player List */}
            <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
              <div className="p-4 border-b border-surface-50/20 flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">
                  Rosa ({sortedItems.length} giocatori)
                </h2>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-secondary-400">{filteredContracts.length} con contratto</span>
                  {filteredPending.length > 0 && (
                    <span className="text-warning-400">{filteredPending.length} da impostare</span>
                  )}
                </div>
              </div>
              <div className="p-4">
                {sortedItems.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-3 opacity-50">📋</div>
                    <p className="text-gray-500">Nessun giocatore trovato</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sortedItems.map(item => {
                      if (item.type === 'pending') {
                        const pending = item.data as PendingContract
                        const roleStyle = getRoleStyle(pending.player.position)
                        const isSelected = selectedPending?.rosterId === pending.rosterId

                        return (
                          <button
                            key={`pending-${pending.rosterId}`}
                            onClick={() => inContrattiPhase && !isConsolidated && handleSelectPending(pending)}
                            disabled={!inContrattiPhase || isConsolidated}
                            className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                              isSelected
                                ? 'bg-warning-500/20 border-warning-500/50'
                                : 'bg-surface-300 border-warning-500/20 hover:border-warning-500/40'
                            } ${!inContrattiPhase || isConsolidated ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <div className="w-10 h-10 flex items-center justify-center bg-white/10 rounded-lg p-1 flex-shrink-0">
                              <TeamLogo team={pending.player.team} />
                            </div>
                            <div className={`w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-lg ${roleStyle.bg} ${roleStyle.border} border`}>
                              <span className={`text-sm font-bold ${roleStyle.text}`}>{roleStyle.label}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-white font-medium truncate">{pending.player.name}</p>
                              <p className="text-gray-500 text-xs">{pending.player.team}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-warning-400 font-semibold text-sm">Da impostare</p>
                              <p className="text-gray-500 text-xs">Min: {pending.minSalary}M/sem</p>
                            </div>
                          </button>
                        )
                      } else {
                        const contract = item.data as Contract
                        const roleStyle = getRoleStyle(contract.roster.player.position)
                        const isSelected = selectedContract?.id === contract.id

                        return (
                          <button
                            key={`contract-${contract.id}`}
                            onClick={() => handleSelectContract(contract)}
                            className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                              isSelected
                                ? 'bg-primary-500/20 border-primary-500/50'
                                : 'bg-surface-300 border-surface-50/20 hover:border-primary-500/30'
                            }`}
                          >
                            <div className="w-10 h-10 flex items-center justify-center bg-white/10 rounded-lg p-1 flex-shrink-0">
                              <TeamLogo team={contract.roster.player.team} />
                            </div>
                            <div className={`w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-lg ${roleStyle.bg} ${roleStyle.border} border`}>
                              <span className={`text-sm font-bold ${roleStyle.text}`}>{roleStyle.label}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-white font-medium truncate">{contract.roster.player.name}</p>
                              <p className="text-gray-500 text-xs">{contract.roster.player.team}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="flex items-center justify-end gap-2">
                                <span className="text-accent-400 font-semibold text-sm">{contract.salary}M</span>
                                <span className="text-gray-600">|</span>
                                <span className="text-gray-400 text-xs">{contract.duration} sem</span>
                              </div>
                              <div className="flex items-center justify-end gap-1">
                                <span className="text-[10px] text-gray-500 uppercase">Rubata:</span>
                                <span className="text-warning-400 font-medium text-xs">{contract.rescissionClause}M</span>
                              </div>
                            </div>
                          </button>
                        )
                      }
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Panel: Detail/Actions */}
          <div>
            {/* Create Contract Form */}
            {viewMode === 'create-contract' && selectedPending && (
              <div className="bg-surface-200 rounded-xl border border-warning-500/30 overflow-hidden">
                <div className="p-4 border-b border-surface-50/20 bg-warning-500/10 flex justify-between items-center">
                  <h3 className="text-lg font-bold text-warning-400">Nuovo Contratto</h3>
                  <button onClick={handleBackToList} className="text-gray-400 hover:text-white text-xl">&times;</button>
                </div>
                <div className="p-4">
                  {/* Player Card */}
                  <div className="flex items-center gap-3 p-3 bg-surface-300 rounded-lg mb-4">
                    <div className="w-12 h-12 flex items-center justify-center bg-white/10 rounded-lg p-1">
                      <TeamLogo team={selectedPending.player.team} />
                    </div>
                    <div>
                      <p className="text-white font-bold">{selectedPending.player.name}</p>
                      <p className="text-gray-500 text-sm">{selectedPending.player.team}</p>
                    </div>
                  </div>

                  {error && (
                    <div className="bg-danger-500/20 border border-danger-500/30 text-danger-400 p-3 rounded-lg mb-4 text-sm">
                      {error}
                    </div>
                  )}

                  <div className="space-y-3 mb-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Prezzo acquisto:</span>
                      <span className="text-white font-mono">{selectedPending.acquisitionPrice}M</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Ingaggio minimo:</span>
                      <span className="text-warning-400 font-mono">{selectedPending.minSalary}M</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Input
                      label="Ingaggio (M/semestre)"
                      type="number"
                      value={newSalary}
                      onChange={e => setNewSalary(e.target.value)}
                      min={selectedPending.minSalary}
                      className="bg-surface-300 border-surface-50/30 text-white"
                    />

                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Durata</label>
                      <select
                        value={newDuration}
                        onChange={e => setNewDuration(e.target.value)}
                        className="w-full px-3 py-2 bg-surface-300 border border-surface-50/30 rounded-lg text-white"
                      >
                        {getDurationOptions(1).map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>

                    <Button variant="outline" onClick={handlePreviewCreate} className="w-full">
                      Calcola Clausola
                    </Button>

                    {previewData && (
                      <div className="bg-surface-300 p-3 rounded-lg space-y-2 text-sm">
                        {!previewData.isValid ? (
                          <p className="text-danger-400 font-medium">{previewData.validationError}</p>
                        ) : (
                          <div className="flex justify-between">
                            <span className="text-gray-400">Clausola rescissoria:</span>
                            <span className="text-warning-400 font-mono">{previewData.rescissionClause}M</span>
                          </div>
                        )}
                      </div>
                    )}

                    <Button
                      onClick={handleCreateContract}
                      disabled={!previewData?.isValid}
                      className="w-full"
                    >
                      Conferma Contratto
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Contract Detail */}
            {viewMode === 'contract-detail' && selectedContract && (
              <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
                <div className="p-4 border-b border-surface-50/20 flex justify-between items-center">
                  <h3 className="text-lg font-bold text-white">Dettaglio Contratto</h3>
                  <button onClick={handleBackToList} className="text-gray-400 hover:text-white text-xl">&times;</button>
                </div>
                <div className="p-4">
                  {/* Player Card */}
                  <div className="flex items-center gap-3 p-3 bg-surface-300 rounded-lg mb-4">
                    <div className="w-12 h-12 flex items-center justify-center bg-white/10 rounded-lg p-1">
                      <TeamLogo team={selectedContract.roster.player.team} />
                    </div>
                    <div>
                      <p className="text-white font-bold">{selectedContract.roster.player.name}</p>
                      <p className="text-gray-500 text-sm">{selectedContract.roster.player.team}</p>
                    </div>
                  </div>

                  {error && (
                    <div className="bg-danger-500/20 border border-danger-500/30 text-danger-400 p-3 rounded-lg mb-4 text-sm">
                      {error}
                    </div>
                  )}

                  {/* Contract Info */}
                  <div className="space-y-3 mb-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Ingaggio attuale:</span>
                      <span className="text-accent-400 font-mono">{selectedContract.salary}M/sem</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Durata residua:</span>
                      <span className="text-white">{selectedContract.duration} semestri</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Clausola rescissoria:</span>
                      <span className="text-warning-400 font-mono">{selectedContract.rescissionClause}M</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Ingaggio iniziale:</span>
                      <span className="text-gray-300 font-mono">{selectedContract.initialSalary}M</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Prezzo acquisto:</span>
                      <span className="text-gray-300 font-mono">{selectedContract.roster.acquisitionPrice}M</span>
                    </div>
                  </div>

                  {/* Actions */}
                  {!isRenewing && !isReleasing && inContrattiPhase && !isConsolidated && (
                    <div className="flex gap-2">
                      {selectedContract.canRenew && (
                        <Button onClick={() => setIsRenewing(true)} className="flex-1">
                          Rinnova
                        </Button>
                      )}
                      <Button variant="danger" onClick={() => setIsReleasing(true)} className="flex-1">
                        Svincola
                      </Button>
                    </div>
                  )}

                  {!inContrattiPhase && (
                    <p className="text-warning-400 text-sm text-center py-2">
                      Operazioni disponibili solo in fase CONTRATTI
                    </p>
                  )}

                  {inContrattiPhase && isConsolidated && (
                    <p className="text-secondary-400 text-sm text-center py-2">
                      Contratti consolidati. Non puoi più modificarli.
                    </p>
                  )}

                  {/* Renewal Form */}
                  {isRenewing && (
                    <div className="space-y-4 pt-4 border-t border-surface-50/20">
                      <h4 className="font-medium text-white">Rinnova Contratto</h4>

                      {selectedContract.canSpalmare && (
                        <div className="bg-warning-500/20 border border-warning-500/30 p-3 rounded-lg text-sm">
                          <p className="font-medium text-warning-400">Modalità SPALMAINGAGGI</p>
                          <p className="text-warning-300 mt-1 text-xs">
                            Requisito: nuovo ingaggio × durata ≥ {selectedContract.initialSalary}M
                          </p>
                        </div>
                      )}

                      <Input
                        label="Nuovo Ingaggio"
                        type="number"
                        value={newSalary}
                        onChange={e => setNewSalary(e.target.value)}
                        min={selectedContract.canSpalmare ? 1 : selectedContract.salary}
                        className="bg-surface-300 border-surface-50/30 text-white"
                      />

                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Nuova Durata</label>
                        <select
                          value={newDuration}
                          onChange={e => setNewDuration(e.target.value)}
                          className="w-full px-3 py-2 bg-surface-300 border border-surface-50/30 rounded-lg text-white"
                        >
                          {getDurationOptions(selectedContract.canSpalmare ? 1 : selectedContract.duration).map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>

                      <Button variant="outline" onClick={handlePreviewRenewal} className="w-full">
                        Calcola Costo
                      </Button>

                      {previewData && (
                        <div className="bg-surface-300 p-3 rounded-lg space-y-2 text-sm">
                          {!previewData.isValid ? (
                            <p className="text-danger-400 font-medium">{previewData.validationError}</p>
                          ) : (
                            <>
                              <div className="flex justify-between">
                                <span className="text-gray-400">Costo rinnovo:</span>
                                <span className="text-accent-400 font-mono">{previewData.renewalCost}M</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-400">Nuova clausola:</span>
                                <span className="text-warning-400 font-mono">{previewData.newRescissionClause}M</span>
                              </div>
                              {!previewData.canAfford && (
                                <p className="text-danger-400">Budget insufficiente!</p>
                              )}
                            </>
                          )}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button variant="ghost" onClick={() => setIsRenewing(false)}>Annulla</Button>
                        <Button
                          onClick={handleRenew}
                          disabled={!previewData?.isValid || !previewData?.canAfford}
                          className="flex-1"
                        >
                          Conferma Rinnovo
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Release Confirmation */}
                  {isReleasing && (
                    <div className="space-y-4 pt-4 border-t border-surface-50/20">
                      <h4 className="font-medium text-danger-400">Svincola Giocatore</h4>
                      <div className="bg-danger-500/20 border border-danger-500/30 p-3 rounded-lg">
                        <p className="text-danger-300">
                          Clausola da pagare: <strong>{selectedContract.rescissionClause}M</strong>
                        </p>
                        {selectedContract.rescissionClause > memberBudget && (
                          <p className="text-danger-400 mt-1 text-sm">Budget insufficiente!</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" onClick={() => setIsReleasing(false)}>Annulla</Button>
                        <Button
                          variant="danger"
                          onClick={handleRelease}
                          disabled={selectedContract.rescissionClause > memberBudget}
                          className="flex-1"
                        >
                          Conferma Svincolo
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Empty State */}
            {viewMode === 'list' && (
              <div className="bg-surface-200 rounded-xl border border-surface-50/20 p-8 text-center">
                <div className="text-4xl mb-3 opacity-50">👈</div>
                <p className="text-gray-500">
                  {pendingContracts.length > 0
                    ? 'Seleziona un giocatore per impostare il contratto'
                    : contracts.length > 0
                      ? 'Seleziona un contratto per vedere i dettagli'
                      : 'Nessun giocatore in rosa'}
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
