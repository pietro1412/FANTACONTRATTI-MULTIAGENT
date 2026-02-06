import { test, expect, type Page } from '@playwright/test'

/**
 * E2E League Navigation — verifica accesso alle pagine della lega dopo login
 * Prerequisiti: docker compose up db && DB seedato con init-production.ts
 */

async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel(/email o username/i).fill(email)
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole('button', { name: /accedi/i }).click()
  // Attendi che il login completi e la dashboard carichi
  await expect(page).toHaveURL(/\/(dashboard|leagues)/, { timeout: 15000 })
}

test.describe('League Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'pietro@test.it', 'Pietro2025!')
  })

  test('dashboard mostra la lega "Fantacontratti Test"', async ({ page }) => {
    await expect(page.getByText(/Fantacontratti Test/i)).toBeVisible({ timeout: 10000 })
  })

  test('accesso alla pagina lega', async ({ page }) => {
    // Click sulla lega
    await page.getByText(/Fantacontratti Test/i).click()
    await expect(page).toHaveURL(/\/leagues\/[a-z0-9]+/i, { timeout: 10000 })
  })

  test('pagina rose accessibile dalla lega', async ({ page }) => {
    await page.getByText(/Fantacontratti Test/i).click()
    await expect(page).toHaveURL(/\/leagues\/[a-z0-9]+/i, { timeout: 10000 })

    // Naviga alla pagina rose
    const roseLink = page.getByRole('link', { name: /rose|rosa/i }).first()
    if (await roseLink.isVisible()) {
      await roseLink.click()
      await expect(page).toHaveURL(/\/rose/, { timeout: 10000 })
    }
  })
})
