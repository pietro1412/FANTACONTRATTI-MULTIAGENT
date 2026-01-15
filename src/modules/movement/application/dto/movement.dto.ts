/**
 * Movement DTOs - Application Layer
 *
 * Data Transfer Objects for the movement module.
 */

/**
 * DTO for recording a new movement
 */
export interface RecordMovementDto {
  leagueId: string
  playerId: string
  movementType: string
  fromMemberId?: string | null
  toMemberId?: string | null
  price?: number
  oldSalary?: number | null
  oldDuration?: number | null
  oldClause?: number | null
  newSalary?: number | null
  newDuration?: number | null
  newClause?: number | null
  auctionId?: string | null
  tradeId?: string | null
  marketSessionId?: string | null
}

/**
 * DTO for getting movement history
 */
export interface GetMovementHistoryDto {
  leagueId: string
  userId: string
  limit?: number
  offset?: number
  movementType?: string
  playerId?: string
  semester?: number
}

/**
 * DTO for getting player history
 */
export interface GetPlayerHistoryDto {
  leagueId: string
  playerId: string
  userId: string
}

/**
 * DTO for creating a prophecy
 */
export interface CreateProphecyDto {
  movementId: string
  userId: string
  content: string
}

/**
 * Result DTO for movement history
 */
export interface MovementHistoryResultDto {
  movements: Array<{
    id: string
    type: string
    player: {
      id: string
      name: string
      position: string
      team: string
    }
    from: {
      memberId: string
      username: string
      teamName: string
    } | null
    to: {
      memberId: string
      username: string
      teamName: string
    } | null
    price: number | null
    oldContract: {
      salary: number
      duration: number | null
      clause: number | null
    } | null
    newContract: {
      salary: number
      duration: number | null
      clause: number | null
    } | null
    prophecies: Array<{
      id: string
      content: string
      authorRole: string
      author: {
        memberId: string
        username: string
        teamName: string
      }
      createdAt: Date
      source: string
    }>
    createdAt: Date
  }>
}

/**
 * Result DTO for player history
 */
export interface PlayerHistoryResultDto {
  player: {
    id: string
    name: string
    position: string
    team: string
    quotation: number
  }
  currentOwner: {
    memberId: string
    username: string
    teamName: string
    contract: {
      salary: number
      duration: number
      rescissionClause: number | null
    } | null
  } | null
  movements: Array<{
    id: string
    type: string
    from: string
    to: string
    price: number | null
    oldContract: {
      salary: number
      duration: number | null
      clause: number | null
    } | null
    newContract: {
      salary: number
      duration: number | null
      clause: number | null
    } | null
    session: string | null
    prophecies: Array<{
      content: string
      authorRole: string
      author: string
    }>
    date: Date
  }>
  allProphecies: Array<{
    content: string
    authorRole: string
    author: string
    date: Date
  }>
}

/**
 * Result DTO for prophecy creation
 */
export interface ProphecyResultDto {
  id: string
  content: string
  authorRole: string
  playerName: string
  author: string
}

/**
 * Result DTO for prophecy check
 */
export interface CanMakeProphecyResultDto {
  canMakeProphecy: boolean
  reason?: string
  role?: 'BUYER' | 'SELLER'
  playerName?: string
  existingProphecy?: {
    content: string
    createdAt: Date
  }
}
