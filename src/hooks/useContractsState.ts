import { useState, useEffect, useMemo } from 'react'
import { contractApi, leagueApi } from '../services/api'
import type { PlayerInfo } from '../components/PlayerStatsModal'
import haptic from '../utils/haptics'
import type {
  Contract,
  PendingContract,
  ReleasedPlayer,
  LocalEdit,
} from '../types/contracts.types'
import { MAX_ROSTER_SIZE } from '../types/contracts.types'

export function useContractsState(leagueId: string) {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [pendingContracts, setPendingContracts] = useState<PendingContract[]>([])
  const [memberBudget, setMemberBudget] = useState(0)
  const [inContrattiPhase, setInContrattiPhase] = useState(false)
  const [isLeagueAdmin, setIsLeagueAdmin] = useState(false)
  const [isConsolidated, setIsConsolidated] = useState(false)
  const [releasedPlayers, setReleasedPlayers] = useState<ReleasedPlayer[]>([])
  const [consolidatedAt, setConsolidatedAt] = useState<string | null>(null)
  const [apiRenewalCost, setApiRenewalCost] = useState(0)  // Costo rinnovi dalla API (post-consolidamento)
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

      // Skip if values are invalid
      if (isNaN(newSalary) || isNaN(newDuration) || newSalary <= 0 || newDuration <= 0) return

      // Confronta con i valori salvati (draft se esiste, altrimenti base)
      const savedSalary = contract.draftSalary ?? contract.salary
      const savedDuration = contract.draftDuration ?? contract.duration

      // Salva se i valori sono diversi da quelli salvati
      if (newSalary !== savedSalary || newDuration !== savedDuration) {
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
      haptic.save()
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
      haptic.success()
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

  // Calcola effetto netto rinnovi/spalmature sulla differenza ingaggio
  // Positivo = costo (aumenti ingaggio), Negativo = risparmio (spalmature)
  const totalRenewalCost = useMemo(() => {
    // After consolidation, use the API value
    if (isConsolidated) {
      return apiRenewalCost
    }

    // Before consolidation, calculate net effect from local edits
    let total = 0
    contracts.forEach(contract => {
      const edit = localEdits[contract.id]
      if (edit && edit.isModified) {
        const newSalary = parseInt(edit.newSalary) || contract.salary
        const salaryDiff = newSalary - contract.salary
        total += salaryDiff  // Can be positive (renewal) or negative (spalma)
      }
    })
    return total
  }, [contracts, localEdits, isConsolidated, apiRenewalCost])

  // Calcola costo totale tagli (esclusi giocatori usciti dalla lista - costo 0)
  const totalReleaseCost = useMemo(() => {
    // After consolidation, use the releasedPlayers data from ContractHistory
    if (isConsolidated && releasedPlayers.length > 0) {
      return releasedPlayers.reduce((sum, rp) => sum + rp.releaseCost, 0)
    }

    // Before consolidation, use local state
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
  }, [contracts, localReleases, isConsolidated, releasedPlayers])

  // Calcola totale indennizzi per giocatori ESTERO con decisione RELEASE
  const totalIndemnities = useMemo(() => {
    // After consolidation, use the releasedPlayers data from ContractHistory
    if (isConsolidated && releasedPlayers.length > 0) {
      return releasedPlayers
        .filter(rp => rp.releaseType === 'RELEASE_ESTERO' && rp.indemnityAmount)
        .reduce((sum, rp) => sum + (rp.indemnityAmount || 0), 0)
    }

    // Before consolidation, use local state
    let total = 0
    contracts.forEach(contract => {
      if (contract.isExitedPlayer &&
          contract.exitReason === 'ESTERO' &&
          exitDecisions.get(contract.id) === 'RELEASE') {
        total += contract.indemnityCompensation || 0
      }
    })
    return total
  }, [contracts, exitDecisions, isConsolidated, releasedPlayers])

  // Residuo = Budget - Ingaggi - Tagli + Indennizzi
  // I rinnovi/spalmature sono riflessi negli Ingaggi (che variano automaticamente)
  // Il costo del rinnovo viene scalato dal budget solo al momento del consolidamento
  const residuoContratti = useMemo(() => {
    // Forza ricalcolo quando cambiano i tagli locali o le decisioni usciti
    return memberBudget - projectedSalaries - totalReleaseCost + totalIndemnities
  }, [memberBudget, projectedSalaries, totalReleaseCost, totalIndemnities, localReleases, exitDecisions])

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

  return {
    // State
    contracts,
    pendingContracts,
    memberBudget,
    inContrattiPhase,
    isLeagueAdmin,
    isConsolidated,
    releasedPlayers,
    consolidatedAt,
    apiRenewalCost,
    isConsolidating,
    isSavingDrafts,
    localEdits,
    pendingEdits,
    localReleases,
    exitDecisions,
    isLoading,
    error,
    success,
    filterRole,
    searchQuery,
    selectedPlayer,

    // Setters
    setFilterRole,
    setSearchQuery,
    setSelectedPlayer,
    setExitDecisions,

    // Functions
    updateLocalEdit,
    resetContractToBase,
    contractHasUnsavedChanges,
    updatePendingEdit,
    toggleRelease,
    handleSaveDrafts,
    handleConsolidate,

    // Derived / computed
    projectedSalaries,
    totalRenewalCost,
    totalReleaseCost,
    totalIndemnities,
    residuoContratti,
    effectivePlayerCount,
    requiredReleases,
    canConsolidate,
    consolidateBlockReason,
    exitedContracts,
    filteredContracts,
    filteredPending,
    roleDistribution,
    durationDistribution,
    hasUnsavedChanges,
    salaryStats,
  }
}
