/**
 * Chat Module API Routes
 *
 * Provides endpoints for chat operations including:
 * - Getting messages with pagination
 * - Sending messages with immediate Pusher notification
 *
 * Note: Messages are sent immediately via Pusher (not batched)
 * because chat needs low latency for a good user experience.
 */

import { Router } from 'express'
import type { Request, Response } from 'express'
import { authMiddleware } from '@/api/middleware/auth'
import { asyncHandler } from '@/shared/infrastructure/http'
import {
  batchedPusherService,
  getAuctionChannel,
} from '@/shared/infrastructure/realtime'

// Import existing service functions
import {
  getMessages,
  sendMessage,
  sendRandomBotMessage,
} from '@/services/chat.service'

const router = Router()

// ==================== TYPES ====================

interface GetMessagesQuery {
  since?: string
  limit?: string
  offset?: string
}

interface SendMessageBody {
  content: string
}

// Chat event type for Pusher (not batched - immediate delivery)
const CHAT_EVENTS = {
  NEW_MESSAGE: 'chat-message',
}

// ==================== CHAT ENDPOINTS ====================

/**
 * GET /api/sessions/:sessionId/messages
 * Get chat messages for a session with optional pagination
 *
 * Query: { since?: string (ISO date), limit?: number, offset?: number }
 * Response: { success: boolean, data?: { messages }, error?: string }
 */
router.get(
  '/sessions/:sessionId/messages',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params
    const { since } = req.query as GetMessagesQuery
    const userId = req.user!.userId

    const result = await getMessages(sessionId, userId, since)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  })
)

/**
 * POST /api/sessions/:sessionId/messages
 * Send a chat message
 *
 * Messages are sent immediately via Pusher (not batched) for low latency.
 *
 * Body: { content: string }
 * Response: { success: boolean, data?: { message }, error?: string }
 */
router.post(
  '/sessions/:sessionId/messages',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params
    const { content } = req.body as SendMessageBody
    const userId = req.user!.userId

    // Validate content
    if (!content || content.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: 'Messaggio vuoto',
      })
      return
    }

    // Validate message length
    if (content.length > 500) {
      res.status(400).json({
        success: false,
        error: 'Messaggio troppo lungo (max 500 caratteri)',
      })
      return
    }

    const result = await sendMessage(sessionId, userId, content.trim())

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    // Send message immediately via Pusher (no batching for chat - low latency needed)
    // Use sendImmediate instead of queueEvent for instant delivery
    if (batchedPusherService.isReady() && result.data?.message) {
      try {
        await batchedPusherService.sendImmediate(
          getAuctionChannel(sessionId),
          CHAT_EVENTS.NEW_MESSAGE,
          {
            message: result.data.message,
            timestamp: Date.now(),
          }
        )
      } catch (pusherError) {
        // Log error but don't fail the request - message is already saved
        console.error('Failed to send Pusher notification for chat message:', pusherError)
      }
    }

    res.status(201).json(result)
  })
)

/**
 * POST /api/sessions/:sessionId/messages/simulate
 * Send a random bot message (admin only, for testing)
 *
 * Response: { success: boolean, data?: { message }, error?: string }
 */
router.post(
  '/sessions/:sessionId/messages/simulate',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params
    const userId = req.user!.userId

    const result = await sendRandomBotMessage(sessionId, userId)

    if (!result.success) {
      const status = result.message === 'Non autorizzato' ? 403 : 400
      res.status(status).json(result)
      return
    }

    // Send simulated message immediately via Pusher
    if (batchedPusherService.isReady() && result.data?.message) {
      try {
        await batchedPusherService.sendImmediate(
          getAuctionChannel(sessionId),
          CHAT_EVENTS.NEW_MESSAGE,
          {
            message: result.data.message,
            timestamp: Date.now(),
          }
        )
      } catch (pusherError) {
        console.error('Failed to send Pusher notification for simulated message:', pusherError)
      }
    }

    res.status(201).json(result)
  })
)

export default router
