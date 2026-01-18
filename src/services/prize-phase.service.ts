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

  // Get all members with roster info
  const members = await prisma.leagueMember.findMany({
    where: {
      leagueId: session.leagueId,
      status: MemberStatus.ACTIVE,
    },
    include: {
      user: { select: { username: true } },
      roster: {
        where: { status: 'ACTIVE' },
        include: { player: { select: { position: true } } },
      },
    },
    orderBy: { teamName: 'asc' },
  })

  // Get league for slot limits
  const league = await prisma.league.findUnique({
    where: { id: session.leagueId },
    select: {
      goalkeeperSlots: true,
      defenderSlots: true,
      midfielderSlots: true,
      forwardSlots: true,
    },
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

  // Get indemnity details - players with exitReason who have active contracts in this league
  const playersWithIndemnity = await prisma.playerRoster.findMany({
    where: {
      leagueMember: {
        leagueId: session.leagueId,
        status: MemberStatus.ACTIVE,
      },
      status: 'ACTIVE',
      player: {
        listStatus: 'NOT_IN_LIST',
        exitReason: { not: null },
      },
    },
    include: {
      player: {
        select: {
          id: true,
          name: true,
          position: true,
          team: true,
          quotation: true,
          exitReason: true,
        },
      },
      leagueMember: {
        select: {
          id: true,
          teamName: true,
          user: { select: { username: true } },
        },
      },
      contract: {
        select: {
          salary: true,
          duration: true,
          rescissionClause: true,
        },
      },
    },
  })

  // Group indemnity players by member
  const indemnityByMember: Record<string, Array<{
    playerId: string
    playerName: string
    position: string
    team: string
    quotation: number
    exitReason: string
    contract: { salary: number; duration: number; rescissionClause: number | null } | null
  }>> = {}

  for (const roster of playersWithIndemnity) {
    const memberId = roster.leagueMember.id
    if (!indemnityByMember[memberId]) {
      indemnityByMember[memberId] = []
    }
    indemnityByMember[memberId].push({
      playerId: roster.player.id,
      playerName: roster.player.name,
      position: roster.player.position,
      team: roster.player.team,
      quotation: roster.player.quotation,
      exitReason: roster.player.exitReason!,
      contract: roster.contract ? {
        salary: roster.contract.salary,
        duration: roster.contract.duration,
        rescissionClause: roster.contract.rescissionClause,
      } : null,
    })
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

  const formattedMembers = members.map(m => {
    // Count roster slots by position
    const rosterCounts = { P: 0, D: 0, C: 0, A: 0 }
    for (const r of m.roster) {
      const pos = r.player.position as keyof typeof rosterCounts
      if (rosterCounts[pos] !== undefined) {
        rosterCounts[pos]++
      }
    }

    return {
      id: m.id,
      teamName: m.teamName,
      username: m.user.username,
      currentBudget: m.currentBudget,
      // Se la fase è finalizzata o l'utente è admin, mostra i totali
      // Altrimenti mostra solo il base reincrement
      totalPrize: config.isFinalized || isAdmin ? memberTotals[m.id] : null,
      baseOnly: !config.isFinalized && !isAdmin,
      // Roster slot info
      roster: {
        P: { filled: rosterCounts.P, total: league?.goalkeeperSlots ?? 3 },
        D: { filled: rosterCounts.D, total: league?.defenderSlots ?? 8 },
        C: { filled: rosterCounts.C, total: league?.midfielderSlots ?? 8 },
        A: { filled: rosterCounts.A, total: league?.forwardSlots ?? 6 },
        totalPlayers: m.roster.length,
      },
      // Indemnity players for this member
      indemnityPlayers: indemnityByMember[m.id] || [],
    }
  })

  // Calculate indemnity summary
  const indemnityStats = {
    totalPlayers: playersWithIndemnity.length,
    byReason: {
      RITIRATO: playersWithIndemnity.filter(p => p.player.exitReason === 'RITIRATO').length,
      RETROCESSO: playersWithIndemnity.filter(p => p.player.exitReason === 'RETROCESSO').length,
      ESTERO: playersWithIndemnity.filter(p => p.player.exitReason === 'ESTERO').length,
    },
  }

  return {
    success: true,
    data: {
      config: {
        id: config.id,
        baseReincrement: config.baseReincrement,
        indemnityConsolidated: config.indemnityConsolidated,
        indemnityConsolidatedAt: config.indemnityConsolidatedAt,
        isFinalized: config.isFinalized,
        finalizedAt: config.finalizedAt,
      },
      categories: isAdmin ? formattedCategories : [],
      members: formattedMembers,
      isAdmin,
      indemnityStats,
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

// ==================== SET CUSTOM INDEMNITY ====================

/**
 * Imposta un importo indennizzo personalizzato per un giocatore ESTERO
 * L'importo viene salvato creando/aggiornando un premio specifico per il giocatore
 */
export async function setCustomIndemnity(
  sessionId: string,
  playerId: string,
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

  // Verify the player exists and is ESTERO
  const player = await prisma.serieAPlayer.findUnique({
    where: { id: playerId },
  })

  if (!player) {
    return { success: false, message: 'Giocatore non trovato' }
  }

  if (player.exitReason !== 'ESTERO') {
    return { success: false, message: 'Solo i giocatori ESTERO possono avere indennizzo personalizzato' }
  }

  // Find the roster entry to get the member who owns this player
  const roster = await prisma.playerRoster.findFirst({
    where: {
      playerId,
      leagueMember: {
        leagueId: session.leagueId,
        status: MemberStatus.ACTIVE,
      },
      status: 'ACTIVE',
    },
    include: {
      leagueMember: true,
    },
  })

  if (!roster) {
    return { success: false, message: 'Giocatore non in rosa di nessun manager' }
  }

  // Validate amount
  if (!Number.isInteger(amount) || amount < 0) {
    return { success: false, message: 'L\'importo deve essere un numero intero >= 0' }
  }

  // Find or create a category for this player's indemnity
  const categoryName = `Indennizzo - ${player.name}`

  let category = await prisma.prizeCategory.findFirst({
    where: {
      marketSessionId: sessionId,
      name: categoryName,
    },
  })

  if (!category) {
    category = await prisma.prizeCategory.create({
      data: {
        marketSessionId: sessionId,
        name: categoryName,
        isSystemPrize: true, // Mark as system so it can't be deleted
      },
    })
  }

  // Set the prize amount for the member who owns this player
  // The amount here represents the custom indemnity
  // We store it as amount - 50 (difference from default) to track the delta
  await prisma.sessionPrize.upsert({
    where: {
      prizeCategoryId_leagueMemberId: {
        prizeCategoryId: category.id,
        leagueMemberId: roster.leagueMemberId,
      },
    },
    update: { amount },
    create: {
      prizeCategoryId: category.id,
      leagueMemberId: roster.leagueMemberId,
      amount,
    },
  })

  return {
    success: true,
    message: `Indennizzo per ${player.name} impostato a ${amount}M`,
    data: {
      playerId,
      playerName: player.name,
      memberId: roster.leagueMemberId,
      amount,
    },
  }
}

/**
 * Ottieni gli importi indennizzo personalizzati per una sessione
 */
export async function getCustomIndemnities(
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

  // Get all "Indennizzo - " categories for this session
  const categories = await prisma.prizeCategory.findMany({
    where: {
      marketSessionId: sessionId,
      name: { startsWith: 'Indennizzo - ' },
    },
    include: {
      managerPrizes: true,
    },
  })

  // Extract player names and amounts
  const customIndemnities: Record<string, number> = {}

  for (const cat of categories) {
    // Extract player name from category name
    const playerName = cat.name.replace('Indennizzo - ', '')

    // Get the amount (there should be only one prize per category)
    const prize = cat.managerPrizes[0]
    if (prize) {
      // Find the player ID by name
      const player = await prisma.serieAPlayer.findFirst({
        where: { name: playerName },
      })
      if (player) {
        customIndemnities[player.id] = prize.amount
      }
    }
  }

  return {
    success: true,
    data: { customIndemnities },
  }
}

// ==================== CONSOLIDATE INDEMNITIES ====================

/**
 * Consolida gli indennizzi - dopo questa azione gli indennizzi appaiono nei premi per manager
 * Solo l'admin può consolidare
 */
export async function consolidateIndemnities(
  sessionId: string,
  adminUserId: string
): Promise<ServiceResult> {
  const session = await prisma.marketSession.findUnique({
    where: { id: sessionId },
  })

  if (!session) {
    return { success: false, message: 'Sessione non trovata' }
  }

  // Verify admin
  const adminMember = await prisma.leagueMember.findFirst({
    where: {
      leagueId: session.leagueId,
      userId: adminUserId,
      role: 'ADMIN',
      status: MemberStatus.ACTIVE,
    },
  })

  if (!adminMember) {
    return { success: false, message: 'Non autorizzato - solo admin può consolidare gli indennizzi' }
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

  if (config.indemnityConsolidated) {
    return { success: false, message: 'Gli indennizzi sono già stati consolidati' }
  }

  // Update config to mark indemnities as consolidated
  await prisma.prizePhaseConfig.update({
    where: { id: config.id },
    data: {
      indemnityConsolidated: true,
      indemnityConsolidatedAt: new Date(),
    },
  })

  return {
    success: true,
    message: 'Indennizzi consolidati con successo',
    data: {
      consolidatedAt: new Date(),
    },
  }
}

// ==================== GET PRIZE HISTORY ====================

/**
 * Ottieni lo storico di tutti i premi assegnati per una lega
 * Mostra tutte le sessioni con premi finalizzati
 */
export async function getPrizeHistory(
  leagueId: string,
  userId: string
): Promise<ServiceResult> {
  // Verify membership
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

  // Get all finalized prize phases for this league
  const sessions = await prisma.marketSession.findMany({
    where: {
      leagueId,
      prizePhaseConfig: {
        isFinalized: true,
      },
    },
    include: {
      prizePhaseConfig: true,
      prizeCategories: {
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
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Format the response
  const history = sessions.map(session => {
    // Calculate totals per member for this session
    const memberTotals: Record<string, {
      memberId: string
      teamName: string | null
      username: string
      baseReincrement: number
      categoryPrizes: Record<string, number>
      total: number
    }> = {}

    // Initialize with base reincrement
    for (const cat of session.prizeCategories) {
      for (const prize of cat.managerPrizes) {
        if (!memberTotals[prize.leagueMemberId]) {
          memberTotals[prize.leagueMemberId] = {
            memberId: prize.leagueMemberId,
            teamName: prize.leagueMember.teamName,
            username: prize.leagueMember.user.username,
            baseReincrement: session.prizePhaseConfig?.baseReincrement ?? 0,
            categoryPrizes: {},
            total: session.prizePhaseConfig?.baseReincrement ?? 0,
          }
        }
        memberTotals[prize.leagueMemberId].categoryPrizes[cat.name] = prize.amount
        memberTotals[prize.leagueMemberId].total += prize.amount
      }
    }

    return {
      sessionId: session.id,
      type: session.type,
      season: session.season,
      semester: session.semester,
      finalizedAt: session.prizePhaseConfig?.finalizedAt,
      baseReincrement: session.prizePhaseConfig?.baseReincrement ?? 0,
      categories: session.prizeCategories.map(cat => ({
        name: cat.name,
        isSystemPrize: cat.isSystemPrize,
      })),
      members: Object.values(memberTotals).sort((a, b) =>
        (a.teamName || '').localeCompare(b.teamName || '')
      ),
    }
  })

  return {
    success: true,
    data: { history },
  }
}
