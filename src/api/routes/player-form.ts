import { Router } from 'express'
import type { Request, Response } from 'express'
import { authMiddleware } from '../middleware/auth'
import { cacheControl } from '../middleware/cache'
import {
  getPlayerFormHistory,
  getPlayerFormSummary,
  getPlayersFormBatch,
} from '../../services/player-form.service'

const router = Router()

/**
 * GET /api/players/:playerId/form
 * Ottiene il riepilogo form di un giocatore (ultime 5 partite)
 */
router.get(
  '/:playerId/form',
  authMiddleware,
  cacheControl(300), // Cache 5 minuti
  async (req: Request, res: Response) => {
    try {
      const { playerId } = req.params

      const result = await getPlayerFormSummary(playerId)

      if (!result.success) {
        res.status(404).json(result)
        return
      }

      res.json(result)
    } catch (error) {
      console.error('Error getting player form:', error)
      res.status(500).json({ success: false, message: 'Errore interno del server' })
    }
  }
)

/**
 * GET /api/players/:playerId/form/history
 * Ottiene lo storico completo delle partite di un giocatore
 */
router.get(
  '/:playerId/form/history',
  authMiddleware,
  cacheControl(300), // Cache 5 minuti
  async (req: Request, res: Response) => {
    try {
      const { playerId } = req.params
      const limit = parseInt(req.query.limit as string) || 10

      const result = await getPlayerFormHistory(playerId, limit)

      if (!result.success) {
        res.status(404).json(result)
        return
      }

      res.json(result)
    } catch (error) {
      console.error('Error getting player form history:', error)
      res.status(500).json({ success: false, message: 'Errore interno del server' })
    }
  }
)

/**
 * POST /api/players/form/batch
 * Ottiene il form summary per più giocatori in batch
 * Body: { playerIds: string[] }
 */
router.post(
  '/form/batch',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { playerIds } = req.body as { playerIds?: string[] }

      if (!playerIds || !Array.isArray(playerIds)) {
        res.status(400).json({ success: false, message: 'playerIds array richiesto' })
        return
      }

      if (playerIds.length > 100) {
        res.status(400).json({ success: false, message: 'Massimo 100 giocatori per richiesta' })
        return
      }

      const result = await getPlayersFormBatch(playerIds)

      if (!result.success) {
        res.status(500).json(result)
        return
      }

      res.json(result)
    } catch (error) {
      console.error('Error getting players form batch:', error)
      res.status(500).json({ success: false, message: 'Errore interno del server' })
    }
  }
)

export default router
