import { PrismaClient, MemberStatus, InviteStatus, JoinType } from '@prisma/client'
import { randomBytes } from 'crypto'
import { createEmailService } from '../modules/identity/infrastructure/services/email.factory'

const prisma = new PrismaClient()
const emailService = createEmailService()

export interface ServiceResult {
  success: boolean
  message?: string
  data?: unknown
}

// ==================== GENERA TOKEN ====================

function generateInviteToken(): string {
  return randomBytes(32).toString('hex')
}

// ==================== INVITA VIA EMAIL ====================

export async function createEmailInvite(
  leagueId: string,
  adminUserId: string,
  emailOrUsername: string,
  expiresInDays: number = 7
): Promise<ServiceResult> {
  // Se l'input non contiene @, cerca per username e usa la sua email
  let email = emailOrUsername
  if (!emailOrUsername.includes('@')) {
    const userByUsername = await prisma.user.findFirst({
      where: { username: { equals: emailOrUsername, mode: 'insensitive' } },
    })
    if (!userByUsername) {
      return { success: false, message: `Utente "${emailOrUsername}" non trovato` }
    }
    email = userByUsername.email
  }

  // Verifica che l'utente sia admin della lega
  const adminMember = await prisma.leagueMember.findFirst({
    where: {
      leagueId,
      userId: adminUserId,
      role: 'ADMIN',
      status: MemberStatus.ACTIVE,
    },
  })

  if (!adminMember) {
    return { success: false, message: 'Non autorizzato' }
  }

  // Verifica che la lega sia in stato DRAFT
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: {
      members: { where: { status: MemberStatus.ACTIVE } },
    },
  })

  if (!league) {
    return { success: false, message: 'Lega non trovata' }
  }

  if (league.status !== 'DRAFT') {
    return { success: false, message: 'La lega è già stata avviata, non puoi invitare nuovi membri' }
  }

  // Verifica che l'email non sia già un membro attivo
  const existingUser = await prisma.user.findUnique({ where: { email } })
  if (existingUser) {
    const existingMember = await prisma.leagueMember.findFirst({
      where: {
        leagueId,
        userId: existingUser.id,
        status: { in: [MemberStatus.ACTIVE, MemberStatus.PENDING] },
      },
    })
    if (existingMember) {
      return { success: false, message: 'Questo utente è già membro o ha una richiesta pendente' }
    }
  }

  // Verifica se esiste già un invito per questa email in questa lega
  const existingInvite = await prisma.leagueInvite.findFirst({
    where: {
      leagueId,
      email,
    },
  })

  if (existingInvite) {
    // Se l'invito è ancora PENDING, non permettere di crearne un altro
    if (existingInvite.status === InviteStatus.PENDING) {
      return { success: false, message: 'Esiste già un invito pendente per questa email' }
    }

    // Se l'invito è CANCELLED o EXPIRED, aggiornalo invece di crearne uno nuovo
    // (vincolo unique su leagueId + email)
  }

  // Genera nuovo token e scadenza
  const token = generateInviteToken()
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + expiresInDays)

  // Crea o aggiorna l'invito
  const invite = existingInvite
    ? await prisma.leagueInvite.update({
        where: { id: existingInvite.id },
        data: {
          token,
          invitedBy: adminUserId,
          expiresAt,
          status: InviteStatus.PENDING,
          acceptedAt: null,
        },
        include: {
          league: { select: { name: true } },
          inviter: { select: { username: true } },
        },
      })
    : await prisma.leagueInvite.create({
        data: {
          leagueId,
          email,
          token,
          invitedBy: adminUserId,
          expiresAt,
        },
        include: {
          league: { select: { name: true } },
          inviter: { select: { username: true } },
        },
      })

  // Invia email di invito
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
  // Se l'utente non esiste, usa URL di registrazione con token invito
  const inviteUrl = existingUser
    ? `${baseUrl}/join`
    : `${baseUrl}/register?invite=${token}`

  try {
    await emailService.sendLeagueInviteEmail(
      email,
      invite.league.name,
      invite.inviter.username,
      token,
      inviteUrl,
      expiresAt
    )
    console.log(`[InviteService] Email sent to ${email} for league ${invite.league.name}${!existingUser ? ' (unregistered user)' : ''}`)
  } catch (err) {
    console.error('[InviteService] Failed to send invite email:', err)
    // Non blocchiamo la creazione dell'invito se l'email fallisce
  }

  return {
    success: true,
    message: existingUser ? 'Invito creato con successo' : 'Invito creato. L\'utente dovra registrarsi prima di accettare.',
    data: {
      id: invite.id,
      email: invite.email,
      token: invite.token,
      expiresAt: invite.expiresAt,
      leagueName: invite.league.name,
      inviteLink: `/join/${invite.token}`,
      isNewUser: !existingUser,
    },
  }
}

// ==================== ACCETTA INVITO ====================

export async function acceptInvite(
  token: string,
  userId: string,
  teamName: string
): Promise<ServiceResult> {
  // Trova l'invito
  const invite = await prisma.leagueInvite.findUnique({
    where: { token },
    include: {
      league: {
        include: {
          members: { where: { status: MemberStatus.ACTIVE } },
        },
      },
    },
  })

  if (!invite) {
    return { success: false, message: 'Invito non trovato' }
  }

  if (invite.status !== InviteStatus.PENDING) {
    return { success: false, message: 'Questo invito non è più valido' }
  }

  if (new Date() > invite.expiresAt) {
    await prisma.leagueInvite.update({
      where: { id: invite.id },
      data: { status: InviteStatus.EXPIRED },
    })
    return { success: false, message: 'Questo invito è scaduto' }
  }

  // Verifica che la lega sia ancora in DRAFT
  if (invite.league.status !== 'DRAFT') {
    return { success: false, message: 'La lega è già stata avviata' }
  }

  // Verifica che l'utente abbia l'email giusta
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user || user.email !== invite.email) {
    return { success: false, message: 'Questo invito è per un altro indirizzo email' }
  }

  // Verifica che non sia già membro
  const existingMember = await prisma.leagueMember.findFirst({
    where: {
      leagueId: invite.leagueId,
      userId,
      status: { in: [MemberStatus.ACTIVE, MemberStatus.PENDING] },
    },
  })

  if (existingMember) {
    return { success: false, message: 'Sei già membro di questa lega' }
  }

  // Verifica numero massimo partecipanti
  if (invite.league.members.length >= invite.league.maxParticipants) {
    return { success: false, message: 'La lega ha raggiunto il numero massimo di partecipanti' }
  }

  // Get admin member for email notification (#53)
  const adminMember = await prisma.leagueMember.findFirst({
    where: {
      leagueId: invite.leagueId,
      role: 'ADMIN',
      status: MemberStatus.ACTIVE,
    },
    include: { user: { select: { email: true } } },
  })

  // Crea il membro (ACTIVE direttamente, senza approvazione)
  const member = await prisma.leagueMember.create({
    data: {
      userId,
      leagueId: invite.leagueId,
      role: 'MANAGER',
      status: MemberStatus.ACTIVE,
      joinType: JoinType.INVITE,
      currentBudget: invite.league.initialBudget,
      teamName,
    },
  })

  // Aggiorna l'invito
  await prisma.leagueInvite.update({
    where: { id: invite.id },
    data: {
      status: InviteStatus.ACCEPTED,
      acceptedAt: new Date(),
    },
  })

  // Send email notification to admin (#53)
  if (adminMember?.user?.email) {
    try {
      const leagueUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/leagues/${invite.leagueId}`
      await emailService.sendInviteResponseNotificationEmail(
        adminMember.user.email,
        invite.league.name,
        user.email.split('@')[0], // username approximation from email
        true, // accepted
        leagueUrl
      )
    } catch (err) {
      console.error('[InviteService] Failed to send invite acceptance notification:', err)
    }
  }

  return {
    success: true,
    message: 'Sei entrato nella lega!',
    data: {
      memberId: member.id,
      leagueId: invite.leagueId,
      leagueName: invite.league.name,
    },
  }
}

// ==================== OTTIENI INVITI PENDENTI ====================

export async function getPendingInvites(
  leagueId: string,
  adminUserId: string
): Promise<ServiceResult> {
  // Verifica admin
  const adminMember = await prisma.leagueMember.findFirst({
    where: {
      leagueId,
      userId: adminUserId,
      role: 'ADMIN',
      status: MemberStatus.ACTIVE,
    },
  })

  if (!adminMember) {
    return { success: false, message: 'Non autorizzato' }
  }

  const invites = await prisma.leagueInvite.findMany({
    where: {
      leagueId,
      status: InviteStatus.PENDING,
    },
    include: {
      inviter: { select: { username: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return {
    success: true,
    data: invites.map(inv => ({
      id: inv.id,
      email: inv.email,
      invitedBy: inv.inviter.username,
      expiresAt: inv.expiresAt,
      createdAt: inv.createdAt,
    })),
  }
}

// ==================== ANNULLA INVITO ====================

export async function cancelInvite(
  inviteId: string,
  adminUserId: string
): Promise<ServiceResult> {
  const invite = await prisma.leagueInvite.findUnique({
    where: { id: inviteId },
    include: { league: true },
  })

  if (!invite) {
    return { success: false, message: 'Invito non trovato' }
  }

  // Verifica admin
  const adminMember = await prisma.leagueMember.findFirst({
    where: {
      leagueId: invite.leagueId,
      userId: adminUserId,
      role: 'ADMIN',
      status: MemberStatus.ACTIVE,
    },
  })

  if (!adminMember) {
    return { success: false, message: 'Non autorizzato' }
  }

  if (invite.status !== InviteStatus.PENDING) {
    return { success: false, message: 'Questo invito non può essere annullato' }
  }

  await prisma.leagueInvite.update({
    where: { id: inviteId },
    data: { status: InviteStatus.CANCELLED },
  })

  return { success: true, message: 'Invito annullato' }
}

// ==================== OTTIENI INFO INVITO (PUBBLICO) ====================

export async function getInviteInfo(token: string): Promise<ServiceResult> {
  const invite = await prisma.leagueInvite.findUnique({
    where: { token },
    include: {
      league: {
        select: {
          name: true,
          description: true,
          status: true,
          maxParticipants: true,
          members: {
            where: { status: MemberStatus.ACTIVE },
            select: { id: true },
          },
        },
      },
    },
  })

  if (!invite) {
    return { success: false, message: 'Invito non trovato' }
  }

  if (invite.status !== InviteStatus.PENDING) {
    return { success: false, message: 'Questo invito non è più valido' }
  }

  if (new Date() > invite.expiresAt) {
    return { success: false, message: 'Questo invito è scaduto' }
  }

  return {
    success: true,
    data: {
      email: invite.email,
      leagueName: invite.league.name,
      leagueDescription: invite.league.description,
      leagueStatus: invite.league.status,
      currentMembers: invite.league.members.length,
      maxMembers: invite.league.maxParticipants,
      expiresAt: invite.expiresAt,
    },
  }
}

// ==================== OTTIENI INFO INVITO DETTAGLIATO ====================

export async function getInviteInfoDetailed(token: string): Promise<ServiceResult> {
  const invite = await prisma.leagueInvite.findUnique({
    where: { token },
    include: {
      inviter: {
        select: {
          id: true,
          username: true,
          profilePhoto: true,
        },
      },
      league: {
        select: {
          id: true,
          name: true,
          description: true,
          status: true,
          minParticipants: true,
          maxParticipants: true,
          initialBudget: true,
          goalkeeperSlots: true,
          defenderSlots: true,
          midfielderSlots: true,
          forwardSlots: true,
          createdAt: true,
          members: {
            where: { status: MemberStatus.ACTIVE },
            select: {
              id: true,
              role: true,
              teamName: true,
              user: {
                select: {
                  id: true,
                  username: true,
                  profilePhoto: true,
                },
              },
            },
            orderBy: [
              { role: 'asc' },
              { joinedAt: 'asc' },
            ],
          },
        },
      },
    },
  })

  if (!invite) {
    return { success: false, message: 'Invito non trovato' }
  }

  if (invite.status !== InviteStatus.PENDING) {
    return { success: false, message: 'Questo invito non è più valido' }
  }

  if (new Date() > invite.expiresAt) {
    return { success: false, message: 'Questo invito è scaduto' }
  }

  // Find admin
  const admin = invite.league.members.find(m => m.role === 'ADMIN')

  return {
    success: true,
    data: {
      token: invite.token,
      email: invite.email,
      expiresAt: invite.expiresAt,
      createdAt: invite.createdAt,
      inviter: {
        username: invite.inviter.username,
        profilePhoto: invite.inviter.profilePhoto,
      },
      league: {
        id: invite.league.id,
        name: invite.league.name,
        description: invite.league.description,
        status: invite.league.status,
        createdAt: invite.league.createdAt,
        config: {
          minParticipants: invite.league.minParticipants,
          maxParticipants: invite.league.maxParticipants,
          initialBudget: invite.league.initialBudget,
          slots: {
            goalkeeper: invite.league.goalkeeperSlots,
            defender: invite.league.defenderSlots,
            midfielder: invite.league.midfielderSlots,
            forward: invite.league.forwardSlots,
          },
        },
        admin: admin ? {
          username: admin.user.username,
          teamName: admin.teamName,
          profilePhoto: admin.user.profilePhoto,
        } : null,
        members: invite.league.members.map(m => ({
          id: m.id,
          role: m.role,
          teamName: m.teamName,
          username: m.user.username,
          profilePhoto: m.user.profilePhoto,
        })),
        currentMembers: invite.league.members.length,
        availableSpots: invite.league.maxParticipants - invite.league.members.length,
      },
    },
  }
}

// ==================== INVITI PENDENTI PER UTENTE ====================

export async function getMyPendingInvites(userId: string): Promise<ServiceResult> {
  // Ottieni l'email dell'utente
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  })

  if (!user) {
    return { success: false, message: 'Utente non trovato' }
  }

  // Trova tutti gli inviti pendenti per questa email
  const invites = await prisma.leagueInvite.findMany({
    where: {
      email: user.email,
      status: InviteStatus.PENDING,
      expiresAt: { gt: new Date() }, // Non scaduti
    },
    include: {
      league: {
        select: {
          id: true,
          name: true,
          description: true,
          status: true,
          maxParticipants: true,
          members: {
            where: { status: MemberStatus.ACTIVE },
            select: { id: true },
          },
        },
      },
      inviter: {
        select: { username: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return {
    success: true,
    data: invites.map(inv => ({
      id: inv.id,
      token: inv.token,
      leagueId: inv.league.id,
      leagueName: inv.league.name,
      leagueDescription: inv.league.description,
      leagueStatus: inv.league.status,
      currentMembers: inv.league.members.length,
      maxMembers: inv.league.maxParticipants,
      invitedBy: inv.inviter.username,
      expiresAt: inv.expiresAt,
      createdAt: inv.createdAt,
    })),
  }
}

// ==================== RIFIUTA INVITO ====================

export async function rejectInvite(
  token: string,
  userId: string
): Promise<ServiceResult> {
  // Trova l'invito with league info
  const invite = await prisma.leagueInvite.findUnique({
    where: { token },
    include: { league: { select: { id: true, name: true } } },
  })

  if (!invite) {
    return { success: false, message: 'Invito non trovato' }
  }

  if (invite.status !== InviteStatus.PENDING) {
    return { success: false, message: 'Questo invito non è più valido' }
  }

  // Verifica che l'utente abbia l'email giusta
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user || user.email !== invite.email) {
    return { success: false, message: 'Questo invito è per un altro indirizzo email' }
  }

  // Get admin member for email notification (#53)
  const adminMember = await prisma.leagueMember.findFirst({
    where: {
      leagueId: invite.leagueId,
      role: 'ADMIN',
      status: MemberStatus.ACTIVE,
    },
    include: { user: { select: { email: true } } },
  })

  // Rifiuta l'invito
  await prisma.leagueInvite.update({
    where: { id: invite.id },
    data: { status: InviteStatus.CANCELLED },
  })

  // Send email notification to admin (#53)
  if (adminMember?.user?.email) {
    try {
      const leagueUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/leagues/${invite.leagueId}`
      await emailService.sendInviteResponseNotificationEmail(
        adminMember.user.email,
        invite.league.name,
        user.email.split('@')[0], // username approximation from email
        false, // rejected
        leagueUrl
      )
    } catch (err) {
      console.error('[InviteService] Failed to send invite rejection notification:', err)
    }
  }

  return { success: true, message: 'Invito rifiutato' }
}
