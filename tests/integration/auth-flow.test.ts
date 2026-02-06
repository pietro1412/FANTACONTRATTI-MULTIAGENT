/**
 * Test integration — flusso autenticazione con DB reale
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import app from '../../src/api/index'
import { cleanDatabase, prisma } from './helpers'

describe('Auth Flow', () => {
  const testUser = {
    email: 'auth-test@test.com',
    username: 'AuthTestUser',
    password: 'TestPassword123!',
  }

  beforeAll(async () => {
    await cleanDatabase()
    const hash = await bcrypt.hash(testUser.password, 4)
    await prisma.user.create({
      data: {
        email: testUser.email,
        username: testUser.username,
        passwordHash: hash,
        emailVerified: true,
      },
    })
  })

  afterAll(async () => {
    await cleanDatabase()
  })

  it('POST /api/auth/login — login con credenziali valide (email)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ emailOrUsername: testUser.email, password: testUser.password })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.accessToken).toBeDefined()
    expect(res.body.data.user.email).toBe(testUser.email)
  })

  it('POST /api/auth/login — login con username', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ emailOrUsername: testUser.username, password: testUser.password })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.accessToken).toBeDefined()
  })

  it('POST /api/auth/login — login con password errata', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ emailOrUsername: testUser.email, password: 'WrongPassword!' })

    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
  })

  it('GET /api/auth/me — accesso con token valido', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ emailOrUsername: testUser.email, password: testUser.password })

    const token = loginRes.body.data.accessToken

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)

    expect(meRes.status).toBe(200)
    expect(meRes.body.data.email).toBe(testUser.email)
  })

  it('GET /api/auth/me — accesso senza token', async () => {
    const res = await request(app).get('/api/auth/me')
    expect(res.status).toBe(401)
  })
})
