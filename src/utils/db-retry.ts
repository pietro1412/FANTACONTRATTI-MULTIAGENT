/**
 * Utility per gestire retry delle operazioni database
 * Utile per cold start di database serverless come Neon
 */

interface RetryOptions {
  maxRetries?: number
  initialDelayMs?: number
  maxDelayMs?: number
  backoffMultiplier?: number
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
}

// Codici errore Prisma che indicano problemi di connessione (retry-able)
const RETRYABLE_ERROR_CODES = [
  'P1001', // Can't reach database server
  'P1002', // Database server timed out
  'P1008', // Operations timed out
  'P1017', // Server has closed the connection
  'P2024', // Timed out fetching a new connection from the connection pool
]

function isRetryableError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code: string }).code
    return RETRYABLE_ERROR_CODES.includes(code)
  }
  return false
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Esegue un'operazione con retry automatico per errori di connessione
 * @param operation - La funzione async da eseguire
 * @param options - Opzioni di retry
 * @returns Il risultato dell'operazione
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  let lastError: unknown
  let delay = opts.initialDelayMs

  for (let attempt = 1; attempt <= opts.maxRetries + 1; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error

      // Se non è un errore retry-able, rilancia subito
      if (!isRetryableError(error)) {
        throw error
      }

      // Se abbiamo esaurito i tentativi, rilancia
      if (attempt > opts.maxRetries) {
        console.error(`[DB-RETRY] Tutti i ${opts.maxRetries} tentativi falliti`)
        throw error
      }

      // Log e attendi prima del prossimo tentativo
      console.warn(
        `[DB-RETRY] Tentativo ${attempt}/${opts.maxRetries} fallito, riprovo tra ${delay}ms...`,
        (error as { code?: string }).code
      )

      await sleep(delay)

      // Exponential backoff
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelayMs)
    }
  }

  throw lastError
}

/**
 * Wrapper per transazioni Prisma con retry
 * @param prisma - Istanza PrismaClient
 * @param fn - Funzione da eseguire nella transazione
 * @param options - Opzioni di retry
 */
export async function withRetryTransaction<T>(
  prisma: { $transaction: (fn: (tx: unknown) => Promise<T>) => Promise<T> },
  fn: (tx: unknown) => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  return withRetry(() => prisma.$transaction(fn), options)
}
