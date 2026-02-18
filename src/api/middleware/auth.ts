import type { Request, Response, NextFunction } from 'express'
import { verifyAccessToken, type TokenPayload } from '../../utils/jwt'

// Extend Express Request type
declare module 'express-serve-static-core' {
  interface Request {
    user?: TokenPayload
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Token non fornito' })
    return
  }

  const token = authHeader.substring(7)
  const payload = verifyAccessToken(token)

  if (!payload) {
    res.status(401).json({ success: false, message: 'Token non valido o scaduto' })
    return
  }

  req.user = payload
  next()
}

export function optionalAuthMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    const payload = verifyAccessToken(token)
    if (payload) {
      req.user = payload
    }
  }

  next()
}
