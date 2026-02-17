import { PrismaClient, MemberRole, MemberStatus, JoinType, TradeStatus } from '@prisma/client'
import type { CreateLeagueInput, UpdateLeagueInput } from '../utils/validation'
import type { IEmailService } from '../modules/identity/domain/services/email.service.interface'
import { computeSeasonStatsBatch, type ComputedSeasonStats } from './player-stats.service'
import type { ServiceResult } from '@/shared/types/service-result'

const prisma = new PrismaClient()

// Lazy-loaded email service to avoid initialization errors
let emailService: IEmailService | null = null
async function getEmailService(): Promise<IEmailService | null> {
  if (emailService) return emailService
  try {
    const { GmailEmailService } = await import('../modules/identity/infrastructure/services/gmail-email.service')
    emailService = new GmailEmailService()
    return emailService
  } catch {
    return null
  }
}

export async function createLeague(userId: string, input: CreateLeagueInput & { teamName?: string }): Promise<ServiceResult> {
  // Validazione numero partecipanti
  const minParticipants = 6 // Default minimo fisso
  const maxParticipants = input.maxParticipants ?? 20

  if (minParticipants < 6) {
    return { success: false, message: 'Il numero minimo di partecipanti deve essere almeno 6' }
  }

  if (maxParticipants > 20) {
    return { success: false, message: 'Il numero massimo di partecipanti non può superare 20' }
  }

  if (minParticipants > maxParticipants) {
    return { success: false, message: 'Il numero minimo non può essere maggiore del massimo' }
  }

  // Validate team name for creator
  if (!input.teamName || input.teamName.trim().length < 2) {
    return { success: false, message: 'Il nome della squadra è obbligatorio (minimo 2 caratteri)' }
  }

  const league = await prisma.league.create({
    data: {
      name: input.name,
      description: input.description,
      minParticipants,
      maxParticipants,
      initialBudget: input.initialBudget,
      goalkeeperSlots: input.goalkeeperSlots,
      defenderSlots: input.defenderSlots,
      midfielderSlots: input.midfielderSlots,
      forwardSlots: input.forwardSlots,
      members: {
        create: {
          userId,
          role: MemberRole.ADMIN,
          status: MemberStatus.ACTIVE,
          joinType: JoinType.CREATOR,
          teamName: input.teamName.trim(),
          currentBudget: input.initialBudget,
        },
      },
    },
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
    },
  })

  return {
    success: true,
    message: 'Lega creata con successo',
    data: {
      ...league,
      inviteCode: league.inviteCode,
    },
  }
}

export async function getLeaguesByUser(userId: string): Promise<ServiceResult> {
  const memberships = await prisma.leagueMember.findMany({
    where: {
      userId,
      status: { in: [MemberStatus.ACTIVE, MemberStatus.PENDING] },
    },
    include: {
      league: {
        include: {
          members: {
            where: { status: MemberStatus.ACTIVE },
            select: {
              id: true,
              role: true,
              user: {
                select: {
                  id: true,
                  username: true,
                },
              },
            },
          },
        },
      },
    },
  })

  return {
    success: true,
    data: memberships.map(m => ({
      membership: {
        id: m.id,
        role: m.role,
        status: m.status,
        currentBudget: m.currentBudget,
      },
      league: m.league,
    })),
  }
}

export async function getLeagueById(leagueId: string, userId: string): Promise<ServiceResult> {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              profilePhoto: true,
            },
          },
          // Include roster with contracts to calculate total salaries
          roster: {
            where: { status: 'ACTIVE' },
            include: {
              contract: {
                select: { salary: true },
              },
            },
          },
        },
      },
    },
  })

  if (!league) {
    return { success: false, message: 'Lega non trovata' }
  }

  // Check if user is a member
  const membership = league.members.find(m => m.userId === userId)

  // Add totalSalaries and balance to each member
  const membersWithBalance = league.members.map(member => {
    const totalSalaries = member.roster.reduce((sum, r) => sum + (r.contract?.salary || 0), 0)
    const balance = member.currentBudget - totalSalaries
    return {
      ...member,
      roster: undefined, // Don't expose roster details
      totalSalaries,
      balance,
    }
  })

  return {
    success: true,
    data: {
      league: {
        ...league,
        members: membersWithBalance,
      },
      userMembership: membership ? {
        ...membership,
        roster: undefined,
        totalSalaries: membership.roster.reduce((sum, r) => sum + (r.contract?.salary || 0), 0),
        balance: membership.currentBudget - membership.roster.reduce((sum, r) => sum + (r.contract?.salary || 0), 0),
      } : null,
      isAdmin: membership?.role === MemberRole.ADMIN,
    },
  }
}

export async function getLeagueByInviteCode(inviteCode: string): Promise<ServiceResult> {
  // For MVP, invite code is first 8 chars of league id
  const league = await prisma.league.findFirst({
    where: {
      id: { startsWith: inviteCode },
    },
    include: {
      members: {
        where: { status: MemberStatus.ACTIVE },
        select: {
          id: true,
          role: true,
          user: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      },
    },
  })

  if (!league) {
    return { success: false, message: 'Codice invito non valido' }
  }

  return {
    success: true,
    data: {
      id: league.id,
      name: league.name,
      description: league.description,
      maxParticipants: league.maxParticipants,
      currentParticipants: league.members.length,
      status: league.status,
    },
  }
}

// Helper function to send join request email notification
async function sendJoinRequestEmail(
  league: { name: string; members: Array<{ role: string; user: { email: string } | null }> },
  userId: string,
  teamName: string,
  leagueId: string
): Promise<void> {
  try {
    const adminMember = league.members.find(m => m.role === MemberRole.ADMIN)
    if (adminMember?.user?.email) {
      const requester = await prisma.user.findUnique({
        where: { id: userId },
        select: { username: true },
      })

      const adminPanelUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/leagues/${leagueId}/admin?tab=members`

      const emailSvc = await getEmailService()
      if (emailSvc) {
        await emailSvc.sendJoinRequestNotificationEmail(
          adminMember.user.email,
          league.name,
          requester?.username || 'Utente',
          teamName,
          adminPanelUrl
        )
      }
    }
  } catch {
    // Error intentionally silenced
  }
}

export async function requestJoinLeague(leagueId: string, userId: string, teamName?: string): Promise<ServiceResult> {
  // Check if league exists - include admin user for email notification
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: {
      members: {
        where: { status: MemberStatus.ACTIVE },
        include: {
          user: {
            select: { email: true },
          },
        },
      },
    },
  })

  if (!league) {
    return { success: false, message: 'Lega non trovata' }
  }

  // Verifica che la lega sia in stato DRAFT
  if (league.status !== 'DRAFT') {
    return { success: false, message: 'La lega è già stata avviata, non puoi richiedere di partecipare' }
  }

  // Check if league is full
  if (league.members.length >= league.maxParticipants) {
    return { success: false, message: 'Lega al completo' }
  }

  // Check if user already has a membership
  const existingMembership = await prisma.leagueMember.findUnique({
    where: {
      userId_leagueId: {
        userId,
        leagueId,
      },
    },
  })

  if (existingMembership) {
    if (existingMembership.status === MemberStatus.ACTIVE) {
      return { success: false, message: 'Sei già membro di questa lega' }
    }
    if (existingMembership.status === MemberStatus.PENDING) {
      return { success: false, message: 'Hai già una richiesta in attesa' }
    }
    if (existingMembership.status === MemberStatus.SUSPENDED) {
      return { success: false, message: 'Il tuo account è stato sospeso da questa lega' }
    }
    if (existingMembership.status === MemberStatus.LEFT) {
      // If user left the league, allow to re-request by updating the existing record
      if (!teamName || teamName.trim().length < 2) {
        return { success: false, message: 'Il nome della squadra è obbligatorio (minimo 2 caratteri)' }
      }
      const membership = await prisma.leagueMember.update({
        where: { id: existingMembership.id },
        data: {
          status: MemberStatus.PENDING,
          teamName: teamName.trim(),
          joinType: JoinType.REQUEST,
        },
      })

      // Send email notification to admin
      await sendJoinRequestEmail(league, userId, teamName.trim(), leagueId)

      return {
        success: true,
        message: 'Richiesta di partecipazione inviata',
        data: membership,
      }
    }
  }

  // Validate team name
  if (!teamName || teamName.trim().length < 2) {
    return { success: false, message: 'Il nome della squadra è obbligatorio (minimo 2 caratteri)' }
  }

  // Create pending membership (richiesta spontanea = JoinType.REQUEST)
  const membership = await prisma.leagueMember.create({
    data: {
      userId,
      leagueId,
      role: MemberRole.MANAGER,
      status: MemberStatus.PENDING,
      joinType: JoinType.REQUEST,
      teamName: teamName.trim(),
      currentBudget: 0, // Will be set when approved
    },
  })

  // Send email notification to admin
  await sendJoinRequestEmail(league, userId, teamName.trim(), leagueId)

  return {
    success: true,
    message: 'Richiesta di partecipazione inviata',
    data: membership,
  }
}

export async function getLeagueMembers(leagueId: string, userId: string): Promise<ServiceResult> {
  // Check if user is admin
  const adminCheck = await prisma.leagueMember.findFirst({
    where: {
      leagueId,
      userId,
      role: MemberRole.ADMIN,
      status: MemberStatus.ACTIVE,
    },
  })

  const members = await prisma.leagueMember.findMany({
    where: { leagueId },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          email: true,
          profilePhoto: true,
        },
      },
    },
    orderBy: [
      { status: 'asc' },
      { role: 'asc' },
      { joinedAt: 'asc' },
    ],
  })

  return {
    success: true,
    data: {
      members,
      isAdmin: !!adminCheck,
    },
  }
}

export async function getPendingJoinRequests(leagueId: string, userId: string): Promise<ServiceResult> {
  // Check if user is admin
  const adminCheck = await prisma.leagueMember.findFirst({
    where: {
      leagueId,
      userId,
      role: MemberRole.ADMIN,
      status: MemberStatus.ACTIVE,
    },
  })

  if (!adminCheck) {
    return { success: false, message: 'Non autorizzato' }
  }

  const pendingRequests = await prisma.leagueMember.findMany({
    where: {
      leagueId,
      status: MemberStatus.PENDING,
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          email: true,
          profilePhoto: true,
        },
      },
    },
    orderBy: { joinedAt: 'desc' },
  })

  return {
    success: true,
    data: pendingRequests,
  }
}

export async function updateMemberStatus(
  leagueId: string,
  memberId: string,
  adminUserId: string,
  action: 'accept' | 'reject' | 'kick'
): Promise<ServiceResult> {
  // Verify admin
  const admin = await prisma.leagueMember.findFirst({
    where: {
      leagueId,
      userId: adminUserId,
      role: MemberRole.ADMIN,
      status: MemberStatus.ACTIVE,
    },
  })

  if (!admin) {
    return { success: false, message: 'Non autorizzato' }
  }

  // Get target member with user info for email
  const member = await prisma.leagueMember.findUnique({
    where: { id: memberId },
    include: {
      league: true,
      user: { select: { email: true } },
    },
  })

  if (!member || member.leagueId !== leagueId) {
    return { success: false, message: 'Membro non trovato' }
  }

  // Cannot kick admin
  if (member.role === MemberRole.ADMIN && action === 'kick') {
    return { success: false, message: 'Non puoi rimuovere un admin' }
  }

  // BLOCCO POST-AVVIO: Non si può espellere se la lega è ACTIVE
  if (action === 'kick' && member.league.status === 'ACTIVE') {
    return { success: false, message: 'Non puoi rimuovere membri dopo l\'avvio della lega' }
  }

  if (action === 'accept') {
    if (member.status !== MemberStatus.PENDING) {
      return { success: false, message: 'Questo membro non ha una richiesta in attesa' }
    }

    // Non accettare nuovi membri se lega è ACTIVE
    if (member.league.status === 'ACTIVE') {
      return { success: false, message: 'Non puoi accettare nuovi membri dopo l\'avvio della lega' }
    }

    await prisma.leagueMember.update({
      where: { id: memberId },
      data: {
        status: MemberStatus.ACTIVE,
        currentBudget: member.league.initialBudget,
      },
    })

    // Send email notification to the manager (#52)
    if (member.user?.email) {
      try {
        const leagueUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/leagues/${leagueId}`
        const emailSvc = await getEmailService()
        if (emailSvc) {
          await emailSvc.sendJoinRequestResponseEmail(
            member.user.email,
            member.league.name,
            true, // approved
            leagueUrl
          )
        }
      } catch {
        // Error intentionally silenced
      }
    }

    return { success: true, message: 'Membro accettato' }
  }

  if (action === 'reject' || action === 'kick') {
    await prisma.leagueMember.update({
      where: { id: memberId },
      data: { status: MemberStatus.LEFT },
    })

    // Send email notification for rejection (#126)
    if (action === 'reject' && member.user?.email) {
      try {
        const emailSvc = await getEmailService()
        if (emailSvc) {
          await emailSvc.sendJoinRequestResponseEmail(
            member.user.email,
            member.league.name,
            false // rejected
          )
        }
      } catch {
        // Error intentionally silenced
      }
    }

    // Send email notification for kick/expulsion (#125)
    if (action === 'kick' && member.user?.email) {
      try {
        const emailSvc = await getEmailService()
        if (emailSvc) {
          await emailSvc.sendMemberExpelledEmail(
            member.user.email,
            member.league.name
          )
        }
      } catch {
        // Error intentionally silenced
      }
    }

    return {
      success: true,
      message: action === 'reject' ? 'Richiesta rifiutata' : 'Membro rimosso',
    }
  }

  return { success: false, message: 'Azione non valida' }
}

// ==================== AVVIA LEGA ====================

export async function startLeague(leagueId: string, adminUserId: string): Promise<ServiceResult> {
  // Verify admin
  const admin = await prisma.leagueMember.findFirst({
    where: {
      leagueId,
      userId: adminUserId,
      role: MemberRole.ADMIN,
      status: MemberStatus.ACTIVE,
    },
  })

  if (!admin) {
    return { success: false, message: 'Non autorizzato' }
  }

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: {
      members: {
        where: { status: MemberStatus.ACTIVE },
      },
    },
  })

  if (!league) {
    return { success: false, message: 'Lega non trovata' }
  }

  if (league.status !== 'DRAFT') {
    return { success: false, message: 'La lega è già stata avviata' }
  }

  const activeMembers = league.members.length

  // Verifica numero minimo partecipanti (regola piattaforma: min 6)
  const PLATFORM_MIN_PARTICIPANTS = 6
  if (activeMembers < PLATFORM_MIN_PARTICIPANTS) {
    return {
      success: false,
      message: `Servono almeno ${PLATFORM_MIN_PARTICIPANTS} partecipanti per avviare la lega (attualmente ${activeMembers})`,
    }
  }

  // Verifica numero massimo partecipanti
  if (activeMembers > league.maxParticipants) {
    return {
      success: false,
      message: `Troppi partecipanti: massimo ${league.maxParticipants} (attualmente ${activeMembers})`,
    }
  }

  // Verifica numero pari (se richiesto)
  if (league.requireEvenNumber && activeMembers % 2 !== 0) {
    return {
      success: false,
      message: `Il numero di partecipanti deve essere pari (attualmente ${activeMembers})`,
    }
  }

  // Avvia la lega
  await prisma.league.update({
    where: { id: leagueId },
    data: { status: 'ACTIVE' },
  })

  // Rifiuta tutte le richieste pendenti
  await prisma.leagueMember.updateMany({
    where: {
      leagueId,
      status: MemberStatus.PENDING,
    },
    data: { status: MemberStatus.LEFT },
  })

  return {
    success: true,
    message: 'Lega avviata con successo!',
    data: { participantsCount: activeMembers },
  }
}

// ==================== LASCIA LEGA ====================

export async function leaveLeague(leagueId: string, userId: string): Promise<ServiceResult> {
  // Check for both ACTIVE and PENDING memberships
  const member = await prisma.leagueMember.findFirst({
    where: {
      leagueId,
      userId,
      status: { in: [MemberStatus.ACTIVE, MemberStatus.PENDING] },
    },
    include: { league: true },
  })

  if (!member) {
    return { success: false, message: 'Non sei membro di questa lega' }
  }

  // PENDING members can always cancel their request (#50)
  if (member.status === MemberStatus.PENDING) {
    await prisma.leagueMember.update({
      where: { id: member.id },
      data: { status: MemberStatus.LEFT },
    })
    return { success: true, message: 'Richiesta di partecipazione annullata' }
  }

  // ACTIVE members cannot leave after league starts (#51)
  if (member.league.status === 'ACTIVE') {
    return { success: false, message: 'Non puoi lasciare la lega dopo che è stata avviata' }
  }

  // Admin non può lasciare (deve prima passare il ruolo o eliminare la lega)
  if (member.role === MemberRole.ADMIN) {
    return { success: false, message: 'L\'admin non può lasciare la lega. Trasferisci il ruolo di admin o elimina la lega.' }
  }

  await prisma.leagueMember.update({
    where: { id: member.id },
    data: { status: MemberStatus.LEFT },
  })

  return { success: true, message: 'Hai lasciato la lega' }
}

// ==================== ANNULLA RICHIESTA PARTECIPAZIONE ====================

export async function cancelJoinRequest(leagueId: string, userId: string): Promise<ServiceResult> {
  const member = await prisma.leagueMember.findFirst({
    where: {
      leagueId,
      userId,
      status: MemberStatus.PENDING,
    },
  })

  if (!member) {
    return { success: false, message: 'Nessuna richiesta pendente trovata' }
  }

  await prisma.leagueMember.update({
    where: { id: member.id },
    data: { status: MemberStatus.LEFT },
  })

  return { success: true, message: 'Richiesta di partecipazione annullata' }
}

export async function updateLeague(
  leagueId: string,
  userId: string,
  input: UpdateLeagueInput
): Promise<ServiceResult> {
  // Verify admin
  const admin = await prisma.leagueMember.findFirst({
    where: {
      leagueId,
      userId,
      role: MemberRole.ADMIN,
      status: MemberStatus.ACTIVE,
    },
  })

  if (!admin) {
    return { success: false, message: 'Non autorizzato' }
  }

  const league = await prisma.league.update({
    where: { id: leagueId },
    data: input,
  })

  return {
    success: true,
    message: 'Lega aggiornata',
    data: league,
  }
}

export async function getAllRosters(leagueId: string, userId: string): Promise<ServiceResult> {
  // Verify user is member of league
  const membership = await prisma.leagueMember.findFirst({
    where: {
      leagueId,
      userId,
      status: MemberStatus.ACTIVE,
    },
  })

  if (!membership) {
    return { success: false, message: 'Non autorizzato' }
  }

  // Check if we're in CONTRATTI phase - hide other managers' contracts if so
  const activeContrattiSession = await prisma.marketSession.findFirst({
    where: {
      leagueId,
      status: 'ACTIVE',
      currentPhase: 'CONTRATTI',
    },
  })
  const hideOthersContracts = !!activeContrattiSession

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: {
      id: true,
      name: true,
      members: {
        where: { status: MemberStatus.ACTIVE },
        select: {
          id: true,
          userId: true,
          role: true,
          teamName: true,
          currentBudget: true,
          user: {
            select: {
              username: true,
            },
          },
          roster: {
            where: { status: 'ACTIVE' },
            select: {
              id: true,
              playerId: true,
              acquisitionPrice: true,
              acquisitionType: true,
              player: {
                select: {
                  id: true,
                  name: true,
                  team: true,
                  position: true,
                  quotation: true,
                  apiFootballId: true,
                  apiFootballStats: true,
                  statsSyncedAt: true,
                },
              },
              contract: {
                select: {
                  id: true,
                  salary: true,
                  duration: true,
                  rescissionClause: true,
                  signedAt: true,
                },
              },
            },
          },
        },
      },
    },
  })

  if (!league) {
    return { success: false, message: 'Lega non trovata' }
  }

  // Collect all player IDs for batch stats computation
  const allPlayerIds = league.members.flatMap(m =>
    m.roster.map(r => r.playerId)
  )

  // Compute season stats for all players in batch (efficient single query)
  const statsMap = await computeSeasonStatsBatch(allPlayerIds)

  // If in CONTRATTI phase, hide contract details for other managers
  const processedMembers = league.members.map(member => {
    const processedRoster = member.roster.map(r => ({
      ...r,
      player: {
        ...r.player,
        computedStats: statsMap.get(r.playerId) || null,
      },
      contract: hideOthersContracts && member.userId !== userId ? null : r.contract,
    }))

    return {
      ...member,
      roster: processedRoster,
    }
  })

  return {
    success: true,
    data: {
      id: league.id,
      name: league.name,
      members: processedMembers,
      currentUserId: userId,
      isAdmin: membership.role === MemberRole.ADMIN,
      inContrattiPhase: hideOthersContracts,
    },
  }
}

// ==================== RICERCA LEGHE ====================

export async function searchLeagues(
  userId: string,
  query: string
): Promise<ServiceResult> {
  if (!query || query.trim().length < 2) {
    return { success: false, message: 'Inserisci almeno 2 caratteri per la ricerca' }
  }

  const searchTerm = query.trim()

  // Cerca leghe per:
  // 1. Nome lega (parziale)
  // 2. Codice invito (esatto match su primi caratteri ID)
  // 3. Username o email di admin/membri
  const leagues = await prisma.league.findMany({
    where: {
      OR: [
        // Ricerca per nome lega
        { name: { contains: searchTerm, mode: 'insensitive' } },
        // Ricerca per codice invito (primi 8 caratteri dell'ID)
        { id: { startsWith: searchTerm } },
        // Ricerca per username o email di membri
        {
          members: {
            some: {
              status: MemberStatus.ACTIVE,
              user: {
                OR: [
                  { username: { contains: searchTerm, mode: 'insensitive' } },
                  { email: { contains: searchTerm, mode: 'insensitive' } },
                ],
              },
            },
          },
        },
      ],
    },
    include: {
      members: {
        where: { status: MemberStatus.ACTIVE },
        include: {
          user: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      },
    },
    take: 20, // Limita risultati
    orderBy: { createdAt: 'desc' },
  })

  // Escludi le leghe di cui l'utente è già membro
  const userMemberships = await prisma.leagueMember.findMany({
    where: {
      userId,
      status: { in: [MemberStatus.ACTIVE, MemberStatus.PENDING] },
    },
    select: { leagueId: true },
  })

  const userLeagueIds = new Set(userMemberships.map(m => m.leagueId))

  const filteredLeagues = leagues
    .filter(league => !userLeagueIds.has(league.id))
    .map(league => {
      const admin = league.members.find(m => m.role === MemberRole.ADMIN)
      return {
        id: league.id,
        name: league.name,
        description: league.description,
        inviteCode: league.id.substring(0, 8),
        status: league.status,
        maxParticipants: league.maxParticipants,
        currentParticipants: league.members.length,
        adminUsername: admin?.user.username || 'N/A',
        createdAt: league.createdAt,
      }
    })

  return {
    success: true,
    data: filteredLeagues,
  }
}

/**
 * OSS-6: Get historical financial data from ManagerSessionSnapshot for a specific session.
 * Returns simplified financial view based on stored snapshots.
 */
async function getLeagueFinancialsSnapshot(
  leagueId: string,
  membership: { id: string; role: string },
  sessionId: string
): Promise<ServiceResult | null> {
  // Fetch all snapshots for this session (prefer PHASE_END, fallback to PHASE_START, then SESSION_START)
  const snapshots = await prisma.managerSessionSnapshot.findMany({
    where: { marketSessionId: sessionId },
    include: {
      leagueMember: {
        select: {
          id: true,
          teamName: true,
          user: { select: { username: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (snapshots.length === 0) {
    // No snapshots yet (session still active, no phase transitions happened)
    // Return null to signal caller to fall back to live data
    return null
  }

  // Group snapshots by member, pick best available: PHASE_END > PHASE_START > SESSION_START
  const snapshotByMember = new Map<string, typeof snapshots[0]>()
  const priority: Record<string, number> = { PHASE_END: 3, PHASE_START: 2, SESSION_START: 1 }

  for (const snap of snapshots) {
    const existing = snapshotByMember.get(snap.leagueMemberId)
    const snapPrio = priority[snap.snapshotType] || 0
    const existPrio = existing ? (priority[existing.snapshotType] || 0) : 0
    if (!existing || snapPrio > existPrio) {
      snapshotByMember.set(snap.leagueMemberId, snap)
    }
  }

  // Get league settings for slot limit
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: {
      name: true,
      goalkeeperSlots: true,
      defenderSlots: true,
      midfielderSlots: true,
      forwardSlots: true,
    },
  })
  const maxSlots = league
    ? (league.goalkeeperSlots + league.defenderSlots + league.midfielderSlots + league.forwardSlots)
    : 25

  // Get session info for the label
  const session = await prisma.marketSession.findUnique({
    where: { id: sessionId },
    select: { type: true, currentPhase: true, status: true },
  })

  // Build team data from snapshots
  const teamsData = Array.from(snapshotByMember.values()).map(snap => {
    const budget = snap.budget
    const annualContractCost = snap.totalSalaries
    const slotCount = snap.contractCount

    return {
      memberId: snap.leagueMemberId,
      teamName: snap.leagueMember.teamName || snap.leagueMember.user.username,
      username: snap.leagueMember.user.username,
      budget,
      annualContractCost,
      totalContractCost: 0, // Not available in snapshot
      totalAcquisitionCost: 0, // Not available in snapshot
      slotCount,
      slotsFree: maxSlots - slotCount,
      maxSlots,
      ageDistribution: { under20: 0, under25: 0, under30: 0, over30: 0, unknown: 0 },
      positionDistribution: { P: 0, D: 0, C: 0, A: 0 },
      players: [], // Not available in snapshot
      preRenewalContractCost: annualContractCost,
      postRenewalContractCost: null,
      costByPosition: {
        P: { preRenewal: 0, postRenewal: null },
        D: { preRenewal: 0, postRenewal: null },
        C: { preRenewal: 0, postRenewal: null },
        A: { preRenewal: 0, postRenewal: null },
      },
      isConsolidated: false,
      consolidatedAt: null,
      preConsolidationBudget: null,
      totalReleaseCosts: snap.totalReleaseCosts ?? null,
      totalIndemnities: snap.totalIndemnities ?? null,
      totalRenewalCosts: snap.totalRenewalCosts ?? null,
    }
  })

  // Fetch available sessions (same as main function)
  const marketSessions = await prisma.marketSession.findMany({
    where: { leagueId },
    select: { id: true, type: true, currentPhase: true, status: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })

  return {
    success: true,
    data: {
      leagueName: league?.name,
      maxSlots,
      teams: teamsData,
      isAdmin: membership.role === MemberRole.ADMIN,
      inContrattiPhase: false,
      availableSessions: marketSessions.map(s => ({
        id: s.id,
        sessionType: s.type,
        currentPhase: s.currentPhase,
        status: s.status,
        createdAt: s.createdAt,
      })),
      // Flag per il frontend: stiamo mostrando dati storici
      isHistorical: true,
      historicalSessionType: session?.type,
      historicalPhase: session?.currentPhase,
    },
  }
}

/**
 * Get financial dashboard data for all teams in a league (#190, #193)
 * Includes pre/post renewal contract costs when in CONTRATTI phase
 */
export async function getLeagueFinancials(leagueId: string, userId: string, sessionId?: string): Promise<ServiceResult> {
  try {
    // Verify user is a member of the league
    const membership = await prisma.leagueMember.findFirst({
      where: {
        leagueId,
        userId,
        status: MemberStatus.ACTIVE,
      },
    })

    if (!membership) {
      return { success: false, message: 'Non sei membro di questa lega' }
    }

    // OSS-6: If sessionId is provided, try to return historical snapshot data
    // Falls back to live data if no snapshots exist (e.g. session still active)
    if (sessionId) {
      const snapshotResult = await getLeagueFinancialsSnapshot(leagueId, membership, sessionId)
      if (snapshotResult) return snapshotResult
      // No snapshots → fall through to live data
    }

    // Check if we're in CONTRATTI phase (#193)
    const activeContrattiSession = await prisma.marketSession.findFirst({
      where: {
        leagueId,
        status: 'ACTIVE',
        currentPhase: 'CONTRATTI',
      },
    })
    const inContrattiPhase = !!activeContrattiSession

    // Get consolidation status for all members if in CONTRATTI phase
    let consolidationMap = new Map<string, Date | null>()
    if (inContrattiPhase && activeContrattiSession) {
      const consolidations = await prisma.contractConsolidation.findMany({
        where: { sessionId: activeContrattiSession.id },
      })
      consolidationMap = new Map(consolidations.map(c => [c.memberId, c.consolidatedAt]))
    }

    // Get the most recent active session to fetch snapshot data (tagli, indennizzi)
    const activeSession = await prisma.marketSession.findFirst({
      where: { leagueId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    })

    // Fetch ManagerSessionSnapshot data for each member
    // PHASE_START: valori pre-consolidamento (usati per "congelare" i dati durante CONTRATTI)
    // PHASE_END: tagli/indennizzi (usati per report post-consolidamento)
    const phaseStartMap = new Map<string, { budget: number; totalSalaries: number; contractCount: number }>()
    const phaseEndMap = new Map<string, { totalReleaseCosts: number | null; totalIndemnities: number | null; totalRenewalCosts: number | null; preConsolidationBudget: number | null }>()
    if (activeSession) {
      const snapshots = await prisma.managerSessionSnapshot.findMany({
        where: {
          marketSessionId: activeSession.id,
          snapshotType: { in: ['PHASE_START', 'PHASE_END'] },
        },
      })
      for (const snap of snapshots) {
        if (snap.snapshotType === 'PHASE_START') {
          phaseStartMap.set(snap.leagueMemberId, {
            budget: snap.budget,
            totalSalaries: snap.totalSalaries,
            contractCount: snap.contractCount,
          })
        } else if (snap.snapshotType === 'PHASE_END') {
          phaseEndMap.set(snap.leagueMemberId, {
            totalReleaseCosts: snap.totalReleaseCosts,
            totalIndemnities: snap.totalIndemnities,
            totalRenewalCosts: snap.totalRenewalCosts,
            preConsolidationBudget: snap.budget,
          })
        }
      }
    }
    // Backwards compatibility: use phaseEndMap as snapshotMap for existing code
    const snapshotMap = phaseEndMap

    // Fetch accepted trade budget transfers for this league's active session
    const tradeBudgetMap = new Map<string, { budgetIn: number; budgetOut: number }>()
    if (activeSession) {
      const acceptedTrades = await prisma.tradeOffer.findMany({
        where: {
          marketSessionId: activeSession.id,
          status: 'ACCEPTED',
          OR: [{ offeredBudget: { gt: 0 } }, { requestedBudget: { gt: 0 } }],
        },
        select: { senderId: true, receiverId: true, offeredBudget: true, requestedBudget: true },
      })
      for (const trade of acceptedTrades) {
        // senderId/receiverId are User IDs - we'll map to member IDs later
        // offeredBudget: sender pays to receiver
        // requestedBudget: receiver pays to sender
        const sKey = `user:${trade.senderId}`
        const rKey = `user:${trade.receiverId}`
        const sExisting = tradeBudgetMap.get(sKey) || { budgetIn: 0, budgetOut: 0 }
        sExisting.budgetOut += trade.offeredBudget
        sExisting.budgetIn += trade.requestedBudget
        tradeBudgetMap.set(sKey, sExisting)
        const rExisting = tradeBudgetMap.get(rKey) || { budgetIn: 0, budgetOut: 0 }
        rExisting.budgetIn += trade.offeredBudget
        rExisting.budgetOut += trade.requestedBudget
        tradeBudgetMap.set(rKey, rExisting)
      }
    }

    // Durante CONTRATTI, recupera i salari dei giocatori rilasciati da ContractHistory
    // Questi dati sono necessari per calcolare i totali pre-consolidamento
    const releasedSalariesMap = new Map<string, { totalSalary: number; count: number }>()
    if (inContrattiPhase && activeContrattiSession) {
      const releaseHistory = await prisma.contractHistory.findMany({
        where: {
          marketSessionId: activeContrattiSession.id,
          eventType: { in: ['RELEASE_NORMAL', 'RELEASE_ESTERO', 'RELEASE_RETROCESSO'] },
        },
        select: {
          leagueMemberId: true,
          previousSalary: true,
        },
      })
      for (const h of releaseHistory) {
        const existing = releasedSalariesMap.get(h.leagueMemberId) || { totalSalary: 0, count: 0 }
        existing.totalSalary += h.previousSalary || 0
        existing.count += 1
        releasedSalariesMap.set(h.leagueMemberId, existing)
      }
    }

    // Get all active members with their rosters and contracts (including draft values for #193)
    // Durante CONTRATTI, include anche i roster RELEASED per mostrare lo stato pre-consolidamento
    const members = await prisma.leagueMember.findMany({
      where: {
        leagueId,
        status: MemberStatus.ACTIVE,
      },
      include: {
        user: {
          select: { username: true },
        },
        roster: {
          // Durante CONTRATTI, include anche RELEASED per mostrare stato pre-consolidamento
          where: inContrattiPhase
            ? { status: { in: ['ACTIVE', 'RELEASED'] } }
            : { status: 'ACTIVE' },
          select: {
            status: true,
            acquisitionPrice: true,
            player: {
              select: {
                id: true,
                name: true,
                team: true,
                position: true,
                quotation: true,
                age: true,
              },
            },
            contract: {
              select: {
                salary: true,
                duration: true,
                rescissionClause: true,
                draftSalary: true,
                draftDuration: true,
                draftReleased: true,
                // Pre-consolidation values for privacy during CONTRATTI phase
                preConsolidationSalary: true,
                preConsolidationDuration: true,
              },
            },
          },
        },
      },
      orderBy: { teamName: 'asc' },
    })

    // Get league settings for slot limit
    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      select: {
        name: true,
        goalkeeperSlots: true,
        defenderSlots: true,
        midfielderSlots: true,
        forwardSlots: true,
      },
    })

    // Calculate max slots from individual position slots
    const maxSlots = league
      ? (league.goalkeeperSlots + league.defenderSlots + league.midfielderSlots + league.forwardSlots)
      : 25

    // Verifica se TUTTI i manager hanno consolidato
    const allMembersConsolidated = inContrattiPhase
      ? members.every(m => consolidationMap.has(m.id))
      : false

    // Calculate financial data for each team
    const teamsData = members.map(member => {
      const isConsolidated = consolidationMap.has(member.id)
      const consolidatedAt = consolidationMap.get(member.id) || null
      const isOwnTeam = member.id === membership.id

      // MODIFICA: Durante fase CONTRATTI, la pagina Finanze NON mostra mai i valori draft/post-rinnovo
      // I nuovi valori saranno visibili solo dopo che l'admin avanza la fase
      // canSeeDraft è sempre false per la pagina Finanze durante CONTRATTI
      const canSeeDraft = false // Era: inContrattiPhase && !isConsolidated && isOwnTeam

      const players = member.roster.map(r => {
        // MODIFICA: Durante fase CONTRATTI, mostra SEMPRE i valori pre-consolidamento
        // per TUTTI i team (incluso il proprio), così il tabellone rimane "congelato"
        // fino a quando l'admin non avanza la fase
        let preRenewalSalary: number
        if (inContrattiPhase && isConsolidated && r.contract?.preConsolidationSalary != null) {
          // Team che ha consolidato: mostra il valore PRE-consolidamento
          preRenewalSalary = r.contract.preConsolidationSalary
        } else {
          // Team non ancora consolidato: mostra il valore corrente (che è ancora quello pre-fase)
          preRenewalSalary = r.contract?.salary || 0
        }

        // Post-rinnovo: NON mostrare nella pagina Finanze durante CONTRATTI
        // I valori draft sono visibili solo nella pagina Contratti
        const postRenewalSalary: number | null = null

        // Salary to display in the main column:
        // Durante CONTRATTI: sempre valore pre-consolidamento (congelato)
        // Dopo CONTRATTI: valore corrente (aggiornato)
        let displaySalary: number
        if (inContrattiPhase && isConsolidated && r.contract?.preConsolidationSalary != null) {
          // Team consolidato durante CONTRATTI: mostra pre-consolidamento
          displaySalary = r.contract.preConsolidationSalary
        } else {
          // Team non consolidato o fuori da CONTRATTI: mostra valore corrente
          displaySalary = r.contract?.salary || 0
        }

        // Duration logic (same as salary)
        let displayDuration: number
        if (inContrattiPhase && isConsolidated && r.contract?.preConsolidationDuration != null) {
          displayDuration = r.contract.preConsolidationDuration
        } else {
          displayDuration = r.contract?.duration || 0
        }

        return {
          id: r.player.id,
          name: r.player.name,
          team: r.player.team,
          position: r.player.position,
          quotation: r.player.quotation,
          age: r.player.age,
          salary: displaySalary,
          duration: displayDuration,
          clause: r.contract?.rescissionClause || 0,
          // #193: Pre/Post renewal values
          preRenewalSalary,
          postRenewalSalary,
          draftDuration: canSeeDraft ? (r.contract?.draftDuration ?? null) : null,
          draftReleased: canSeeDraft ? (r.contract?.draftReleased ?? false) : false,
        }
      })

      // Logica per calcolare annualContractCost e slotCount:
      // - Se TUTTI hanno consolidato: mostra dati POST-consolidamento (salari attuali)
      // - Se NON tutti hanno consolidato: mostra dati PRE-consolidamento (congelati)
      // - Fuori da CONTRATTI: mostra dati attuali
      let annualContractCost: number
      let slotCount: number

      // Filtra solo giocatori ACTIVE
      const activePlayers = players.filter(p => {
        const rosterEntry = member.roster.find(r => r.player.id === p.id)
        return rosterEntry?.status === 'ACTIVE'
      })

      if (inContrattiPhase && !allMembersConsolidated) {
        // NON tutti hanno consolidato: mostra dati PRE-consolidamento (congelati)
        // Usa preRenewalSalary e aggiungi i salari dei rilasciati
        const activeRosterSalaries = activePlayers.reduce((sum, p) => sum + p.preRenewalSalary, 0)
        const releasedData = releasedSalariesMap.get(member.id)
        const releasedSalaries = releasedData?.totalSalary || 0
        const releasedCount = releasedData?.count || 0

        annualContractCost = activeRosterSalaries + releasedSalaries
        slotCount = activePlayers.length + releasedCount
      } else {
        // TUTTI hanno consolidato OPPURE fuori da CONTRATTI: mostra dati POST-consolidamento (attuali)
        annualContractCost = activePlayers.reduce((sum, p) => sum + p.salary, 0)
        slotCount = activePlayers.length
      }

      const totalContractCost = players.reduce((sum, p) => sum + (p.salary * p.duration), 0)

      // #193: Pre-renewal cost - include i salari dei giocatori rilasciati
      const releasedData = releasedSalariesMap.get(member.id)
      const releasedSalaries = releasedData?.totalSalary || 0
      const basePreRenewalCost = players
        .filter(p => {
          const rosterEntry = member.roster.find(r => r.player.id === p.id)
          return rosterEntry?.status === 'ACTIVE'
        })
        .reduce((sum, p) => sum + p.preRenewalSalary, 0)
      const preRenewalContractCost = basePreRenewalCost + releasedSalaries

      // #193: Post-renewal cost (draft salaries where available, original otherwise)
      // Only calculated during CONTRATTI phase and only visible to owner
      let postRenewalContractCost: number | null = null
      if (canSeeDraft) {
        postRenewalContractCost = players.reduce((sum, p) => {
          // If player is marked for release, don't count them
          if (p.draftReleased) return sum
          // Use draft salary if available, otherwise original
          return sum + (p.postRenewalSalary ?? p.preRenewalSalary)
        }, 0)
      }

      // #193: Calculate cost by position for drill-down
      const costByPosition = {
        P: { preRenewal: 0, postRenewal: null as number | null },
        D: { preRenewal: 0, postRenewal: null as number | null },
        C: { preRenewal: 0, postRenewal: null as number | null },
        A: { preRenewal: 0, postRenewal: null as number | null },
      }

      for (const p of players) {
        const pos = p.position as 'P' | 'D' | 'C' | 'A'
        if (costByPosition[pos]) {
          costByPosition[pos].preRenewal += p.preRenewalSalary
          // FIX: Only show post-renewal cost to owner
          if (canSeeDraft && !p.draftReleased) {
            if (costByPosition[pos].postRenewal === null) {
              costByPosition[pos].postRenewal = 0
            }
            costByPosition[pos].postRenewal += (p.postRenewalSalary ?? p.preRenewalSalary)
          }
        }
      }

      // Age distribution
      const under20 = players.filter(p => p.age != null && p.age < 20).length
      const under25 = players.filter(p => p.age != null && p.age >= 20 && p.age < 25).length
      const under30 = players.filter(p => p.age != null && p.age >= 25 && p.age < 30).length
      const over30 = players.filter(p => p.age != null && p.age >= 30).length
      const ageUnknown = players.filter(p => p.age == null).length

      // Position distribution
      const byPosition = {
        P: players.filter(p => p.position === 'P').length,
        D: players.filter(p => p.position === 'D').length,
        C: players.filter(p => p.position === 'C').length,
        A: players.filter(p => p.position === 'A').length,
      }

      // Budget display:
      // Se preConsolidationBudget è disponibile, usarlo SEMPRE come budget nel tabellone.
      // Tagli e indennizzi vengono mostrati separatamente nelle colonne dedicate.
      // Formula: Bilancio = Budget(pre) - Ingaggi - Tagli + Indennizzi
      // Nota: non dipendere da isConsolidated perché consolidationMap è vuoto fuori da CONTRATTI
      let displayBudget: number
      if (member.preConsolidationBudget != null) {
        displayBudget = member.preConsolidationBudget
      } else {
        displayBudget = member.currentBudget
      }

      // Get snapshot data for this member (tagli, indennizzi)
      const snapshot = snapshotMap.get(member.id)

      // OSS-6: Calculate total acquisition cost (sum of auction prices paid for active roster)
      const totalAcquisitionCost = member.roster
        .filter(r => r.status === 'ACTIVE')
        .reduce((sum, r) => sum + (r.acquisitionPrice || 0), 0)

      return {
        memberId: member.id,
        teamName: member.teamName || member.user.username,
        username: member.user.username,
        budget: displayBudget,
        annualContractCost,
        totalContractCost,
        totalAcquisitionCost,
        slotCount,
        slotsFree: maxSlots - slotCount,
        maxSlots,
        ageDistribution: {
          under20,
          under25,
          under30,
          over30,
          unknown: ageUnknown,
        },
        positionDistribution: byPosition,
        players, // Include player details for drill-down
        // #193: Pre/Post renewal data
        preRenewalContractCost,
        postRenewalContractCost,
        costByPosition,
        isConsolidated,
        consolidatedAt,
        // New: Detailed financial breakdown from session snapshot
        preConsolidationBudget: member.preConsolidationBudget ?? snapshot?.preConsolidationBudget ?? null,
        totalReleaseCosts: snapshot?.totalReleaseCosts ?? null,
        totalIndemnities: snapshot?.totalIndemnities ?? null,
        totalRenewalCosts: snapshot?.totalRenewalCosts ?? null,
        // Trade budget transfers
        tradeBudgetIn: tradeBudgetMap.get(`user:${member.userId}`)?.budgetIn ?? 0,
        tradeBudgetOut: tradeBudgetMap.get(`user:${member.userId}`)?.budgetOut ?? 0,
      }
    })

    // OSS-6: Fetch available market sessions for phase selector (storicita)
    const marketSessions = await prisma.marketSession.findMany({
      where: { leagueId },
      select: {
        id: true,
        type: true,
        currentPhase: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    const availableSessions = marketSessions.map(s => ({
      id: s.id,
      sessionType: s.type,
      currentPhase: s.currentPhase,
      status: s.status,
      createdAt: s.createdAt,
    }))

    return {
      success: true,
      data: {
        leagueName: league?.name,
        maxSlots,
        teams: teamsData,
        isAdmin: membership.role === MemberRole.ADMIN,
        // #193: Phase info
        inContrattiPhase,
        // OSS-6: Available sessions for phase selector
        availableSessions,
      },
    }
  } catch (error) {
    return { success: false, message: `Errore nel caricamento dati finanziari: ${(error as Error).message}` }
  }
}

// ============================================================================
// Financial Timeline - Level 4 drill-down
// ============================================================================

export async function getFinancialTimeline(
  leagueId: string,
  userId: string,
  memberId?: string,
) {
  try {
    // Verify membership
    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      include: {
        members: {
          where: { status: MemberStatus.ACTIVE },
          include: { user: { select: { id: true, username: true } } },
        },
      },
    })

    if (!league) return { success: false, message: 'Lega non trovata' }

    const membership = league.members.find(m => m.userId === userId)
    if (!membership) return { success: false, message: 'Non sei membro di questa lega' }

    // Get target member (default to self if not specified)
    const targetMemberId = memberId || membership.id
    const targetMember = league.members.find(m => m.id === targetMemberId)
    if (!targetMember) return { success: false, message: 'Membro non trovato' }

    // Fetch contract history for this member
    const contractHistory = await prisma.contractHistory.findMany({
      where: { leagueMemberId: targetMemberId },
      include: {
        player: { select: { id: true, name: true, position: true, quotation: true } },
        marketSession: { select: { id: true, type: true, currentPhase: true, status: true, createdAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Fetch session snapshots for this member
    const snapshots = await prisma.managerSessionSnapshot.findMany({
      where: { leagueMemberId: targetMemberId },
      include: {
        marketSession: { select: { id: true, type: true, currentPhase: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    // Fetch accepted trades involving this member
    const trades = await prisma.tradeOffer.findMany({
      where: {
        marketSession: { leagueId },
        status: TradeStatus.ACCEPTED,
        OR: [
          { senderId: targetMember.userId },
          { receiverId: targetMember.userId },
        ],
      },
      include: {
        sender: { select: { id: true, username: true } },
        receiver: { select: { id: true, username: true } },
        marketSession: { select: { id: true, type: true, currentPhase: true } },
      },
      orderBy: { respondedAt: 'desc' },
    })

    // Build timeline entries
    const EVENT_TYPE_LABELS: Record<string, string> = {
      SESSION_START_SNAPSHOT: 'Inizio Sessione',
      DURATION_DECREMENT: 'Decremento Durata',
      AUTO_RELEASE_EXPIRED: 'Svincolo Automatico',
      RENEWAL: 'Rinnovo',
      SPALMA: 'Spalma',
      RELEASE_NORMAL: 'Taglio',
      RELEASE_ESTERO: 'Taglio (Estero)',
      RELEASE_RETROCESSO: 'Taglio (Retrocesso)',
      KEEP_ESTERO: 'Mantenuto (Estero)',
      KEEP_RETROCESSO: 'Mantenuto (Retrocesso)',
      INDEMNITY_RECEIVED: 'Indennizzo Ricevuto',
    }

    const EVENT_TYPE_COLORS: Record<string, string> = {
      SESSION_START_SNAPSHOT: 'blue',
      DURATION_DECREMENT: 'gray',
      AUTO_RELEASE_EXPIRED: 'red',
      RENEWAL: 'amber',
      SPALMA: 'purple',
      RELEASE_NORMAL: 'red',
      RELEASE_ESTERO: 'red',
      RELEASE_RETROCESSO: 'red',
      KEEP_ESTERO: 'green',
      KEEP_RETROCESSO: 'green',
      INDEMNITY_RECEIVED: 'green',
    }

    const timelineEvents = contractHistory.map(ch => ({
      id: ch.id,
      type: 'contract' as const,
      eventType: ch.eventType,
      label: EVENT_TYPE_LABELS[ch.eventType] || ch.eventType,
      color: EVENT_TYPE_COLORS[ch.eventType] || 'gray',
      playerName: ch.player.name,
      playerPosition: ch.player.position,
      previousSalary: ch.previousSalary,
      previousDuration: ch.previousDuration,
      previousClause: ch.previousClause,
      newSalary: ch.newSalary,
      newDuration: ch.newDuration,
      newClause: ch.newClause,
      cost: ch.cost,
      income: ch.income,
      notes: ch.notes,
      sessionType: ch.marketSession.type,
      sessionPhase: ch.marketSession.currentPhase,
      createdAt: ch.createdAt.toISOString(),
    }))

    const tradeEvents = trades.map(t => {
      const isSender = t.senderId === targetMember.userId
      return {
        id: t.id,
        type: 'trade' as const,
        eventType: 'TRADE',
        label: 'Scambio',
        color: 'purple',
        isSender,
        counterpart: isSender ? t.receiver.username : t.sender.username,
        offeredBudget: t.offeredBudget,
        requestedBudget: t.requestedBudget,
        offeredPlayers: t.offeredPlayers,
        requestedPlayers: t.requestedPlayers,
        sessionType: t.marketSession.type,
        sessionPhase: t.marketSession.currentPhase,
        createdAt: (t.respondedAt || t.createdAt).toISOString(),
      }
    })

    // Snapshot trend data
    const trendData = snapshots.map(s => ({
      id: s.id,
      type: s.snapshotType,
      budget: s.budget,
      totalSalaries: s.totalSalaries,
      balance: s.balance,
      totalIndemnities: s.totalIndemnities,
      totalReleaseCosts: s.totalReleaseCosts,
      contractCount: s.contractCount,
      sessionType: s.marketSession.type,
      sessionPhase: s.marketSession.currentPhase,
      createdAt: s.createdAt.toISOString(),
    }))

    return {
      success: true,
      data: {
        memberId: targetMemberId,
        teamName: targetMember.teamName,
        username: targetMember.user.username,
        events: [...timelineEvents, ...tradeEvents].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ),
        trendData,
      },
    }
  } catch (error) {
    return { success: false, message: `Errore nel caricamento timeline: ${(error as Error).message}` }
  }
}

// ============================================================================
// Financial Trends - historical balance data for all teams
// ============================================================================

export async function getFinancialTrends(leagueId: string, userId: string) {
  try {
    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      include: {
        members: {
          where: { status: MemberStatus.ACTIVE },
          select: { id: true, userId: true, teamName: true },
        },
      },
    })

    if (!league) return { success: false, message: 'Lega non trovata' }

    const membership = league.members.find(m => m.userId === userId)
    if (!membership) return { success: false, message: 'Non sei membro di questa lega' }

    // Get all snapshots for all members
    const allSnapshots = await prisma.managerSessionSnapshot.findMany({
      where: {
        leagueMemberId: { in: league.members.map(m => m.id) },
      },
      include: {
        marketSession: { select: { id: true, type: true, currentPhase: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    // Group by member
    const memberMap = new Map(league.members.map(m => [m.id, m]))
    const trends: Record<string, Array<{
      snapshotType: string
      budget: number
      totalSalaries: number
      balance: number
      sessionType: string
      sessionPhase: string | null
      createdAt: string
    }>> = {}

    for (const snap of allSnapshots) {
      const member = memberMap.get(snap.leagueMemberId)
      if (!member) continue
      const key = member.teamName
      if (!trends[key]) trends[key] = []
      trends[key].push({
        snapshotType: snap.snapshotType,
        budget: snap.budget,
        totalSalaries: snap.totalSalaries,
        balance: snap.balance,
        sessionType: snap.marketSession.type,
        sessionPhase: snap.marketSession.currentPhase,
        createdAt: snap.createdAt.toISOString(),
      })
    }

    return {
      success: true,
      data: { trends },
    }
  } catch (error) {
    return { success: false, message: `Errore nel caricamento trends: ${(error as Error).message}` }
  }
}

// ==================== STRATEGY SUMMARY ====================

export async function getStrategySummary(leagueId: string, userId: string): Promise<ServiceResult> {
  try {
    const member = await prisma.leagueMember.findFirst({
      where: {
        leagueId,
        userId,
        status: MemberStatus.ACTIVE,
      },
    })

    if (!member) {
      return { success: false, message: 'Non sei membro di questa lega' }
    }

    const counts = await prisma.rubataPreference.groupBy({
      by: ['watchlistCategory'],
      where: { memberId: member.id, isWatchlist: true },
      _count: true,
    })

    const topPriority = await prisma.rubataPreference.count({
      where: { memberId: member.id, priority: { gte: 8 } },
    })

    let targets = 0
    let watching = 0
    let toSell = 0
    let total = 0

    for (const row of counts) {
      const count = row._count
      total += count
      switch (row.watchlistCategory) {
        case 'DA_RUBARE': targets += count; break
        case 'SOTTO_OSSERVAZIONE': watching += count; break
        case 'DA_VENDERE': toSell += count; break
      }
    }

    return {
      success: true,
      data: { targets, topPriority, watching, toSell, total },
    }
  } catch (error) {
    return { success: false, message: `Errore nel caricamento strategie: ${(error as Error).message}` }
  }
}
