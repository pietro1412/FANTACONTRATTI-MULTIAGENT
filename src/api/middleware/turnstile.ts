import type { Request, Response, NextFunction } from 'express'

const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

/**
 * Middleware to verify Cloudflare Turnstile token.
 * If TURNSTILE_SECRET_KEY is not set, validation is skipped (dev mode).
 */
export async function verifyTurnstile(req: Request, res: Response, next: NextFunction) {
  if (!TURNSTILE_SECRET) {
    // Turnstile not configured - skip validation
    next()
    return
  }

  const token = req.body?.turnstileToken as string | undefined

  if (!token) {
    res.status(400).json({ success: false, message: 'Verifica CAPTCHA richiesta' })
    return
  }

  // Skip validation for unconfigured frontend token
  if (token === '__turnstile_not_configured__') {
    next()
    return
  }

  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: TURNSTILE_SECRET,
        response: token,
        remoteip: req.ip || '',
      }),
    })

    const result = await response.json() as { success: boolean }

    if (!result.success) {
      res.status(403).json({ success: false, message: 'Verifica CAPTCHA fallita. Riprova.' })
      return
    }

    next()
  } catch (error) {
    console.error('Turnstile verification error:', error)
    // On verification service failure, allow through to avoid blocking users
    next()
  }
}
