import type { Request, Response, NextFunction } from 'express'

/**
 * Cache middleware for read-only API endpoints.
 * Sets Cache-Control headers to enable browser caching and reduce Vercel function invocations.
 *
 * Usage:
 *   router.get('/endpoint', authMiddleware, cacheControl(300), handler)
 *
 * @param maxAge - Cache duration in seconds
 */
export function cacheControl(maxAge: number) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    // public: response can be cached by any cache (browser, CDN)
    // max-age: how long the response is fresh (in seconds)
    res.set('Cache-Control', `public, max-age=${maxAge}`)
    next()
  }
}

/**
 * Private cache for user-specific data.
 * Only allows browser to cache, not intermediate caches.
 *
 * Usage:
 *   router.get('/me', authMiddleware, privateCacheControl(60), handler)
 *
 * @param maxAge - Cache duration in seconds
 */
export function privateCacheControl(maxAge: number) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    // private: only browser can cache, not CDN or proxies
    // max-age: how long the response is fresh (in seconds)
    res.set('Cache-Control', `private, max-age=${maxAge}`)
    next()
  }
}

/**
 * No cache for dynamic/critical data.
 * Forces revalidation on every request.
 */
export function noCache() {
  return (_req: Request, res: Response, next: NextFunction): void => {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    next()
  }
}
