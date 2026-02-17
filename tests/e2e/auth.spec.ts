import { test, expect } from '@playwright/test'

/**
 * E2E Auth — login, dashboard access, logout
 * Prerequisiti: docker compose up db && DB seedato con init-production.ts
 */
test.describe('Authentication', () => {
  test('login con credenziali valide e accesso dashboard', async ({ page }) => {
    await page.goto('/login')

    // Compila form login (label: "Email o Username", placeholder: "mario@email.com")
    await page.getByLabel(/email o username/i).fill('pietro@test.it')
    await page.getByLabel(/password/i).fill('Pietro2025!')
    await page.getByRole('button', { name: /accedi/i }).click()

    // Attendi redirect a dashboard
    await expect(page).toHaveURL(/\/(dashboard|leagues)/, { timeout: 15000 })

    // Verifica che l'utente sia loggato
    await expect(page.getByText(/Pietro/i).first()).toBeVisible({ timeout: 5000 })
  })

  test('login con credenziali errate mostra errore', async ({ page }) => {
    await page.goto('/login')

    await page.getByLabel(/email o username/i).fill('pietro@test.it')
    await page.getByLabel(/password/i).fill('PasswordSbagliata!')
    await page.getByRole('button', { name: /accedi/i }).click()

    // Messaggio errore visibile (div con classe danger/error)
    await expect(page.locator('.text-danger-400, [role="alert"]').first()).toBeVisible({ timeout: 10000 })
  })

  test('accesso pagina protetta senza login redirecta a login', async ({ page }) => {
    await page.goto('/dashboard')

    // Dovrebbe redirectare a login
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 })
  })
})
