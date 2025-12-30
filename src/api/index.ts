import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'

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
const PORT = process.env.API_PORT || 3003

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}

// Middleware - cors handles OPTIONS preflight automatically
app.use(cors(corsOptions))
app.use(express.json())
app.use(cookieParser())

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
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
app.use('/api', chatRoutes) // Chat routes include /sessions/:id/chat

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint non trovato' })
})

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err)
  res.status(500).json({ success: false, message: 'Errore interno del server' })
})

// Start server
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀 API Server running on http://localhost:${PORT}`)
    console.log(`📋 Health check: http://localhost:${PORT}/api/health`)
  })
}

export default app
