import { Router } from 'express'
import type { Request, Response } from 'express'
import { authMiddleware } from '../middleware/auth'
import {
  getVapidPublicKey,
  subscribe,
  unsubscribe,
  getPreferences,
  updatePreferences,
} from '../../services/notification.service'

const router = Router()

// GET /api/push/vapid-key - public, no auth required
router.get('/vapid-key', (_req: Request, res: Response) => {
  const key = getVapidPublicKey()
  if (!key) {
    res.status(503).json({ success: false, message: 'Push notifications non configurate' })
    return
  }
  res.json({ success: true, data: { publicKey: key } })
})

// POST /api/push/subscribe - save push subscription
router.post('/subscribe', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId
    const { subscription } = req.body

    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      res.status(400).json({ success: false, message: 'Subscription non valida' })
      return
    }

    await subscribe(userId, subscription)
    res.json({ success: true, message: 'Subscription salvata' })
  } catch (err) {
    console.error('Push subscribe error:', err)
    res.status(500).json({ success: false, message: 'Errore nel salvataggio della subscription' })
  }
})

// DELETE /api/push/unsubscribe - remove push subscription
router.delete('/unsubscribe', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId
    const { endpoint } = req.body

    if (!endpoint) {
      res.status(400).json({ success: false, message: 'Endpoint obbligatorio' })
      return
    }

    await unsubscribe(userId, endpoint)
    res.json({ success: true, message: 'Subscription rimossa' })
  } catch (err) {
    console.error('Push unsubscribe error:', err)
    res.status(500).json({ success: false, message: 'Errore nella rimozione della subscription' })
  }
})

// GET /api/push/preferences - get notification preferences
router.get('/preferences', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId
    const prefs = await getPreferences(userId)
    res.json({ success: true, data: prefs })
  } catch (err) {
    console.error('Get preferences error:', err)
    res.status(500).json({ success: false, message: 'Errore nel caricamento delle preferenze' })
  }
})

// PUT /api/push/preferences - update notification preferences
router.put('/preferences', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId
    const { tradeOffers, contractExpiry, auctionStart, phaseChange } = req.body

    const prefs = await updatePreferences(userId, {
      tradeOffers,
      contractExpiry,
      auctionStart,
      phaseChange,
    })
    res.json({ success: true, data: prefs })
  } catch (err) {
    console.error('Update preferences error:', err)
    res.status(500).json({ success: false, message: 'Errore nell\'aggiornamento delle preferenze' })
  }
})

export default router
