import { prisma } from '@/lib/prisma'
import type { Prisma, LogCategory, LogSeverity } from '@prisma/client'
import type { ServiceResult } from '@/shared/types/service-result'

// Severity level ordering for threshold comparison
const SEVERITY_LEVELS: Record<string, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  CRITICAL: 4,
}

// Minimum severity level from env (default: INFO)
function getMinLevel(): number {
  const envLevel = process.env.LOG_LEVEL?.toUpperCase() ?? 'INFO'
  return SEVERITY_LEVELS[envLevel] ?? 1
}

function shouldLog(severity: LogSeverity): boolean {
  const level = SEVERITY_LEVELS[severity] ?? 0
  return level >= getMinLevel()
}

const isDev = process.env.NODE_ENV !== 'production'

// Fire-and-forget helper — writes to DB and optionally to console in dev
function writeLog(
  severity: LogSeverity,
  category: LogCategory,
  message: string,
  metadata?: Record<string, unknown>,
  userId?: string
): void {
  if (!shouldLog(severity)) return

  if (isDev) {
    const tag = `[${severity}][${category}]`
    const extra = metadata ? ` ${JSON.stringify(metadata)}` : ''
    console.log(`${tag} ${message}${extra}`)
  }

  prisma.appLog
    .create({
      data: {
        source: 'BACKEND',
        severity,
        category,
        message,
        metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        userId,
      },
    })
    .catch(() => {
      // Fire-and-forget: never crash the main flow
    })
}

// Convenience log functions (fire-and-forget)
export function logDebug(category: LogCategory, message: string, metadata?: Record<string, unknown>): void {
  writeLog('DEBUG', category, message, metadata)
}

export function logInfo(category: LogCategory, message: string, metadata?: Record<string, unknown>): void {
  writeLog('INFO', category, message, metadata)
}

export function logWarn(category: LogCategory, message: string, metadata?: Record<string, unknown>): void {
  writeLog('WARN', category, message, metadata)
}

export function logError(category: LogCategory, message: string, metadata?: Record<string, unknown>): void {
  writeLog('ERROR', category, message, metadata)
}

export function logCritical(category: LogCategory, message: string, metadata?: Record<string, unknown>): void {
  writeLog('CRITICAL', category, message, metadata)
}

// Request logging entry used by the middleware
interface RequestLogEntry {
  method: string
  path: string
  statusCode: number
  durationMs: number
  userId?: string
  query?: Record<string, unknown>
  userAgent?: string
}

export function logRequest(entry: RequestLogEntry): void {
  const severity: LogSeverity =
    entry.statusCode >= 500 ? 'ERROR' : entry.statusCode >= 400 ? 'WARN' : 'INFO'

  if (!shouldLog(severity)) return

  const message = `${entry.method} ${entry.path} ${entry.statusCode} ${entry.durationMs}ms`

  if (isDev) {
    console.log(`[${severity}][REQUEST] ${message}`)
  }

  prisma.appLog
    .create({
      data: {
        source: 'BACKEND',
        severity,
        category: 'REQUEST',
        message,
        method: entry.method,
        path: entry.path,
        statusCode: entry.statusCode,
        durationMs: entry.durationMs,
        userId: entry.userId,
        metadata: {
          query: entry.query ?? null,
          userAgent: entry.userAgent ?? null,
        } as Prisma.InputJsonValue,
      },
    })
    .catch(() => {
      // Fire-and-forget
    })
}

// Frontend log ingestion (called by POST /api/logs)
export function logFromFrontend(
  severity: LogSeverity,
  category: LogCategory,
  message: string,
  metadata?: Record<string, unknown>,
  userId?: string
): void {
  if (!shouldLog(severity)) return

  prisma.appLog
    .create({
      data: {
        source: 'FRONTEND',
        severity,
        category,
        message,
        metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        userId,
      },
    })
    .catch(() => {
      // Fire-and-forget
    })
}

// Purge logs older than 7 days
export async function purgeOldLogs(): Promise<ServiceResult> {
  try {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 7)

    const result = await prisma.appLog.deleteMany({
      where: { timestamp: { lt: cutoff } },
    })

    return {
      success: true,
      data: { deleted: result.count },
      message: `Eliminati ${result.count} log piu' vecchi di 7 giorni`,
    }
  } catch {
    return { success: false, message: 'Errore durante la pulizia dei log' }
  }
}

// Query recent logs with filters
interface RecentLogsOptions {
  severity?: LogSeverity
  source?: 'FRONTEND' | 'BACKEND'
  category?: LogCategory
  limit?: number
  sinceMinutes?: number
}

export async function getRecentLogs(options: RecentLogsOptions = {}): Promise<ServiceResult> {
  try {
    const limit = options.limit ?? 100
    const sinceMinutes = options.sinceMinutes ?? 60

    const since = new Date()
    since.setMinutes(since.getMinutes() - sinceMinutes)

    const where: Record<string, unknown> = {
      timestamp: { gte: since },
    }
    if (options.severity) where.severity = options.severity
    if (options.source) where.source = options.source
    if (options.category) where.category = options.category

    const logs = await prisma.appLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit,
    })

    return { success: true, data: { logs, count: logs.length } }
  } catch {
    return { success: false, message: 'Errore durante il recupero dei log' }
  }
}
