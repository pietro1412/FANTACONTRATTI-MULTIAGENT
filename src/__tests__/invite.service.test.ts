/**
 * invite.service.test.ts - Unit Tests for Invite Service
 *
 * Tests for league invite lifecycle: create, accept, reject, cancel, query.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoist mock before imports
const { mockPrisma, MockPrismaClient } = vi.hoisted(() => {
  const mock = {
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    league: {
      findUnique: vi.fn(),
    },
    leagueMember: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    leagueInvite: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  }

  const MockClass = function (this: typeof mock) {
    Object.assign(this, mock)
  } as unknown as new () => typeof mock

  return { mockPrisma: mock, MockPrismaClient: MockClass }
})

// Mock email service factory
const mockEmailService = vi.hoisted(() => ({
  sendLeagueInviteEmail: vi.fn().mockResolvedValue(undefined),
  sendInviteResponseNotificationEmail: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@prisma/client', () => ({
  PrismaClient: MockPrismaClient,
  MemberStatus: {
    ACTIVE: 'ACTIVE',
    PENDING: 'PENDING',
    EXPELLED: 'EXPELLED',
  },
  InviteStatus: {
    PENDING: 'PENDING',
    ACCEPTED: 'ACCEPTED',
    CANCELLED: 'CANCELLED',
    EXPIRED: 'EXPIRED',
  },
  JoinType: {
    INVITE: 'INVITE',
    REQUEST: 'REQUEST',
  },
}))

vi.mock('../modules/identity/infrastructure/services/email.factory', () => ({
  createEmailService: () => mockEmailService,
}))

// Import after mocking
import * as inviteService from '../services/invite.service'

describe('Invite Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ==================== createEmailInvite ====================

  describe('createEmailInvite', () => {
    it('returns error when username is not found', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null)

      const result = await inviteService.createEmailInvite(
        'league-1',
        'admin-1',
        'nonexistent_user'
      )

      expect(result.success).toBe(false)
      expect(result.message).toBe('Utente "nonexistent_user" non trovato')
    })

    it('returns error when user is not admin of the league', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue(null)

      const result = await inviteService.createEmailInvite(
        'league-1',
        'user-1',
        'test@email.com'
      )

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non autorizzato')
    })

    it('returns error when league is not found', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'member-1', role: 'ADMIN' })
      mockPrisma.league.findUnique.mockResolvedValue(null)

      const result = await inviteService.createEmailInvite(
        'league-1',
        'admin-1',
        'test@email.com'
      )

      expect(result.success).toBe(false)
      expect(result.message).toBe('Lega non trovata')
    })

    it('returns error when league is not in DRAFT status', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'member-1', role: 'ADMIN' })
      mockPrisma.league.findUnique.mockResolvedValue({
        id: 'league-1',
        status: 'ACTIVE',
        members: [],
      })

      const result = await inviteService.createEmailInvite(
        'league-1',
        'admin-1',
        'test@email.com'
      )

      expect(result.success).toBe(false)
      expect(result.message).toBe('La lega è già stata avviata, non puoi invitare nuovi membri')
    })

    it('returns error when user is already an active member', async () => {
      mockPrisma.leagueMember.findFirst
        .mockResolvedValueOnce({ id: 'admin-member', role: 'ADMIN' }) // admin check
        .mockResolvedValueOnce({ id: 'existing-member', status: 'ACTIVE' }) // existing member check
      mockPrisma.league.findUnique.mockResolvedValue({
        id: 'league-1',
        status: 'DRAFT',
        members: [],
      })
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-2', email: 'test@email.com' })

      const result = await inviteService.createEmailInvite(
        'league-1',
        'admin-1',
        'test@email.com'
      )

      expect(result.success).toBe(false)
      expect(result.message).toBe('Questo utente è già membro o ha una richiesta pendente')
    })

    it('returns error when a pending invite already exists for the email', async () => {
      mockPrisma.leagueMember.findFirst
        .mockResolvedValueOnce({ id: 'admin-member', role: 'ADMIN' }) // admin check
        .mockResolvedValueOnce(null) // no existing member
      mockPrisma.league.findUnique.mockResolvedValue({
        id: 'league-1',
        status: 'DRAFT',
        members: [],
      })
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-2', email: 'test@email.com' })
      mockPrisma.leagueInvite.findFirst.mockResolvedValue({
        id: 'invite-1',
        status: 'PENDING',
      })

      const result = await inviteService.createEmailInvite(
        'league-1',
        'admin-1',
        'test@email.com'
      )

      expect(result.success).toBe(false)
      expect(result.message).toBe('Esiste già un invito pendente per questa email')
    })

    it('creates a new invite successfully for an existing user', async () => {
      mockPrisma.leagueMember.findFirst
        .mockResolvedValueOnce({ id: 'admin-member', role: 'ADMIN' }) // admin check
        .mockResolvedValueOnce(null) // no existing member
      mockPrisma.league.findUnique.mockResolvedValue({
        id: 'league-1',
        status: 'DRAFT',
        members: [],
      })
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-2', email: 'test@email.com' })
      mockPrisma.leagueInvite.findFirst.mockResolvedValue(null) // no existing invite
      mockPrisma.leagueInvite.create.mockResolvedValue({
        id: 'invite-new',
        email: 'test@email.com',
        token: 'abc123',
        expiresAt: new Date('2099-01-01'),
        league: { name: 'Liga Test' },
        inviter: { username: 'admin_user' },
      })

      const result = await inviteService.createEmailInvite(
        'league-1',
        'admin-1',
        'test@email.com'
      )

      expect(result.success).toBe(true)
      expect(result.message).toBe('Invito creato con successo')
      expect((result.data as Record<string, unknown>).isNewUser).toBe(false)
      expect((result.data as Record<string, unknown>).email).toBe('test@email.com')
    })

    it('creates invite for a non-registered email and indicates new user', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValueOnce({ id: 'admin-member', role: 'ADMIN' })
      mockPrisma.league.findUnique.mockResolvedValue({
        id: 'league-1',
        status: 'DRAFT',
        members: [],
      })
      mockPrisma.user.findUnique.mockResolvedValue(null) // no user with that email
      mockPrisma.leagueInvite.findFirst.mockResolvedValue(null)
      mockPrisma.leagueInvite.create.mockResolvedValue({
        id: 'invite-new',
        email: 'newuser@email.com',
        token: 'tok123',
        expiresAt: new Date('2099-01-01'),
        league: { name: 'Liga Test' },
        inviter: { username: 'admin_user' },
      })

      const result = await inviteService.createEmailInvite(
        'league-1',
        'admin-1',
        'newuser@email.com'
      )

      expect(result.success).toBe(true)
      expect(result.message).toContain('registrarsi')
      expect((result.data as Record<string, unknown>).isNewUser).toBe(true)
    })

    it('updates an expired invite instead of creating a new one', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValueOnce({ id: 'admin-member', role: 'ADMIN' })
      mockPrisma.league.findUnique.mockResolvedValue({
        id: 'league-1',
        status: 'DRAFT',
        members: [],
      })
      mockPrisma.user.findUnique.mockResolvedValue(null) // no user
      mockPrisma.leagueInvite.findFirst.mockResolvedValue({
        id: 'old-invite',
        status: 'EXPIRED', // not PENDING, so reusable
      })
      mockPrisma.leagueInvite.update.mockResolvedValue({
        id: 'old-invite',
        email: 'expired@email.com',
        token: 'new-token',
        expiresAt: new Date('2099-01-01'),
        league: { name: 'Liga Test' },
        inviter: { username: 'admin_user' },
      })

      const result = await inviteService.createEmailInvite(
        'league-1',
        'admin-1',
        'expired@email.com'
      )

      expect(result.success).toBe(true)
      expect(mockPrisma.leagueInvite.update).toHaveBeenCalled()
      expect(mockPrisma.leagueInvite.create).not.toHaveBeenCalled()
    })

    it('resolves username to email before creating invite', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'user-2', email: 'resolved@email.com' })
      mockPrisma.leagueMember.findFirst
        .mockResolvedValueOnce({ id: 'admin-member', role: 'ADMIN' })
        .mockResolvedValueOnce(null)
      mockPrisma.league.findUnique.mockResolvedValue({
        id: 'league-1',
        status: 'DRAFT',
        members: [],
      })
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-2', email: 'resolved@email.com' })
      mockPrisma.leagueInvite.findFirst.mockResolvedValue(null)
      mockPrisma.leagueInvite.create.mockResolvedValue({
        id: 'invite-new',
        email: 'resolved@email.com',
        token: 'tok456',
        expiresAt: new Date('2099-01-01'),
        league: { name: 'Liga Test' },
        inviter: { username: 'admin_user' },
      })

      const result = await inviteService.createEmailInvite(
        'league-1',
        'admin-1',
        'someUsername' // no @ sign
      )

      expect(result.success).toBe(true)
      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { username: { equals: 'someUsername', mode: 'insensitive' } },
      })
    })
  })

  // ==================== acceptInvite ====================

  describe('acceptInvite', () => {
    it('returns error when invite is not found', async () => {
      mockPrisma.leagueInvite.findUnique.mockResolvedValue(null)

      const result = await inviteService.acceptInvite('bad-token', 'user-1', 'My Team')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Invito non trovato')
    })

    it('returns error when invite is not PENDING', async () => {
      mockPrisma.leagueInvite.findUnique.mockResolvedValue({
        id: 'invite-1',
        status: 'ACCEPTED',
        league: { status: 'DRAFT', members: [] },
      })

      const result = await inviteService.acceptInvite('token-1', 'user-1', 'My Team')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Questo invito non è più valido')
    })

    it('returns error and marks invite expired when past expiry date', async () => {
      mockPrisma.leagueInvite.findUnique.mockResolvedValue({
        id: 'invite-1',
        status: 'PENDING',
        expiresAt: new Date('2020-01-01'), // past date
        league: { status: 'DRAFT', members: [] },
      })
      mockPrisma.leagueInvite.update.mockResolvedValue({})

      const result = await inviteService.acceptInvite('token-1', 'user-1', 'My Team')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Questo invito è scaduto')
      expect(mockPrisma.leagueInvite.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'EXPIRED' },
        })
      )
    })

    it('returns error when league is not in DRAFT status', async () => {
      mockPrisma.leagueInvite.findUnique.mockResolvedValue({
        id: 'invite-1',
        status: 'PENDING',
        expiresAt: new Date('2099-01-01'),
        league: { status: 'ACTIVE', members: [] },
      })

      const result = await inviteService.acceptInvite('token-1', 'user-1', 'My Team')

      expect(result.success).toBe(false)
      expect(result.message).toBe('La lega è già stata avviata')
    })

    it('returns error when email does not match invite', async () => {
      mockPrisma.leagueInvite.findUnique.mockResolvedValue({
        id: 'invite-1',
        status: 'PENDING',
        expiresAt: new Date('2099-01-01'),
        email: 'invited@email.com',
        leagueId: 'league-1',
        league: { status: 'DRAFT', members: [] },
      })
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'different@email.com',
      })

      const result = await inviteService.acceptInvite('token-1', 'user-1', 'My Team')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Questo invito è per un altro indirizzo email')
    })

    it('returns error when user is already a member', async () => {
      mockPrisma.leagueInvite.findUnique.mockResolvedValue({
        id: 'invite-1',
        status: 'PENDING',
        expiresAt: new Date('2099-01-01'),
        email: 'test@email.com',
        leagueId: 'league-1',
        league: { status: 'DRAFT', members: [{ id: 'm1' }], maxParticipants: 8, initialBudget: 200, name: 'Liga' },
      })
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'test@email.com' })
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'existing-member' })

      const result = await inviteService.acceptInvite('token-1', 'user-1', 'My Team')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Sei già membro di questa lega')
    })

    it('returns error when league is at max capacity', async () => {
      const fullMembers = Array.from({ length: 8 }, (_, i) => ({ id: `m-${i}` }))
      mockPrisma.leagueInvite.findUnique.mockResolvedValue({
        id: 'invite-1',
        status: 'PENDING',
        expiresAt: new Date('2099-01-01'),
        email: 'test@email.com',
        leagueId: 'league-1',
        league: { status: 'DRAFT', members: fullMembers, maxParticipants: 8, initialBudget: 200, name: 'Liga' },
      })
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'test@email.com' })
      mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(null) // not already member

      const result = await inviteService.acceptInvite('token-1', 'user-1', 'My Team')

      expect(result.success).toBe(false)
      expect(result.message).toBe('La lega ha raggiunto il numero massimo di partecipanti')
    })

    it('accepts invite successfully and creates member', async () => {
      mockPrisma.leagueInvite.findUnique.mockResolvedValue({
        id: 'invite-1',
        status: 'PENDING',
        expiresAt: new Date('2099-01-01'),
        email: 'test@email.com',
        leagueId: 'league-1',
        league: { status: 'DRAFT', members: [{ id: 'm1' }], maxParticipants: 8, initialBudget: 200, name: 'Liga Test' },
      })
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'test@email.com' })
      mockPrisma.leagueMember.findFirst
        .mockResolvedValueOnce(null) // not already member
        .mockResolvedValueOnce({ user: { email: 'admin@email.com' } }) // admin member for notification
      mockPrisma.leagueMember.create.mockResolvedValue({
        id: 'new-member-1',
        userId: 'user-1',
        leagueId: 'league-1',
      })
      mockPrisma.leagueInvite.update.mockResolvedValue({})

      const result = await inviteService.acceptInvite('token-1', 'user-1', 'My Team')

      expect(result.success).toBe(true)
      expect(result.message).toBe('Sei entrato nella lega!')
      expect((result.data as Record<string, unknown>).memberId).toBe('new-member-1')
      expect((result.data as Record<string, unknown>).leagueName).toBe('Liga Test')
      expect(mockPrisma.leagueMember.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            role: 'MANAGER',
            status: 'ACTIVE',
            joinType: 'INVITE',
            teamName: 'My Team',
          }),
        })
      )
    })
  })

  // ==================== getPendingInvites ====================

  describe('getPendingInvites', () => {
    it('returns error when user is not admin', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue(null)

      const result = await inviteService.getPendingInvites('league-1', 'user-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non autorizzato')
    })

    it('returns list of pending invites', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'admin-member' })
      mockPrisma.leagueInvite.findMany.mockResolvedValue([
        {
          id: 'inv-1',
          email: 'a@test.com',
          expiresAt: new Date('2099-01-01'),
          createdAt: new Date('2025-06-01'),
          inviter: { username: 'admin_user' },
        },
        {
          id: 'inv-2',
          email: 'b@test.com',
          expiresAt: new Date('2099-01-01'),
          createdAt: new Date('2025-06-02'),
          inviter: { username: 'admin_user' },
        },
      ])

      const result = await inviteService.getPendingInvites('league-1', 'admin-1')

      expect(result.success).toBe(true)
      const data = result.data as Array<Record<string, unknown>>
      expect(data).toHaveLength(2)
      expect(data[0].email).toBe('a@test.com')
      expect(data[0].invitedBy).toBe('admin_user')
    })
  })

  // ==================== cancelInvite ====================

  describe('cancelInvite', () => {
    it('returns error when invite is not found', async () => {
      mockPrisma.leagueInvite.findUnique.mockResolvedValue(null)

      const result = await inviteService.cancelInvite('invite-1', 'admin-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Invito non trovato')
    })

    it('returns error when user is not admin', async () => {
      mockPrisma.leagueInvite.findUnique.mockResolvedValue({
        id: 'invite-1',
        leagueId: 'league-1',
        status: 'PENDING',
        league: {},
      })
      mockPrisma.leagueMember.findFirst.mockResolvedValue(null)

      const result = await inviteService.cancelInvite('invite-1', 'not-admin')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non autorizzato')
    })

    it('returns error when invite is not PENDING', async () => {
      mockPrisma.leagueInvite.findUnique.mockResolvedValue({
        id: 'invite-1',
        leagueId: 'league-1',
        status: 'ACCEPTED',
        league: {},
      })
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'admin-member' })

      const result = await inviteService.cancelInvite('invite-1', 'admin-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Questo invito non può essere annullato')
    })

    it('cancels invite successfully', async () => {
      mockPrisma.leagueInvite.findUnique.mockResolvedValue({
        id: 'invite-1',
        leagueId: 'league-1',
        status: 'PENDING',
        league: {},
      })
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'admin-member' })
      mockPrisma.leagueInvite.update.mockResolvedValue({})

      const result = await inviteService.cancelInvite('invite-1', 'admin-1')

      expect(result.success).toBe(true)
      expect(result.message).toBe('Invito annullato')
      expect(mockPrisma.leagueInvite.update).toHaveBeenCalledWith({
        where: { id: 'invite-1' },
        data: { status: 'CANCELLED' },
      })
    })
  })

  // ==================== getInviteInfo ====================

  describe('getInviteInfo', () => {
    it('returns error when invite is not found', async () => {
      mockPrisma.leagueInvite.findUnique.mockResolvedValue(null)

      const result = await inviteService.getInviteInfo('bad-token')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Invito non trovato')
    })

    it('returns error when invite is not PENDING', async () => {
      mockPrisma.leagueInvite.findUnique.mockResolvedValue({
        status: 'CANCELLED',
        league: { name: 'Liga', members: [] },
      })

      const result = await inviteService.getInviteInfo('token-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Questo invito non è più valido')
    })

    it('returns error when invite is expired', async () => {
      mockPrisma.leagueInvite.findUnique.mockResolvedValue({
        status: 'PENDING',
        expiresAt: new Date('2020-01-01'),
        league: { name: 'Liga', members: [] },
      })

      const result = await inviteService.getInviteInfo('token-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Questo invito è scaduto')
    })

    it('returns invite info successfully', async () => {
      mockPrisma.leagueInvite.findUnique.mockResolvedValue({
        email: 'test@email.com',
        status: 'PENDING',
        expiresAt: new Date('2099-01-01'),
        league: {
          name: 'Liga Test',
          description: 'A fun league',
          status: 'DRAFT',
          maxParticipants: 8,
          members: [{ id: 'm1' }, { id: 'm2' }],
        },
      })

      const result = await inviteService.getInviteInfo('token-1')

      expect(result.success).toBe(true)
      const data = result.data as Record<string, unknown>
      expect(data.leagueName).toBe('Liga Test')
      expect(data.currentMembers).toBe(2)
      expect(data.maxMembers).toBe(8)
    })
  })

  // ==================== getInviteInfoDetailed ====================

  describe('getInviteInfoDetailed', () => {
    it('returns error when invite is not found', async () => {
      mockPrisma.leagueInvite.findUnique.mockResolvedValue(null)

      const result = await inviteService.getInviteInfoDetailed('bad-token')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Invito non trovato')
    })

    it('returns error when invite is not PENDING', async () => {
      mockPrisma.leagueInvite.findUnique.mockResolvedValue({
        status: 'ACCEPTED',
        league: { members: [] },
        inviter: { username: 'admin' },
      })

      const result = await inviteService.getInviteInfoDetailed('token-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Questo invito non è più valido')
    })

    it('returns detailed invite info with league and members', async () => {
      mockPrisma.leagueInvite.findUnique.mockResolvedValue({
        token: 'token-1',
        email: 'test@email.com',
        status: 'PENDING',
        expiresAt: new Date('2099-01-01'),
        createdAt: new Date('2025-06-01'),
        inviter: { id: 'inv-1', username: 'admin_user', profilePhoto: null },
        league: {
          id: 'league-1',
          name: 'Liga Test',
          description: 'Desc',
          status: 'DRAFT',
          createdAt: new Date('2025-01-01'),
          minParticipants: 4,
          maxParticipants: 8,
          initialBudget: 200,
          goalkeeperSlots: 3,
          defenderSlots: 8,
          midfielderSlots: 8,
          forwardSlots: 6,
          members: [
            {
              id: 'm1',
              role: 'ADMIN',
              teamName: 'Admin FC',
              user: { id: 'u1', username: 'admin_user', profilePhoto: null },
            },
            {
              id: 'm2',
              role: 'MANAGER',
              teamName: 'Team B',
              user: { id: 'u2', username: 'manager1', profilePhoto: null },
            },
          ],
        },
      })

      const result = await inviteService.getInviteInfoDetailed('token-1')

      expect(result.success).toBe(true)
      const data = result.data as Record<string, unknown>
      expect(data.token).toBe('token-1')
      const league = data.league as Record<string, unknown>
      expect(league.name).toBe('Liga Test')
      expect(league.currentMembers).toBe(2)
      expect(league.availableSpots).toBe(6)
      expect((league.admin as Record<string, unknown>).username).toBe('admin_user')
    })
  })

  // ==================== getMyPendingInvites ====================

  describe('getMyPendingInvites', () => {
    it('returns error when user is not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)

      const result = await inviteService.getMyPendingInvites('user-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Utente non trovato')
    })

    it('returns list of pending invites for the user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ email: 'test@email.com' })
      mockPrisma.leagueInvite.findMany.mockResolvedValue([
        {
          id: 'inv-1',
          token: 'tok-1',
          expiresAt: new Date('2099-01-01'),
          createdAt: new Date('2025-06-01'),
          league: {
            id: 'league-1',
            name: 'Liga A',
            description: 'Desc A',
            status: 'DRAFT',
            maxParticipants: 8,
            members: [{ id: 'm1' }],
          },
          inviter: { username: 'admin_user' },
        },
      ])

      const result = await inviteService.getMyPendingInvites('user-1')

      expect(result.success).toBe(true)
      const data = result.data as Array<Record<string, unknown>>
      expect(data).toHaveLength(1)
      expect(data[0].leagueName).toBe('Liga A')
      expect(data[0].currentMembers).toBe(1)
      expect(data[0].invitedBy).toBe('admin_user')
    })
  })

  // ==================== rejectInvite ====================

  describe('rejectInvite', () => {
    it('returns error when invite is not found', async () => {
      mockPrisma.leagueInvite.findUnique.mockResolvedValue(null)

      const result = await inviteService.rejectInvite('bad-token', 'user-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Invito non trovato')
    })

    it('returns error when invite is not PENDING', async () => {
      mockPrisma.leagueInvite.findUnique.mockResolvedValue({
        id: 'invite-1',
        status: 'ACCEPTED',
        league: { id: 'league-1', name: 'Liga' },
      })

      const result = await inviteService.rejectInvite('token-1', 'user-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Questo invito non è più valido')
    })

    it('returns error when email does not match', async () => {
      mockPrisma.leagueInvite.findUnique.mockResolvedValue({
        id: 'invite-1',
        status: 'PENDING',
        email: 'invited@email.com',
        leagueId: 'league-1',
        league: { id: 'league-1', name: 'Liga' },
      })
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'different@email.com',
      })

      const result = await inviteService.rejectInvite('token-1', 'user-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Questo invito è per un altro indirizzo email')
    })

    it('rejects invite successfully and sends notification email', async () => {
      mockPrisma.leagueInvite.findUnique.mockResolvedValue({
        id: 'invite-1',
        status: 'PENDING',
        email: 'test@email.com',
        leagueId: 'league-1',
        league: { id: 'league-1', name: 'Liga Test' },
      })
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@email.com',
      })
      mockPrisma.leagueMember.findFirst.mockResolvedValue({
        user: { email: 'admin@email.com' },
      })
      mockPrisma.leagueInvite.update.mockResolvedValue({})

      const result = await inviteService.rejectInvite('token-1', 'user-1')

      expect(result.success).toBe(true)
      expect(result.message).toBe('Invito rifiutato')
      expect(mockPrisma.leagueInvite.update).toHaveBeenCalledWith({
        where: { id: 'invite-1' },
        data: { status: 'CANCELLED' },
      })
      expect(mockEmailService.sendInviteResponseNotificationEmail).toHaveBeenCalledWith(
        'admin@email.com',
        'Liga Test',
        'test', // email.split('@')[0]
        false, // rejected
        expect.stringContaining('/leagues/league-1')
      )
    })
  })
})
