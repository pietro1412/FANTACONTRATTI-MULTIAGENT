import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
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
import chatRoutes from './routes/chat'

const app = express()

// CORS configuration for Vercel
const allowedOrigins = [
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
  process.env.FRONTEND_URL || '',
  'http://localhost:5173',
  'http://localhost:3000',
].filter(Boolean)

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true)

    // Check if origin is allowed
    if (allowedOrigins.some(allowed => origin.startsWith(allowed) || origin.includes('vercel.app'))) {
      callback(null, true)
    } else {
      callback(null, true) // Allow all for now in development
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}

// Middleware
app.use(cors(corsOptions))
app.use(express.json())
app.use(cookieParser())

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
    vercel: true,
  }

  // 1. Check Pusher configuration
  const pusherConfig = {
    appId: process.env.PUSHER_APP_ID ? `✓ set (${process.env.PUSHER_APP_ID})` : '✗ missing',
    key: process.env.VITE_PUSHER_KEY ? '✓ set' : '✗ missing',
    secret: process.env.PUSHER_SECRET ? '✓ set' : '✗ missing',
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
    VERCEL_URL: process.env.VERCEL_URL || 'not set',
    DATABASE_URL: process.env.DATABASE_URL ? '✓ set' : '✗ missing',
  }

  res.json(results)
})

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/leagues', leagueRoutes)
app.use('/api/players', playerRoutes)
app.use('/api', auctionRoutes)
app.use('/api', contractRoutes)
app.use('/api', tradeRoutes)
app.use('/api', rubataRoutes)
app.use('/api', svincolatiRoutes)
app.use('/api', adminRoutes)
app.use('/api', inviteRoutes)
app.use('/api', movementRoutes)
app.use('/api', superadminRoutes)
app.use('/api', chatRoutes)

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint non trovato' })
})

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err)
  res.status(500).json({ success: false, message: 'Errore interno del server' })
})

export default app
