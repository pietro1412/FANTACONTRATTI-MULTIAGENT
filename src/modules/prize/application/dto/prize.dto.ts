/**
 * Prize DTOs - Application Layer
 * Data Transfer Objects for prize operations
 */

import type {
  PrizePhaseStatus,
  PrizePhaseConfig,
  PrizeCategory,
  SessionPrize,
  MemberPrizeSummary,
} from '../../domain/entities/prize.entity'

// ==================== Input DTOs ====================

/**
 * Request DTO for setting up prizes phase
 */
export interface SetupPrizesDto {
  sessionId: string
  adminUserId: string
  baseReincrement?: number
  totalBudget?: number
}

/**
 * Request DTO for assigning a prize
 */
export interface AssignPrizeDto {
  sessionId: string
  categoryId: string
  memberId: string
  amount: number
  adminUserId: string
}

/**
 * Request DTO for unassigning a prize
 */
export interface UnassignPrizeDto {
  sessionId: string
  categoryId: string
  memberId: string
  adminUserId: string
}

/**
 * Request DTO for finalizing prizes
 */
export interface FinalizePrizesDto {
  sessionId: string
  adminUserId: string
}

/**
 * Request DTO for getting prize status
 */
export interface GetPrizeStatusDto {
  sessionId: string
  userId: string
}

/**
 * Request DTO for creating a category
 */
export interface CreateCategoryDto {
  sessionId: string
  name: string
  description?: string
  defaultAmount?: number
  adminUserId: string
}

/**
 * Request DTO for updating base reincrement
 */
export interface UpdateBaseReincrementDto {
  sessionId: string
  amount: number
  adminUserId: string
}

// ==================== Output DTOs ====================

/**
 * Response DTO for setup prizes operation
 */
export interface SetupPrizesResultDto {
  configId: string
  sessionId: string
  status: PrizePhaseStatus
  baseReincrement: number
  totalBudget: number
  categoriesCreated: number
}

/**
 * Response DTO for assign prize operation
 */
export interface AssignPrizeResultDto {
  prizeId: string
  categoryId: string
  categoryName: string
  memberId: string
  teamName: string
  amount: number
  assignedAt: Date
}

/**
 * Response DTO for unassign prize operation
 */
export interface UnassignPrizeResultDto {
  categoryId: string
  memberId: string
  amountReturned: number
}

/**
 * Response DTO for finalize prizes operation
 */
export interface FinalizePrizesResultDto {
  sessionId: string
  finalizedAt: Date
  membersUpdated: Array<{
    memberId: string
    teamName: string
    totalPrizeReceived: number
    newBudget: number
  }>
}

/**
 * Category with prizes for display
 */
export interface CategoryWithPrizesDto {
  id: string
  name: string
  description: string
  isCustom: boolean
  prizes: Array<{
    memberId: string
    teamName: string
    username: string
    amount: number
  }>
}

/**
 * Member info with prize totals
 */
export interface MemberPrizeInfoDto {
  id: string
  teamName: string
  username: string
  currentBudget: number
  totalPrize: number | null  // null if not visible yet (non-admin before finalization)
  baseOnly: boolean
}

/**
 * Response DTO for get prize status operation
 */
export interface PrizeStatusResultDto {
  config: {
    id: string
    sessionId: string
    status: PrizePhaseStatus
    baseReincrement: number
    totalBudget: number
    remainingBudget: number
    isFinalized: boolean
    finalizedAt: Date | null
  }
  categories: CategoryWithPrizesDto[]
  members: MemberPrizeInfoDto[]
  isAdmin: boolean
}

/**
 * Response DTO for create category operation
 */
export interface CreateCategoryResultDto {
  id: string
  name: string
  description: string
  defaultAmount: number
  isCustom: boolean
}

/**
 * Response DTO for update base reincrement operation
 */
export interface UpdateBaseReincrementResultDto {
  baseReincrement: number
}
