/**
 * Get Messages Use Case - Application Layer
 *
 * Returns messages for a session with pagination support.
 */

import { Result, ok, fail } from '../../../../shared/infrastructure/http/result'
import { ForbiddenError, NotFoundError, ValidationError } from '../../../../shared/infrastructure/http/errors'
import type { IChatRepository } from '../../domain/repositories/chat.repository.interface'
import type { GetMessagesDto, MessagesResultDto } from '../dto/chat.dto'

export class GetMessagesUseCase {
  constructor(
    private readonly chatRepository: IChatRepository
  ) {}

  async execute(dto: GetMessagesDto): Promise<Result<MessagesResultDto, ForbiddenError | NotFoundError | ValidationError>> {
    // Validate required fields
    if (!dto.sessionId) {
      return fail(new ValidationError('Session ID is required'))
    }

    if (!dto.userId) {
      return fail(new ValidationError('User ID is required'))
    }

    // Validate session access
    const validation = await this.chatRepository.validateSessionAccess(dto.sessionId, dto.userId)

    if (!validation.isValid) {
      if (!validation.sessionId) {
        return fail(new NotFoundError('Sessione non trovata'))
      }
      return fail(new ForbiddenError('Non sei membro di questa lega'))
    }

    // Build filter
    const filter = {
      sessionId: dto.sessionId,
      since: dto.since ? new Date(dto.since) : undefined,
      limit: 100,
    }

    // Get messages
    const messages = await this.chatRepository.findMany(filter)

    return ok({
      messages,
    })
  }
}
