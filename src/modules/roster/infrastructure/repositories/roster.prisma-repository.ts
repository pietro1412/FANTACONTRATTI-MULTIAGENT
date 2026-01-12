/**
 * Roster Prisma Repository - Infrastructure Layer
 *
 * Implements IRosterRepository using Prisma ORM for PostgreSQL.
 * Maps Prisma models to domain entities.
 */

import { prisma } from '@/lib/prisma'
import type { IRosterRepository } from '../../domain/repositories/roster.repository.interface'
import type {
  PlayerRoster,
  CreateRosterData,
  AcquisitionType,
  RosterStatus,
} from '../../domain/entities/roster.entity'
import type {
  PlayerContract,
  CreateContractData,
  UpdateContractData,
  ContractStatus,
} from '../../domain/entities/contract.entity'
import type {
  PlayerRoster as PrismaPlayerRoster,
  PlayerContract as PrismaPlayerContract,
  SerieAPlayer as PrismaSerieAPlayer,
  AcquisitionType as PrismaAcquisitionType,
  RosterStatus as PrismaRosterStatus,
} from '@prisma/client'

/**
 * Prisma roster with includes for mapping
 */
type PrismaRosterWithIncludes = PrismaPlayerRoster & {
  player?: PrismaSerieAPlayer
  contract?: PrismaPlayerContract | null
}

/**
 * Maps Prisma acquisition type to domain type
 */
function mapPrismaAcquisitionType(type: PrismaAcquisitionType): AcquisitionType {
  const mapping: Record<PrismaAcquisitionType, AcquisitionType> = {
    FIRST_MARKET: 'AUCTION',
    RUBATA: 'RUBATA',
    SVINCOLATI: 'SVINCOLATI',
    TRADE: 'TRADE',
  }
  return mapping[type] || 'INITIAL'
}

/**
 * Maps domain acquisition type to Prisma type
 */
function mapDomainAcquisitionType(type: AcquisitionType): PrismaAcquisitionType {
  const mapping: Record<AcquisitionType, PrismaAcquisitionType> = {
    AUCTION: 'FIRST_MARKET',
    RUBATA: 'RUBATA',
    SVINCOLATI: 'SVINCOLATI',
    TRADE: 'TRADE',
    INITIAL: 'FIRST_MARKET',
  }
  return mapping[type]
}

/**
 * Maps Prisma roster status to domain status
 */
function mapPrismaRosterStatus(status: PrismaRosterStatus): RosterStatus {
  return status as RosterStatus
}

export class RosterPrismaRepository implements IRosterRepository {
  /**
   * Maps a Prisma roster to a domain entity
   */
  private mapToRoster(prismaRoster: PrismaRosterWithIncludes): PlayerRoster {
    return {
      id: prismaRoster.id,
      leagueMemberId: prismaRoster.leagueMemberId,
      playerId: prismaRoster.playerId,
      acquisitionType: mapPrismaAcquisitionType(prismaRoster.acquisitionType),
      acquisitionPrice: prismaRoster.acquisitionPrice,
      status: mapPrismaRosterStatus(prismaRoster.status),
      acquiredAt: prismaRoster.acquiredAt,
    }
  }

  /**
   * Maps a Prisma contract to a domain entity
   */
  private mapToContract(prismaContract: PrismaPlayerContract): PlayerContract {
    return {
      id: prismaContract.id,
      rosterId: prismaContract.rosterId,
      salary: prismaContract.salary,
      duration: prismaContract.duration,
      clausola: prismaContract.rescissionClause,
      status: 'ACTIVE' as ContractStatus, // Prisma model doesn't have status, assume ACTIVE
      renewedAt: null, // Not tracked in Prisma model directly
      consolidatedAt: null, // Not tracked in Prisma model directly
    }
  }

  /**
   * Find all roster entries for a league member
   */
  async findByMemberId(memberId: string): Promise<PlayerRoster[]> {
    const rosters = await prisma.playerRoster.findMany({
      where: {
        leagueMemberId: memberId,
        status: 'ACTIVE',
      },
      include: {
        player: true,
        contract: true,
      },
      orderBy: {
        acquiredAt: 'desc',
      },
    })

    return rosters.map((roster) => this.mapToRoster(roster))
  }

  /**
   * Find a specific roster entry by ID
   */
  async findById(id: string): Promise<PlayerRoster | null> {
    const roster = await prisma.playerRoster.findUnique({
      where: { id },
      include: {
        player: true,
        contract: true,
      },
    })

    return roster ? this.mapToRoster(roster) : null
  }

  /**
   * Get the contract associated with a roster entry
   */
  async getContract(rosterId: string): Promise<PlayerContract | null> {
    const contract = await prisma.playerContract.findUnique({
      where: { rosterId },
    })

    return contract ? this.mapToContract(contract) : null
  }

  /**
   * Create a new roster entry
   */
  async createRoster(data: CreateRosterData): Promise<PlayerRoster> {
    const roster = await prisma.playerRoster.create({
      data: {
        leagueMemberId: data.leagueMemberId,
        playerId: data.playerId,
        acquisitionType: mapDomainAcquisitionType(data.acquisitionType),
        acquisitionPrice: data.acquisitionPrice,
        status: 'ACTIVE',
        acquiredAt: new Date(),
      },
      include: {
        player: true,
        contract: true,
      },
    })

    return this.mapToRoster(roster)
  }

  /**
   * Create a new contract for a roster entry
   */
  async createContract(data: CreateContractData): Promise<PlayerContract> {
    // Get the roster to find the member ID
    const roster = await prisma.playerRoster.findUnique({
      where: { id: data.rosterId },
    })

    if (!roster) {
      throw new Error(`Roster not found: ${data.rosterId}`)
    }

    // Calculate rescission clause (salary * duration multiplier)
    const rescissionClause = this.calculateRescissionClause(data.salary, data.duration)

    const contract = await prisma.playerContract.create({
      data: {
        rosterId: data.rosterId,
        leagueMemberId: roster.leagueMemberId,
        salary: data.salary,
        duration: data.duration,
        initialSalary: data.salary,
        initialDuration: data.duration,
        rescissionClause,
      },
    })

    return this.mapToContract(contract)
  }

  /**
   * Update an existing contract
   */
  async updateContract(id: string, data: UpdateContractData): Promise<PlayerContract> {
    const existingContract = await prisma.playerContract.findUnique({
      where: { id },
    })

    if (!existingContract) {
      throw new Error(`Contract not found: ${id}`)
    }

    const newSalary = data.salary ?? existingContract.salary
    const newDuration = data.duration ?? existingContract.duration

    // Recalculate rescission clause if salary or duration changed
    const rescissionClause =
      data.salary !== undefined || data.duration !== undefined
        ? this.calculateRescissionClause(newSalary, newDuration)
        : existingContract.rescissionClause

    const contract = await prisma.playerContract.update({
      where: { id },
      data: {
        salary: newSalary,
        duration: newDuration,
        rescissionClause,
        draftSalary: data.salary !== undefined ? null : existingContract.draftSalary,
        draftDuration: data.duration !== undefined ? null : existingContract.draftDuration,
      },
    })

    return this.mapToContract(contract)
  }

  /**
   * Release a player from the roster
   */
  async releasePlayer(rosterId: string): Promise<void> {
    await prisma.playerRoster.update({
      where: { id: rosterId },
      data: {
        status: 'RELEASED',
        releasedAt: new Date(),
      },
    })
  }

  /**
   * Find all contracts for a league member
   */
  async findContractsByMemberId(
    memberId: string
  ): Promise<Array<{ roster: PlayerRoster; contract: PlayerContract }>> {
    const contracts = await prisma.playerContract.findMany({
      where: {
        leagueMemberId: memberId,
        roster: {
          status: 'ACTIVE',
        },
      },
      include: {
        roster: {
          include: {
            player: true,
          },
        },
      },
      orderBy: {
        roster: {
          acquiredAt: 'desc',
        },
      },
    })

    return contracts.map((contract) => ({
      roster: this.mapToRoster(contract.roster),
      contract: this.mapToContract(contract),
    }))
  }

  /**
   * Find contracts eligible for consolidation (year 4+)
   */
  async findConsolidationEligible(memberId: string): Promise<PlayerContract[]> {
    const contracts = await prisma.playerContract.findMany({
      where: {
        leagueMemberId: memberId,
        duration: {
          gte: 4, // 4 or more semesters
        },
        roster: {
          status: 'ACTIVE',
        },
      },
    })

    return contracts.map((contract) => this.mapToContract(contract))
  }

  /**
   * Get member's current budget
   */
  async getMemberBudget(memberId: string): Promise<number> {
    const member = await prisma.leagueMember.findUnique({
      where: { id: memberId },
      select: { currentBudget: true },
    })

    if (!member) {
      throw new Error(`Member not found: ${memberId}`)
    }

    return member.currentBudget
  }

  /**
   * Update member's budget
   */
  async updateMemberBudget(memberId: string, amount: number): Promise<number> {
    const member = await prisma.leagueMember.update({
      where: { id: memberId },
      data: {
        currentBudget: {
          increment: amount,
        },
      },
      select: { currentBudget: true },
    })

    return member.currentBudget
  }

  /**
   * Calculate rescission clause based on salary and duration
   * Formula: salary * multiplier (based on duration)
   */
  private calculateRescissionClause(salary: number, duration: number): number {
    // Multiplier increases with duration
    const multipliers: Record<number, number> = {
      1: 3,
      2: 5,
      3: 7,
      4: 9,
    }
    const multiplier = multipliers[duration] ?? 9
    return salary * multiplier
  }
}
