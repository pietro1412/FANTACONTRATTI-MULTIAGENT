/**
 * Bcrypt Password Service Tests
 *
 * Tests for the BcryptPasswordService implementation.
 */

import { describe, it, expect } from 'vitest'
import { BcryptPasswordService } from '../services/bcrypt-password.service'

describe('BcryptPasswordService', () => {
  const service = new BcryptPasswordService()

  describe('hash', () => {
    it('should hash a password', async () => {
      const password = 'mySecurePassword123'
      const hash = await service.hash(password)

      expect(hash).toBeDefined()
      expect(hash).not.toBe(password)
      expect(hash.length).toBeGreaterThan(0)
    })

    it('should generate different hashes for same password', async () => {
      const password = 'samePassword'
      const hash1 = await service.hash(password)
      const hash2 = await service.hash(password)

      expect(hash1).not.toBe(hash2)
    })
  })

  describe('verify', () => {
    it('should return true for correct password', async () => {
      const password = 'correctPassword123'
      const hash = await service.hash(password)

      const result = await service.verify(password, hash)

      expect(result).toBe(true)
    })

    it('should return false for incorrect password', async () => {
      const password = 'correctPassword123'
      const wrongPassword = 'wrongPassword456'
      const hash = await service.hash(password)

      const result = await service.verify(wrongPassword, hash)

      expect(result).toBe(false)
    })

    it('should return false for empty password', async () => {
      const hash = await service.hash('somePassword')

      const result = await service.verify('', hash)

      expect(result).toBe(false)
    })
  })
})
