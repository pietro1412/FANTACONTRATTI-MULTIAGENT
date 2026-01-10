import { PrismaClient, MemberStatus } from '@prisma/client'

const prisma = new PrismaClient()

export interface ServiceResult {
  success: boolean
  message?: string
  data?: unknown
}

// ==================== INIZIALIZZAZIONE FASE PREMI ====================

/**
 * Inizializza la configurazione della fase PREMI per una sessione
 * Crea automaticamente la categoria "Indennizzo Partenza Estero" con default 50M
 */
export async function initializePrizePhase(
  sessionId: string,
  adminUserId: string
): Promise<ServiceResult> {
  // Get session and verify admin
  const session = await prisma.marketSession.findUnique({
    where: { id: sessionId },
    include: { league: true },
  })

  if (!session) {
    return { success: false, message: 'Sessione non trovata' }
  }

  const adminMember = await prisma.leagueMember.findFirst({
    where: {
      leagueId: session.leagueId,
      userId: adminUserId,
      role: 'ADMIN',
      status: MemberStatus.ACTIVE,
    },
  })

  if (!adminMember) {
    return { success: false, message: 'Non autorizzato' }
  }

  // Check if already initialized
  const existingConfig = await prisma.prizePhaseConfig.findUnique({
    where: { marketSessionId: sessionId },
  })

  if (existingConfig) {
    return { success: false, message: 'Fase premi già inizializzata' }
  }

  // Get all active members
  const members = await prisma.leagueMember.findMany({
    where: {
      leagueId: session.leagueId,
      status: MemberStatus.ACTIVE,
    },
  })

  // Create config and default category "Indennizzo Partenza Estero"
  const [config, indennizzoCategory] = await prisma.$transaction([
    prisma.prizePhaseConfig.create({
      data: {
        marketSessionId: sessionId,
        baseReincrement: 100,
      },
    }),
    prisma.prizeCategory.create({
      data: {
        marketSessionId: sessionId,
        name: 'Indennizzo Partenza Estero',
        isSystemPrize: true,
      },
    }),
  ])

  // Create default 50M prizes for each member in Indennizzo category
  await prisma.sessionPrize.createMany({
    data: members.map(m => ({
      prizeCategoryId: indennizzoCategory.id,
      leagueMemberId: m.id,
      amount: 50,
    })),
  })

  return {
    success: true,
    message: 'Fase premi inizializzata',
    data: { configId: config.id, categoryId: indennizzoCategory.id },
  }
}

// ==================== GET PRIZE PHASE DATA ====================

/**
 * Ottieni tutti i dati della fase premi per una sessione
 * Include: config, categorie, premi per manager, totali
 */
export async function getPrizePhaseData(
  sessionId: string,
  userId: string
): Promise<ServiceResult> {
  const session = await prisma.marketSession.findUnique({
    where: { id: sessionId },
  })

  if (!session) {
    return { success: false, message: 'Sessione non trovata' }
  }

  // Verify membership
  const member = await prisma.leagueMember.findFirst({
    where: {
      leagueId: session.leagueId,
      userId,
      status: MemberStatus.ACTIVE,
    },
  })

  if (!member) {
    return { success: false, message: 'Non sei membro di questa lega' }
  }

  const isAdmin = member.role === 'ADMIN'

  // Get config
  const config = await prisma.prizePhaseConfig.findUnique({
    where: { marketSessionId: sessionId },
  })

  if (!config) {
    return { success: false, message: 'Fase premi non inizializzata' }
  }

  // Get all members
  const members = await prisma.leagueMember.findMany({
    where: {
      leagueId: session.leagueId,
      status: MemberStatus.ACTIVE,
    },
    include: {
      user: { select: { username: true } },
    },
    orderBy: { teamName: 'asc' },
  })

  // Get categories with prizes
  const categories = await prisma.prizeCategory.findMany({
    where: { marketSessionId: sessionId },
    include: {
      managerPrizes: {
        include: {
          leagueMember: {
            include: {
              user: { select: { username: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  // Calculate totals per member
  const memberTotals: Record<string, number> = {}
  for (const m of members) {
    // Base reincrement (same for all)
    memberTotals[m.id] = config.baseReincrement

    // Add prizes from all categories
    for (const cat of categories) {
      const prize = cat.managerPrizes.find(p => p.leagueMemberId === m.id)
      if (prize) {
        memberTotals[m.id] += prize.amount
      }
    }
  }

  // Format response
  const formattedCategories = categories.map(cat => ({
    id: cat.id,
    name: cat.name,
    isSystemPrize: cat.isSystemPrize,
    prizes: cat.managerPrizes.map(p => ({
      memberId: p.leagueMemberId,
      teamName: p.leagueMember.teamName,
      username: p.leagueMember.user.username,
      amount: p.amount,
    })),
  }))

  const formattedMembers = members.map(m => ({
    id: m.id,
    teamName: m.teamName,
    username: m.user.username,
    currentBudget: m.currentBudget,
    // Se la fase è finalizzata o l'utente è admin, mostra i totali
    // Altrimenti mostra solo il base reincrement
    totalPrize: config.isFinalized || isAdmin ? memberTotals[m.id] : null,
    baseOnly: !config.isFinalized && !isAdmin,
  }))

  return {
    success: true,
    data: {
      config: {
        id: config.id,
        baseReincrement: config.baseReincrement,
        isFinalized: config.isFinalized,
        finalizedAt: config.finalizedAt,
      },
      categories: isAdmin ? formattedCategories : [],
      members: formattedMembers,
      isAdmin,
    },
  }
}

// ==================== UPDATE BASE REINCREMENT ====================

export async function updateBaseReincrement(
  sessionId: string,
  adminUserId: string,
  amount: number
): Promise<ServiceResult> {
  const session = await prisma.marketSession.findUnique({
    where: { id: sessionId },
  })

  if (!session) {
    return { success: false, message: 'Sessione non trovata' }
  }

  const adminMember = await prisma.leagueMember.findFirst({
    where: {
      leagueId: session.leagueId,
      userId: adminUserId,
      role: 'ADMIN',
      status: MemberStatus.ACTIVE,
    },
  })

  if (!adminMember) {
    return { success: false, message: 'Non autorizzato' }
  }

  const config = await prisma.prizePhaseConfig.findUnique({
    where: { marketSessionId: sessionId },
  })

  if (!config) {
    return { success: false, message: 'Fase premi non inizializzata' }
  }

  if (config.isFinalized) {
    return { success: false, message: 'La fase premi è già stata finalizzata' }
  }

  if (!Number.isInteger(amount) || amount < 0) {
    return { success: false, message: 'L\'importo deve essere un numero intero >= 0' }
  }

  await prisma.prizePhaseConfig.update({
    where: { id: config.id },
    data: { baseReincrement: amount },
  })

  return {
    success: true,
    message: `Re-incremento base aggiornato a ${amount}M`,
    data: { baseReincrement: amount },
  }
}

// ==================== CREATE PRIZE CATEGORY ====================

export async function createPrizeCategory(
  sessionId: string,
  adminUserId: string,
  name: string
): Promise<ServiceResult> {
  const session = await prisma.marketSession.findUnique({
    where: { id: sessionId },
  })

  if (!session) {
    return { success: false, message: 'Sessione non trovata' }
  }

  const adminMember = await prisma.leagueMember.findFirst({
    where: {
      leagueId: session.leagueId,
      userId: adminUserId,
      role: 'ADMIN',
      status: MemberStatus.ACTIVE,
    },
  })

  if (!adminMember) {
    return { success: false, message: 'Non autorizzato' }
  }

  const config = await prisma.prizePhaseConfig.findUnique({
    where: { marketSessionId: sessionId },
  })

  if (!config) {
    return { success: false, message: 'Fase premi non inizializzata' }
  }

  if (config.isFinalized) {
    return { success: false, message: 'La fase premi è già stata finalizzata' }
  }

  if (!name?.trim()) {
    return { success: false, message: 'Il nome della categoria è obbligatorio' }
  }

  // Check for duplicate
  const existing = await prisma.prizeCategory.findFirst({
    where: { marketSessionId: sessionId, name: name.trim() },
  })

  if (existing) {
    return { success: false, message: 'Esiste già una categoria con questo nome' }
  }

  const category = await prisma.prizeCategory.create({
    data: {
      marketSessionId: sessionId,
      name: name.trim(),
      isSystemPrize: false,
    },
  })

  return {
    success: true,
    message: `Categoria "${name.trim()}" creata`,
    data: { id: category.id, name: category.name },
  }
}

// ==================== DELETE PRIZE CATEGORY ====================

export async function deletePrizeCategory(
  categoryId: string,
  adminUserId: string
): Promise<ServiceResult> {
  const category = await prisma.prizeCategory.findUnique({
    where: { id: categoryId },
    include: { marketSession: true },
  })

  if (!category) {
    return { success: false, message: 'Categoria non trovata' }
  }

  const adminMember = await prisma.leagueMember.findFirst({
    where: {
      leagueId: category.marketSession.leagueId,
      userId: adminUserId,
      role: 'ADMIN',
      status: MemberStatus.ACTIVE,
    },
  })

  if (!adminMember) {
    return { success: false, message: 'Non autorizzato' }
  }

  if (category.isSystemPrize) {
    return { success: false, message: 'Non puoi eliminare le categorie di sistema' }
  }

  const config = await prisma.prizePhaseConfig.findUnique({
    where: { marketSessionId: category.marketSessionId },
  })

  if (config?.isFinalized) {
    return { success: false, message: 'La fase premi è già stata finalizzata' }
  }

  // Delete category (cascade deletes prizes)
  await prisma.prizeCategory.delete({
    where: { id: categoryId },
  })

  return {
    success: true,
    message: `Categoria "${category.name}" eliminata`,
  }
}

// ==================== SET MEMBER PRIZE ====================

export async function setMemberPrize(
  categoryId: string,
  memberId: string,
  adminUserId: string,
  amount: number
): Promise<ServiceResult> {
  const category = await prisma.prizeCategory.findUnique({
    where: { id: categoryId },
    include: { marketSession: true },
  })

  if (!category) {
    return { success: false, message: 'Categoria non trovata' }
  }

  const adminMember = await prisma.leagueMember.findFirst({
    where: {
      leagueId: category.marketSession.leagueId,
      userId: adminUserId,
      role: 'ADMIN',
      status: MemberStatus.ACTIVE,
    },
  })

  if (!adminMember) {
    return { success: false, message: 'Non autorizzato' }
  }

  const config = await prisma.prizePhaseConfig.findUnique({
    where: { marketSessionId: category.marketSessionId },
  })

  if (config?.isFinalized) {
    return { success: false, message: 'La fase premi è già stata finalizzata' }
  }

  // Verify target member exists in league
  const targetMember = await prisma.leagueMember.findFirst({
    where: {
      id: memberId,
      leagueId: category.marketSession.leagueId,
      status: MemberStatus.ACTIVE,
    },
    include: { user: { select: { username: true } } },
  })

  if (!targetMember) {
    return { success: false, message: 'Manager non trovato' }
  }

  if (!Number.isInteger(amount) || amount < 0) {
    return { success: false, message: 'L\'importo deve essere un numero intero >= 0' }
  }

  // Upsert prize
  await prisma.sessionPrize.upsert({
    where: {
      prizeCategoryId_leagueMemberId: {
        prizeCategoryId: categoryId,
        leagueMemberId: memberId,
      },
    },
    update: { amount },
    create: {
      prizeCategoryId: categoryId,
      leagueMemberId: memberId,
      amount,
    },
  })

  return {
    success: true,
    message: `Premio di ${amount}M assegnato a ${targetMember.teamName}`,
    data: { memberId, amount },
  }
}

// ==================== FINALIZE PRIZE PHASE ====================

/**
 * Finalizza la fase premi:
 * - Calcola i totali per ogni manager
 * - Incrementa i budget
 * - Blocca ulteriori modifiche
 */
export async function finalizePrizePhase(
  sessionId: string,
  adminUserId: string
): Promise<ServiceResult> {
  const session = await prisma.marketSession.findUnique({
    where: { id: sessionId },
  })

  if (!session) {
    return { success: false, message: 'Sessione non trovata' }
  }

  const adminMember = await prisma.leagueMember.findFirst({
    where: {
      leagueId: session.leagueId,
      userId: adminUserId,
      role: 'ADMIN',
      status: MemberStatus.ACTIVE,
    },
  })

  if (!adminMember) {
    return { success: false, message: 'Non autorizzato' }
  }

  const config = await prisma.prizePhaseConfig.findUnique({
    where: { marketSessionId: sessionId },
  })

  if (!config) {
    return { success: false, message: 'Fase premi non inizializzata' }
  }

  if (config.isFinalized) {
    return { success: false, message: 'La fase premi è già stata finalizzata' }
  }

  // Get all members
  const members = await prisma.leagueMember.findMany({
    where: {
      leagueId: session.leagueId,
      status: MemberStatus.ACTIVE,
    },
  })

  // Get all prizes
  const prizes = await prisma.sessionPrize.findMany({
    where: {
      prizeCategory: { marketSessionId: sessionId },
    },
  })

  // Calculate totals per member
  const memberTotals: Record<string, number> = {}
  for (const m of members) {
    memberTotals[m.id] = config.baseReincrement
  }
  for (const prize of prizes) {
    if (memberTotals[prize.leagueMemberId] !== undefined) {
      memberTotals[prize.leagueMemberId] += prize.amount
    }
  }

  // Update budgets and config in transaction
  await prisma.$transaction([
    // Mark config as finalized
    prisma.prizePhaseConfig.update({
      where: { id: config.id },
      data: {
        isFinalized: true,
        finalizedAt: new Date(),
      },
    }),
    // Update each member's budget
    ...members.map(m =>
      prisma.leagueMember.update({
        where: { id: m.id },
        data: { currentBudget: { increment: memberTotals[m.id] } },
      })
    ),
  ])

  // Get updated members for response
  const updatedMembers = await prisma.leagueMember.findMany({
    where: {
      leagueId: session.leagueId,
      status: MemberStatus.ACTIVE,
    },
    include: { user: { select: { username: true } } },
  })

  return {
    success: true,
    message: 'Fase premi finalizzata. I budget sono stati aggiornati.',
    data: {
      members: updatedMembers.map(m => ({
        id: m.id,
        teamName: m.teamName,
        username: m.user.username,
        prizeReceived: memberTotals[m.id],
        newBudget: m.currentBudget,
      })),
    },
  }
}
