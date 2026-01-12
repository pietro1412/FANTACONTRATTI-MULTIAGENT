/**
 * Roster DTOs - Application Layer
 * Data Transfer Objects for roster operations
 */

import type { PlayerRoster } from '../../domain/entities/roster.entity'
import type { PlayerContract } from '../../domain/entities/contract.entity'

/**
 * Player information for display
 */
export interface PlayerInfo {
  id: string
  name: string
  team: string
  position: string
}

/**
 * Complete roster detail with contract and player info
 */
export interface RosterDetailDto {
  roster: PlayerRoster
  contract: PlayerContract
  player: PlayerInfo
}

/**
 * Request DTO for renewing a contract
 */
export interface RenewContractDto {
  rosterId: string
  yearsToAdd: number
}

/**
 * Request DTO for renewing a contract with new salary
 */
export interface RenewContractWithSalaryDto {
  rosterId: string
  newSalary: number
  newDuration: number
}

/**
 * Request DTO for rescinding a contract
 */
export interface RescindContractDto {
  rosterId: string
}

/**
 * Response DTO for rescission calculation
 */
export interface RescissionCalculationDto {
  rosterId: string
  salary: number
  duration: number
  multiplier: number
  rescissionCost: number
}

/**
 * Response DTO for renewal operation
 */
export interface RenewalResultDto {
  contract: PlayerContract
  renewalCost: number
  newBudget: number
}

/**
 * Response DTO for consolidation operation
 */
export interface ConsolidationResultDto {
  contractId: string
  playerId: string
  playerName: string
  bonusReceived: number
}

/**
 * Request DTO for batch consolidation
 */
export interface ConsolidateContractsDto {
  memberId: string
}

/**
 * Complete roster summary for a member
 */
export interface RosterSummaryDto {
  memberId: string
  totalPlayers: number
  activePlayers: number
  totalSalary: number
  players: RosterDetailDto[]
}

/**
 * Validation result for renewal
 */
export interface RenewalValidationDto {
  isValid: boolean
  reason?: string
  currentSalary: number
  currentDuration: number
  proposedSalary: number
  proposedDuration: number
  renewalCost: number
  canAfford: boolean
}
