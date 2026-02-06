import { test, expect } from '@playwright/test'

test.describe('Homepage routing', () => {
  test('has correct title', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Fantacontratti/)
  })

  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 })
  })

  test('displays login page when unauthenticated', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByLabel(/email o username/i)).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: /accedi/i })).toBeVisible()
  })

  test('redirects to dashboard after login', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/email o username/i).fill('pietro@test.it')
    await page.getByLabel(/password/i).fill('Pietro2025!')
    await page.getByRole('button', { name: /accedi/i }).click()
    await expect(page).toHaveURL(/\/(dashboard|leagues)/, { timeout: 15000 })
  })
})
