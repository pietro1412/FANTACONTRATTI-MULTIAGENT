/**
 * Contract Calculator Service Interface - Domain Layer
 * Defines the contract for calculating contract-related costs and values
 */

/**
 * Multipliers for rescission clause calculation based on remaining duration
 * From FANTACONTRATTI business rules:
 * - 4 semesters = multiplier 11
 * - 3 semesters = multiplier 9
 * - 2 semesters = multiplier 7
 * - 1 semester = multiplier 3
 */
export const DURATION_MULTIPLIERS: Record<number, number> = {
  4: 11,
  3: 9,
  2: 7,
  1: 3,
}

/**
 * Interface for contract cost calculations
 */
export interface IContractCalculator {
  /**
   * Calculate rescission cost based on salary and remaining duration
   * Formula: salary * multiplier (based on duration)
   * @param salary - The contract salary
   * @param duration - Remaining duration in semesters
   * @returns The rescission (release clause) cost
   */
  calculateRescission(salary: number, duration: number): number

  /**
   * Calculate renewal cost (salary increase over the contract period)
   * @param currentSalary - The current contract salary
   * @param yearsToAdd - Number of years/semesters to add
   * @returns The cost of the renewal
   */
  calculateRenewalCost(currentSalary: number, yearsToAdd: number): number

  /**
   * Calculate consolidation bonus for contracts in year 4+
   * @param salary - The contract salary
   * @returns The consolidation bonus amount
   */
  calculateConsolidationBonus(salary: number): number

  /**
   * Calculate release cost when cutting a player
   * Formula: (salary * duration) / 2
   * @param salary - The contract salary
   * @param duration - Remaining duration in semesters
   * @returns The cost to release the player
   */
  calculateReleaseCost(salary: number, duration: number): number
}

/**
 * Default implementation of the Contract Calculator
 */
export class ContractCalculator implements IContractCalculator {
  /**
   * Get the multiplier for a given duration
   */
  private getMultiplier(duration: number): number {
    return DURATION_MULTIPLIERS[duration] ?? 3
  }

  /**
   * Calculate rescission clause (clausola rescissoria)
   * Uses the duration multipliers from business rules
   */
  calculateRescission(salary: number, duration: number): number {
    return salary * this.getMultiplier(duration)
  }

  /**
   * Calculate the cost of renewing a contract
   * This is the difference in total contract value
   */
  calculateRenewalCost(currentSalary: number, yearsToAdd: number): number {
    // The renewal cost is the additional commitment
    // For simplicity: yearsToAdd * some base calculation
    // In practice, this should compare old vs new total value
    return currentSalary * yearsToAdd
  }

  /**
   * Calculate consolidation bonus
   * Typically a percentage of salary for long-term contracts
   */
  calculateConsolidationBonus(salary: number): number {
    // Standard consolidation bonus is based on salary
    // Business rule: bonus for keeping player 4+ years
    return Math.ceil(salary * 0.5) // 50% bonus for loyalty
  }

  /**
   * Calculate the cost to release/cut a player
   * Formula: (salary * remaining duration) / 2
   */
  calculateReleaseCost(salary: number, duration: number): number {
    return Math.ceil((salary * duration) / 2)
  }
}

/**
 * Breakdown of rescission costs for display
 */
export interface RescissionBreakdown {
  salary: number
  duration: number
  multiplier: number
  totalCost: number
}

/**
 * Get a detailed breakdown of rescission calculation
 */
export function getRescissionBreakdown(salary: number, duration: number): RescissionBreakdown {
  const multiplier = DURATION_MULTIPLIERS[duration] ?? 3
  return {
    salary,
    duration,
    multiplier,
    totalCost: salary * multiplier,
  }
}
