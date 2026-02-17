/**
 * Prize Prisma Repository - Infrastructure Layer
 *
 * Implements IPrizeRepository interface using Prisma ORM.
 * Maps between Prisma database models and domain entities.
 */

import { prisma } from '@/lib/prisma'
import type {
  IPrizeRepository,
  CreateConfigData,
  UpdateConfigData,
  AssignPrizeData,
  CreateCategoryData,
  MemberInfo,
  SessionInfo,
} from '../../domain/repositories/prize.repository.interface'
import type {
  PrizeCategory,
  PrizePhaseConfig,
  SessionPrize,
} from '../../domain/entities/prize.entity'

export class PrizePrismaRepository implements IPrizeRepository {
  // ==================== Config Operations ====================

  /**
   * Get prize phase config for a session
   */
  async getConfig(sessionId: string): Promise<PrizePhaseConfig | null> {
    const config = await prisma.prizePhaseConfig.findUnique({
      where: { marketSessionId: sessionId },
    })
    return config ? this.mapToConfig(config) : null
  }

  /**
   * Create a new prize phase config
   */
  async createConfig(data: CreateConfigData): Promise<PrizePhaseConfig> {
    const config = await prisma.prizePhaseConfig.create({
      data: {
        marketSessionId: data.sessionId,
        baseReincrement: data.baseReincrement ?? 100,
        isFinalized: false,
      },
    })
    return this.mapToConfig(config)
  }

  /**
   * Update prize phase config
   */
  async updateConfig(sessionId: string, data: UpdateConfigData): Promise<void> {
    await prisma.prizePhaseConfig.update({
      where: { marketSessionId: sessionId },
      data: {
        baseReincrement: data.baseReincrement,
        isFinalized: data.status === 'FINALIZED',
        finalizedAt: data.finalizedAt,
      },
    })
  }

  // ==================== Category Operations ====================

  /**
   * Get all system categories (returns empty for now, system categories are per session)
   */
  async getCategories(): Promise<PrizeCategory[]> {
    // System categories are created per session
    return []
  }

  /**
   * Get categories for a specific session
   */
  async getCategoriesForSession(sessionId: string): Promise<PrizeCategory[]> {
    const categories = await prisma.prizeCategory.findMany({
      where: { marketSessionId: sessionId },
      orderBy: { createdAt: 'asc' },
    })
    return categories.map((c) => this.mapToCategory(c))
  }

  /**
   * Create a new prize category
   */
  async createCategory(data: CreateCategoryData): Promise<PrizeCategory> {
    const category = await prisma.prizeCategory.create({
      data: {
        marketSessionId: data.sessionId,
        name: data.name,
        isSystemPrize: !(data.isCustom ?? true),
      },
    })
    return this.mapToCategory(category)
  }

  /**
   * Delete a prize category
   */
  async deleteCategory(categoryId: string): Promise<void> {
    await prisma.prizeCategory.delete({
      where: { id: categoryId },
    })
  }

  /**
   * Get a category by ID
   */
  async getCategoryById(categoryId: string): Promise<PrizeCategory | null> {
    const category = await prisma.prizeCategory.findUnique({
      where: { id: categoryId },
    })
    return category ? this.mapToCategory(category) : null
  }

  // ==================== Prize Operations ====================

  /**
   * Get all prizes for a session
   */
  async getPrizes(sessionId: string): Promise<SessionPrize[]> {
    const prizes = await prisma.sessionPrize.findMany({
      where: {
        prizeCategory: {
          marketSessionId: sessionId,
        },
      },
      include: {
        prizeCategory: true,
      },
    })
    return prizes.map((p) => this.mapToSessionPrize(p))
  }

  /**
   * Get prizes for a category
   */
  async getPrizesByCategory(categoryId: string): Promise<SessionPrize[]> {
    const prizes = await prisma.sessionPrize.findMany({
      where: { prizeCategoryId: categoryId },
    })
    return prizes.map((p) => this.mapToSessionPrize(p))
  }

  /**
   * Assign a prize to a member
   */
  async assignPrize(data: AssignPrizeData): Promise<SessionPrize> {
    const prize = await prisma.sessionPrize.upsert({
      where: {
        prizeCategoryId_leagueMemberId: {
          prizeCategoryId: data.categoryId,
          leagueMemberId: data.memberId,
        },
      },
      update: {
        amount: data.amount,
      },
      create: {
        prizeCategoryId: data.categoryId,
        leagueMemberId: data.memberId,
        amount: data.amount,
      },
    })
    return this.mapToSessionPrize(prize)
  }

  /**
   * Unassign a prize (remove assignment)
   */
  async unassignPrize(categoryId: string, memberId: string): Promise<void> {
    await prisma.sessionPrize.delete({
      where: {
        prizeCategoryId_leagueMemberId: {
          prizeCategoryId: categoryId,
          leagueMemberId: memberId,
        },
      },
    })
  }

  /**
   * Get a specific prize assignment
   */
  async getPrize(categoryId: string, memberId: string): Promise<SessionPrize | null> {
    const prize = await prisma.sessionPrize.findUnique({
      where: {
        prizeCategoryId_leagueMemberId: {
          prizeCategoryId: categoryId,
          leagueMemberId: memberId,
        },
      },
    })
    return prize ? this.mapToSessionPrize(prize) : null
  }

  // ==================== Session Operations ====================

  /**
   * Get session info
   */
  async getSession(sessionId: string): Promise<SessionInfo | null> {
    const session = await prisma.marketSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        leagueId: true,
        status: true,
      },
    })
    if (!session) return null
    return {
      id: session.id,
      leagueId: session.leagueId,
      status: session.status,
    }
  }

  /**
   * Get all active members for a league
   */
  async getActiveMembers(leagueId: string): Promise<MemberInfo[]> {
    const members = await prisma.leagueMember.findMany({
      where: {
        leagueId,
        status: 'ACTIVE',
      },
      include: {
        user: {
          select: { username: true },
        },
      },
    })
    return members.map((m) => ({
      id: m.id,
      teamName: m.teamName || m.user.username,
      username: m.user.username,
      currentBudget: m.currentBudget,
      role: m.role as 'ADMIN' | 'MEMBER',
    }))
  }

  /**
   * Get member by user ID and league
   */
  async getMemberByUserId(userId: string, leagueId: string): Promise<MemberInfo | null> {
    const member = await prisma.leagueMember.findUnique({
      where: {
        userId_leagueId: {
          userId,
          leagueId,
        },
      },
      include: {
        user: {
          select: { username: true },
        },
      },
    })
    if (!member) return null
    return {
      id: member.id,
      teamName: member.teamName || member.user.username,
      username: member.user.username,
      currentBudget: member.currentBudget,
      role: member.role as 'ADMIN' | 'MEMBER',
    }
  }

  /**
   * Update member budget
   */
  async updateMemberBudget(memberId: string, amount: number): Promise<number> {
    const updated = await prisma.leagueMember.update({
      where: { id: memberId },
      data: { currentBudget: { increment: amount } },
    })
    return updated.currentBudget
  }

  // ==================== Finalization ====================

  /**
   * Finalize the prize phase for a session
   * Applies all prizes to member budgets and marks phase as finalized
   */
  async finalizeSession(sessionId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      // Get config
      const config = await tx.prizePhaseConfig.findUnique({
        where: { marketSessionId: sessionId },
      })
      if (!config) {
        throw new Error('Prize config not found')
      }
      if (config.isFinalized) {
        throw new Error('Prize phase already finalized')
      }

      // Get session to get leagueId
      const session = await tx.marketSession.findUnique({
        where: { id: sessionId },
        select: { leagueId: true },
      })
      if (!session) {
        throw new Error('Session not found')
      }

      // Get all active members
      const members = await tx.leagueMember.findMany({
        where: {
          leagueId: session.leagueId,
          status: 'ACTIVE',
        },
      })

      // Apply base reincrement to all members
      for (const member of members) {
        await tx.leagueMember.update({
          where: { id: member.id },
          data: { currentBudget: { increment: config.baseReincrement } },
        })
      }

      // Get all prizes for this session
      const prizes = await tx.sessionPrize.findMany({
        where: {
          prizeCategory: {
            marketSessionId: sessionId,
          },
        },
      })

      // Apply prizes to member budgets
      for (const prize of prizes) {
        await tx.leagueMember.update({
          where: { id: prize.leagueMemberId },
          data: { currentBudget: { increment: prize.amount } },
        })
      }

      // Mark config as finalized
      await tx.prizePhaseConfig.update({
        where: { marketSessionId: sessionId },
        data: {
          isFinalized: true,
          finalizedAt: new Date(),
        },
      })
    })
  }

  /**
   * Check if all required categories have been assigned
   * For now, we just return true as there are no strict requirements
   */
  async areAllRequiredCategoriesAssigned(sessionId: string): Promise<boolean> {
    // In the current implementation, there are no strictly required categories
    // This can be extended to check for specific required categories
    const config = await prisma.prizePhaseConfig.findUnique({
      where: { marketSessionId: sessionId },
    })
    return config !== null
  }

  // ==================== Mapping Functions ====================

  /**
   * Map Prisma PrizePhaseConfig to domain entity
   */
  private mapToConfig(config: {
    id: string
    marketSessionId: string
    baseReincrement: number
    isFinalized: boolean
    finalizedAt: Date | null
    createdAt: Date
  }): PrizePhaseConfig {
    return {
      id: config.id,
      sessionId: config.marketSessionId,
      status: config.isFinalized ? 'FINALIZED' : 'IN_PROGRESS',
      totalBudget: 0, // Not tracked in current schema
      remainingBudget: 0, // Not tracked in current schema
      baseReincrement: config.baseReincrement,
      startedAt: config.createdAt,
      finalizedAt: config.finalizedAt,
    }
  }

  /**
   * Map Prisma PrizeCategory to domain entity
   */
  private mapToCategory(category: {
    id: string
    name: string
    isSystemPrize: boolean
  }): PrizeCategory {
    return {
      id: category.id,
      name: category.name,
      description: '',
      defaultAmount: 0,
      isCustom: !category.isSystemPrize,
    }
  }

  /**
   * Map Prisma SessionPrize to domain entity
   */
  private mapToSessionPrize(prize: {
    id: string
    prizeCategoryId: string
    leagueMemberId: string
    amount: number
    createdAt: Date
  }): SessionPrize {
    return {
      id: prize.id,
      categoryId: prize.prizeCategoryId,
      memberId: prize.leagueMemberId,
      amount: prize.amount,
      assignedAt: prize.createdAt,
      assignedBy: null, // Not tracked in current schema
    }
  }
}
