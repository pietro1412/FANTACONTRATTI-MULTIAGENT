/**
 * feedback.service.test.ts - Unit Tests for Feedback Service
 *
 * Tests for the user feedback/segnalazioni service functions.
 *
 * Creato il: 30/01/2026
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoist mock before imports
const { mockPrisma, MockPrismaClient } = vi.hoisted(() => {
  const mock = {
    user: {
      findUnique: vi.fn()
    },
    leagueMember: {
      findFirst: vi.fn()
    },
    userFeedback: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn()
    },
    feedbackResponse: {
      create: vi.fn()
    },
    feedbackNotification: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn()
    },
    $transaction: vi.fn()
  }

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
    RISOLTA: 'RISOLTA'
  },
  FeedbackCategory: {
    BUG: 'BUG',
    SUGGERIMENTO: 'SUGGERIMENTO',
    DOMANDA: 'DOMANDA',
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
        description: 'Test description'
      })

      expect(result.success).toBe(false)
      expect(result.message).toBe("Il titolo e' obbligatorio")
    })

    it('returns error when title is only whitespace', async () => {
      const result = await feedbackService.submitFeedback('user-1', {
        title: '   ',
        description: 'Test description'
      })

      expect(result.success).toBe(false)
      expect(result.message).toBe("Il titolo e' obbligatorio")
    })

    it('returns error when description is empty', async () => {
      const result = await feedbackService.submitFeedback('user-1', {
        title: 'Test title',
        description: ''
      })

      expect(result.success).toBe(false)
      expect(result.message).toBe("La descrizione e' obbligatoria")
    })

    it('returns error when title exceeds 200 chars', async () => {
      const result = await feedbackService.submitFeedback('user-1', {
        title: 'a'.repeat(201),
        description: 'Test description'
      })

      expect(result.success).toBe(false)
      expect(result.message).toBe("Il titolo non puo' superare i 200 caratteri")
    })

    it('returns error when description exceeds 5000 chars', async () => {
      const result = await feedbackService.submitFeedback('user-1', {
        title: 'Test title',
        description: 'a'.repeat(5001)
      })

      expect(result.success).toBe(false)
      expect(result.message).toBe("La descrizione non puo' superare i 5000 caratteri")
    })

    it('returns error when leagueId provided but user not member', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue(null)

      const result = await feedbackService.submitFeedback('user-1', {
        title: 'Test title',
        description: 'Test description',
        leagueId: 'league-1'
      })

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non sei membro di questa lega')
    })

    it('creates feedback successfully without league', async () => {
      mockPrisma.userFeedback.create.mockResolvedValue({
        id: 'feedback-1',
        title: 'Test title',
        category: 'BUG',
        status: 'APERTA',
        createdAt: new Date(),
        user: { username: 'testuser' },
        league: null
      })

      const result = await feedbackService.submitFeedback('user-1', {
        title: 'Test title',
        description: 'Test description'
      })

      expect(result.success).toBe(true)
      expect(result.message).toBe('Segnalazione inviata con successo')
      expect(result.data).toHaveProperty('id', 'feedback-1')
    })

    it('creates feedback successfully with league', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'member-1' })
      mockPrisma.userFeedback.create.mockResolvedValue({
        id: 'feedback-1',
        title: 'Test title',
        category: 'BUG',
        status: 'APERTA',
        createdAt: new Date(),
        user: { username: 'testuser' },
        league: { name: 'Test League' }
      })

      const result = await feedbackService.submitFeedback('user-1', {
        title: 'Test title',
        description: 'Test description',
        leagueId: 'league-1'
      })

      expect(result.success).toBe(true)
      expect(mockPrisma.leagueMember.findFirst).toHaveBeenCalled()
    })

    it('creates feedback with custom category', async () => {
      mockPrisma.userFeedback.create.mockResolvedValue({
        id: 'feedback-1',
        title: 'Test title',
        category: 'SUGGERIMENTO',
        status: 'APERTA',
        createdAt: new Date(),
        user: { username: 'testuser' },
        league: null
      })

      const result = await feedbackService.submitFeedback('user-1', {
        title: 'Test title',
        description: 'Test description',
        category: 'SUGGERIMENTO' as any
      })

      expect(result.success).toBe(true)
    })
  })

  // ==================== getFeedbackForManager ====================
  describe('getFeedbackForManager', () => {
    it('returns paginated feedback for user', async () => {
      mockPrisma.userFeedback.findMany.mockResolvedValue([
        {
          id: 'feedback-1',
          title: 'Test',
          category: 'BUG',
          status: 'APERTA',
          createdAt: new Date(),
          updatedAt: new Date(),
          resolvedAt: null,
          league: { name: 'Test League' },
          _count: { responses: 2 }
        }
      ])
      mockPrisma.userFeedback.count.mockResolvedValue(1)

      const result = await feedbackService.getFeedbackForManager('user-1')

      expect(result.success).toBe(true)
      expect(result.data).toHaveProperty('feedback')
      expect(result.data).toHaveProperty('pagination')
      expect((result.data as any).pagination.page).toBe(1)
    })

    it('filters by status', async () => {
      mockPrisma.userFeedback.findMany.mockResolvedValue([])
      mockPrisma.userFeedback.count.mockResolvedValue(0)

      await feedbackService.getFeedbackForManager('user-1', { status: 'RISOLTA' as any })

      expect(mockPrisma.userFeedback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'RISOLTA' })
        })
      )
    })

    it('supports pagination', async () => {
      mockPrisma.userFeedback.findMany.mockResolvedValue([])
      mockPrisma.userFeedback.count.mockResolvedValue(50)

      const result = await feedbackService.getFeedbackForManager('user-1', { page: 2, limit: 10 })

      expect(result.success).toBe(true)
      expect((result.data as any).pagination.page).toBe(2)
      expect((result.data as any).pagination.totalPages).toBe(5)
    })
  })

  // ==================== getFeedbackById ====================
  describe('getFeedbackById', () => {
    it('returns error when feedback not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuperAdmin: false })
      mockPrisma.userFeedback.findUnique.mockResolvedValue(null)

      const result = await feedbackService.getFeedbackById('feedback-1', 'user-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Segnalazione non trovata')
    })

    it('returns error when user not authorized', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuperAdmin: false })
      mockPrisma.userFeedback.findUnique.mockResolvedValue({
        id: 'feedback-1',
        userId: 'other-user',
        user: { id: 'other-user', username: 'other' },
        league: null,
        responses: []
      })

      const result = await feedbackService.getFeedbackById('feedback-1', 'user-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non autorizzato')
    })

    it('returns feedback for owner', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuperAdmin: false })
      mockPrisma.userFeedback.findUnique.mockResolvedValue({
        id: 'feedback-1',
        userId: 'user-1',
        title: 'Test',
        description: 'Test desc',
        category: 'BUG',
        status: 'APERTA',
        pageContext: null,
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

      const result = await feedbackService.getFeedbackById('feedback-1', 'user-1')

      expect(result.success).toBe(true)
      expect((result.data as any).id).toBe('feedback-1')
    })

    it('returns feedback for superadmin', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuperAdmin: true })
      mockPrisma.userFeedback.findUnique.mockResolvedValue({
        id: 'feedback-1',
        userId: 'other-user',
        title: 'Test',
        description: 'Test desc',
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
      mockPrisma.feedbackNotification.updateMany.mockResolvedValue({ count: 0 })

      const result = await feedbackService.getFeedbackById('feedback-1', 'admin-1')

      expect(result.success).toBe(true)
    })
  })

  // ==================== getAllFeedback ====================
  describe('getAllFeedback', () => {
    it('returns error when not superadmin', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuperAdmin: false })

      const result = await feedbackService.getAllFeedback('user-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non autorizzato')
    })

    it('returns all feedback for superadmin', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuperAdmin: true })
      mockPrisma.userFeedback.findMany.mockResolvedValue([
        {
          id: 'feedback-1',
          title: 'Test',
          category: 'BUG',
          status: 'APERTA',
          pageContext: '/test',
          githubIssueId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          resolvedAt: null,
          user: { username: 'user1', email: 'user1@test.com' },
          league: { name: 'League 1' },
          _count: { responses: 1 }
        }
      ])
      mockPrisma.userFeedback.count.mockResolvedValue(1)

      const result = await feedbackService.getAllFeedback('admin-1')

      expect(result.success).toBe(true)
      expect((result.data as any).feedback).toHaveLength(1)
    })

    it('supports search filter', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuperAdmin: true })
      mockPrisma.userFeedback.findMany.mockResolvedValue([])
      mockPrisma.userFeedback.count.mockResolvedValue(0)

      await feedbackService.getAllFeedback('admin-1', { search: 'bug' })

      expect(mockPrisma.userFeedback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ title: { contains: 'bug', mode: 'insensitive' } })
            ])
          })
        })
      )
    })
  })

  // ==================== updateFeedbackStatus ====================
  describe('updateFeedbackStatus', () => {
    it('returns error when not superadmin', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuperAdmin: false })

      const result = await feedbackService.updateFeedbackStatus('feedback-1', 'user-1', 'IN_LAVORAZIONE' as any)

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non autorizzato')
    })

    it('returns error when feedback not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuperAdmin: true, username: 'admin' })
      mockPrisma.userFeedback.findUnique.mockResolvedValue(null)

      const result = await feedbackService.updateFeedbackStatus('feedback-1', 'admin-1', 'IN_LAVORAZIONE' as any)

      expect(result.success).toBe(false)
      expect(result.message).toBe('Segnalazione non trovata')
    })

    it('returns error when status is already the same', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuperAdmin: true, username: 'admin' })
      mockPrisma.userFeedback.findUnique.mockResolvedValue({
        id: 'feedback-1',
        userId: 'user-1',
        status: 'APERTA'
      })

      const result = await feedbackService.updateFeedbackStatus('feedback-1', 'admin-1', 'APERTA' as any)

      expect(result.success).toBe(false)
      expect(result.message).toContain('Lo stato e\' gia\'')
    })

    it('updates status successfully', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuperAdmin: true, username: 'admin' })
      mockPrisma.userFeedback.findUnique.mockResolvedValue({
        id: 'feedback-1',
        userId: 'user-1',
        status: 'APERTA'
      })
      mockPrisma.userFeedback.update.mockResolvedValue({
        id: 'feedback-1',
        status: 'IN_LAVORAZIONE',
        resolvedAt: null
      })
      mockPrisma.feedbackNotification.upsert.mockResolvedValue({})

      const result = await feedbackService.updateFeedbackStatus('feedback-1', 'admin-1', 'IN_LAVORAZIONE' as any)

      expect(result.success).toBe(true)
      expect(result.message).toBe('Stato aggiornato a IN_LAVORAZIONE')
    })

    it('sets resolvedAt when status is RISOLTA', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuperAdmin: true, username: 'admin' })
      mockPrisma.userFeedback.findUnique.mockResolvedValue({
        id: 'feedback-1',
        userId: 'user-1',
        status: 'IN_LAVORAZIONE'
      })
      mockPrisma.userFeedback.update.mockResolvedValue({
        id: 'feedback-1',
        status: 'RISOLTA',
        resolvedAt: new Date()
      })
      mockPrisma.feedbackNotification.upsert.mockResolvedValue({})

      const result = await feedbackService.updateFeedbackStatus('feedback-1', 'admin-1', 'RISOLTA' as any)

      expect(result.success).toBe(true)
      expect(mockPrisma.userFeedback.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'RISOLTA',
            resolvedAt: expect.any(Date)
          })
        })
      )
    })
  })

  // ==================== addResponse ====================
  describe('addResponse', () => {
    it('returns error when not superadmin', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuperAdmin: false })

      const result = await feedbackService.addResponse('feedback-1', 'user-1', 'Test response')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non autorizzato')
    })

    it('returns error when content is empty', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuperAdmin: true, username: 'admin' })

      const result = await feedbackService.addResponse('feedback-1', 'admin-1', '')

      expect(result.success).toBe(false)
      expect(result.message).toBe("Il contenuto della risposta e' obbligatorio")
    })

    it('returns error when content exceeds 5000 chars', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuperAdmin: true, username: 'admin' })

      const result = await feedbackService.addResponse('feedback-1', 'admin-1', 'a'.repeat(5001))

      expect(result.success).toBe(false)
      expect(result.message).toBe("La risposta non puo' superare i 5000 caratteri")
    })

    it('returns error when feedback not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuperAdmin: true, username: 'admin' })
      mockPrisma.userFeedback.findUnique.mockResolvedValue(null)

      const result = await feedbackService.addResponse('feedback-1', 'admin-1', 'Test response')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Segnalazione non trovata')
    })

    it('adds response successfully', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuperAdmin: true, username: 'admin' })
      mockPrisma.userFeedback.findUnique.mockResolvedValue({
        id: 'feedback-1',
        userId: 'user-1',
        resolvedAt: null
      })
      mockPrisma.$transaction.mockResolvedValue([{
        id: 'response-1',
        content: 'Test response',
        statusChange: null,
        createdAt: new Date(),
        admin: { username: 'admin' }
      }])
      mockPrisma.feedbackNotification.upsert.mockResolvedValue({})

      const result = await feedbackService.addResponse('feedback-1', 'admin-1', 'Test response')

      expect(result.success).toBe(true)
      expect(result.message).toBe('Risposta aggiunta')
    })
  })

  // ==================== getUnreadNotifications ====================
  describe('getUnreadNotifications', () => {
    it('returns unread notifications', async () => {
      mockPrisma.feedbackNotification.findMany.mockResolvedValue([
        {
          id: 'notif-1',
          type: 'STATUS_CHANGE',
          createdAt: new Date(),
          feedback: {
            id: 'feedback-1',
            title: 'Test',
            status: 'RISOLTA'
          }
        }
      ])

      const result = await feedbackService.getUnreadNotifications('user-1')

      expect(result.success).toBe(true)
      expect((result.data as any).count).toBe(1)
      expect((result.data as any).notifications).toHaveLength(1)
    })

    it('returns empty when no notifications', async () => {
      mockPrisma.feedbackNotification.findMany.mockResolvedValue([])

      const result = await feedbackService.getUnreadNotifications('user-1')

      expect(result.success).toBe(true)
      expect((result.data as any).count).toBe(0)
    })
  })

  // ==================== markNotificationRead ====================
  describe('markNotificationRead', () => {
    it('returns error when notification not found', async () => {
      mockPrisma.feedbackNotification.findUnique.mockResolvedValue(null)

      const result = await feedbackService.markNotificationRead('notif-1', 'user-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Notifica non trovata')
    })

    it('returns error when user not owner', async () => {
      mockPrisma.feedbackNotification.findUnique.mockResolvedValue({
        id: 'notif-1',
        userId: 'other-user',
        isRead: false
      })

      const result = await feedbackService.markNotificationRead('notif-1', 'user-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non autorizzato')
    })

    it('returns success when already read', async () => {
      mockPrisma.feedbackNotification.findUnique.mockResolvedValue({
        id: 'notif-1',
        userId: 'user-1',
        isRead: true
      })

      const result = await feedbackService.markNotificationRead('notif-1', 'user-1')

      expect(result.success).toBe(true)
      expect(result.message).toBe("Notifica gia' letta")
    })

    it('marks notification as read', async () => {
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
    it('marks all notifications as read', async () => {
      mockPrisma.feedbackNotification.updateMany.mockResolvedValue({ count: 5 })

      const result = await feedbackService.markAllNotificationsRead('user-1')

      expect(result.success).toBe(true)
      expect(result.message).toBe('5 notifiche segnate come lette')
      expect((result.data as any).count).toBe(5)
    })

    it('returns success even when no notifications', async () => {
      mockPrisma.feedbackNotification.updateMany.mockResolvedValue({ count: 0 })

      const result = await feedbackService.markAllNotificationsRead('user-1')

      expect(result.success).toBe(true)
      expect(result.message).toBe('0 notifiche segnate come lette')
    })
  })

  // ==================== getFeedbackStats ====================
  describe('getFeedbackStats', () => {
    it('returns error when not superadmin', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuperAdmin: false })

      const result = await feedbackService.getFeedbackStats('user-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non autorizzato')
    })

    it('returns feedback statistics', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuperAdmin: true })
      mockPrisma.userFeedback.count.mockResolvedValue(10)
      mockPrisma.userFeedback.groupBy
        .mockResolvedValueOnce([
          { status: 'APERTA', _count: { id: 5 } },
          { status: 'IN_LAVORAZIONE', _count: { id: 3 } },
          { status: 'RISOLTA', _count: { id: 2 } }
        ])
        .mockResolvedValueOnce([
          { category: 'BUG', _count: { id: 7 } },
          { category: 'SUGGERIMENTO', _count: { id: 3 } }
        ])

      const result = await feedbackService.getFeedbackStats('admin-1')

      expect(result.success).toBe(true)
      expect((result.data as any).total).toBe(10)
      expect((result.data as any).byStatus).toBeDefined()
      expect((result.data as any).byCategory).toBeDefined()
    })
  })
})
