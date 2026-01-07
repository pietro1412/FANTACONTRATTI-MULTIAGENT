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

// Diagnostic endpoints for debugging latency issues
const diagPrisma = new PrismaClient()

// Simulate auction bid queries (read-only, no actual bid)
app.get('/api/debug/auction-sim', async (_req, res) => {
  const start = Date.now()
  const timing: Record<string, number> = {}

  try {
    // 1. Find any active auction (like placeBid does)
    let t = Date.now()
    const auction = await diagPrisma.auction.findFirst({
      where: { status: 'ACTIVE' },
      include: {
        player: true,
        league: true,
      },
    })
    timing['1_findAuction'] = Date.now() - t

    if (!auction) {
      // If no active auction, find any auction for testing
      t = Date.now()
      const anyAuction = await diagPrisma.auction.findFirst({
        include: { player: true, league: true },
      })
      timing['1_findAnyAuction'] = Date.now() - t

      res.json({
        success: true,
        noActiveAuction: true,
        hasAnyAuction: !!anyAuction,
        timing,
        totalMs: Date.now() - start,
      })
      return
    }

    // 2. Find member (like placeBid does)
    t = Date.now()
    const member = await diagPrisma.leagueMember.findFirst({
      where: {
        leagueId: auction.leagueId,
        status: 'ACTIVE',
      },
    })
    timing['2_findMember'] = Date.now() - t

    // 3. Count roster by position (like placeBid does)
    t = Date.now()
    const rosterCount = await diagPrisma.playerRoster.count({
      where: {
        leagueMemberId: member?.id || '',
        status: 'ACTIVE',
        player: {
          position: auction.player.position,
        },
      },
    })
    timing['3_countRoster'] = Date.now() - t

    // 4. Find existing bids (like placeBid updateMany check)
    t = Date.now()
    const bidsCount = await diagPrisma.auctionBid.count({
      where: {
        auctionId: auction.id,
        isWinning: true,
      },
    })
    timing['4_countWinningBids'] = Date.now() - t

    // 5. Find session (like placeBid does)
    t = Date.now()
    const session = await diagPrisma.marketSession.findFirst({
      where: {
        auctions: { some: { id: auction.id } },
      },
    })
    timing['5_findSession'] = Date.now() - t

    // 6. Test Pusher trigger (to debug channel, not real auction)
    t = Date.now()
    let pusherStatus = 'skipped'
    if (pusher) {
      try {
        await pusher.trigger('debug-channel', 'test-bid', {
          test: true,
          timestamp: new Date().toISOString(),
        })
        pusherStatus = 'ok'
      } catch (err) {
        pusherStatus = `error: ${err instanceof Error ? err.message : 'unknown'}`
      }
    }
    timing['6_pusherTrigger'] = Date.now() - t

    res.json({
      success: true,
      auctionId: auction.id,
      playerId: auction.playerId,
      playerName: auction.player.name,
      memberId: member?.id,
      rosterCount,
      bidsCount,
      sessionId: session?.id,
      pusherStatus,
      timing,
      totalMs: Date.now() - start,
    })
  } catch (err) {
    res.json({
      success: false,
      error: err instanceof Error ? err.message : 'unknown',
      timing,
      totalMs: Date.now() - start,
    })
  }
})

// DEBUG: Reset auction session for a league
app.post('/api/debug/reset-auction/:leagueId', async (req, res) => {
  const { leagueId } = req.params
  const start = Date.now()

  try {
    // 1. Find the market session
    const session = await diagPrisma.marketSession.findFirst({
      where: { leagueId },
      orderBy: { createdAt: 'desc' },
    })

    if (!session) {
      res.json({ success: false, error: 'No session found for this league' })
      return
    }

    // 2. Delete all acknowledgments for auctions in this session
    await diagPrisma.auctionAcknowledgment.deleteMany({
      where: {
        auction: { marketSessionId: session.id }
      }
    })

    // 2b. Delete all appeals for auctions in this session
    await diagPrisma.auctionAppeal.deleteMany({
      where: {
        auction: { marketSessionId: session.id }
      }
    })

    // 3. Delete all bids for auctions in this session
    await diagPrisma.auctionBid.deleteMany({
      where: {
        auction: { marketSessionId: session.id }
      }
    })

    // 4. Delete all auctions in this session
    await diagPrisma.auction.deleteMany({
      where: { marketSessionId: session.id }
    })

    // 4. Delete all roster entries created in this session
    await diagPrisma.playerRoster.deleteMany({
      where: {
        leagueMember: { leagueId },
        // Only delete if no contract (first market players)
        contract: null
      }
    })

    // 5. Reset session state
    await diagPrisma.marketSession.update({
      where: { id: session.id },
      data: {
        status: 'ACTIVE',
        currentTurnIndex: 0,
        readyMembers: [],
        nominatorConfirmed: false,
        pendingNominatorId: null,
        pendingNominationPlayerId: null,
      }
    })

    // 6. Reset member budgets to initial
    const league = await diagPrisma.league.findUnique({
      where: { id: leagueId }
    })

    if (league) {
      await diagPrisma.leagueMember.updateMany({
        where: { leagueId, status: 'ACTIVE' },
        data: { currentBudget: league.initialBudget }
      })
    }

    res.json({
      success: true,
      message: 'Auction reset successfully',
      sessionId: session.id,
      totalMs: Date.now() - start
    })
  } catch (err) {
    res.json({
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
      totalMs: Date.now() - start
    })
  }
})

// Simple ping endpoint for latency testing
app.get('/api/debug/ping', async (_req, res) => {
  const start = Date.now()
  const results: Record<string, unknown> = {
    requestReceived: new Date().toISOString(),
  }

  // Test 1: Just API response (no DB)
  const apiOnly = Date.now() - start
  results.apiOnlyMs = apiOnly

  // Test 2: Simple DB query
  const dbStart = Date.now()
  try {
    await diagPrisma.$queryRaw`SELECT 1`
    results.dbQueryMs = Date.now() - dbStart
    results.dbStatus = 'ok'
  } catch (err) {
    results.dbQueryMs = Date.now() - dbStart
    results.dbStatus = `error: ${err instanceof Error ? err.message : 'unknown'}`
  }

  // Test 3: DB query with actual data
  const dbDataStart = Date.now()
  try {
    const count = await diagPrisma.user.count()
    results.dbDataQueryMs = Date.now() - dbDataStart
    results.userCount = count
  } catch (err) {
    results.dbDataQueryMs = Date.now() - dbDataStart
  }

  results.totalMs = Date.now() - start
  results.responseTime = new Date().toISOString()

  res.json(results)
})
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
