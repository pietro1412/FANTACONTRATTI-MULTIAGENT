/**
 * Prize Repository Interface - Domain Layer
 * Defines the contract for prize data persistence operations
 */

import type {
  PrizeCategory,
  PrizePhaseConfig,
  SessionPrize,
  PrizePhaseStatus,
} from '../entities/prize.entity'

/**
 * Data required to create a new prize phase config
 */
export interface CreateConfigData {
  sessionId: string
  baseReincrement?: number
  totalBudget?: number
}

/**
 * Data for updating prize phase config
 */
export interface UpdateConfigData {
  status?: PrizePhaseStatus
  baseReincrement?: number
  totalBudget?: number
  remainingBudget?: number
  startedAt?: Date | null
  finalizedAt?: Date | null
}

/**
 * Data required to assign a prize
 */
export interface AssignPrizeData {
  categoryId: string
  memberId: string
  amount: number
  assignedBy: string
}

/**
 * Data required to create a prize category
 */
export interface CreateCategoryData {
  sessionId: string
  name: string
  description?: string
  defaultAmount?: number
  isCustom?: boolean
}

/**
 * Member info for prize operations
 */
export interface MemberInfo {
  id: string
  teamName: string
  username: string
  currentBudget: number
  role: 'ADMIN' | 'MEMBER'
}

/**
 * Session info for prize operations
 */
export interface SessionInfo {
  id: string
  leagueId: string
  status: string
}

/**
 * Interface for prize repository operations
 * Implementations can use different data sources (Prisma, in-memory, etc.)
 */
export interface IPrizeRepository {
  // ==================== Config Operations ====================

  /**
   * Get prize phase config for a session
   * @param sessionId - The market session ID
   * @returns Promise resolving to config or null if not found
   */
  getConfig(sessionId: string): Promise<PrizePhaseConfig | null>

  /**
   * Create a new prize phase config
   * @param data - The config creation data
   * @returns Promise resolving to the created config
   */
  createConfig(data: CreateConfigData): Promise<PrizePhaseConfig>

  /**
   * Update prize phase config
   * @param sessionId - The market session ID
   * @param data - The update data
   * @returns Promise resolving when update is complete
   */
  updateConfig(sessionId: string, data: UpdateConfigData): Promise<void>

  // ==================== Category Operations ====================

  /**
   * Get all system categories
   * @returns Promise resolving to array of system prize categories
   */
  getCategories(): Promise<PrizeCategory[]>

  /**
   * Get categories for a specific session (includes custom categories)
   * @param sessionId - The market session ID
   * @returns Promise resolving to array of categories
   */
  getCategoriesForSession(sessionId: string): Promise<PrizeCategory[]>

  /**
   * Create a new prize category
   * @param data - The category creation data
   * @returns Promise resolving to the created category
   */
  createCategory(data: CreateCategoryData): Promise<PrizeCategory>

  /**
   * Delete a prize category
   * @param categoryId - The category ID
   * @returns Promise resolving when deletion is complete
   */
  deleteCategory(categoryId: string): Promise<void>

  /**
   * Get a category by ID
   * @param categoryId - The category ID
   * @returns Promise resolving to the category or null
   */
  getCategoryById(categoryId: string): Promise<PrizeCategory | null>

  // ==================== Prize Operations ====================

  /**
   * Get all prizes for a session
   * @param sessionId - The market session ID
   * @returns Promise resolving to array of prizes
   */
  getPrizes(sessionId: string): Promise<SessionPrize[]>

  /**
   * Get prizes for a category
   * @param categoryId - The category ID
   * @returns Promise resolving to array of prizes
   */
  getPrizesByCategory(categoryId: string): Promise<SessionPrize[]>

  /**
   * Assign a prize to a member
   * @param data - The prize assignment data
   * @returns Promise resolving to the assigned prize
   */
  assignPrize(data: AssignPrizeData): Promise<SessionPrize>

  /**
   * Unassign a prize (remove assignment)
   * @param categoryId - The category ID
   * @param memberId - The member ID
   * @returns Promise resolving when unassignment is complete
   */
  unassignPrize(categoryId: string, memberId: string): Promise<void>

  /**
   * Get a specific prize assignment
   * @param categoryId - The category ID
   * @param memberId - The member ID
   * @returns Promise resolving to the prize or null
   */
  getPrize(categoryId: string, memberId: string): Promise<SessionPrize | null>

  // ==================== Session Operations ====================

  /**
   * Get session info
   * @param sessionId - The market session ID
   * @returns Promise resolving to session info or null
   */
  getSession(sessionId: string): Promise<SessionInfo | null>

  /**
   * Get all active members for a league
   * @param leagueId - The league ID
   * @returns Promise resolving to array of member info
   */
  getActiveMembers(leagueId: string): Promise<MemberInfo[]>

  /**
   * Get member by user ID and league
   * @param userId - The user ID
   * @param leagueId - The league ID
   * @returns Promise resolving to member info or null
   */
  getMemberByUserId(userId: string, leagueId: string): Promise<MemberInfo | null>

  /**
   * Update member budget
   * @param memberId - The member ID
   * @param amount - The amount to add (can be negative)
   * @returns Promise resolving to the new budget
   */
  updateMemberBudget(memberId: string, amount: number): Promise<number>

  // ==================== Finalization ====================

  /**
   * Finalize the prize phase for a session
   * Applies all prizes to member budgets and marks phase as finalized
   * @param sessionId - The market session ID
   * @returns Promise resolving when finalization is complete
   */
  finalizeSession(sessionId: string): Promise<void>

  /**
   * Check if all required categories have been assigned
   * @param sessionId - The market session ID
   * @returns Promise resolving to true if all required categories are assigned
   */
  areAllRequiredCategoriesAssigned(sessionId: string): Promise<boolean>
}
