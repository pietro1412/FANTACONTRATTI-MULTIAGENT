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
import { computeBilancio } from '@/utils/finance'

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
  /** Monte ingaggi fissato all'ultimo consolidamento (LeagueMember.totalSalaries) — non live. */
  totalSalaries: number
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
  leagueId: string
  isAdmin: boolean
  onUpdate?: () => void
}

const DEFAULT_INDEMNITY = 50

export function PrizePhaseManager({ sessionId, leagueId, isAdmin, onUpdate }: PrizePhaseManagerProps) {
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
  const [addingCategory, setAddingCategory] = useState(false)
  const [editingBaseReincrement, setEditingBaseReincrement] = useState(false)
  const [baseReincrementValue, setBaseReincrementValue] = useState(100)

  // Custom indemnity amounts: { playerId: amount }
  const [customIndemnities, setCustomIndemnities] = useState<Record<string, number>>({})
  const [savingIndemnity, setSavingIndemnity] = useState<string | null>(null)
  const [consolidatingIndemnities, setConsolidatingIndemnities] = useState(false)

  // silent=true: refetch in background dopo un'azione (creazione/rinomina/eliminazione
  // categoria, finalizzazione, ecc.) senza smontare la UI con lo spinner di caricamento
  // pieno — quello resta riservato al primo ingresso in pagina. Se il refetch silenzioso
  // fallisce, i dati restano quelli precedenti (nessun banner d'errore): l'eventuale
  // fallimento dell'azione stessa è già segnalato dal toast del chiamante.
  const fetchData = useCallback(async (silent?: boolean) => {
    if (!silent) {
      setLoading(true)
      setLoadError(null)
    }
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
          } else if (!silent) {
            setLoadError(refreshResult.message || 'Errore inizializzazione')
          }
        } else if (!silent) {
          setLoadError('Fase premi non ancora inizializzata dall\'admin')
        }
      } else if (!silent) {
        setLoadError(result.message || 'Errore caricamento dati')
      }
    } catch {
      if (!silent) setLoadError('Errore di connessione')
    } finally {
      if (!silent) setLoading(false)
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
        toast.success(result.message || 'Re-incremento base aggiornato')
        void fetchData(true)
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
        setAddingCategory(false)
        toast.success('Premio aggiunto')
        void fetchData(true)
        onUpdate?.()
      } else {
        toast.error(result.message || 'Errore creazione premio')
      }
    } catch {
      toast.error('Errore di connessione')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRenameCategory = async (categoryId: string, newName: string) => {
    setIsSubmitting(true)
    try {
      const result = await prizePhaseApi.renameCategory(categoryId, newName)
      if (result.success) {
        toast.success('Premio rinominato')
        void fetchData(true)
        onUpdate?.()
      } else {
        toast.error(result.message || 'Errore rinomina premio')
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
        void fetchData(true)
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

  // Save a member prize, with optimistic local update. Prima della finalizzazione usa
  // setMemberPrize (nessun budget ancora accreditato); dopo, usa la correzione admin
  // (Bibbia MERCATO-RICORRENTE §4.5) che applica il delta al budget già accreditato —
  // l'admin può quindi aggiustare i premi per tutta la durata del mercato, non solo
  // prima della finalizzazione.
  const handleSavePrize = async (categoryId: string, memberId: string, value: number) => {
    if (value < 0) return
    const isFinalized = data?.config.isFinalized ?? false

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
      const result = isFinalized
        ? await prizePhaseApi.correctMemberPrize(leagueId, {
            marketSessionId: sessionId,
            categoryId,
            leagueMemberId: memberId,
            newAmount: value,
          })
        : await prizePhaseApi.setMemberPrize(categoryId, memberId, value)

      if (!result.success) {
        toast.error(result.message || 'Errore salvataggio premio')
        void fetchData(true)
      } else if (isFinalized) {
        // La correzione può aver cambiato il budget del manager: refetch silenzioso
        // per aggiornare Bilancio/Budget Tot. in tabella.
        void fetchData(true)
      }
    } catch {
      toast.error('Errore di connessione')
      void fetchData(true)
    }
  }

  const handleFinalize = async () => {
    const ok = await confirmDialog({
      title: 'Finalizza fase premi',
      message: 'I premi verranno accreditati sui budget dei manager. Potrai comunque correggere gli importi in seguito, ma non annullare la finalizzazione. Confermi?',
      confirmLabel: 'Finalizza',
      variant: 'warning'
    })
    if (!ok) return
    setIsSubmitting(true)
    try {
      const result = await prizePhaseApi.finalize(sessionId)
      if (result.success) {
        toast.success('Premi finalizzati e accreditati')
        void fetchData(true)
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
        void fetchData(true)
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

  // Quanto aggiungere al Bilancio attuale per il "Bilancio Tot." proiettato.
  // PRIMA della finalizzazione: nulla è stato ancora accreditato, quindi si proietta
  // l'intero pacchetto premi (= calculateMemberTotal, invariato).
  // DOPO la finalizzazione: base + premi normali sono GIÀ dentro il Bilancio attuale
  // (accreditati al finalize, eventuali correzioni li tengono allineati) — sommarli di
  // nuovo li conterebbe due volte. Resta da aggiungere solo l'eventuale indennizzo, MAI
  // accreditato dal finalize (pagato più avanti in Contratti al momento del RELEASE).
  const getBilancioIncrement = (memberId: string) => {
    if (!config.isFinalized) return calculateMemberTotal(memberId)
    return config.indemnityConsolidated ? calculateMemberIndemnityTotal(memberId) : 0
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
    const bilancioPre = myMember ? computeBilancio(myMember.currentBudget, myMember.totalSalaries) : 0
    // Stesso calcolo del "Bilancio Tot." in tabella admin (getBilancioIncrement): questa
    // stat compare SOLO a fase finalizzata, quindi va sempre il ramo "già accreditato"
    // (solo l'eventuale indennizzo va sommato, non base+premi normali già dentro bilancioPre).
    const bilancioIncrement = myMember ? getBilancioIncrement(myMember.id) : 0

    return (
      <div className="space-y-5">
        <PrizePhaseHeader
          title="I tuoi premi"
          subtitle="Premi e indennizzi accreditati al tuo bilancio per questa stagione."
          stats={[
            { label: 'Bilancio pre-premi', value: `${bilancioPre}M` },
            ...(config.isFinalized
              ? [{ label: 'Bilancio aggiornato', value: `${bilancioPre + bilancioIncrement}M`, gold: true }]
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
        {editingBaseReincrement ? (
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
            {/* Correggibile anche a fase finalizzata: il delta si applica al budget già
                accreditato a tutti i manager (vedi updateBaseReincrement). */}
            <Button
              size="sm"
              variant="outline"
              className="ml-auto"
              onClick={() => { setEditingBaseReincrement(true) }}
            >
              Modifica
            </Button>
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
            editable
            savingPlayerId={savingIndemnity}
            onAmountChange={(playerId, newAmount) => { void handleIndemnityChange(playerId, newAmount) }}
          />

          {!config.indemnityConsolidated && hasEsteroIndemnities && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-4 pt-4 border-t border-surface-50/20">
              <p className="text-sm text-accent-400">
                Il consolidamento crea le categorie premio individuali; gli importi restano comunque correggibili fino a fine mercato.
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
        headerAction={
          !config.isFinalized ? (
            addingCategory ? (
              <div className="flex items-center gap-2 ml-2">
                <Input
                  autoFocus
                  value={newCategoryName}
                  onChange={(e) => { setNewCategoryName(e.target.value) }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleCreateCategory()
                    if (e.key === 'Escape') { setAddingCategory(false); setNewCategoryName('') }
                  }}
                  placeholder="Nome premio"
                  inputSize="sm"
                  className="w-40"
                />
                <Button size="sm" onClick={() => void handleCreateCategory()} disabled={!newCategoryName.trim() || isSubmitting}>
                  Salva
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setAddingCategory(false); setNewCategoryName('') }}>
                  Annulla
                </Button>
              </div>
            ) : (
              <Button size="sm" className="ml-2" onClick={() => { setAddingCategory(true) }}>
                + Aggiungi Premio
              </Button>
            )
          ) : undefined
        }
      >
        <PrizeAssignmentTable
          members={members}
          categories={regularCategories}
          isFinalized={config.isFinalized}
          showIndemnities={showIndemnities}
          getPrizeAmount={getPrizeAmount}
          getIndemnityTotal={calculateMemberIndemnityTotal}
          getMemberTotal={calculateMemberTotal}
          getBilancioIncrement={getBilancioIncrement}
          onPrizeChange={(catId, memberId, value) => { void handleSavePrize(catId, memberId, value) }}
          onRenameCategory={(catId, name) => { void handleRenameCategory(catId, name) }}
          onDeleteCategory={(catId) => { void handleDeleteCategory(catId) }}
        />
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
                  <b className="text-danger-400">irreversibile</b>. Potrai comunque{' '}
                  <b className="text-accent-400">correggere gli importi</b> in seguito, fino alla fine del mercato.
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
