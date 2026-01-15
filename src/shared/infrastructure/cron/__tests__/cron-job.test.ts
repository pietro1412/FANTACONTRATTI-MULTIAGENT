import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { CronJobManager } from '../cron-job'

describe('CronJobManager', () => {
  let cronManager: CronJobManager

  beforeEach(() => {
    vi.useFakeTimers()
    cronManager = new CronJobManager()
  })

  afterEach(() => {
    cronManager.clear()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('register', () => {
    it('should register a job successfully', () => {
      const handler = vi.fn().mockResolvedValue(undefined)

      cronManager.register('test-job', 1000, handler)

      const status = cronManager.getStatus('test-job')
      expect(status).toBeDefined()
      expect(status?.name).toBe('test-job')
      expect(status?.intervalMs).toBe(1000)
      expect(status?.isRunning).toBe(false)
      expect(status?.lastRun).toBeNull()
      expect(status?.lastError).toBeNull()
    })

    it('should throw error when registering duplicate job name', () => {
      const handler = vi.fn().mockResolvedValue(undefined)

      cronManager.register('test-job', 1000, handler)

      expect(() => {
        cronManager.register('test-job', 2000, handler)
      }).toThrow('Job "test-job" is already registered')
    })

    it('should allow registering multiple jobs with different names', () => {
      const handler1 = vi.fn().mockResolvedValue(undefined)
      const handler2 = vi.fn().mockResolvedValue(undefined)

      cronManager.register('job-1', 1000, handler1)
      cronManager.register('job-2', 2000, handler2)

      expect(cronManager.getStatus('job-1')).toBeDefined()
      expect(cronManager.getStatus('job-2')).toBeDefined()
      expect(cronManager.getAllStatus()).toHaveLength(2)
    })
  })

  describe('start', () => {
    it('should start a job and mark it as running', () => {
      const handler = vi.fn().mockResolvedValue(undefined)

      cronManager.register('test-job', 1000, handler)
      cronManager.start('test-job')

      const status = cronManager.getStatus('test-job')
      expect(status?.isRunning).toBe(true)
    })

    it('should throw error when starting non-existent job', () => {
      expect(() => {
        cronManager.start('non-existent')
      }).toThrow('Job "non-existent" is not registered')
    })

    it('should not throw when starting an already running job', () => {
      const handler = vi.fn().mockResolvedValue(undefined)

      cronManager.register('test-job', 1000, handler)
      cronManager.start('test-job')

      expect(() => {
        cronManager.start('test-job')
      }).not.toThrow()
    })

    it('should execute handler at specified interval', async () => {
      const handler = vi.fn().mockResolvedValue(undefined)

      cronManager.register('test-job', 1000, handler)
      cronManager.start('test-job')

      // Handler should not be called immediately
      expect(handler).not.toHaveBeenCalled()

      // Advance time by 1 second
      await vi.advanceTimersByTimeAsync(1000)
      expect(handler).toHaveBeenCalledTimes(1)

      // Advance time by another second
      await vi.advanceTimersByTimeAsync(1000)
      expect(handler).toHaveBeenCalledTimes(2)

      // Advance time by 3 more seconds
      await vi.advanceTimersByTimeAsync(3000)
      expect(handler).toHaveBeenCalledTimes(5)
    })

    it('should update lastRun timestamp after execution', async () => {
      const handler = vi.fn().mockResolvedValue(undefined)

      cronManager.register('test-job', 1000, handler)
      cronManager.start('test-job')

      expect(cronManager.getStatus('test-job')?.lastRun).toBeNull()

      await vi.advanceTimersByTimeAsync(1000)

      expect(cronManager.getStatus('test-job')?.lastRun).toBeInstanceOf(Date)
    })
  })

  describe('stop', () => {
    it('should stop a running job', async () => {
      const handler = vi.fn().mockResolvedValue(undefined)

      cronManager.register('test-job', 1000, handler)
      cronManager.start('test-job')

      await vi.advanceTimersByTimeAsync(1000)
      expect(handler).toHaveBeenCalledTimes(1)

      cronManager.stop('test-job')

      await vi.advanceTimersByTimeAsync(2000)
      expect(handler).toHaveBeenCalledTimes(1) // Still 1, no more executions
    })

    it('should mark job as not running after stop', () => {
      const handler = vi.fn().mockResolvedValue(undefined)

      cronManager.register('test-job', 1000, handler)
      cronManager.start('test-job')

      expect(cronManager.getStatus('test-job')?.isRunning).toBe(true)

      cronManager.stop('test-job')

      expect(cronManager.getStatus('test-job')?.isRunning).toBe(false)
    })

    it('should throw error when stopping non-existent job', () => {
      expect(() => {
        cronManager.stop('non-existent')
      }).toThrow('Job "non-existent" is not registered')
    })

    it('should not throw when stopping an already stopped job', () => {
      const handler = vi.fn().mockResolvedValue(undefined)

      cronManager.register('test-job', 1000, handler)

      expect(() => {
        cronManager.stop('test-job')
      }).not.toThrow()
    })
  })

  describe('error handling', () => {
    it('should capture error when handler throws', async () => {
      const error = new Error('Handler failed')
      const handler = vi.fn().mockRejectedValue(error)

      cronManager.register('test-job', 1000, handler)
      cronManager.start('test-job')

      await vi.advanceTimersByTimeAsync(1000)

      const status = cronManager.getStatus('test-job')
      expect(status?.lastError).toBeInstanceOf(Error)
      expect(status?.lastError?.message).toBe('Handler failed')
      expect(status?.lastRun).toBeInstanceOf(Date) // lastRun should still be updated
    })

    it('should continue running after handler error', async () => {
      const handler = vi.fn()
        .mockRejectedValueOnce(new Error('First error'))
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Third error'))

      cronManager.register('test-job', 1000, handler)
      cronManager.start('test-job')

      // First run - error
      await vi.advanceTimersByTimeAsync(1000)
      expect(handler).toHaveBeenCalledTimes(1)
      expect(cronManager.getStatus('test-job')?.lastError?.message).toBe('First error')

      // Second run - success
      await vi.advanceTimersByTimeAsync(1000)
      expect(handler).toHaveBeenCalledTimes(2)
      expect(cronManager.getStatus('test-job')?.lastError).toBeNull()

      // Third run - error
      await vi.advanceTimersByTimeAsync(1000)
      expect(handler).toHaveBeenCalledTimes(3)
      expect(cronManager.getStatus('test-job')?.lastError?.message).toBe('Third error')
    })

    it('should handle non-Error objects thrown by handler', async () => {
      const handler = vi.fn().mockRejectedValue('string error')

      cronManager.register('test-job', 1000, handler)
      cronManager.start('test-job')

      await vi.advanceTimersByTimeAsync(1000)

      const status = cronManager.getStatus('test-job')
      expect(status?.lastError).toBeInstanceOf(Error)
      expect(status?.lastError?.message).toBe('string error')
    })
  })

  describe('overlap protection', () => {
    it('should skip execution if previous run is still executing', async () => {
      let resolveFirstRun: () => void
      const firstRunPromise = new Promise<void>((resolve) => {
        resolveFirstRun = resolve
      })

      const handler = vi.fn()
        .mockImplementationOnce(() => firstRunPromise)
        .mockResolvedValue(undefined)

      cronManager.register('test-job', 100, handler)
      cronManager.start('test-job')

      // First interval - starts first execution
      await vi.advanceTimersByTimeAsync(100)
      expect(handler).toHaveBeenCalledTimes(1)

      // Second interval - should skip because first is still running
      await vi.advanceTimersByTimeAsync(100)
      expect(handler).toHaveBeenCalledTimes(1) // Still 1

      // Third interval - should still skip
      await vi.advanceTimersByTimeAsync(100)
      expect(handler).toHaveBeenCalledTimes(1)

      // Resolve first run
      resolveFirstRun!()
      await Promise.resolve() // Let microtasks complete

      // Fourth interval - should now execute again
      await vi.advanceTimersByTimeAsync(100)
      expect(handler).toHaveBeenCalledTimes(2)
    })
  })

  describe('startAll and stopAll', () => {
    it('should start all registered jobs', () => {
      const handler1 = vi.fn().mockResolvedValue(undefined)
      const handler2 = vi.fn().mockResolvedValue(undefined)

      cronManager.register('job-1', 1000, handler1)
      cronManager.register('job-2', 2000, handler2)

      cronManager.startAll()

      expect(cronManager.getStatus('job-1')?.isRunning).toBe(true)
      expect(cronManager.getStatus('job-2')?.isRunning).toBe(true)
    })

    it('should stop all running jobs', async () => {
      const handler1 = vi.fn().mockResolvedValue(undefined)
      const handler2 = vi.fn().mockResolvedValue(undefined)

      cronManager.register('job-1', 1000, handler1)
      cronManager.register('job-2', 500, handler2)

      cronManager.startAll()

      await vi.advanceTimersByTimeAsync(1000)
      expect(handler1).toHaveBeenCalledTimes(1)
      expect(handler2).toHaveBeenCalledTimes(2)

      cronManager.stopAll()

      expect(cronManager.getStatus('job-1')?.isRunning).toBe(false)
      expect(cronManager.getStatus('job-2')?.isRunning).toBe(false)

      await vi.advanceTimersByTimeAsync(2000)
      expect(handler1).toHaveBeenCalledTimes(1) // No more executions
      expect(handler2).toHaveBeenCalledTimes(2) // No more executions
    })
  })

  describe('multiple jobs run independently', () => {
    it('should run multiple jobs at their own intervals', async () => {
      const handler1 = vi.fn().mockResolvedValue(undefined)
      const handler2 = vi.fn().mockResolvedValue(undefined)
      const handler3 = vi.fn().mockResolvedValue(undefined)

      cronManager.register('fast-job', 100, handler1)    // 100ms
      cronManager.register('medium-job', 250, handler2)  // 250ms
      cronManager.register('slow-job', 500, handler3)    // 500ms

      cronManager.startAll()

      // After 500ms:
      // fast-job should have run 5 times (100, 200, 300, 400, 500)
      // medium-job should have run 2 times (250, 500)
      // slow-job should have run 1 time (500)
      await vi.advanceTimersByTimeAsync(500)

      expect(handler1).toHaveBeenCalledTimes(5)
      expect(handler2).toHaveBeenCalledTimes(2)
      expect(handler3).toHaveBeenCalledTimes(1)

      // After another 500ms (1000ms total):
      // fast-job should have run 10 times
      // medium-job should have run 4 times
      // slow-job should have run 2 times
      await vi.advanceTimersByTimeAsync(500)

      expect(handler1).toHaveBeenCalledTimes(10)
      expect(handler2).toHaveBeenCalledTimes(4)
      expect(handler3).toHaveBeenCalledTimes(2)
    })

    it('should allow stopping individual jobs while others continue', async () => {
      const handler1 = vi.fn().mockResolvedValue(undefined)
      const handler2 = vi.fn().mockResolvedValue(undefined)

      cronManager.register('job-1', 100, handler1)
      cronManager.register('job-2', 100, handler2)

      cronManager.startAll()

      await vi.advanceTimersByTimeAsync(200)
      expect(handler1).toHaveBeenCalledTimes(2)
      expect(handler2).toHaveBeenCalledTimes(2)

      cronManager.stop('job-1')

      await vi.advanceTimersByTimeAsync(300)
      expect(handler1).toHaveBeenCalledTimes(2) // Stopped
      expect(handler2).toHaveBeenCalledTimes(5) // Still running
    })
  })

  describe('getStatus and getAllStatus', () => {
    it('should return undefined for non-existent job', () => {
      expect(cronManager.getStatus('non-existent')).toBeUndefined()
    })

    it('should return a copy of job status (not the original)', () => {
      const handler = vi.fn().mockResolvedValue(undefined)

      cronManager.register('test-job', 1000, handler)

      const status1 = cronManager.getStatus('test-job')
      const status2 = cronManager.getStatus('test-job')

      expect(status1).not.toBe(status2)
      expect(status1).toEqual(status2)
    })

    it('should return all job statuses', () => {
      const handler = vi.fn().mockResolvedValue(undefined)

      cronManager.register('job-1', 1000, handler)
      cronManager.register('job-2', 2000, handler)
      cronManager.register('job-3', 3000, handler)

      const allStatuses = cronManager.getAllStatus()

      expect(allStatuses).toHaveLength(3)
      expect(allStatuses.map((s) => s.name)).toEqual(['job-1', 'job-2', 'job-3'])
    })
  })

  describe('unregister', () => {
    it('should remove a job from the manager', () => {
      const handler = vi.fn().mockResolvedValue(undefined)

      cronManager.register('test-job', 1000, handler)
      expect(cronManager.getStatus('test-job')).toBeDefined()

      cronManager.unregister('test-job')
      expect(cronManager.getStatus('test-job')).toBeUndefined()
    })

    it('should stop a running job when unregistering', async () => {
      const handler = vi.fn().mockResolvedValue(undefined)

      cronManager.register('test-job', 1000, handler)
      cronManager.start('test-job')

      await vi.advanceTimersByTimeAsync(1000)
      expect(handler).toHaveBeenCalledTimes(1)

      cronManager.unregister('test-job')

      await vi.advanceTimersByTimeAsync(2000)
      expect(handler).toHaveBeenCalledTimes(1) // No more executions
    })

    it('should not throw when unregistering non-existent job', () => {
      expect(() => {
        cronManager.unregister('non-existent')
      }).not.toThrow()
    })
  })

  describe('clear', () => {
    it('should remove all jobs', () => {
      const handler = vi.fn().mockResolvedValue(undefined)

      cronManager.register('job-1', 1000, handler)
      cronManager.register('job-2', 2000, handler)

      expect(cronManager.getAllStatus()).toHaveLength(2)

      cronManager.clear()

      expect(cronManager.getAllStatus()).toHaveLength(0)
    })

    it('should stop all running jobs when clearing', async () => {
      const handler1 = vi.fn().mockResolvedValue(undefined)
      const handler2 = vi.fn().mockResolvedValue(undefined)

      cronManager.register('job-1', 100, handler1)
      cronManager.register('job-2', 100, handler2)
      cronManager.startAll()

      await vi.advanceTimersByTimeAsync(200)
      expect(handler1).toHaveBeenCalledTimes(2)
      expect(handler2).toHaveBeenCalledTimes(2)

      cronManager.clear()

      await vi.advanceTimersByTimeAsync(500)
      expect(handler1).toHaveBeenCalledTimes(2) // No more
      expect(handler2).toHaveBeenCalledTimes(2) // No more
    })
  })
})
