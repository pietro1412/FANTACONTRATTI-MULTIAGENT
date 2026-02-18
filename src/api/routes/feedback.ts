import { Router } from 'express'
import type { Request, Response } from 'express'
import type { FeedbackCategory } from '@prisma/client';
import { FeedbackStatus } from '@prisma/client'
import {
  submitFeedback,
  getFeedbackForManager,
  getFeedbackById,
  getAllFeedback,
  updateFeedbackStatus,
  addResponse,
  getUnreadNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getFeedbackStats,
} from '../../services/feedback.service'
import { authMiddleware } from '../middleware/auth'

const router = Router()

// ==================== MANAGER ENDPOINTS ====================

// POST /api/feedback - Submit new feedback
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { title, description, category, leagueId, pageContext } = req.body as {
      title: string
      description: string
      category?: FeedbackCategory
      leagueId?: string
      pageContext?: string
    }

    const result = await submitFeedback(req.user!.userId, {
      title,
      description,
      category,
      leagueId,
      pageContext,
    })

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.status(201).json(result)
  } catch (error) {
    console.error('Submit feedback error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// GET /api/feedback - Get user's feedback list
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { status, page, limit } = req.query as {
      status?: FeedbackStatus
      page?: string
      limit?: string
    }

    const result = await getFeedbackForManager(req.user!.userId, {
      status,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    })

    res.json(result)
  } catch (error) {
    console.error('Get feedback error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// GET /api/feedback/all - Get all feedback (superadmin only)
router.get('/all', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { status, category, search, page, limit } = req.query as {
      status?: FeedbackStatus
      category?: FeedbackCategory
      search?: string
      page?: string
      limit?: string
    }

    const result = await getAllFeedback(req.user!.userId, {
      status,
      category,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    })

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get all feedback error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// GET /api/feedback/stats - Get feedback statistics (superadmin only)
router.get('/stats', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await getFeedbackStats(req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get feedback stats error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// GET /api/feedback/:id - Get single feedback detail
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const feedbackId = req.params.id

    const result = await getFeedbackById(feedbackId!, req.user!.userId)

    if (!result.success) {
      const status = result.message === 'Non autorizzato' ? 403 :
                     result.message === 'Segnalazione non trovata' ? 404 : 400
      res.status(status).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get feedback by id error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// ==================== ADMIN ENDPOINTS ====================

// PATCH /api/feedback/:id/status - Update feedback status (superadmin only)
router.patch('/:id/status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const feedbackId = req.params.id
    const { status } = req.body as { status: FeedbackStatus }

    if (!status || !Object.values(FeedbackStatus).includes(status)) {
      res.status(400).json({ success: false, message: 'Stato non valido' })
      return
    }

    const result = await updateFeedbackStatus(feedbackId!, req.user!.userId, status)

    if (!result.success) {
      const statusCode = result.message === 'Non autorizzato' ? 403 :
                         result.message === 'Segnalazione non trovata' ? 404 : 400
      res.status(statusCode).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Update feedback status error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/feedback/:id/response - Add response to feedback (superadmin only)
router.post('/:id/response', authMiddleware, async (req: Request, res: Response) => {
  try {
    const feedbackId = req.params.id
    const { content, statusChange } = req.body as {
      content: string
      statusChange?: FeedbackStatus
    }

    if (!content) {
      res.status(400).json({ success: false, message: 'Il contenuto e\' obbligatorio' })
      return
    }

    if (statusChange && !Object.values(FeedbackStatus).includes(statusChange)) {
      res.status(400).json({ success: false, message: 'Stato non valido' })
      return
    }

    const result = await addResponse(feedbackId!, req.user!.userId, content, statusChange)

    if (!result.success) {
      const statusCode = result.message === 'Non autorizzato' ? 403 :
                         result.message === 'Segnalazione non trovata' ? 404 : 400
      res.status(statusCode).json(result)
      return
    }

    res.status(201).json(result)
  } catch (error) {
    console.error('Add feedback response error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// ==================== NOTIFICATION ENDPOINTS ====================

// GET /api/feedback/notifications - Get unread feedback notifications
router.get('/notifications/unread', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await getUnreadNotifications(req.user!.userId)
    res.json(result)
  } catch (error) {
    console.error('Get unread notifications error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// PATCH /api/feedback/notifications/:id - Mark notification as read
router.patch('/notifications/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const notificationId = req.params.id
    const result = await markNotificationRead(notificationId!, req.user!.userId)

    if (!result.success) {
      const statusCode = result.message === 'Non autorizzato' ? 403 :
                         result.message === 'Notifica non trovata' ? 404 : 400
      res.status(statusCode).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Mark notification read error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// PATCH /api/feedback/notifications/read-all - Mark all notifications as read
router.patch('/notifications/read-all', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await markAllNotificationsRead(req.user!.userId)
    res.json(result)
  } catch (error) {
    console.error('Mark all notifications read error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

export default router
