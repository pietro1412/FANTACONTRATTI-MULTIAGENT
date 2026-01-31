import { useState, useEffect, useMemo } from 'react'
import { contractApi, leagueApi } from '../services/api'
import { Button } from '../components/ui/Button'
import { Navigation } from '../components/Navigation'
import { getTeamLogo } from '../utils/teamLogos'
import { POSITION_COLORS } from '../components/ui/PositionBadge'
import { PlayerStatsModal, type PlayerInfo, type PlayerStats } from '../components/PlayerStatsModal'
import { getPlayerPhotoUrl } from '../utils/player-images'

interface ContractsProps {
  leagueId: string
  onNavigate: (page: string, params?: Record<string, string>) => void
}

interface Player {
  id: string
  name: string
  team: string
  position: string
  listStatus?: string
  exitReason?: string
  age?: number | null
  apiFootballId?: number | null
  apiFootballStats?: PlayerStats | null
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
  // Draft values (saved but not consolidated)
  draftSalary: number | null
  draftDuration: number | null
  draftReleased: boolean  // Marcato per taglio
  draftExitDecision?: string | null  // null=INDECISO, "KEEP", "RELEASE"
  // Exited player info
  isExitedPlayer?: boolean
  exitReason?: string | null
  indemnityCompensation?: number
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
  // Draft values (saved but not consolidated)
  draftSalary: number | null
  draftDuration: number | null
}

// Stato locale per modifiche in corso
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

// Stile per ruolo (usa costanti centralizzate)
function getRoleStyle(position: string) {
  const colors = POSITION_COLORS[position as keyof typeof POSITION_COLORS]
  return colors || { bg: 'bg-gradient-to-r from-gray-500 to-gray-600', text: 'text-white', border: '' }
}

// Colore per durata contratto (issue #202)
// 1s = danger (scade presto), 2s = warning, 3s = primary, 4s = green (lungo termine)
function getDurationColor(duration: number): string {
  switch(duration) {
    case 1: return 'text-danger-400'
    case 2: return 'text-warning-400'
    case 3: return 'text-primary-400'
    case 4: return 'text-green-400'
    default: return 'text-gray-400'
  }
}

// Age color function - younger is better (issue #206)
function getAgeColor(age: number | null | undefined): string {
  if (age === null || age === undefined) return 'text-gray-500'
  if (age < 20) return 'text-emerald-400 font-bold'
  if (age < 25) return 'text-green-400'
  if (age < 30) return 'text-yellow-400'
  if (age < 35) return 'text-orange-400'
  return 'text-red-400'
}

// Componente logo squadra
function TeamLogo({ team }: { team: string }) {
  return (
    <img
      src={getTeamLogo(team)}
      alt={team}
      className="w-6 h-6 object-contain"
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = 'none'
      }}
    />
  )
}

// Moltiplicatori clausola
const DURATION_MULTIPLIERS: Record<number, number> = {
  4: 11,
  3: 9,
  2: 7,
  1: 4,
}

// Massimo numero di giocatori in rosa dopo consolidamento
const MAX_ROSTER_SIZE = 29

export function Contracts({ leagueId, onNavigate }: ContractsProps) {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [pendingContracts, setPendingContracts] = useState<PendingContract[]>([])
  const [memberBudget, setMemberBudget] = useState(0)
  const [inContrattiPhase, setInContrattiPhase] = useState(false)
  const [isLeagueAdmin, setIsLeagueAdmin] = useState(false)
  const [isConsolidated, setIsConsolidated] = useState(false)
  const [consolidatedAt, setConsolidatedAt] = useState<string | null>(null)
  const [isConsolidating, setIsConsolidating] = useState(false)
  const [isSavingDrafts, setIsSavingDrafts] = useState(false)

  // Stato per modifiche locali di ogni contratto
  const [localEdits, setLocalEdits] = useState<Record<string, LocalEdit>>({})
  // Stato per nuovi contratti (pending)
  const [pendingEdits, setPendingEdits] = useState<Record<string, LocalEdit>>({})
  // Stato per tagli locali (contract IDs marcati per release)
  const [localReleases, setLocalReleases] = useState<Set<string>>(new Set())
  // Stato per decisioni giocatori usciti (KEEP o RELEASE)
  const [exitDecisions, setExitDecisions] = useState<Map<string, 'KEEP' | 'RELEASE'>>(new Map())

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Filtri
  const [filterRole, setFilterRole] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // State for player stats modal
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerInfo | null>(null)

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

      // Inizializza localEdits per ogni contratto (usa draft se presente)
      const edits: Record<string, LocalEdit> = {}
      data.contracts.forEach(c => {
        // Se c'è un draft salvato, usalo, altrimenti valori correnti
        const hasDraft = c.draftSalary !== null && c.draftDuration !== null
        edits[c.id] = {
          newSalary: hasDraft ? String(c.draftSalary) : String(c.salary),
          newDuration: hasDraft ? String(c.draftDuration) : String(c.duration), // Default = durata attuale
          isModified: hasDraft, // Se c'è un draft, è già "modificato"
          previewData: null,
          isSaving: false,
        }
      })
      setLocalEdits(edits)

      // Inizializza pendingEdits per nuovi contratti (usa draft se presente)
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

      // Inizializza exitDecisions da dati caricati
      const exitDec = new Map<string, 'KEEP' | 'RELEASE'>()
      data.contracts.forEach(c => {
        if (c.isExitedPlayer && c.draftExitDecision) {
          exitDec.set(c.id, c.draftExitDecision as 'KEEP' | 'RELEASE')
        }
      })
      setExitDecisions(exitDec)

      // Inizializza tagli da draft salvati (solo contratti NON usciti)
      const releases = new Set<string>()
      data.contracts.forEach(c => {
        if (c.draftReleased && !c.isExitedPlayer) {
          releases.add(c.id)
        }
      })
      setLocalReleases(releases)
    }
    setIsLoading(false)
  }

  // Aggiorna valori locali per un contratto
  function updateLocalEdit(contractId: string, field: 'newSalary' | 'newDuration', value: string) {
    setLocalEdits(prev => ({
      ...prev,
      [contractId]: {
        ...prev[contractId],
        [field]: value,
        isModified: true,
      }
    }))
  }

  // Reset contratto ai valori base (annulla modifiche non consolidate)
  function resetContractToBase(contract: Contract) {
    setLocalEdits(prev => ({
      ...prev,
      [contract.id]: {
        newSalary: String(contract.salary),
        newDuration: String(contract.duration),
        isModified: true, // Marked as modified to trigger preview recalc
        previewData: null,
        isSaving: false,
      }
    }))
    // Trigger preview calculation after reset
    setTimeout(() => calculatePreview(contract.id), 100)
  }

  // Check if a specific contract has changes different from saved base values
  function contractHasUnsavedChanges(contract: Contract): boolean {
    const edit = localEdits[contract.id]
    if (!edit) return false
    const currentSalary = parseInt(edit.newSalary) || 0
    const currentDuration = parseInt(edit.newDuration) || 0
    return currentSalary !== contract.salary || currentDuration !== contract.duration
  }

  // Aggiorna valori locali per un pending contract
  function updatePendingEdit(rosterId: string, field: 'newSalary' | 'newDuration', value: string) {
    setPendingEdits(prev => ({
      ...prev,
      [rosterId]: {
        ...prev[rosterId],
        [field]: value,
        isModified: true,
      }
    }))
  }

  // Calcola preview per contratto esistente
  async function calculatePreview(contractId: string) {
    const edit = localEdits[contractId]
    if (!edit) return

    const salary = parseInt(edit.newSalary)
    const duration = parseInt(edit.newDuration)
    if (isNaN(salary) || isNaN(duration)) return

    const result = await contractApi.preview(contractId, salary, duration)
    if (result.success && result.data) {
      setLocalEdits(prev => ({
        ...prev,
        [contractId]: {
          ...prev[contractId],
          previewData: result.data as LocalEdit['previewData'],
        }
      }))
    }
  }

  // Calcola preview per pending contract
  async function calculatePendingPreview(rosterId: string) {
    const edit = pendingEdits[rosterId]
    if (!edit) return

    const salary = parseInt(edit.newSalary)
    const duration = parseInt(edit.newDuration)
    if (isNaN(salary) || isNaN(duration)) return

    const result = await contractApi.previewCreate(rosterId, salary, duration)
    if (result.success && result.data) {
      setPendingEdits(prev => ({
        ...prev,
        [rosterId]: {
          ...prev[rosterId],
          previewData: result.data as LocalEdit['previewData'],
        }
      }))
    }
  }

  // Auto-calcola preview quando cambiano i valori
  useEffect(() => {
    const timeouts: NodeJS.Timeout[] = []
    Object.entries(localEdits).forEach(([contractId, edit]) => {
      if (edit.isModified) {
        const timeout = setTimeout(() => calculatePreview(contractId), 300)
        timeouts.push(timeout)
      }
    })
    return () => timeouts.forEach(t => clearTimeout(t))
  }, [localEdits])

  useEffect(() => {
    const timeouts: NodeJS.Timeout[] = []
    Object.entries(pendingEdits).forEach(([rosterId, edit]) => {
      // Calcola preview sempre (anche per valori di default), non solo quando modificato
      if (!edit.previewData || edit.isModified) {
        const timeout = setTimeout(() => calculatePendingPreview(rosterId), 300)
        timeouts.push(timeout)
      }
    })
    return () => timeouts.forEach(t => clearTimeout(t))
  }, [pendingEdits])


  // Toggle taglio giocatore (locale, salvato con "Salva")
  function toggleRelease(contractId: string) {
    setLocalReleases(prev => {
      const newSet = new Set(prev)
      if (newSet.has(contractId)) {
        newSet.delete(contractId)
      } else {
        newSet.add(contractId)
      }
      return newSet
    })
  }

  // Salva bozze - salva i valori come draft (può tornare e modificare)
  async function handleSaveDrafts() {
    setIsSavingDrafts(true)
    setError('')

    // Raccogli tutti i rinnovi con modifiche
    const renewals: { contractId: string; salary: number; duration: number }[] = []
    Object.entries(localEdits).forEach(([contractId, edit]) => {
      const contract = contracts.find(c => c.id === contractId)
      if (!contract || !contract.canRenew) return

      const newSalary = parseInt(edit.newSalary)
      const newDuration = parseInt(edit.newDuration)

      // Salva se i valori sono diversi da quelli attuali
      if (newSalary !== contract.salary || newDuration !== contract.duration) {
        renewals.push({ contractId, salary: newSalary, duration: newDuration })
      }
    })

    // Raccogli tutti i nuovi contratti
    const newContracts: { rosterId: string; salary: number; duration: number }[] = []
    Object.entries(pendingEdits).forEach(([rosterId, edit]) => {
      const salary = parseInt(edit.newSalary)
      const duration = parseInt(edit.newDuration)
      if (!isNaN(salary) && !isNaN(duration) && salary > 0) {
        newContracts.push({ rosterId, salary, duration })
      }
    })

    const exitDecisionsArray = Array.from(exitDecisions.entries()).map(([contractId, decision]) => ({
      contractId,
      decision,
    }))
    const result = await contractApi.saveDrafts(leagueId, renewals, newContracts, Array.from(localReleases), exitDecisionsArray)
    if (result.success) {
      setSuccess('Bozze salvate! Puoi tornare a modificarle in qualsiasi momento.')
      await loadContracts() // Ricarica per aggiornare i draft
    } else {
      setError(result.message || 'Errore nel salvataggio')
    }
    setIsSavingDrafts(false)
    setTimeout(() => { setSuccess(''); setError('') }, 4000)
  }

  // Consolida - applica tutte le modifiche insieme (DEFINITIVO)
  async function handleConsolidate() {
    setIsConsolidating(true)
    setError('')

    // Raccogli tutti i rinnovi modificati
    const renewals: { contractId: string; salary: number; duration: number }[] = []
    Object.entries(localEdits).forEach(([contractId, edit]) => {
      const contract = contracts.find(c => c.id === contractId)
      if (!contract || !contract.canRenew) return

      const newSalary = parseInt(edit.newSalary)
      const newDuration = parseInt(edit.newDuration)

      // Solo se i valori sono diversi da quelli attuali
      if (newSalary !== contract.salary || newDuration !== contract.duration) {
        if (edit.previewData?.isValid && edit.previewData?.canAfford) {
          renewals.push({ contractId, salary: newSalary, duration: newDuration })
        }
      }
    })

    // Raccogli tutti i nuovi contratti da creare
    const newContracts: { rosterId: string; salary: number; duration: number }[] = []
    Object.entries(pendingEdits).forEach(([rosterId, edit]) => {
      if (edit.previewData?.isValid) {
        newContracts.push({
          rosterId,
          salary: parseInt(edit.newSalary),
          duration: parseInt(edit.newDuration)
        })
      }
    })

    // Invia al backend
    const result = await contractApi.consolidateAll(leagueId, renewals, newContracts)
    if (result.success) {
      setSuccess(result.message || 'Contratti consolidati!')
      setIsConsolidated(true)
      const data = result.data as { consolidatedAt?: string }
      if (data?.consolidatedAt) {
        setConsolidatedAt(data.consolidatedAt)
      }
      await loadContracts()
    } else {
      setError(result.message || 'Errore nel consolidamento')
    }
    setIsConsolidating(false)
  }

  // Calcola ingaggi proiettati (con modifiche applicate)
  const projectedSalaries = useMemo(() => {
    let total = 0

    // Contratti esistenti (escludi quelli marcati per taglio e usciti non KEEP)
    contracts.forEach(contract => {
      if (localReleases.has(contract.id)) return // Skip released normal
      if (contract.isExitedPlayer && exitDecisions.get(contract.id) !== 'KEEP') return // Skip exited unless KEEP
      const edit = localEdits[contract.id]
      const salary = parseInt(edit?.newSalary || '') || contract.salary
      total += salary
    })

    // Nuovi contratti (pending)
    pendingContracts.forEach(pending => {
      const edit = pendingEdits[pending.rosterId]
      const salaryStr = edit?.newSalary && edit.newSalary.length > 0
        ? edit.newSalary
        : String(pending.draftSalary ?? pending.minSalary)
      total += parseInt(salaryStr) || pending.minSalary
    })

    return total
  }, [contracts, pendingContracts, localEdits, pendingEdits, localReleases, exitDecisions])

  // I rinnovi NON costano budget (si paga solo l'ingaggio semestrale)
  // Rimosso totalRenewalCost - non serve più

  // Calcola costo totale tagli (esclusi giocatori usciti dalla lista - costo 0)
  const totalReleaseCost = useMemo(() => {
    let total = 0

    contracts.forEach(contract => {
      if (localReleases.has(contract.id)) {
        if (contract.isExitedPlayer) {
          // Giocatori usciti: nessun costo taglio
        } else {
          // Costo taglio = (ingaggio × durata) / 2
          total += Math.ceil((contract.salary * contract.duration) / 2)
        }
      }
    })

    return total
  }, [contracts, localReleases])

  // Residuo = Budget - Ingaggi - Tagli
  // Gli indennizzi sono già inclusi nel budget (se il manager ha scelto RELEASE)
  // o verranno aggiunti al consolidamento
  const residuoContratti = useMemo(() => {
    return memberBudget - projectedSalaries - totalReleaseCost
  }, [memberBudget, projectedSalaries, totalReleaseCost])

  // Calcola numero giocatori effettivo dopo i tagli e le decisioni usciti
  const effectivePlayerCount = useMemo(() => {
    const totalPlayers = contracts.length + pendingContracts.length
    const releasedCount = localReleases.size
    const exitReleasedCount = Array.from(exitDecisions.values()).filter(d => d === 'RELEASE').length
    return totalPlayers - releasedCount - exitReleasedCount
  }, [contracts.length, pendingContracts.length, localReleases.size, exitDecisions])

  // Quanti tagli sono necessari per rispettare il limite
  const requiredReleases = useMemo(() => {
    return Math.max(0, effectivePlayerCount - MAX_ROSTER_SIZE)
  }, [effectivePlayerCount])

  // Verifica se si può consolidare:
  // - Tutti i pending contracts devono avere valori validi
  // - Il numero di giocatori deve essere <= MAX_ROSTER_SIZE
  // - Nessun contratto esistente deve avere errori di validazione (es. spalma errato)
  const canConsolidate = useMemo(() => {
    // Check: all exited players must have a decision
    const undecidedExited = contracts.filter(c => c.isExitedPlayer && !exitDecisions.has(c.id))
    if (undecidedExited.length > 0) return false
    // Check roster limit
    if (effectivePlayerCount > MAX_ROSTER_SIZE) {
      return false
    }
    // Ogni pending contract deve avere un preview valido
    for (const pending of pendingContracts) {
      const edit = pendingEdits[pending.rosterId]
      if (!edit || !edit.previewData?.isValid) {
        return false
      }
    }
    // Verifica che i contratti esistenti con modifiche non abbiano errori di validazione
    for (const contract of contracts) {
      if (!contract.canRenew) continue
      const edit = localEdits[contract.id]
      if (!edit) continue

      const newSalary = parseInt(edit.newSalary) || contract.salary
      const newDuration = parseInt(edit.newDuration) || contract.duration
      const hasChanges = newSalary !== contract.salary || newDuration !== contract.duration

      // Se ci sono modifiche e c'è un errore di validazione, blocca
      if (hasChanges && edit.previewData?.validationError) {
        return false
      }
    }
    return true
  }, [pendingContracts, pendingEdits, effectivePlayerCount, contracts, localEdits, exitDecisions])

  // Messaggio per blocco consolidamento
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
      if (!edit || !edit.previewData?.isValid) {
        return 'Imposta tutti i nuovi contratti'
      }
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

  // Filtra e ordina contratti
  // Separate exited players from normal contracts
  const exitedContracts = useMemo(() =>
    contracts.filter(c => c.isExitedPlayer && !exitDecisions.has(c.id)),
  [contracts, exitDecisions])

  const filteredContracts = useMemo(() => {
    // Include normal contracts + exited players with KEEP decision
    let items = contracts.filter(c => !c.isExitedPlayer || exitDecisions.get(c.id) === 'KEEP')
    if (filterRole) items = items.filter(c => c.roster.player.position === filterRole)
    if (searchQuery) items = items.filter(c =>
      c.roster.player.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
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
    if (searchQuery) items = items.filter(p =>
      p.player.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    return items.sort((a, b) => {
      const roleOrder = { P: 0, D: 1, C: 2, A: 3 }
      const ra = roleOrder[a.player.position as keyof typeof roleOrder] ?? 4
      const rb = roleOrder[b.player.position as keyof typeof roleOrder] ?? 4
      if (ra !== rb) return ra - rb
      return a.player.name.localeCompare(b.player.name)
    })
  }, [pendingContracts, filterRole, searchQuery])

  // ============ STATISTICHE ROSA ============

  // Distribuzione per ruolo (include pending e esclude tagli)
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

  // Distribuzione per durata contratto
  // Usa sempre la "nuova durata" (che di default = durata attuale)
  const durationDistribution = useMemo(() => {
    const dist = { 1: 0, 2: 0, 3: 0, 4: 0 }
    contracts.forEach(c => {
      if (localReleases.has(c.id)) return
      if (c.isExitedPlayer && exitDecisions.get(c.id) !== 'KEEP') return
      const edit = localEdits[c.id]
      // Usa newDuration da localEdits (default = c.duration)
      const dur = parseInt(edit?.newDuration || '') || c.duration
      if (dur >= 1 && dur <= 4) dist[dur as keyof typeof dist]++
    })
    pendingContracts.forEach(p => {
      const edit = pendingEdits[p.rosterId]
      // Usa newDuration da pendingEdits (default = draftDuration o 2)
      const dur = parseInt(edit?.newDuration || '') || p.draftDuration || 2
      if (dur >= 1 && dur <= 4) dist[dur as keyof typeof dist]++
    })
    return dist
  }, [contracts, pendingContracts, localEdits, pendingEdits, localReleases, exitDecisions])

  // Verifica se ci sono modifiche non salvate
  const hasUnsavedChanges = useMemo(() => {
    // Controlla se localEdits differiscono dai draft salvati
    for (const contract of contracts) {
      const edit = localEdits[contract.id]
      if (!edit) continue

      const savedSalary = contract.draftSalary ?? contract.salary
      const savedDuration = contract.draftDuration ?? contract.duration
      const currentSalary = parseInt(edit.newSalary) || contract.salary
      const currentDuration = parseInt(edit.newDuration) || contract.duration

      if (currentSalary !== savedSalary || currentDuration !== savedDuration) {
        return true
      }
    }

    // Controlla se pendingEdits differiscono dai draft salvati
    for (const pending of pendingContracts) {
      const edit = pendingEdits[pending.rosterId]
      if (!edit) continue

      const savedSalary = pending.draftSalary ?? pending.minSalary
      const savedDuration = pending.draftDuration ?? 2
      const currentSalary = parseInt(edit.newSalary) || pending.minSalary
      const currentDuration = parseInt(edit.newDuration) || 2

      if (currentSalary !== savedSalary || currentDuration !== savedDuration) {
        return true
      }
    }

    // Controlla se localReleases differiscono dai draftReleased salvati (solo non-usciti)
    for (const contract of contracts) {
      if (contract.isExitedPlayer) continue
      const isLocallyReleased = localReleases.has(contract.id)
      const wasDraftReleased = contract.draftReleased
      if (isLocallyReleased !== wasDraftReleased) {
        return true
      }
    }

    // Controlla se exitDecisions differiscono dai draftExitDecision salvati
    for (const contract of contracts) {
      if (!contract.isExitedPlayer) continue
      const currentDecision = exitDecisions.get(contract.id) || null
      const savedDecision = contract.draftExitDecision || null
      if (currentDecision !== savedDecision) {
        return true
      }
    }

    return false
  }, [contracts, pendingContracts, localEdits, pendingEdits, localReleases, exitDecisions])

  // Warning prima di chiudere la pagina se ci sono modifiche non salvate
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges && inContrattiPhase && !isConsolidated) {
        e.preventDefault()
        e.returnValue = ''
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges, inContrattiPhase, isConsolidated])

  // Statistiche salari
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
      total
    }
  }, [contracts, pendingContracts, localEdits, pendingEdits, localReleases, exitDecisions])

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
    <div className="min-h-screen bg-dark-300 pb-20">
      <Navigation currentPage="contracts" leagueId={leagueId} isLeagueAdmin={isLeagueAdmin} onNavigate={onNavigate} />

      {/* Header compatto - sticky sotto la Navigation su desktop */}
      <div className="bg-surface-200 border-b border-surface-50/20 sticky top-0 md:top-14 z-30">
        <div className="max-w-[1600px] mx-auto px-4 py-3">
          {/* Mobile: stato consolidato (pulsanti azione sono nel footer sticky) */}
          {isConsolidated && (
            <div className="md:hidden flex items-center justify-center mb-3 pb-3 border-b border-surface-50/20">
              <span className="text-secondary-400 text-sm">✓ Consolidato</span>
            </div>
          )}

          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📝</span>
              <div>
                <h1 className="text-lg font-bold text-white">Gestione Contratti</h1>
                <p className="text-xs text-gray-400">
                  {inContrattiPhase
                    ? <span className="text-secondary-400">Fase CONTRATTI attiva</span>
                    : <span className="text-warning-400">Fase non attiva</span>
                  }
                </p>
              </div>
              {/* Slot counter */}
              <div className={`ml-4 px-3 py-1.5 rounded-lg border ${
                requiredReleases > 0
                  ? 'bg-danger-500/20 border-danger-500/50'
                  : 'bg-surface-300 border-surface-50/30'
              }`}>
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-bold ${
                    requiredReleases > 0 ? 'text-danger-400' : 'text-white'
                  }`}>
                    {effectivePlayerCount}/{MAX_ROSTER_SIZE}
                  </span>
                  <span className="text-xs text-gray-400">slot</span>
                </div>
                {requiredReleases > 0 && (
                  <p className="text-xs text-danger-400 font-medium">
                    Taglia {requiredReleases} giocator{requiredReleases === 1 ? 'e' : 'i'}!
                  </p>
                )}
              </div>
            </div>

            {/* Filtri inline */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Cerca..."
                className="w-32 px-2 py-1 bg-surface-300 border border-surface-50/30 rounded text-white text-sm"
              />
              <select
                value={filterRole}
                onChange={e => setFilterRole(e.target.value)}
                className="px-2 py-1 bg-surface-300 border border-surface-50/30 rounded text-white text-sm"
              >
                <option value="">Tutti</option>
                <option value="P">P</option>
                <option value="D">D</option>
                <option value="C">C</option>
                <option value="A">A</option>
              </select>
            </div>

            {/* Azioni - Desktop only */}
            {inContrattiPhase && !isConsolidated && (
              <div className="hidden md:flex items-center gap-2">
                {/* Indicatore modifiche non salvate */}
                {hasUnsavedChanges && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-warning-500/20 border border-warning-500/40 rounded-lg animate-pulse">
                    <span className="w-2 h-2 bg-warning-400 rounded-full"></span>
                    <span className="text-warning-400 text-xs font-medium whitespace-nowrap">Modifiche da salvare</span>
                  </div>
                )}
                {/* Salva bozze */}
                <Button
                  size="sm"
                  variant={hasUnsavedChanges ? "accent" : "secondary"}
                  onClick={handleSaveDrafts}
                  disabled={isSavingDrafts}
                >
                  {isSavingDrafts ? 'Salvando...' : 'Salva'}
                </Button>
                {/* Consolida (definitivo) */}
                <Button
                  size="sm"
                  onClick={handleConsolidate}
                  disabled={isConsolidating || !canConsolidate}
                  title={consolidateBlockReason}
                >
                  {isConsolidating ? 'Consolidando...' : 'Consolida'}
                </Button>
              </div>
            )}
            {isConsolidated && (
              <span className="hidden md:inline text-secondary-400 text-sm">✓ Consolidato</span>
            )}
          </div>
        </div>
      </div>

      {/* Messaggi */}
      {(error || success) && (
        <div className="max-w-[1600px] mx-auto px-4 py-2">
          {error && <div className="bg-danger-500/20 border border-danger-500/30 text-danger-400 p-2 rounded text-sm">{error}</div>}
          {success && <div className="bg-secondary-500/20 border border-secondary-500/30 text-secondary-400 p-2 rounded text-sm">{success}</div>}
        </div>
      )}

      {/* Box Regole Rinnovi */}
      {inContrattiPhase && !isConsolidated && (
        <div className="max-w-[1600px] mx-auto px-4 py-3">
          <details className="bg-surface-200 border border-primary-500/30 rounded-lg">
            <summary className="px-4 py-3 cursor-pointer text-primary-400 font-medium hover:bg-surface-300/30 rounded-lg flex items-center gap-2">
              <span>📋</span> Regole Rinnovi Contratti
            </summary>
            <div className="px-4 pb-4 space-y-4 text-sm">
              {/* Rinnovo Standard */}
              <div className="bg-surface-300/30 rounded-lg p-3 border-l-4 border-secondary-500">
                <h4 className="text-secondary-400 font-bold mb-1">Rinnovo Standard</h4>
                <ul className="text-gray-300 space-y-1 ml-4 list-disc">
                  <li>Puoi aumentare o mantenere l'ingaggio</li>
                  <li>Puoi aumentare o mantenere la durata</li>
                  <li>La clausola = Ingaggio × Moltiplicatore (4s=×11, 3s=×9, 2s=×7, 1s=×4)</li>
                </ul>
              </div>

              {/* Spalma */}
              <div className="bg-surface-300/30 rounded-lg p-3 border-l-4 border-warning-500">
                <h4 className="text-warning-400 font-bold mb-1">Spalma (solo contratti 1 semestre)</h4>
                <ul className="text-gray-300 space-y-1 ml-4 list-disc">
                  <li>Permette di diminuire l'ingaggio allungando la durata</li>
                  <li><span className="text-white font-medium">Regola:</span> Nuovo Ingaggio × Nuova Durata <span className="text-warning-400">≥</span> Ingaggio Iniziale</li>
                  <li>Esempio: Contratto 10M×1s → puoi spalmarlo a 5M×2s (5×2=10 ≥ 10)</li>
                  <li className="text-danger-400">Se la regola non è rispettata, il consolidamento sarà bloccato</li>
                </ul>
              </div>

              {/* Taglia */}
              <div className="bg-surface-300/30 rounded-lg p-3 border-l-4 border-danger-500">
                <h4 className="text-danger-400 font-bold mb-1">Taglia (Rilascio Giocatore)</h4>
                <ul className="text-gray-300 space-y-1 ml-4 list-disc">
                  <li>Puoi liberare un giocatore pagando una penale</li>
                  <li><span className="text-white font-medium">Costo taglio:</span> (Ingaggio × Durata residua) / 2</li>
                  <li>Esempio: Contratto 8M×2s → costo taglio = (8×2)/2 = <span className="text-danger-400">8M</span></li>
                  <li>Il giocatore va agli svincolati e sarà battuto all'asta</li>
                </ul>
              </div>

              {/* Nuovi Contratti */}
              <div className="bg-surface-300/30 rounded-lg p-3 border-l-4 border-accent-500">
                <h4 className="text-accent-400 font-bold mb-1">Nuovi Contratti (Da Impostare)</h4>
                <ul className="text-gray-300 space-y-1 ml-4 list-disc">
                  <li>Giocatori acquisiti nella sessione devono avere un contratto</li>
                  <li>Ingaggio minimo = prezzo d'acquisto</li>
                  <li>Durata: da 1 a 4 semestri</li>
                </ul>
              </div>
            </div>
          </details>
        </div>
      )}

      <main className="max-w-[1600px] mx-auto px-4 py-4">
        <div className="flex flex-col xl:flex-row gap-4">
          {/* Colonna principale - Contratti */}
          <div className="flex-1 min-w-0">
        {/* Pending Contracts - Da impostare */}
        {filteredPending.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-bold text-warning-400 uppercase tracking-wide mb-2">
              Da Impostare ({filteredPending.length})
            </h2>

            {/* Mobile: Card View */}
            <div className="md:hidden space-y-3">
              {filteredPending.map(pending => {
                const edit = pendingEdits[pending.rosterId]
                const roleStyle = getRoleStyle(pending.player.position)
                const salaryStr = edit?.newSalary && edit.newSalary.length > 0
                  ? edit.newSalary
                  : String(pending.draftSalary ?? pending.minSalary)
                const durationStr = edit?.newDuration && edit.newDuration.length > 0
                  ? edit.newDuration
                  : String(pending.draftDuration ?? 2)
                const currentSalary = parseInt(salaryStr) || pending.minSalary
                const currentDuration = parseInt(durationStr) || 2
                const multiplier = DURATION_MULTIPLIERS[currentDuration as keyof typeof DURATION_MULTIPLIERS] || 7
                const newClausola = currentSalary * multiplier
                const newRubata = newClausola + currentSalary

                return (
                  <div key={pending.rosterId} className="bg-surface-200 rounded-lg border border-warning-500/30 p-3">
                    {/* Header: Player info */}
                    <div className="flex items-center gap-2 mb-3">
                      {pending.player.apiFootballId ? (
                        <img
                          src={getPlayerPhotoUrl(pending.player.apiFootballId)}
                          alt={pending.player.name}
                          className="w-8 h-8 rounded-full object-cover bg-surface-300 flex-shrink-0"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                      ) : null}
                      <div className="w-8 h-8 bg-white rounded p-0.5 flex-shrink-0">
                        <TeamLogo team={pending.player.team} />
                      </div>
                      <div className={`w-6 h-6 flex items-center justify-center rounded ${roleStyle.bg}`}>
                        <span className={`text-xs font-bold ${roleStyle.text}`}>{pending.player.position}</span>
                      </div>
                      <button
                        onClick={() => setSelectedPlayer({
                          name: pending.player.name,
                          team: pending.player.team,
                          position: pending.player.position,
                          age: pending.player.age,
                          apiFootballId: pending.player.apiFootballId,
                          apiFootballStats: pending.player.apiFootballStats,
                        })}
                        className="text-primary-400 hover:text-primary-300 font-medium flex-1 text-sm sm:text-base leading-tight text-left cursor-pointer transition-colors"
                      >
                        {pending.player.name}
                      </button>
                    </div>

                    {/* Info row */}
                    <div className="flex justify-between text-xs text-gray-400 mb-3 px-1">
                      <span>Acquisto: <span className="text-white">{pending.acquisitionPrice}M</span></span>
                      <span>Min Ing.: <span className="text-warning-400">{pending.minSalary}M</span></span>
                    </div>

                    {/* Inputs row */}
                    <div className="flex gap-3 mb-3">
                      <div className="flex-1">
                        <label className="text-[10px] text-gray-500 uppercase block mb-1">Ingaggio</label>
                        <div className="flex items-center">
                          <button
                            onClick={() => updatePendingEdit(pending.rosterId, 'newSalary', String(Math.max(pending.minSalary, currentSalary - 1)))}
                            disabled={!inContrattiPhase || isConsolidated || currentSalary <= pending.minSalary}
                            className="px-3 py-2 bg-surface-300 border border-primary-500/30 rounded-l text-white font-bold disabled:opacity-30"
                          >−</button>
                          <div className="flex-1 px-2 py-2 bg-surface-300 border-y border-primary-500/30 text-white text-center font-medium">
                            {currentSalary}M
                          </div>
                          <button
                            onClick={() => updatePendingEdit(pending.rosterId, 'newSalary', String(currentSalary + 1))}
                            disabled={!inContrattiPhase || isConsolidated}
                            className="px-3 py-2 bg-surface-300 border border-primary-500/30 rounded-r text-white font-bold disabled:opacity-30"
                          >+</button>
                        </div>
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] text-gray-500 uppercase block mb-1">Durata</label>
                        <div className="flex items-center">
                          <button
                            onClick={() => updatePendingEdit(pending.rosterId, 'newDuration', String(Math.max(1, currentDuration - 1)))}
                            disabled={!inContrattiPhase || isConsolidated || currentDuration <= 1}
                            className="px-3 py-2 bg-surface-300 border border-primary-500/30 rounded-l text-white font-bold disabled:opacity-30"
                          >−</button>
                          <div className={`flex-1 px-2 py-2 bg-surface-300 border-y border-primary-500/30 text-center font-medium ${getDurationColor(currentDuration)}`}>
                            {currentDuration}s
                          </div>
                          <button
                            onClick={() => updatePendingEdit(pending.rosterId, 'newDuration', String(Math.min(4, currentDuration + 1)))}
                            disabled={!inContrattiPhase || isConsolidated || currentDuration >= 4}
                            className="px-3 py-2 bg-surface-300 border border-primary-500/30 rounded-r text-white font-bold disabled:opacity-30"
                          >+</button>
                        </div>
                      </div>
                    </div>

                    {/* Results row */}
                    <div className="flex justify-around bg-surface-300/50 rounded p-2">
                      <div className="text-center">
                        <div className="text-[10px] text-gray-500 uppercase">Clausola</div>
                        <div className="text-accent-400 font-bold">{newClausola}M</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[10px] text-gray-500 uppercase">Rubata</div>
                        <div className="text-warning-400 font-bold">{newRubata}M</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Desktop: Table View */}
            <div className="hidden md:block bg-surface-200 rounded-lg border border-warning-500/30 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-warning-500/10 text-xs text-gray-400 uppercase">
                      <th className="text-left p-2">Giocatore</th>
                      <th className="text-center p-2">Acquisto</th>
                      <th className="text-center p-2">Min Ing.</th>
                      <th className="text-center p-2 border-l border-surface-50/20">Ingaggio</th>
                      <th className="text-center p-2">Durata</th>
                      <th className="text-center p-2">Clausola</th>
                      <th className="text-center p-2">Nuova Rubata</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPending.map(pending => {
                      const edit = pendingEdits[pending.rosterId]
                      const roleStyle = getRoleStyle(pending.player.position)
                      const salaryStr = edit?.newSalary && edit.newSalary.length > 0
                        ? edit.newSalary
                        : String(pending.draftSalary ?? pending.minSalary)
                      const durationStr = edit?.newDuration && edit.newDuration.length > 0
                        ? edit.newDuration
                        : String(pending.draftDuration ?? 2)
                      const currentSalary = parseInt(salaryStr) || pending.minSalary
                      const currentDuration = parseInt(durationStr) || 2
                      const multiplier = DURATION_MULTIPLIERS[currentDuration as keyof typeof DURATION_MULTIPLIERS] || 7
                      const newClausola = currentSalary * multiplier
                      const newRubata = newClausola + currentSalary

                      return (
                        <tr key={pending.rosterId} className="border-t border-surface-50/10 hover:bg-surface-300/30">
                          <td className="p-2">
                            <div className="flex items-center gap-2">
                              {pending.player.apiFootballId ? (
                                <img
                                  src={getPlayerPhotoUrl(pending.player.apiFootballId)}
                                  alt={pending.player.name}
                                  className="w-6 h-6 rounded-full object-cover bg-surface-300 flex-shrink-0"
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                                />
                              ) : null}
                              <div className="w-6 h-6 bg-white rounded p-0.5 flex-shrink-0">
                                <TeamLogo team={pending.player.team} />
                              </div>
                              <div className={`w-5 h-5 flex items-center justify-center rounded ${roleStyle.bg}`}>
                                <span className={`text-[10px] font-bold ${roleStyle.text}`}>{pending.player.position}</span>
                              </div>
                              <button
                                onClick={() => setSelectedPlayer({
                                  name: pending.player.name,
                                  team: pending.player.team,
                                  position: pending.player.position,
                                  age: pending.player.age,
                                  apiFootballId: pending.player.apiFootballId,
                                  apiFootballStats: pending.player.apiFootballStats,
                                })}
                                className="text-primary-400 hover:text-primary-300 font-medium text-sm sm:text-base leading-tight cursor-pointer transition-colors"
                              >
                                {pending.player.name}
                              </button>
                            </div>
                          </td>
                          <td className="text-center p-2 text-gray-400">{pending.acquisitionPrice}M</td>
                          <td className="text-center p-2 text-warning-400">{pending.minSalary}M</td>
                          <td className="text-center p-2 border-l border-surface-50/20">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => updatePendingEdit(pending.rosterId, 'newSalary', String(Math.max(pending.minSalary, currentSalary - 1)))}
                                disabled={!inContrattiPhase || isConsolidated || currentSalary <= pending.minSalary}
                                className="w-6 h-6 bg-surface-300 border border-primary-500/30 rounded text-white text-sm disabled:opacity-30"
                              >−</button>
                              <span className="w-10 text-white text-center font-medium">{currentSalary}M</span>
                              <button
                                onClick={() => updatePendingEdit(pending.rosterId, 'newSalary', String(currentSalary + 1))}
                                disabled={!inContrattiPhase || isConsolidated}
                                className="w-6 h-6 bg-surface-300 border border-primary-500/30 rounded text-white text-sm disabled:opacity-30"
                              >+</button>
                            </div>
                          </td>
                          <td className="text-center p-2">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => updatePendingEdit(pending.rosterId, 'newDuration', String(Math.max(1, currentDuration - 1)))}
                                disabled={!inContrattiPhase || isConsolidated || currentDuration <= 1}
                                className="w-6 h-6 bg-surface-300 border border-primary-500/30 rounded text-white text-sm disabled:opacity-30"
                              >−</button>
                              <span className={`w-8 text-center font-medium ${getDurationColor(currentDuration)}`}>{currentDuration}s</span>
                              <button
                                onClick={() => updatePendingEdit(pending.rosterId, 'newDuration', String(Math.min(4, currentDuration + 1)))}
                                disabled={!inContrattiPhase || isConsolidated || currentDuration >= 4}
                                className="w-6 h-6 bg-surface-300 border border-primary-500/30 rounded text-white text-sm disabled:opacity-30"
                              >+</button>
                            </div>
                          </td>
                          <td className="text-center p-2">
                            <span className="text-accent-400 font-medium">{newClausola}M</span>
                          </td>
                          <td className="text-center p-2">
                            <span className="text-warning-400 font-bold">{newRubata}M</span>
                            {edit?.previewData?.validationError && (
                              <span className="text-danger-400 text-xs ml-1" title={edit.previewData.validationError}>!</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Giocatori Usciti dalla Serie A - Solo INDECISI */}
        {exitedContracts.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">⚖️</span>
              <h2 className="text-sm font-bold text-cyan-400 uppercase tracking-wide">
                Giocatori Usciti dalla Serie A ({exitedContracts.length} da decidere)
              </h2>
            </div>
            <p className="text-xs text-gray-400 mb-3">
              Decidi per ogni giocatore: <span className="text-green-400 font-medium">Tieni</span> (entra nei rinnovi) o <span className="text-danger-400 font-medium">Rilascia</span> (scompare). Il consolidamento è bloccato fino a quando non decidi per tutti.
            </p>
            <div className="space-y-3">
              {exitedContracts.map(contract => {
                const roleStyle = getRoleStyle(contract.roster.player.position)
                const exitConfig: Record<string, { bg: string; text: string; label: string }> = {
                  RETROCESSO: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Retrocesso' },
                  ESTERO: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', label: 'Estero' },
                }
                const config = exitConfig[contract.exitReason || ''] || exitConfig.RETROCESSO

                return (
                  <div key={contract.id} className="rounded-xl border p-4 bg-surface-200 border-cyan-500/30">
                    <div className="flex items-center justify-between gap-4">
                      {/* Player info */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {contract.roster.player.apiFootballId ? (
                          <img
                            src={getPlayerPhotoUrl(contract.roster.player.apiFootballId)}
                            alt={contract.roster.player.name}
                            className="w-8 h-8 rounded-full object-cover bg-surface-300 flex-shrink-0"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                          />
                        ) : null}
                        <div className={`w-8 h-8 rounded-lg ${roleStyle.bg} flex items-center justify-center text-white text-xs font-bold`}>
                          {contract.roster.player.position}
                        </div>
                        <TeamLogo team={contract.roster.player.team} />
                        <div className="min-w-0">
                          <button
                            onClick={() => setSelectedPlayer({
                              name: contract.roster.player.name,
                              team: contract.roster.player.team,
                              position: contract.roster.player.position,
                              age: contract.roster.player.age,
                              apiFootballId: contract.roster.player.apiFootballId,
                              apiFootballStats: contract.roster.player.apiFootballStats,
                            })}
                            className="text-primary-400 hover:text-primary-300 font-medium truncate cursor-pointer transition-colors"
                          >
                            {contract.roster.player.name}
                          </button>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${config.bg} ${config.text}`}>
                              {config.label}
                            </span>
                            <span className="text-xs text-gray-500">
                              {contract.salary}M / {contract.duration}sem
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Indemnity info */}
                      <div className="text-right shrink-0">
                        {contract.exitReason === 'ESTERO' && (
                          <p className="text-sm text-cyan-400 font-medium">
                            Indennizzo: {contract.indemnityCompensation}M
                          </p>
                        )}
                        {contract.exitReason === 'RETROCESSO' && (
                          <p className="text-sm text-gray-400">Rilascio gratuito</p>
                        )}
                        <p className="text-xs text-gray-500">Costo se tieni: {contract.salary}M/sem</p>
                      </div>

                      {/* Two separate buttons: Tieni / Rilascia */}
                      {inContrattiPhase && !isConsolidated && (
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => {
                              setExitDecisions(prev => {
                                const next = new Map(prev)
                                next.set(contract.id, 'KEEP')
                                return next
                              })
                            }}
                            className="px-4 py-2 rounded-lg text-sm font-medium transition-all bg-green-500/20 text-green-400 border border-green-500/40 hover:bg-green-500/30"
                          >
                            Tieni
                          </button>
                          <button
                            onClick={() => {
                              setExitDecisions(prev => {
                                const next = new Map(prev)
                                next.set(contract.id, 'RELEASE')
                                return next
                              })
                            }}
                            className="px-4 py-2 rounded-lg text-sm font-medium transition-all bg-danger-500/20 text-danger-400 border border-danger-500/40 hover:bg-danger-500/30"
                          >
                            Rilascia
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Contratti Esistenti */}
        <div>
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-2">
            Contratti ({filteredContracts.length})
          </h2>

          {/* Mobile: Card View */}
          <div className="md:hidden space-y-3">
            {filteredContracts.map(contract => {
              const edit = localEdits[contract.id]
              const roleStyle = getRoleStyle(contract.roster.player.position)
              const currentRubata = contract.rescissionClause + contract.salary
              const newSalary = parseInt(edit?.newSalary || '') || contract.salary
              const newDuration = parseInt(edit?.newDuration || '') || contract.duration
              const newMultiplier = DURATION_MULTIPLIERS[newDuration as keyof typeof DURATION_MULTIPLIERS] || 7
              const newRescissionClause = newSalary * newMultiplier
              const newRubata = newRescissionClause + newSalary
              const hasChanges = newSalary !== contract.salary || newDuration !== contract.duration
              const isMarkedForRelease = localReleases.has(contract.id)
              const releaseCost = Math.ceil((contract.salary * contract.duration) / 2)
              const isKeptExited = contract.isExitedPlayer && exitDecisions.get(contract.id) === 'KEEP'

              // Calcola il minimo ingaggio consentito
              // - Se spalma e durata aumentata: min = ceil(initialSalary / newDuration)
              // - Altrimenti: non può diminuire sotto il salary attuale
              const minSalaryAllowed = contract.canSpalmare && newDuration > 1
                ? Math.ceil(contract.initialSalary / newDuration)
                : contract.salary

              // Issue #207: Cannot increase duration unless salary is also increased
              // Exception: canSpalmare=true cases (spalma allows duration extension without salary increase)
              const hasSalaryIncrease = newSalary > contract.salary
              const canIncreaseDuration = contract.canSpalmare || hasSalaryIncrease

              return (
                <div key={contract.id} className={`bg-surface-200 rounded-lg border p-3 ${
                  isMarkedForRelease ? 'border-danger-500/50 bg-danger-500/10' : 'border-surface-50/20'
                }`}>
                  {/* Header: Player info */}
                  <div className="flex items-center gap-2 mb-3">
                    {contract.roster.player.apiFootballId ? (
                      <img
                        src={getPlayerPhotoUrl(contract.roster.player.apiFootballId)}
                        alt={contract.roster.player.name}
                        className="w-8 h-8 rounded-full object-cover bg-surface-300 flex-shrink-0"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    ) : null}
                    <div className="w-8 h-8 bg-white rounded p-0.5 flex-shrink-0">
                      <TeamLogo team={contract.roster.player.team} />
                    </div>
                    <div className={`w-6 h-6 flex items-center justify-center rounded ${roleStyle.bg}`}>
                      <span className={`text-xs font-bold ${roleStyle.text}`}>{contract.roster.player.position}</span>
                    </div>
                    <button
                      onClick={() => setSelectedPlayer({
                        name: contract.roster.player.name,
                        team: contract.roster.player.team,
                        position: contract.roster.player.position,
                        age: contract.roster.player.age,
                        apiFootballId: contract.roster.player.apiFootballId,
                        apiFootballStats: contract.roster.player.apiFootballStats,
                      })}
                      className={`font-medium flex-1 text-sm sm:text-base leading-tight cursor-pointer transition-colors text-left ${isMarkedForRelease ? 'text-gray-400 line-through' : 'text-primary-400 hover:text-primary-300'}`}
                    >
                      {contract.roster.player.name}
                    </button>
                    {contract.canSpalmare && !isMarkedForRelease && (
                      newSalary < contract.salary ? (
                        <span
                          className="px-1.5 py-0.5 bg-secondary-500/20 border border-secondary-500/40 rounded text-secondary-400 text-[10px] font-bold"
                          title={`Spalma applicato: ${newSalary}M × ${newDuration}s = ${newSalary * newDuration} ≥ ${contract.initialSalary}`}
                        >
                          SPALMATO
                        </span>
                      ) : (
                        <span
                          className="px-1.5 py-0.5 bg-warning-500/20 border border-warning-500/40 rounded text-warning-400 text-[10px] font-bold"
                          title={`Spalma disponibile: Nuovo Ing. × Nuova Dur. ≥ ${contract.initialSalary}M`}
                        >
                          SPALMABILE
                        </span>
                      )
                    )}
                    {isMarkedForRelease && (
                      <span className="text-danger-400 text-[10px] font-bold">DA TAGLIARE</span>
                    )}
                    {isKeptExited && (
                      <span className="px-1.5 py-0.5 bg-green-500/20 border border-green-500/40 rounded text-green-400 text-[10px] font-bold">
                        MANTENUTO
                      </span>
                    )}
                  </div>

                  {/* Player info: Age & Rating */}
                  <div className="flex items-center gap-4 mb-2 text-xs">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-500">Eta:</span>
                      <span className={getAgeColor(contract.roster.player.age)}>
                        {contract.roster.player.age != null ? contract.roster.player.age : '-'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-500">Voto:</span>
                      {contract.roster.player.apiFootballStats?.games?.rating != null ? (
                        <span className="text-primary-400">{Number(contract.roster.player.apiFootballStats.games.rating).toFixed(2)}</span>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </div>
                  </div>

                  {/* Trade info badge */}
                  {contract.roster.acquisitionType === 'TRADE' && (
                    <div className="bg-purple-500/20 border border-purple-500/50 rounded px-2 py-1 mb-2 text-center">
                      <span className="text-purple-400 text-xs font-bold">↔️ SCAMBIO</span>
                    </div>
                  )}

                  {/* Current contract info */}
                  <div className="bg-surface-300/30 rounded p-2 mb-3">
                    <div className="text-[10px] text-gray-500 uppercase mb-1">Contratto Attuale</div>
                    <div className="flex justify-around text-sm">
                      <div className="text-center">
                        <span className="text-gray-500 text-[10px]">Ing.</span>
                        <div className="text-accent-400 font-bold">{contract.salary}M</div>
                      </div>
                      <div className="text-center">
                        <span className="text-gray-500 text-[10px]">Dur.</span>
                        <div className={getDurationColor(contract.duration)}>{contract.duration}s</div>
                      </div>
                      <div className="text-center">
                        <span className="text-gray-500 text-[10px]">Rubata</span>
                        <div className="text-warning-400 font-bold">{currentRubata}M</div>
                      </div>
                    </div>
                  </div>

                  {/* Spalma info box (mobile) */}
                  {contract.canSpalmare && contract.canRenew && inContrattiPhase && !isConsolidated && !isMarkedForRelease && (
                    <div className="bg-warning-500/10 border border-warning-500/30 rounded-lg p-2 mb-3">
                      <div className="flex items-center gap-2 text-warning-400 text-xs font-medium mb-1">
                        <span>💡</span>
                        <span>Spalma disponibile</span>
                      </div>
                      <p className="text-gray-400 text-[11px]">
                        {newDuration <= 1 ? (
                          <>Aumenta la durata per sbloccare la riduzione ingaggio.</>
                        ) : (
                          <>
                            Min. ingaggio con {newDuration}s: <span className="text-secondary-400 font-bold">{minSalaryAllowed}M</span>
                            <span className="text-gray-500"> ({contract.initialSalary} ÷ {newDuration} = {minSalaryAllowed})</span>
                          </>
                        )}
                      </p>
                    </div>
                  )}

                  {/* Renewal inputs (only if can renew) */}
                  {contract.canRenew && inContrattiPhase && !isConsolidated && (
                    <>
                      <div className="flex gap-3 mb-3">
                        <div className="flex-1">
                          <label className="text-[10px] text-gray-500 uppercase block mb-1">Nuovo Ing.</label>
                          <div className="flex items-center">
                            <button
                              onClick={() => updateLocalEdit(contract.id, 'newSalary', String(Math.max(minSalaryAllowed, newSalary - 1)))}
                              disabled={newSalary <= minSalaryAllowed}
                              className="px-3 py-2 bg-surface-300 border border-primary-500/30 rounded-l text-white font-bold disabled:opacity-30"
                              title={contract.canSpalmare && newDuration <= 1 ? 'Aumenta prima la durata per ridurre l\'ingaggio' : undefined}
                            >−</button>
                            <div className="flex-1 px-2 py-2 bg-surface-300 border-y border-primary-500/30 text-white text-center font-medium">
                              {newSalary}M
                            </div>
                            <button
                              onClick={() => updateLocalEdit(contract.id, 'newSalary', String(newSalary + 1))}
                              className="px-3 py-2 bg-surface-300 border border-primary-500/30 rounded-r text-white font-bold"
                            >+</button>
                          </div>
                        </div>
                        <div className="flex-1">
                          <label className="text-[10px] text-gray-500 uppercase block mb-1">Nuova Dur.</label>
                          <div className="flex items-center">
                            <button
                              onClick={() => updateLocalEdit(contract.id, 'newDuration', String(newDuration - 1))}
                              disabled={!contract.canSpalmare && newDuration <= contract.duration || newDuration <= 1}
                              className="px-3 py-2 bg-surface-300 border border-primary-500/30 rounded-l text-white font-bold disabled:opacity-30"
                            >−</button>
                            <div className={`flex-1 px-2 py-2 bg-surface-300 border-y border-primary-500/30 text-center font-medium ${getDurationColor(newDuration)}`}>
                              {newDuration}s
                            </div>
                            <button
                              onClick={() => updateLocalEdit(contract.id, 'newDuration', String(newDuration + 1))}
                              disabled={newDuration >= 4 || !canIncreaseDuration}
                              className="px-3 py-2 bg-surface-300 border border-primary-500/30 rounded-r text-white font-bold disabled:opacity-30"
                              title={!canIncreaseDuration ? 'Aumenta prima l\'ingaggio per estendere la durata' : undefined}
                            >+</button>
                          </div>
                        </div>
                      </div>

                      {/* Results row */}
                      <div className="flex justify-around bg-primary-500/10 rounded p-2 mb-3">
                        <div className="text-center">
                          <div className="text-[10px] text-gray-500 uppercase">Clausola</div>
                          <div className={hasChanges ? 'text-accent-400 font-bold' : 'text-gray-400'}>{newRescissionClause}M</div>
                        </div>
                        <div className="text-center">
                          <div className="text-[10px] text-gray-500 uppercase">Nuova Rub.</div>
                          <div className={hasChanges ? 'text-warning-400 font-bold' : 'text-gray-400'}>{newRubata}M</div>
                        </div>
                      </div>

                      {/* Reset button - only show when there are unsaved changes */}
                      {hasChanges && (
                        <button
                          onClick={() => resetContractToBase(contract)}
                          className="w-full py-2 rounded text-sm font-medium transition-colors bg-gray-500/20 text-gray-300 border border-gray-500/30 hover:bg-gray-500/30 mb-3"
                          title="Annulla modifiche e torna ai valori iniziali"
                        >
                          ↩️ Reset Modifica
                        </button>
                      )}
                    </>
                  )}

                  {/* Release / Undo button */}
                  {inContrattiPhase && !isConsolidated && (
                    isKeptExited ? (
                      <button
                        onClick={() => {
                          setExitDecisions(prev => {
                            const next = new Map(prev)
                            next.delete(contract.id)
                            return next
                          })
                        }}
                        className="w-full py-2 rounded text-sm font-medium transition-colors bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                      >
                        Rimetti tra Usciti
                      </button>
                    ) : (
                      <button
                        onClick={() => toggleRelease(contract.id)}
                        className={`w-full py-2 rounded text-sm font-medium transition-colors ${
                          isMarkedForRelease
                            ? 'bg-danger-500/30 text-danger-300'
                            : 'bg-surface-300 text-danger-400'
                        }`}
                      >
                        {isMarkedForRelease ? 'Annulla Taglio' : `Taglia (${releaseCost}M)`}
                      </button>
                    )
                  )}
                </div>
              )
            })}
          </div>

          {/* Desktop: Table View */}
          <div className="hidden md:block bg-surface-200 rounded-lg border border-surface-50/20 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-300/50 text-xs text-gray-400 uppercase">
                    <th className="text-left p-2">Giocatore</th>
                    <th className="text-center p-2" colSpan={2}>Info</th>
                    <th className="text-center p-2 bg-surface-300/30" colSpan={3}>Contratto Attuale</th>
                    <th className="text-center p-2 bg-primary-500/10 border-l border-surface-50/20" colSpan={4}>Rinnovo</th>
                    <th className="text-center p-2 w-28">Taglio</th>
                  </tr>
                  <tr className="bg-surface-300/30 text-[10px] text-gray-500 uppercase">
                    <th className="p-1"></th>
                    <th className="text-center p-1">Eta</th>
                    <th className="text-center p-1">Voto</th>
                    <th className="text-center p-1">Ing.</th>
                    <th className="text-center p-1">Dur.</th>
                    <th className="text-center p-1">Rubata</th>
                    <th className="text-center p-1 border-l border-surface-50/20">Nuovo Ing.</th>
                    <th className="text-center p-1">Nuova Dur.</th>
                    <th className="text-center p-1">Clausola</th>
                    <th className="text-center p-1">Nuova Rub.</th>
                    <th className="text-center p-1">Azione</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContracts.map(contract => {
                    const edit = localEdits[contract.id]
                    const roleStyle = getRoleStyle(contract.roster.player.position)
                    const currentRubata = contract.rescissionClause + contract.salary
                    const newSalary = parseInt(edit?.newSalary || '') || contract.salary
                    const newDuration = parseInt(edit?.newDuration || '') || contract.duration
                    const newMultiplier = DURATION_MULTIPLIERS[newDuration as keyof typeof DURATION_MULTIPLIERS] || 7
                    const newRescissionClause = newSalary * newMultiplier
                    const newRubata = newRescissionClause + newSalary
                    const hasChanges = newSalary !== contract.salary || newDuration !== contract.duration
                    const isMarkedForRelease = localReleases.has(contract.id)
                    const releaseCost = Math.ceil((contract.salary * contract.duration) / 2)
                    const isKeptExited = contract.isExitedPlayer && exitDecisions.get(contract.id) === 'KEEP'

                    // Calcola il minimo ingaggio consentito (spalma logic)
                    const minSalaryAllowed = contract.canSpalmare && newDuration > 1
                      ? Math.ceil(contract.initialSalary / newDuration)
                      : contract.salary

                    // Issue #207: Cannot increase duration unless salary is also increased
                    // Exception: canSpalmare=true cases (spalma allows duration extension without salary increase)
                    const hasSalaryIncrease = newSalary > contract.salary
                    const canIncreaseDuration = contract.canSpalmare || hasSalaryIncrease

                    return (
                      <tr key={contract.id} className={`border-t border-surface-50/10 hover:bg-surface-300/30 ${
                        isKeptExited ? 'bg-green-500/5' : isMarkedForRelease ? 'bg-danger-500/20 opacity-70' : hasChanges ? 'bg-primary-500/5' : ''
                      }`}>
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            {contract.roster.player.apiFootballId ? (
                              <img
                                src={getPlayerPhotoUrl(contract.roster.player.apiFootballId)}
                                alt={contract.roster.player.name}
                                className="w-6 h-6 rounded-full object-cover bg-surface-300 flex-shrink-0"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                              />
                            ) : null}
                            <div className="w-6 h-6 bg-white rounded p-0.5 flex-shrink-0">
                              <TeamLogo team={contract.roster.player.team} />
                            </div>
                            <div className={`w-5 h-5 flex items-center justify-center rounded ${roleStyle.bg}`}>
                              <span className={`text-[10px] font-bold ${roleStyle.text}`}>{contract.roster.player.position}</span>
                            </div>
                            <button
                              onClick={() => setSelectedPlayer({
                                name: contract.roster.player.name,
                                team: contract.roster.player.team,
                                position: contract.roster.player.position,
                                age: contract.roster.player.age,
                                apiFootballId: contract.roster.player.apiFootballId,
                                apiFootballStats: contract.roster.player.apiFootballStats,
                              })}
                              className={`font-medium text-sm leading-tight cursor-pointer transition-colors ${isMarkedForRelease ? 'text-gray-400 line-through' : 'text-primary-400 hover:text-primary-300'}`}
                            >
                              {contract.roster.player.name}
                            </button>
                            {contract.canSpalmare && !isMarkedForRelease && (
                              newSalary < contract.salary ? (
                                <span
                                  className="px-1.5 py-0.5 bg-secondary-500/20 border border-secondary-500/40 rounded text-secondary-400 text-[10px] font-bold cursor-help"
                                  title={`Spalma applicato: ${newSalary}M × ${newDuration}s = ${newSalary * newDuration} ≥ ${contract.initialSalary}`}
                                >
                                  SPALMATO
                                </span>
                              ) : (
                                <span
                                  className="px-1.5 py-0.5 bg-warning-500/20 border border-warning-500/40 rounded text-warning-400 text-[10px] font-bold cursor-help"
                                  title={`Spalma disponibile: Nuovo Ing. × Nuova Dur. ≥ ${contract.initialSalary}M`}
                                >
                                  SPALMABILE
                                </span>
                              )
                            )}
                            {contract.roster.acquisitionType === 'TRADE' && (
                              <span className="text-purple-400 text-[10px] font-bold px-1 py-0.5 bg-purple-500/20 rounded">↔️ SCAMBIO</span>
                            )}
                            {isMarkedForRelease && (
                              <span className="text-danger-400 text-xs font-medium">DA TAGLIARE</span>
                            )}
                            {isKeptExited && (
                              <span className="px-1.5 py-0.5 bg-green-500/20 border border-green-500/40 rounded text-green-400 text-[10px] font-bold cursor-help"
                                title="Giocatore uscito mantenuto in rosa">
                                MANTENUTO
                              </span>
                            )}
                          </div>
                        </td>
                        <td className={`text-center p-2 ${getAgeColor(contract.roster.player.age)}`}>
                          {contract.roster.player.age != null ? contract.roster.player.age : '-'}
                        </td>
                        <td className="text-center p-2">
                          {contract.roster.player.apiFootballStats?.games?.rating != null ? (
                            <span className="text-primary-400">{Number(contract.roster.player.apiFootballStats.games.rating).toFixed(2)}</span>
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </td>
                        <td className="text-center p-2 text-accent-400 font-medium">{contract.salary}M</td>
                        <td className={`text-center p-2 ${getDurationColor(contract.duration)}`}>{contract.duration}s</td>
                        <td className="text-center p-2 text-warning-400 font-medium">{currentRubata}M</td>
                        <td className="text-center p-2 border-l border-surface-50/20">
                          {contract.canRenew && inContrattiPhase && !isConsolidated ? (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => updateLocalEdit(contract.id, 'newSalary', String(Math.max(minSalaryAllowed, newSalary - 1)))}
                                disabled={newSalary <= minSalaryAllowed}
                                className="w-6 h-6 bg-surface-300 border border-primary-500/30 rounded text-white text-sm disabled:opacity-30"
                                title={contract.canSpalmare && newDuration <= 1 ? 'Aumenta prima la durata' : undefined}
                              >−</button>
                              <span className="w-10 text-white text-center font-medium">{newSalary}M</span>
                              <button
                                onClick={() => updateLocalEdit(contract.id, 'newSalary', String(newSalary + 1))}
                                className="w-6 h-6 bg-surface-300 border border-primary-500/30 rounded text-white text-sm"
                              >+</button>
                            </div>
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </td>
                        <td className="text-center p-2">
                          {contract.canRenew && inContrattiPhase && !isConsolidated ? (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => updateLocalEdit(contract.id, 'newDuration', String(newDuration - 1))}
                                disabled={!contract.canSpalmare && newDuration <= contract.duration || newDuration <= 1}
                                className="w-6 h-6 bg-surface-300 border border-primary-500/30 rounded text-white text-sm disabled:opacity-30"
                              >−</button>
                              <span className={`w-8 text-center font-medium ${getDurationColor(newDuration)}`}>{newDuration}s</span>
                              <button
                                onClick={() => updateLocalEdit(contract.id, 'newDuration', String(newDuration + 1))}
                                disabled={newDuration >= 4 || !canIncreaseDuration}
                                className="w-6 h-6 bg-surface-300 border border-primary-500/30 rounded text-white text-sm disabled:opacity-30"
                                title={!canIncreaseDuration ? 'Aumenta prima l\'ingaggio per estendere la durata' : undefined}
                              >+</button>
                            </div>
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </td>
                        <td className="text-center p-2">
                          <span className={hasChanges ? 'text-accent-400 font-medium' : 'text-gray-400'}>
                            {newRescissionClause}M
                          </span>
                          {edit?.previewData?.validationError && (
                            <span className="text-danger-400 text-xs ml-1" title={edit.previewData.validationError}>!</span>
                          )}
                        </td>
                        <td className="text-center p-2">
                          <span className={hasChanges ? 'text-warning-400 font-bold' : 'text-gray-400'}>
                            {newRubata}M
                          </span>
                        </td>
                        <td className="text-center p-2">
                          <div className="flex items-center justify-center gap-1">
                            {/* Reset button - only show when there are unsaved changes */}
                            {inContrattiPhase && !isConsolidated && contract.canRenew && hasChanges && (
                              <button
                                onClick={() => resetContractToBase(contract)}
                                className="text-xs px-2 py-1 rounded transition-colors bg-gray-500/20 text-gray-300 hover:bg-gray-500/30"
                                title="Annulla modifiche e torna ai valori iniziali"
                              >
                                Reset
                              </button>
                            )}
                            {inContrattiPhase && !isConsolidated && (
                              isKeptExited ? (
                                <button
                                  onClick={() => {
                                    setExitDecisions(prev => {
                                      const next = new Map(prev)
                                      next.delete(contract.id)
                                      return next
                                    })
                                  }}
                                  className="text-xs px-2 py-1 rounded transition-colors bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30"
                                  title="Rimetti nella sezione giocatori usciti"
                                >
                                  Rimetti
                                </button>
                              ) : (
                                <button
                                  onClick={() => toggleRelease(contract.id)}
                                  className={`text-xs px-2 py-1 rounded transition-colors ${
                                    isMarkedForRelease
                                      ? 'bg-danger-500/30 text-danger-300 hover:bg-danger-500/50'
                                      : 'bg-surface-300 text-danger-400 hover:bg-danger-500/20'
                                  }`}
                                  title={isMarkedForRelease ? 'Annulla taglio' : `Taglia giocatore (costo: ${releaseCost}M = ${contract.salary}×${contract.duration}/2)`}
                                >
                                  {isMarkedForRelease ? 'Annulla' : `Taglia ${releaseCost}M`}
                                </button>
                              )
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        {/* Fine sezione contratti esistenti */}
        </div>
        {/* Fine colonna principale */}

          {/* Sidebar - Statistiche Rosa */}
          <div className="xl:w-80 flex-shrink-0">
            {/* Separatore mobile */}
            <div className="xl:hidden mb-4">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-primary-500/50 to-transparent"></div>
                <span className="text-primary-400 text-sm font-medium uppercase tracking-wider">Statistiche Rosa</span>
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-primary-500/50 to-transparent"></div>
              </div>
            </div>
            <div className="sticky top-20 space-y-4">

              {/* Card Slot Disponibili */}
              <div className="bg-surface-200 rounded-xl border border-surface-50/20 p-4">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <span>👥</span> Slot Rosa
                </h3>
                <div className="relative h-4 bg-surface-300 rounded-full overflow-hidden mb-2">
                  <div
                    className={`absolute inset-y-0 left-0 rounded-full transition-all ${
                      effectivePlayerCount > MAX_ROSTER_SIZE
                        ? 'bg-gradient-to-r from-danger-500 to-danger-400'
                        : effectivePlayerCount > MAX_ROSTER_SIZE - 3
                          ? 'bg-gradient-to-r from-warning-500 to-warning-400'
                          : 'bg-gradient-to-r from-secondary-500 to-secondary-400'
                    }`}
                    style={{ width: `${Math.min(100, (effectivePlayerCount / MAX_ROSTER_SIZE) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-sm">
                  <span className={`font-bold ${
                    effectivePlayerCount > MAX_ROSTER_SIZE ? 'text-danger-400' : 'text-white'
                  }`}>
                    {effectivePlayerCount} giocatori
                  </span>
                  <span className="text-gray-500">max {MAX_ROSTER_SIZE}</span>
                </div>
                {requiredReleases > 0 && (
                  <div className="mt-2 p-2 bg-danger-500/20 rounded-lg border border-danger-500/30">
                    <p className="text-danger-400 text-xs font-medium text-center">
                      ⚠️ Taglia {requiredReleases} giocator{requiredReleases === 1 ? 'e' : 'i'}
                    </p>
                  </div>
                )}
              </div>

              {/* Card Composizione Rosa */}
              <div className="bg-surface-200 rounded-xl border border-surface-50/20 p-4">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <span>⚽</span> Composizione
                </h3>
                {/* Mini grafico a barre orizzontali */}
                <div className="space-y-2">
                  {(['P', 'D', 'C', 'A'] as const).map(role => {
                    const count = roleDistribution[role]
                    const maxCount = Math.max(...Object.values(roleDistribution), 1)
                    const style = getRoleStyle(role)
                    return (
                      <div key={role} className="flex items-center gap-2">
                        <div className={`w-6 h-6 flex items-center justify-center rounded ${style.bg}`}>
                          <span className={`text-xs font-bold ${style.text}`}>{role}</span>
                        </div>
                        <div className="flex-1 h-5 bg-surface-300 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${style.bg} transition-all`}
                            style={{ width: `${(count / maxCount) * 100}%` }}
                          />
                        </div>
                        <span className="w-6 text-right text-sm font-bold text-white">{count}</span>
                      </div>
                    )
                  })}
                </div>
                <div className="mt-3 pt-3 border-t border-surface-50/20 flex justify-between text-xs text-gray-500">
                  <span>Totale</span>
                  <span className="text-white font-medium">{Object.values(roleDistribution).reduce((a, b) => a + b, 0)}</span>
                </div>
              </div>

              {/* Card Durata Contratti */}
              <div className="bg-surface-200 rounded-xl border border-surface-50/20 p-4">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <span>📅</span> Scadenze Contratti
                </h3>
                <div className="space-y-2">
                  {([1, 2, 3, 4] as const).map(dur => {
                    const count = durationDistribution[dur]
                    const maxCount = Math.max(...Object.values(durationDistribution), 1)
                    const width = maxCount > 0 ? (count / maxCount) * 100 : 0
                    // Colori inline per evitare problemi con Tailwind purge
                    const colors: Record<number, { bg: string; bar: string; text: string }> = {
                      1: { bg: 'rgba(239, 68, 68, 0.2)', bar: '#ef4444', text: '#f87171' },   // danger/red
                      2: { bg: 'rgba(245, 158, 11, 0.2)', bar: '#f59e0b', text: '#fbbf24' }, // warning/amber
                      3: { bg: 'rgba(99, 102, 241, 0.2)', bar: '#6366f1', text: '#818cf8' }, // primary/indigo
                      4: { bg: 'rgba(34, 197, 94, 0.2)', bar: '#22c55e', text: '#4ade80' },  // secondary/green
                    }
                    const c = colors[dur]
                    return (
                      <div key={dur} className="flex items-center gap-2">
                        <div
                          className="w-8 h-6 flex items-center justify-center rounded"
                          style={{ backgroundColor: c.bg }}
                        >
                          <span className="text-xs font-bold" style={{ color: c.text }}>{dur}s</span>
                        </div>
                        <div className="flex-1 h-5 bg-surface-300 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              backgroundColor: c.bar,
                              width: `${Math.max(width, count > 0 ? 10 : 0)}%`
                            }}
                          />
                        </div>
                        <span className="w-6 text-right text-sm font-bold text-white">{count}</span>
                      </div>
                    )
                  })}
                </div>
                <div className="mt-3 pt-3 border-t border-surface-50/20 text-[10px] text-gray-500">
                  <div className="flex justify-between">
                    <span style={{ color: '#f87171' }}>● Urgente</span>
                    <span style={{ color: '#4ade80' }}>● Lungo termine</span>
                  </div>
                </div>
              </div>

              {/* Card Statistiche Ingaggi */}
              <div className="bg-surface-200 rounded-xl border border-surface-50/20 p-4">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <span>💰</span> Ingaggi
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-surface-300/50 rounded-lg p-3 text-center">
                    <div className="text-[10px] text-gray-500 uppercase">Min</div>
                    <div className="text-lg font-bold text-secondary-400">{salaryStats.min}M</div>
                  </div>
                  <div className="bg-surface-300/50 rounded-lg p-3 text-center">
                    <div className="text-[10px] text-gray-500 uppercase">Max</div>
                    <div className="text-lg font-bold text-danger-400">{salaryStats.max}M</div>
                  </div>
                  <div className="bg-surface-300/50 rounded-lg p-3 text-center">
                    <div className="text-[10px] text-gray-500 uppercase">Media</div>
                    <div className="text-lg font-bold text-primary-400">{salaryStats.avg}M</div>
                  </div>
                  <div className="bg-surface-300/50 rounded-lg p-3 text-center">
                    <div className="text-[10px] text-gray-500 uppercase">Totale</div>
                    <div className="text-lg font-bold text-warning-400">{salaryStats.total}M</div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </main>

      {/* Sticky Budget Bar - Prominente */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-surface-200 via-surface-200 to-surface-200 border-t-2 border-primary-500/50 z-40 shadow-lg shadow-black/30">
        <div className="max-w-[1600px] mx-auto px-4 py-3">
          {/* Mobile: layout con pulsanti azione fissi */}
          <div className="md:hidden">
            {/* Riga pulsanti Salva/Consolida - sempre visibili su mobile */}
            {inContrattiPhase && !isConsolidated && (
              <div className="flex items-center justify-between gap-2 mb-2">
                {/* Indicatore stato */}
                {hasUnsavedChanges ? (
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-warning-500/20 border border-warning-500/40 rounded-lg">
                    <span className="w-2 h-2 bg-warning-400 rounded-full animate-pulse"></span>
                    <span className="text-warning-400 text-[10px] font-medium">Da salvare</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-secondary-500/20 border border-secondary-500/40 rounded-lg">
                    <span className="text-secondary-400 text-[10px] font-medium">✓ Salvato</span>
                  </div>
                )}
                {/* Pulsanti azione */}
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={hasUnsavedChanges ? "accent" : "secondary"}
                    onClick={handleSaveDrafts}
                    disabled={isSavingDrafts}
                  >
                    {isSavingDrafts ? 'Salvando...' : 'Salva'}
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleConsolidate}
                    disabled={isConsolidating || !canConsolidate}
                    title={consolidateBlockReason}
                  >
                    {isConsolidating ? '...' : 'Consolida'}
                  </Button>
                </div>
              </div>
            )}
            {isConsolidated && (
              <div className="flex items-center justify-center mb-2 px-3 py-1.5 bg-secondary-500/20 border border-secondary-500/40 rounded-lg">
                <span className="text-secondary-400 text-xs font-medium">✓ Consolidato</span>
              </div>
            )}
            {/* Griglia budget compatta */}
            <div className="grid gap-1.5 text-center grid-cols-4">
              <div className="bg-surface-300/50 rounded p-1.5">
                <div className="text-[8px] text-gray-500 uppercase">Budget</div>
                <div className="text-accent-400 font-bold text-sm">{memberBudget}M</div>
              </div>
              <div className="bg-surface-300/50 rounded p-1.5">
                <div className="text-[8px] text-gray-500 uppercase">Ingaggi</div>
                <div className="text-warning-400 font-bold text-sm">{projectedSalaries}M</div>
              </div>
              <div className="bg-surface-300/50 rounded p-1.5">
                <div className="text-[8px] text-gray-500 uppercase">Tagli</div>
                <div className="text-danger-400 font-bold text-sm">{totalReleaseCost}M</div>
              </div>
              <div className={`rounded p-1.5 ${residuoContratti < 0 ? 'bg-danger-500/30' : 'bg-secondary-500/30'}`}>
                <div className="text-[8px] text-white uppercase font-medium">Residuo</div>
                <div className={`font-bold text-sm ${residuoContratti < 0 ? 'text-danger-300' : 'text-secondary-300'}`}>
                  {residuoContratti}M
                </div>
              </div>
            </div>
          </div>

          {/* Desktop: layout orizzontale prominente */}
          <div className="hidden md:flex items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3 bg-surface-300/50 px-4 py-2 rounded-lg">
                <span className="text-sm text-gray-400">Budget Iniziale</span>
                <span className="text-accent-400 font-bold text-xl">{memberBudget}M</span>
              </div>
              <span className="text-gray-500 text-xl">−</span>
              <div className="flex items-center gap-3 bg-surface-300/50 px-4 py-2 rounded-lg">
                <span className="text-sm text-gray-400">Ingaggi</span>
                <span className="text-warning-400 font-bold text-xl">{projectedSalaries}M</span>
              </div>
              <span className="text-gray-500 text-xl">−</span>
              <div className="flex items-center gap-3 bg-surface-300/50 px-4 py-2 rounded-lg">
                <span className="text-sm text-gray-400">Tagli</span>
                <span className="text-danger-400 font-bold text-xl">{totalReleaseCost}M</span>
              </div>
              <span className="text-gray-500 text-xl">=</span>
              <div className={`flex items-center gap-3 px-5 py-2 rounded-lg ${
                residuoContratti < 0 ? 'bg-danger-500/30 border border-danger-500/50' : 'bg-secondary-500/30 border border-secondary-500/50'
              }`}>
                <span className="text-sm text-white font-medium">Residuo</span>
                <span className={`font-bold text-2xl ${
                  residuoContratti < 0 ? 'text-danger-300' : 'text-secondary-300'
                }`}>
                  {residuoContratti}M
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Indicatore modifiche non salvate - Desktop */}
              {hasUnsavedChanges && inContrattiPhase && !isConsolidated && (
                <div className="flex items-center gap-2 px-3 py-2 bg-warning-500/20 border border-warning-500/40 rounded-lg">
                  <span className="w-2 h-2 bg-warning-400 rounded-full animate-pulse"></span>
                  <span className="text-warning-400 text-sm font-medium">Modifiche da salvare</span>
                </div>
              )}
              {pendingContracts.length > 0 && (
                <div className="bg-warning-500/20 border border-warning-500/30 px-3 py-2 rounded-lg">
                  <span className="text-warning-400 text-sm font-medium">{pendingContracts.length} da impostare</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Player Stats Modal */}
      <PlayerStatsModal
        isOpen={!!selectedPlayer}
        onClose={() => setSelectedPlayer(null)}
        player={selectedPlayer}
      />
    </div>
  )
}
