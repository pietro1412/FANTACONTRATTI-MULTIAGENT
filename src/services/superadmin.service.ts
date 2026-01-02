import { PrismaClient, Position, Prisma } from '@prisma/client'
import * as XLSX from 'xlsx'

const prisma = new PrismaClient()

export interface ServiceResult {
  success: boolean
  message?: string
  data?: unknown
}

// ==================== VERIFY SUPERADMIN ====================

export async function verifySuperAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  })
  return user?.isSuperAdmin === true
}

// ==================== IMPORT QUOTAZIONI ====================

interface PlayerRow {
  id?: string | number
  Id?: string | number
  ID?: string | number
  Cod?: string | number
  cod?: string | number
  R?: string
  r?: string
  Ruolo?: string
  ruolo?: string
  Role?: string
  role?: string
  Nome?: string
  nome?: string
  Name?: string
  name?: string
  Squadra?: string
  squadra?: string
  Team?: string
  team?: string
  'Qt.A'?: number
  'Qt.I'?: number
  Quotazione?: number
  quotazione?: number
  Quot?: number
}

function parsePosition(value: string | undefined): Position | null {
  if (!value) return null
  const v = value.toUpperCase().trim()
  if (v === 'P' || v === 'POR') return 'P'
  if (v === 'D' || v === 'DIF') return 'D'
  if (v === 'C' || v === 'CEN') return 'C'
  if (v === 'A' || v === 'ATT') return 'A'
  return null
}

function getField<T>(row: PlayerRow, ...keys: string[]): T | undefined {
  for (const key of keys) {
    if ((row as Record<string, unknown>)[key] !== undefined) {
      return (row as Record<string, unknown>)[key] as T
    }
  }
  return undefined
}

export async function importQuotazioni(
  userId: string,
  fileBuffer: Buffer,
  sheetName: string = 'Tutti',
  fileName: string = 'quotazioni.xlsx'
): Promise<ServiceResult> {
  // Verify superadmin
  const isSuperAdmin = await verifySuperAdmin(userId)
  if (!isSuperAdmin) {
    return { success: false, message: 'Non autorizzato. Solo i superadmin possono caricare le quotazioni.' }
  }

  try {
    // Parse Excel file
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' })

    // Find sheet
    let sheet = workbook.Sheets[sheetName]
    if (!sheet) {
      // Try to find sheet with similar name
      const sheetNames = workbook.SheetNames
      const found = sheetNames.find(s => s.toLowerCase().includes(sheetName.toLowerCase()))
      if (found) {
        sheet = workbook.Sheets[found]
      } else {
        return {
          success: false,
          message: `Foglio "${sheetName}" non trovato. Fogli disponibili: ${sheetNames.join(', ')}`,
        }
      }
    }

    // Ensure sheet is defined after fallback logic
    if (!sheet) {
      return { success: false, message: 'Foglio non trovato' }
    }

    // Get the range of the sheet to find the header row
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1')

    // Find the actual header row (look for "Id" or "Nome" in first few rows)
    let headerRowIndex = 0
    for (let r = range.s.r; r <= Math.min(range.s.r + 5, range.e.r); r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = sheet[XLSX.utils.encode_cell({ r, c })]
        if (cell && cell.v) {
          const val = String(cell.v).trim().toLowerCase()
          if (val === 'id' || val === 'nome' || val === 'name') {
            headerRowIndex = r
            break
          }
        }
      }
      if (headerRowIndex > 0) break
    }

    // Convert to JSON starting from the header row
    const rows = XLSX.utils.sheet_to_json<PlayerRow>(sheet, {
      range: headerRowIndex,
      defval: undefined
    })

    if (rows.length === 0) {
      return { success: false, message: 'Nessun giocatore trovato nel file' }
    }

    // Parse all rows first
    const parsedPlayers: Array<{
      externalId: string
      name: string
      team: string
      position: Position
      quotation: number
    }> = []
    const stats = {
      created: 0,
      updated: 0,
      notInList: 0,
      errors: [] as string[],
    }

    for (const row of rows) {
      const externalId = String(getField<string | number>(row, 'Id', 'id', 'ID', 'Cod', 'cod') || '').trim()
      const name = getField<string>(row, 'Nome', 'nome', 'Name', 'name')?.trim()
      const team = getField<string>(row, 'Squadra', 'squadra', 'Team', 'team')?.trim()
      const positionStr = getField<string>(row, 'R', 'r', 'Ruolo', 'ruolo', 'Role', 'role')
      const quotation = getField<number>(row, 'Qt.A', 'Qt.I', 'Quotazione', 'quotazione', 'Quot') || 1

      if (!name) {
        stats.errors.push(`Riga senza nome`)
        continue
      }

      const position = parsePosition(positionStr)
      if (!position) {
        stats.errors.push(`Ruolo non valido per ${name}: ${positionStr}`)
        continue
      }

      parsedPlayers.push({
        externalId,
        name,
        team: team || 'Sconosciuta',
        position,
        quotation,
      })
    }

    // Load all existing players in ONE query
    const existingPlayers = await prisma.serieAPlayer.findMany({
      select: { id: true, externalId: true, name: true, position: true, listStatus: true }
    })

    // Track IDs of players that were IN_LIST before this import (for NOT_IN_LIST marking)
    const previouslyInListIds = new Set<string>()

    // Create lookup maps for fast matching
    const byExternalId = new Map<string, { id: string; externalId: string | null; name: string; position: Position }>()
    const byNamePosition = new Map<string, { id: string; externalId: string | null; name: string; position: Position }>()

    for (const p of existingPlayers) {
      if (p.listStatus === 'IN_LIST') {
        previouslyInListIds.add(p.id)
      }
      if (p.externalId) {
        byExternalId.set(p.externalId, p)
      }
      byNamePosition.set(`${p.name.toLowerCase()}|${p.position}`, p)
    }

    // Separate into create vs update
    const toCreate: Array<{
      externalId?: string
      name: string
      team: string
      position: Position
      quotation: number
      listStatus: 'IN_LIST'
    }> = []
    const toUpdate: Array<{
      id: string
      data: {
        name: string
        team: string
        position: Position
        quotation: number
        listStatus: 'IN_LIST'
        externalId?: string
      }
    }> = []
    const processedIds = new Set<string>()

    for (const player of parsedPlayers) {
      // Try to find existing player
      let existing = player.externalId ? byExternalId.get(player.externalId) : undefined
      if (!existing) {
        existing = byNamePosition.get(`${player.name.toLowerCase()}|${player.position}`)
      }

      if (existing) {
        toUpdate.push({
          id: existing.id,
          data: {
            name: player.name,
            team: player.team,
            position: player.position,
            quotation: player.quotation,
            listStatus: 'IN_LIST',
            externalId: player.externalId || undefined,
          }
        })
        processedIds.add(existing.id)
      } else {
        toCreate.push({
          externalId: player.externalId || undefined,
          name: player.name,
          team: player.team,
          position: player.position,
          quotation: player.quotation,
          listStatus: 'IN_LIST',
        })
      }
    }

    // Execute all operations in a transaction
    await prisma.$transaction(async (tx) => {
      // Batch create new players
      if (toCreate.length > 0) {
        await tx.serieAPlayer.createMany({
          data: toCreate,
          skipDuplicates: true,
        })
        stats.created = toCreate.length
      }

      // Batch update existing players (in chunks to avoid timeout)
      const CHUNK_SIZE = 50
      for (let i = 0; i < toUpdate.length; i += CHUNK_SIZE) {
        const chunk = toUpdate.slice(i, i + CHUNK_SIZE)
        await Promise.all(
          chunk.map(u => tx.serieAPlayer.update({
            where: { id: u.id },
            data: u.data
          }))
        )
      }
      stats.updated = toUpdate.length

      // Mark players not in new list as NOT_IN_LIST
      // Only affect players that were IN_LIST BEFORE this import and weren't updated
      const idsToMarkNotInList = Array.from(previouslyInListIds).filter(id => !processedIds.has(id))
      if (idsToMarkNotInList.length > 0) {
        const notInListResult = await tx.serieAPlayer.updateMany({
          where: {
            id: { in: idsToMarkNotInList },
          },
          data: { listStatus: 'NOT_IN_LIST' },
        })
        stats.notInList = notInListResult.count
      }

      // Save upload record
      await tx.quotazioniUpload.create({
        data: {
          uploadedById: userId,
          fileName,
          sheetName,
          playersCreated: stats.created,
          playersUpdated: stats.updated,
          playersNotInList: stats.notInList,
          totalProcessed: rows.length,
          errors: stats.errors.length > 0 ? stats.errors.slice(0, 10) : undefined,
        },
      })
    }, { timeout: 25000 }) // 25 second timeout for transaction

    return {
      success: true,
      message: `Import completato: ${stats.created} nuovi, ${stats.updated} aggiornati, ${stats.notInList} non più in lista`,
      data: {
        created: stats.created,
        updated: stats.updated,
        notInList: stats.notInList,
        errors: stats.errors.length > 0 ? stats.errors.slice(0, 10) : undefined,
        totalProcessed: rows.length,
      },
    }
  } catch (error) {
    console.error('Import error:', error)
    return {
      success: false,
      message: `Errore durante l'import: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`,
    }
  }
}

// ==================== GET SUPERADMIN STATUS ====================

export async function getSuperAdminStatus(userId: string): Promise<ServiceResult> {
  const isSuperAdmin = await verifySuperAdmin(userId)
  return {
    success: true,
    data: { isSuperAdmin },
  }
}

// ==================== GET UPLOAD HISTORY ====================

export async function getUploadHistory(userId: string): Promise<ServiceResult> {
  const isSuperAdmin = await verifySuperAdmin(userId)
  if (!isSuperAdmin) {
    return { success: false, message: 'Non autorizzato' }
  }

  const uploads = await prisma.quotazioniUpload.findMany({
    include: {
      uploadedBy: {
        select: {
          id: true,
          username: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 50, // Last 50 uploads
  })

  return {
    success: true,
    data: { uploads },
  }
}

// ==================== SET SUPERADMIN ====================

export async function setSuperAdmin(
  adminUserId: string,
  targetUserId: string,
  isSuperAdmin: boolean
): Promise<ServiceResult> {
  // Only existing superadmin can grant/revoke
  const isAdmin = await verifySuperAdmin(adminUserId)
  if (!isAdmin) {
    return { success: false, message: 'Non autorizzato' }
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
  })

  if (!targetUser) {
    return { success: false, message: 'Utente non trovato' }
  }

  await prisma.user.update({
    where: { id: targetUserId },
    data: { isSuperAdmin },
  })

  return {
    success: true,
    message: isSuperAdmin ? 'Utente promosso a superadmin' : 'Privilegi superadmin revocati',
  }
}

// ==================== GET PLAYERS STATS ====================

export async function getPlayersStats(userId: string): Promise<ServiceResult> {
  const isSuperAdmin = await verifySuperAdmin(userId)
  if (!isSuperAdmin) {
    return { success: false, message: 'Non autorizzato' }
  }

  const [totalPlayers, inList, notInList, byPosition] = await Promise.all([
    prisma.serieAPlayer.count(),
    prisma.serieAPlayer.count({ where: { listStatus: 'IN_LIST' } }),
    prisma.serieAPlayer.count({ where: { listStatus: 'NOT_IN_LIST' } }),
    prisma.serieAPlayer.groupBy({
      by: ['position', 'listStatus'],
      _count: true,
    }),
  ])

  return {
    success: true,
    data: {
      totalPlayers,
      inList,
      notInList,
      byPosition,
    },
  }
}

// ==================== GET PLAYERS LIST ====================

export async function getPlayersList(
  userId: string,
  filters?: {
    position?: string
    listStatus?: string
    search?: string
    team?: string
    page?: number
    limit?: number
  }
): Promise<ServiceResult> {
  const isSuperAdmin = await verifySuperAdmin(userId)
  if (!isSuperAdmin) {
    return { success: false, message: 'Non autorizzato' }
  }

  const page = filters?.page || 1
  const limit = filters?.limit || 50
  const skip = (page - 1) * limit

  const where: Prisma.SerieAPlayerWhereInput = {}

  if (filters?.position) {
    where.position = filters.position as Position
  }
  if (filters?.listStatus) {
    where.listStatus = filters.listStatus as 'IN_LIST' | 'NOT_IN_LIST'
  }
  if (filters?.search) {
    where.name = { contains: filters.search, mode: 'insensitive' }
  }
  if (filters?.team) {
    where.team = filters.team
  }

  const [players, total] = await Promise.all([
    prisma.serieAPlayer.findMany({
      where,
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      skip,
      take: limit,
    }),
    prisma.serieAPlayer.count({ where }),
  ])

  return {
    success: true,
    data: {
      players,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  }
}

// ==================== GET ALL LEAGUES ====================

export async function getAllLeagues(
  userId: string,
  search?: string
): Promise<ServiceResult> {
  const isSuperAdmin = await verifySuperAdmin(userId)
  if (!isSuperAdmin) {
    return { success: false, message: 'Non autorizzato' }
  }

  // Build where clause for search
  const where: {
    OR?: Array<{
      name?: { contains: string; mode: 'insensitive' }
      members?: { some: { user: { username: { contains: string; mode: 'insensitive' } } } }
    }>
  } = {}

  if (search && search.trim()) {
    where.OR = [
      { name: { contains: search.trim(), mode: 'insensitive' } },
      { members: { some: { user: { username: { contains: search.trim(), mode: 'insensitive' } } } } },
    ]
  }

  const leagues = await prisma.league.findMany({
    where,
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        },
      },
      _count: {
        select: {
          members: true,
          marketSessions: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return {
    success: true,
    data: { leagues },
  }
}

// ==================== GET MEMBER ROSTER ====================

export async function getMemberRoster(
  userId: string,
  memberId: string
): Promise<ServiceResult> {
  const isSuperAdmin = await verifySuperAdmin(userId)
  if (!isSuperAdmin) {
    return { success: false, message: 'Non autorizzato' }
  }

  // Get member info
  const member = await prisma.leagueMember.findUnique({
    where: { id: memberId },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          email: true,
        },
      },
      league: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  if (!member) {
    return { success: false, message: 'Membro non trovato' }
  }

  // Get roster entries with player info
  const roster = await prisma.playerRoster.findMany({
    where: { leagueMemberId: memberId },
    include: {
      player: {
        select: {
          id: true,
          name: true,
          team: true,
          position: true,
          quotation: true,
        },
      },
      contract: {
        select: {
          id: true,
          salary: true,
          duration: true,
          signedAt: true,
        },
      },
    },
    orderBy: [
      { player: { position: 'asc' } },
      { player: { name: 'asc' } },
    ],
  })

  return {
    success: true,
    data: {
      member: {
        id: member.id,
        username: member.user.username,
        email: member.user.email,
        currentBudget: member.currentBudget,
        role: member.role,
        league: member.league,
      },
      roster,
    },
  }
}

// ==================== GET ALL USERS ====================

export async function getAllUsers(userId: string): Promise<ServiceResult> {
  const isSuperAdmin = await verifySuperAdmin(userId)
  if (!isSuperAdmin) {
    return { success: false, message: 'Non autorizzato' }
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      email: true,
      emailVerified: true,
      isSuperAdmin: true,
      createdAt: true,
      _count: {
        select: {
          leagueMemberships: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return {
    success: true,
    data: { users },
  }
}

// ==================== DELETE ALL PLAYERS ====================

export async function deleteAllPlayers(userId: string): Promise<ServiceResult> {
  const isSuperAdmin = await verifySuperAdmin(userId)
  if (!isSuperAdmin) {
    return { success: false, message: 'Non autorizzato' }
  }

  // Delete all players
  const result = await prisma.serieAPlayer.deleteMany({})

  // Also clear upload history
  await prisma.quotazioniUpload.deleteMany({})

  return {
    success: true,
    message: `Eliminati ${result.count} giocatori`,
    data: { deletedCount: result.count },
  }
}
