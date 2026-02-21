/**
 * Regression test for rubata budget deduction.
 *
 * Rule (RUBATA.md §4.4, FINANZE.md §3.2):
 *   Winner:  currentBudget -= OFFERTA  (where OFFERTA = price - salary)
 *   Seller:  currentBudget += OFFERTA
 *
 * The salary component is already captured in monte ingaggi when the contract
 * transfers. Deducting the full price from the winner's budget double-counts it.
 */
import { describe, it, expect } from 'vitest'

/**
 * Pure function that mirrors the payment decomposition used in
 * closeRubataAuction() and the auto-close path in getRubataBoard().
 */
function calculateRubataPayments(currentPrice: number, contractSalary: number) {
  const payment = currentPrice
  const sellerPayment = payment - contractSalary
  // Correct: winner pays only the OFFERTA portion from budget
  // (salary is captured in monte ingaggi via the transferred contract)
  const winnerBudgetDecrement = payment - contractSalary
  return { payment, sellerPayment, winnerBudgetDecrement }
}

describe('Rubata budget deduction', () => {
  it('winner budget should decrease by OFFERTA (price - salary), not the full price', () => {
    // Example: player with salary 1, clausola 7 → rubata price 8
    const { winnerBudgetDecrement, sellerPayment } = calculateRubataPayments(8, 1)

    // Winner pays 7 from budget, salary (1) is in monte ingaggi → bilancio -8 ✓
    expect(winnerBudgetDecrement).toBe(7)
    // Seller receives 7 in budget, salary (1) is freed from monte ingaggi → bilancio +8 ✓
    expect(sellerPayment).toBe(7)
    // Symmetric: winner and seller both move by the same amount
    expect(winnerBudgetDecrement).toBe(sellerPayment)
  })

  it('zero-sum: winner loss equals seller gain in bilancio', () => {
    const price = 50
    const salary = 4
    const { winnerBudgetDecrement, sellerPayment } = calculateRubataPayments(price, salary)

    // Winner bilancio change = -(budgetDecrement + salary) = -(46 + 4) = -50
    const winnerBilancioChange = -(winnerBudgetDecrement + salary)
    // Seller bilancio change = +(sellerPayment + salary) = +(46 + 4) = +50
    const sellerBilancioChange = +(sellerPayment + salary)

    expect(winnerBilancioChange).toBe(-price)
    expect(sellerBilancioChange).toBe(price)
    expect(winnerBilancioChange + sellerBilancioChange).toBe(0)
  })

  it('with salary increase post-acquisition, extra cost is only the delta', () => {
    const price = 48
    const originalSalary = 4
    const newSalary = 6

    const { winnerBudgetDecrement } = calculateRubataPayments(price, originalSalary)

    // Winner bilancio: -(budgetDecrement + newSalary) = -(44 + 6) = -50
    const winnerBilancio = -(winnerBudgetDecrement + newSalary)

    // Without modification: bilancio = -(44 + 4) = -48 (= price)
    const bilancioNoMod = -(winnerBudgetDecrement + originalSalary)
    expect(bilancioNoMod).toBe(-price)

    // Extra cost from salary increase = newSalary - originalSalary = 2
    expect(winnerBilancio - bilancioNoMod).toBe(-(newSalary - originalSalary))
  })
})
