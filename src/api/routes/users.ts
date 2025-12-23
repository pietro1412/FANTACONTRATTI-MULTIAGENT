import { Router } from 'express'
import type { Request, Response } from 'express'
import { updateProfileSchema, changePasswordSchema } from '../../utils/validation'
import { getProfile, updateProfile, changePassword, updateProfilePhoto, removeProfilePhoto } from '../../services/user.service'
import { authMiddleware } from '../middleware/auth'

const router = Router()

// All routes require authentication
router.use(authMiddleware)

// GET /api/users/profile
router.get('/profile', async (req: Request, res: Response) => {
  try {
    const result = await getProfile(req.user!.userId)

    if (!result.success) {
      res.status(404).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get profile error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// PUT /api/users/profile
router.put('/profile', async (req: Request, res: Response) => {
  try {
    const validation = updateProfileSchema.safeParse(req.body)

    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: 'Dati non validi',
        errors: validation.error.issues,
      })
      return
    }

    const result = await updateProfile(req.user!.userId, validation.data)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Update profile error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// PUT /api/users/password
router.put('/password', async (req: Request, res: Response) => {
  try {
    const validation = changePasswordSchema.safeParse(req.body)

    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: 'Dati non validi',
        errors: validation.error.issues,
      })
      return
    }

    const { confirmNewPassword: _, ...input } = validation.data
    const result = await changePassword(req.user!.userId, input)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Change password error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// PUT /api/users/photo - Update profile photo
router.put('/photo', async (req: Request, res: Response) => {
  try {
    const { photoData } = req.body as { photoData?: string }

    if (!photoData) {
      res.status(400).json({ success: false, message: 'Nessuna foto fornita' })
      return
    }

    const result = await updateProfilePhoto(req.user!.userId, photoData)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Update photo error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// DELETE /api/users/photo - Remove profile photo
router.delete('/photo', async (req: Request, res: Response) => {
  try {
    const result = await removeProfilePhoto(req.user!.userId)
    res.json(result)
  } catch (error) {
    console.error('Remove photo error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

export default router
