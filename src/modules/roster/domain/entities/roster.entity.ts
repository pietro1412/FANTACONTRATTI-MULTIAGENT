/**
 * Roster Entity - Domain Layer
 * Represents a player's position in a league member's roster
 */

/**
 * Types of player acquisition
 */
export type AcquisitionType = 'AUCTION' | 'RUBATA' | 'SVINCOLATI' | 'TRADE' | 'INITIAL'

/**
 * Status of a player in the roster
 */
export type RosterStatus = 'ACTIVE' | 'RELEASED' | 'TRADED'

/**
 * Player Roster Entity
 * Represents ownership of a player by a league member
 */
export interface PlayerRoster {
  id: string
  leagueMemberId: string
  playerId: string
  acquisitionType: AcquisitionType
  acquisitionPrice: number
  status: RosterStatus
  acquiredAt: Date
}

/**
 * Data required to create a new roster entry
 */
export interface CreateRosterData {
  leagueMemberId: string
  playerId: string
  acquisitionType: AcquisitionType
  acquisitionPrice: number
}

/**
 * Validates that an acquisition type is valid
 */
export function isValidAcquisitionType(type: string): type is AcquisitionType {
  return ['AUCTION', 'RUBATA', 'SVINCOLATI', 'TRADE', 'INITIAL'].includes(type)
}

/**
 * Validates that a roster status is valid
 */
export function isValidRosterStatus(status: string): status is RosterStatus {
  return ['ACTIVE', 'RELEASED', 'TRADED'].includes(status)
}
