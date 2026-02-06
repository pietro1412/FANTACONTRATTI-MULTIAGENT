/**
 * Contract Calculator Service Tests
 * TDD: Tests written first to define expected behavior
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  ContractCalculator,
  IContractCalculator,
  DURATION_MULTIPLIERS,
  getRescissionBreakdown,
} from '../../domain/services/contract-calculator.service'

describe('ContractCalculator', () => {
  let calculator: IContractCalculator

  beforeEach(() => {
    calculator = new ContractCalculator()
  })

  describe('calculateRescission', () => {
    it('should calculate rescission with multiplier 11 for 4 semesters', () => {
      const salary = 10
      const duration = 4
      const result = calculator.calculateRescission(salary, duration)
      expect(result).toBe(110) // 10 * 11 = 110
    })

    it('should calculate rescission with multiplier 9 for 3 semesters', () => {
      const salary = 10
      const duration = 3
      const result = calculator.calculateRescission(salary, duration)
      expect(result).toBe(90) // 10 * 9 = 90
    })

    it('should calculate rescission with multiplier 7 for 2 semesters', () => {
      const salary = 10
      const duration = 2
      const result = calculator.calculateRescission(salary, duration)
      expect(result).toBe(70) // 10 * 7 = 70
    })

    it('should calculate rescission with multiplier 3 for 1 semester', () => {
      const salary = 10
      const duration = 1
      const result = calculator.calculateRescission(salary, duration)
      expect(result).toBe(30) // 10 * 3 = 30
    })

    it('should use default multiplier 3 for invalid duration', () => {
      const salary = 10
      const duration = 5 // Invalid, should default to 3
      const result = calculator.calculateRescission(salary, duration)
      expect(result).toBe(30) // 10 * 3 = 30
    })

    it('should handle zero salary', () => {
      const result = calculator.calculateRescission(0, 4)
      expect(result).toBe(0)
    })

    it('should handle large salary values', () => {
      const salary = 100
      const duration = 4
      const result = calculator.calculateRescission(salary, duration)
      expect(result).toBe(1100) // 100 * 11 = 1100
    })
  })

  describe('calculateReleaseCost', () => {
    it('should calculate release cost as (salary * duration) / 2', () => {
      const salary = 10
      const duration = 4
      const result = calculator.calculateReleaseCost(salary, duration)
      expect(result).toBe(20) // (10 * 4) / 2 = 20
    })

    it('should round up for odd products', () => {
      const salary = 5
      const duration = 3
      const result = calculator.calculateReleaseCost(salary, duration)
      expect(result).toBe(8) // ceil((5 * 3) / 2) = ceil(7.5) = 8
    })

    it('should handle duration 1', () => {
      const salary = 10
      const duration = 1
      const result = calculator.calculateReleaseCost(salary, duration)
      expect(result).toBe(5) // (10 * 1) / 2 = 5
    })

    it('should handle zero salary', () => {
      const result = calculator.calculateReleaseCost(0, 4)
      expect(result).toBe(0)
    })
  })

  describe('calculateRenewalCost', () => {
    it('should calculate renewal cost as salary * years to add', () => {
      const currentSalary = 10
      const yearsToAdd = 2
      const result = calculator.calculateRenewalCost(currentSalary, yearsToAdd)
      expect(result).toBe(20) // 10 * 2 = 20
    })

    it('should handle single year extension', () => {
      const currentSalary = 15
      const yearsToAdd = 1
      const result = calculator.calculateRenewalCost(currentSalary, yearsToAdd)
      expect(result).toBe(15)
    })

    it('should handle zero years to add', () => {
      const currentSalary = 10
      const yearsToAdd = 0
      const result = calculator.calculateRenewalCost(currentSalary, yearsToAdd)
      expect(result).toBe(0)
    })
  })

  describe('calculateConsolidationBonus', () => {
    it('should calculate consolidation bonus as 50% of salary', () => {
      const salary = 10
      const result = calculator.calculateConsolidationBonus(salary)
      expect(result).toBe(5) // ceil(10 * 0.5) = 5
    })

    it('should round up for odd values', () => {
      const salary = 11
      const result = calculator.calculateConsolidationBonus(salary)
      expect(result).toBe(6) // ceil(11 * 0.5) = ceil(5.5) = 6
    })

    it('should handle zero salary', () => {
      const result = calculator.calculateConsolidationBonus(0)
      expect(result).toBe(0)
    })

    it('should handle large salary', () => {
      const salary = 100
      const result = calculator.calculateConsolidationBonus(salary)
      expect(result).toBe(50)
    })
  })

  describe('DURATION_MULTIPLIERS', () => {
    it('should have correct multiplier values', () => {
      expect(DURATION_MULTIPLIERS[4]).toBe(11)
      expect(DURATION_MULTIPLIERS[3]).toBe(9)
      expect(DURATION_MULTIPLIERS[2]).toBe(7)
      expect(DURATION_MULTIPLIERS[1]).toBe(3)
    })
  })

  describe('getRescissionBreakdown', () => {
    it('should return complete breakdown for duration 4', () => {
      const breakdown = getRescissionBreakdown(10, 4)
      expect(breakdown).toEqual({
        salary: 10,
        duration: 4,
        multiplier: 11,
        totalCost: 110,
      })
    })

    it('should return complete breakdown for duration 2', () => {
      const breakdown = getRescissionBreakdown(20, 2)
      expect(breakdown).toEqual({
        salary: 20,
        duration: 2,
        multiplier: 7,
        totalCost: 140,
      })
    })

    it('should use default multiplier for invalid duration', () => {
      const breakdown = getRescissionBreakdown(10, 10)
      expect(breakdown).toEqual({
        salary: 10,
        duration: 10,
        multiplier: 3,
        totalCost: 30,
      })
    })
  })
})
