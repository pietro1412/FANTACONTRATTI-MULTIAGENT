import { MemberStatus, RosterStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type {
  ContractEventType,
  CreateContractHistoryInput,
  CreateManagerSnapshotInput,
  ContractHistoryEntry,
  ManagerSessionSnapshot,
  ManagerSessionSummary,
  ContractPhaseProspetto,
  ProspettoLineItem,
} from '../types/contract-history'
import { calculateReleaseCost } from './contract.service'
import type { ServiceResult } from '@/shared/types/service-result'

// ==================== CREATE CONTRACT HISTORY ENTRY ====================

export async function createContractHistoryEntry(
  input: CreateContractHistoryInput
): Promise<string | null> {
  try {
    const entry = await prisma.contractHistory.create({
      data: {
        contractId: input.contractId,
        playerId: input.playerId,
        leagueMemberId: input.leagueMemberId,
        marketSessionId: input.marketSessionId,
        eventType: input.eventType,
        previousSalary: input.previousSalary,
        previousDuration: input.previousDuration,
        previousClause: input.previousClause,
        newSalary: input.newSalary,
        newDuration: input.newDuration,
        newClause: input.newClause,
        cost: input.cost,
        income: input.income,
        notes: input.notes,
      },
    })
    return entry.id
  } catch {
    return null
  }
}

// Batch create history entries for efficiency
export async function createContractHistoryEntries(
  inputs: CreateContractHistoryInput[]
): Promise<number> {
  try {
    const result = await prisma.contractHistory.createMany({
      data: inputs.map(input => ({
        contractId: input.contractId,
        playerId: input.playerId,
        leagueMemberId: input.leagueMemberId,
        marketSessionId: input.marketSessionId,
        eventType: input.eventType,
        previousSalary: input.previousSalary,
        previousDuration: input.previousDuration,
        previousClause: input.previousClause,
        newSalary: input.newSalary,
        newDuration: input.newDuration,
        newClause: input.newClause,
        cost: input.cost,
        income: input.income,
        notes: input.notes,
      })),
    })
    return result.count
  } catch {
    return 0
  }
}

// ==================== CREATE MANAGER SNAPSHOT ====================

export async function createManagerSnapshot(
  input: CreateManagerSnapshotInput
): Promise<string | null> {
  try {
    const snapshot = await prisma.managerSessionSnapshot.upsert({
      where: {
        leagueMemberId_marketSessionId_snapshotType: {
          leagueMemberId: input.leagueMemberId,
          marketSessionId: input.marketSessionId,
          snapshotType: input.snapshotType,
        },
      },
      create: {
        leagueMemberId: input.leagueMemberId,
        marketSessionId: input.marketSessionId,
        snapshotType: input.snapshotType,
        budget: input.budget,
        totalSalaries: input.totalSalaries,
        balance: input.balance,
        totalIndemnities: input.totalIndemnities,
        totalReleaseCosts: input.totalReleaseCosts,
        totalRenewalCosts: input.totalRenewalCosts,
        contractCount: input.contractCount,
        releasedCount: input.releasedCount,
        renewedCount: input.renewedCount,
      },
      update: {
        budget: input.budget,
        totalSalaries: input.totalSalaries,
        balance: input.balance,
        totalIndemnities: input.totalIndemnities,
        totalReleaseCosts: input.totalReleaseCosts,
        totalRenewalCosts: input.totalRenewalCosts,
        contractCount: input.contractCount,
        releasedCount: input.releasedCount,
        renewedCount: input.renewedCount,
      },
    })
    return snapshot.id
  } catch {
    return null
  }
}

// Batch create snapshots for all managers at session start
export async function createSessionStartSnapshots(
  marketSessionId: string,
  leagueId: string
): Promise<{ created: number; failed: number }> {
  let created = 0
  let failed = 0

  try {
    // Get all active managers
    const members = await prisma.leagueMember.findMany({
      where: {
        leagueId,
        status: MemberStatus.ACTIVE,
      },
    })

    for (const member of members) {
      // Get active contracts for this member
      const activeContracts = await prisma.playerContract.findMany({
        where: {
          leagueMemberId: member.id,
          roster: { status: RosterStatus.ACTIVE },
        },
      })

      const totalSalaries = activeContracts.reduce((sum, c) => sum + c.salary, 0)
      const balance = member.currentBudget - totalSalaries

      const result = await createManagerSnapshot({
        leagueMemberId: member.id,
        marketSessionId,
        snapshotType: 'SESSION_START',
        budget: member.currentBudget,
        totalSalaries,
        balance,
        contractCount: activeContracts.length,
      })

      if (result) {
        created++
      } else {
        failed++
      }
    }
  } catch {
    // Error intentionally silenced
  }

  return { created, failed }
}

// ==================== GET CONTRACT HISTORY ====================

export async function getSessionContractHistory(
  marketSessionId: string,
  leagueMemberId: string,
  userId: string
): Promise<ServiceResult> {
  // Verify membership
  const member = await prisma.leagueMember.findFirst({
    where: {
      id: leagueMemberId,
      user: { id: userId },
      status: MemberStatus.ACTIVE,
    },
  })

  if (!member) {
    return { success: false, message: 'Non sei autorizzato a vedere questo storico' }
  }

  const history = await prisma.contractHistory.findMany({
    where: {
      marketSessionId,
      leagueMemberId,
    },
    include: {
      player: {
        select: {
          id: true,
          name: true,
          team: true,
          position: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  return {
    success: true,
    data: history,
  }
}

// Get all contract history for a session (admin view)
export async function getFullSessionContractHistory(
  marketSessionId: string,
  userId: string,
  leagueId: string
): Promise<ServiceResult> {
  // Verify user is admin
  const member = await prisma.leagueMember.findFirst({
    where: {
      leagueId,
      userId,
      role: 'ADMIN',
      status: MemberStatus.ACTIVE,
    },
  })

  if (!member) {
    return { success: false, message: 'Solo gli admin possono vedere lo storico completo' }
  }

  const history = await prisma.contractHistory.findMany({
    where: { marketSessionId },
    include: {
      player: {
        select: {
          id: true,
          name: true,
          team: true,
          position: true,
        },
      },
      leagueMember: {
        include: {
          user: { select: { username: true } },
        },
      },
    },
    orderBy: [
      { leagueMemberId: 'asc' },
      { createdAt: 'asc' },
    ],
  })

  return {
    success: true,
    data: history,
  }
}

// ==================== GET MANAGER SESSION SUMMARY ====================

export async function getManagerSessionSummary(
  marketSessionId: string,
  leagueMemberId: string,
  userId: string
): Promise<ServiceResult> {
  // Verify membership
  const member = await prisma.leagueMember.findFirst({
    where: {
      id: leagueMemberId,
      user: { id: userId },
      status: MemberStatus.ACTIVE,
    },
    include: {
      user: { select: { username: true } },
    },
  })

  if (!member) {
    return { success: false, message: 'Non sei autorizzato a vedere questo riepilogo' }
  }

  // Get snapshots
  const snapshots = await prisma.managerSessionSnapshot.findMany({
    where: {
      marketSessionId,
      leagueMemberId,
    },
  })

  const phaseStartSnapshot = snapshots.find(s => s.snapshotType === 'PHASE_START')
  const sessionStartSnapshot = snapshots.find(s => s.snapshotType === 'SESSION_START')

  // Get history events
  const events = await prisma.contractHistory.findMany({
    where: {
      marketSessionId,
      leagueMemberId,
    },
    include: {
      player: {
        select: {
          id: true,
          name: true,
          team: true,
          position: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  // Calculate totals from events
  const totalIndemnities = events
    .filter(e => e.income && e.income > 0)
    .reduce((sum, e) => sum + (e.income || 0), 0)

  const totalReleaseCosts = events
    .filter(e => e.eventType.startsWith('RELEASE_') && e.cost && e.cost > 0)
    .reduce((sum, e) => sum + (e.cost || 0), 0)

  // Net effect of salary changes: positive = cost (increases), negative = savings (decreases from spalma)
  const totalRenewalCosts = events
    .filter(e => e.eventType === 'RENEWAL' || e.eventType === 'SPALMA')
    .reduce((sum, e) => {
      const diff = (e.newSalary || 0) - (e.previousSalary || 0)
      return sum + diff
    }, 0)

  // Get current contracts
  const currentContracts = await prisma.playerContract.findMany({
    where: {
      leagueMemberId,
      roster: { status: RosterStatus.ACTIVE },
    },
  })

  const currentSalaries = currentContracts.reduce((sum, c) => sum + c.salary, 0)

  const summary: ManagerSessionSummary = {
    leagueMemberId,
    managerName: member.user.username,
    teamName: member.teamName || member.user.username,
    // From snapshots
    initialBudget: phaseStartSnapshot?.budget ?? sessionStartSnapshot?.budget ?? member.currentBudget,
    initialSalaries: phaseStartSnapshot?.totalSalaries ?? sessionStartSnapshot?.totalSalaries ?? 0,
    initialBalance: phaseStartSnapshot?.balance ?? sessionStartSnapshot?.balance ?? 0,
    initialContractCount: phaseStartSnapshot?.contractCount ?? sessionStartSnapshot?.contractCount ?? 0,
    // Calculated from events
    totalIndemnities,
    totalReleaseCosts,
    totalRenewalCosts,
    // Current state
    currentBudget: member.currentBudget,
    currentSalaries,
    currentBalance: member.currentBudget - currentSalaries,
    currentContractCount: currentContracts.length,
    // Counts
    releasedCount: events.filter(e => e.eventType.startsWith('RELEASE_') || e.eventType === 'AUTO_RELEASE_EXPIRED').length,
    renewedCount: events.filter(e => e.eventType === 'RENEWAL').length,
    spalmaCount: events.filter(e => e.eventType === 'SPALMA').length,
    // Events
    events: events as ContractHistoryEntry[],
  }

  return {
    success: true,
    data: summary,
  }
}

// ==================== GET CONTRACT PHASE PROSPETTO ====================

export async function getContractPhaseProspetto(
  leagueId: string,
  userId: string
): Promise<ServiceResult> {
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

  // Get PHASE_START snapshot (or SESSION_START as fallback)
  const snapshots = await prisma.managerSessionSnapshot.findMany({
    where: {
      marketSessionId: activeSession.id,
      leagueMemberId: member.id,
    },
  })

  const phaseStartSnapshot = snapshots.find(s => s.snapshotType === 'PHASE_START')
  const sessionStartSnapshot = snapshots.find(s => s.snapshotType === 'SESSION_START')
  const initialSnapshot = phaseStartSnapshot || sessionStartSnapshot

  // Get all contract history events for this session
  const events = await prisma.contractHistory.findMany({
    where: {
      marketSessionId: activeSession.id,
      leagueMemberId: member.id,
    },
    include: {
      player: {
        select: { name: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  // Get current contracts (with draft values)
  const contracts = await prisma.playerContract.findMany({
    where: {
      leagueMemberId: member.id,
      roster: { status: RosterStatus.ACTIVE },
    },
    include: {
      roster: {
        include: { player: { select: { name: true, team: true, position: true } } },
      },
    },
  })

  // Calculate values from events
  let indennizziRicevuti = 0
  let costiTagli = 0
  let costiRinnovi = 0

  const lineItems: ProspettoLineItem[] = []

  for (const event of events) {
    const eventType = event.eventType as ContractEventType

    if (event.income && event.income > 0) {
      indennizziRicevuti += event.income
      lineItems.push({
        id: event.id,
        description: `Indennizzo per ${event.player.name}`,
        playerName: event.player.name,
        eventType,
        credit: event.income,
        timestamp: event.createdAt,
      })
    }

    if (eventType.startsWith('RELEASE_') && event.cost && event.cost > 0) {
      costiTagli += event.cost
      lineItems.push({
        id: event.id,
        description: `Taglio ${event.player.name}`,
        playerName: event.player.name,
        eventType,
        debit: event.cost,
        timestamp: event.createdAt,
      })
    }

    if (eventType === 'RENEWAL' && event.cost && event.cost > 0) {
      costiRinnovi += event.cost
      lineItems.push({
        id: event.id,
        description: `Rinnovo ${event.player.name}: ${event.previousSalary ?? 0}→${event.newSalary ?? 0}`,
        playerName: event.player.name,
        eventType,
        debit: event.cost,
        timestamp: event.createdAt,
      })
    }

    if (eventType === 'SPALMA') {
      lineItems.push({
        id: event.id,
        description: `Spalma ${event.player.name}: ${event.previousSalary ?? 0}/${event.previousDuration ?? 0}s→${event.newSalary ?? 0}/${event.newDuration ?? 0}s`,
        playerName: event.player.name,
        eventType,
        timestamp: event.createdAt,
      })
    }
  }

  // Calculate pending changes from draft values
  for (const contract of contracts) {
    if (contract.draftReleased) {
      const releaseCost = calculateReleaseCost(contract.salary, contract.duration)
      lineItems.push({
        id: `draft-release-${contract.id}`,
        description: `[BOZZA] Taglio ${contract.roster.player.name}`,
        playerName: contract.roster.player.name,
        eventType: 'RELEASE_NORMAL',
        debit: releaseCost,
        timestamp: new Date(),
      })
    } else if (contract.draftSalary && contract.draftDuration) {
      const salaryDiff = contract.draftSalary - contract.salary
      if (salaryDiff > 0) {
        lineItems.push({
          id: `draft-renewal-${contract.id}`,
          description: `[BOZZA] Rinnovo ${contract.roster.player.name}: ${contract.salary}→${contract.draftSalary}`,
          playerName: contract.roster.player.name,
          eventType: 'RENEWAL',
          debit: salaryDiff,
          timestamp: new Date(),
        })
      } else if (contract.duration === 1 && contract.draftDuration > 1) {
        lineItems.push({
          id: `draft-spalma-${contract.id}`,
          description: `[BOZZA] Spalma ${contract.roster.player.name}: ${contract.salary}/${contract.duration}s→${contract.draftSalary}/${contract.draftDuration}s`,
          playerName: contract.roster.player.name,
          eventType: 'SPALMA',
          timestamp: new Date(),
        })
      }
    }
  }

  // Calculate current totals
  const ingaggiAttuali = contracts.reduce((sum, c) => sum + c.salary, 0)
  const budgetIniziale = initialSnapshot?.budget ?? member.currentBudget + costiTagli + costiRinnovi - indennizziRicevuti
  const ingaggiIniziali = initialSnapshot?.totalSalaries ?? ingaggiAttuali
  const contrattiIniziali = initialSnapshot?.contractCount ?? contracts.length

  const prospetto: ContractPhaseProspetto = {
    // Budget section
    budgetIniziale,
    indennizziRicevuti,
    costiTagli,
    costiRinnovi,
    budgetAttuale: member.currentBudget,
    // Salaries section
    ingaggiIniziali,
    ingaggiAttuali,
    variazionIngaggi: ingaggiAttuali - ingaggiIniziali,
    // Balance
    bilancioIniziale: budgetIniziale - ingaggiIniziali,
    bilancioAttuale: member.currentBudget - ingaggiAttuali,
    // Counts
    contrattiIniziali,
    contrattiAttuali: contracts.length,
    giocatoriTagliati: events.filter(e => e.eventType.startsWith('RELEASE_') || e.eventType === 'AUTO_RELEASE_EXPIRED').length,
    contrattiRinnovati: events.filter(e => e.eventType === 'RENEWAL').length,
    contrattiSpalmati: events.filter(e => e.eventType === 'SPALMA').length,
    // Line items
    lineItems: lineItems.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()),
  }

  return {
    success: true,
    data: prospetto,
  }
}

// ==================== GET HISTORICAL SESSION SUMMARIES ====================

export async function getHistoricalSessionSummaries(
  leagueId: string,
  userId: string
): Promise<ServiceResult> {
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

  // Get all completed market sessions
  const sessions = await prisma.marketSession.findMany({
    where: {
      leagueId,
      status: 'COMPLETED',
      type: 'MERCATO_RICORRENTE',
    },
    orderBy: [
      { season: 'desc' },
      { semester: 'desc' },
    ],
  })

  const summaries = []

  for (const session of sessions) {
    // Get snapshots for this member and session
    const snapshots = await prisma.managerSessionSnapshot.findMany({
      where: {
        marketSessionId: session.id,
        leagueMemberId: member.id,
      },
    })

    const phaseStartSnapshot = snapshots.find(s => s.snapshotType === 'PHASE_START') as ManagerSessionSnapshot | undefined
    const phaseEndSnapshot = snapshots.find(s => s.snapshotType === 'PHASE_END') as ManagerSessionSnapshot | undefined

    // Get contract history events
    const events = await prisma.contractHistory.findMany({
      where: {
        marketSessionId: session.id,
        leagueMemberId: member.id,
      },
      include: {
        player: {
          select: {
            id: true,
            name: true,
            team: true,
            position: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    summaries.push({
      sessionId: session.id,
      sessionName: `Stagione ${session.season} - ${session.semester === 1 ? 'Estate' : 'Inverno'}`,
      season: session.season,
      semester: session.semester,
      phaseStartSnapshot,
      phaseEndSnapshot,
      contractEvents: events as ContractHistoryEntry[],
      budgetChange: phaseEndSnapshot && phaseStartSnapshot
        ? phaseEndSnapshot.budget - phaseStartSnapshot.budget
        : 0,
      salariesChange: phaseEndSnapshot && phaseStartSnapshot
        ? phaseEndSnapshot.totalSalaries - phaseStartSnapshot.totalSalaries
        : 0,
      netChange: phaseEndSnapshot && phaseStartSnapshot
        ? phaseEndSnapshot.balance - phaseStartSnapshot.balance
        : 0,
    })
  }

  return {
    success: true,
    data: summaries,
  }
}

// ==================== UTILITY FUNCTIONS ====================

// Create PHASE_START snapshot (called when entering CONTRATTI phase)
export async function createPhaseStartSnapshot(
  marketSessionId: string,
  leagueId: string
): Promise<{ created: number; failed: number }> {
  let created = 0
  let failed = 0

  try {
    const members = await prisma.leagueMember.findMany({
      where: {
        leagueId,
        status: MemberStatus.ACTIVE,
      },
    })

    for (const member of members) {
      // Get active contracts for this member
      const activeContracts = await prisma.playerContract.findMany({
        where: {
          leagueMemberId: member.id,
          roster: { status: RosterStatus.ACTIVE },
        },
      })

      const totalSalaries = activeContracts.reduce((sum, c) => sum + c.salary, 0)
      const balance = member.currentBudget - totalSalaries

      const result = await createManagerSnapshot({
        leagueMemberId: member.id,
        marketSessionId,
        snapshotType: 'PHASE_START',
        budget: member.currentBudget,
        totalSalaries,
        balance,
        contractCount: activeContracts.length,
      })

      if (result) {
        created++
      } else {
        failed++
      }
    }
  } catch {
    // Error intentionally silenced
  }

  return { created, failed }
}

// Create PHASE_END snapshot (called after manager consolidates)
export async function createPhaseEndSnapshot(
  marketSessionId: string,
  leagueMemberId: string
): Promise<string | null> {
  try {
    const member = await prisma.leagueMember.findUnique({
      where: { id: leagueMemberId },
    })

    if (!member) return null

    // Get active contracts for this member
    const activeContracts = await prisma.playerContract.findMany({
      where: {
        leagueMemberId,
        roster: { status: RosterStatus.ACTIVE },
      },
    })

    // Get history events for this session
    const events = await prisma.contractHistory.findMany({
      where: {
        marketSessionId,
        leagueMemberId,
      },
    })

    const totalSalaries = activeContracts.reduce((sum, c) => sum + c.salary, 0)
    const balance = member.currentBudget - totalSalaries

    // Calculate totals from events
    // NOTE: Only count income from RELEASE_ESTERO events, NOT INDEMNITY_RECEIVED
    // (INDEMNITY_RECEIVED is a duplicate entry for tracking purposes)
    const totalIndemnities = events
      .filter(e => e.eventType === 'RELEASE_ESTERO' && e.income && e.income > 0)
      .reduce((sum, e) => sum + (e.income || 0), 0)

    const totalReleaseCosts = events
      .filter(e => e.eventType.startsWith('RELEASE_') && e.cost && e.cost > 0)
      .reduce((sum, e) => sum + (e.cost || 0), 0)

    // Net effect of salary changes: positive = cost (increases), negative = savings (decreases from spalma)
    const totalRenewalCosts = events
      .filter(e => e.eventType === 'RENEWAL' || e.eventType === 'SPALMA')
      .reduce((sum, e) => {
        const diff = (e.newSalary || 0) - (e.previousSalary || 0)
        return sum + diff
      }, 0)

    const releasedCount = events.filter(e =>
      e.eventType.startsWith('RELEASE_') || e.eventType === 'AUTO_RELEASE_EXPIRED'
    ).length

    const renewedCount = events.filter(e => e.eventType === 'RENEWAL' || e.eventType === 'SPALMA').length

    return await createManagerSnapshot({
      leagueMemberId,
      marketSessionId,
      snapshotType: 'PHASE_END',
      budget: member.currentBudget,
      totalSalaries,
      balance,
      totalIndemnities,
      totalReleaseCosts,
      totalRenewalCosts,
      contractCount: activeContracts.length,
      releasedCount,
      renewedCount,
    })
  } catch {
    return null
  }
}
