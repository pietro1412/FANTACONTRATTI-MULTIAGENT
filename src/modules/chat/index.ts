/**
 * Chat Module - Public API
 *
 * This file exports the public API of the Chat module.
 * External modules should only import from this file.
 */

// Domain Entities
export type {
  ChatMessage,
  ChatMessageWithDetails,
  MessageType,
  CreateMessageData,
  MessageFilter,
  FormattedMessage,
} from './domain/entities/chat-message.entity'

// Domain Repository Interfaces
export type {
  IChatRepository,
  IPusherService,
  SessionValidationResult,
} from './domain/repositories/chat.repository.interface'

// Application DTOs
export type {
  SendMessageDto,
  GetMessagesDto,
  MessageResultDto,
  MessagesResultDto,
  SendBotMessageDto,
} from './application/dto/chat.dto'

// Application Use Cases
export { SendMessageUseCase } from './application/use-cases/send-message.use-case'
export { GetMessagesUseCase } from './application/use-cases/get-messages.use-case'
