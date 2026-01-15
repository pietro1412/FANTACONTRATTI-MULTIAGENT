/**
 * Chat DTOs - Application Layer
 *
 * Data Transfer Objects for the chat module.
 */

/**
 * DTO for sending a message
 */
export interface SendMessageDto {
  sessionId: string
  userId: string
  content: string
}

/**
 * DTO for getting messages
 */
export interface GetMessagesDto {
  sessionId: string
  userId: string
  since?: string
}

/**
 * Result DTO for a single message
 */
export interface MessageResultDto {
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

/**
 * Result DTO for message list
 */
export interface MessagesResultDto {
  messages: MessageResultDto[]
}

/**
 * DTO for sending bot message (admin only)
 */
export interface SendBotMessageDto {
  sessionId: string
  userId: string
}
