import { Router } from 'express'
import type { Request, Response } from 'express'
import { createLeagueSchema, updateLeagueSchema } from '../../utils/validation'
import {
  createLeague,
  getLeaguesByUser,
  getLeagueById,
  getLeagueByInviteCode,
  requestJoinLeague,
  getLeagueMembers,
  getPendingJoinRequests,
  updateMemberStatus,
  updateLeague,
  startLeague,
  leaveLeague,
  cancelJoinRequest,
  getAllRosters,
  searchLeagues,
  getLeagueFinancials,
} from '../../services/league.service'
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth'

const router = Router()

// POST /api/leagues - Create league (requires auth)
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const validation = createLeagueSchema.safeParse(req.body)

    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: 'Dati non validi',
        errors: validation.error.issues,
      })
      return
    }

    const result = await createLeague(req.user!.userId, validation.data)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.status(201).json(result)
  } catch (error) {
    console.error('Create league error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// GET /api/leagues - Get user's leagues (requires auth)
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await getLeaguesByUser(req.user!.userId)
    res.json(result)
  } catch (error) {
    console.error('Get leagues error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// GET /api/leagues/join/:code - Get league by invite code (optional auth)
router.get('/join/:code', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const code = req.params.code as string
    const result = await getLeagueByInviteCode(code)

    if (!result.success) {
      res.status(404).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get league by invite error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// GET /api/leagues/search - Search for leagues (requires auth)
router.get('/search', authMiddleware, async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string
    const result = await searchLeagues(req.user!.userId, query)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Search leagues error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// GET /api/leagues/:id - Get league detail (requires auth)
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const result = await getLeagueById(id, req.user!.userId)

    if (!result.success) {
      res.status(404).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get league error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// PUT /api/leagues/:id - Update league (admin only)
router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const validation = updateLeagueSchema.safeParse(req.body)

    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: 'Dati non validi',
        errors: validation.error.issues,
      })
      return
    }

    const result = await updateLeague(id, req.user!.userId, validation.data)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Update league error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/leagues/:id/join - Request to join league
router.post('/:id/join', authMiddleware, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const { teamName } = req.body as { teamName?: string }
    const result = await requestJoinLeague(id, req.user!.userId, teamName)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.status(201).json(result)
  } catch (error) {
    console.error('Join league error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// GET /api/leagues/:id/members - Get league members
router.get('/:id/members', authMiddleware, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const result = await getLeagueMembers(id, req.user!.userId)

    if (!result.success) {
      res.status(404).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get members error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// GET /api/leagues/:id/pending-requests - Get pending join requests (admin only)
router.get('/:id/pending-requests', authMiddleware, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const result = await getPendingJoinRequests(id, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 404).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get pending requests error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// GET /api/leagues/:id/rosters - Get all rosters for the league
router.get('/:id/rosters', authMiddleware, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const result = await getAllRosters(id, req.user!.userId)

    if (!result.success) {
      res.status(403).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get rosters error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// PUT /api/leagues/:id/members/:memberId - Accept/Reject/Kick member
router.put('/:id/members/:memberId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const memberId = req.params.memberId as string
    const { action } = req.body as { action?: string }

    if (!action || !['accept', 'reject', 'kick'].includes(action)) {
      res.status(400).json({ success: false, message: 'Azione non valida' })
      return
    }

    const result = await updateMemberStatus(
      id,
      memberId,
      req.user!.userId,
      action as 'accept' | 'reject' | 'kick'
    )

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Update member error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/leagues/:id/start - Avvia la lega (Admin)
router.post('/:id/start', authMiddleware, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const result = await startLeague(id, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Start league error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/leagues/:id/leave - Lascia la lega
router.post('/:id/leave', authMiddleware, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const result = await leaveLeague(id, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Leave league error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/leagues/:id/cancel-request - Annulla richiesta di partecipazione (#50)
router.post('/:id/cancel-request', authMiddleware, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const result = await cancelJoinRequest(id, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Cancel join request error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// GET /api/leagues/:id/financials - Get financial dashboard data (#190)
router.get('/:id/financials', authMiddleware, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const result = await getLeagueFinancials(id, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Non sei membro di questa lega' ? 403 : 404).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get league financials error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

export default router
