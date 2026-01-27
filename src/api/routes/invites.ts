import { Router } from 'express'
import type { Request, Response } from 'express'
import {
  createEmailInvite,
  acceptInvite,
  getPendingInvites,
  cancelInvite,
  getInviteInfo,
  getInviteInfoDetailed,
  rejectInvite,
} from '../../services/invite.service'
import { authMiddleware } from '../middleware/auth'

const router = Router()

// ==================== INVITI EMAIL ====================

// POST /api/leagues/:leagueId/invites - Crea invito email (Admin)
router.post('/leagues/:leagueId/invites', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const { email, expiresInDays } = req.body as { email: string; expiresInDays?: number }

    if (!email) {
      res.status(400).json({ success: false, message: 'Email richiesta' })
      return
    }

    const result = await createEmailInvite(leagueId, req.user!.userId, email, expiresInDays)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.status(201).json(result)
  } catch (error) {
    console.error('Create invite error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// GET /api/leagues/:leagueId/invites - Ottieni inviti pendenti (Admin)
router.get('/leagues/:leagueId/invites', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await getPendingInvites(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get invites error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// DELETE /api/invites/:inviteId - Annulla invito (Admin)
router.delete('/invites/:inviteId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const inviteId = req.params.inviteId as string
    const result = await cancelInvite(inviteId, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Cancel invite error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// GET /api/invites/:token - Ottieni info invito (pubblico, serve solo il token)
router.get('/invites/:token', async (req: Request, res: Response) => {
  try {
    const token = req.params.token as string
    const result = await getInviteInfo(token)

    if (!result.success) {
      res.status(404).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get invite info error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// GET /api/invites/:token/details - Ottieni info dettagliate invito (richiede auth)
router.get('/invites/:token/details', authMiddleware, async (req: Request, res: Response) => {
  try {
    const token = req.params.token as string
    const result = await getInviteInfoDetailed(token)

    if (!result.success) {
      res.status(404).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get invite details error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/invites/:token/accept - Accetta invito
router.post('/invites/:token/accept', authMiddleware, async (req: Request, res: Response) => {
  try {
    const token = req.params.token as string
    const { teamName } = req.body as { teamName?: string }

    if (!teamName || teamName.trim().length < 2) {
      res.status(400).json({ success: false, message: 'Il nome squadra deve avere almeno 2 caratteri' })
      return
    }

    const result = await acceptInvite(token, req.user!.userId, teamName.trim())

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Accept invite error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/invites/:token/reject - Rifiuta invito
router.post('/invites/:token/reject', authMiddleware, async (req: Request, res: Response) => {
  try {
    const token = req.params.token as string
    const result = await rejectInvite(token, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Reject invite error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

export default router
