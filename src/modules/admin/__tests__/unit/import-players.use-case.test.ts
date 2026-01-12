/**
 * Import Players Use Case Tests - TDD
 *
 * Tests for the import players use case following TDD principles.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ImportPlayersUseCase } from '../../application/use-cases/import-players.use-case'
import type { IAdminRepository, IAuditLogRepository } from '../../domain/repositories/admin.repository.interface'

describe('ImportPlayersUseCase', () => {
  let importPlayersUseCase: ImportPlayersUseCase
  let mockAdminRepository: IAdminRepository
  let mockAuditLogRepository: IAuditLogRepository

  beforeEach(() => {
    mockAdminRepository = {
      verifyAdmin: vi.fn(),
      checkMembership: vi.fn(),
      getLeagueStatistics: vi.fn(),
      getSessionStatistics: vi.fn(),
      updateMarketPhase: vi.fn(),
      getSessionWithLeague: vi.fn(),
      importPlayers: vi.fn(),
    }

    mockAuditLogRepository = {
      create: vi.fn(),
      findMany: vi.fn(),
      findById: vi.fn(),
    }

    importPlayersUseCase = new ImportPlayersUseCase(mockAdminRepository, mockAuditLogRepository)
  })

  describe('execute', () => {
    it('should return failure if adminUserId is missing', async () => {
      const result = await importPlayersUseCase.execute({
        adminUserId: '',
        fileContent: 'P,Donnarumma,Milan,10',
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toBe('Admin user ID is required')
      }
    })

    it('should return failure if fileContent is missing', async () => {
      const result = await importPlayersUseCase.execute({
        adminUserId: 'admin-123',
        fileContent: '',
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toBe('File content is required')
      }
    })

    it('should return failure if user is not admin of specified league', async () => {
      vi.mocked(mockAdminRepository.verifyAdmin).mockResolvedValue({
        isAdmin: false,
        memberId: null,
      })

      const result = await importPlayersUseCase.execute({
        adminUserId: 'user-123',
        fileContent: 'P,Donnarumma,Milan,10',
        leagueId: 'league-456',
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toBe('Non autorizzato. Solo gli admin possono importare giocatori.')
      }
    })

    it('should successfully parse CSV file with comma separator', async () => {
      vi.mocked(mockAdminRepository.importPlayers).mockResolvedValue({
        imported: 3,
        updated: 0,
        errors: [],
      })

      const fileContent = `P,Donnarumma,Milan,10
D,Theo Hernandez,Milan,25
C,Barella,Inter,30`

      const result = await importPlayersUseCase.execute({
        adminUserId: 'admin-123',
        fileContent,
      })

      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.imported).toBe(3)
        expect(result.value.updated).toBe(0)
      }
      expect(mockAdminRepository.importPlayers).toHaveBeenCalledWith([
        { position: 'P', name: 'Donnarumma', team: 'Milan', quotation: 10 },
        { position: 'D', name: 'Theo Hernandez', team: 'Milan', quotation: 25 },
        { position: 'C', name: 'Barella', team: 'Inter', quotation: 30 },
      ])
    })

    it('should successfully parse CSV file with semicolon separator', async () => {
      vi.mocked(mockAdminRepository.importPlayers).mockResolvedValue({
        imported: 2,
        updated: 0,
        errors: [],
      })

      const fileContent = `P;Maignan;Milan;12
A;Lautaro;Inter;35`

      const result = await importPlayersUseCase.execute({
        adminUserId: 'admin-123',
        fileContent,
      })

      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.imported).toBe(2)
      }
    })

    it('should successfully parse CSV file with tab separator', async () => {
      vi.mocked(mockAdminRepository.importPlayers).mockResolvedValue({
        imported: 2,
        updated: 0,
        errors: [],
      })

      const fileContent = `P\tSommer\tInter\t8
D\tBastoni\tInter\t20`

      const result = await importPlayersUseCase.execute({
        adminUserId: 'admin-123',
        fileContent,
      })

      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.imported).toBe(2)
      }
    })

    it('should skip header line if present', async () => {
      vi.mocked(mockAdminRepository.importPlayers).mockResolvedValue({
        imported: 1,
        updated: 0,
        errors: [],
      })

      const fileContent = `Ruolo,Nome,Squadra,Quotazione
P,Donnarumma,Milan,10`

      const result = await importPlayersUseCase.execute({
        adminUserId: 'admin-123',
        fileContent,
      })

      expect(result.isSuccess).toBe(true)
      expect(mockAdminRepository.importPlayers).toHaveBeenCalledWith([
        { position: 'P', name: 'Donnarumma', team: 'Milan', quotation: 10 },
      ])
    })

    it('should return failure if no valid players found', async () => {
      const fileContent = `invalid line
another invalid line`

      const result = await importPlayersUseCase.execute({
        adminUserId: 'admin-123',
        fileContent,
      })

      expect(result.isFailure).toBe(true)
    })

    it('should return failure if position is invalid', async () => {
      const fileContent = `X,Donnarumma,Milan,10`

      const result = await importPlayersUseCase.execute({
        adminUserId: 'admin-123',
        fileContent,
      })

      expect(result.isFailure).toBe(true)
    })

    it('should return failure if quotation is not a number', async () => {
      const fileContent = `P,Donnarumma,Milan,abc`

      const result = await importPlayersUseCase.execute({
        adminUserId: 'admin-123',
        fileContent,
      })

      expect(result.isFailure).toBe(true)
    })

    it('should log the import action', async () => {
      vi.mocked(mockAdminRepository.verifyAdmin).mockResolvedValue({
        isAdmin: true,
        memberId: 'member-123',
      })
      vi.mocked(mockAdminRepository.importPlayers).mockResolvedValue({
        imported: 5,
        updated: 2,
        errors: ['Error on line 8'],
      })

      const fileContent = `P,Player1,Team1,10
D,Player2,Team2,15
C,Player3,Team3,20
A,Player4,Team4,25
P,Player5,Team5,8`

      await importPlayersUseCase.execute({
        adminUserId: 'admin-123',
        fileContent,
        leagueId: 'league-456',
      })

      expect(mockAuditLogRepository.create).toHaveBeenCalledWith({
        userId: 'admin-123',
        leagueId: 'league-456',
        action: 'PLAYERS_IMPORT',
        entityType: 'SerieAPlayer',
        entityId: undefined,
        newValues: {
          imported: 5,
          updated: 2,
          errors: 1,
        },
      })
    })

    it('should handle Windows line endings', async () => {
      vi.mocked(mockAdminRepository.importPlayers).mockResolvedValue({
        imported: 2,
        updated: 0,
        errors: [],
      })

      const fileContent = `P,Donnarumma,Milan,10\r\nD,Theo Hernandez,Milan,25`

      const result = await importPlayersUseCase.execute({
        adminUserId: 'admin-123',
        fileContent,
      })

      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.imported).toBe(2)
      }
    })

    it('should trim whitespace from values', async () => {
      vi.mocked(mockAdminRepository.importPlayers).mockResolvedValue({
        imported: 1,
        updated: 0,
        errors: [],
      })

      const fileContent = `  P  ,  Donnarumma  ,  Milan  ,  10  `

      const result = await importPlayersUseCase.execute({
        adminUserId: 'admin-123',
        fileContent,
      })

      expect(result.isSuccess).toBe(true)
      expect(mockAdminRepository.importPlayers).toHaveBeenCalledWith([
        { position: 'P', name: 'Donnarumma', team: 'Milan', quotation: 10 },
      ])
    })
  })
})
