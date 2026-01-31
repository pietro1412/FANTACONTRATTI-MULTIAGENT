/**
 * watchlist.service.test.ts - Unit Tests for Watchlist Service
 *
 * Tests for the watchlist categories and entries management.
 *
 * Creato il: 31/01/2026
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoist mock before imports
const { mockPrisma, MockPrismaClient } = vi.hoisted(() => {
  const mock = {
    league: {
      findUnique: vi.fn()
    },
    leagueMember: {
      findFirst: vi.fn()
    },
    watchlistCategory: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn()
    },
    watchlistEntry: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    },
    serieAPlayer: {
      findUnique: vi.fn()
    }
  }

  const MockClass = function(this: typeof mock) {
    Object.assign(this, mock)
  } as unknown as new () => typeof mock

  return { mockPrisma: mock, MockPrismaClient: MockClass }
})

// Mock Prisma with hoisted mock
vi.mock('@prisma/client', () => ({
  PrismaClient: MockPrismaClient
}))

// Import after mocking
import * as watchlistService from '../services/watchlist.service'

describe('Watchlist Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ==================== createDefaultCategories ====================
  describe('createDefaultCategories', () => {
    it('returns error when league not found', async () => {
      mockPrisma.league.findUnique.mockResolvedValue(null)

      const result = await watchlistService.createDefaultCategories('league-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Lega non trovata')
    })

    it('returns error when categories already exist', async () => {
      mockPrisma.league.findUnique.mockResolvedValue({ id: 'league-1', name: 'Test League' })
      mockPrisma.watchlistCategory.findMany.mockResolvedValue([{ id: 'cat-1' }])

      const result = await watchlistService.createDefaultCategories('league-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe("Le categorie esistono gia' per questa lega")
    })

    it('creates 5 default categories successfully', async () => {
      mockPrisma.league.findUnique.mockResolvedValue({ id: 'league-1', name: 'Test League' })
      mockPrisma.watchlistCategory.findMany.mockResolvedValue([])
      mockPrisma.watchlistCategory.createMany.mockResolvedValue({ count: 5 })

      const result = await watchlistService.createDefaultCategories('league-1')

      expect(result.success).toBe(true)
      expect(result.message).toBe('5 categorie create')
      expect(result.data).toEqual({ count: 5 })
    })

    it('handles database error gracefully', async () => {
      mockPrisma.league.findUnique.mockRejectedValue(new Error('DB Error'))

      const result = await watchlistService.createDefaultCategories('league-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Errore nella creazione delle categorie')
    })
  })

  // ==================== getCategories ====================
  describe('getCategories', () => {
    it('returns error when member not found', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue(null)

      const result = await watchlistService.getCategories('league-1', 'member-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non sei membro di questa lega')
    })

    it('returns categories with entry counts', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'member-1', leagueId: 'league-1', status: 'ACTIVE' })
      mockPrisma.watchlistCategory.findMany.mockResolvedValue([
        {
          id: 'cat-1',
          name: 'Da Rubare',
          description: 'Test',
          icon: '🎯',
          color: '#ef4444',
          isSystemDefault: true,
          sortOrder: 1,
          _count: { entries: 3 }
        },
        {
          id: 'cat-2',
          name: 'Sotto Osservazione',
          description: 'Test 2',
          icon: '👁️',
          color: '#f59e0b',
          isSystemDefault: true,
          sortOrder: 2,
          _count: { entries: 1 }
        }
      ])

      const result = await watchlistService.getCategories('league-1', 'member-1')

      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(2)
      expect((result.data as Array<{ entryCount: number }>)[0].entryCount).toBe(3)
    })

    it('handles database error gracefully', async () => {
      mockPrisma.leagueMember.findFirst.mockRejectedValue(new Error('DB Error'))

      const result = await watchlistService.getCategories('league-1', 'member-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Errore nel recupero delle categorie')
    })
  })

  // ==================== createCategory ====================
  describe('createCategory', () => {
    it('returns error when member is not admin', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue(null)

      const result = await watchlistService.createCategory('league-1', 'member-1', { name: 'Test' })

      expect(result.success).toBe(false)
      expect(result.message).toBe('Solo gli admin possono creare categorie')
    })

    it('returns error when name is empty', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'member-1', role: 'ADMIN' })

      const result = await watchlistService.createCategory('league-1', 'member-1', { name: '' })

      expect(result.success).toBe(false)
      expect(result.message).toBe("Il nome e' obbligatorio")
    })

    it('returns error when name is only whitespace', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'member-1', role: 'ADMIN' })

      const result = await watchlistService.createCategory('league-1', 'member-1', { name: '   ' })

      expect(result.success).toBe(false)
      expect(result.message).toBe("Il nome e' obbligatorio")
    })

    it('returns error when name exceeds 50 characters', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'member-1', role: 'ADMIN' })

      const longName = 'A'.repeat(51)
      const result = await watchlistService.createCategory('league-1', 'member-1', { name: longName })

      expect(result.success).toBe(false)
      expect(result.message).toBe("Il nome non puo' superare i 50 caratteri")
    })

    it('returns error when category name already exists', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'member-1', role: 'ADMIN' })
      mockPrisma.watchlistCategory.findFirst.mockResolvedValue({ id: 'existing-cat' })

      const result = await watchlistService.createCategory('league-1', 'member-1', { name: 'Existing' })

      expect(result.success).toBe(false)
      expect(result.message).toBe("Esiste gia' una categoria con questo nome")
    })

    it('creates category successfully', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'member-1', role: 'ADMIN' })
      mockPrisma.watchlistCategory.findFirst.mockResolvedValue(null)
      mockPrisma.watchlistCategory.aggregate.mockResolvedValue({ _max: { sortOrder: 3 } })
      mockPrisma.watchlistCategory.create.mockResolvedValue({
        id: 'new-cat',
        name: 'New Category',
        description: 'My new category',
        icon: '⭐',
        color: '#ff0000',
        isSystemDefault: false,
        sortOrder: 4
      })

      const result = await watchlistService.createCategory('league-1', 'member-1', {
        name: 'New Category',
        description: 'My new category',
        icon: '⭐',
        color: '#ff0000'
      })

      expect(result.success).toBe(true)
      expect(result.message).toBe('Categoria creata')
      expect((result.data as { name: string }).name).toBe('New Category')
    })
  })

  // ==================== updateCategory ====================
  describe('updateCategory', () => {
    it('returns error when category not found', async () => {
      mockPrisma.watchlistCategory.findUnique.mockResolvedValue(null)

      const result = await watchlistService.updateCategory('cat-1', 'member-1', { name: 'New Name' })

      expect(result.success).toBe(false)
      expect(result.message).toBe('Categoria non trovata')
    })

    it('returns error when member is not admin', async () => {
      mockPrisma.watchlistCategory.findUnique.mockResolvedValue({ id: 'cat-1', leagueId: 'league-1' })
      mockPrisma.leagueMember.findFirst.mockResolvedValue(null)

      const result = await watchlistService.updateCategory('cat-1', 'member-1', { name: 'New Name' })

      expect(result.success).toBe(false)
      expect(result.message).toBe('Solo gli admin possono modificare le categorie')
    })

    it('returns error when new name is empty', async () => {
      mockPrisma.watchlistCategory.findUnique.mockResolvedValue({ id: 'cat-1', leagueId: 'league-1' })
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'member-1', role: 'ADMIN' })

      const result = await watchlistService.updateCategory('cat-1', 'member-1', { name: '' })

      expect(result.success).toBe(false)
      expect(result.message).toBe("Il nome e' obbligatorio")
    })

    it('updates category successfully', async () => {
      mockPrisma.watchlistCategory.findUnique.mockResolvedValue({ id: 'cat-1', leagueId: 'league-1' })
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'member-1', role: 'ADMIN' })
      mockPrisma.watchlistCategory.findFirst.mockResolvedValue(null)
      mockPrisma.watchlistCategory.update.mockResolvedValue({
        id: 'cat-1',
        name: 'Updated Name',
        description: 'Updated desc',
        icon: '🔥',
        color: '#00ff00',
        isSystemDefault: false,
        sortOrder: 1
      })

      const result = await watchlistService.updateCategory('cat-1', 'member-1', {
        name: 'Updated Name',
        description: 'Updated desc'
      })

      expect(result.success).toBe(true)
      expect(result.message).toBe('Categoria aggiornata')
    })
  })

  // ==================== deleteCategory ====================
  describe('deleteCategory', () => {
    it('returns error when category not found', async () => {
      mockPrisma.watchlistCategory.findUnique.mockResolvedValue(null)

      const result = await watchlistService.deleteCategory('cat-1', 'member-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Categoria non trovata')
    })

    it('returns error when trying to delete system default category', async () => {
      mockPrisma.watchlistCategory.findUnique.mockResolvedValue({
        id: 'cat-1',
        isSystemDefault: true,
        leagueId: 'league-1'
      })

      const result = await watchlistService.deleteCategory('cat-1', 'member-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non puoi eliminare le categorie di sistema')
    })

    it('returns error when member is not admin', async () => {
      mockPrisma.watchlistCategory.findUnique.mockResolvedValue({
        id: 'cat-1',
        isSystemDefault: false,
        leagueId: 'league-1'
      })
      mockPrisma.leagueMember.findFirst.mockResolvedValue(null)

      const result = await watchlistService.deleteCategory('cat-1', 'member-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Solo gli admin possono eliminare le categorie')
    })

    it('deletes category successfully', async () => {
      mockPrisma.watchlistCategory.findUnique.mockResolvedValue({
        id: 'cat-1',
        isSystemDefault: false,
        leagueId: 'league-1'
      })
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'member-1', role: 'ADMIN' })
      mockPrisma.watchlistCategory.delete.mockResolvedValue({ id: 'cat-1' })

      const result = await watchlistService.deleteCategory('cat-1', 'member-1')

      expect(result.success).toBe(true)
      expect(result.message).toBe('Categoria eliminata')
    })
  })

  // ==================== getEntries ====================
  describe('getEntries', () => {
    it('returns error when member not found', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue(null)

      const result = await watchlistService.getEntries('member-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Membro non trovato')
    })

    it('returns all entries for member', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'member-1', status: 'ACTIVE' })
      mockPrisma.watchlistEntry.findMany.mockResolvedValue([
        {
          id: 'entry-1',
          category: { id: 'cat-1', name: 'Da Rubare', icon: '🎯', color: '#ef4444' },
          player: { id: 'player-1', name: 'Leao', team: 'MIL', position: 'A', quotation: 35 },
          maxBid: 50,
          targetPrice: 45,
          priority: 5,
          notes: 'Must get',
          addedAt: new Date(),
          updatedAt: new Date()
        }
      ])

      const result = await watchlistService.getEntries('member-1')

      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(1)
    })

    it('filters entries by category when categoryId provided', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'member-1', status: 'ACTIVE' })
      mockPrisma.watchlistEntry.findMany.mockResolvedValue([])

      await watchlistService.getEntries('member-1', 'cat-1')

      expect(mockPrisma.watchlistEntry.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { memberId: 'member-1', categoryId: 'cat-1' }
      }))
    })
  })

  // ==================== addEntry ====================
  describe('addEntry', () => {
    it('returns error when category not found', async () => {
      mockPrisma.watchlistCategory.findUnique.mockResolvedValue(null)

      const result = await watchlistService.addEntry('cat-1', 'member-1', 'player-1', {})

      expect(result.success).toBe(false)
      expect(result.message).toBe('Categoria non trovata')
    })

    it('returns error when member not in league', async () => {
      mockPrisma.watchlistCategory.findUnique.mockResolvedValue({ id: 'cat-1', leagueId: 'league-1' })
      mockPrisma.leagueMember.findFirst.mockResolvedValue(null)

      const result = await watchlistService.addEntry('cat-1', 'member-1', 'player-1', {})

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non sei membro di questa lega')
    })

    it('returns error when player not found', async () => {
      mockPrisma.watchlistCategory.findUnique.mockResolvedValue({ id: 'cat-1', leagueId: 'league-1' })
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'member-1' })
      mockPrisma.serieAPlayer.findUnique.mockResolvedValue(null)

      const result = await watchlistService.addEntry('cat-1', 'member-1', 'player-1', {})

      expect(result.success).toBe(false)
      expect(result.message).toBe('Giocatore non trovato')
    })

    it('returns error when priority is out of range', async () => {
      mockPrisma.watchlistCategory.findUnique.mockResolvedValue({ id: 'cat-1', leagueId: 'league-1' })
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'member-1' })
      mockPrisma.serieAPlayer.findUnique.mockResolvedValue({ id: 'player-1', name: 'Test' })

      const result = await watchlistService.addEntry('cat-1', 'member-1', 'player-1', { priority: 6 })

      expect(result.success).toBe(false)
      expect(result.message).toBe("La priorita' deve essere tra 1 e 5")
    })

    it('returns error when player already in category', async () => {
      mockPrisma.watchlistCategory.findUnique.mockResolvedValue({ id: 'cat-1', leagueId: 'league-1' })
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'member-1' })
      mockPrisma.serieAPlayer.findUnique.mockResolvedValue({ id: 'player-1', name: 'Test' })
      mockPrisma.watchlistEntry.findFirst.mockResolvedValue({ id: 'existing-entry' })

      const result = await watchlistService.addEntry('cat-1', 'member-1', 'player-1', {})

      expect(result.success).toBe(false)
      expect(result.message).toBe("Giocatore gia' presente in questa categoria")
    })

    it('adds entry successfully', async () => {
      mockPrisma.watchlistCategory.findUnique.mockResolvedValue({ id: 'cat-1', leagueId: 'league-1' })
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'member-1' })
      mockPrisma.serieAPlayer.findUnique.mockResolvedValue({ id: 'player-1', name: 'Leao' })
      mockPrisma.watchlistEntry.findFirst.mockResolvedValue(null)
      mockPrisma.watchlistEntry.create.mockResolvedValue({
        id: 'new-entry',
        category: { id: 'cat-1', name: 'Da Rubare', icon: '🎯', color: '#ef4444' },
        player: { id: 'player-1', name: 'Leao', team: 'MIL', position: 'A', quotation: 35 },
        maxBid: 50,
        targetPrice: 45,
        priority: 5,
        notes: 'High priority',
        addedAt: new Date()
      })

      const result = await watchlistService.addEntry('cat-1', 'member-1', 'player-1', {
        maxBid: 50,
        targetPrice: 45,
        priority: 5,
        notes: 'High priority'
      })

      expect(result.success).toBe(true)
      expect(result.message).toBe('Giocatore aggiunto alla watchlist')
    })
  })

  // ==================== updateEntry ====================
  describe('updateEntry', () => {
    it('returns error when entry not found', async () => {
      mockPrisma.watchlistEntry.findUnique.mockResolvedValue(null)

      const result = await watchlistService.updateEntry('entry-1', 'member-1', { maxBid: 60 })

      expect(result.success).toBe(false)
      expect(result.message).toBe('Entry non trovata')
    })

    it('returns error when member does not own entry', async () => {
      mockPrisma.watchlistEntry.findUnique.mockResolvedValue({
        id: 'entry-1',
        memberId: 'other-member'
      })

      const result = await watchlistService.updateEntry('entry-1', 'member-1', { maxBid: 60 })

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non autorizzato')
    })

    it('returns error when priority is out of range', async () => {
      mockPrisma.watchlistEntry.findUnique.mockResolvedValue({
        id: 'entry-1',
        memberId: 'member-1'
      })

      const result = await watchlistService.updateEntry('entry-1', 'member-1', { priority: 10 })

      expect(result.success).toBe(false)
      expect(result.message).toBe("La priorita' deve essere tra 1 e 5")
    })

    it('updates entry successfully', async () => {
      mockPrisma.watchlistEntry.findUnique.mockResolvedValue({
        id: 'entry-1',
        memberId: 'member-1'
      })
      mockPrisma.watchlistEntry.update.mockResolvedValue({
        id: 'entry-1',
        category: { id: 'cat-1', name: 'Da Rubare', icon: '🎯', color: '#ef4444' },
        player: { id: 'player-1', name: 'Leao', team: 'MIL', position: 'A', quotation: 35 },
        maxBid: 60,
        targetPrice: 50,
        priority: 4,
        notes: 'Updated note',
        addedAt: new Date(),
        updatedAt: new Date()
      })

      const result = await watchlistService.updateEntry('entry-1', 'member-1', {
        maxBid: 60,
        targetPrice: 50,
        priority: 4,
        notes: 'Updated note'
      })

      expect(result.success).toBe(true)
      expect(result.message).toBe('Entry aggiornata')
    })
  })

  // ==================== removeEntry ====================
  describe('removeEntry', () => {
    it('returns error when entry not found', async () => {
      mockPrisma.watchlistEntry.findUnique.mockResolvedValue(null)

      const result = await watchlistService.removeEntry('entry-1', 'member-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Entry non trovata')
    })

    it('returns error when member does not own entry', async () => {
      mockPrisma.watchlistEntry.findUnique.mockResolvedValue({
        id: 'entry-1',
        memberId: 'other-member'
      })

      const result = await watchlistService.removeEntry('entry-1', 'member-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non autorizzato')
    })

    it('removes entry successfully', async () => {
      mockPrisma.watchlistEntry.findUnique.mockResolvedValue({
        id: 'entry-1',
        memberId: 'member-1'
      })
      mockPrisma.watchlistEntry.delete.mockResolvedValue({ id: 'entry-1' })

      const result = await watchlistService.removeEntry('entry-1', 'member-1')

      expect(result.success).toBe(true)
      expect(result.message).toBe('Giocatore rimosso dalla watchlist')
    })
  })

  // ==================== moveEntry ====================
  describe('moveEntry', () => {
    it('returns error when entry not found', async () => {
      mockPrisma.watchlistEntry.findUnique.mockResolvedValue(null)

      const result = await watchlistService.moveEntry('entry-1', 'member-1', 'cat-2')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Entry non trovata')
    })

    it('returns error when member does not own entry', async () => {
      mockPrisma.watchlistEntry.findUnique.mockResolvedValue({
        id: 'entry-1',
        memberId: 'other-member',
        category: { leagueId: 'league-1' }
      })

      const result = await watchlistService.moveEntry('entry-1', 'member-1', 'cat-2')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non autorizzato')
    })

    it('returns error when target category not found', async () => {
      mockPrisma.watchlistEntry.findUnique.mockResolvedValue({
        id: 'entry-1',
        memberId: 'member-1',
        categoryId: 'cat-1',
        playerId: 'player-1',
        category: { leagueId: 'league-1' }
      })
      mockPrisma.watchlistCategory.findUnique.mockResolvedValue(null)

      const result = await watchlistService.moveEntry('entry-1', 'member-1', 'cat-2')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Categoria di destinazione non trovata')
    })

    it('returns error when target category is in different league', async () => {
      mockPrisma.watchlistEntry.findUnique.mockResolvedValue({
        id: 'entry-1',
        memberId: 'member-1',
        categoryId: 'cat-1',
        playerId: 'player-1',
        category: { leagueId: 'league-1' }
      })
      mockPrisma.watchlistCategory.findUnique.mockResolvedValue({
        id: 'cat-2',
        leagueId: 'other-league'
      })

      const result = await watchlistService.moveEntry('entry-1', 'member-1', 'cat-2')

      expect(result.success).toBe(false)
      expect(result.message).toBe('La categoria deve appartenere alla stessa lega')
    })

    it('returns error when moving to same category', async () => {
      mockPrisma.watchlistEntry.findUnique.mockResolvedValue({
        id: 'entry-1',
        memberId: 'member-1',
        categoryId: 'cat-1',
        playerId: 'player-1',
        category: { leagueId: 'league-1' }
      })
      mockPrisma.watchlistCategory.findUnique.mockResolvedValue({
        id: 'cat-1',
        leagueId: 'league-1'
      })

      const result = await watchlistService.moveEntry('entry-1', 'member-1', 'cat-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe("Il giocatore e' gia' in questa categoria")
    })

    it('returns error when player already exists in target category', async () => {
      mockPrisma.watchlistEntry.findUnique.mockResolvedValue({
        id: 'entry-1',
        memberId: 'member-1',
        categoryId: 'cat-1',
        playerId: 'player-1',
        category: { leagueId: 'league-1' }
      })
      mockPrisma.watchlistCategory.findUnique.mockResolvedValue({
        id: 'cat-2',
        leagueId: 'league-1',
        name: 'Target'
      })
      mockPrisma.watchlistEntry.findFirst.mockResolvedValue({ id: 'existing-entry' })

      const result = await watchlistService.moveEntry('entry-1', 'member-1', 'cat-2')

      expect(result.success).toBe(false)
      expect(result.message).toBe("Il giocatore e' gia' nella categoria di destinazione")
    })

    it('moves entry successfully', async () => {
      mockPrisma.watchlistEntry.findUnique.mockResolvedValue({
        id: 'entry-1',
        memberId: 'member-1',
        categoryId: 'cat-1',
        playerId: 'player-1',
        category: { leagueId: 'league-1' }
      })
      mockPrisma.watchlistCategory.findUnique.mockResolvedValue({
        id: 'cat-2',
        leagueId: 'league-1',
        name: 'Sotto Osservazione'
      })
      mockPrisma.watchlistEntry.findFirst.mockResolvedValue(null)
      mockPrisma.watchlistEntry.update.mockResolvedValue({
        id: 'entry-1',
        category: { id: 'cat-2', name: 'Sotto Osservazione', icon: '👁️', color: '#f59e0b' },
        player: { id: 'player-1', name: 'Leao', team: 'MIL', position: 'A', quotation: 35 },
        maxBid: 50,
        targetPrice: 45,
        priority: 5,
        notes: 'Test'
      })

      const result = await watchlistService.moveEntry('entry-1', 'member-1', 'cat-2')

      expect(result.success).toBe(true)
      expect(result.message).toBe('Giocatore spostato in "Sotto Osservazione"')
    })
  })

  // ==================== ensureDefaultCategories ====================
  describe('ensureDefaultCategories', () => {
    it('returns success without creating when categories exist', async () => {
      mockPrisma.watchlistCategory.count.mockResolvedValue(5)

      const result = await watchlistService.ensureDefaultCategories('league-1')

      expect(result.success).toBe(true)
      expect(result.message).toBe("Categorie gia' presenti")
      expect((result.data as { created: boolean }).created).toBe(false)
    })

    it('creates default categories when none exist', async () => {
      mockPrisma.watchlistCategory.count.mockResolvedValue(0)
      mockPrisma.league.findUnique.mockResolvedValue({ id: 'league-1', name: 'Test League' })
      mockPrisma.watchlistCategory.findMany.mockResolvedValue([])
      mockPrisma.watchlistCategory.createMany.mockResolvedValue({ count: 5 })

      const result = await watchlistService.ensureDefaultCategories('league-1')

      expect(result.success).toBe(true)
      expect(result.message).toBe('5 categorie create')
    })

    it('handles database error gracefully', async () => {
      mockPrisma.watchlistCategory.count.mockRejectedValue(new Error('DB Error'))

      const result = await watchlistService.ensureDefaultCategories('league-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Errore nella verifica delle categorie')
    })
  })
})
