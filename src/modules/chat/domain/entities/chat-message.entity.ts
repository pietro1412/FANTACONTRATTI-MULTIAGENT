/**
 * Chat Message Entity - Domain Layer
 *
 * Represents a chat message in the FANTACONTRATTI system.
 * Messages are used during auction sessions for real-time communication.
 */

/**
 * Message types
 */
export type MessageType = 'USER' | 'SYSTEM' | 'BOT'

/**
 * Chat Message entity
 */
export interface ChatMessage {
  id: string
  sessionId: string
  senderId: string
  senderName: string
  content: string
  type: MessageType
  createdAt: Date
}

/**
 * Chat Message with member details
 */
export interface ChatMessageWithDetails extends ChatMessage {
  member: {
    id: string
    username: string
    teamName: string
  }
}

/**
 * Data for creating a new message
 */
export interface CreateMessageData {
  sessionId: string
  memberId: string
  content: string
  isSystem?: boolean
}

/**
 * Chat message filter options
 */
export interface MessageFilter {
  sessionId: string
  since?: Date
  limit?: number
}

/**
 * Formatted message for API response
 */
export interface FormattedMessage {
  id: string
  content: string
  isSystem: boolean
  createdAt: string
  member: {
    id: string
    username: string
    teamName: string
  }
}
