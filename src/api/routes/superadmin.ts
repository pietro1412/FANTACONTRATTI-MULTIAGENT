import { Router } from 'express'
import type { Request, Response } from 'express'
import multer from 'multer'
import {
  importQuotazioni,
  getSuperAdminStatus,
  setSuperAdmin,
  getPlayersStats,
  getPlayersList,
  getAllLeagues,
  getAllUsers,
  getMemberRoster,
  getUploadHistory,
  deleteAllPlayers,
} from '../../services/superadmin.service'
import { authMiddleware } from '../middleware/auth'

const router = Router()

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (_req, file, cb) => {
    // Accept only xlsx files
    if (
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.originalname.endsWith('.xlsx')
    ) {
      cb(null, true)
    } else {
      cb(new Error('Solo file .xlsx sono accettati'))
    }
  },
})

// ==================== GET SUPERADMIN STATUS ====================

// GET /api/superadmin/status - Check if current user is superadmin
router.get('/superadmin/status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await getSuperAdminStatus(req.user!.userId)
    res.json(result)
  } catch (error) {
    console.error('Get superadmin status error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// ==================== IMPORT QUOTAZIONI ====================

// POST /api/superadmin/quotazioni/import - Upload and import quotazioni file
router.post(
  '/superadmin/quotazioni/import',
  authMiddleware,
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, message: 'Nessun file caricato' })
        return
      }

      const sheetName = (req.body.sheetName as string) || 'Tutti'
      const fileName = req.file.originalname || 'quotazioni.xlsx'
      const result = await importQuotazioni(req.user!.userId, req.file.buffer, sheetName, fileName)

      if (!result.success) {
        res.status(result.message?.includes('Non autorizzato') ? 403 : 400).json(result)
        return
      }

      res.json(result)
    } catch (error) {
      console.error('Import quotazioni error:', error)
      res.status(500).json({ success: false, message: 'Errore interno del server' })
    }
  }
)

// ==================== UPLOAD HISTORY ====================

// GET /api/superadmin/quotazioni/history - Get upload history
router.get('/superadmin/quotazioni/history', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await getUploadHistory(req.user!.userId)

    if (!result.success) {
      res.status(403).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get upload history error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// ==================== PLAYERS STATS ====================

// GET /api/superadmin/players/stats - Get players statistics
router.get('/superadmin/players/stats', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await getPlayersStats(req.user!.userId)

    if (!result.success) {
      res.status(403).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get players stats error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// GET /api/superadmin/players - Get players list with filters
router.get('/superadmin/players', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { position, listStatus, search, team, page, limit } = req.query
    const result = await getPlayersList(req.user!.userId, {
      position: position as string | undefined,
      listStatus: listStatus as string | undefined,
      search: search as string | undefined,
      team: team as string | undefined,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    })

    if (!result.success) {
      res.status(403).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get players list error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// ==================== GET ALL LEAGUES ====================

// GET /api/superadmin/leagues - Get all leagues with members (supports search)
router.get('/superadmin/leagues', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { search } = req.query
    const result = await getAllLeagues(req.user!.userId, search as string | undefined)

    if (!result.success) {
      res.status(403).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get all leagues error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// ==================== GET MEMBER ROSTER ====================

// GET /api/superadmin/roster/:memberId - Get roster for a specific member
router.get('/superadmin/roster/:memberId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const memberId = req.params.memberId as string
    if (!memberId) {
      res.status(400).json({ success: false, message: 'memberId mancante' })
      return
    }
    const result = await getMemberRoster(req.user!.userId, memberId)

    if (!result.success) {
      res.status(result.message === 'Membro non trovato' ? 404 : 403).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get member roster error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// ==================== GET ALL USERS ====================

// GET /api/superadmin/users - Get all users
router.get('/superadmin/users', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await getAllUsers(req.user!.userId)

    if (!result.success) {
      res.status(403).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get all users error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// ==================== SET SUPERADMIN ====================

// POST /api/superadmin/grant - Grant or revoke superadmin privileges
router.post('/superadmin/grant', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { targetUserId, isSuperAdmin } = req.body as { targetUserId: string; isSuperAdmin: boolean }

    if (!targetUserId || typeof isSuperAdmin !== 'boolean') {
      res.status(400).json({ success: false, message: 'Parametri mancanti' })
      return
    }

    const result = await setSuperAdmin(req.user!.userId, targetUserId, isSuperAdmin)

    if (!result.success) {
      res.status(403).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Set superadmin error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// ==================== DELETE ALL PLAYERS ====================

// DELETE /api/superadmin/players - Delete all players
router.delete('/superadmin/players', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await deleteAllPlayers(req.user!.userId)

    if (!result.success) {
      res.status(403).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Delete all players error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

export default router
