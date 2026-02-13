import { Router } from 'express'
import type { Request, Response } from 'express'

const router = Router()

/**
 * GET /api/cron/sync-api-football
 *
 * Vercel Cron endpoint for API-Football sync.
 * Protected by CRON_SECRET header verification.
 * On Vercel, called automatically via crons config.
 * Locally, can be called manually for testing.
 */
router.get('/cron/sync-api-football', async (req: Request, res: Response) => {
  try {
    // Verify CRON_SECRET in production
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret) {
      const authHeader = req.headers['authorization']
      if (authHeader !== `Bearer ${cronSecret}`) {
        res.status(401).json({ success: false, message: 'Unauthorized' })
        return
      }
    }

    const { syncMatchRatings } = await import('../../services/api-football.service')

    // Vercel has 30s limit, so use conservative maxFixtures
    const isVercel = !!process.env.VERCEL
    const maxFixtures = isVercel ? 3 : 5

    const result = await syncMatchRatings({ maxFixtures })

    res.json({
      success: result.success,
      message: result.message,
      data: result.data,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[CRON] sync-api-football error:', error)
    res.status(500).json({
      success: false,
      message: `Errore cron: ${(error as Error).message}`,
    })
  }
})

export default router
