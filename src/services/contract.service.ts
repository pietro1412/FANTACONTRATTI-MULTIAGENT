import { PrismaClient, MemberStatus, RosterStatus, AcquisitionType } from '@prisma/client'
import { recordMovement } from './movement.service'

const prisma = new PrismaClient()

export interface ServiceResult {
  success: boolean
  message?: string
  data?: unknown
}

// Moltiplicatori per calcolo clausola rescissione (da specifica)
const DURATION_MULTIPLIERS: Record<number, number> = {
  4: 11,  // 4 semestri = moltiplicatore 11
  3: 9,   // 3 semestri = moltiplicatore 9
  2: 7,   // 2 semestri = moltiplicatore 7
  1: 4,   // 1 semestre = moltiplicatore 4
}

const MAX_DURATION = 4 // Max 4 semestri
const MIN_SALARY_PERCENTAGE = 0.1 // 10% del prezzo acquisto per acquisti non-PRIMO MERCATO
const MAX_ROSTER_SIZE = 29 // Massimo giocatori in rosa dopo consolidamento

function getMultiplier(duration: number): number {
  return DURATION_MULTIPLIERS[duration] ?? 4
}

export function calculateRescissionClause(salary: number, duration: number): number {
  return salary * getMultiplier(duration)
}

// Costo taglio = (ingaggio × durata rimanente) / 2
export function calculateReleaseCost(salary: number, duration: number): number {
  return Math.ceil((salary * duration) / 2)
}

// Verifica se la lega è in fase CONTRATTI
async function isInContrattiPhase(leagueId: string): Promise<boolean> {
  const activeSession = await prisma.marketSession.findFirst({
    where: {
      leagueId,
      status: 'ACTIVE',
      currentPhase: 'CONTRATTI',
    },
  })
  return !!activeSession
}

// Validazione rinnovo secondo le regole di business
export function isValidRenewal(
  currentSalary: number,
  currentDuration: number,
  newSalary: number,
  newDuration: number,
  initialSalary: number
): { valid: boolean; reason?: string } {
  // Max duration check
  if (newDuration > MAX_DURATION) {
    return { valid: false, reason: `Durata massima: ${MAX_DURATION} semestri` }
  }

  // Caso SPALMAINGAGGI: durata corrente = 1
  if (currentDuration === 1) {
    // Può spalmare: newSalary * newDuration >= initialSalary
    const isValid = newSalary * newDuration >= initialSalary
    return {
      valid: isValid,
      reason: isValid ? undefined : `Spalma non valido: ${newSalary} x ${newDuration} = ${newSalary * newDuration} < ${initialSalary} (ingaggio iniziale)`
    }
  }

  // Caso normale: no ribasso
  if (newSalary < currentSalary) {
    return { valid: false, reason: `Ingaggio non può diminuire: ${newSalary} < ${currentSalary}` }
  }
  if (newDuration < currentDuration) {
    return { valid: false, reason: `Durata non può diminuire: ${newDuration} < ${currentDuration}` }
  }

  return { valid: true }
}

// ==================== GET CONTRACTS ====================

export async function getContracts(leagueId: string, userId: string): Promise<ServiceResult> {
  // Verify membership
  const member = await prisma.leagueMember.findFirst({
    where: {
      leagueId,
      userId,
      status: MemberStatus.ACTIVE,
    },
  })

  if (!member) {
    return { success: false, message: 'Non sei membro di questa lega' }
  }

  // Check if in CONTRATTI phase
  const inContrattiPhase = await isInContrattiPhase(leagueId)

  // Get roster with contracts and draft contracts
  const roster = await prisma.playerRoster.findMany({
    where: {
      leagueMemberId: member.id,
      status: RosterStatus.ACTIVE,
    },
    include: {
      player: true,
      contract: true,
      draftContract: true,
    },
    orderBy: {
      player: {
        position: 'asc',
      },
    },
  })

  // Separate players with and without contracts
  const playersWithContract = roster.filter(r => r.contract)
  const playersWithoutContract = roster.filter(r => !r.contract)

  // Add calculated fields for contracts (including draft values)
  const contracts = playersWithContract.map(r => ({
    id: r.contract!.id,
    salary: r.contract!.salary,
    duration: r.contract!.duration,
    initialSalary: r.contract!.initialSalary,
    initialDuration: r.contract!.initialDuration,
    rescissionClause: calculateRescissionClause(r.contract!.salary, r.contract!.duration),
    canRenew: r.contract!.duration < MAX_DURATION,
    canSpalmare: r.contract!.duration === 1,
    // Draft values (if any saved)
    draftSalary: r.contract!.draftSalary,
    draftDuration: r.contract!.draftDuration,
    draftReleased: r.contract!.draftReleased,  // Marcato per taglio
    roster: {
      id: r.id,
      player: r.player,
      acquisitionPrice: r.acquisitionPrice,
      acquisitionType: r.acquisitionType,
    },
  }))

  // Players needing contract setup (include any saved draft values)
  const pendingContracts = playersWithoutContract.map(r => ({
    rosterId: r.id,
    player: r.player,
    acquisitionPrice: r.acquisitionPrice,
    acquisitionType: r.acquisitionType,
    minSalary: r.acquisitionType === AcquisitionType.FIRST_MARKET
      ? 1
      : Math.ceil(r.acquisitionPrice * MIN_SALARY_PERCENTAGE),
    // Draft values (if any saved)
    draftSalary: r.draftContract?.salary || null,
    draftDuration: r.draftContract?.duration || null,
  }))

  return {
    success: true,
    data: {
      contracts,
      pendingContracts,
      memberBudget: member.currentBudget,
      inContrattiPhase,
    },
  }
}

export async function getContractById(
  contractId: string,
  userId: string
): Promise<ServiceResult> {
  const contract = await prisma.playerContract.findUnique({
    where: { id: contractId },
    include: {
      roster: {
        include: {
          player: true,
          leagueMember: {
            include: {
              user: {
                select: { id: true, username: true },
              },
              league: true,
            },
          },
        },
      },
    },
  })

  if (!contract) {
    return { success: false, message: 'Contratto non trovato' }
  }

  // Verify ownership
  if (contract.roster.leagueMember.user.id !== userId) {
    return { success: false, message: 'Non sei il proprietario di questo contratto' }
  }

  const rescissionClause = calculateRescissionClause(contract.salary, contract.duration)
  const canRenew = contract.duration < MAX_DURATION
  const canSpalmare = contract.duration === 1
  const inContrattiPhase = await isInContrattiPhase(contract.roster.leagueMember.leagueId)

  return {
    success: true,
    data: {
      contract: {
        ...contract,
        rescissionClause,
        canRenew,
        canSpalmare,
        maxDuration: MAX_DURATION,
      },
      memberBudget: contract.roster.leagueMember.currentBudget,
      inContrattiPhase,
    },
  }
}

// ==================== CREATE CONTRACT ====================

export async function createContract(
  rosterId: string,
  userId: string,
  salary: number,
  duration: number
): Promise<ServiceResult> {
  // Get roster with member info
  const roster = await prisma.playerRoster.findUnique({
    where: { id: rosterId },
    include: {
      player: true,
      contract: true,
      leagueMember: {
        include: {
          user: { select: { id: true } },
          league: true,
        },
      },
    },
  })

  if (!roster) {
    return { success: false, message: 'Giocatore non trovato nella rosa' }
  }

  // Verify ownership
  if (roster.leagueMember.user.id !== userId) {
    return { success: false, message: 'Non sei il proprietario di questo giocatore' }
  }

  // Check if already has contract
  if (roster.contract) {
    return { success: false, message: 'Questo giocatore ha già un contratto' }
  }

  // Check if in CONTRATTI phase
  const inContrattiPhase = await isInContrattiPhase(roster.leagueMember.leagueId)
  if (!inContrattiPhase) {
    return { success: false, message: 'Puoi impostare contratti solo durante la fase CONTRATTI' }
  }

  // Validate duration
  if (duration < 1 || duration > MAX_DURATION) {
    return { success: false, message: `Durata deve essere tra 1 e ${MAX_DURATION} semestri` }
  }

  // Validate salary
  if (salary < 1) {
    return { success: false, message: 'Ingaggio minimo: 1' }
  }

  // Check minimum salary rule for non-PRIMO MERCATO acquisitions
  if (roster.acquisitionType !== AcquisitionType.FIRST_MARKET) {
    const minSalary = Math.ceil(roster.acquisitionPrice * MIN_SALARY_PERCENTAGE)
    if (salary < minSalary) {
      return { success: false, message: `Ingaggio minimo per questo giocatore: ${minSalary} (10% del prezzo acquisto ${roster.acquisitionPrice})` }
    }
  }

  // Calculate rescission clause
  const rescissionClause = calculateRescissionClause(salary, duration)

  // Create contract
  const contract = await prisma.playerContract.create({
    data: {
      rosterId,
      leagueMemberId: roster.leagueMember.id,
      salary,
      duration,
      initialSalary: salary,
      initialDuration: duration,
      rescissionClause,
    },
    include: {
      roster: {
        include: {
          player: true,
        },
      },
    },
  })

  return {
    success: true,
    message: `Contratto impostato per ${roster.player.name}: ${salary}/sem x ${duration} semestri`,
    data: {
      contract: {
        ...contract,
        rescissionClause,
        canRenew: duration < MAX_DURATION,
        canSpalmare: duration === 1,
      },
    },
  }
}

// ==================== RENEW CONTRACT ====================

export async function renewContract(
  contractId: string,
  userId: string,
  newSalary: number,
  newDuration: number
): Promise<ServiceResult> {
  // Get contract with all relations
  const contract = await prisma.playerContract.findUnique({
    where: { id: contractId },
    include: {
      roster: {
        include: {
          player: true,
          leagueMember: {
            include: {
              user: { select: { id: true } },
              league: true,
            },
          },
        },
      },
    },
  })

  if (!contract) {
    return { success: false, message: 'Contratto non trovato' }
  }

  // Verify ownership
  if (contract.roster.leagueMember.user.id !== userId) {
    return { success: false, message: 'Non sei il proprietario di questo contratto' }
  }

  // Check if in CONTRATTI phase
  const inContrattiPhase = await isInContrattiPhase(contract.roster.leagueMember.leagueId)
  if (!inContrattiPhase) {
    return { success: false, message: 'Puoi rinnovare contratti solo durante la fase CONTRATTI' }
  }

  // Validate salary
  if (newSalary < 1) {
    return { success: false, message: 'Ingaggio minimo: 1' }
  }

  // Validate duration
  if (newDuration < 1 || newDuration > MAX_DURATION) {
    return { success: false, message: `Durata deve essere tra 1 e ${MAX_DURATION} semestri` }
  }

  // Validate renewal according to business rules
  const validation = isValidRenewal(
    contract.salary,
    contract.duration,
    newSalary,
    newDuration,
    contract.initialSalary
  )

  if (!validation.valid) {
    return { success: false, message: validation.reason }
  }

  // Calculate renewal cost (difference in total salary commitment)
  const currentValue = contract.salary * contract.duration
  const newValue = newSalary * newDuration
  const renewalCost = Math.max(0, newValue - currentValue)

  // Check budget
  const member = contract.roster.leagueMember
  if (renewalCost > member.currentBudget) {
    return { success: false, message: `Budget insufficiente. Costo rinnovo: ${renewalCost}, Budget: ${member.currentBudget}` }
  }

  // Calculate new rescission clause
  const newRescissionClause = calculateRescissionClause(newSalary, newDuration)

  // Update contract
  const updatedContract = await prisma.playerContract.update({
    where: { id: contractId },
    data: {
      salary: newSalary,
      duration: newDuration,
      rescissionClause: newRescissionClause,
      renewalHistory: {
        ...(contract.renewalHistory as object || {}),
        [new Date().toISOString()]: {
          oldSalary: contract.salary,
          oldDuration: contract.duration,
          newSalary,
          newDuration,
          cost: renewalCost,
        },
      },
    },
    include: {
      roster: {
        include: {
          player: true,
        },
      },
    },
  })

  // Deduct budget
  if (renewalCost > 0) {
    await prisma.leagueMember.update({
      where: { id: member.id },
      data: {
        currentBudget: {
          decrement: renewalCost,
        },
      },
    })
  }

  // Get active market session
  const activeSession = await prisma.marketSession.findFirst({
    where: {
      leagueId: contract.roster.leagueMember.leagueId,
      status: 'ACTIVE',
    },
  })

  // Record movement for CONTRACT_RENEW
  await recordMovement({
    leagueId: contract.roster.leagueMember.leagueId,
    playerId: contract.roster.playerId,
    movementType: 'CONTRACT_RENEW',
    toMemberId: member.id, // Player stays with the same owner
    price: renewalCost,
    oldSalary: contract.salary,
    oldDuration: contract.duration,
    oldClause: calculateRescissionClause(contract.salary, contract.duration),
    newSalary,
    newDuration,
    newClause: newRescissionClause,
    marketSessionId: activeSession?.id,
  })

  return {
    success: true,
    message: `Contratto di ${contract.roster.player.name} rinnovato. Costo: ${renewalCost}`,
    data: {
      contract: updatedContract,
      renewalCost,
      newBudget: member.currentBudget - renewalCost,
    },
  }
}

// ==================== RELEASE PLAYER ====================

export async function releasePlayer(
  contractId: string,
  userId: string
): Promise<ServiceResult> {
  // Get contract with all relations
  const contract = await prisma.playerContract.findUnique({
    where: { id: contractId },
    include: {
      roster: {
        include: {
          player: true,
          leagueMember: {
            include: {
              user: { select: { id: true } },
              league: true,
            },
          },
        },
      },
    },
  })

  if (!contract) {
    return { success: false, message: 'Contratto non trovato' }
  }

  // Verify ownership
  if (contract.roster.leagueMember.user.id !== userId) {
    return { success: false, message: 'Non sei il proprietario di questo contratto' }
  }

  // Check if in CONTRATTI phase
  const inContrattiPhase = await isInContrattiPhase(contract.roster.leagueMember.leagueId)
  if (!inContrattiPhase) {
    return { success: false, message: 'Puoi svincolare giocatori solo durante la fase CONTRATTI' }
  }

  // Calculate release cost = (ingaggio × durata) / 2
  const releaseCost = calculateReleaseCost(contract.salary, contract.duration)

  // Check budget
  const member = contract.roster.leagueMember
  if (releaseCost > member.currentBudget) {
    return { success: false, message: `Budget insufficiente. Costo taglio: ${releaseCost}, Budget: ${member.currentBudget}` }
  }

  const playerName = contract.roster.player.name

  // Delete contract
  await prisma.playerContract.delete({
    where: { id: contractId },
  })

  // Update roster status to RELEASED
  await prisma.playerRoster.update({
    where: { id: contract.rosterId },
    data: {
      status: RosterStatus.RELEASED,
      releasedAt: new Date(),
    },
  })

  // Deduct budget
  await prisma.leagueMember.update({
    where: { id: member.id },
    data: {
      currentBudget: {
        decrement: releaseCost,
      },
    },
  })

  // Get active market session
  const activeSession = await prisma.marketSession.findFirst({
    where: {
      leagueId: contract.roster.leagueMember.leagueId,
      status: 'ACTIVE',
    },
  })

  // Record movement for RELEASE
  await recordMovement({
    leagueId: contract.roster.leagueMember.leagueId,
    playerId: contract.roster.playerId,
    movementType: 'RELEASE',
    fromMemberId: member.id,
    price: releaseCost,
    oldSalary: contract.salary,
    oldDuration: contract.duration,
    oldClause: calculateRescissionClause(contract.salary, contract.duration),
    marketSessionId: activeSession?.id,
  })

  return {
    success: true,
    message: `${playerName} svincolato. Costo taglio: ${releaseCost}M (${contract.salary}×${contract.duration}/2)`,
    data: {
      releaseCost,
      newBudget: member.currentBudget - releaseCost,
    },
  }
}

// ==================== CALCULATE PREVIEW ====================

export async function previewRenewal(
  contractId: string,
  userId: string,
  newSalary: number,
  newDuration: number
): Promise<ServiceResult> {
  const contract = await prisma.playerContract.findUnique({
    where: { id: contractId },
    include: {
      roster: {
        include: {
          leagueMember: {
            include: {
              user: { select: { id: true } },
            },
          },
        },
      },
    },
  })

  if (!contract) {
    return { success: false, message: 'Contratto non trovato' }
  }

  if (contract.roster.leagueMember.user.id !== userId) {
    return { success: false, message: 'Non autorizzato' }
  }

  // Validate renewal
  const validation = isValidRenewal(
    contract.salary,
    contract.duration,
    newSalary,
    newDuration,
    contract.initialSalary
  )

  // Calculate costs
  const currentValue = contract.salary * contract.duration
  const newValue = newSalary * newDuration
  const renewalCost = Math.max(0, newValue - currentValue)
  const newRescissionClause = calculateRescissionClause(newSalary, newDuration)

  return {
    success: true,
    data: {
      currentSalary: contract.salary,
      currentDuration: contract.duration,
      currentClause: calculateRescissionClause(contract.salary, contract.duration),
      initialSalary: contract.initialSalary,
      newSalary,
      newDuration,
      renewalCost,
      newRescissionClause,
      canAfford: renewalCost <= contract.roster.leagueMember.currentBudget,
      isValid: validation.valid,
      validationError: validation.reason,
      isSpalmaingaggi: contract.duration === 1,
    },
  }
}

// ==================== PREVIEW CONTRACT CREATION ====================

export async function previewContract(
  rosterId: string,
  userId: string,
  salary: number,
  duration: number
): Promise<ServiceResult> {
  const roster = await prisma.playerRoster.findUnique({
    where: { id: rosterId },
    include: {
      player: true,
      leagueMember: {
        include: {
          user: { select: { id: true } },
        },
      },
    },
  })

  if (!roster) {
    return { success: false, message: 'Giocatore non trovato' }
  }

  if (roster.leagueMember.user.id !== userId) {
    return { success: false, message: 'Non autorizzato' }
  }

  // Calculate minimum salary
  const minSalary = roster.acquisitionType === AcquisitionType.FIRST_MARKET
    ? 1
    : Math.ceil(roster.acquisitionPrice * MIN_SALARY_PERCENTAGE)

  const isValidSalary = salary >= minSalary
  const isValidDuration = duration >= 1 && duration <= MAX_DURATION
  const rescissionClause = calculateRescissionClause(salary, duration)

  return {
    success: true,
    data: {
      player: roster.player,
      acquisitionPrice: roster.acquisitionPrice,
      acquisitionType: roster.acquisitionType,
      minSalary,
      salary,
      duration,
      rescissionClause,
      isValid: isValidSalary && isValidDuration,
      validationError: !isValidSalary
        ? `Ingaggio minimo: ${minSalary}`
        : (!isValidDuration ? `Durata deve essere tra 1 e ${MAX_DURATION}` : undefined),
    },
  }
}

// ==================== CONTRACT CONSOLIDATION ====================

// Get consolidation status for the current manager
export async function getConsolidationStatus(
  leagueId: string,
  userId: string
): Promise<ServiceResult> {
  const member = await prisma.leagueMember.findFirst({
    where: {
      leagueId,
      userId,
      status: MemberStatus.ACTIVE,
    },
  })

  if (!member) {
    return { success: false, message: 'Non sei membro di questa lega' }
  }

  // Get active session in CONTRATTI phase
  const activeSession = await prisma.marketSession.findFirst({
    where: {
      leagueId,
      status: 'ACTIVE',
      currentPhase: 'CONTRATTI',
    },
  })

  if (!activeSession) {
    return {
      success: true,
      data: {
        inContrattiPhase: false,
        isConsolidated: false,
        consolidatedAt: null,
      },
    }
  }

  // Check if manager has consolidated
  const consolidation = await prisma.contractConsolidation.findUnique({
    where: {
      sessionId_memberId: {
        sessionId: activeSession.id,
        memberId: member.id,
      },
    },
  })

  return {
    success: true,
    data: {
      inContrattiPhase: true,
      sessionId: activeSession.id,
      isConsolidated: !!consolidation,
      consolidatedAt: consolidation?.consolidatedAt || null,
    },
  }
}

// Consolidate contracts for the current manager
export async function consolidateContracts(
  leagueId: string,
  userId: string,
  renewals?: { contractId: string; salary: number; duration: number }[],
  newContracts?: { rosterId: string; salary: number; duration: number }[]
): Promise<ServiceResult> {
  const member = await prisma.leagueMember.findFirst({
    where: {
      leagueId,
      userId,
      status: MemberStatus.ACTIVE,
    },
  })

  if (!member) {
    return { success: false, message: 'Non sei membro di questa lega' }
  }

  // Get active session in CONTRATTI phase
  const activeSession = await prisma.marketSession.findFirst({
    where: {
      leagueId,
      status: 'ACTIVE',
      currentPhase: 'CONTRATTI',
    },
  })

  if (!activeSession) {
    return { success: false, message: 'Non siamo in fase CONTRATTI' }
  }

  // Check if already consolidated
  const existingConsolidation = await prisma.contractConsolidation.findUnique({
    where: {
      sessionId_memberId: {
        sessionId: activeSession.id,
        memberId: member.id,
      },
    },
  })

  if (existingConsolidation) {
    return { success: false, message: 'Hai già consolidato i tuoi contratti' }
  }

  // Process all operations in a transaction
  try {
    await prisma.$transaction(async (tx) => {
      // 1. Process all renewals
      if (renewals && renewals.length > 0) {
        for (const renewal of renewals) {
          const contract = await tx.playerContract.findUnique({
            where: { id: renewal.contractId },
            include: { roster: { include: { leagueMember: true } } },
          })

          if (!contract || contract.roster.leagueMember.id !== member.id) {
            throw new Error(`Contratto ${renewal.contractId} non valido`)
          }

          // Calculate renewal cost
          const salaryDiff = renewal.salary - contract.salary
          const renewalCost = salaryDiff > 0 ? salaryDiff : 0

          // Calculate new rescission clause
          const multiplier = DURATION_MULTIPLIERS[renewal.duration as keyof typeof DURATION_MULTIPLIERS] || 7
          const newRescissionClause = renewal.salary * multiplier

          // Update contract
          await tx.playerContract.update({
            where: { id: renewal.contractId },
            data: {
              salary: renewal.salary,
              duration: renewal.duration,
              rescissionClause: newRescissionClause,
            },
          })

          // Deduct renewal cost from budget
          if (renewalCost > 0) {
            await tx.leagueMember.update({
              where: { id: member.id },
              data: { currentBudget: { decrement: renewalCost } },
            })
          }
        }
      }

      // 2. Process all new contracts
      if (newContracts && newContracts.length > 0) {
        for (const nc of newContracts) {
          const rosterEntry = await tx.playerRoster.findUnique({
            where: { id: nc.rosterId },
            include: { leagueMember: true, contract: true },
          })

          if (!rosterEntry || rosterEntry.leagueMember.id !== member.id) {
            throw new Error(`Roster entry ${nc.rosterId} non valido`)
          }

          if (rosterEntry.contract) {
            throw new Error(`Il giocatore ha già un contratto`)
          }

          // Calculate rescission clause
          const multiplier = DURATION_MULTIPLIERS[nc.duration as keyof typeof DURATION_MULTIPLIERS] || 7
          const rescissionClause = nc.salary * multiplier

          // Create contract
          await tx.playerContract.create({
            data: {
              rosterId: nc.rosterId,
              salary: nc.salary,
              duration: nc.duration,
              initialSalary: nc.salary,
              initialDuration: nc.duration,
              rescissionClause,
            },
          })
        }
      }

      // 3. Process draft releases (players marked for release)
      const contractsToRelease = await tx.playerContract.findMany({
        where: {
          leagueMemberId: member.id,
          draftReleased: true,
        },
        include: {
          roster: { include: { player: true } },
        },
      })

      for (const contract of contractsToRelease) {
        // Costo taglio = (ingaggio × durata) / 2
        const releaseCost = calculateReleaseCost(contract.salary, contract.duration)

        // Deduct release cost from budget
        await tx.leagueMember.update({
          where: { id: member.id },
          data: { currentBudget: { decrement: releaseCost } },
        })

        // Record the movement
        await recordMovement(tx, {
          leagueId,
          sessionId: activeSession.id,
          playerId: contract.roster.playerId,
          fromMemberId: member.id,
          toMemberId: null,
          type: 'RELEASE',
          amount: releaseCost,
        })

        // Delete the contract
        await tx.playerContract.delete({
          where: { id: contract.id },
        })

        // Mark roster entry as released
        await tx.playerRoster.update({
          where: { id: contract.rosterId },
          data: {
            status: RosterStatus.RELEASED,
            releasedAt: new Date(),
          },
        })
      }

      // 4. Check if all remaining active players have contracts
      const roster = await tx.playerRoster.findMany({
        where: {
          leagueMemberId: member.id,
          status: RosterStatus.ACTIVE,
        },
        include: { contract: true, player: true },
      })

      const playersWithoutContract = roster.filter(r => !r.contract)
      if (playersWithoutContract.length > 0) {
        const names = playersWithoutContract.map(r => r.player.name).join(', ')
        throw new Error(`${playersWithoutContract.length} giocatori senza contratto: ${names}`)
      }

      // 4.5 Check roster size limit (max 29 players)
      if (roster.length > MAX_ROSTER_SIZE) {
        const excess = roster.length - MAX_ROSTER_SIZE
        throw new Error(`Rosa troppo grande: ${roster.length} giocatori. Devi tagliare ${excess} giocator${excess === 1 ? 'e' : 'i'} (max ${MAX_ROSTER_SIZE})`)
      }

      // 5. Clear all draft values and create consolidation record
      await tx.contractConsolidation.create({
        data: {
          sessionId: activeSession.id,
          memberId: member.id,
        },
      })
    })

    return {
      success: true,
      message: 'Contratti consolidati con successo',
      data: {
        consolidatedAt: new Date().toISOString(),
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Errore nel consolidamento'
    return { success: false, message }
  }
}

// Get all managers' consolidation status (for admin)
export async function getAllConsolidationStatus(
  leagueId: string,
  userId: string
): Promise<ServiceResult> {
  // Verify user is admin
  const member = await prisma.leagueMember.findFirst({
    where: {
      leagueId,
      userId,
      status: MemberStatus.ACTIVE,
    },
  })

  if (!member) {
    return { success: false, message: 'Non sei membro di questa lega' }
  }

  if (member.role !== 'ADMIN') {
    return { success: false, message: 'Solo gli admin possono vedere lo stato di consolidamento' }
  }

  // Get active session in CONTRATTI phase
  const activeSession = await prisma.marketSession.findFirst({
    where: {
      leagueId,
      status: 'ACTIVE',
      currentPhase: 'CONTRATTI',
    },
  })

  if (!activeSession) {
    return {
      success: true,
      data: {
        inContrattiPhase: false,
        managers: [],
        allConsolidated: false,
      },
    }
  }

  // Get all active members (excluding admins who might not have players)
  const allMembers = await prisma.leagueMember.findMany({
    where: {
      leagueId,
      status: MemberStatus.ACTIVE,
    },
    include: {
      user: { select: { id: true, username: true } },
      roster: { where: { status: RosterStatus.ACTIVE } },
    },
  })

  // Only consider managers with players
  const managersWithPlayers = allMembers.filter(m => m.roster.length > 0)

  // Get consolidations for this session
  const consolidations = await prisma.contractConsolidation.findMany({
    where: {
      sessionId: activeSession.id,
    },
  })

  const consolidationMap = new Map(consolidations.map(c => [c.memberId, c.consolidatedAt]))

  const managers = managersWithPlayers.map(m => ({
    memberId: m.id,
    userId: m.user.id,
    username: m.user.username,
    role: m.role,
    playerCount: m.roster.length,
    isConsolidated: consolidationMap.has(m.id),
    consolidatedAt: consolidationMap.get(m.id) || null,
  }))

  const allConsolidated = managers.every(m => m.isConsolidated)

  return {
    success: true,
    data: {
      inContrattiPhase: true,
      sessionId: activeSession.id,
      managers,
      consolidatedCount: managers.filter(m => m.isConsolidated).length,
      totalCount: managers.length,
      allConsolidated,
    },
  }
}

// Simulate all managers consolidated (admin test only)
export async function simulateAllConsolidation(
  leagueId: string,
  userId: string
): Promise<ServiceResult> {
  // Verify user is admin
  const member = await prisma.leagueMember.findFirst({
    where: {
      leagueId,
      userId,
      status: MemberStatus.ACTIVE,
    },
  })

  if (!member) {
    return { success: false, message: 'Non sei membro di questa lega' }
  }

  if (member.role !== 'ADMIN') {
    return { success: false, message: 'Solo gli admin possono simulare il consolidamento' }
  }

  // Get active session in CONTRATTI phase
  const activeSession = await prisma.marketSession.findFirst({
    where: {
      leagueId,
      status: 'ACTIVE',
      currentPhase: 'CONTRATTI',
    },
  })

  if (!activeSession) {
    return { success: false, message: 'Non siamo in fase CONTRATTI' }
  }

  // Get all active members with players (excluding admin)
  const allMembers = await prisma.leagueMember.findMany({
    where: {
      leagueId,
      status: MemberStatus.ACTIVE,
    },
    include: {
      roster: { where: { status: RosterStatus.ACTIVE } },
      user: { select: { username: true } },
    },
  })

  const managersWithPlayers = allMembers.filter(m => m.roster.length > 0)

  // Get existing consolidations
  const existingConsolidations = await prisma.contractConsolidation.findMany({
    where: { sessionId: activeSession.id },
  })

  const existingMemberIds = new Set(existingConsolidations.map(c => c.memberId))

  // Create consolidation records for all members who haven't consolidated yet
  const membersToConsolidate = managersWithPlayers.filter(m => !existingMemberIds.has(m.id))

  if (membersToConsolidate.length === 0) {
    return { success: true, message: 'Tutti i manager hanno già consolidato' }
  }

  await prisma.contractConsolidation.createMany({
    data: membersToConsolidate.map(m => ({
      sessionId: activeSession.id,
      memberId: m.id,
    })),
  })

  const consolidatedNames = membersToConsolidate.map(m => m.user.username).join(', ')

  return {
    success: true,
    message: `Consolidamento simulato per: ${consolidatedNames}`,
    data: {
      consolidatedCount: membersToConsolidate.length,
      consolidatedMembers: membersToConsolidate.map(m => m.user.username),
    },
  }
}

// Check if all managers have consolidated (for phase advancement validation)
export async function canAdvanceFromContratti(
  sessionId: string
): Promise<{ canAdvance: boolean; reason?: string }> {
  const session = await prisma.marketSession.findUnique({
    where: { id: sessionId },
  })

  if (!session) {
    return { canAdvance: false, reason: 'Sessione non trovata' }
  }

  if (session.currentPhase !== 'CONTRATTI') {
    // Not in CONTRATTI phase, no consolidation check needed
    return { canAdvance: true }
  }

  // Get all active members with players
  const allMembers = await prisma.leagueMember.findMany({
    where: {
      leagueId: session.leagueId,
      status: MemberStatus.ACTIVE,
    },
    include: {
      roster: { where: { status: RosterStatus.ACTIVE } },
      user: { select: { username: true } },
    },
  })

  const managersWithPlayers = allMembers.filter(m => m.roster.length > 0)

  // Get consolidations for this session
  const consolidations = await prisma.contractConsolidation.findMany({
    where: {
      sessionId: session.id,
    },
  })

  const consolidatedMemberIds = new Set(consolidations.map(c => c.memberId))

  const notConsolidated = managersWithPlayers.filter(m => !consolidatedMemberIds.has(m.id))

  if (notConsolidated.length > 0) {
    const names = notConsolidated.map(m => m.user.username).join(', ')
    return {
      canAdvance: false,
      reason: `Manager non hanno consolidato: ${names}`,
    }
  }

  return { canAdvance: true }
}

// Save draft renewals, new contracts, and releases (staging area)
export async function saveDrafts(
  leagueId: string,
  userId: string,
  renewals: { contractId: string; salary: number; duration: number }[],
  newContracts: { rosterId: string; salary: number; duration: number }[],
  releases: string[] = []  // Contract IDs to mark for release
): Promise<ServiceResult> {
  const member = await prisma.leagueMember.findFirst({
    where: {
      leagueId,
      userId,
      status: MemberStatus.ACTIVE,
    },
  })

  if (!member) {
    return { success: false, message: 'Non sei membro di questa lega' }
  }

  // Get active session in CONTRATTI phase
  const activeSession = await prisma.marketSession.findFirst({
    where: {
      leagueId,
      status: 'ACTIVE',
      currentPhase: 'CONTRATTI',
    },
  })

  if (!activeSession) {
    return { success: false, message: 'Non siamo in fase CONTRATTI' }
  }

  // Check if already consolidated
  const existingConsolidation = await prisma.contractConsolidation.findUnique({
    where: {
      sessionId_memberId: {
        sessionId: activeSession.id,
        memberId: member.id,
      },
    },
  })

  if (existingConsolidation) {
    return { success: false, message: 'Hai già consolidato i tuoi contratti' }
  }

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Validate and save draft renewals in batch
      if (renewals.length > 0) {
        const contractIds = renewals.map(r => r.contractId)
        const contracts = await tx.playerContract.findMany({
          where: {
            id: { in: contractIds },
            leagueMemberId: member.id
          },
        })

        const validIds = new Set(contracts.map(c => c.id))
        for (const renewal of renewals) {
          if (!validIds.has(renewal.contractId)) {
            throw new Error(`Contratto ${renewal.contractId} non valido`)
          }
        }

        // Update each renewal
        for (const renewal of renewals) {
          await tx.playerContract.update({
            where: { id: renewal.contractId },
            data: {
              draftSalary: renewal.salary,
              draftDuration: renewal.duration,
            },
          })
        }
      }

      // 2. Validate and save draft new contracts in batch
      if (newContracts.length > 0) {
        const rosterIds = newContracts.map(nc => nc.rosterId)
        const rosterEntries = await tx.playerRoster.findMany({
          where: {
            id: { in: rosterIds },
            leagueMemberId: member.id
          },
          include: { contract: true },
        })

        const validRosters = new Map(rosterEntries.map(r => [r.id, r]))
        for (const nc of newContracts) {
          const roster = validRosters.get(nc.rosterId)
          if (!roster) {
            throw new Error(`Roster entry ${nc.rosterId} non valido`)
          }
          if (roster.contract) {
            throw new Error(`Il giocatore ha già un contratto`)
          }
        }

        // Upsert each draft contract
        for (const nc of newContracts) {
          await tx.draftContract.upsert({
            where: { rosterId: nc.rosterId },
            create: {
              rosterId: nc.rosterId,
              memberId: member.id,
              sessionId: activeSession.id,
              salary: nc.salary,
              duration: nc.duration,
            },
            update: {
              salary: nc.salary,
              duration: nc.duration,
            },
          })
        }
      }

      // 3. Mark contracts for release using batch updates
      // Reset all to not released, then mark the ones that should be released
      await tx.playerContract.updateMany({
        where: { leagueMemberId: member.id },
        data: { draftReleased: false },
      })

      if (releases.length > 0) {
        await tx.playerContract.updateMany({
          where: {
            id: { in: releases },
            leagueMemberId: member.id
          },
          data: { draftReleased: true },
        })
      }
    }, {
      timeout: 30000, // 30 seconds timeout
    })

    return {
      success: true,
      message: 'Bozze salvate con successo',
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Errore nel salvataggio'
    return { success: false, message }
  }
}
