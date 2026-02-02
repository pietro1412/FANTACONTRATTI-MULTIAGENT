import { Router } from 'express'
import type { Request, Response } from 'express'
import {
  getAlertsForMember,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from '../../services/alerts.service'
import { authMiddleware } from '../middleware/auth'
import { PrismaClient } from '@prisma/client'

const router = Router()
const prisma = new PrismaClient()

// Helper to get member ID from user and league
async function getMemberId(userId: string, leagueId: string): Promise<string | null> {
  const member = await prisma.leagueMember.findFirst({
    where: {
      userId,
      leagueId,
      status: 'ACTIVE',
    },
    select: { id: true },
  })
  return member?.id || null
}

// GET /api/leagues/:id/alerts - Get alerts for watched players
router.get('/leagues/:id/alerts', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.id
    const memberId = await getMemberId(req.user!.userId, leagueId)

    if (!memberId) {
      res.status(403).json({ success: false, message: 'Non sei membro di questa lega' })
      return
    }

    const unreadOnly = req.query.unreadOnly === 'true'
    const limit = parseInt(req.query.limit as string) || 50
    const offset = parseInt(req.query.offset as string) || 0

    const result = await getAlertsForMember(memberId, {
      unreadOnly,
      limit,
      offset,
    })

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get alerts error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// GET /api/leagues/:id/alerts/unread-count - Get unread alert count
router.get('/leagues/:id/alerts/unread-count', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.id
    const memberId = await getMemberId(req.user!.userId, leagueId)

    if (!memberId) {
      res.status(403).json({ success: false, message: 'Non sei membro di questa lega' })
      return
    }

    const result = await getUnreadCount(memberId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get unread count error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// PUT /api/leagues/:id/alerts/:alertId/read - Mark alert as read
router.put('/leagues/:id/alerts/:alertId/read', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.id
    const notificationId = req.params.alertId // This is actually the notification ID
    const memberId = await getMemberId(req.user!.userId, leagueId)

    if (!memberId) {
      res.status(403).json({ success: false, message: 'Non sei membro di questa lega' })
      return
    }

    const result = await markAsRead(notificationId, memberId)

    if (!result.success) {
      const status = result.message?.includes('non trovata') ? 404 : 400
      res.status(status).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Mark alert as read error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// PUT /api/leagues/:id/alerts/read-all - Mark all alerts as read
router.put('/leagues/:id/alerts/read-all', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.id
    const memberId = await getMemberId(req.user!.userId, leagueId)

    if (!memberId) {
      res.status(403).json({ success: false, message: 'Non sei membro di questa lega' })
      return
    }

    const result = await markAllAsRead(memberId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Mark all alerts as read error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

export default router
