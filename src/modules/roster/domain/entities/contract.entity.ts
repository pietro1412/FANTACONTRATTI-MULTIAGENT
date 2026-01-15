/**
 * Contract Entity - Domain Layer
 * Represents a player's contract terms
 */

/**
 * Status of a contract
 */
export type ContractStatus = 'ACTIVE' | 'EXPIRED' | 'CONSOLIDATED'

/**
 * Player Contract Entity
 * Represents the contractual terms for a player in a roster
 */
export interface PlayerContract {
  id: string
  rosterId: string
  salary: number
  duration: number  // Years/semesters remaining
  clausola: number | null  // Release clause (rescission clause)
  status: ContractStatus
  renewedAt: Date | null
  consolidatedAt: Date | null
}

/**
 * Data required to create a new contract
 */
export interface CreateContractData {
  rosterId: string
  salary: number
  duration: number
}

/**
 * Data for updating an existing contract
 */
export interface UpdateContractData {
  salary?: number
  duration?: number
  clausola?: number | null
  status?: ContractStatus
  renewedAt?: Date | null
  consolidatedAt?: Date | null
}

/**
 * Maximum contract duration in semesters
 */
export const MAX_CONTRACT_DURATION = 4

/**
 * Minimum contract duration in semesters
 */
export const MIN_CONTRACT_DURATION = 1

/**
 * Validates that a contract status is valid
 */
export function isValidContractStatus(status: string): status is ContractStatus {
  return ['ACTIVE', 'EXPIRED', 'CONSOLIDATED'].includes(status)
}

/**
 * Validates contract duration
 */
export function isValidDuration(duration: number): boolean {
  return duration >= MIN_CONTRACT_DURATION && duration <= MAX_CONTRACT_DURATION
}

/**
 * Checks if a contract can be renewed (not already at max duration)
 */
export function canRenew(contract: PlayerContract): boolean {
  return contract.duration < MAX_CONTRACT_DURATION && contract.status === 'ACTIVE'
}
