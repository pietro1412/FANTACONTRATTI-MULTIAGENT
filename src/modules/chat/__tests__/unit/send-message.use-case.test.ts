/**
 * Send Message Use Case Tests - TDD
 *
 * Tests for the send message use case following TDD principles.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SendMessageUseCase } from '../../application/use-cases/send-message.use-case'
import type { IChatRepository, IPusherService, SessionValidationResult } from '../../domain/repositories/chat.repository.interface'
import type { ChatMessageWithDetails } from '../../domain/entities/chat-message.entity'

describe('SendMessageUseCase', () => {
  let sendMessageUseCase: SendMessageUseCase
  let mockChatRepository: IChatRepository
  let mockPusherService: IPusherService

  const mockMessage: ChatMessageWithDetails = {
    id: 'message-123',
    sessionId: 'session-456',
    senderId: 'member-789',
    senderName: 'Test User',
    content: 'Test message',
    type: 'USER',
    createdAt: new Date('2024-01-15T10:00:00Z'),
    member: {
      id: 'member-789',
      username: 'testuser',
      teamName: 'Test Team',
    },
  }

  const validSessionResult: SessionValidationResult = {
    isValid: true,
    memberId: 'member-789',
    sessionId: 'session-456',
    leagueId: 'league-123',
  }

  beforeEach(() => {
    mockChatRepository = {
      create: vi.fn(),
      findMany: vi.fn(),
      findById: vi.fn(),
      validateSessionAccess: vi.fn(),
      getRandomMember: vi.fn(),
    }

    mockPusherService = {
      trigger: vi.fn(),
    }

    sendMessageUseCase = new SendMessageUseCase(mockChatRepository, mockPusherService)
  })

  describe('execute', () => {
    it('should return failure if content is empty', async () => {
      const result = await sendMessageUseCase.execute({
        sessionId: 'session-456',
        userId: 'user-123',
        content: '',
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toBe('Il messaggio non puo essere vuoto')
      }
    })

    it('should return failure if content is only whitespace', async () => {
      const result = await sendMessageUseCase.execute({
        sessionId: 'session-456',
        userId: 'user-123',
        content: '   ',
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toBe('Il messaggio non puo essere vuoto')
      }
    })

    it('should return failure if content exceeds 1000 characters', async () => {
      const longContent = 'a'.repeat(1001)

      const result = await sendMessageUseCase.execute({
        sessionId: 'session-456',
        userId: 'user-123',
        content: longContent,
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toBe('Il messaggio non puo superare i 1000 caratteri')
      }
    })

    it('should return failure if session is not found', async () => {
      vi.mocked(mockChatRepository.validateSessionAccess).mockResolvedValue({
        isValid: false,
        memberId: null,
        sessionId: null,
        leagueId: null,
      })

      const result = await sendMessageUseCase.execute({
        sessionId: 'invalid-session',
        userId: 'user-123',
        content: 'Test message',
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toBe('Sessione non trovata')
      }
    })

    it('should return failure if user is not a member of the league', async () => {
      vi.mocked(mockChatRepository.validateSessionAccess).mockResolvedValue({
        isValid: false,
        memberId: null,
        sessionId: 'session-456',
        leagueId: 'league-123',
      })

      const result = await sendMessageUseCase.execute({
        sessionId: 'session-456',
        userId: 'user-123',
        content: 'Test message',
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toBe('Non sei membro di questa lega')
      }
    })

    it('should successfully create a message', async () => {
      vi.mocked(mockChatRepository.validateSessionAccess).mockResolvedValue(validSessionResult)
      vi.mocked(mockChatRepository.create).mockResolvedValue(mockMessage)

      const result = await sendMessageUseCase.execute({
        sessionId: 'session-456',
        userId: 'user-123',
        content: 'Test message',
      })

      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.id).toBe('message-123')
        expect(result.value.content).toBe('Test message')
        expect(result.value.isSystem).toBe(false)
        expect(result.value.member.username).toBe('testuser')
      }
    })

    it('should trim message content', async () => {
      vi.mocked(mockChatRepository.validateSessionAccess).mockResolvedValue(validSessionResult)
      vi.mocked(mockChatRepository.create).mockResolvedValue(mockMessage)

      await sendMessageUseCase.execute({
        sessionId: 'session-456',
        userId: 'user-123',
        content: '  Test message  ',
      })

      expect(mockChatRepository.create).toHaveBeenCalledWith({
        sessionId: 'session-456',
        memberId: 'member-789',
        content: 'Test message',
        isSystem: false,
      })
    })

    it('should send message via Pusher immediately', async () => {
      vi.mocked(mockChatRepository.validateSessionAccess).mockResolvedValue(validSessionResult)
      vi.mocked(mockChatRepository.create).mockResolvedValue(mockMessage)

      await sendMessageUseCase.execute({
        sessionId: 'session-456',
        userId: 'user-123',
        content: 'Test message',
      })

      expect(mockPusherService.trigger).toHaveBeenCalledWith(
        'session-session-456',
        'new-message',
        expect.objectContaining({
          id: 'message-123',
          content: 'Test message',
        })
      )
    })

    it('should work without Pusher service', async () => {
      const useCaseWithoutPusher = new SendMessageUseCase(mockChatRepository)

      vi.mocked(mockChatRepository.validateSessionAccess).mockResolvedValue(validSessionResult)
      vi.mocked(mockChatRepository.create).mockResolvedValue(mockMessage)

      const result = await useCaseWithoutPusher.execute({
        sessionId: 'session-456',
        userId: 'user-123',
        content: 'Test message',
      })

      expect(result.isSuccess).toBe(true)
    })
  })
})
