/**
 * feedback.service.test.ts - Unit Tests for Feedback Service
 *
 * Tests for the user feedback service functions.
 *
 * Creato il: 19/02/2026
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoist mock before imports
const { mockPrisma, MockPrismaClient } = vi.hoisted(() => {
  const mock = {
    leagueMember: {
      findFirst: vi.fn()
    },
    user: {
      findUnique: vi.fn()
    },
    userFeedback: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      groupBy: vi.fn()
    },
    feedbackResponse: {
      create: vi.fn()
    },
    feedbackNotification: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      upsert: vi.fn()
    },
    $transaction: vi.fn()
  }

  // Create a proper class constructor
  const MockClass = function(this: typeof mock) {
    Object.assign(this, mock)
  } as unknown as new () => typeof mock

  return { mockPrisma: mock, MockPrismaClient: MockClass }
})

// Mock Prisma with hoisted mock
vi.mock('@prisma/client', () => ({
  PrismaClient: MockPrismaClient,
  FeedbackStatus: {
    APERTA: 'APERTA',
    IN_LAVORAZIONE: 'IN_LAVORAZIONE',
    RISOLTA: 'RISOLTA',
    CHIUSA: 'CHIUSA'
  },
  FeedbackCategory: {
    BUG: 'BUG',
    FEATURE: 'FEATURE',
    MIGLIORAMENTO: 'MIGLIORAMENTO',
    ALTRO: 'ALTRO'
  }
}))

// Import after mocking
import * as feedbackService from '../services/feedback.service'

describe('Feedback Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ==================== submitFeedback ====================

  describe('submitFeedback', () => {
    it('returns error when title is empty', async () => {
      const result = await feedbackService.submitFeedback('user-1', {
        title: '',
        description: 'Some description'
      })

      expect(result.success).toBe(false)
      expect(result.message).toBe("Il titolo e' obbligatorio")
    })

    it('returns error when description is empty', async () => {
      const result = await feedbackService.submitFeedback('user-1', {
        title: 'Valid title',
        description: ''
      })

      expect(result.success).toBe(false)
      expect(result.message).toBe("La descrizione e' obbligatoria")
    })

    it('returns error when title exceeds 200 characters', async () => {
      const result = await feedbackService.submitFeedback('user-1', {
        title: 'A'.repeat(201),
        description: 'Some description'
      })

      expect(result.success).toBe(false)
      expect(result.message).toBe("Il titolo non puo' superare i 200 caratteri")
    })

    it('returns error when description exceeds 5000 characters', async () => {
      const result = await feedbackService.submitFeedback('user-1', {
        title: 'Valid title',
        description: 'A'.repeat(5001)
      })

      expect(result.success).toBe(false)
      expect(result.message).toBe("La descrizione non puo' superare i 5000 caratteri")
    })

    it('returns error when user is not member of provided league', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue(null)

      const result = await feedbackService.submitFeedback('user-1', {
        title: 'Valid title',
        description: 'Valid description',
        leagueId: 'league-1'
      })

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non sei membro di questa lega')
    })

    it('creates feedback successfully without leagueId', async () => {
      mockPrisma.userFeedback.create.mockResolvedValue({
        id: 'feedback-1',
        title: 'Bug report',
        category: 'BUG',
        status: 'APERTA',
        createdAt: new Date('2026-01-01'),
        user: { username: 'testuser' },
        league: null
      })

      const result = await feedbackService.submitFeedback('user-1', {
        title: 'Bug report',
        description: 'Something is broken'
      })

      expect(result.success).toBe(true)
      expect(result.message).toBe('Segnalazione inviata con successo')
      expect(result.data).toBeDefined()
      expect((result.data as { id: string }).id).toBe('feedback-1')
    })

    it('creates feedback successfully with leagueId and category', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'member-1' })
      mockPrisma.userFeedback.create.mockResolvedValue({
        id: 'feedback-2',
        title: 'Feature request',
        category: 'FEATURE',
        status: 'APERTA',
        createdAt: new Date('2026-01-01'),
        user: { username: 'testuser' },
        league: { name: 'League One' }
      })

      const result = await feedbackService.submitFeedback('user-1', {
        title: 'Feature request',
        description: 'I want a new feature',
        category: 'FEATURE' as never,
        leagueId: 'league-1'
      })

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
    })
  })

  // ==================== getFeedbackForManager ====================

  describe('getFeedbackForManager', () => {
    it('returns feedback list with pagination', async () => {
      const feedbackItems = [
        {
          id: 'fb-1',
          title: 'Bug 1',
          category: 'BUG',
          status: 'APERTA',
          league: { name: 'League One' },
          _count: { responses: 2 },
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-02'),
          resolvedAt: null
        }
      ]

      mockPrisma.userFeedback.findMany.mockResolvedValue(feedbackItems)
      mockPrisma.userFeedback.count.mockResolvedValue(1)

      const result = await feedbackService.getFeedbackForManager('user-1')

      expect(result.success).toBe(true)
      const data = result.data as { feedback: unknown[]; pagination: { page: number; total: number } }
      expect(data.feedback).toHaveLength(1)
      expect(data.pagination.page).toBe(1)
      expect(data.pagination.total).toBe(1)
    })

    it('filters by status when provided', async () => {
      mockPrisma.userFeedback.findMany.mockResolvedValue([])
      mockPrisma.userFeedback.count.mockResolvedValue(0)

      const result = await feedbackService.getFeedbackForManager('user-1', {
        status: 'APERTA' as never
      })

      expect(result.success).toBe(true)
      expect(mockPrisma.userFeedback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', status: 'APERTA' }
        })
      )
    })
  })

  // ==================== getFeedbackById ====================

  describe('getFeedbackById', () => {
    it('returns error when feedback not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuperAdmin: false })
      mockPrisma.userFeedback.findUnique.mockResolvedValue(null)

      const result = await feedbackService.getFeedbackById('fb-999', 'user-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Segnalazione non trovata')
    })

    it('returns error when user is not owner and not superadmin', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuperAdmin: false })
      mockPrisma.userFeedback.findUnique.mockResolvedValue({
        id: 'fb-1',
        userId: 'other-user',
        title: 'Bug',
        description: 'Desc',
        category: 'BUG',
        status: 'APERTA',
        pageContext: null,
        githubIssueId: null,
        githubIssueUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        resolvedAt: null,
        user: { id: 'other-user', username: 'otheruser' },
        league: null,
        responses: []
      })

      const result = await feedbackService.getFeedbackById('fb-1', 'user-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non autorizzato')
    })

    it('returns feedback when user is owner', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuperAdmin: false })
      mockPrisma.userFeedback.findUnique.mockResolvedValue({
        id: 'fb-1',
        userId: 'user-1',
        title: 'My Bug',
        description: 'Description',
        category: 'BUG',
        status: 'APERTA',
        pageContext: '/dashboard',
        githubIssueId: null,
        githubIssueUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        resolvedAt: null,
        user: { id: 'user-1', username: 'testuser' },
        league: null,
        responses: []
      })
      mockPrisma.feedbackNotification.updateMany.mockResolvedValue({ count: 0 })

      const result = await feedbackService.getFeedbackById('fb-1', 'user-1')

      expect(result.success).toBe(true)
      expect((result.data as { title: string }).title).toBe('My Bug')
    })

    it('returns feedback when user is superadmin (not owner)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuperAdmin: true })
      mockPrisma.userFeedback.findUnique.mockResolvedValue({
        id: 'fb-1',
        userId: 'other-user',
        title: 'Someone Bug',
        description: 'Description',
        category: 'BUG',
        status: 'APERTA',
        pageContext: null,
        githubIssueId: null,
        githubIssueUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        resolvedAt: null,
        user: { id: 'other-user', username: 'otheruser' },
        league: { id: 'league-1', name: 'League One' },
        responses: [
          {
            id: 'resp-1',
            content: 'Working on it',
            statusChange: null,
            admin: { username: 'admin1' },
            createdAt: new Date()
          }
        ]
      })
      mockPrisma.feedbackNotification.updateMany.mockResolvedValue({ count: 0 })

      const result = await feedbackService.getFeedbackById('fb-1', 'admin-1')

      expect(result.success).toBe(true)
      const data = result.data as { responses: unknown[] }
      expect(data.responses).toHaveLength(1)
    })
  })

  // ==================== getAllFeedback ====================

  describe('getAllFeedback', () => {
    it('returns error when user is not superadmin', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuperAdmin: false })

      const result = await feedbackService.getAllFeedback('user-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non autorizzato')
    })

    it('returns all feedback for superadmin', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuperAdmin: true })
      mockPrisma.userFeedback.findMany.mockResolvedValue([
        {
          id: 'fb-1',
          title: 'Bug 1',
          category: 'BUG',
          status: 'APERTA',
          pageContext: null,
          user: { username: 'user1', email: 'user1@test.it' },
          league: null,
          _count: { responses: 0 },
          githubIssueId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          resolvedAt: null
        }
      ])
      mockPrisma.userFeedback.count.mockResolvedValue(1)

      const result = await feedbackService.getAllFeedback('admin-1')

      expect(result.success).toBe(true)
      const data = result.data as { feedback: unknown[]; pagination: { total: number } }
      expect(data.feedback).toHaveLength(1)
      expect(data.pagination.total).toBe(1)
    })
  })

  // ==================== updateFeedbackStatus ====================

  describe('updateFeedbackStatus', () => {
    it('returns error when user is not superadmin', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuperAdmin: false })

      const result = await feedbackService.updateFeedbackStatus('fb-1', 'user-1', 'IN_LAVORAZIONE' as never)

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non autorizzato')
    })

    it('returns error when feedback not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuperAdmin: true, username: 'admin' })
      mockPrisma.userFeedback.findUnique.mockResolvedValue(null)

      const result = await feedbackService.updateFeedbackStatus('fb-999', 'admin-1', 'IN_LAVORAZIONE' as never)

      expect(result.success).toBe(false)
      expect(result.message).toBe('Segnalazione non trovata')
    })

    it('returns error when status is already the same', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuperAdmin: true, username: 'admin' })
      mockPrisma.userFeedback.findUnique.mockResolvedValue({
        id: 'fb-1',
        userId: 'user-1',
        status: 'APERTA'
      })

      const result = await feedbackService.updateFeedbackStatus('fb-1', 'admin-1', 'APERTA' as never)

      expect(result.success).toBe(false)
      expect(result.message).toContain('gia')
    })

    it('updates status successfully', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuperAdmin: true, username: 'admin' })
      mockPrisma.userFeedback.findUnique.mockResolvedValue({
        id: 'fb-1',
        userId: 'user-1',
        status: 'APERTA'
      })
      mockPrisma.userFeedback.update.mockResolvedValue({
        id: 'fb-1',
        status: 'IN_LAVORAZIONE',
        resolvedAt: null
      })
      mockPrisma.feedbackNotification.upsert.mockResolvedValue({})

      const result = await feedbackService.updateFeedbackStatus('fb-1', 'admin-1', 'IN_LAVORAZIONE' as never)

      expect(result.success).toBe(true)
      expect(result.message).toContain('IN_LAVORAZIONE')
    })
  })

  // ==================== addResponse ====================

  describe('addResponse', () => {
    it('returns error when user is not superadmin', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuperAdmin: false })

      const result = await feedbackService.addResponse('fb-1', 'user-1', 'Some reply')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non autorizzato')
    })

    it('returns error when content is empty', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuperAdmin: true, username: 'admin' })

      const result = await feedbackService.addResponse('fb-1', 'admin-1', '')

      expect(result.success).toBe(false)
      expect(result.message).toBe("Il contenuto della risposta e' obbligatorio")
    })

    it('returns error when content exceeds 5000 characters', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuperAdmin: true, username: 'admin' })

      const result = await feedbackService.addResponse('fb-1', 'admin-1', 'A'.repeat(5001))

      expect(result.success).toBe(false)
      expect(result.message).toBe("La risposta non puo' superare i 5000 caratteri")
    })

    it('returns error when feedback not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuperAdmin: true, username: 'admin' })
      mockPrisma.userFeedback.findUnique.mockResolvedValue(null)

      const result = await feedbackService.addResponse('fb-999', 'admin-1', 'Reply text')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Segnalazione non trovata')
    })

    it('adds response successfully', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuperAdmin: true, username: 'admin' })
      mockPrisma.userFeedback.findUnique.mockResolvedValue({
        id: 'fb-1',
        userId: 'user-1',
        status: 'APERTA',
        resolvedAt: null
      })
      const responseObj = {
        id: 'resp-1',
        content: 'We are fixing it',
        statusChange: null,
        admin: { username: 'admin' },
        createdAt: new Date()
      }
      mockPrisma.$transaction.mockResolvedValue([responseObj])
      mockPrisma.feedbackNotification.upsert.mockResolvedValue({})

      const result = await feedbackService.addResponse('fb-1', 'admin-1', 'We are fixing it')

      expect(result.success).toBe(true)
      expect(result.message).toBe('Risposta aggiunta')
      expect((result.data as { content: string }).content).toBe('We are fixing it')
    })
  })

  // ==================== getUnreadNotifications ====================

  describe('getUnreadNotifications', () => {
    it('returns unread notifications for user', async () => {
      mockPrisma.feedbackNotification.findMany.mockResolvedValue([
        {
          id: 'notif-1',
          type: 'STATUS_CHANGE',
          feedback: {
            id: 'fb-1',
            title: 'My Bug',
            status: 'IN_LAVORAZIONE'
          },
          createdAt: new Date()
        }
      ])

      const result = await feedbackService.getUnreadNotifications('user-1')

      expect(result.success).toBe(true)
      const data = result.data as { count: number; notifications: unknown[] }
      expect(data.count).toBe(1)
      expect(data.notifications).toHaveLength(1)
    })
  })

  // ==================== markNotificationRead ====================

  describe('markNotificationRead', () => {
    it('returns error when notification not found', async () => {
      mockPrisma.feedbackNotification.findUnique.mockResolvedValue(null)

      const result = await feedbackService.markNotificationRead('notif-999', 'user-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Notifica non trovata')
    })

    it('returns error when user is not the notification owner', async () => {
      mockPrisma.feedbackNotification.findUnique.mockResolvedValue({
        id: 'notif-1',
        userId: 'other-user',
        isRead: false
      })

      const result = await feedbackService.markNotificationRead('notif-1', 'user-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non autorizzato')
    })

    it('returns success when notification is already read', async () => {
      mockPrisma.feedbackNotification.findUnique.mockResolvedValue({
        id: 'notif-1',
        userId: 'user-1',
        isRead: true
      })

      const result = await feedbackService.markNotificationRead('notif-1', 'user-1')

      expect(result.success).toBe(true)
      expect(result.message).toBe("Notifica gia' letta")
    })

    it('marks notification as read successfully', async () => {
      mockPrisma.feedbackNotification.findUnique.mockResolvedValue({
        id: 'notif-1',
        userId: 'user-1',
        isRead: false
      })
      mockPrisma.feedbackNotification.update.mockResolvedValue({})

      const result = await feedbackService.markNotificationRead('notif-1', 'user-1')

      expect(result.success).toBe(true)
      expect(result.message).toBe('Notifica segnata come letta')
    })
  })

  // ==================== markAllNotificationsRead ====================

  describe('markAllNotificationsRead', () => {
    it('marks all unread notifications as read', async () => {
      mockPrisma.feedbackNotification.updateMany.mockResolvedValue({ count: 3 })

      const result = await feedbackService.markAllNotificationsRead('user-1')

      expect(result.success).toBe(true)
      expect(result.message).toBe('3 notifiche segnate come lette')
      expect((result.data as { count: number }).count).toBe(3)
    })
  })

  // ==================== getFeedbackStats ====================

  describe('getFeedbackStats', () => {
    it('returns error when user is not superadmin', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuperAdmin: false })

      const result = await feedbackService.getFeedbackStats('user-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non autorizzato')
    })

    it('returns stats for superadmin', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuperAdmin: true })
      mockPrisma.userFeedback.count.mockResolvedValue(10)
      mockPrisma.userFeedback.groupBy
        .mockResolvedValueOnce([
          { status: 'APERTA', _count: { id: 5 } },
          { status: 'RISOLTA', _count: { id: 3 } }
        ])
        .mockResolvedValueOnce([
          { category: 'BUG', _count: { id: 7 } },
          { category: 'FEATURE', _count: { id: 3 } }
        ])

      const result = await feedbackService.getFeedbackStats('admin-1')

      expect(result.success).toBe(true)
      const data = result.data as { total: number; byStatus: Record<string, number>; byCategory: Record<string, number> }
      expect(data.total).toBe(10)
      expect(data.byStatus.APERTA).toBe(5)
      expect(data.byStatus.RISOLTA).toBe(3)
      expect(data.byCategory.BUG).toBe(7)
    })
  })
})
