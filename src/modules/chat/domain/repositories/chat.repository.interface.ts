/**
 * Chat Repository Interface - Domain Layer
 *
 * Defines the contract for chat message persistence operations.
 * Implementations can use any data source (database, API, etc.)
 */

import type {
  ChatMessage,
  ChatMessageWithDetails,
  CreateMessageData,
  FormattedMessage,
  MessageFilter,
} from '../entities/chat-message.entity'

/**
 * Session validation result
 */
export interface SessionValidationResult {
  isValid: boolean
  memberId: string | null
  sessionId: string | null
  leagueId: string | null
}

/**
 * Chat repository interface
 */
export interface IChatRepository {
  /**
   * Create a new chat message
   * @param data - The message data
   * @returns The created message with details
   */
  create(data: CreateMessageData): Promise<ChatMessageWithDetails>

  /**
   * Get messages for a session
   * @param filter - Filter options
   * @returns Array of formatted messages
   */
  findMany(filter: MessageFilter): Promise<FormattedMessage[]>

  /**
   * Find a message by ID
   * @param id - The message ID
   * @returns The message or null if not found
   */
  findById(id: string): Promise<ChatMessage | null>

  /**
   * Validate session access for a user
   * @param sessionId - The session ID
   * @param userId - The user ID
   * @returns Validation result with member ID if valid
   */
  validateSessionAccess(sessionId: string, userId: string): Promise<SessionValidationResult>

  /**
   * Get random member from session (excluding specified user)
   * @param sessionId - The session ID
   * @param excludeUserId - User ID to exclude
   * @returns Random member ID or null if none available
   */
  getRandomMember(sessionId: string, excludeUserId: string): Promise<string | null>
}

/**
 * Pusher service interface for real-time messaging
 */
export interface IPusherService {
  /**
   * Send a message to a channel
   * @param channel - The channel name
   * @param event - The event name
   * @param data - The data to send
   */
  trigger(channel: string, event: string, data: unknown): Promise<void>
}
