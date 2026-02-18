/**
 * Import Players Use Case - Application Layer
 *
 * Imports players from quotazioni file.
 * Validates file format before importing.
 */

import type { Result} from '@/shared/infrastructure/http/result';
import { ok, fail } from '@/shared/infrastructure/http/result'
import { ForbiddenError, ValidationError } from '@/shared/infrastructure/http/errors'
import type { IAdminRepository, IAuditLogRepository } from '../../domain/repositories/admin.repository.interface'
import type { PlayerImportData } from '../../domain/entities/audit-log.entity'
import type { ImportPlayersDto, ImportPlayersResultDto } from '../dto/admin.dto'

const VALID_POSITIONS = ['P', 'D', 'C', 'A']

export class ImportPlayersUseCase {
  constructor(
    private readonly adminRepository: IAdminRepository,
    private readonly auditLogRepository?: IAuditLogRepository
  ) {}

  async execute(dto: ImportPlayersDto): Promise<Result<ImportPlayersResultDto, ForbiddenError | ValidationError>> {
    // Validate required fields
    if (!dto.adminUserId) {
      return fail(new ValidationError('Admin user ID is required'))
    }

    if (!dto.fileContent) {
      return fail(new ValidationError('File content is required'))
    }

    // If league is specified, verify admin permission
    if (dto.leagueId) {
      const adminVerification = await this.adminRepository.verifyAdmin(dto.leagueId, dto.adminUserId)
      if (!adminVerification.isAdmin) {
        return fail(new ForbiddenError('Non autorizzato. Solo gli admin possono importare giocatori.'))
      }
    }

    // Parse file content
    const parseResult = this.parseFileContent(dto.fileContent)
    if (parseResult.isFailure) {
      return fail(parseResult.error)
    }

    const players = parseResult.value

    if (players.length === 0) {
      return fail(new ValidationError('Nessun giocatore valido trovato nel file'))
    }

    // Import players
    const importResult = await this.adminRepository.importPlayers(players)

    // Log the action
    if (this.auditLogRepository) {
      await this.auditLogRepository.create({
        userId: dto.adminUserId,
        leagueId: dto.leagueId || null,
        action: 'PLAYERS_IMPORT',
        entityType: 'SerieAPlayer',
        entityId: undefined,
        newValues: {
          imported: importResult.imported,
          updated: importResult.updated,
          errors: importResult.errors.length,
        },
      })
    }

    return ok(importResult)
  }

  private parseFileContent(content: string): Result<PlayerImportData[], ValidationError> {
    const players: PlayerImportData[] = []
    const errors: string[] = []

    // Split by lines, handling both Windows and Unix line endings
    const lines = content.split(/\r?\n/).filter(line => line.trim())

    // Skip header line if present
    let startIndex = 0
    const firstLine = lines[0]?.toLowerCase() || ''
    if (firstLine.includes('nome') || firstLine.includes('ruolo') || firstLine.includes('squadra')) {
      startIndex = 1
    }

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i]?.trim() ?? ''
      if (!line) continue

      // Try to parse as CSV or tab-separated
      const parts = line.includes('\t')
        ? line.split('\t')
        : line.includes(';')
          ? line.split(';')
          : line.split(',')

      if (parts.length < 4) {
        errors.push(`Line ${i + 1}: formato non valido (${parts.length} campi trovati, 4 richiesti)`)
        continue
      }

      const [position, name, team, quotationStr] = parts.map(p => p.trim())

      // Validate position
      if (!position || !VALID_POSITIONS.includes(position.toUpperCase())) {
        errors.push(`Line ${i + 1}: ruolo non valido "${position ?? ''}"`)
        continue
      }

      // Validate name
      if (!name || name.length < 2) {
        errors.push(`Line ${i + 1}: nome non valido "${name ?? ''}"`)
        continue
      }

      // Validate team
      if (!team || team.length < 2) {
        errors.push(`Line ${i + 1}: squadra non valida "${team ?? ''}"`)
        continue
      }

      // Validate quotation
      const quotation = parseInt(quotationStr ?? '', 10)
      if (isNaN(quotation) || quotation < 1) {
        errors.push(`Line ${i + 1}: quotazione non valida "${quotationStr ?? ''}"`)
        continue
      }

      players.push({
        position: position!.toUpperCase(),
        name,
        team,
        quotation,
      })
    }

    // If more than 50% of lines had errors, consider the file format invalid
    if (errors.length > lines.length / 2) {
      return fail(new ValidationError(`Formato file non valido. Errori trovati:\n${errors.slice(0, 5).join('\n')}`))
    }

    return ok(players)
  }
}
