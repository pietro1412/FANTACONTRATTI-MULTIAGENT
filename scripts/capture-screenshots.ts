/**
 * Screenshot Capture Script
 *
 * Captures screenshots of all pages in the Fantacontratti platform
 * at 3 viewports: Desktop (1920x1080), Tablet (768x1024), Mobile (375x812).
 *
 * Prerequisites:
 *   - Dev server running: npm run dev
 *   - DB populated with test data
 *
 * Usage:
 *   npx tsx scripts/capture-screenshots.ts
 */

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const SCREENSHOT_DIR = path.resolve(__dirname, '..', 'screenshots');
const TIMEOUT = 15_000; // navigation timeout per page

const VIEWPORTS = {
  desktop: { width: 1920, height: 1080 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 812 },
} as const;

type ViewportName = keyof typeof VIEWPORTS;

const CREDENTIALS = {
  admin: { email: 'pietro@test.it', password: 'Pietro2025!' },
  manager: { email: 'mirko@test.it', password: 'Mirko2025!' },
  superadmin: { email: 'admin@fantacontratti.it', password: 'SuperAdmin2025!' },
};

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

interface Stats {
  success: number;
  skipped: number;
  failed: string[];
}

const stats: Stats = { success: 0, skipped: 0, failed: [] };

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

async function waitForPageReady(page: Page): Promise<void> {
  try {
    await page.waitForLoadState('networkidle', { timeout: TIMEOUT });
  } catch {
    // networkidle can sometimes timeout — continue anyway
  }

  // Wait for spinners to disappear
  try {
    await page.waitForFunction(
      () => document.querySelectorAll('.animate-spin').length === 0,
      { timeout: 5_000 },
    );
  } catch {
    // Spinner might not exist — that's fine
  }

  // Small buffer for any remaining transitions
  await page.waitForTimeout(600);
}

/** Stores the last captured leagueId from the /api/leagues response after login */
let lastCapturedLeagueId: string | null = null;

async function login(page: Page, email: string, password: string): Promise<boolean> {
  lastCapturedLeagueId = null;

  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: TIMEOUT });
    await page.waitForTimeout(500);

    // Fill login form using labels
    await page.getByLabel('Email o Username').fill(email);
    await page.getByLabel('Password').fill(password);

    // Listen for the login API response AND the /api/leagues response that fires after dashboard loads
    const loginResponsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/auth/login') && resp.request().method() === 'POST',
      { timeout: TIMEOUT },
    );

    // Also listen for the leagues API call (fired when dashboard mounts after login)
    const leaguesResponsePromise = page.waitForResponse(
      (resp) => {
        const url = resp.url();
        return url.includes('/api/leagues') && !url.includes('/api/leagues/') && resp.request().method() === 'GET';
      },
      { timeout: TIMEOUT },
    ).catch(() => null); // Don't fail if superadmin redirects to /superadmin instead

    await page.getByRole('button', { name: 'Accedi' }).click();

    const loginResponse = await loginResponsePromise;
    const status = loginResponse.status();
    if (status !== 200) {
      const body = await loginResponse.text().catch(() => '');
      console.error(`  [LOGIN FAILED] ${email}: API returned ${status} — ${body.slice(0, 200)}`);
      return false;
    }

    // Wait for the SPA to navigate away from /login
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: TIMEOUT });
    await waitForPageReady(page);
    console.log(`  [LOGGED IN] ${email} → ${page.url()}`);

    // Try to capture leagueId from the leagues response
    const leaguesResponse = await leaguesResponsePromise;
    if (leaguesResponse && leaguesResponse.ok()) {
      try {
        const json = await leaguesResponse.json();
        const leagues = json.data || json.leagues || json;
        if (Array.isArray(leagues) && leagues.length > 0) {
          lastCapturedLeagueId = leagues[0].league?.id || leagues[0].id;
        }
      } catch { /* response body may already be consumed */ }
    }

    return true;
  } catch (err) {
    const currentUrl = page.url();
    console.error(`  [LOGIN FAILED] ${email}: ${(err as Error).message.split('\n')[0]}`);
    console.error(`    Current URL: ${currentUrl}`);
    try {
      const errorText = await page.locator('.text-danger-400, .bg-danger-500\\/20').textContent({ timeout: 2_000 });
      if (errorText) console.error(`    Page error: ${errorText}`);
    } catch { /* no error message visible */ }
    return false;
  }
}

async function logout(page: Page, context: BrowserContext): Promise<void> {
  await context.clearCookies();
  await page.evaluate(() => localStorage.clear());
}

async function navigateAndCapture(
  page: Page,
  url: string,
  viewportName: ViewportName,
  screenshotName: string,
): Promise<boolean> {
  const dir = path.join(SCREENSHOT_DIR, viewportName);
  const filePath = path.join(dir, `${screenshotName}.png`);

  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });

    // Check if we were redirected to login (session expired / unauthorized)
    if (page.url().includes('/login') && !url.includes('/login')) {
      console.warn(`  [SKIP] ${screenshotName} — redirected to /login`);
      stats.skipped++;
      return false;
    }

    await waitForPageReady(page);

    // Disable CSS animations for consistent screenshots
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
        }
      `,
    });

    await page.waitForTimeout(300);

    await page.screenshot({ path: filePath, fullPage: true });
    console.log(`  [OK] ${screenshotName}`);
    stats.success++;
    return true;
  } catch (err) {
    const msg = (err as Error).message.split('\n')[0];
    console.error(`  [FAIL] ${screenshotName} — ${msg}`);
    stats.failed.push(`${viewportName}/${screenshotName}`);
    return false;
  }
}

function extractLeagueId(): string | null {
  return lastCapturedLeagueId;
}

// ---------------------------------------------------------------------------
// Page Definitions
// ---------------------------------------------------------------------------

interface PageDef {
  name: string;
  url: string | ((leagueId: string) => string);
}

const PUBLIC_PAGES: PageDef[] = [
  { name: 'login', url: '/login' },
  { name: 'register', url: '/register' },
  { name: 'forgot-password', url: '/forgot-password' },
  { name: 'rules', url: '/rules' },
];

const ADMIN_PAGES = (leagueId: string): PageDef[] => [
  { name: 'dashboard', url: '/dashboard' },
  { name: 'league-detail', url: `/leagues/${leagueId}` },
  // Admin panel tabs
  { name: 'admin-phases', url: `/leagues/${leagueId}/admin?tab=phases` },
  { name: 'admin-members', url: `/leagues/${leagueId}/admin?tab=members` },
  { name: 'admin-requests', url: `/leagues/${leagueId}/admin?tab=requests` },
  { name: 'admin-export', url: `/leagues/${leagueId}/admin?tab=export` },
  // League pages
  { name: 'rose', url: `/leagues/${leagueId}/rose` },
  { name: 'contracts', url: `/leagues/${leagueId}/contracts` },
  { name: 'players', url: `/leagues/${leagueId}/players` },
  { name: 'trades', url: `/leagues/${leagueId}/trades` },
  { name: 'svincolati', url: `/leagues/${leagueId}/svincolati` },
  { name: 'rubata', url: `/leagues/${leagueId}/rubata` },
  { name: 'strategie-rubata', url: `/leagues/${leagueId}/strategie-rubata` },
  { name: 'manager', url: `/leagues/${leagueId}/manager` },
  { name: 'indemnity', url: `/leagues/${leagueId}/indemnity` },
  { name: 'movements', url: `/leagues/${leagueId}/movements` },
  { name: 'history', url: `/leagues/${leagueId}/history` },
  { name: 'prophecies', url: `/leagues/${leagueId}/prophecies` },
  { name: 'stats', url: `/leagues/${leagueId}/stats` },
  { name: 'financials', url: `/leagues/${leagueId}/financials` },
  { name: 'prizes', url: `/leagues/${leagueId}/prizes` },
  { name: 'patch-notes', url: `/leagues/${leagueId}/patch-notes` },
  { name: 'feedback', url: `/leagues/${leagueId}/feedback` },
  { name: 'profile', url: '/profile' },
];

const MANAGER_PAGES = (leagueId: string): PageDef[] => [
  { name: 'dashboard-manager', url: '/dashboard' },
  { name: 'manager-dashboard-user', url: `/leagues/${leagueId}/manager` },
];

const SUPERADMIN_PAGES: PageDef[] = [
  { name: 'superadmin-upload', url: '/superadmin?tab=upload' },
  { name: 'superadmin-players', url: '/superadmin?tab=players' },
  { name: 'superadmin-leagues', url: '/superadmin?tab=leagues' },
  { name: 'superadmin-users', url: '/superadmin?tab=users' },
];

// ---------------------------------------------------------------------------
// Capture Flows
// ---------------------------------------------------------------------------

async function capturePublicPages(page: Page, viewportName: ViewportName): Promise<void> {
  console.log(`\n  --- Public pages ---`);
  for (const pageDef of PUBLIC_PAGES) {
    const url = typeof pageDef.url === 'string' ? pageDef.url : pageDef.url('');
    await navigateAndCapture(page, `${BASE_URL}${url}`, viewportName, pageDef.name);
  }
}

async function captureAdminPages(
  page: Page,
  context: BrowserContext,
  viewportName: ViewportName,
): Promise<void> {
  console.log(`\n  --- Admin pages (${CREDENTIALS.admin.email}) ---`);
  const loggedIn = await login(page, CREDENTIALS.admin.email, CREDENTIALS.admin.password);
  if (!loggedIn) {
    console.error('  [SKIP ALL] Admin login failed');
    stats.skipped += ADMIN_PAGES('').length;
    return;
  }

  const leagueId = extractLeagueId();
  if (!leagueId) {
    console.error('  [SKIP ALL] Could not extract leagueId');
    stats.skipped += ADMIN_PAGES('').length;
    await logout(page, context);
    return;
  }
  console.log(`  League ID: ${leagueId}`);

  for (const pageDef of ADMIN_PAGES(leagueId)) {
    const url = typeof pageDef.url === 'string' ? pageDef.url : pageDef.url(leagueId);
    await navigateAndCapture(page, `${BASE_URL}${url}`, viewportName, pageDef.name);
  }

  // Try auction room if there's an active session
  try {
    const sessionId = await page.evaluate(async () => {
      const res = await fetch('/api/auction/sessions?status=active', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const sessions = data.data || data.sessions || data;
        if (Array.isArray(sessions) && sessions.length > 0) return sessions[0].id;
      }
      return null;
    });
    if (sessionId) {
      await navigateAndCapture(
        page,
        `${BASE_URL}/leagues/${leagueId}/auction/${sessionId}`,
        viewportName,
        'auction-room',
      );
    } else {
      console.log('  [INFO] No active auction session — skipping auction-room');
    }
  } catch {
    console.log('  [INFO] Could not check auction sessions — skipping auction-room');
  }

  await logout(page, context);
}

async function captureManagerPages(
  page: Page,
  context: BrowserContext,
  viewportName: ViewportName,
): Promise<void> {
  console.log(`\n  --- Manager pages (${CREDENTIALS.manager.email}) ---`);
  const loggedIn = await login(page, CREDENTIALS.manager.email, CREDENTIALS.manager.password);
  if (!loggedIn) {
    console.error('  [SKIP ALL] Manager login failed');
    stats.skipped += 2;
    return;
  }

  const leagueId = extractLeagueId();
  if (!leagueId) {
    console.error('  [SKIP ALL] Could not extract leagueId for manager');
    stats.skipped += 2;
    await logout(page, context);
    return;
  }

  for (const pageDef of MANAGER_PAGES(leagueId)) {
    const url = typeof pageDef.url === 'string' ? pageDef.url : pageDef.url(leagueId);
    await navigateAndCapture(page, `${BASE_URL}${url}`, viewportName, pageDef.name);
  }

  await logout(page, context);
}

async function captureSuperAdminPages(
  page: Page,
  context: BrowserContext,
  viewportName: ViewportName,
): Promise<void> {
  console.log(`\n  --- Super Admin pages (${CREDENTIALS.superadmin.email}) ---`);
  const loggedIn = await login(
    page,
    CREDENTIALS.superadmin.email,
    CREDENTIALS.superadmin.password,
  );
  if (!loggedIn) {
    console.error('  [SKIP ALL] Super admin login failed');
    stats.skipped += SUPERADMIN_PAGES.length;
    return;
  }

  for (const pageDef of SUPERADMIN_PAGES) {
    const url = typeof pageDef.url === 'string' ? pageDef.url : pageDef.url('');
    await navigateAndCapture(page, `${BASE_URL}${url}`, viewportName, pageDef.name);
  }

  await logout(page, context);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('=== Fantacontratti Screenshot Capture ===\n');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Output:   ${SCREENSHOT_DIR}`);

  // Create output directories
  for (const vp of Object.keys(VIEWPORTS) as ViewportName[]) {
    const dir = path.join(SCREENSHOT_DIR, vp);
    fs.mkdirSync(dir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });

  try {
    for (const [vpName, vpSize] of Object.entries(VIEWPORTS) as [ViewportName, typeof VIEWPORTS[ViewportName]][]) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`VIEWPORT: ${vpName.toUpperCase()} (${vpSize.width}x${vpSize.height})`);
      console.log('='.repeat(60));

      const context = await browser.newContext({
        viewport: vpSize,
        deviceScaleFactor: 1,
        locale: 'it-IT',
        ignoreHTTPSErrors: true,
      });
      const page = await context.newPage();
      page.setDefaultTimeout(TIMEOUT);

      // 1. Public pages (no login)
      await capturePublicPages(page, vpName);

      // 2. Admin pages
      await captureAdminPages(page, context, vpName);

      // 3. Manager pages
      await captureManagerPages(page, context, vpName);

      // 4. Super Admin pages
      await captureSuperAdminPages(page, context, vpName);

      await context.close();
    }
  } finally {
    await browser.close();
  }

  // ---------------------------------------------------------------------------
  // Report
  // ---------------------------------------------------------------------------
  console.log(`\n${'='.repeat(60)}`);
  console.log('REPORT');
  console.log('='.repeat(60));
  console.log(`  Success: ${stats.success}`);
  console.log(`  Skipped: ${stats.skipped}`);
  console.log(`  Failed:  ${stats.failed.length}`);
  if (stats.failed.length > 0) {
    console.log('  Failed pages:');
    for (const f of stats.failed) {
      console.log(`    - ${f}`);
    }
  }
  console.log(`\nScreenshots saved to: ${SCREENSHOT_DIR}`);

  // Exit with error code if there were failures
  if (stats.failed.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(2);
});
