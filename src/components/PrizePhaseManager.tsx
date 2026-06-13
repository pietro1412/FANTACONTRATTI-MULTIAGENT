import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { ErrorState } from '@/components/ui/ErrorState'
import { Input } from '@/components/ui/Input'
import { AmountStepper } from '@/components/ui/AmountStepper'
import { PrizePhaseHeader } from '@/components/prizes/PrizePhaseHeader'
import { PrizeStepper, type PrizeStep } from '@/components/prizes/PrizeStepper'
import { StepCard } from '@/components/prizes/StepCard'
import { IndemnityTable } from '@/components/prizes/IndemnityTable'
import { PrizeAssignmentTable } from '@/components/prizes/PrizeAssignmentTable'
import { ManagerPrizeSummary, type ManagerRecognition } from '@/components/prizes/ManagerPrizeSummary'
import { prizePhaseApi } from '@/services/api'

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

const DEFAULT_INDEMNITY = 50

export function PrizePhaseManager({ sessionId, isAdmin, onUpdate }: PrizePhaseManagerProps) {
  const { user } = useAuth()
  const { confirm: confirmDialog } = useConfirmDialog()
  const { toast } = useToast()
  const [data, setData] = useState<PrizePhaseData | null>(null)
  const [loading, setLoading] = useState(true)
  // Init condivisa: garantisce UNA sola initializePrizePhase anche se l'effect viene
  // invocato due volte (React StrictMode in dev) → evita due init concorrenti che
  // violerebbero il vincolo unique sulla config (P2002 → 500). Vedi oss. #34.
  const initPromiseRef = useRef<Promise<unknown> | null>(null)
  // Errore SOLO per il caricamento iniziale (sostituisce la UI con recovery). Gli
  // errori delle singole azioni vanno a toast.error e NON smontano la pagina.
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form states
  const [newCategoryName, setNewCategoryName] = useState('')
  const [editingBaseReincrement, setEditingBaseReincrement] = useState(false)
  const [baseReincrementValue, setBaseReincrementValue] = useState(100)

  // Custom indemnity amounts: { playerId: amount }
  const [customIndemnities, setCustomIndemnities] = useState<Record<string, number>>({})
  const [savingIndemnity, setSavingIndemnity] = useState<string | null>(null)
  const [consolidatingIndemnities, setConsolidatingIndemnities] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
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
        // Need to initialize (admin only)
        if (isAdmin) {
          // Una sola init condivisa tra invocazioni concorrenti dell'effect (StrictMode):
          // entrambe attendono la STESSA promise, quindi initialize parte una volta sola.
          if (!initPromiseRef.current) {
            initPromiseRef.current = prizePhaseApi.initialize(sessionId)
          }
          await initPromiseRef.current
          // Ricarica: con la config ormai creata, la pagina si popola senza errori spuri.
          const refreshResult = await prizePhaseApi.getData(sessionId)
          if (refreshResult.success && refreshResult.data) {
            setData(refreshResult.data as PrizePhaseData)
            setBaseReincrementValue((refreshResult.data as PrizePhaseData).config.baseReincrement)
          } else {
            setLoadError(refreshResult.message || 'Errore inizializzazione')
          }
        } else {
          setLoadError('Fase premi non ancora inizializzata dall\'admin')
        }
      } else {
        setLoadError(result.message || 'Errore caricamento dati')
      }
    } catch {
      setLoadError('Errore di connessione')
    } finally {
      setLoading(false)
    }
  }, [sessionId, isAdmin])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const handleUpdateBaseReincrement = async () => {
    setIsSubmitting(true)
    try {
      const result = await prizePhaseApi.updateBaseReincrement(sessionId, baseReincrementValue)
      if (result.success) {
        setEditingBaseReincrement(false)
        toast.success('Re-incremento base aggiornato')
        void fetchData()
        onUpdate?.()
      } else {
        toast.error(result.message || 'Errore aggiornamento')
      }
    } catch {
      toast.error('Errore di connessione')
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
        toast.success('Categoria creata')
        void fetchData()
        onUpdate?.()
      } else {
        toast.error(result.message || 'Errore creazione categoria')
      }
    } catch {
      toast.error('Errore di connessione')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteCategory = async (categoryId: string) => {
    const ok = await confirmDialog({
      title: 'Elimina categoria',
      message: 'Sei sicuro di voler eliminare questa categoria?',
      confirmLabel: 'Elimina',
      variant: 'danger'
    })
    if (!ok) return
    setIsSubmitting(true)
    try {
      const result = await prizePhaseApi.deleteCategory(categoryId)
      if (result.success) {
        toast.success('Categoria eliminata')
        void fetchData()
        onUpdate?.()
      } else {
        toast.error(result.message || 'Errore eliminazione')
      }
    } catch {
      toast.error('Errore di connessione')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Save a member prize, with optimistic local update.
  const handleSavePrize = async (categoryId: string, memberId: string, value: number) => {
    if (value < 0) return

    // Optimistic update
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
          }
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
        })
      }
    })

    // Save to server in background (no loading state)
    try {
      const result = await prizePhaseApi.setMemberPrize(categoryId, memberId, value)
      if (!result.success) {
        toast.error(result.message || 'Errore salvataggio premio')
        void fetchData()
      }
    } catch {
      toast.error('Errore di connessione')
      void fetchData()
    }
  }

  const handleFinalize = async () => {
    const ok = await confirmDialog({
      title: 'Finalizza fase premi',
      message: 'I premi verranno accreditati sui budget dei manager e non potranno più essere modificati. Confermi la finalizzazione?',
      confirmLabel: 'Finalizza',
      variant: 'warning'
    })
    if (!ok) return
    setIsSubmitting(true)
    try {
      const result = await prizePhaseApi.finalize(sessionId)
      if (result.success) {
        toast.success('Premi finalizzati e accreditati')
        void fetchData()
        onUpdate?.()
      } else {
        toast.error(result.message || 'Errore finalizzazione')
      }
    } catch {
      toast.error('Errore di connessione')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Set the absolute custom indemnity for an ESTERO player (NumberStepper gives the new value).
  const handleIndemnityChange = async (playerId: string, newAmount: number) => {
    const currentAmount = customIndemnities[playerId] ?? DEFAULT_INDEMNITY
    const safeAmount = Math.max(0, newAmount)

    setCustomIndemnities(prev => ({ ...prev, [playerId]: safeAmount }))
    setSavingIndemnity(playerId)

    try {
      const result = await prizePhaseApi.setCustomIndemnity(sessionId, playerId, safeAmount)
      if (!result.success) {
        setCustomIndemnities(prev => ({ ...prev, [playerId]: currentAmount }))
        toast.error(result.message || 'Errore salvataggio indennizzo')
      }
    } catch {
      setCustomIndemnities(prev => ({ ...prev, [playerId]: currentAmount }))
      toast.error('Errore di connessione')
    } finally {
      setSavingIndemnity(null)
    }
  }

  // Get indemnity amount for a player (custom or default 50)
  const getIndemnityAmount = (playerId: string) => {
    return customIndemnities[playerId] ?? DEFAULT_INDEMNITY
  }

  const handleConsolidateIndemnities = async () => {
    const ok = await confirmDialog({
      title: 'Consolida indennizzi',
      message: 'Sei sicuro di voler consolidare gli indennizzi? Una volta consolidati, gli importi verranno mostrati nella tabella premi e non potranno essere modificati.',
      confirmLabel: 'Consolida',
      variant: 'warning'
    })
    if (!ok) return

    setConsolidatingIndemnities(true)
    try {
      const result = await prizePhaseApi.consolidateIndemnities(sessionId)
      if (result.success) {
        toast.success('Indennizzi consolidati')
        void fetchData()
        onUpdate?.()
      } else {
        toast.error(result.message || 'Errore consolidamento indennizzi')
      }
    } catch {
      toast.error('Errore di connessione')
    } finally {
      setConsolidatingIndemnities(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-surface-200 rounded-2xl border border-surface-50/20 p-8 text-center">
        <Spinner size="lg" color="accent" className="mx-auto mb-4" />
        <p className="text-gray-400">Caricamento fase premi...</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <ErrorState
        title="Impossibile caricare la fase premi"
        message={loadError}
        onRetry={() => void fetchData()}
      />
    )
  }

  if (!data) return null

  const { config, categories, members } = data

  // Separate regular categories from indemnity-related categories.
  // isIndemnityCategory uses backend-mirrored magic strings — leave as-is (#out of scope).
  const isIndemnityCategory = (cat: { name: string }) =>
    cat.name.startsWith('Indennizzo - ') || cat.name === 'Indennizzo Partenza Estero'

  const regularCategories = categories.filter(cat => !isIndemnityCategory(cat))
  const indemnityCategories = categories.filter(cat => cat.name.startsWith('Indennizzo - '))

  const getPrizeAmount = (categoryId: string, memberId: string) =>
    categories.find(c => c.id === categoryId)?.prizes.find(p => p.memberId === memberId)?.amount ?? 0

  // Sum of all "Indennizzo - X" categories for a member.
  const calculateMemberIndemnityTotal = (memberId: string) => {
    let total = 0
    for (const cat of indemnityCategories) {
      const prize = cat.prizes.find(p => p.memberId === memberId)
      if (prize) total += prize.amount
    }
    return total
  }

  // Total = base + regular category prizes + (indemnities only when consolidated).
  const calculateMemberTotal = (memberId: string) => {
    let total = config.baseReincrement
    for (const cat of regularCategories) {
      const prize = cat.prizes.find(p => p.memberId === memberId)
      if (prize) total += prize.amount
    }
    if (config.indemnityConsolidated) {
      total += calculateMemberIndemnityTotal(memberId)
    }
    return total
  }

  const showIndemnities = indemnityCategories.length > 0 && config.indemnityConsolidated
  const hasIndemnityPlayers = data.indemnityStats.totalPlayers > 0
  const hasEsteroIndemnities = data.indemnityStats.byReason.ESTERO > 0

  // -- Derive stepper status from existing data (no logic change) --
  const assignedCategories = regularCategories.filter(cat =>
    cat.prizes.some(p => p.amount > 0)
  ).length
  const totalCategories = regularCategories.length

  const step1Done = config.baseReincrement > 0
  const step2Done = config.indemnityConsolidated || !hasEsteroIndemnities
  const step2NeedsAction = hasEsteroIndemnities && !config.indemnityConsolidated
  const step4Available = step2Done && !config.isFinalized

  let step3Status: PrizeStep['status']
  if (config.isFinalized || (totalCategories > 0 && assignedCategories === totalCategories)) {
    step3Status = 'done'
  } else if (step2Done) {
    step3Status = 'current'
  } else {
    step3Status = 'todo'
  }

  const steps: PrizeStep[] = [
    {
      num: 1,
      title: 'Re-incremento base',
      status: step1Done ? 'done' : 'current',
      hint: step1Done ? `${config.baseReincrement}M impostati` : 'da impostare',
    },
    {
      num: 2,
      title: 'Indennizzi estero',
      status: !hasEsteroIndemnities
        ? 'done'
        : config.indemnityConsolidated
          ? 'done'
          : 'current',
      hint: !hasEsteroIndemnities
        ? 'nessun indennizzo'
        : config.indemnityConsolidated
          ? 'consolidati'
          : 'da consolidare',
    },
    {
      num: 3,
      title: 'Assegna premi',
      status: step3Status,
      hint: totalCategories > 0 ? `${assignedCategories}/${totalCategories} categorie` : 'nessuna categoria',
    },
    {
      num: 4,
      title: 'Finalizza',
      status: config.isFinalized ? 'done' : step4Available ? 'current' : 'locked',
      hint: config.isFinalized ? 'finalizzato' : step4Available ? 'pronto' : 'richiede step 2',
    },
  ]

  // -- Header stats --
  const montepremiTotal = members.reduce((sum, m) => sum + calculateMemberTotal(m.id), 0)
  const assignedTotal = members.reduce(
    (sum, m) =>
      sum +
      regularCategories.reduce((s, cat) => {
        const prize = cat.prizes.find(p => p.memberId === m.id)
        return s + (prize?.amount ?? 0)
      }, 0),
    0
  )

  // ====================== MANAGER VIEW ======================
  if (!isAdmin) {
    const myMember = members.find(m => m.username === user?.username) ?? null

    const recognitions: ManagerRecognition[] = []
    if (myMember && config.isFinalized) {
      recognitions.push({
        key: 'base',
        category: 'Re-incremento base',
        amount: config.baseReincrement,
        description: 'uguale per tutti i manager',
      })
      for (const cat of regularCategories) {
        const prize = cat.prizes.find(p => p.memberId === myMember.id)
        if (prize && prize.amount > 0) {
          recognitions.push({
            key: cat.id,
            category: cat.name,
            amount: prize.amount,
            description: cat.isSystemPrize ? 'premio di lega' : 'premio personalizzato',
            highlight: true,
          })
        }
      }
      const indemnityTotal = calculateMemberIndemnityTotal(myMember.id)
      if (indemnityTotal > 0) {
        recognitions.push({
          key: 'indemnity',
          category: 'Indennizzi estero',
          amount: indemnityTotal,
          description: 'giocatori usciti all\'estero',
        })
      }
    }

    const myTotal = myMember ? calculateMemberTotal(myMember.id) : config.baseReincrement
    const budgetPre = myMember?.currentBudget ?? 0

    return (
      <div className="space-y-5">
        <PrizePhaseHeader
          title="I tuoi premi"
          subtitle="Premi e indennizzi accreditati al tuo budget per questa stagione."
          stats={[
            { label: 'Budget pre-premi', value: `${budgetPre}M` },
            ...(config.isFinalized
              ? [{ label: 'Budget aggiornato', value: `${budgetPre + myTotal}M`, gold: true }]
              : []),
          ]}
        />

        <ManagerPrizeSummary
          isFinalized={config.isFinalized}
          baseReincrement={config.baseReincrement}
          total={myTotal}
          recognitions={recognitions}
        />
      </div>
    )
  }

  // ====================== ADMIN VIEW ======================
  return (
    <div className="space-y-5">
      <PrizePhaseHeader
        title="Fase Premi"
        subtitle={
          config.isFinalized
            ? `Finalizzata il ${new Date(config.finalizedAt!).toLocaleString('it-IT')}`
            : 'Definisci re-incremento, indennizzi e premi, poi finalizza per accreditare i budget.'
        }
        stats={[
          { label: 'Montepremi', value: `${montepremiTotal}M` },
          { label: 'Assegnato', value: `${assignedTotal}M`, gold: true },
          { label: 'Manager', value: String(members.length) },
        ]}
      />

      <PrizeStepper steps={steps} />

      {/* Step 1 - Base reincrement */}
      <StepCard
        num={1}
        title="Re-incremento Budget Base"
        chipLabel={step1Done ? 'Impostato' : 'Da fare'}
        chipKind={step1Done ? 'ok' : 'todo'}
        done={step1Done}
      >
        {editingBaseReincrement && !config.isFinalized ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-gray-400">Ogni manager riceve a inizio stagione un re-incremento di base pari a</span>
            <AmountStepper
              value={baseReincrementValue}
              onChange={setBaseReincrementValue}
              min={0}
              step={10}
              size="sm"
              aria-label="Re-incremento base"
            />
            <span className="micro-label">milioni</span>
            <div className="flex items-center gap-2 ml-auto">
              <Button size="sm" onClick={() => void handleUpdateBaseReincrement()} disabled={isSubmitting}>
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
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <span className="stat-number text-3xl text-accent-400">{config.baseReincrement}M</span>
            <span className="text-sm text-gray-500">uguale per tutti i manager</span>
            {!config.isFinalized && (
              <Button
                size="sm"
                variant="outline"
                className="ml-auto"
                onClick={() => { setEditingBaseReincrement(true) }}
              >
                Modifica
              </Button>
            )}
          </div>
        )}
      </StepCard>

      {/* Step 2 - Indemnities (decision zone) */}
      {hasIndemnityPlayers && (
        <StepCard
          num={2}
          title="Indennizzi · giocatori usciti"
          chipLabel={config.indemnityConsolidated ? 'Consolidati' : hasEsteroIndemnities ? 'Da consolidare' : 'Nessun estero'}
          chipKind={config.indemnityConsolidated ? 'ok' : hasEsteroIndemnities ? 'todo' : 'ok'}
          zone={step2NeedsAction}
          done={config.indemnityConsolidated}
        >
          <IndemnityTable
            members={members}
            getAmount={getIndemnityAmount}
            editable={!config.isFinalized && !config.indemnityConsolidated}
            savingPlayerId={savingIndemnity}
            onAmountChange={(playerId, newAmount) => { void handleIndemnityChange(playerId, newAmount) }}
          />

          {!config.indemnityConsolidated && !config.isFinalized && hasEsteroIndemnities && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-4 pt-4 border-t border-surface-50/20">
              <p className="text-sm text-accent-400">
                Una volta consolidati, gli indennizzi non sono più modificabili.
              </p>
              <Button
                className="sm:ml-auto"
                onClick={() => void handleConsolidateIndemnities()}
                disabled={consolidatingIndemnities}
              >
                {consolidatingIndemnities ? 'Consolidamento...' : 'Consolida indennizzi'}
              </Button>
            </div>
          )}

          {config.indemnityConsolidated && (
            <p className="text-sm text-secondary-400 mt-4 pt-4 border-t border-surface-50/20">
              Indennizzi consolidati il{' '}
              {config.indemnityConsolidatedAt
                ? new Date(config.indemnityConsolidatedAt).toLocaleString('it-IT')
                : '-'}
            </p>
          )}
        </StepCard>
      )}

      {/* Step 3 - Prize assignment */}
      <StepCard
        num={3}
        title="Assegnazione premi"
        chipLabel={totalCategories > 0 ? `${assignedCategories}/${totalCategories} categorie` : 'Nessuna categoria'}
        chipKind={step3Status === 'done' ? 'ok' : 'todo'}
        done={step3Status === 'done'}
      >
        <PrizeAssignmentTable
          members={members}
          categories={regularCategories}
          isFinalized={config.isFinalized}
          showIndemnities={showIndemnities}
          getPrizeAmount={getPrizeAmount}
          getIndemnityTotal={calculateMemberIndemnityTotal}
          getMemberTotal={calculateMemberTotal}
          onPrizeChange={(catId, memberId, value) => { void handleSavePrize(catId, memberId, value) }}
          onDeleteCategory={(catId) => { void handleDeleteCategory(catId) }}
        />

        {!config.isFinalized && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-4 pt-4 border-t border-surface-50/20">
            <Input
              value={newCategoryName}
              onChange={(e) => { setNewCategoryName(e.target.value) }}
              placeholder="Nome nuova categoria (es. Classifica Portieri)"
              className="flex-1"
            />
            <Button
              onClick={() => void handleCreateCategory()}
              disabled={!newCategoryName.trim() || isSubmitting}
            >
              + Categoria
            </Button>
          </div>
        )}
      </StepCard>

      {/* Step 4 - Finalize (decision zone) */}
      {!config.isFinalized && (
        <StepCard
          num={4}
          title="Finalizza fase premi"
          chipLabel={step4Available ? 'Pronto' : 'Bloccato'}
          chipKind={step4Available ? 'todo' : 'locked'}
          zone={step4Available}
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <p className="text-sm text-gray-400">
              {step4Available ? (
                <>
                  La finalizzazione accredita i premi ai budget dei manager ed è{' '}
                  <b className="text-danger-400">irreversibile</b>.
                </>
              ) : (
                <>
                  Per finalizzare devi prima{' '}
                  <b className="text-accent-400">consolidare gli indennizzi</b> (step 2). La
                  finalizzazione accredita i premi ai budget ed è{' '}
                  <b className="text-danger-400">irreversibile</b>.
                </>
              )}
            </p>
            <Button
              className="sm:ml-auto"
              onClick={() => void handleFinalize()}
              disabled={isSubmitting || !step4Available}
            >
              Finalizza premi
            </Button>
          </div>
        </StepCard>
      )}
    </div>
  )
}
