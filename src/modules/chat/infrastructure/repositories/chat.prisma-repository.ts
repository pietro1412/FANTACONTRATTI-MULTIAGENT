/**
 * Chat Prisma Repository - Infrastructure Layer
 *
 * Implements IChatRepository interface using Prisma ORM.
 * Maps between Prisma database models and domain entities.
 */

import { prisma } from '@/lib/prisma'
import type {
  IChatRepository,
  SessionValidationResult,
} from '../../domain/repositories/chat.repository.interface'
import type {
  ChatMessage,
  ChatMessageWithDetails,
  CreateMessageData,
  FormattedMessage,
  MessageFilter,
} from '../../domain/entities/chat-message.entity'

export class ChatPrismaRepository implements IChatRepository {
  /**
   * Create a new chat message
   */
  async create(data: CreateMessageData): Promise<ChatMessageWithDetails> {
    const message = await prisma.chatMessage.create({
      data: {
        marketSessionId: data.sessionId,
        memberId: data.memberId,
        content: data.content,
        isSystem: data.isSystem ?? false,
      },
      include: {
        member: {
          include: {
            user: { select: { username: true } },
          },
        },
      },
    })
    return this.mapToMessageWithDetails(message)
  }

  /**
   * Get messages for a session with pagination support
   */
  async findMany(filter: MessageFilter): Promise<FormattedMessage[]> {
    const where: Record<string, unknown> = {
      marketSessionId: filter.sessionId,
    }

    // Support cursor-based pagination with "since" timestamp
    if (filter.since) {
      where.createdAt = { gt: filter.since }
    }

    const messages = await prisma.chatMessage.findMany({
      where,
      include: {
        member: {
          include: {
            user: { select: { username: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: filter.limit || 100,
    })

    return messages.map((m) => this.mapToFormattedMessage(m))
  }

  /**
   * Find a message by ID
   */
  async findById(id: string): Promise<ChatMessage | null> {
    const message = await prisma.chatMessage.findUnique({
      where: { id },
      include: {
        member: {
          include: {
            user: { select: { username: true } },
          },
        },
      },
    })
    return message ? this.mapToMessage(message) : null
  }

  /**
   * Validate session access for a user
   * Returns member ID if user is an active member of the league with this session
   */
  async validateSessionAccess(sessionId: string, userId: string): Promise<SessionValidationResult> {
    // Get the session and its league
    const session = await prisma.marketSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        leagueId: true,
        status: true,
      },
    })

    if (!session) {
      return {
        isValid: false,
        memberId: null,
        sessionId: null,
        leagueId: null,
      }
    }

    // Check if user is an active member of the league
    const member = await prisma.leagueMember.findUnique({
      where: {
        userId_leagueId: {
          userId,
          leagueId: session.leagueId,
        },
      },
      select: {
        id: true,
        status: true,
      },
    })

    if (!member || member.status !== 'ACTIVE') {
      return {
        isValid: false,
        memberId: null,
        sessionId: session.id,
        leagueId: session.leagueId,
      }
    }

    return {
      isValid: true,
      memberId: member.id,
      sessionId: session.id,
      leagueId: session.leagueId,
    }
  }

  /**
   * Get random member from session (excluding specified user)
   * Useful for anonymous/bot messages
   */
  async getRandomMember(sessionId: string, excludeUserId: string): Promise<string | null> {
    // Get the session to get leagueId
    const session = await prisma.marketSession.findUnique({
      where: { id: sessionId },
      select: { leagueId: true },
    })

    if (!session) return null

    // Get all active members except the excluded user
    const members = await prisma.leagueMember.findMany({
      where: {
        leagueId: session.leagueId,
        status: 'ACTIVE',
        NOT: {
          userId: excludeUserId,
        },
      },
      select: { id: true },
    })

    if (members.length === 0) return null

    // Return a random member ID
    const randomIndex = Math.floor(Math.random() * members.length)
    return members[randomIndex].id
  }

  /**
   * Map Prisma ChatMessage to domain entity
   */
  private mapToMessage(message: {
    id: string
    marketSessionId: string
    memberId: string
    content: string
    isSystem: boolean
    createdAt: Date
    member: {
      teamName: string | null
      user: { username: string }
    }
  }): ChatMessage {
    return {
      id: message.id,
      sessionId: message.marketSessionId,
      senderId: message.memberId,
      senderName: message.member.teamName || message.member.user.username,
      content: message.content,
      type: message.isSystem ? 'SYSTEM' : 'USER',
      createdAt: message.createdAt,
    }
  }

  /**
   * Map Prisma ChatMessage to domain entity with details
   */
  private mapToMessageWithDetails(message: {
    id: string
    marketSessionId: string
    memberId: string
    content: string
    isSystem: boolean
    createdAt: Date
    member: {
      id: string
      teamName: string | null
      user: { username: string }
    }
  }): ChatMessageWithDetails {
    return {
      id: message.id,
      sessionId: message.marketSessionId,
      senderId: message.memberId,
      senderName: message.member.teamName || message.member.user.username,
      content: message.content,
      type: message.isSystem ? 'SYSTEM' : 'USER',
      createdAt: message.createdAt,
      member: {
        id: message.member.id,
        username: message.member.user.username,
        teamName: message.member.teamName || message.member.user.username,
      },
    }
  }

  /**
   * Map Prisma ChatMessage to formatted message for API response
   */
  private mapToFormattedMessage(message: {
    id: string
    content: string
    isSystem: boolean
    createdAt: Date
    member: {
      id: string
      teamName: string | null
      user: { username: string }
    }
  }): FormattedMessage {
    return {
      id: message.id,
      content: message.content,
      isSystem: message.isSystem,
      createdAt: message.createdAt.toISOString(),
      member: {
        id: message.member.id,
        username: message.member.user.username,
        teamName: message.member.teamName || message.member.user.username,
      },
    }
  }
}
