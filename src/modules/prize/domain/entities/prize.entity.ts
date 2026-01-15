/**
 * Prize Entity - Domain Layer
 * Represents prizes, categories, and phase configuration for budget rewards
 */

/**
 * Status of the prize phase
 */
export type PrizePhaseStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'FINALIZED'

/**
 * Prize Entity
 * Represents a prize awarded to a member in a category
 */
export interface Prize {
  id: string
  sessionId: string
  categoryId: string
  memberId: string | null  // Winner - null if not yet assigned
  amount: number           // Budget awarded
  assignedAt: Date | null
  assignedBy: string | null  // Admin who assigned
}

/**
 * Prize Category Entity
 * Represents a category of prizes (e.g., "Capocannoniere", "Best Defender")
 */
export interface PrizeCategory {
  id: string
  name: string         // e.g., "Capocannoniere", "Best Defender"
  description: string
  defaultAmount: number
  isCustom: boolean    // false for system prizes like "Indennizzo Partenza Estero"
}

/**
 * Prize Phase Configuration Entity
 * Tracks the state of the prize phase for a market session
 */
export interface PrizePhaseConfig {
  id: string
  sessionId: string
  status: PrizePhaseStatus
  totalBudget: number       // Total budget pool available for prizes
  remainingBudget: number   // Budget remaining to be distributed
  baseReincrement: number   // Base reincrement for all members
  startedAt: Date | null
  finalizedAt: Date | null
}

/**
 * Session Prize Entity
 * Represents a specific prize amount for a member within a category
 */
export interface SessionPrize {
  id: string
  categoryId: string
  memberId: string
  amount: number
  assignedAt: Date | null
  assignedBy: string | null
}

/**
 * Member Prize Summary
 * Summary of all prizes for a member
 */
export interface MemberPrizeSummary {
  memberId: string
  teamName: string
  username: string
  basePrize: number
  categoryPrizes: Array<{
    categoryId: string
    categoryName: string
    amount: number
  }>
  totalPrize: number
}

/**
 * Validates that a prize phase status is valid
 */
export function isValidPrizePhaseStatus(status: string): status is PrizePhaseStatus {
  return ['NOT_STARTED', 'IN_PROGRESS', 'FINALIZED'].includes(status)
}

/**
 * Validates that a prize amount is valid (non-negative integer)
 */
export function isValidPrizeAmount(amount: number): boolean {
  return Number.isInteger(amount) && amount >= 0
}

/**
 * Calculates total prize for a member
 */
export function calculateMemberTotalPrize(
  basePrize: number,
  categoryPrizes: Array<{ amount: number }>
): number {
  return basePrize + categoryPrizes.reduce((sum, p) => sum + p.amount, 0)
}
