/**
 * Smoke test — verifica che l'API Express si avvia e risponde correttamente
 */
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import app from '../../src/api/index'

describe('API Health', () => {
  it('GET /api/health returns 200 with status ok', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
    expect(res.body.timestamp).toBeDefined()
  })

  it('GET /unknown returns 404', async () => {
    const res = await request(app).get('/api/nonexistent')
    expect(res.status).toBe(404)
  })
})
