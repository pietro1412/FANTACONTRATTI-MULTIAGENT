import { PrismaClient, MemberRole, MemberStatus, JoinType } from '@prisma/client'
import type { CreateLeagueInput, UpdateLeagueInput } from '../utils/validation'

const prisma = new PrismaClient()

export interface ServiceResult {
  success: boolean
  message?: string
  data?: unknown
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
        },
      },
    },
  })

  if (!league) {
    return { success: false, message: 'Lega non trovata' }
  }

  // Check if user is a member
  const membership = league.members.find(m => m.userId === userId)

  return {
    success: true,
    data: {
      league,
      userMembership: membership || null,
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

export async function requestJoinLeague(leagueId: string, userId: string, teamName?: string): Promise<ServiceResult> {
  // Check if league exists
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

  // Get target member
  const member = await prisma.leagueMember.findUnique({
    where: { id: memberId },
    include: { league: true },
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

    return { success: true, message: 'Membro accettato' }
  }

  if (action === 'reject' || action === 'kick') {
    await prisma.leagueMember.update({
      where: { id: memberId },
      data: { status: MemberStatus.LEFT },
    })

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

  // Verifica numero minimo partecipanti
  if (activeMembers < league.minParticipants) {
    return {
      success: false,
      message: `Servono almeno ${league.minParticipants} partecipanti per avviare la lega (attualmente ${activeMembers})`,
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
  const member = await prisma.leagueMember.findFirst({
    where: {
      leagueId,
      userId,
      status: MemberStatus.ACTIVE,
    },
    include: { league: true },
  })

  if (!member) {
    return { success: false, message: 'Non sei membro di questa lega' }
  }

  // BLOCCO POST-AVVIO: Non si può lasciare se la lega è ACTIVE
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

  // If in CONTRATTI phase, hide contract details for other managers
  const processedMembers = league.members.map(member => {
    if (hideOthersContracts && member.userId !== userId) {
      // Hide contract info for other managers during CONTRATTI phase
      return {
        ...member,
        roster: member.roster.map(r => ({
          ...r,
          contract: null, // Hide contract details
        })),
      }
    }
    return member
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
