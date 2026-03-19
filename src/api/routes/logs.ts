import { Router } from 'express'
import type { Request, Response } from 'express'
import rateLimit from 'express-rate-limit'
import { optionalAuthMiddleware } from '../middleware/auth'
import {
  logFromFrontend,
  getRecentLogs,
  purgeOldLogs,
} from '../../services/app-log.service'
import type { LogSeverity, LogCategory } from '@prisma/client'

const router = Router()

// Valid enum values for validation
const VALID_SEVERITIES: LogSeverity[] = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL']
const VALID_CATEGORIES: LogCategory[] = ['REQUEST', 'ERROR', 'ANOMALY', 'PERFORMANCE']
const VALID_SOURCES = ['FRONTEND', 'BACKEND'] as const

// Rate limit for frontend log ingestion: 50 requests per 15 minutes per IP
const logIngestionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Troppe richieste di logging. Riprova piu\' tardi.' },
})

// Cron secret validation helper
function validateCronSecret(req: Request, res: Response): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    res.status(500).json({ success: false, message: 'CRON_SECRET non configurato' })
    return false
  }

  const provided = req.headers['x-cron-secret']
  if (provided !== cronSecret) {
    res.status(403).json({ success: false, message: 'Non autorizzato' })
    return false
  }

  return true
}

// POST /api/logs — Frontend log ingestion
router.post('/', logIngestionLimiter, optionalAuthMiddleware, (req: Request, res: Response) => {
  try {
    const { severity, category, message, metadata } = req.body as {
      severity?: string
      category?: string
      message?: string
      metadata?: Record<string, unknown>
    }

    if (!severity || !category || !message) {
      res.status(400).json({ success: false, message: 'severity, category e message sono obbligatori' })
      return
    }

    if (!VALID_SEVERITIES.includes(severity as LogSeverity)) {
      res.status(400).json({ success: false, message: `severity non valida. Valori: ${VALID_SEVERITIES.join(', ')}` })
      return
    }

    if (!VALID_CATEGORIES.includes(category as LogCategory)) {
      res.status(400).json({ success: false, message: `category non valida. Valori: ${VALID_CATEGORIES.join(', ')}` })
      return
    }

    logFromFrontend(
      severity as LogSeverity,
      category as LogCategory,
      message,
      metadata,
      req.user?.userId
    )

    res.json({ success: true })
  } catch {
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// GET /api/logs/recent — Query recent logs (cron-protected)
router.get('/recent', async (req: Request, res: Response) => {
  try {
    if (!validateCronSecret(req, res)) return

    const { severity, source, category, limit, sinceMinutes } = req.query as {
      severity?: string
      source?: string
      category?: string
      limit?: string
      sinceMinutes?: string
    }

    // Validate optional enum params
    if (severity && !VALID_SEVERITIES.includes(severity as LogSeverity)) {
      res.status(400).json({ success: false, message: 'severity non valida' })
      return
    }
    if (source && !VALID_SOURCES.includes(source as typeof VALID_SOURCES[number])) {
      res.status(400).json({ success: false, message: 'source non valida' })
      return
    }
    if (category && !VALID_CATEGORIES.includes(category as LogCategory)) {
      res.status(400).json({ success: false, message: 'category non valida' })
      return
    }

    const result = await getRecentLogs({
      severity: severity as LogSeverity | undefined,
      source: source as 'FRONTEND' | 'BACKEND' | undefined,
      category: category as LogCategory | undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      sinceMinutes: sinceMinutes ? parseInt(sinceMinutes, 10) : undefined,
    })

    if (!result.success) {
      res.status(500).json(result)
      return
    }

    res.json(result)
  } catch {
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// DELETE /api/logs/purge — Cleanup old logs (cron-protected)
router.delete('/purge', async (req: Request, res: Response) => {
  try {
    if (!validateCronSecret(req, res)) return

    const result = await purgeOldLogs()

    if (!result.success) {
      res.status(500).json(result)
      return
    }

    res.json(result)
  } catch {
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

export default router
