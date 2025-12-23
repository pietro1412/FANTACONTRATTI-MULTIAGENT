import { test, expect } from '@playwright/test'

test.describe('Homepage', () => {
  test('has correct title', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Fantacontratti/)
  })

  test('displays welcome message', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Fantacontratti')).toBeVisible()
    await expect(page.getByText('La piattaforma per il fantacalcio dinastico')).toBeVisible()
  })

  test('shows setup completed badge', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Setup completato!')).toBeVisible()
  })

  test('displays environment info', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Environment:')).toBeVisible()
  })
})
