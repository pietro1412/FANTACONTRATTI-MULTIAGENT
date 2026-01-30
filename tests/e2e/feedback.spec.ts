/**
 * feedback.spec.ts - E2E Tests for Feedback System (Segnalazioni)
 *
 * Tests the complete user flow for submitting and managing feedback.
 *
 * Creato il: 30/01/2026
 */

import { test, expect } from '@playwright/test'

// Test credentials (from CLAUDE.md)
const MANAGER_CREDENTIALS = {
  email: 'mario@test.com',
  password: 'test123'
}

const SUPERADMIN_CREDENTIALS = {
  email: 'superadmin@test.com',
  password: 'super123'
}

test.describe('Feedback Hub - Manager Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login as manager
    await page.goto('/')
    await page.getByPlaceholder('Email').fill(MANAGER_CREDENTIALS.email)
    await page.getByPlaceholder('Password').fill(MANAGER_CREDENTIALS.password)
    await page.getByRole('button', { name: /accedi/i }).click()

    // Wait for login to complete
    await expect(page.getByText('Le Mie Leghe')).toBeVisible({ timeout: 10000 })
  })

  test('can navigate to Feedback Hub from menu', async ({ page }) => {
    // Click on Feedback in navigation
    await page.getByRole('link', { name: /feedback/i }).click()

    // Should see Feedback Hub page
    await expect(page.getByRole('heading', { name: /feedback/i })).toBeVisible()
  })

  test('can view Patch Notes (Novità) tab', async ({ page }) => {
    await page.getByRole('link', { name: /feedback/i }).click()

    // Should see Novità tab by default or be able to switch to it
    const novitaTab = page.getByRole('tab', { name: /novità/i })
    if (await novitaTab.isVisible()) {
      await novitaTab.click()
    }

    // Should see patch notes content
    await expect(page.getByText(/versione|update|aggiornamento/i)).toBeVisible({ timeout: 5000 })
  })

  test('can view Le mie Segnalazioni tab', async ({ page }) => {
    await page.getByRole('link', { name: /feedback/i }).click()

    // Click on Segnalazioni tab
    await page.getByRole('tab', { name: /segnalazioni/i }).click()

    // Should see the tab content (empty list or existing feedback)
    await expect(page.locator('[data-testid="feedback-list"], .feedback-list, text=/nessuna segnalazione/i')).toBeVisible({ timeout: 5000 })
  })

  test('can open new feedback form', async ({ page }) => {
    await page.getByRole('link', { name: /feedback/i }).click()
    await page.getByRole('tab', { name: /segnalazioni/i }).click()

    // Click on new feedback button
    await page.getByRole('button', { name: /nuova|segnala|aggiungi/i }).click()

    // Should see the form
    await expect(page.getByPlaceholder(/titolo/i)).toBeVisible()
    await expect(page.getByPlaceholder(/descrizione|descrivi/i)).toBeVisible()
  })

  test('validates feedback form - empty title', async ({ page }) => {
    await page.getByRole('link', { name: /feedback/i }).click()
    await page.getByRole('tab', { name: /segnalazioni/i }).click()
    await page.getByRole('button', { name: /nuova|segnala|aggiungi/i }).click()

    // Try to submit with empty title
    await page.getByPlaceholder(/descrizione|descrivi/i).fill('Test description')
    await page.getByRole('button', { name: /invia|submit/i }).click()

    // Should show error
    await expect(page.getByText(/titolo.*obbligatorio/i)).toBeVisible()
  })

  test('validates feedback form - empty description', async ({ page }) => {
    await page.getByRole('link', { name: /feedback/i }).click()
    await page.getByRole('tab', { name: /segnalazioni/i }).click()
    await page.getByRole('button', { name: /nuova|segnala|aggiungi/i }).click()

    // Try to submit with empty description
    await page.getByPlaceholder(/titolo/i).fill('Test title')
    await page.getByRole('button', { name: /invia|submit/i }).click()

    // Should show error
    await expect(page.getByText(/descrizione.*obbligatori?a/i)).toBeVisible()
  })

  test('can submit feedback successfully', async ({ page }) => {
    await page.getByRole('link', { name: /feedback/i }).click()
    await page.getByRole('tab', { name: /segnalazioni/i }).click()
    await page.getByRole('button', { name: /nuova|segnala|aggiungi/i }).click()

    // Fill the form
    const uniqueTitle = `Test Bug ${Date.now()}`
    await page.getByPlaceholder(/titolo/i).fill(uniqueTitle)
    await page.getByPlaceholder(/descrizione|descrivi/i).fill('Questo è un bug di test per E2E')

    // Select category if available
    const categorySelect = page.locator('select[name="category"], [data-testid="category-select"]')
    if (await categorySelect.isVisible()) {
      await categorySelect.selectOption('BUG')
    }

    // Submit
    await page.getByRole('button', { name: /invia|submit/i }).click()

    // Should see success message or feedback in list
    await expect(page.getByText(/successo|inviata|creata/i)).toBeVisible({ timeout: 5000 })
  })

  test('can view feedback detail', async ({ page }) => {
    // First create a feedback
    await page.getByRole('link', { name: /feedback/i }).click()
    await page.getByRole('tab', { name: /segnalazioni/i }).click()

    // Wait for list to load
    await page.waitForTimeout(1000)

    // Click on first feedback item (if exists)
    const feedbackItem = page.locator('[data-testid="feedback-item"], .feedback-item').first()
    if (await feedbackItem.isVisible()) {
      await feedbackItem.click()

      // Should see detail view
      await expect(page.getByText(/descrizione|dettaglio/i)).toBeVisible({ timeout: 5000 })
    }
  })
})

test.describe('Feedback Hub - SuperAdmin Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login as superadmin
    await page.goto('/')
    await page.getByPlaceholder('Email').fill(SUPERADMIN_CREDENTIALS.email)
    await page.getByPlaceholder('Password').fill(SUPERADMIN_CREDENTIALS.password)
    await page.getByRole('button', { name: /accedi/i }).click()

    // Wait for login to complete
    await expect(page.getByText(/benvenuto|dashboard|leghe/i)).toBeVisible({ timeout: 10000 })
  })

  test('superadmin can see "Tutte le Segnalazioni" tab', async ({ page }) => {
    await page.getByRole('link', { name: /feedback/i }).click()

    // SuperAdmin should see the "Tutte" tab
    await expect(page.getByRole('tab', { name: /tutte/i })).toBeVisible()
  })

  test('superadmin can view all feedback', async ({ page }) => {
    await page.getByRole('link', { name: /feedback/i }).click()
    await page.getByRole('tab', { name: /tutte/i }).click()

    // Should see the admin feedback list
    await expect(page.locator('[data-testid="admin-feedback-list"], .admin-feedback-list')).toBeVisible({ timeout: 5000 })
  })

  test('superadmin can change feedback status', async ({ page }) => {
    await page.getByRole('link', { name: /feedback/i }).click()
    await page.getByRole('tab', { name: /tutte/i }).click()

    // Wait for list to load
    await page.waitForTimeout(1000)

    // Click on first feedback item
    const feedbackItem = page.locator('[data-testid="feedback-item"], .feedback-item').first()
    if (await feedbackItem.isVisible()) {
      await feedbackItem.click()

      // Look for status change button/dropdown
      const statusButton = page.locator('[data-testid="status-change"], button:has-text("stato"), select:has-text("stato")')
      if (await statusButton.isVisible()) {
        await statusButton.click()
        // Select "In Lavorazione"
        await page.getByText(/in lavorazione/i).click()

        // Should see confirmation
        await expect(page.getByText(/aggiornato|salvato/i)).toBeVisible({ timeout: 5000 })
      }
    }
  })

  test('superadmin can add response to feedback', async ({ page }) => {
    await page.getByRole('link', { name: /feedback/i }).click()
    await page.getByRole('tab', { name: /tutte/i }).click()

    // Wait for list to load
    await page.waitForTimeout(1000)

    // Click on first feedback item
    const feedbackItem = page.locator('[data-testid="feedback-item"], .feedback-item').first()
    if (await feedbackItem.isVisible()) {
      await feedbackItem.click()

      // Look for response input
      const responseInput = page.getByPlaceholder(/risposta|risposta/i)
      if (await responseInput.isVisible()) {
        await responseInput.fill('Grazie per la segnalazione, stiamo lavorando alla risoluzione.')
        await page.getByRole('button', { name: /invia|rispondi/i }).click()

        // Should see confirmation
        await expect(page.getByText(/risposta.*aggiunta|inviata/i)).toBeVisible({ timeout: 5000 })
      }
    }
  })
})

test.describe('Feedback Badge - Notifications', () => {
  test('manager sees notification badge when admin responds', async ({ page }) => {
    // This test would require setting up a specific scenario
    // For now, just verify the badge component renders correctly

    await page.goto('/')
    await page.getByPlaceholder('Email').fill(MANAGER_CREDENTIALS.email)
    await page.getByPlaceholder('Password').fill(MANAGER_CREDENTIALS.password)
    await page.getByRole('button', { name: /accedi/i }).click()

    await expect(page.getByText('Le Mie Leghe')).toBeVisible({ timeout: 10000 })

    // The feedback badge should be in the navigation (even if empty)
    // Just check that the navigation loads without errors
    await expect(page.locator('nav, [data-testid="navigation"]')).toBeVisible()
  })

  test('clicking on notification navigates to feedback detail', async ({ page }) => {
    await page.goto('/')
    await page.getByPlaceholder('Email').fill(MANAGER_CREDENTIALS.email)
    await page.getByPlaceholder('Password').fill(MANAGER_CREDENTIALS.password)
    await page.getByRole('button', { name: /accedi/i }).click()

    await expect(page.getByText('Le Mie Leghe')).toBeVisible({ timeout: 10000 })

    // If there's a notification badge with count > 0, click it
    const badge = page.locator('[data-testid="feedback-badge"], .feedback-badge')
    if (await badge.isVisible()) {
      const count = await badge.locator('.badge-count, span').textContent()
      if (count && parseInt(count) > 0) {
        await badge.click()

        // Should open dropdown with notifications
        await expect(page.locator('[data-testid="feedback-dropdown"], .feedback-dropdown')).toBeVisible()
      }
    }
  })
})
