import { useState, useEffect } from 'react'
import { contractApi, leagueApi } from '../services/api'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'
import { Navigation } from '../components/Navigation'

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

const POSITION_COLORS: Record<string, string> = {
  P: 'bg-yellow-100 text-yellow-800',
  D: 'bg-blue-100 text-blue-800',
  C: 'bg-green-100 text-green-800',
  A: 'bg-red-100 text-red-800',
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

  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null)
  const [selectedPending, setSelectedPending] = useState<PendingContract | null>(null)

  const [isRenewing, setIsRenewing] = useState(false)
  const [isReleasing, setIsReleasing] = useState(false)

  const [newSalary, setNewSalary] = useState('')
  const [newDuration, setNewDuration] = useState('2')

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
    // Load league to check admin status
    const leagueResponse = await leagueApi.getById(leagueId)
    if (leagueResponse.success && leagueResponse.data) {
      const data = leagueResponse.data as { userMembership?: { role: string } }
      setIsLeagueAdmin(data.userMembership?.role === 'ADMIN')
    }
    await loadContracts()
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-300">
        <Navigation currentPage="contracts" leagueId={leagueId} isLeagueAdmin={isLeagueAdmin} onNavigate={onNavigate} />
        <div className="flex items-center justify-center h-[80vh]">
          <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark-300">
      <Navigation currentPage="contracts" leagueId={leagueId} isLeagueAdmin={isLeagueAdmin} onNavigate={onNavigate} />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Phase Indicator */}
        <div className={`mb-6 p-4 rounded-lg ${inContrattiPhase ? 'bg-success-50 border border-success-200' : 'bg-warning-50 border border-warning-200'}`}>
          {inContrattiPhase ? (
            <p className="text-success-700 font-medium">
              Fase CONTRATTI attiva - Puoi impostare, rinnovare e svincolare contratti
            </p>
          ) : (
            <p className="text-warning-700 font-medium">
              Non sei in fase CONTRATTI - Le operazioni sui contratti sono disabilitate
            </p>
          )}
        </div>

        {success && (
          <div className="bg-success-50 text-success-700 p-3 rounded-lg mb-6">
            {success}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Panel: Lists */}
          <div className="lg:col-span-2 space-y-6">
            {/* Pending Contracts */}
            {pendingContracts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-warning-600">
                    Giocatori senza contratto ({pendingContracts.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="divide-y">
                    {pendingContracts.map(pending => (
                      <button
                        key={pending.rosterId}
                        onClick={() => inContrattiPhase && handleSelectPending(pending)}
                        disabled={!inContrattiPhase}
                        className={`w-full flex items-center justify-between p-4 hover:bg-warning-50 transition-colors text-left ${
                          selectedPending?.rosterId === pending.rosterId ? 'bg-warning-100' : ''
                        } ${!inContrattiPhase ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${POSITION_COLORS[pending.player.position]}`}>
                            {pending.player.position}
                          </span>
                          <div>
                            <p className="font-medium">{pending.player.name}</p>
                            <p className="text-sm text-gray-500">{pending.player.team}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-warning-600 font-medium">Da impostare</p>
                          <p className="text-xs text-gray-500">Min: {pending.minSalary}/sem</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Active Contracts */}
            <Card>
              <CardHeader>
                <CardTitle>Contratti Attivi ({contracts.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {contracts.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">Nessun contratto attivo</p>
                ) : (
                  <div className="divide-y">
                    {contracts.map(contract => (
                      <button
                        key={contract.id}
                        onClick={() => handleSelectContract(contract)}
                        className={`w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left ${
                          selectedContract?.id === contract.id ? 'bg-primary-50' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${POSITION_COLORS[contract.roster.player.position]}`}>
                            {contract.roster.player.position}
                          </span>
                          <div>
                            <p className="font-medium">{contract.roster.player.name}</p>
                            <p className="text-sm text-gray-500">{contract.roster.player.team}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-mono">{contract.salary}/sem</p>
                          <p className="text-sm text-gray-500">
                            {contract.duration} sem.
                            {contract.canSpalmare && <span className="text-warning-600 ml-1">(spalma)</span>}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Panel: Detail/Actions */}
          <div>
            {/* Create Contract Form */}
            {viewMode === 'create-contract' && selectedPending && (
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle>{selectedPending.player.name}</CardTitle>
                    <button onClick={handleBackToList} className="text-gray-400 hover:text-gray-600">×</button>
                  </div>
                </CardHeader>
                <CardContent>
                  {error && (
                    <div className="bg-danger-50 text-danger-600 p-3 rounded-lg mb-4 text-sm">
                      {error}
                    </div>
                  )}

                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Squadra:</span>
                      <span>{selectedPending.player.team}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Prezzo acquisto:</span>
                      <span className="font-mono">{selectedPending.acquisitionPrice}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Ingaggio minimo:</span>
                      <span className="font-mono text-warning-600">{selectedPending.minSalary}</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium">Imposta Contratto</h4>

                    {selectedPending.acquisitionType === 'FIRST_MARKET' ? (
                      <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-600">
                        Acquisto al PRIMO MERCATO: ingaggio libero (min 1)
                      </div>
                    ) : (
                      <div className="bg-warning-50 p-3 rounded-lg text-sm text-warning-700">
                        Ingaggio minimo: {selectedPending.minSalary} (10% del prezzo acquisto)
                      </div>
                    )}

                    <Input
                      label="Ingaggio"
                      type="number"
                      value={newSalary}
                      onChange={e => setNewSalary(e.target.value)}
                      min={selectedPending.minSalary}
                    />

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Durata
                      </label>
                      <select
                        value={newDuration}
                        onChange={e => setNewDuration(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      >
                        {getDurationOptions(1).map(opt => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <Button variant="outline" onClick={handlePreviewCreate} className="w-full">
                      Calcola Clausola
                    </Button>

                    {previewData && (
                      <div className="bg-gray-50 p-3 rounded-lg space-y-2 text-sm">
                        {!previewData.isValid ? (
                          <p className="text-danger-600 font-medium">{previewData.validationError}</p>
                        ) : (
                          <div className="flex justify-between">
                            <span>Clausola rescissoria:</span>
                            <span className="font-mono">{previewData.rescissionClause}</span>
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
                </CardContent>
              </Card>
            )}

            {/* Contract Detail */}
            {viewMode === 'contract-detail' && selectedContract && (
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle>{selectedContract.roster.player.name}</CardTitle>
                    <button onClick={handleBackToList} className="text-gray-400 hover:text-gray-600">×</button>
                  </div>
                </CardHeader>
                <CardContent>
                  {error && (
                    <div className="bg-danger-50 text-danger-600 p-3 rounded-lg mb-4 text-sm">
                      {error}
                    </div>
                  )}

                  {/* Contract Info */}
                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Squadra:</span>
                      <span>{selectedContract.roster.player.team}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Ingaggio attuale:</span>
                      <span className="font-mono">{selectedContract.salary}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Durata residua:</span>
                      <span>{selectedContract.duration} semestri</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Clausola rescissoria:</span>
                      <span className="font-mono text-danger-600">
                        {selectedContract.rescissionClause}
                        <span className="text-xs text-gray-400 ml-1">
                          (x{DURATION_MULTIPLIERS[selectedContract.duration]})
                        </span>
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Ingaggio iniziale:</span>
                      <span className="font-mono">{selectedContract.initialSalary}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Prezzo acquisto:</span>
                      <span className="font-mono">{selectedContract.roster.acquisitionPrice}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  {!isRenewing && !isReleasing && inContrattiPhase && (
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
                    <p className="text-warning-600 text-sm text-center">
                      Operazioni disponibili solo in fase CONTRATTI
                    </p>
                  )}

                  {/* Renewal Form */}
                  {isRenewing && (
                    <div className="space-y-4">
                      <h4 className="font-medium">Rinnova Contratto</h4>

                      {selectedContract.canSpalmare ? (
                        <div className="bg-warning-50 p-3 rounded-lg text-sm">
                          <p className="font-medium text-warning-700">Modalità SPALMAINGAGGI</p>
                          <p className="text-warning-600 mt-1">
                            Puoi spalmare l'ingaggio su più anni.
                            <br />
                            Requisito: nuovo ingaggio × durata ≥ {selectedContract.initialSalary}
                          </p>
                        </div>
                      ) : (
                        <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-600">
                          <p><strong>Regole rinnovo:</strong></p>
                          <ul className="list-disc list-inside mt-1">
                            <li>Ingaggio: min {selectedContract.salary} (no ribasso)</li>
                            <li>Durata: min {selectedContract.duration} semestri (no ribasso)</li>
                          </ul>
                        </div>
                      )}

                      <Input
                        label="Nuovo Ingaggio"
                        type="number"
                        value={newSalary}
                        onChange={e => setNewSalary(e.target.value)}
                        min={selectedContract.canSpalmare ? 1 : selectedContract.salary}
                      />

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Nuova Durata
                        </label>
                        <select
                          value={newDuration}
                          onChange={e => setNewDuration(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                        >
                          {getDurationOptions(selectedContract.canSpalmare ? 1 : selectedContract.duration).map(opt => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <Button variant="outline" onClick={handlePreviewRenewal} className="w-full">
                        Calcola Costo
                      </Button>

                      {previewData && (
                        <div className="bg-gray-50 p-3 rounded-lg space-y-2 text-sm">
                          {!previewData.isValid ? (
                            <p className="text-danger-600 font-medium">{previewData.validationError}</p>
                          ) : (
                            <>
                              <div className="flex justify-between">
                                <span>Costo rinnovo:</span>
                                <span className="font-mono">{previewData.renewalCost}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Nuova clausola:</span>
                                <span className="font-mono">{previewData.newRescissionClause}</span>
                              </div>
                              {!previewData.canAfford && (
                                <p className="text-danger-600">Budget insufficiente!</p>
                              )}
                            </>
                          )}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button variant="ghost" onClick={() => setIsRenewing(false)}>
                          Annulla
                        </Button>
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
                    <div className="space-y-4">
                      <h4 className="font-medium text-danger-600">Svincola Giocatore</h4>
                      <p className="text-sm text-gray-600">
                        Stai per svincolare <strong>{selectedContract.roster.player.name}</strong>.
                      </p>
                      <div className="bg-danger-50 p-3 rounded-lg">
                        <p className="text-danger-700">
                          Clausola da pagare: <strong>{selectedContract.rescissionClause}</strong> crediti
                          <span className="text-xs text-danger-500 ml-1">
                            ({selectedContract.salary} x {DURATION_MULTIPLIERS[selectedContract.duration]})
                          </span>
                        </p>
                        {selectedContract.rescissionClause > memberBudget && (
                          <p className="text-danger-600 mt-1 text-sm">Budget insufficiente!</p>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        Il giocatore tornerà disponibile per le aste future.
                      </p>
                      <div className="flex gap-2">
                        <Button variant="ghost" onClick={() => setIsReleasing(false)}>
                          Annulla
                        </Button>
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
                </CardContent>
              </Card>
            )}

            {/* Empty State */}
            {viewMode === 'list' && (
              <Card>
                <CardContent className="py-8 text-center text-gray-500">
                  {pendingContracts.length > 0
                    ? 'Seleziona un giocatore per impostare il contratto'
                    : contracts.length > 0
                      ? 'Seleziona un contratto per vedere i dettagli'
                      : 'Nessun giocatore in rosa'}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
