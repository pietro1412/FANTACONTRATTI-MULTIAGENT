// Render mockup HTML files to PNG for in-chat preview.
// Usage: node scripts/render-mockups.mjs <dir-with-html> [outDir] [widthPx]
import { chromium } from 'playwright'
import { readdirSync, mkdirSync, statSync } from 'node:fs'
import { resolve, join, basename, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'

const target = resolve(process.argv[2] || '.')
const isFile = statSync(target).isFile()
const dir = isFile ? dirname(target) : target
const outDir = resolve(process.argv[3] || join(dir, 'shots'))
const width = Number(process.argv[4] || 1440)
mkdirSync(outDir, { recursive: true })

const htmls = isFile
  ? [basename(target)]
  : readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.html')).sort()
if (htmls.length === 0) {
  console.error('Nessun file .html in', dir)
  process.exit(1)
}

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()

for (const f of htmls) {
  const url = pathToFileURL(join(dir, f)).href
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(800) // fonts/layout settle
  const out = join(outDir, basename(f).replace(/\.html$/i, '.png'))
  await page.screenshot({ path: out, fullPage: true })
  console.log('rendered', f, '->', out)
}

await browser.close()
console.log('DONE outDir:', outDir)
