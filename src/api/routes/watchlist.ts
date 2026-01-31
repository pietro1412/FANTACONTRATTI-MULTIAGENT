import { Router } from 'express'
import type { Request, Response } from 'express'
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getEntries,
  addEntry,
  updateEntry,
  removeEntry,
  moveEntry,
  ensureDefaultCategories,
} from '../../services/watchlist.service'
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

// ==================== CATEGORY ENDPOINTS ====================

// GET /api/leagues/:id/watchlist/categories - Get all categories for a league
router.get('/leagues/:id/watchlist/categories', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.id
    const memberId = await getMemberId(req.user!.userId, leagueId)

    if (!memberId) {
      res.status(403).json({ success: false, message: 'Non sei membro di questa lega' })
      return
    }

    // Ensure default categories exist
    await ensureDefaultCategories(leagueId)

    const result = await getCategories(leagueId, memberId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get watchlist categories error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/leagues/:id/watchlist/categories - Create a new category
router.post('/leagues/:id/watchlist/categories', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.id
    const memberId = await getMemberId(req.user!.userId, leagueId)

    if (!memberId) {
      res.status(403).json({ success: false, message: 'Non sei membro di questa lega' })
      return
    }

    const { name, description, icon, color } = req.body as {
      name: string
      description?: string
      icon?: string
      color?: string
    }

    const result = await createCategory(leagueId, memberId, {
      name,
      description,
      icon,
      color,
    })

    if (!result.success) {
      const status = result.message === 'Solo gli admin possono creare categorie' ? 403 : 400
      res.status(status).json(result)
      return
    }

    res.status(201).json(result)
  } catch (error) {
    console.error('Create watchlist category error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// PUT /api/leagues/:id/watchlist/categories/:catId - Update a category
router.put('/leagues/:id/watchlist/categories/:catId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.id
    const categoryId = req.params.catId
    const memberId = await getMemberId(req.user!.userId, leagueId)

    if (!memberId) {
      res.status(403).json({ success: false, message: 'Non sei membro di questa lega' })
      return
    }

    const { name, description, icon, color, sortOrder } = req.body as {
      name?: string
      description?: string
      icon?: string
      color?: string
      sortOrder?: number
    }

    const result = await updateCategory(categoryId, memberId, {
      name,
      description,
      icon,
      color,
      sortOrder,
    })

    if (!result.success) {
      const status = result.message?.includes('non trovata') ? 404 :
                     result.message?.includes('admin') ? 403 : 400
      res.status(status).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Update watchlist category error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// DELETE /api/leagues/:id/watchlist/categories/:catId - Delete a category
router.delete('/leagues/:id/watchlist/categories/:catId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.id
    const categoryId = req.params.catId
    const memberId = await getMemberId(req.user!.userId, leagueId)

    if (!memberId) {
      res.status(403).json({ success: false, message: 'Non sei membro di questa lega' })
      return
    }

    const result = await deleteCategory(categoryId, memberId)

    if (!result.success) {
      const status = result.message?.includes('non trovata') ? 404 :
                     result.message?.includes('admin') ? 403 :
                     result.message?.includes('sistema') ? 400 : 400
      res.status(status).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Delete watchlist category error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// ==================== ENTRY ENDPOINTS ====================

// GET /api/leagues/:id/watchlist/entries - Get all entries for the member
router.get('/leagues/:id/watchlist/entries', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.id
    const memberId = await getMemberId(req.user!.userId, leagueId)

    if (!memberId) {
      res.status(403).json({ success: false, message: 'Non sei membro di questa lega' })
      return
    }

    const result = await getEntries(memberId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get watchlist entries error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// GET /api/leagues/:id/watchlist/entries/:categoryId - Get entries for a specific category
router.get('/leagues/:id/watchlist/entries/:categoryId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.id
    const categoryId = req.params.categoryId
    const memberId = await getMemberId(req.user!.userId, leagueId)

    if (!memberId) {
      res.status(403).json({ success: false, message: 'Non sei membro di questa lega' })
      return
    }

    const result = await getEntries(memberId, categoryId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get watchlist entries by category error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/leagues/:id/watchlist/entries - Add a player to watchlist
router.post('/leagues/:id/watchlist/entries', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.id
    const memberId = await getMemberId(req.user!.userId, leagueId)

    if (!memberId) {
      res.status(403).json({ success: false, message: 'Non sei membro di questa lega' })
      return
    }

    const { categoryId, playerId, maxBid, targetPrice, priority, notes } = req.body as {
      categoryId: string
      playerId: string
      maxBid?: number
      targetPrice?: number
      priority?: number
      notes?: string
    }

    if (!categoryId || !playerId) {
      res.status(400).json({ success: false, message: 'categoryId e playerId sono obbligatori' })
      return
    }

    const result = await addEntry(categoryId, memberId, playerId, {
      maxBid,
      targetPrice,
      priority,
      notes,
    })

    if (!result.success) {
      const status = result.message?.includes('non trovata') || result.message?.includes('non trovato') ? 404 :
                     result.message?.includes('membro') ? 403 : 400
      res.status(status).json(result)
      return
    }

    res.status(201).json(result)
  } catch (error) {
    console.error('Add watchlist entry error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// PUT /api/leagues/:id/watchlist/entries/:entryId - Update an entry
router.put('/leagues/:id/watchlist/entries/:entryId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.id
    const entryId = req.params.entryId
    const memberId = await getMemberId(req.user!.userId, leagueId)

    if (!memberId) {
      res.status(403).json({ success: false, message: 'Non sei membro di questa lega' })
      return
    }

    const { maxBid, targetPrice, priority, notes } = req.body as {
      maxBid?: number | null
      targetPrice?: number | null
      priority?: number | null
      notes?: string | null
    }

    const result = await updateEntry(entryId, memberId, {
      maxBid,
      targetPrice,
      priority,
      notes,
    })

    if (!result.success) {
      const status = result.message?.includes('non trovata') ? 404 :
                     result.message === 'Non autorizzato' ? 403 : 400
      res.status(status).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Update watchlist entry error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// DELETE /api/leagues/:id/watchlist/entries/:entryId - Remove an entry
router.delete('/leagues/:id/watchlist/entries/:entryId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.id
    const entryId = req.params.entryId
    const memberId = await getMemberId(req.user!.userId, leagueId)

    if (!memberId) {
      res.status(403).json({ success: false, message: 'Non sei membro di questa lega' })
      return
    }

    const result = await removeEntry(entryId, memberId)

    if (!result.success) {
      const status = result.message?.includes('non trovata') ? 404 :
                     result.message === 'Non autorizzato' ? 403 : 400
      res.status(status).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Remove watchlist entry error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/leagues/:id/watchlist/entries/:entryId/move - Move entry to another category
router.post('/leagues/:id/watchlist/entries/:entryId/move', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.id
    const entryId = req.params.entryId
    const memberId = await getMemberId(req.user!.userId, leagueId)

    if (!memberId) {
      res.status(403).json({ success: false, message: 'Non sei membro di questa lega' })
      return
    }

    const { categoryId } = req.body as { categoryId: string }

    if (!categoryId) {
      res.status(400).json({ success: false, message: 'categoryId e\' obbligatorio' })
      return
    }

    const result = await moveEntry(entryId, memberId, categoryId)

    if (!result.success) {
      const status = result.message?.includes('non trovata') ? 404 :
                     result.message === 'Non autorizzato' ? 403 : 400
      res.status(status).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Move watchlist entry error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// PUT /api/leagues/:id/watchlist/entries/player/:playerId/category - Set player category (convenience method)
// This creates, moves, or removes a player's watchlist entry in one call
router.put('/leagues/:id/watchlist/entries/player/:playerId/category', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.id
    const playerId = req.params.playerId
    const memberId = await getMemberId(req.user!.userId, leagueId)

    if (!memberId) {
      res.status(403).json({ success: false, message: 'Non sei membro di questa lega' })
      return
    }

    const { categoryId } = req.body as { categoryId: string | null }

    // Find existing entry for this player
    const existingEntry = await prisma.watchlistEntry.findFirst({
      where: {
        memberId,
        playerId,
        category: {
          leagueId,
        },
      },
    })

    // If categoryId is null, remove the entry
    if (categoryId === null) {
      if (existingEntry) {
        const result = await removeEntry(existingEntry.id, memberId)
        res.json(result)
        return
      }
      // No entry exists and no category to set - nothing to do
      res.json({ success: true, data: null })
      return
    }

    // If entry exists, move it to the new category
    if (existingEntry) {
      if (existingEntry.categoryId === categoryId) {
        // Already in this category
        res.json({
          success: true,
          message: 'Giocatore gia\' in questa categoria',
          data: {
            id: existingEntry.id,
            playerId: existingEntry.playerId,
            categoryId: existingEntry.categoryId,
            memberId: existingEntry.memberId,
          },
        })
        return
      }
      const result = await moveEntry(existingEntry.id, memberId, categoryId)
      res.json(result)
      return
    }

    // No existing entry - create a new one
    const result = await addEntry(categoryId, memberId, playerId, {})

    if (!result.success) {
      const status = result.message?.includes('non trovata') || result.message?.includes('non trovato') ? 404 : 400
      res.status(status).json(result)
      return
    }

    res.status(201).json(result)
  } catch (error) {
    console.error('Set player category error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// DELETE /api/leagues/:id/watchlist/entries/player/:playerId - Remove player from watchlist by playerId
router.delete('/leagues/:id/watchlist/entries/player/:playerId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.id
    const playerId = req.params.playerId
    const memberId = await getMemberId(req.user!.userId, leagueId)

    if (!memberId) {
      res.status(403).json({ success: false, message: 'Non sei membro di questa lega' })
      return
    }

    // Find existing entry for this player
    const existingEntry = await prisma.watchlistEntry.findFirst({
      where: {
        memberId,
        playerId,
        category: {
          leagueId,
        },
      },
    })

    if (!existingEntry) {
      res.status(404).json({ success: false, message: 'Giocatore non trovato nella watchlist' })
      return
    }

    const result = await removeEntry(existingEntry.id, memberId)
    res.json(result)
  } catch (error) {
    console.error('Remove player from watchlist error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

export default router
