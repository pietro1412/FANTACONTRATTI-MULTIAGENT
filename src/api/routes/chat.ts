import { Router } from 'express'
import type { Request, Response } from 'express'
import {
  getMessages,
  sendMessage,
  sendRandomBotMessage,
} from '../../services/chat.service'
import { authMiddleware } from '../middleware/auth'

const router = Router()

// GET /api/sessions/:sessionId/chat - Get chat messages
router.get('/sessions/:sessionId/chat', authMiddleware, async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string
    const since = req.query.since as string | undefined
    const result = await getMessages(sessionId, req.user!.userId, since)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get chat messages error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/sessions/:sessionId/chat - Send chat message
router.post('/sessions/:sessionId/chat', authMiddleware, async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string
    const { content } = req.body as { content: string }

    if (!content || content.trim().length === 0) {
      res.status(400).json({ success: false, message: 'Messaggio vuoto' })
      return
    }

    if (content.length > 500) {
      res.status(400).json({ success: false, message: 'Messaggio troppo lungo (max 500 caratteri)' })
      return
    }

    const result = await sendMessage(sessionId, req.user!.userId, content.trim())

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.status(201).json(result)
  } catch (error) {
    console.error('Send chat message error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/sessions/:sessionId/chat/simulate - Simulate random bot message (Admin only)
router.post('/sessions/:sessionId/chat/simulate', authMiddleware, async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string
    const result = await sendRandomBotMessage(sessionId, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.status(201).json(result)
  } catch (error) {
    console.error('Simulate chat message error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

export default router
