/**
 * Cron Job Infrastructure for FANTACONTRATTI
 *
 * A simple interval-based job runner compatible with serverless environments.
 * Uses setInterval with protection against overlapping runs.
 */

/**
 * Represents the status and configuration of a cron job
 */
export interface CronJob {
  name: string
  intervalMs: number
  handler: () => Promise<void>
  isRunning: boolean
  lastRun: Date | null
  lastError: Error | null
}

/**
 * Internal job entry with interval tracking
 */
interface JobEntry {
  job: CronJob
  intervalId: NodeJS.Timeout | null
  isExecuting: boolean
}

/**
 * CronJobManager - Manages interval-based background jobs
 *
 * Features:
 * - Register jobs with custom intervals
 * - Start/stop individual or all jobs
 * - Prevents overlapping runs of the same job
 * - Tracks last run time and errors
 * - Graceful shutdown support
 */
export class CronJobManager {
  private jobs: Map<string, JobEntry>

  constructor() {
    this.jobs = new Map()
  }

  /**
   * Register a new job with the manager
   *
   * @param name - Unique name for the job
   * @param intervalMs - Interval in milliseconds between runs
   * @param handler - Async function to execute
   * @throws Error if job with same name already exists
   */
  register(name: string, intervalMs: number, handler: () => Promise<void>): void {
    if (this.jobs.has(name)) {
      throw new Error(`Job "${name}" is already registered`)
    }

    const job: CronJob = {
      name,
      intervalMs,
      handler,
      isRunning: false,
      lastRun: null,
      lastError: null,
    }

    this.jobs.set(name, {
      job,
      intervalId: null,
      isExecuting: false,
    })
  }

  /**
   * Start a specific job by name
   *
   * @param name - Name of the job to start
   * @throws Error if job doesn't exist
   */
  start(name: string): void {
    const entry = this.jobs.get(name)
    if (!entry) {
      throw new Error(`Job "${name}" is not registered`)
    }

    if (entry.job.isRunning) {
      return // Already running
    }

    entry.job.isRunning = true
    entry.intervalId = setInterval(() => {
      void this.executeJob(entry)
    }, entry.job.intervalMs)
  }

  /**
   * Stop a specific job by name
   *
   * @param name - Name of the job to stop
   * @throws Error if job doesn't exist
   */
  stop(name: string): void {
    const entry = this.jobs.get(name)
    if (!entry) {
      throw new Error(`Job "${name}" is not registered`)
    }

    if (!entry.job.isRunning) {
      return // Already stopped
    }

    if (entry.intervalId) {
      clearInterval(entry.intervalId)
      entry.intervalId = null
    }

    entry.job.isRunning = false
  }

  /**
   * Start all registered jobs
   */
  startAll(): void {
    for (const name of this.jobs.keys()) {
      this.start(name)
    }
  }

  /**
   * Stop all jobs (for graceful shutdown)
   */
  stopAll(): void {
    for (const name of this.jobs.keys()) {
      this.stop(name)
    }
  }

  /**
   * Get status of a specific job
   *
   * @param name - Name of the job
   * @returns CronJob status or undefined if not found
   */
  getStatus(name: string): CronJob | undefined {
    const entry = this.jobs.get(name)
    if (!entry) {
      return undefined
    }
    // Return a copy to prevent external modification
    return { ...entry.job }
  }

  /**
   * Get status of all registered jobs
   *
   * @returns Array of all job statuses
   */
  getAllStatus(): CronJob[] {
    return Array.from(this.jobs.values()).map((entry) => ({ ...entry.job }))
  }

  /**
   * Unregister a job by name
   * Will stop the job first if running
   *
   * @param name - Name of the job to unregister
   */
  unregister(name: string): void {
    const entry = this.jobs.get(name)
    if (!entry) {
      return
    }

    if (entry.job.isRunning) {
      this.stop(name)
    }

    this.jobs.delete(name)
  }

  /**
   * Clear all registered jobs
   * Will stop all jobs first
   */
  clear(): void {
    this.stopAll()
    this.jobs.clear()
  }

  /**
   * Execute a job with overlap protection
   * If the job is still executing from a previous run, skip this execution
   */
  private async executeJob(entry: JobEntry): Promise<void> {
    // Skip if previous execution is still running
    if (entry.isExecuting) {
      return
    }

    entry.isExecuting = true

    try {
      await entry.job.handler()
      entry.job.lastRun = new Date()
      entry.job.lastError = null
    } catch (error) {
      entry.job.lastError = error instanceof Error ? error : new Error(String(error))
      entry.job.lastRun = new Date()
    } finally {
      entry.isExecuting = false
    }
  }
}

/**
 * Singleton instance of the CronJobManager for application-wide use
 */
export const cronJobManager = new CronJobManager()
