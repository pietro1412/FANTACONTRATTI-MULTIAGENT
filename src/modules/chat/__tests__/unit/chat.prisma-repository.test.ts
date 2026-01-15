/**
 * Chat Prisma Repository Tests
 *
 * Unit tests for ChatPrismaRepository with mocked Prisma client.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ChatPrismaRepository } from '../../infrastructure/repositories/chat.prisma-repository'

// Mock Prisma client
vi.mock('@/lib/prisma', () => ({
  prisma: {
    chatMessage: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    marketSession: {
      findUnique: vi.fn(),
    },
    leagueMember: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'

describe('ChatPrismaRepository', () => {
  let repository: ChatPrismaRepository

  const mockMessage = {
    id: 'message-1',
    marketSessionId: 'session-1',
    memberId: 'member-1',
    content: 'Hello everyone!',
    isSystem: false,
    createdAt: new Date('2024-01-01T12:00:00Z'),
    member: {
      id: 'member-1',
      teamName: 'Team A',
      user: { username: 'user1' },
    },
  }

  const mockMember = {
    id: 'member-1',
    userId: 'user-1',
    leagueId: 'league-1',
    teamName: 'Team A',
    role: 'MANAGER',
    status: 'ACTIVE',
    joinType: 'REQUEST',
    currentBudget: 100,
    rubataOrder: null,
    firstMarketOrder: null,
    joinedAt: new Date(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    repository = new ChatPrismaRepository()
  })

  describe('create', () => {
    it('should create a new message', async () => {
      vi.mocked(prisma.chatMessage.create).mockResolvedValue(mockMessage)

      const result = await repository.create({
        sessionId: 'session-1',
        memberId: 'member-1',
        content: 'Hello everyone!',
      })

      expect(result.content).toBe('Hello everyone!')
      expect(result.type).toBe('USER')
      expect(result.member.teamName).toBe('Team A')
      expect(prisma.chatMessage.create).toHaveBeenCalledWith({
        data: {
          marketSessionId: 'session-1',
          memberId: 'member-1',
          content: 'Hello everyone!',
          isSystem: false,
        },
        include: expect.any(Object),
      })
    })

    it('should create a system message', async () => {
      vi.mocked(prisma.chatMessage.create).mockResolvedValue({
        ...mockMessage,
        isSystem: true,
        content: 'Auction started',
      })

      const result = await repository.create({
        sessionId: 'session-1',
        memberId: 'member-1',
        content: 'Auction started',
        isSystem: true,
      })

      expect(result.type).toBe('SYSTEM')
    })
  })

  describe('findMany', () => {
    it('should return messages for a session', async () => {
      vi.mocked(prisma.chatMessage.findMany).mockResolvedValue([mockMessage])

      const result = await repository.findMany({
        sessionId: 'session-1',
      })

      expect(result).toHaveLength(1)
      expect(result[0].content).toBe('Hello everyone!')
      expect(result[0].member.teamName).toBe('Team A')
    })

    it('should filter by since timestamp', async () => {
      vi.mocked(prisma.chatMessage.findMany).mockResolvedValue([mockMessage])

      const since = new Date('2024-01-01T11:00:00Z')
      await repository.findMany({
        sessionId: 'session-1',
        since,
      })

      expect(prisma.chatMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            marketSessionId: 'session-1',
            createdAt: { gt: since },
          },
        })
      )
    })

    it('should limit results', async () => {
      vi.mocked(prisma.chatMessage.findMany).mockResolvedValue([mockMessage])

      await repository.findMany({
        sessionId: 'session-1',
        limit: 50,
      })

      expect(prisma.chatMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
        })
      )
    })
  })

  describe('findById', () => {
    it('should return message when found', async () => {
      vi.mocked(prisma.chatMessage.findUnique).mockResolvedValue(mockMessage)

      const result = await repository.findById('message-1')

      expect(result).not.toBeNull()
      expect(result?.content).toBe('Hello everyone!')
    })

    it('should return null when message not found', async () => {
      vi.mocked(prisma.chatMessage.findUnique).mockResolvedValue(null)

      const result = await repository.findById('non-existent')

      expect(result).toBeNull()
    })
  })

  describe('validateSessionAccess', () => {
    it('should return valid when user is active member', async () => {
      vi.mocked(prisma.marketSession.findUnique).mockResolvedValue({
        id: 'session-1',
        leagueId: 'league-1',
        status: 'ACTIVE',
        type: 'MERCATO_RICORRENTE',
        season: 1,
        semester: 1,
        currentPhase: 'ASTA_LIBERA',
        currentRole: null,
        turnOrder: null,
        currentTurnIndex: null,
        auctionTimerSeconds: 30,
        rubataOrder: null,
        rubataBoard: null,
        rubataBoardIndex: null,
        rubataOfferTimerSeconds: 30,
        rubataAuctionTimerSeconds: 15,
        rubataTimerStartedAt: null,
        rubataState: null,
        rubataReadyMembers: null,
        rubataAuctionReadyInfo: null,
        rubataPendingAck: null,
        svincolatiTurnOrder: null,
        svincolatiCurrentTurnIndex: null,
        svincolatiTimerSeconds: 30,
        svincolatiTimerStartedAt: null,
        svincolatiState: null,
        svincolatiReadyMembers: null,
        svincolatiPassedMembers: null,
        svincolatiFinishedMembers: null,
        svincolatiPendingPlayerId: null,
        svincolatiPendingNominatorId: null,
        svincolatiNominatorConfirmed: false,
        svincolatiPendingAck: null,
        readyMembers: null,
        pendingNominationPlayerId: null,
        pendingNominatorId: null,
        nominatorConfirmed: false,
        startsAt: null,
        endsAt: null,
        phaseStartedAt: null,
        createdAt: new Date(),
      })
      vi.mocked(prisma.leagueMember.findUnique).mockResolvedValue(mockMember)

      const result = await repository.validateSessionAccess('session-1', 'user-1')

      expect(result.isValid).toBe(true)
      expect(result.memberId).toBe('member-1')
      expect(result.sessionId).toBe('session-1')
      expect(result.leagueId).toBe('league-1')
    })

    it('should return invalid when session not found', async () => {
      vi.mocked(prisma.marketSession.findUnique).mockResolvedValue(null)

      const result = await repository.validateSessionAccess('non-existent', 'user-1')

      expect(result.isValid).toBe(false)
      expect(result.memberId).toBeNull()
    })

    it('should return invalid when user is not active member', async () => {
      vi.mocked(prisma.marketSession.findUnique).mockResolvedValue({
        id: 'session-1',
        leagueId: 'league-1',
        status: 'ACTIVE',
        type: 'MERCATO_RICORRENTE',
        season: 1,
        semester: 1,
        currentPhase: 'ASTA_LIBERA',
        currentRole: null,
        turnOrder: null,
        currentTurnIndex: null,
        auctionTimerSeconds: 30,
        rubataOrder: null,
        rubataBoard: null,
        rubataBoardIndex: null,
        rubataOfferTimerSeconds: 30,
        rubataAuctionTimerSeconds: 15,
        rubataTimerStartedAt: null,
        rubataState: null,
        rubataReadyMembers: null,
        rubataAuctionReadyInfo: null,
        rubataPendingAck: null,
        svincolatiTurnOrder: null,
        svincolatiCurrentTurnIndex: null,
        svincolatiTimerSeconds: 30,
        svincolatiTimerStartedAt: null,
        svincolatiState: null,
        svincolatiReadyMembers: null,
        svincolatiPassedMembers: null,
        svincolatiFinishedMembers: null,
        svincolatiPendingPlayerId: null,
        svincolatiPendingNominatorId: null,
        svincolatiNominatorConfirmed: false,
        svincolatiPendingAck: null,
        readyMembers: null,
        pendingNominationPlayerId: null,
        pendingNominatorId: null,
        nominatorConfirmed: false,
        startsAt: null,
        endsAt: null,
        phaseStartedAt: null,
        createdAt: new Date(),
      })
      vi.mocked(prisma.leagueMember.findUnique).mockResolvedValue({
        ...mockMember,
        status: 'PENDING',
      })

      const result = await repository.validateSessionAccess('session-1', 'user-1')

      expect(result.isValid).toBe(false)
      expect(result.memberId).toBeNull()
    })

    it('should return invalid when user is not a member', async () => {
      vi.mocked(prisma.marketSession.findUnique).mockResolvedValue({
        id: 'session-1',
        leagueId: 'league-1',
        status: 'ACTIVE',
        type: 'MERCATO_RICORRENTE',
        season: 1,
        semester: 1,
        currentPhase: 'ASTA_LIBERA',
        currentRole: null,
        turnOrder: null,
        currentTurnIndex: null,
        auctionTimerSeconds: 30,
        rubataOrder: null,
        rubataBoard: null,
        rubataBoardIndex: null,
        rubataOfferTimerSeconds: 30,
        rubataAuctionTimerSeconds: 15,
        rubataTimerStartedAt: null,
        rubataState: null,
        rubataReadyMembers: null,
        rubataAuctionReadyInfo: null,
        rubataPendingAck: null,
        svincolatiTurnOrder: null,
        svincolatiCurrentTurnIndex: null,
        svincolatiTimerSeconds: 30,
        svincolatiTimerStartedAt: null,
        svincolatiState: null,
        svincolatiReadyMembers: null,
        svincolatiPassedMembers: null,
        svincolatiFinishedMembers: null,
        svincolatiPendingPlayerId: null,
        svincolatiPendingNominatorId: null,
        svincolatiNominatorConfirmed: false,
        svincolatiPendingAck: null,
        readyMembers: null,
        pendingNominationPlayerId: null,
        pendingNominatorId: null,
        nominatorConfirmed: false,
        startsAt: null,
        endsAt: null,
        phaseStartedAt: null,
        createdAt: new Date(),
      })
      vi.mocked(prisma.leagueMember.findUnique).mockResolvedValue(null)

      const result = await repository.validateSessionAccess('session-1', 'user-1')

      expect(result.isValid).toBe(false)
    })
  })

  describe('getRandomMember', () => {
    it('should return random member ID', async () => {
      vi.mocked(prisma.marketSession.findUnique).mockResolvedValue({
        id: 'session-1',
        leagueId: 'league-1',
        status: 'ACTIVE',
        type: 'MERCATO_RICORRENTE',
        season: 1,
        semester: 1,
        currentPhase: 'ASTA_LIBERA',
        currentRole: null,
        turnOrder: null,
        currentTurnIndex: null,
        auctionTimerSeconds: 30,
        rubataOrder: null,
        rubataBoard: null,
        rubataBoardIndex: null,
        rubataOfferTimerSeconds: 30,
        rubataAuctionTimerSeconds: 15,
        rubataTimerStartedAt: null,
        rubataState: null,
        rubataReadyMembers: null,
        rubataAuctionReadyInfo: null,
        rubataPendingAck: null,
        svincolatiTurnOrder: null,
        svincolatiCurrentTurnIndex: null,
        svincolatiTimerSeconds: 30,
        svincolatiTimerStartedAt: null,
        svincolatiState: null,
        svincolatiReadyMembers: null,
        svincolatiPassedMembers: null,
        svincolatiFinishedMembers: null,
        svincolatiPendingPlayerId: null,
        svincolatiPendingNominatorId: null,
        svincolatiNominatorConfirmed: false,
        svincolatiPendingAck: null,
        readyMembers: null,
        pendingNominationPlayerId: null,
        pendingNominatorId: null,
        nominatorConfirmed: false,
        startsAt: null,
        endsAt: null,
        phaseStartedAt: null,
        createdAt: new Date(),
      })
      vi.mocked(prisma.leagueMember.findMany).mockResolvedValue([
        { id: 'member-2' },
        { id: 'member-3' },
      ])

      const result = await repository.getRandomMember('session-1', 'user-1')

      expect(result).toBeTruthy()
      expect(['member-2', 'member-3']).toContain(result)
    })

    it('should return null when session not found', async () => {
      vi.mocked(prisma.marketSession.findUnique).mockResolvedValue(null)

      const result = await repository.getRandomMember('non-existent', 'user-1')

      expect(result).toBeNull()
    })

    it('should return null when no other members available', async () => {
      vi.mocked(prisma.marketSession.findUnique).mockResolvedValue({
        id: 'session-1',
        leagueId: 'league-1',
        status: 'ACTIVE',
        type: 'MERCATO_RICORRENTE',
        season: 1,
        semester: 1,
        currentPhase: 'ASTA_LIBERA',
        currentRole: null,
        turnOrder: null,
        currentTurnIndex: null,
        auctionTimerSeconds: 30,
        rubataOrder: null,
        rubataBoard: null,
        rubataBoardIndex: null,
        rubataOfferTimerSeconds: 30,
        rubataAuctionTimerSeconds: 15,
        rubataTimerStartedAt: null,
        rubataState: null,
        rubataReadyMembers: null,
        rubataAuctionReadyInfo: null,
        rubataPendingAck: null,
        svincolatiTurnOrder: null,
        svincolatiCurrentTurnIndex: null,
        svincolatiTimerSeconds: 30,
        svincolatiTimerStartedAt: null,
        svincolatiState: null,
        svincolatiReadyMembers: null,
        svincolatiPassedMembers: null,
        svincolatiFinishedMembers: null,
        svincolatiPendingPlayerId: null,
        svincolatiPendingNominatorId: null,
        svincolatiNominatorConfirmed: false,
        svincolatiPendingAck: null,
        readyMembers: null,
        pendingNominationPlayerId: null,
        pendingNominatorId: null,
        nominatorConfirmed: false,
        startsAt: null,
        endsAt: null,
        phaseStartedAt: null,
        createdAt: new Date(),
      })
      vi.mocked(prisma.leagueMember.findMany).mockResolvedValue([])

      const result = await repository.getRandomMember('session-1', 'user-1')

      expect(result).toBeNull()
    })
  })
})
