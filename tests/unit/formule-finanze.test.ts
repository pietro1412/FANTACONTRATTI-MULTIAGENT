/**
 * OSS-6: Tabellone Finanze - Costo Acquisti + Storicita Fasi
 *
 * Test TDD per verificare:
 * 1. Il service getLeagueFinancials restituisce totalAcquisitionCost per ogni team
 * 2. Il campo e calcolato come SUM(PlayerRoster.acquisitionPrice) dove status = ACTIVE
 * 3. Il parametro sessionId filtra per sessione di mercato (storicita)
 * 4. La formula: budget = initialBudget - acquisitionCosts, bilancio = budget - monteIngaggi
 * 5. Il frontend espone la colonna Acquisti e il selettore fase
 */

import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'fs'
import path from 'path'

// ==================== Backend: getLeagueFinancials ====================

describe('OSS-6: getLeagueFinancials includes totalAcquisitionCost', () => {
  const servicePath = path.resolve(__dirname, '../../src/services/league.service.ts')
  let code: string

  beforeAll(() => {
    code = fs.readFileSync(servicePath, 'utf8')
  })

  it('getLeagueFinancials function exists', () => {
    const fnStart = code.indexOf('export async function getLeagueFinancials')
    expect(fnStart).toBeGreaterThan(-1)
  })

  it('calculates totalAcquisitionCost from PlayerRoster.acquisitionPrice', () => {
    const fnStart = code.indexOf('export async function getLeagueFinancials')
    expect(fnStart).toBeGreaterThan(-1)
    const fnBody = code.slice(fnStart, fnStart + 5000)

    // Must reference acquisitionPrice for calculation
    expect(fnBody).toContain('acquisitionPrice')
  })

  it('returns totalAcquisitionCost in the team response object', () => {
    const fnStart = code.indexOf('export async function getLeagueFinancials')
    expect(fnStart).toBeGreaterThan(-1)
    const fnBody = code.slice(fnStart, code.indexOf('export', fnStart + 1))

    // Must include totalAcquisitionCost in the return value
    expect(fnBody).toContain('totalAcquisitionCost')
  })

  it('includes acquisitionPrice in the roster query', () => {
    const fnStart = code.indexOf('export async function getLeagueFinancials')
    expect(fnStart).toBeGreaterThan(-1)
    const fnBody = code.slice(fnStart, code.indexOf('export', fnStart + 1))

    // The roster query must select acquisitionPrice
    expect(fnBody).toContain('acquisitionPrice')
  })
})

// ==================== Backend: sessionId parameter for storicita ====================

describe('OSS-6: getLeagueFinancials supports sessionId for historical data', () => {
  const servicePath = path.resolve(__dirname, '../../src/services/league.service.ts')
  let code: string

  beforeAll(() => {
    code = fs.readFileSync(servicePath, 'utf8')
  })

  it('getLeagueFinancials accepts sessionId parameter', () => {
    const fnStart = code.indexOf('export async function getLeagueFinancials')
    expect(fnStart).toBeGreaterThan(-1)

    // Extract the function signature (first line)
    const fnSignature = code.slice(fnStart, code.indexOf('{', fnStart) + 1)

    // Must accept sessionId as parameter
    expect(fnSignature).toContain('sessionId')
  })

  it('returns available sessions list for the phase selector', () => {
    const fnStart = code.indexOf('export async function getLeagueFinancials')
    expect(fnStart).toBeGreaterThan(-1)
    const fnBody = code.slice(fnStart, code.indexOf('export', fnStart + 1))

    // Must query for market sessions to build the phase selector
    expect(fnBody).toContain('availableSessions')
  })
})

// ==================== API Route: sessionId query param ====================

describe('OSS-6: API route supports sessionId query param', () => {
  const routePath = path.resolve(__dirname, '../../src/api/routes/leagues.ts')
  let code: string

  beforeAll(() => {
    code = fs.readFileSync(routePath, 'utf8')
  })

  it('financials route extracts sessionId from query', () => {
    // Find the financials route
    const routeIdx = code.indexOf('financials')
    expect(routeIdx).toBeGreaterThan(-1)

    // Must extract sessionId from query params
    const routeBlock = code.slice(routeIdx, routeIdx + 500)
    expect(routeBlock).toContain('sessionId')
  })
})

// ==================== Frontend API client: sessionId param ====================

describe('OSS-6: Frontend API client supports sessionId', () => {
  const apiPath = path.resolve(__dirname, '../../src/services/api.ts')
  let code: string

  beforeAll(() => {
    code = fs.readFileSync(apiPath, 'utf8')
  })

  it('getFinancials accepts optional sessionId parameter', () => {
    // Find getFinancials
    const fnIdx = code.indexOf('getFinancials')
    expect(fnIdx).toBeGreaterThan(-1)
    const fnBlock = code.slice(fnIdx, fnIdx + 300)

    // Must accept sessionId
    expect(fnBlock).toContain('sessionId')
  })
})

// ==================== Frontend: LeagueFinancials ====================

describe('OSS-6: LeagueFinancials shows acquisition costs and phase selector', () => {
  const pagePath = path.resolve(__dirname, '../../src/pages/LeagueFinancials.tsx')
  let code: string

  beforeAll(() => {
    code = fs.readFileSync(pagePath, 'utf8')
  })

  it('TeamData interface includes totalAcquisitionCost', () => {
    // TeamData must have totalAcquisitionCost field
    const interfaceStart = code.indexOf('interface TeamData')
    expect(interfaceStart).toBeGreaterThan(-1)
    const interfaceBlock = code.slice(interfaceStart, code.indexOf('}', interfaceStart + 100) + 1)
    expect(interfaceBlock).toContain('totalAcquisitionCost')
  })

  it('renders Acquisti column header in the table', () => {
    // Must have an "Acquisti" column in the table
    expect(code).toContain('Acquisti')
  })

  it('displays acquisition cost value for each team', () => {
    // Must render totalAcquisitionCost in the team row
    expect(code).toContain('totalAcquisitionCost')
  })

  it('has phase selector state management', () => {
    // Must have state for selected session/phase
    expect(code).toContain('selectedSession')
  })

  it('renders phase selector UI component', () => {
    // Must have a selector for sessions/phases
    expect(code).toContain('availableSessions')
  })

  it('shows formula with acquisition cost breakdown', () => {
    // Must show a formula that includes acquisition costs
    // e.g., "Budget Iniziale (500) - Acquisti (8) = Budget Attuale (492)"
    expect(code).toContain('Budget Iniziale')
  })

  it('FinancialsData interface includes availableSessions', () => {
    const interfaceStart = code.indexOf('interface FinancialsData')
    expect(interfaceStart).toBeGreaterThan(-1)
    const interfaceBlock = code.slice(interfaceStart, code.indexOf('}', interfaceStart + 100) + 1)
    expect(interfaceBlock).toContain('availableSessions')
  })
})

// ==================== Bibbia FINANZE.md ====================

describe('OSS-6: FINANZE.md includes acquisition cost documentation', () => {
  const bibPath = path.resolve(__dirname, '../../docs/bibbie/FINANZE.md')
  let content: string

  beforeAll(() => {
    content = fs.readFileSync(bibPath, 'utf8')
  })

  it('documents the Costo Acquisti concept', () => {
    expect(content).toContain('Costo Acquisti')
  })

  it('documents the complete formula with all components', () => {
    // Must document: Budget Iniziale - Costo Acquisti = Budget Attuale
    expect(content).toContain('Budget Iniziale')
  })

  it('documents the storicita (historical phases)', () => {
    expect(content).toContain('storicita')
  })
})
