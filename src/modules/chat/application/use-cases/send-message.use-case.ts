/**
 * Send Message Use Case - Application Layer
 *
 * Validates message content, creates message, and sends via Pusher.
 * Chat needs low latency so messages are sent immediately (not batched).
 */

import { Result, ok, fail } from '../../../../shared/infrastructure/http/result'
import { ForbiddenError, ValidationError, NotFoundError } from '../../../../shared/infrastructure/http/errors'
import type { IChatRepository, IPusherService } from '../../domain/repositories/chat.repository.interface'
import type { SendMessageDto, MessageResultDto } from '../dto/chat.dto'

export class SendMessageUseCase {
  constructor(
    private readonly chatRepository: IChatRepository,
    private readonly pusherService?: IPusherService
  ) {}

  async execute(dto: SendMessageDto): Promise<Result<MessageResultDto, ForbiddenError | ValidationError | NotFoundError>> {
    // Validate content
    if (!dto.content || dto.content.trim().length === 0) {
      return fail(new ValidationError('Il messaggio non puo essere vuoto'))
    }

    if (dto.content.length > 1000) {
      return fail(new ValidationError('Il messaggio non puo superare i 1000 caratteri'))
    }

    // Validate session access
    const validation = await this.chatRepository.validateSessionAccess(dto.sessionId, dto.userId)

    if (!validation.isValid) {
      if (!validation.sessionId) {
        return fail(new NotFoundError('Sessione non trovata'))
      }
      return fail(new ForbiddenError('Non sei membro di questa lega'))
    }

    // Create the message
    const message = await this.chatRepository.create({
      sessionId: dto.sessionId,
      memberId: validation.memberId!,
      content: dto.content.trim(),
      isSystem: false,
    })

    const result: MessageResultDto = {
      id: message.id,
      content: message.content,
      isSystem: false,
      createdAt: message.createdAt.toISOString(),
      member: message.member,
    }

    // Send via Pusher immediately (low latency requirement)
    if (this.pusherService) {
      await this.pusherService.trigger(
        `session-${dto.sessionId}`,
        'new-message',
        result
      )
    }

    return ok(result)
  }
}
