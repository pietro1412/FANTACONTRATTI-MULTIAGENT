/**
 * Time Synchronization API
 * Endpoint per sincronizzare il clock del client con il server
 */
import { Router } from 'express'
import type { Request, Response } from 'express'
import crypto from 'crypto'

const router = Router()

/**
 * GET /api/time
 * Restituisce il timestamp corrente del server
 *
 * Response: {
 *   serverTime: number,      // Unix timestamp in ms
 *   requestId: string        // Per tracciare latenza roundtrip
 * }
 */
router.get('/', (_req: Request, res: Response) => {
  res.json({
    serverTime: Date.now(),
    requestId: crypto.randomUUID()
  })
})

export default router
