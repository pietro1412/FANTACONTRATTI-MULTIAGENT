/**
 * Seasonality API Routes
 * Endpoints for player seasonality data
 */

import { Router } from 'express'
import { authMiddleware, superAdminMiddleware } from '../middleware/auth'
import {
  syncSeasonRatings,
  calculateSeasonalStats,
  refreshSeasonalityCache,
  getPlayerSeasonality,
  getCurrentMonth,
} from '../../services/seasonality.service'

const router = Router()

/**
 * GET /api/seasonality/player/:id
 * Get seasonal stats for a player
 */
router.get('/player/:id', authMiddleware, async (req, res) => {
  try {
    const stats = await getPlayerSeasonality(req.params.id)
    if (!stats) {
      return res.status(404).json({
        success: false,
        message: 'Giocatore non trovato',
      })
    }
    res.json({
      success: true,
      data: {
        ...stats,
        currentMonth: getCurrentMonth(),
      },
    })
  } catch (error) {
    console.error('Error fetching seasonality:', error)
    res.status(500).json({
      success: false,
      message: 'Errore nel calcolo della stagionalità',
    })
  }
})

/**
 * POST /api/seasonality/sync
 * Sync ratings from API-Football (superadmin only)
 */
router.post('/sync', authMiddleware, superAdminMiddleware, async (req, res) => {
  try {
    const season = req.body.season || 2024
    const result = await syncSeasonRatings(season)
    res.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('Error syncing seasonality:', error)
    res.status(500).json({
      success: false,
      message: 'Errore nel sync della stagionalità',
    })
  }
})

/**
 * POST /api/seasonality/refresh-cache
 * Refresh all player caches (superadmin only)
 */
router.post('/refresh-cache', authMiddleware, superAdminMiddleware, async (req, res) => {
  try {
    const updated = await refreshSeasonalityCache()
    res.json({
      success: true,
      data: { playersUpdated: updated },
    })
  } catch (error) {
    console.error('Error refreshing cache:', error)
    res.status(500).json({
      success: false,
      message: 'Errore nel refresh della cache',
    })
  }
})

/**
 * GET /api/seasonality/current-month
 * Get current month name (for UI highlighting)
 */
router.get('/current-month', async (_req, res) => {
  res.json({
    success: true,
    data: { month: getCurrentMonth() },
  })
})

export default router
