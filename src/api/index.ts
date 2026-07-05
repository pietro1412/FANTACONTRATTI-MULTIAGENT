import { createApp } from './app'
import { registerApiFootballSyncJob, startApiFootballSyncJob } from '../shared/infrastructure/cron'

// Local dev server entrypoint. All middleware and routes live in createApp()
// (src/api/app.ts), shared with the production entry (vercel-entry.ts).
const app = createApp({ devDebug: process.env.NODE_ENV !== 'production' })
const PORT = process.env.API_PORT || 3003

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
