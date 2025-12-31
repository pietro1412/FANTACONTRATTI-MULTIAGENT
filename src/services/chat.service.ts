import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Frasi random per simulazione chat
const RANDOM_MESSAGES = [
  "Questo giocatore vale oro!",
  "Troppo caro per me...",
  "Lo voglio a tutti i costi!",
  "Che rubata sarebbe!",
  "Non mi interessa",
  "Ottima scelta!",
  "Vai piano con le offerte!",
  "Lo compro io, statevi calmi",
  "Budget in esaurimento...",
  "Chi rilancia?",
  "Prezzo giusto",
  "Lo lascio passare",
  "Interessante...",
  "Forza, offrite!",
  "Mi sa che passo",
  "Top player!",
  "Flop assicurato",
  "Lo prendo io!",
  "Aspetto il prossimo",
  "Grande acquisto!",
]

export async function getMessages(sessionId: string, userId: string, since?: string) {
  // Verifica che l'utente sia membro della lega associata alla sessione
  const session = await prisma.marketSession.findUnique({
    where: { id: sessionId },
    include: {
      league: {
        include: {
          members: {
            where: { user: { id: userId }, status: 'ACTIVE' }
          }
        }
      }
    }
  })

  if (!session) {
    return { success: false, message: 'Sessione non trovata' }
  }

  if (session.league.members.length === 0) {
    return { success: false, message: 'Non sei membro di questa lega' }
  }

  // Costruisci la query per i messaggi
  const whereClause: { marketSessionId: string; createdAt?: { gt: Date } } = {
    marketSessionId: sessionId
  }

  if (since) {
    whereClause.createdAt = { gt: new Date(since) }
  }

  const messages = await prisma.chatMessage.findMany({
    where: whereClause,
    include: {
      member: {
        include: {
          user: {
            select: { username: true }
          }
        }
      }
    },
    orderBy: { createdAt: 'asc' },
    take: 100 // Limita a 100 messaggi
  })

  return {
    success: true,
    data: {
      messages: messages.map(m => ({
        id: m.id,
        content: m.content,
        isSystem: m.isSystem,
        createdAt: m.createdAt.toISOString(),
        member: {
          id: m.member.id,
          username: m.member.user.username,
          teamName: m.member.teamName
        }
      }))
    }
  }
}

export async function sendMessage(sessionId: string, userId: string, content: string) {
  // Verifica che l'utente sia membro della lega
  const session = await prisma.marketSession.findUnique({
    where: { id: sessionId },
    include: {
      league: {
        include: {
          members: {
            where: { user: { id: userId }, status: 'ACTIVE' }
          }
        }
      }
    }
  })

  if (!session) {
    return { success: false, message: 'Sessione non trovata' }
  }

  const membership = session.league.members[0]
  if (!membership) {
    return { success: false, message: 'Non sei membro di questa lega' }
  }

  // Crea il messaggio
  const message = await prisma.chatMessage.create({
    data: {
      marketSessionId: sessionId,
      memberId: membership.id,
      content,
      isSystem: false
    },
    include: {
      member: {
        include: {
          user: {
            select: { username: true }
          }
        }
      }
    }
  })

  return {
    success: true,
    data: {
      message: {
        id: message.id,
        content: message.content,
        isSystem: message.isSystem,
        createdAt: message.createdAt.toISOString(),
        member: {
          id: message.member.id,
          username: message.member.user.username,
          teamName: message.member.teamName
        }
      }
    }
  }
}

export async function sendRandomBotMessage(sessionId: string, userId: string) {
  // Verifica che l'utente sia admin della lega
  const session = await prisma.marketSession.findUnique({
    where: { id: sessionId },
    include: {
      league: {
        include: {
          members: {
            where: { status: 'ACTIVE' }
          }
        }
      }
    }
  })

  if (!session) {
    return { success: false, message: 'Sessione non trovata' }
  }

  const userMembership = session.league.members.find(m => m.userId === userId)
  if (!userMembership || userMembership.role !== 'ADMIN') {
    return { success: false, message: 'Non autorizzato' }
  }

  // Seleziona un membro random (escludendo l'admin che fa la richiesta)
  const otherMembers = session.league.members.filter(m => m.id !== userMembership.id)
  if (otherMembers.length === 0) {
    return { success: false, message: 'Nessun altro membro nella lega' }
  }

  const randomMember = otherMembers[Math.floor(Math.random() * otherMembers.length)]
  const randomMessage = RANDOM_MESSAGES[Math.floor(Math.random() * RANDOM_MESSAGES.length)]

  if (!randomMember || !randomMessage) {
    return { success: false, message: 'Nessun membro disponibile per la simulazione' }
  }

  // Crea il messaggio simulato
  const message = await prisma.chatMessage.create({
    data: {
      marketSessionId: sessionId,
      memberId: randomMember.id,
      content: randomMessage,
      isSystem: false
    },
    include: {
      member: {
        include: {
          user: {
            select: { username: true }
          }
        }
      }
    }
  })

  return {
    success: true,
    data: {
      message: {
        id: message.id,
        content: message.content,
        isSystem: message.isSystem,
        createdAt: message.createdAt.toISOString(),
        member: {
          id: message.member!.id,
          username: message.member!.user.username,
          teamName: message.member!.teamName
        }
      }
    }
  }
}
