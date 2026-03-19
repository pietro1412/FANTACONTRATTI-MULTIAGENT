import type { Request, Response, NextFunction } from 'express'
import { logRequest } from '../../services/app-log.service'

// Paths to skip logging (health checks, heartbeats, time sync)
const SKIP_PATHS = ['/api/health', '/api/time']

function shouldSkip(path: string): boolean {
  if (SKIP_PATHS.includes(path)) return true
  if (path.endsWith('/heartbeat')) return true
  return false
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  if (shouldSkip(req.path)) {
    next()
    return
  }

  const start = Date.now()

  res.on('finish', () => {
    const durationMs = Date.now() - start

    logRequest({
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs,
      userId: req.user?.userId,
      query: Object.keys(req.query).length > 0 ? (req.query as Record<string, unknown>) : undefined,
      userAgent: req.headers['user-agent'],
    })
  })

  next()
}
