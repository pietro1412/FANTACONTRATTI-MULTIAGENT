import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { PrismaClient } from '@prisma/client'
import { pusher } from '../services/pusher.service'

import authRoutes from './routes/auth'
import userRoutes from './routes/users'
import leagueRoutes from './routes/leagues'
import playerRoutes from './routes/players'
import auctionRoutes from './routes/auctions'
import contractRoutes from './routes/contracts'
import tradeRoutes from './routes/trades'
import rubataRoutes from './routes/rubata'
import svincolatiRoutes from './routes/svincolati'
import adminRoutes from './routes/admin'
import inviteRoutes from './routes/invites'
import movementRoutes from './routes/movements'
import superadminRoutes from './routes/superadmin'
import prizeRoutes from './routes/prizes'
import historyRoutes from './routes/history'
import indemnityRoutes from './routes/indemnity'
import timeRoutes from './routes/time'
import objectivesRoutes from './routes/objectives'
import feedbackRoutes from './routes/feedback'
import contractHistoryRoutes from './routes/contract-history'
import pushRoutes from './routes/push'
import cronRoutes from './routes/cron'
import { initWebPush } from '../services/notification.service'
import { registerApiFootballSyncJob, startApiFootballSyncJob } from '../shared/infrastructure/cron'

const app = express()
const PORT = process.env.API_PORT || 3003

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // CSP managed by frontend/Vercel
  crossOriginEmbedderPolicy: false, // Allow cross-origin requests
}))

// Middleware - cors handles OPTIONS preflight automatically
app.use(cors(corsOptions))
app.use(express.json())
app.use(cookieParser())

// Rate limiting - general API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: 2000, // max 2000 richieste per IP per finestra
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Troppe richieste. Riprova tra qualche minuto.' },
})
app.use('/api', apiLimiter)

// Rate limiting - auth endpoints (più restrittivo)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: 20, // max 20 tentativi login per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Troppi tentativi di accesso. Riprova tra 15 minuti.' },
})
app.use('/api/auth/login', authLimiter)
app.use('/api/auth/register', authLimiter)

// Input sanitization middleware - strip HTML tags from all string inputs
function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(/<[^>]*>/g, '').trim()
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue)
  }
  if (value && typeof value === 'object') {
    const sanitized: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      sanitized[k] = sanitizeValue(v)
    }
    return sanitized
  }
  return value
}

app.use((req, _res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeValue(req.body)
  }
  next()
})

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Diagnostic endpoint for debugging latency issues
const diagPrisma = new PrismaClient()
app.get('/api/debug/timing', async (_req, res) => {
  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'unknown',
  }

  // 1. Check Pusher configuration
  const pusherConfig = {
    appId: process.env.PUSHER_APP_ID ? '✓ set' : '✗ missing',
    key: process.env.VITE_PUSHER_KEY ? '✓ set' : '✗ missing',
    secret: process.env.PUSHER_SECRET ? '✓ set (' + process.env.PUSHER_SECRET?.slice(0, 4) + '...)' : '✗ missing',
    cluster: process.env.VITE_PUSHER_CLUSTER || '✗ missing',
    instanceCreated: pusher ? '✓ yes' : '✗ no',
  }
  results.pusherConfig = pusherConfig

  // 2. Test database connection
  const dbStart = Date.now()
  try {
    await diagPrisma.$queryRaw`SELECT 1`
    results.dbLatency = `${Date.now() - dbStart}ms`
    results.dbStatus = '✓ connected'
  } catch (err) {
    results.dbLatency = `${Date.now() - dbStart}ms`
    results.dbStatus = `✗ error: ${err instanceof Error ? err.message : 'unknown'}`
  }

  // 3. Test Pusher trigger (to a test channel)
  if (pusher) {
    const pusherStart = Date.now()
    try {
      await pusher.trigger('debug-channel', 'test-event', {
        test: true,
        timestamp: new Date().toISOString()
      })
      results.pusherLatency = `${Date.now() - pusherStart}ms`
      results.pusherStatus = '✓ working'
    } catch (err) {
      results.pusherLatency = `${Date.now() - pusherStart}ms`
      results.pusherStatus = `✗ error: ${err instanceof Error ? err.message : 'unknown'}`
    }
  } else {
    results.pusherLatency = 'N/A'
    results.pusherStatus = '✗ not initialized'
  }

  // 4. Environment info
  results.env = {
    FRONTEND_URL: process.env.FRONTEND_URL || 'not set',
    API_PORT: process.env.API_PORT || 'not set',
    DATABASE_URL: process.env.DATABASE_URL ? '✓ set (...' + process.env.DATABASE_URL.slice(-20) + ')' : '✗ missing',
  }

  res.json(results)
})

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/leagues', leagueRoutes)
app.use('/api/players', playerRoutes)
app.use('/api', auctionRoutes) // Auction routes include /leagues/:id/auctions and /auctions/*
app.use('/api', contractRoutes) // Contract routes
app.use('/api', tradeRoutes) // Trade routes include /leagues/:id/trades/* and /trades/*
app.use('/api', rubataRoutes) // Rubata routes include /leagues/:id/rubata/* and /rubata/*
app.use('/api', svincolatiRoutes) // Svincolati routes include /leagues/:id/svincolati/* and /svincolati/*
app.use('/api', adminRoutes) // Admin routes include /leagues/:id/admin/*
app.use('/api', inviteRoutes) // Invite routes include /leagues/:id/invites and /invites/*
app.use('/api', movementRoutes) // Movement routes include /leagues/:id/movements and /movements/*
app.use('/api', superadminRoutes) // Superadmin routes include /superadmin/*
app.use('/api', prizeRoutes) // Prize phase routes include /sessions/:id/prizes/*
app.use('/api', historyRoutes) // History routes include /leagues/:id/history/*
app.use('/api', indemnityRoutes) // Indemnity phase routes include /leagues/:id/indemnity/*
app.use('/api/time', timeRoutes) // Time sync endpoint for client clock calibration
app.use('/api', objectivesRoutes) // Objectives routes for pre-auction targets
app.use('/api/feedback', feedbackRoutes) // Feedback/segnalazioni routes
app.use('/api', contractHistoryRoutes) // Contract history routes for tracking changes
app.use('/api/push', pushRoutes) // Push notification routes
app.use('/api', cronRoutes) // Cron endpoints for Vercel Cron

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint non trovato' })
})

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err)
  res.status(500).json({ success: false, message: 'Errore interno del server' })
})

// Initialize web push notifications
initWebPush()

// Start server
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀 API Server running on http://localhost:${PORT}`)
    console.log(`📋 Health check: http://localhost:${PORT}/api/health`)

    // Start cron jobs only in local dev (persistent server)
    if (!process.env.VERCEL) {
      registerApiFootballSyncJob()
      startApiFootballSyncJob()
      console.log('[CRON] API-Football sync job started (hourly check)')
    }
  })
}

export default app
