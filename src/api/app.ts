import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { prisma } from '@/lib/prisma'
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
import timeRoutes from './routes/time'
import objectivesRoutes from './routes/objectives'
import feedbackRoutes from './routes/feedback'
import contractHistoryRoutes from './routes/contract-history'
import pushRoutes from './routes/push'
import cronRoutes from './routes/cron'
import logRoutes from './routes/logs'
import { requestLogger } from './middleware/request-logger'
import { initWebPush } from '../services/notification.service'

const isProduction = process.env.NODE_ENV === 'production' || !!process.env.VERCEL

export interface CreateAppOptions {
  /**
   * Mount dev-only diagnostic endpoints (/api/debug/timing).
   * Must stay false in production: diagnostics expose internals and are unauthenticated.
   */
  devDebug?: boolean
}

/**
 * Shared Express app factory used by BOTH entrypoints:
 * - src/api/index.ts (local dev server)
 * - src/api/vercel-entry.ts (production serverless bundle)
 *
 * Security middleware (helmet, CORS allowlist, rate limiting, input
 * sanitization) lives HERE so the two entrypoints cannot diverge again.
 * Do not add routes or middleware directly in the entrypoints.
 */
export function createApp(options: CreateAppOptions = {}): express.Express {
  const app = express()

  // CORS — production: strict allowlist (FRONTEND_URL, current deployment URL,
  // *.vercel.app previews). Dev: localhost + private LAN IPs on any port
  // (testing from devices on the same network; Vite port varies).
  const devOriginPattern =
    /^http:\/\/(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}):\d+$/

  const allowedOrigins = [
    process.env.FRONTEND_URL || '',
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
  ].filter(Boolean)

  const isAllowedOrigin = (origin: string): boolean => {
    if (!isProduction) return devOriginPattern.test(origin)
    if (allowedOrigins.includes(origin)) return true
    // Vercel preview deployments: https + hostname ending in .vercel.app
    // (suffix check on the parsed hostname, NOT substring on the full origin)
    try {
      const url = new URL(origin)
      return url.protocol === 'https:' && url.hostname.endsWith('.vercel.app')
    } catch {
      return false
    }
  }

  app.use(
    cors({
      origin: (origin, callback) => {
        // Requests with no Origin header (curl, server-to-server, some mobile clients)
        if (!origin) {
          callback(null, true)
          return
        }
        callback(null, isAllowedOrigin(origin))
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  )

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: false, // CSP managed by frontend/Vercel
      crossOriginEmbedderPolicy: false, // Allow cross-origin requests
    })
  )

  app.use(express.json())
  app.use(cookieParser())

  // Rate limiting - general API.
  // NOTE (serverless): the in-memory store is per-instance, so on Vercel this
  // only throttles bursts hitting the same warm instance. Good enough for a
  // small closed beta; move to a shared store (e.g. Upstash) before scaling.
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minuti
    max: 2000, // max 2000 richieste per IP per finestra
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Troppe richieste. Riprova tra qualche minuto.' },
    // In locale (test multi-client con polling intenso) il limite globale si esaurisce
    // e blocca tutte le API: lo si applica solo in produzione. (test-session #24)
    skip: () => !isProduction,
  })
  app.use('/api', apiLimiter)

  // Rate limiting - auth endpoints (più restrittivo)
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minuti
    max: isProduction ? 20 : 100, // 20 in prod, 100 in dev (simulations)
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Troppi tentativi di accesso. Riprova tra 15 minuti.' },
    // In locale (test multi-utente con molti login/refresh) il rate limit sul login
    // è solo d'intralcio: lo si applica solo in produzione (anti-brute-force).
    skip: () => !isProduction,
  })
  app.use('/api/auth/login', authLimiter)
  app.use('/api/auth/register', authLimiter)

  // Input sanitization middleware - strip HTML tags from all string inputs
  app.use((req, _res, next) => {
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeValue(req.body)
    }
    next()
  })

  // Request logging middleware (after auth-related middleware, before routes)
  app.use(requestLogger)

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  })

  // Dev-only diagnostics (never mounted in production)
  if (options.devDebug) {
    app.get('/api/debug/timing', debugTimingHandler)
  }

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
  app.use('/api/time', timeRoutes) // Time sync endpoint for client clock calibration
  app.use('/api', objectivesRoutes) // Objectives routes for pre-auction targets
  app.use('/api/feedback', feedbackRoutes) // Feedback/segnalazioni routes
  app.use('/api', contractHistoryRoutes) // Contract history routes for tracking changes
  app.use('/api/push', pushRoutes) // Push notification routes
  app.use('/api', cronRoutes) // Cron endpoints for Vercel Cron
  app.use('/api/logs', logRoutes) // Structured logging endpoints

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({ success: false, message: 'Endpoint non trovato' })
  })

  // Error handler
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled error:', err)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  })

  // Initialize web push notifications (no-op if VAPID keys are missing)
  initWebPush()

  return app
}

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

async function debugTimingHandler(_req: express.Request, res: express.Response): Promise<void> {
  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'unknown',
  }

  // 1. Check Pusher configuration
  results.pusherConfig = {
    appId: process.env.PUSHER_APP_ID ? '✓ set' : '✗ missing',
    key: process.env.VITE_PUSHER_KEY ? '✓ set' : '✗ missing',
    secret: process.env.PUSHER_SECRET ? '✓ set' : '✗ missing',
    cluster: process.env.VITE_PUSHER_CLUSTER || '✗ missing',
    instanceCreated: pusher ? '✓ yes' : '✗ no',
  }

  // 2. Test database connection
  const dbStart = Date.now()
  try {
    await prisma.$queryRaw`SELECT 1`
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
        timestamp: new Date().toISOString(),
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
    DATABASE_URL: process.env.DATABASE_URL ? '✓ set' : '✗ missing',
  }

  res.json(results)
}
