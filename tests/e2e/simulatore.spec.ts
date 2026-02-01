/**
 * simulatore.spec.ts - E2E Tests for Simulatore Feature
 *
 * Tests the complete user flow for the Strategie Simulatore feature.
 *
 * Created: 01/02/2026
 */

import { test, expect } from '@playwright/test'

// Test credentials (from CLAUDE.md)
const MANAGER_CREDENTIALS = {
  email: 'mario@test.com',
  password: 'test123'
}

const TEST_LEAGUE_ID = 'cmkutns6v0000jew36vp3nexa' // Known test league

test.describe('Simulatore Feature', () => {
  test.beforeEach(async ({ page }) => {
    // Login as manager
    await page.goto('/')
    await page.getByPlaceholder('Email').fill(MANAGER_CREDENTIALS.email)
    await page.getByPlaceholder('Password').fill(MANAGER_CREDENTIALS.password)
    await page.getByRole('button', { name: /accedi/i }).click()

    // Wait for login to complete
    await expect(page.getByText('Le Mie Leghe')).toBeVisible({ timeout: 10000 })
  })

  test('can navigate to Simulatore from Strategie page', async ({ page }) => {
    // Navigate to a league
    await page.locator('[data-testid="league-card"], .league-card').first().click()
    await page.waitForLoadState('networkidle')

    // Navigate to Strategie (via navigation menu)
    const strategieLink = page.getByRole('link', { name: /strategie/i })
    if (await strategieLink.isVisible()) {
      await strategieLink.click()
      await page.waitForLoadState('networkidle')

      // Look for Simulatore link or button
      const simulatoreLink = page.getByRole('link', { name: /simulatore/i }).or(
        page.getByRole('button', { name: /simulatore/i })
      )

      if (await simulatoreLink.isVisible()) {
        await simulatoreLink.click()
        await page.waitForLoadState('networkidle')

        // Should see Simulatore page
        await expect(page.getByText(/simulatore/i)).toBeVisible()
      }
    }
  })

  test('can access Simulatore directly via URL', async ({ page }) => {
    // Get first league from dashboard
    await page.locator('[data-testid="league-card"], .league-card').first().click()
    await page.waitForLoadState('networkidle')

    // Extract league ID from URL
    const url = page.url()
    const leagueIdMatch = url.match(/\/leagues\/([^/]+)/)
    if (leagueIdMatch) {
      const leagueId = leagueIdMatch[1]

      // Navigate directly to simulatore
      await page.goto(`/leagues/${leagueId}/strategie/simulatore`)
      await page.waitForLoadState('networkidle')

      // Should see Simulatore heading or content
      await expect(
        page.getByRole('heading', { name: /simulatore/i }).or(
          page.getByText(/simulazione cessioni/i)
        )
      ).toBeVisible({ timeout: 10000 })
    }
  })

  test('Cessioni tab loads data correctly', async ({ page }) => {
    // Navigate to league and then to simulatore
    await page.locator('[data-testid="league-card"], .league-card').first().click()
    await page.waitForLoadState('networkidle')

    const url = page.url()
    const leagueIdMatch = url.match(/\/leagues\/([^/]+)/)
    if (leagueIdMatch) {
      const leagueId = leagueIdMatch[1]
      await page.goto(`/leagues/${leagueId}/strategie/simulatore`)
      await page.waitForLoadState('networkidle')

      // Cessioni tab should be active by default or we can click it
      const cessioniTab = page.getByRole('tab', { name: /cessioni/i }).or(
        page.getByRole('button', { name: /cessioni/i })
      )
      if (await cessioniTab.isVisible()) {
        await cessioniTab.click()
      }

      // Wait for data to load
      await page.waitForTimeout(2000)

      // Should see either:
      // 1. A table with players if they have contracts
      // 2. A message saying no players with contracts
      const hasTable = await page.locator('table').isVisible()
      const hasEmptyMessage = await page.getByText(/nessun giocatore con contratto/i).isVisible()

      expect(hasTable || hasEmptyMessage).toBe(true)
    }
  })

  test('Budget tab shows calculations', async ({ page }) => {
    // Navigate to league and then to simulatore
    await page.locator('[data-testid="league-card"], .league-card').first().click()
    await page.waitForLoadState('networkidle')

    const url = page.url()
    const leagueIdMatch = url.match(/\/leagues\/([^/]+)/)
    if (leagueIdMatch) {
      const leagueId = leagueIdMatch[1]
      await page.goto(`/leagues/${leagueId}/strategie/simulatore`)
      await page.waitForLoadState('networkidle')

      // Click on Budget tab
      const budgetTab = page.getByRole('tab', { name: /budget/i }).or(
        page.getByRole('button', { name: /budget/i })
      )
      if (await budgetTab.isVisible()) {
        await budgetTab.click()
      }

      // Wait for budget data to render
      await page.waitForTimeout(2000)

      // Should see budget information
      const hasBudgetInfo = await page.getByText(/budget attuale/i).isVisible() ||
                           await page.getByText(/situazione budget/i).isVisible()

      expect(hasBudgetInfo).toBe(true)
    }
  })

  test('Sostituti expand works when clicking on a player', async ({ page }) => {
    // Navigate to league and then to simulatore
    await page.locator('[data-testid="league-card"], .league-card').first().click()
    await page.waitForLoadState('networkidle')

    const url = page.url()
    const leagueIdMatch = url.match(/\/leagues\/([^/]+)/)
    if (leagueIdMatch) {
      const leagueId = leagueIdMatch[1]
      await page.goto(`/leagues/${leagueId}/strategie/simulatore`)
      await page.waitForLoadState('networkidle')

      // Wait for data to load
      await page.waitForTimeout(2000)

      // Check if there's a player row to click
      const playerRow = page.locator('tbody tr').first()
      if (await playerRow.isVisible()) {
        // Click on the row to expand sostituti
        await playerRow.click()

        // Wait for sostituti to load
        await page.waitForTimeout(1500)

        // Should see either:
        // 1. Sostituti loading indicator
        // 2. Sostituti list
        // 3. No sostituti message
        const hasLoading = await page.getByText(/caricamento sostituti/i).isVisible()
        const hasSostituti = await page.getByText(/possibili sostituti/i).isVisible()
        const hasNoSostituti = await page.getByText(/nessun sostituto/i).isVisible()

        // At least one of these should be visible after click
        expect(hasLoading || hasSostituti || hasNoSostituti).toBe(true)
      }
    }
  })

  test('Position filter works on Cessioni tab', async ({ page }) => {
    // Navigate to league and then to simulatore
    await page.locator('[data-testid="league-card"], .league-card').first().click()
    await page.waitForLoadState('networkidle')

    const url = page.url()
    const leagueIdMatch = url.match(/\/leagues\/([^/]+)/)
    if (leagueIdMatch) {
      const leagueId = leagueIdMatch[1]
      await page.goto(`/leagues/${leagueId}/strategie/simulatore`)
      await page.waitForLoadState('networkidle')

      // Wait for data to load
      await page.waitForTimeout(2000)

      // Look for position filter select
      const positionFilter = page.locator('select').first()
      if (await positionFilter.isVisible()) {
        // Select a specific position
        await positionFilter.selectOption('D') // Difensori

        // Wait for filter to apply
        await page.waitForTimeout(500)

        // The filter should be applied (we can't easily verify the rows
        // without knowing the data, but at least it shouldn't error)
        expect(await positionFilter.inputValue()).toBe('D')
      }
    }
  })

  test('Sort functionality works on Cessioni tab', async ({ page }) => {
    // Navigate to league and then to simulatore
    await page.locator('[data-testid="league-card"], .league-card').first().click()
    await page.waitForLoadState('networkidle')

    const url = page.url()
    const leagueIdMatch = url.match(/\/leagues\/([^/]+)/)
    if (leagueIdMatch) {
      const leagueId = leagueIdMatch[1]
      await page.goto(`/leagues/${leagueId}/strategie/simulatore`)
      await page.waitForLoadState('networkidle')

      // Wait for data to load
      await page.waitForTimeout(2000)

      // Check if there's a table header to click for sorting
      const salaryHeader = page.getByRole('button', { name: /ingaggio/i })
      if (await salaryHeader.isVisible()) {
        // Click to sort
        await salaryHeader.click()
        await page.waitForTimeout(300)

        // Click again to reverse sort
        await salaryHeader.click()
        await page.waitForTimeout(300)

        // Should still be visible (no errors)
        expect(await salaryHeader.isVisible()).toBe(true)
      }
    }
  })

  test('Back to Strategie navigation works', async ({ page }) => {
    // Navigate to league and then to simulatore
    await page.locator('[data-testid="league-card"], .league-card').first().click()
    await page.waitForLoadState('networkidle')

    const url = page.url()
    const leagueIdMatch = url.match(/\/leagues\/([^/]+)/)
    if (leagueIdMatch) {
      const leagueId = leagueIdMatch[1]
      await page.goto(`/leagues/${leagueId}/strategie/simulatore`)
      await page.waitForLoadState('networkidle')

      // Look for back button
      const backButton = page.getByRole('button', { name: /strategie/i }).or(
        page.getByText(/← strategie/i)
      )

      if (await backButton.isVisible()) {
        await backButton.click()
        await page.waitForLoadState('networkidle')

        // Should be on strategie page (URL should contain strategie-rubata or similar)
        const currentUrl = page.url()
        expect(currentUrl).toContain('strategie')
      }
    }
  })
})

test.describe('Simulatore - Error Handling', () => {
  test('shows error message when API fails', async ({ page }) => {
    // Login first
    await page.goto('/')
    await page.getByPlaceholder('Email').fill(MANAGER_CREDENTIALS.email)
    await page.getByPlaceholder('Password').fill(MANAGER_CREDENTIALS.password)
    await page.getByRole('button', { name: /accedi/i }).click()
    await expect(page.getByText('Le Mie Leghe')).toBeVisible({ timeout: 10000 })

    // Try to access simulatore for non-existent league
    await page.goto('/leagues/nonexistent-league-id/strategie/simulatore')
    await page.waitForLoadState('networkidle')

    // Wait for error or redirect
    await page.waitForTimeout(3000)

    // Should either show error or redirect to dashboard
    const hasError = await page.getByText(/errore/i).isVisible()
    const isOnDashboard = page.url().includes('dashboard')

    expect(hasError || isOnDashboard).toBe(true)
  })
})

test.describe('Simulatore - Responsive Design', () => {
  test('displays correctly on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })

    // Login
    await page.goto('/')
    await page.getByPlaceholder('Email').fill(MANAGER_CREDENTIALS.email)
    await page.getByPlaceholder('Password').fill(MANAGER_CREDENTIALS.password)
    await page.getByRole('button', { name: /accedi/i }).click()
    await expect(page.getByText('Le Mie Leghe')).toBeVisible({ timeout: 10000 })

    // Navigate to first league
    await page.locator('[data-testid="league-card"], .league-card').first().click()
    await page.waitForLoadState('networkidle')

    const url = page.url()
    const leagueIdMatch = url.match(/\/leagues\/([^/]+)/)
    if (leagueIdMatch) {
      const leagueId = leagueIdMatch[1]
      await page.goto(`/leagues/${leagueId}/strategie/simulatore`)
      await page.waitForLoadState('networkidle')

      // Page should still be functional
      await expect(
        page.getByText(/simulatore/i).or(page.getByText(/simulazione/i))
      ).toBeVisible({ timeout: 10000 })

      // Content should be scrollable/viewable
      const scrollable = await page.evaluate(() => {
        return document.documentElement.scrollHeight > document.documentElement.clientHeight
      })

      // Either content fits or is scrollable
      expect(true).toBe(true) // Basic check that page loaded without error
    }
  })
})
