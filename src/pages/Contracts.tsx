import { useState, useEffect, useMemo } from 'react'
import { contractApi, leagueApi } from '@/services/api'
import { Navigation } from '@/components/Navigation'
import { CockpitShell } from '@/components/cockpit/CockpitShell'
import { Tabs } from '@/components/ui/Tabs'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonPlayerRow } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { useConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PlayerStatsModal, type PlayerInfo } from '@/components/PlayerStatsModal'
import { RenewalItem } from '@/components/contracts/RenewalItem'
import { PendingItem } from '@/components/contracts/PendingItem'
import { ExitedCard } from '@/components/contracts/ExitedCard'
import { RoleBadge, TeamLogo, getRoleStyle, getRoleAccentText, MAX_ROSTER_SIZE, type ContractPlayer } from '@/components/contracts/shared'
import haptic from '@/utils/haptics'

interface ContractsProps {
  leagueId: string
  onNavigate: (page: string, params?: Record<string, string>) => void
}

type Player = ContractPlayer

interface Contract {
  id: string
  salary: number
  duration: number
  initialSalary: number
  initialDuration: number
  rescissionClause: number
  canRenew: boolean
  canSpalmare: boolean
  // Draft values (saved but not consolidated)
  draftSalary: number | null
  draftDuration: number | null
  draftReleased: boolean
  draftExitDecision?: string | null  // null=INDECISO, "KEEP", "RELEASE"
  // Exited player info
  isExitedPlayer?: boolean
  exitReason?: string | null
  indemnityCompensation?: number
  wasModified?: boolean
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
  draftSalary: number | null
  draftDuration: number | null
}

interface ReleasedPlayer {
  id: string
  playerName: string
  playerTeam: string
  playerPosition: string
  salary: number
  duration: number
  releaseCost: number
  releaseType: string
  indemnityAmount?: number
}

// Local edit state for an in-progress contract change
interface LocalEdit {
  newSalary: string
  newDuration: string
  isModified: boolean
  previewData: {
    renewalCost?: number
    newRescissionClause?: number
    isValid: boolean
    validationError?: string
    canAfford?: boolean
  } | null
  isSaving: boolean
}

export function Contracts({ leagueId, onNavigate }: ContractsProps) {
  const { toast } = useToast()
  const { confirm } = useConfirmDialog()

  const [contracts, setContracts] = useState<Contract[]>([])
  const [pendingContracts, setPendingContracts] = useState<PendingContract[]>([])
  const [memberBudget, setMemberBudget] = useState(0)
  const [inContrattiPhase, setInContrattiPhase] = useState(false)
  const [isLeagueAdmin, setIsLeagueAdmin] = useState(false)
  const [isConsolidated, setIsConsolidated] = useState(false)
  const [releasedPlayers, setReleasedPlayers] = useState<ReleasedPlayer[]>([])
  const [, setConsolidatedAt] = useState<string | null>(null)
  const [_apiRenewalCost, setApiRenewalCost] = useState(0)
  const [isConsolidating, setIsConsolidating] = useState(false)
  const [isSavingDrafts, setIsSavingDrafts] = useState(false)
  const [leagueName, setLeagueName] = useState('')
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null)

  const [localEdits, setLocalEdits] = useState<Record<string, LocalEdit>>({})
  const [pendingEdits, setPendingEdits] = useState<Record<string, LocalEdit>>({})
  const [localReleases, setLocalReleases] = useState<Set<string>>(new Set())
  const [exitDecisions, setExitDecisions] = useState<Map<string, 'KEEP' | 'RELEASE'>>(new Map())

  const [isLoading, setIsLoading] = useState(true)

  const [filterRole, setFilterRole] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const [contractTab, setContractTab] = useState<'rinnovi' | 'nuovi' | 'usciti'>('rinnovi')

  const [selectedPlayer, setSelectedPlayer] = useState<PlayerInfo | null>(null)
  const [tabInitialized, setTabInitialized] = useState(false)
  const [showRules, setShowRules] = useState(false)

  useEffect(() => {
    void loadData()
  }, [leagueId])

  async function loadData() {
    const leagueResponse = await leagueApi.getById(leagueId)
    if (leagueResponse.success && leagueResponse.data) {
      const data = leagueResponse.data as { name?: string; userMembership?: { role: string } }
      setIsLeagueAdmin(data.userMembership?.role === 'ADMIN')
      if (data.name) setLeagueName(data.name)
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

  async function loadContracts() {
    const result = await contractApi.getAll(leagueId)
    if (result.success && result.data) {
      const data = result.data as {
        contracts: Contract[]
        pendingContracts: PendingContract[]
        releasedPlayers?: ReleasedPlayer[]
        memberBudget: number
        inContrattiPhase: boolean
        isConsolidated?: boolean
        totalRenewalCost?: number
      }
      setContracts(data.contracts)
      setPendingContracts(data.pendingContracts)
      setReleasedPlayers(data.releasedPlayers || [])
      setMemberBudget(data.memberBudget)
      setInContrattiPhase(data.inContrattiPhase)
      setApiRenewalCost(data.totalRenewalCost || 0)
      if (data.isConsolidated !== undefined) {
        setIsConsolidated(data.isConsolidated)
      }

      const edits: Record<string, LocalEdit> = {}
      data.contracts.forEach(c => {
        const hasDraft = c.draftSalary !== null && c.draftDuration !== null
        edits[c.id] = {
          newSalary: hasDraft ? String(c.draftSalary) : String(c.salary),
          newDuration: hasDraft ? String(c.draftDuration) : String(c.duration),
          isModified: hasDraft,
          previewData: null,
          isSaving: false,
        }
      })
      setLocalEdits(edits)

      const pEdits: Record<string, LocalEdit> = {}
      data.pendingContracts.forEach(p => {
        const hasDraft = p.draftSalary !== null && p.draftDuration !== null
        pEdits[p.rosterId] = {
          newSalary: hasDraft ? String(p.draftSalary) : String(p.minSalary),
          newDuration: hasDraft ? String(p.draftDuration) : '2',
          isModified: hasDraft,
          previewData: null,
          isSaving: false,
        }
      })
      setPendingEdits(pEdits)

      const exitDec = new Map<string, 'KEEP' | 'RELEASE'>()
      data.contracts.forEach(c => {
        if (c.isExitedPlayer && c.draftExitDecision) {
          exitDec.set(c.id, c.draftExitDecision as 'KEEP' | 'RELEASE')
        }
      })
      setExitDecisions(exitDec)

      const releases = new Set<string>()
      data.contracts.forEach(c => {
        if (c.draftReleased && !c.isExitedPlayer) {
          releases.add(c.id)
        }
      })
      setLocalReleases(releases)

      if (!tabInitialized) {
        if (data.pendingContracts.length > 0) {
          setContractTab('nuovi')
        } else {
          const hasUndecidedExited = data.contracts.some(c => c.isExitedPlayer && !c.draftExitDecision)
          setContractTab(hasUndecidedExited ? 'usciti' : 'rinnovi')
        }
        setTabInitialized(true)
      }
    }
    setIsLoading(false)
  }

  function updateLocalEdit(contractId: string, field: 'newSalary' | 'newDuration', value: string) {
    setLocalEdits(prev => {
      const existing = prev[contractId] ?? { newSalary: '', newDuration: '', isModified: false, previewData: null, isSaving: false }
      return { ...prev, [contractId]: { ...existing, [field]: value, isModified: true } }
    })
  }

  function updatePendingEdit(rosterId: string, field: 'newSalary' | 'newDuration', value: string) {
    setPendingEdits(prev => {
      const existing = prev[rosterId] ?? { newSalary: '', newDuration: '', isModified: false, previewData: null, isSaving: false }
      return { ...prev, [rosterId]: { ...existing, [field]: value, isModified: true } }
    })
  }

  async function calculatePreview(contractId: string) {
    const edit = localEdits[contractId]
    if (!edit) return
    const salary = parseInt(edit.newSalary)
    const duration = parseInt(edit.newDuration)
    if (isNaN(salary) || isNaN(duration)) return
    const result = await contractApi.preview(contractId, salary, duration)
    if (result.success && result.data) {
      setLocalEdits(prev => {
        const existing = prev[contractId]
        if (!existing) return prev
        return { ...prev, [contractId]: { ...existing, previewData: result.data as LocalEdit['previewData'] } }
      })
    }
  }

  async function calculatePendingPreview(rosterId: string) {
    const edit = pendingEdits[rosterId]
    if (!edit) return
    const salary = parseInt(edit.newSalary)
    const duration = parseInt(edit.newDuration)
    if (isNaN(salary) || isNaN(duration)) return
    const result = await contractApi.previewCreate(rosterId, salary, duration)
    if (result.success && result.data) {
      setPendingEdits(prev => {
        const existing = prev[rosterId]
        if (!existing) return prev
        return { ...prev, [rosterId]: { ...existing, previewData: result.data as LocalEdit['previewData'] } }
      })
    }
  }

  useEffect(() => {
    const timeouts: NodeJS.Timeout[] = []
    Object.entries(localEdits).forEach(([contractId, edit]) => {
      if (edit.isModified) {
        const timeout = setTimeout(() => { void calculatePreview(contractId) }, 300)
        timeouts.push(timeout)
      }
    })
    return () => { timeouts.forEach(t => { clearTimeout(t); }); }
  }, [localEdits])

  useEffect(() => {
    const timeouts: NodeJS.Timeout[] = []
    Object.entries(pendingEdits).forEach(([rosterId, edit]) => {
      if (!edit.previewData || edit.isModified) {
        const timeout = setTimeout(() => { void calculatePendingPreview(rosterId) }, 300)
        timeouts.push(timeout)
      }
    })
    return () => { timeouts.forEach(t => { clearTimeout(t); }); }
  }, [pendingEdits])

  function toggleRelease(contractId: string) {
    setLocalReleases(prev => {
      const newSet = new Set(prev)
      if (newSet.has(contractId)) newSet.delete(contractId)
      else newSet.add(contractId)
      return newSet
    })
  }

  async function handleSaveDrafts() {
    setIsSavingDrafts(true)

    const renewals: { contractId: string; salary: number; duration: number }[] = []
    Object.entries(localEdits).forEach(([contractId, edit]) => {
      const contract = contracts.find(c => c.id === contractId)
      if (!contract || !contract.canRenew) return
      const newSalary = parseInt(edit.newSalary)
      const newDuration = parseInt(edit.newDuration)
      if (isNaN(newSalary) || isNaN(newDuration) || newSalary <= 0 || newDuration <= 0) return
      const savedSalary = contract.draftSalary ?? contract.salary
      const savedDuration = contract.draftDuration ?? contract.duration
      if (newSalary !== savedSalary || newDuration !== savedDuration) {
        renewals.push({ contractId, salary: newSalary, duration: newDuration })
      }
    })

    const newContracts: { rosterId: string; salary: number; duration: number }[] = []
    Object.entries(pendingEdits).forEach(([rosterId, edit]) => {
      const salary = parseInt(edit.newSalary)
      const duration = parseInt(edit.newDuration)
      if (!isNaN(salary) && !isNaN(duration) && salary > 0) {
        newContracts.push({ rosterId, salary, duration })
      }
    })

    const exitDecisionsArray = Array.from(exitDecisions.entries()).map(([contractId, decision]) => ({ contractId, decision }))
    const result = await contractApi.saveDrafts(leagueId, renewals, newContracts, Array.from(localReleases), exitDecisionsArray)
    if (result.success) {
      haptic.save()
      setDraftSavedAt(new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }))
      toast.success('Bozze salvate! Puoi tornare a modificarle in qualsiasi momento.')
      await loadContracts()
    } else {
      toast.error(result.message || 'Errore nel salvataggio')
    }
    setIsSavingDrafts(false)
  }

  async function handleConsolidate() {
    const confirmed = await confirm({
      title: 'Consolidare i contratti?',
      message: 'Il consolidamento è definitivo: rinnovi, tagli e decisioni sugli usciti verranno applicati e non saranno più modificabili.',
      confirmLabel: 'Consolida',
      cancelLabel: 'Annulla',
      variant: 'warning',
    })
    if (!confirmed) return

    setIsConsolidating(true)

    const renewals: { contractId: string; salary: number; duration: number }[] = []
    Object.entries(localEdits).forEach(([contractId, edit]) => {
      const contract = contracts.find(c => c.id === contractId)
      if (!contract || !contract.canRenew) return
      const newSalary = parseInt(edit.newSalary)
      const newDuration = parseInt(edit.newDuration)
      if (newSalary !== contract.salary || newDuration !== contract.duration) {
        if (edit.previewData?.isValid && edit.previewData?.canAfford) {
          renewals.push({ contractId, salary: newSalary, duration: newDuration })
        }
      }
    })

    const newContracts: { rosterId: string; salary: number; duration: number }[] = []
    Object.entries(pendingEdits).forEach(([rosterId, edit]) => {
      if (edit.previewData?.isValid) {
        newContracts.push({ rosterId, salary: parseInt(edit.newSalary), duration: parseInt(edit.newDuration) })
      }
    })

    const result = await contractApi.consolidateAll(leagueId, renewals, newContracts)
    if (result.success) {
      haptic.success()
      toast.success(result.message || 'Contratti consolidati!')
      setIsConsolidated(true)
      const data = result.data as { consolidatedAt?: string }
      if (data?.consolidatedAt) setConsolidatedAt(data.consolidatedAt)
      await loadContracts()
    } else {
      toast.error(result.message || 'Errore nel consolidamento')
    }
    setIsConsolidating(false)
  }

  // ===== Derived values (unchanged business logic) =====

  const projectedSalaries = useMemo(() => {
    let total = 0
    contracts.forEach(contract => {
      if (localReleases.has(contract.id)) return
      if (contract.isExitedPlayer && exitDecisions.get(contract.id) !== 'KEEP') return
      const edit = localEdits[contract.id]
      const salary = parseInt(edit?.newSalary || '') || contract.salary
      total += salary
    })
    pendingContracts.forEach(pending => {
      const edit = pendingEdits[pending.rosterId]
      const salaryStr = edit?.newSalary && edit.newSalary.length > 0
        ? edit.newSalary
        : String(pending.draftSalary ?? pending.minSalary)
      total += parseInt(salaryStr) || pending.minSalary
    })
    return total
  }, [contracts, pendingContracts, localEdits, pendingEdits, localReleases, exitDecisions])

  const totalReleaseCost = useMemo(() => {
    if (isConsolidated && releasedPlayers.length > 0) {
      return releasedPlayers.reduce((sum, rp) => sum + rp.releaseCost, 0)
    }
    let total = 0
    contracts.forEach(contract => {
      if (localReleases.has(contract.id) && !contract.isExitedPlayer) {
        total += Math.ceil((contract.salary * contract.duration) / 2)
      }
    })
    return total
  }, [contracts, localReleases, isConsolidated, releasedPlayers])

  const totalIndemnities = useMemo(() => {
    if (isConsolidated && releasedPlayers.length > 0) {
      return releasedPlayers
        .filter(rp => rp.releaseType === 'RELEASE_ESTERO' && rp.indemnityAmount)
        .reduce((sum, rp) => sum + (rp.indemnityAmount || 0), 0)
    }
    let total = 0
    contracts.forEach(contract => {
      if (contract.isExitedPlayer && contract.exitReason === 'ESTERO' && exitDecisions.get(contract.id) === 'RELEASE') {
        total += contract.indemnityCompensation || 0
      }
    })
    return total
  }, [contracts, exitDecisions, isConsolidated, releasedPlayers])

  const residuoContratti = useMemo(() => {
    return memberBudget - projectedSalaries - totalReleaseCost + totalIndemnities
  }, [memberBudget, projectedSalaries, totalReleaseCost, totalIndemnities, localReleases, exitDecisions])

  const effectivePlayerCount = useMemo(() => {
    const totalPlayers = contracts.length + pendingContracts.length
    const releasedCount = localReleases.size
    const exitReleasedCount = Array.from(exitDecisions.values()).filter(d => d === 'RELEASE').length
    return totalPlayers - releasedCount - exitReleasedCount
  }, [contracts.length, pendingContracts.length, localReleases.size, exitDecisions])

  const requiredReleases = useMemo(() => {
    return Math.max(0, effectivePlayerCount - MAX_ROSTER_SIZE)
  }, [effectivePlayerCount])

  const canConsolidate = useMemo(() => {
    const undecidedExited = contracts.filter(c => c.isExitedPlayer && !exitDecisions.has(c.id))
    if (undecidedExited.length > 0) return false
    if (effectivePlayerCount > MAX_ROSTER_SIZE) return false
    for (const pending of pendingContracts) {
      const edit = pendingEdits[pending.rosterId]
      if (!edit || !edit.previewData?.isValid) return false
    }
    for (const contract of contracts) {
      if (!contract.canRenew) continue
      const edit = localEdits[contract.id]
      if (!edit) continue
      const newSalary = parseInt(edit.newSalary) || contract.salary
      const newDuration = parseInt(edit.newDuration) || contract.duration
      const hasChanges = newSalary !== contract.salary || newDuration !== contract.duration
      if (hasChanges && edit.previewData?.validationError) return false
    }
    return true
  }, [pendingContracts, pendingEdits, effectivePlayerCount, contracts, localEdits, exitDecisions])

  const consolidateBlockReason = useMemo(() => {
    const undecidedExitedCount = contracts.filter(c => c.isExitedPlayer && !exitDecisions.has(c.id)).length
    if (undecidedExitedCount > 0) {
      return `Decidi per ${undecidedExitedCount} giocator${undecidedExitedCount === 1 ? 'e uscito' : 'i usciti'}`
    }
    if (effectivePlayerCount > MAX_ROSTER_SIZE) {
      return `Devi tagliare ${requiredReleases} giocator${requiredReleases === 1 ? 'e' : 'i'} (max ${MAX_ROSTER_SIZE})`
    }
    for (const pending of pendingContracts) {
      const edit = pendingEdits[pending.rosterId]
      if (!edit || !edit.previewData?.isValid) return 'Imposta tutti i nuovi contratti'
    }
    for (const contract of contracts) {
      if (!contract.canRenew) continue
      const edit = localEdits[contract.id]
      if (!edit) continue
      const newSalary = parseInt(edit.newSalary) || contract.salary
      const newDuration = parseInt(edit.newDuration) || contract.duration
      const hasChanges = newSalary !== contract.salary || newDuration !== contract.duration
      if (hasChanges && edit.previewData?.validationError) {
        return `Errore di validazione: ${edit.previewData.validationError}`
      }
    }
    return 'Conferma definitiva dei rinnovi'
  }, [pendingContracts, pendingEdits, effectivePlayerCount, requiredReleases, contracts, localEdits, exitDecisions])

  const exitedContracts = useMemo(() =>
    contracts.filter(c => c.isExitedPlayer && !exitDecisions.has(c.id)),
  [contracts, exitDecisions])

  const filteredContracts = useMemo(() => {
    let items = contracts.filter(c => !c.isExitedPlayer || exitDecisions.get(c.id) === 'KEEP')
    if (filterRole) items = items.filter(c => c.roster.player.position === filterRole)
    if (searchQuery) items = items.filter(c => c.roster.player.name.toLowerCase().includes(searchQuery.toLowerCase()))
    return items.sort((a, b) => {
      const roleOrder = { P: 0, D: 1, C: 2, A: 3 }
      const ra = roleOrder[a.roster.player.position as keyof typeof roleOrder] ?? 4
      const rb = roleOrder[b.roster.player.position as keyof typeof roleOrder] ?? 4
      if (ra !== rb) return ra - rb
      return a.roster.player.name.localeCompare(b.roster.player.name)
    })
  }, [contracts, exitDecisions, filterRole, searchQuery])

  const filteredPending = useMemo(() => {
    let items = [...pendingContracts]
    if (filterRole) items = items.filter(p => p.player.position === filterRole)
    if (searchQuery) items = items.filter(p => p.player.name.toLowerCase().includes(searchQuery.toLowerCase()))
    return items.sort((a, b) => {
      const roleOrder = { P: 0, D: 1, C: 2, A: 3 }
      const ra = roleOrder[a.player.position as keyof typeof roleOrder] ?? 4
      const rb = roleOrder[b.player.position as keyof typeof roleOrder] ?? 4
      if (ra !== rb) return ra - rb
      return a.player.name.localeCompare(b.player.name)
    })
  }, [pendingContracts, filterRole, searchQuery])

  const filteredExited = useMemo(() => {
    let items = [...exitedContracts]
    if (filterRole) items = items.filter(c => c.roster.player.position === filterRole)
    if (searchQuery) items = items.filter(c => c.roster.player.name.toLowerCase().includes(searchQuery.toLowerCase()))
    return items
  }, [exitedContracts, filterRole, searchQuery])

  const roleDistribution = useMemo(() => {
    const dist = { P: 0, D: 0, C: 0, A: 0 }
    contracts.forEach(c => {
      if (localReleases.has(c.id)) return
      if (c.isExitedPlayer && exitDecisions.get(c.id) !== 'KEEP') return
      const role = c.roster.player.position as keyof typeof dist
      if (role in dist) dist[role]++
    })
    pendingContracts.forEach(p => {
      const role = p.player.position as keyof typeof dist
      if (role in dist) dist[role]++
    })
    return dist
  }, [contracts, pendingContracts, localReleases, exitDecisions])

  const hasUnsavedChanges = useMemo(() => {
    for (const contract of contracts) {
      const edit = localEdits[contract.id]
      if (!edit) continue
      const savedSalary = contract.draftSalary ?? contract.salary
      const savedDuration = contract.draftDuration ?? contract.duration
      const currentSalary = parseInt(edit.newSalary) || contract.salary
      const currentDuration = parseInt(edit.newDuration) || contract.duration
      if (currentSalary !== savedSalary || currentDuration !== savedDuration) return true
    }
    for (const pending of pendingContracts) {
      const edit = pendingEdits[pending.rosterId]
      if (!edit) continue
      const savedSalary = pending.draftSalary ?? pending.minSalary
      const savedDuration = pending.draftDuration ?? 2
      const currentSalary = parseInt(edit.newSalary) || pending.minSalary
      const currentDuration = parseInt(edit.newDuration) || 2
      if (currentSalary !== savedSalary || currentDuration !== savedDuration) return true
    }
    for (const contract of contracts) {
      if (contract.isExitedPlayer) continue
      if (localReleases.has(contract.id) !== contract.draftReleased) return true
    }
    for (const contract of contracts) {
      if (!contract.isExitedPlayer) continue
      const currentDecision = exitDecisions.get(contract.id) || null
      const savedDecision = contract.draftExitDecision || null
      if (currentDecision !== savedDecision) return true
    }
    return false
  }, [contracts, pendingContracts, localEdits, pendingEdits, localReleases, exitDecisions])

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges && inContrattiPhase && !isConsolidated) e.preventDefault()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => { window.removeEventListener('beforeunload', handleBeforeUnload); }
  }, [hasUnsavedChanges, inContrattiPhase, isConsolidated])

  const salaryStats = useMemo(() => {
    const salaries: number[] = []
    contracts.forEach(c => {
      if (localReleases.has(c.id)) return
      if (c.isExitedPlayer && exitDecisions.get(c.id) !== 'KEEP') return
      const edit = localEdits[c.id]
      salaries.push(parseInt(edit?.newSalary || '') || c.salary)
    })
    pendingContracts.forEach(p => {
      const edit = pendingEdits[p.rosterId]
      salaries.push(parseInt(edit?.newSalary || '') || p.minSalary)
    })
    if (salaries.length === 0) return { min: 0, max: 0, avg: 0, total: 0 }
    const total = salaries.reduce((a, b) => a + b, 0)
    return {
      min: Math.min(...salaries),
      max: Math.max(...salaries),
      avg: Math.round(total / salaries.length * 10) / 10,
      total,
    }
  }, [contracts, pendingContracts, localEdits, pendingEdits, localReleases, exitDecisions])

  // ===== Loading =====
  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Navigation currentPage="contracts" leagueId={leagueId} isLeagueAdmin={isLeagueAdmin} onNavigate={onNavigate} />
        <div className="max-w-[1100px] mx-auto px-4 py-6 space-y-2">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonPlayerRow key={i} />)}
        </div>
      </div>
    )
  }

  const slotWarn = requiredReleases > 0
  const gateReady = canConsolidate

  // ===== Cockpit testata =====
  const header = (
    <div className="bg-surface-200 border border-surface-50 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap min-h-[56px]">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-500 to-accent-700 flex items-center justify-center flex-shrink-0">
        <svg className="w-5 h-5 text-dark-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      </div>
      <div className="flex flex-col min-w-0">
        <h1 className="font-display font-bold text-sm sm:text-base text-white leading-tight truncate">Gestione Contratti</h1>
        <span className="text-sm text-gray-500 leading-tight truncate">
          {inContrattiPhase
            ? <span className="text-secondary-400">Fase CONTRATTI attiva</span>
            : <span className="text-warning-400">Fase non attiva</span>
          }
          {leagueName ? ` · ${leagueName}` : ''}
        </span>
      </div>

      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-[10.5px] font-bold tracking-[0.06em] border text-accent-400 bg-accent-500/10 border-accent-500/50">
        <span className="dot-live bg-accent-400" /> Fase Contratti
      </span>

      <div className="ml-auto flex items-center gap-3 sm:gap-4">
        <div className="text-right">
          <div className="micro-label text-[9px]">Slot</div>
          <div className={`budget-display text-lg sm:text-xl leading-tight ${slotWarn ? 'text-danger-400' : 'text-white'}`}>
            {effectivePlayerCount}<span className="text-xs text-gray-500">/{MAX_ROSTER_SIZE}</span>
          </div>
        </div>
        <div className="w-px h-7 bg-surface-50" />
        <div className="text-right">
          <div className="micro-label text-[9px]">Budget</div>
          <div className="budget-display text-lg sm:text-xl text-accent-400 leading-tight">{memberBudget}<span className="text-xs text-gray-500">M</span></div>
        </div>
        <div className="hidden sm:block w-px h-7 bg-surface-50" />
        <div className="hidden sm:block text-right">
          <div className="micro-label text-[9px]">Ingaggi</div>
          <div className="budget-display text-lg sm:text-xl text-white leading-tight">{projectedSalaries}<span className="text-xs text-gray-500">M</span></div>
        </div>
        <div className="hidden md:block w-px h-7 bg-surface-50" />
        <div className="hidden md:block text-right">
          <div className="micro-label text-[9px]">Residuo</div>
          <div className={`budget-display text-lg sm:text-xl leading-tight ${residuoContratti < 0 ? 'text-danger-400' : 'text-secondary-400'}`}>
            {residuoContratti >= 0 ? '+' : ''}{residuoContratti}<span className="text-xs text-gray-500">M</span>
          </div>
        </div>
      </div>
    </div>
  )

  // ===== Cockpit barra tab + filtri =====
  const tabItems = [
    { id: 'rinnovi' as const, label: 'Rinnovi', accent: 'accent' as const, badge: filteredContracts.length },
    ...(filteredPending.length > 0 || isConsolidated ? [{ id: 'nuovi' as const, label: 'Nuovi', accent: 'secondary' as const, badge: filteredPending.length }] : []),
    ...(exitedContracts.length > 0 ? [{ id: 'usciti' as const, label: 'Usciti', accent: 'gray' as const, badge: exitedContracts.length }] : []),
  ]

  const adminBar = (
    <div className="mt-2 flex items-center gap-3 flex-wrap">
      <Tabs
        className="flex-1 min-w-0"
        ariaLabel="Sezioni contratti"
        value={contractTab}
        onChange={(id) => { setContractTab(id as typeof contractTab); }}
        tabs={tabItems}
      />
      <div className="flex items-center gap-2 flex-shrink-0">
        <input
          type="text"
          value={searchQuery}
          onChange={e => { setSearchQuery(e.target.value); }}
          placeholder="Cerca..."
          inputMode="search"
          enterKeyHint="search"
          className="w-28 sm:w-36 px-3 py-1.5 bg-surface-300 border border-surface-50 rounded-lg text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-accent-500/50"
        />
        <select
          value={filterRole}
          onChange={e => { setFilterRole(e.target.value); }}
          aria-label="Filtra per ruolo"
          className="px-2 py-1.5 bg-surface-300 border border-surface-50 rounded-lg text-white text-sm focus:outline-none focus:border-accent-500/50"
        >
          <option value="">Tutti</option>
          <option value="P">P</option>
          <option value="D">D</option>
          <option value="C">C</option>
          <option value="A">A</option>
        </select>
      </div>
    </div>
  )

  // ===== Gate row (sopra il main) =====
  const gate = inContrattiPhase && !isConsolidated ? (
    <div
      className={`mt-2.5 flex items-center gap-3 rounded-xl border px-3.5 py-2.5 flex-wrap ${
        gateReady ? 'border-secondary-500/45 bg-secondary-500/[0.06]' : 'border-danger-500/45 bg-danger-500/[0.06]'
      }`}
    >
      <span className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold ${
        gateReady ? 'bg-secondary-500/20 text-secondary-400' : 'bg-danger-500/20 text-danger-400'
      }`}>
        {gateReady ? '✓' : '✕'}
      </span>
      <div className="min-w-0">
        <div className={`text-sm font-semibold ${gateReady ? 'text-secondary-400' : 'text-danger-400'}`}>
          {gateReady ? 'Tutto pronto per consolidare' : `Non puoi ancora consolidare: ${consolidateBlockReason.toLowerCase()}`}
        </div>
        <div className="text-[11px] text-gray-500 mt-0.5">
          {gateReady
            ? 'Il consolidamento è definitivo. Puoi ancora salvare la bozza.'
            : 'Risolvi il blocco per sbloccare il consolidamento.'}
        </div>
      </div>
      <div className="ml-auto flex items-center gap-2.5">
        {draftSavedAt && !hasUnsavedChanges && (
          <span className="hidden sm:inline-flex items-center gap-1.5 font-mono text-[10px] font-bold text-secondary-400">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary-400" /> bozza salvata {draftSavedAt}
          </span>
        )}
        {hasUnsavedChanges && (
          <span className="hidden sm:inline-flex items-center gap-1.5 font-mono text-[10px] font-bold text-warning-400">
            <span className="w-1.5 h-1.5 rounded-full bg-warning-400 animate-pulse" /> da salvare
          </span>
        )}
        <button
          type="button"
          onClick={() => void handleSaveDrafts()}
          disabled={isSavingDrafts}
          className="text-sm font-semibold text-white bg-surface-300 border border-surface-50 rounded-lg px-4 py-2 hover:bg-surface-100 disabled:opacity-50 transition-colors"
        >
          {isSavingDrafts ? 'Salvando...' : 'Salva bozza'}
        </button>
        <button
          type="button"
          onClick={() => void handleConsolidate()}
          disabled={isConsolidating || !canConsolidate}
          title={!canConsolidate ? consolidateBlockReason : undefined}
          className={`font-display font-extrabold text-sm tracking-[0.03em] uppercase rounded-lg px-5 py-2 transition-all ${
            canConsolidate && !isConsolidating
              ? 'text-dark-300 bg-gradient-to-b from-secondary-400 to-secondary-500 shadow-[0_6px_22px_rgba(34,197,94,0.30)] hover:brightness-110'
              : 'text-gray-500 bg-surface-100 cursor-not-allowed'
          }`}
        >
          {isConsolidating ? 'Consolidando...' : 'Consolida'}
        </button>
      </div>
    </div>
  ) : isConsolidated ? (
    <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-secondary-500/45 bg-secondary-500/[0.06] px-3.5 py-2.5">
      <span className="w-6 h-6 rounded-lg bg-secondary-500/20 text-secondary-400 flex items-center justify-center text-sm font-bold">✓</span>
      <span className="text-sm font-semibold text-secondary-400">Contratti consolidati</span>
    </div>
  ) : null

  // ===== Sidebar stats =====
  const sidebar = (
    <div className="flex flex-col gap-3 lg:overflow-y-auto lg:min-h-0">
      {/* Residuo */}
      <div className="bg-gradient-to-br from-secondary-500/10 to-secondary-500/[0.03] border border-secondary-500/35 rounded-2xl p-4">
        <div className="micro-label mb-2.5">Residuo dopo consolidamento</div>
        <div className="text-[11px] text-gray-400 leading-relaxed space-y-0.5">
          <div className="flex justify-between">Budget <span className="font-mono text-white">{memberBudget}M</span></div>
          <div className="flex justify-between">− Ingaggi annui <span className="font-mono text-white">{projectedSalaries}M</span></div>
          <div className="flex justify-between">+ Recupero tagli <span className="font-mono text-white">{totalReleaseCost}M</span></div>
          {totalIndemnities > 0 && <div className="flex justify-between">− Indennizzi <span className="font-mono text-white">{totalIndemnities}M</span></div>}
        </div>
        <div className="flex items-baseline justify-between mt-3 pt-3 border-t border-secondary-500/25">
          <span className="micro-label text-secondary-400">Residuo</span>
          <span className={`stat-number text-2xl ${residuoContratti < 0 ? 'text-danger-400' : 'text-secondary-400'}`}>
            {residuoContratti >= 0 ? '+' : ''}{residuoContratti}M
          </span>
        </div>
      </div>

      {/* Per consolidare (checklist) */}
      {inContrattiPhase && !isConsolidated && (
        <div className="bg-surface-200 border border-surface-50 rounded-2xl p-4">
          <div className="micro-label mb-3">Per consolidare</div>
          <div className="flex flex-col gap-2.5">
            <ChecklistRow ok={effectivePlayerCount <= MAX_ROSTER_SIZE} label="Rientra negli slot" value={`${effectivePlayerCount}/${MAX_ROSTER_SIZE}`} />
            <ChecklistRow ok={exitedContracts.length === 0} label="Decidi gli usciti" value={exitedContracts.length === 0 ? 'fatto' : `${exitedContracts.length} da fare`} />
            <ChecklistRow ok={residuoContratti >= 0} label="Budget non negativo" value={`${residuoContratti >= 0 ? '+' : ''}${residuoContratti}M`} />
          </div>
        </div>
      )}

      {/* Composizione rosa */}
      <div className="bg-surface-200 border border-surface-50 rounded-2xl p-4">
        <div className="micro-label mb-3">Composizione rosa · {effectivePlayerCount}/{MAX_ROSTER_SIZE}</div>
        <div className="flex flex-col gap-2.5">
          {(['P', 'D', 'C', 'A'] as const).map(role => {
            const count = roleDistribution[role]
            const maxCount = Math.max(...Object.values(roleDistribution), 1)
            const style = getRoleStyle(role)
            return (
              <div key={role} className="flex items-center gap-2.5">
                <span className={`w-5 font-display font-extrabold text-xs ${getRoleAccentText(role)}`}>{role}</span>
                <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden">
                  <div className={`h-full rounded-full ${style.bg}`} style={{ width: `${(count / maxCount) * 100}%` }} />
                </div>
                <span className="font-mono text-[11px] font-bold text-gray-400 w-7 text-right">{count}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Ingaggi */}
      <div className="bg-surface-200 border border-surface-50 rounded-2xl p-4">
        <div className="micro-label mb-3">Ingaggi rosa</div>
        <div className="grid grid-cols-2 gap-2.5">
          <IngStat label="Minimo" value={`${salaryStats.min}M`} />
          <IngStat label="Massimo" value={`${salaryStats.max}M`} />
          <IngStat label="Media" value={`${salaryStats.avg}M`} />
          <IngStat label="Totale" value={`${salaryStats.total}M`} />
        </div>
      </div>
    </div>
  )

  // ===== Tab content =====
  const tableHeader = (
    <div className="hidden lg:grid grid-cols-[minmax(0,1fr)_112px_132px_118px_96px_92px] gap-2.5 px-4 py-2 border-b border-surface-50 bg-surface-300 flex-shrink-0">
      <span className="micro-label">Giocatore</span>
      <span className="micro-label text-right">Contratto attuale</span>
      <span className="micro-label text-center">Nuovo ingaggio</span>
      <span className="micro-label text-center">Durata</span>
      <span className="micro-label text-right">Clausola</span>
      <span className="micro-label text-center">Azione</span>
    </div>
  )

  const activeIsRinnovi = contractTab === 'rinnovi' || isConsolidated || !inContrattiPhase
  const activeIsNuovi = contractTab === 'nuovi'
  const activeIsUsciti = contractTab === 'usciti'

  let panel: React.ReactNode
  if (activeIsUsciti) {
    panel = (
      <div className="bg-surface-200 border border-surface-50 rounded-xl overflow-hidden flex flex-col lg:h-full lg:min-h-0">
        <div className="px-4 py-2.5 border-b border-surface-50 flex items-baseline gap-2 flex-shrink-0">
          <span className="micro-label">Giocatori usciti · estero e retrocessione</span>
          <span className="ml-auto font-mono text-[10.5px] text-gray-500">{filteredExited.length} da decidere</span>
        </div>
        {filteredExited.length === 0 ? (
          <div className="py-8"><EmptyState icon="✅" title="Nessun giocatore uscito da decidere" description="Le decisioni KEEP/RELEASE compaiono qui" /></div>
        ) : (
          <div className="panel-scroll flex-1 min-h-0 p-3 grid grid-cols-1 xl:grid-cols-2 gap-3 content-start">
            {filteredExited.map(c => (
              <ExitedCard
                key={c.id}
                player={c.roster.player}
                exitReason={c.exitReason}
                salary={c.salary}
                duration={c.duration}
                indemnityCompensation={c.indemnityCompensation || 0}
                decision={exitDecisions.get(c.id)}
                inContrattiPhase={inContrattiPhase}
                isConsolidated={isConsolidated}
                onKeep={() => { setExitDecisions(prev => { const next = new Map(prev); next.set(c.id, 'KEEP'); return next }) }}
                onRelease={() => { setExitDecisions(prev => { const next = new Map(prev); next.set(c.id, 'RELEASE'); return next }) }}
                onViewStats={() => { setSelectedPlayer(playerInfo(c.roster.player)) }}
              />
            ))}
          </div>
        )}
      </div>
    )
  } else if (activeIsNuovi) {
    panel = (
      <div className="bg-surface-200 border border-surface-50 rounded-xl overflow-hidden flex flex-col lg:h-full lg:min-h-0">
        <div className="px-4 py-2.5 border-b border-surface-50 flex items-baseline gap-2 flex-shrink-0">
          <span className="micro-label">Da Impostare · nuovi contratti</span>
          <span className="ml-auto font-mono text-[10.5px] text-gray-500">{filteredPending.length} giocatori</span>
        </div>
        {tableHeader}
        {filteredPending.length === 0 ? (
          <div className="py-8"><EmptyState icon="⚡" title="Nessun nuovo contratto da impostare" /></div>
        ) : (
          <div className="panel-scroll flex-1 min-h-0">
            {filteredPending.map(p => {
              const edit = pendingEdits[p.rosterId]
              const salary = parseInt(edit?.newSalary && edit.newSalary.length > 0 ? edit.newSalary : String(p.draftSalary ?? p.minSalary)) || p.minSalary
              const duration = parseInt(edit?.newDuration && edit.newDuration.length > 0 ? edit.newDuration : String(p.draftDuration ?? 2)) || 2
              return (
                <PendingItem
                  key={p.rosterId}
                  player={p.player}
                  acquisitionPrice={p.acquisitionPrice}
                  minSalary={p.minSalary}
                  salary={salary}
                  duration={duration}
                  validationError={edit?.previewData?.validationError}
                  inContrattiPhase={inContrattiPhase}
                  isConsolidated={isConsolidated}
                  onSalaryChange={(v) => { updatePendingEdit(p.rosterId, 'newSalary', String(v)) }}
                  onDurationChange={(v) => { updatePendingEdit(p.rosterId, 'newDuration', String(v)) }}
                  onViewStats={() => { setSelectedPlayer(playerInfo(p.player)) }}
                />
              )
            })}
          </div>
        )}
      </div>
    )
  } else if (activeIsRinnovi) {
    panel = (
      <div className="bg-surface-200 border border-surface-50 rounded-xl overflow-hidden flex flex-col lg:h-full lg:min-h-0">
        <div className="px-4 py-2.5 border-b border-surface-50 flex items-baseline gap-2 flex-shrink-0">
          <span className="micro-label">Contratti · rinnovi e tagli</span>
          <span className="ml-auto font-mono text-[10.5px] text-gray-500">{filteredContracts.length} giocatori</span>
        </div>
        {tableHeader}
        {filteredContracts.length === 0 ? (
          <div className="py-8"><EmptyState icon="📝" title="Nessun contratto" description={searchQuery || filterRole ? 'Nessun risultato per i filtri attivi' : undefined} /></div>
        ) : (
          <div className="panel-scroll flex-1 min-h-0">
            {filteredContracts.map(c => {
              const edit = localEdits[c.id]
              const newSalary = parseInt(edit?.newSalary || '') || c.salary
              const newDuration = parseInt(edit?.newDuration || '') || c.duration
              const isMarkedForRelease = localReleases.has(c.id)
              const isKeptExited = !!c.isExitedPlayer && exitDecisions.get(c.id) === 'KEEP'
              return (
                <RenewalItem
                  key={c.id}
                  contract={{
                    id: c.id,
                    salary: c.salary,
                    duration: c.duration,
                    initialSalary: c.initialSalary,
                    rescissionClause: c.rescissionClause,
                    canRenew: c.canRenew,
                    canSpalmare: c.canSpalmare,
                    draftSalary: c.draftSalary,
                    draftDuration: c.draftDuration,
                    wasModified: c.wasModified,
                    isExitedPlayer: c.isExitedPlayer,
                    player: c.roster.player,
                    acquisitionType: c.roster.acquisitionType,
                  }}
                  newSalary={newSalary}
                  newDuration={newDuration}
                  validationError={edit?.previewData?.validationError}
                  isMarkedForRelease={isMarkedForRelease}
                  isKeptExited={isKeptExited}
                  inContrattiPhase={inContrattiPhase}
                  isConsolidated={isConsolidated}
                  onSalaryChange={(v) => { updateLocalEdit(c.id, 'newSalary', String(v)) }}
                  onDurationChange={(v) => { updateLocalEdit(c.id, 'newDuration', String(v)) }}
                  onToggleRelease={() => { toggleRelease(c.id) }}
                  onRemoveKept={() => { setExitDecisions(prev => { const next = new Map(prev); next.delete(c.id); return next }) }}
                  onViewStats={() => { setSelectedPlayer(playerInfo(c.roster.player)) }}
                />
              )
            })}

            {/* Giocatori tagliati (post-consolidamento) */}
            {isConsolidated && releasedPlayers.length > 0 && (
              <div className="border-t border-surface-50">
                <div className="px-4 py-2.5 bg-surface-300/40">
                  <span className="micro-label text-danger-400">Giocatori tagliati · {releasedPlayers.length}</span>
                </div>
                {releasedPlayers.map(player => (
                  <div key={player.id} className="flex items-center gap-2.5 px-4 py-2.5 border-b border-surface-50/60 bg-danger-500/[0.04]">
                    <RoleBadge position={player.playerPosition} size="sm" />
                    <div className="w-6 h-6 bg-white rounded p-0.5 flex-shrink-0"><TeamLogo team={player.playerTeam} /></div>
                    <span className="font-display font-bold text-sm text-gray-400 line-through flex-1 truncate">{player.playerName}</span>
                    <span className="stat-number text-sm text-gray-500">{player.salary}×{player.duration}</span>
                    <span className="stat-number text-sm text-danger-400 w-16 text-right">−{player.releaseCost}M</span>
                    <span className="font-mono text-[9.5px] w-24 text-right">
                      {player.releaseType === 'RELEASE_ESTERO' && player.indemnityAmount
                        ? <span className="text-secondary-400">+{player.indemnityAmount}M ind.</span>
                        : player.releaseType === 'RELEASE_RETROCESSO'
                          ? <span className="text-primary-400">gratuito</span>
                          : <span className="text-danger-400">taglio</span>}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen lg:h-dvh lg:flex lg:flex-col lg:overflow-hidden">
      <Navigation currentPage="contracts" leagueId={leagueId} isLeagueAdmin={isLeagueAdmin} onNavigate={onNavigate} />

      <main className="w-full max-w-[1400px] mx-auto px-3 lg:px-4 py-3 lg:flex-1 lg:min-h-0 lg:flex lg:flex-col lg:overflow-hidden">
        <CockpitShell header={header} adminBar={<>{adminBar}{gate}</>}>
          <div className="mt-3 lg:h-full lg:min-h-0 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-3.5">
            {/* Colonna lavoro */}
            <div className="lg:min-h-0 lg:h-full">
              {panel}
            </div>
            {/* Sidebar */}
            <div className="mt-3 lg:mt-0 lg:min-h-0 lg:h-full">
              {sidebar}
            </div>
          </div>
        </CockpitShell>

        {/* Box regole (collassabile, fuori dal viewport bloccato su mobile) */}
        {inContrattiPhase && !isConsolidated && (
          <div className="lg:hidden mt-3">
            <button
              type="button"
              onClick={() => { setShowRules(s => !s); }}
              className="w-full flex items-center gap-2 px-4 py-3 bg-surface-200 border border-accent-500/30 rounded-xl text-accent-400 text-sm font-semibold"
            >
              <span>Regole rinnovi contratti</span>
              <span className="ml-auto">{showRules ? '−' : '+'}</span>
            </button>
            {showRules && <RulesBox />}
          </div>
        )}
      </main>

      <PlayerStatsModal
        isOpen={!!selectedPlayer}
        onClose={() => { setSelectedPlayer(null); }}
        player={selectedPlayer}
      />
    </div>
  )
}

// ===== Small local presentational helpers =====

function playerInfo(p: Player): PlayerInfo {
  return {
    name: p.name,
    team: p.team,
    position: p.position,
    age: p.age,
    apiFootballId: p.apiFootballId,
    computedStats: p.computedStats,
  }
}

function ChecklistRow({ ok, label, value }: { ok: boolean; label: string; value: string }) {
  return (
    <div className={`flex items-center gap-2.5 text-[12.5px] ${ok ? 'text-secondary-400' : 'text-danger-400'}`}>
      <span className={`w-[18px] h-[18px] rounded-[5px] flex items-center justify-center text-[11px] flex-shrink-0 ${
        ok ? 'bg-secondary-500/18 text-secondary-400' : 'bg-danger-500/18 text-danger-400'
      }`}>
        {ok ? '✓' : '✕'}
      </span>
      {label}
      <span className="ml-auto font-mono font-bold">{value}</span>
    </div>
  )
}

function IngStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-300 border border-surface-50 rounded-lg px-2.5 py-2">
      <div className="micro-label text-[8.5px]">{label}</div>
      <div className="stat-number text-lg text-white mt-0.5">{value}</div>
    </div>
  )
}

function RulesBox() {
  return (
    <div className="mt-2 bg-surface-200 border border-surface-50 rounded-xl p-4 space-y-3 text-sm">
      <RuleBlock tone="border-secondary-500" title="Rinnovo standard" titleColor="text-secondary-400" items={[
        'Puoi aumentare o mantenere l\'ingaggio',
        'Puoi aumentare o mantenere la durata',
        'Clausola = Ingaggio × Moltiplicatore (4s=×11, 3s=×9, 2s=×7, 1s=×3)',
      ]} />
      <RuleBlock tone="border-warning-500" title="Spalma (solo contratti 1 semestre)" titleColor="text-warning-400" items={[
        'Riduci l\'ingaggio allungando la durata',
        'Regola: Nuovo Ingaggio × Nuova Durata ≥ Ingaggio Iniziale',
        'Esempio: 10M×1s → 5M×2s (5×2=10 ≥ 10)',
      ]} />
      <RuleBlock tone="border-danger-500" title="Taglia (rilascio)" titleColor="text-danger-400" items={[
        'Liberi un giocatore pagando una penale',
        'Costo taglio: (Ingaggio × Durata) / 2',
        'Il giocatore va agli svincolati',
      ]} />
      <RuleBlock tone="border-accent-500" title="Nuovi contratti" titleColor="text-accent-400" items={[
        'Giocatori acquisiti nella sessione devono avere un contratto',
        'Ingaggio minimo = prezzo d\'acquisto',
        'Durata: da 1 a 4 semestri',
      ]} />
    </div>
  )
}

function RuleBlock({ tone, title, titleColor, items }: { tone: string; title: string; titleColor: string; items: string[] }) {
  return (
    <div className={`bg-surface-300/40 rounded-lg p-3 border-l-4 ${tone}`}>
      <h4 className={`font-bold mb-1 ${titleColor}`}>{title}</h4>
      <ul className="text-gray-300 space-y-1 ml-4 list-disc text-[13px]">
        {items.map((it, i) => <li key={i}>{it}</li>)}
      </ul>
    </div>
  )
}
