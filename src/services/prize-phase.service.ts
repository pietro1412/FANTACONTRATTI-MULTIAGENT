import { MemberStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { ServiceResult } from '@/shared/types/service-result'
import { logInfo } from '@/services/app-log.service'

// Nome categoria di sistema per il re-incremento base — vedi ensureBaseReincrementCategory.
const BASE_REINCREMENT_CATEGORY_NAME = 'Re-incremento Base'

/**
 * Vero per le categorie il cui importo viene DAVVERO accreditato al finalize.
 * Le categorie normali (isSystemPrize=false) lo sono sempre; tra quelle di sistema,
 * SOLO "Re-incremento Base" lo è — gli indennizzi (Indennizzo Partenza Estero /
 * Indennizzo - PlayerName) non vengono mai accreditati qui: sono liquidati più avanti
 * in Contratti, solo se il manager sceglie RELEASE.
 */
export function isCreditedCategory(category: { isSystemPrize: boolean; name: string }): boolean {
  return !category.isSystemPrize || category.name === BASE_REINCREMENT_CATEGORY_NAME
}

/**
 * Migrazione lazy: crea la categoria "Re-incremento Base" (se non esiste già) con
 * l'importo storico di config.baseReincrement per ogni membro attivo. Rende il
 * re-incremento base modificabile per-manager come qualunque altra categoria, senza
 * cambiare nulla per le sessioni già in corso (stesso valore, solo ora per-riga).
 * Idempotente — no-op se la categoria esiste già.
 *
 * createdAt ancorato a 1s prima di config.createdAt (che precede sempre qualunque
 * categoria, essendo creata per prima in initializePrizePhase): garantisce che la
 * colonna appaia sempre per prima nella tabella, anche migrando una sessione che ha
 * già categorie custom più vecchie di questa migrazione.
 */
async function ensureBaseReincrementCategory(
  sessionId: string,
  leagueId: string,
  defaultAmount: number,
  configCreatedAt: Date
): Promise<void> {
  const existing = await prisma.prizeCategory.findFirst({
    where: { marketSessionId: sessionId, name: BASE_REINCREMENT_CATEGORY_NAME },
  })
  if (existing) return

  const members = await prisma.leagueMember.findMany({
    where: { leagueId, status: MemberStatus.ACTIVE },
    select: { id: true },
  })
  if (members.length === 0) return

  await prisma.$transaction(async (tx) => {
    const category = await tx.prizeCategory.create({
      data: {
        marketSessionId: sessionId,
        name: BASE_REINCREMENT_CATEGORY_NAME,
        isSystemPrize: true,
        createdAt: new Date(configCreatedAt.getTime() - 1000),
      },
    })
    await tx.sessionPrize.createMany({
      data: members.map(m => ({ prizeCategoryId: category.id, leagueMemberId: m.id, amount: defaultAmount })),
    })
  })
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

  // Create config, default categories and prizes in a single transaction
  // This ensures atomicity - if any operation fails, all are rolled back
  const { config, indennizzoCategory } = await prisma.$transaction(async (tx) => {
    const config = await tx.prizePhaseConfig.create({
      data: {
        marketSessionId: sessionId,
        baseReincrement: 100,
      },
    })

    // Creata per prima: sorta sempre per prima nella tabella (orderBy createdAt asc).
    const baseCategory = await tx.prizeCategory.create({
      data: {
        marketSessionId: sessionId,
        name: BASE_REINCREMENT_CATEGORY_NAME,
        isSystemPrize: true,
      },
    })
    await tx.sessionPrize.createMany({
      data: members.map(m => ({
        prizeCategoryId: baseCategory.id,
        leagueMemberId: m.id,
        amount: 100,
      })),
    })

    const indennizzoCategory = await tx.prizeCategory.create({
      data: {
        marketSessionId: sessionId,
        name: 'Indennizzo Partenza Estero',
        isSystemPrize: true,
      },
    })

    // Create default 50M prizes for each member in Indennizzo category
    await tx.sessionPrize.createMany({
      data: members.map(m => ({
        prizeCategoryId: indennizzoCategory.id,
        leagueMemberId: m.id,
        amount: 50,
      })),
    })

    return { config, indennizzoCategory }
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

  // Sessioni inizializzate prima di questa feature non hanno ancora la categoria
  // "Re-incremento Base": la crea ora, seedata col valore storico di config.baseReincrement.
  await ensureBaseReincrementCategory(sessionId, session.leagueId, config.baseReincrement, config.createdAt)

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

  // Re-incremento base per-manager: la categoria "Re-incremento Base" (vedi
  // ensureBaseReincrementCategory sopra) è ora la fonte di verità, non più config.baseReincrement.
  const baseCategory = categories.find(cat => cat.name === BASE_REINCREMENT_CATEGORY_NAME)
  const baseReincrementByMember: Record<string, number> = {}
  for (const m of members) {
    baseReincrementByMember[m.id] = baseCategory?.managerPrizes.find(p => p.leagueMemberId === m.id)?.amount ?? config.baseReincrement
  }

  // Calculate totals per member: premi accreditati (regolari + Re-incremento Base),
  // esclusi gli indennizzi (mai accreditati qui, vedi isCreditedCategory).
  const memberTotals: Record<string, number> = {}
  for (const m of members) {
    memberTotals[m.id] = 0
    for (const cat of categories) {
      if (!isCreditedCategory(cat)) continue
      const prize = cat.managerPrizes.find(p => p.leagueMemberId === m.id)
      if (prize) {
        memberTotals[m.id] = (memberTotals[m.id] ?? 0) + prize.amount
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
      totalSalaries: m.totalSalaries,
      // Visibile a TUTTI (anche manager, che non ricevono `categories`): è "garantito",
      // uguale per default ma può essere stato assegnato individualmente dall'admin.
      baseReincrement: baseReincrementByMember[m.id],
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

  // Riepilogo dei MIEI premi (per-categoria + indennizzo) per chi chiama, non l'intera
  // `categories` (riservata all'admin — i manager non devono vedere gli importi altrui
  // mentre sono ancora in corso di assegnazione). Permette al manager di vedere il
  // dettaglio dei propri riconoscimenti senza esporre quelli di tutti.
  const myCategoryPrizes: Record<string, number> = {}
  let myIndemnityTotal = 0
  for (const cat of categories) {
    if (cat.name === BASE_REINCREMENT_CATEGORY_NAME) continue
    const prize = cat.managerPrizes.find(p => p.leagueMemberId === member.id)
    if (!prize || prize.amount <= 0) continue
    if (cat.name.startsWith('Indennizzo - ')) {
      myIndemnityTotal += prize.amount
    } else if (cat.name !== 'Indennizzo Partenza Estero') {
      myCategoryPrizes[cat.name] = prize.amount
    }
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
      myCategoryPrizes,
      myIndemnityTotal,
    },
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

// ==================== RENAME PRIZE CATEGORY ====================

export async function renamePrizeCategory(
  categoryId: string,
  adminUserId: string,
  newName: string
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
    return { success: false, message: 'Non puoi rinominare le categorie di sistema' }
  }

  const config = await prisma.prizePhaseConfig.findUnique({
    where: { marketSessionId: category.marketSessionId },
  })

  if (config?.isFinalized) {
    return { success: false, message: 'La fase premi è già stata finalizzata' }
  }

  const trimmedName = newName?.trim()
  if (!trimmedName) {
    return { success: false, message: 'Il nome della categoria è obbligatorio' }
  }

  if (trimmedName !== category.name) {
    const existing = await prisma.prizeCategory.findFirst({
      where: { marketSessionId: category.marketSessionId, name: trimmedName },
    })
    if (existing) {
      return { success: false, message: 'Esiste già una categoria con questo nome' }
    }
  }

  await prisma.prizeCategory.update({
    where: { id: categoryId },
    data: { name: trimmedName },
  })

  return {
    success: true,
    message: `Categoria rinominata in "${trimmedName}"`,
    data: { id: categoryId, name: trimmedName },
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
    message: `Premio di ${amount}M assegnato a ${targetMember.teamName ?? 'squadra'}`,
    data: { memberId, amount },
  }
}

// ==================== ADMIN CORRECT MEMBER PRIZE (POST-FINALIZE) ====================

/**
 * Correzione admin di un premio per-manager.
 *
 * A differenza di setMemberPrize, questo percorso è CONSENTITO anche quando la fase
 * premi è già finalizzata (Bibbia MERCATO-RICORRENTE §4.5): l'admin deve poter
 * correggere i premi dopo la finalizzazione.
 *
 * Logica budget:
 * - delta = newAmount - vecchioAmount del SessionPrize
 * - se la fase è FINALIZZATA, il premio è già stato accreditato sul currentBudget al
 *   momento del finalize → applichiamo il delta al currentBudget del membro
 *   (increment se positivo, decrement se negativo).
 * - se la fase NON è finalizzata, il premio non è ancora stato accreditato → aggiorniamo
 *   solo il SessionPrize, NON tocchiamo il budget (verrà accreditato al finalize).
 *
 * Le categorie di sistema (isSystemPrize, es. indennizzi) NON vengono accreditate al
 * finalize: per coerenza, anche qui un delta su una categoria di sistema non tocca il
 * budget (l'importo è solo potenziale, viene liquidato in fase CONTRATTI).
 *
 * Idempotente: se newAmount == vecchioAmount il delta è 0 e nessun budget viene toccato.
 * Atomico: SessionPrize + budget aggiornati nella stessa transazione.
 */
export async function adminCorrectMemberPrize(
  leagueId: string,
  adminUserId: string,
  input: {
    marketSessionId: string
    categoryId: string
    leagueMemberId: string
    newAmount: number
  }
): Promise<ServiceResult> {
  const { marketSessionId, categoryId, leagueMemberId, newAmount } = input

  // Validate amount
  if (!Number.isInteger(newAmount) || newAmount < 0) {
    return { success: false, message: 'L\'importo deve essere un numero intero >= 0' }
  }

  // Verify session belongs to the league
  const session = await prisma.marketSession.findFirst({
    where: { id: marketSessionId, leagueId },
  })

  if (!session) {
    return { success: false, message: 'Sessione non trovata' }
  }

  // Verify admin of the league
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

  const config = await prisma.prizePhaseConfig.findUnique({
    where: { marketSessionId },
  })

  if (!config) {
    return { success: false, message: 'Fase premi non inizializzata' }
  }

  // Verify category belongs to this session
  const category = await prisma.prizeCategory.findFirst({
    where: { id: categoryId, marketSessionId },
  })

  if (!category) {
    return { success: false, message: 'Categoria non trovata' }
  }

  // Verify target member exists in league
  const targetMember = await prisma.leagueMember.findFirst({
    where: {
      id: leagueMemberId,
      leagueId,
      status: MemberStatus.ACTIVE,
    },
    include: { user: { select: { username: true } } },
  })

  if (!targetMember) {
    return { success: false, message: 'Manager non trovato' }
  }

  // Read current prize amount (default 0 if none yet)
  const existingPrize = await prisma.sessionPrize.findUnique({
    where: {
      prizeCategoryId_leagueMemberId: {
        prizeCategoryId: categoryId,
        leagueMemberId,
      },
    },
  })

  const oldAmount = existingPrize?.amount ?? 0
  const delta = newAmount - oldAmount

  // Budget is touched only when the prize was already credited:
  // - phase finalized (credited at finalize) AND
  // - a credited category (regular, or "Re-incremento Base" — non-credited system
  //   categories like gli indennizzi non toccano mai il budget qui, vedi isCreditedCategory)
  const shouldAdjustBudget = config.isFinalized && isCreditedCategory(category) && delta !== 0

  await prisma.$transaction(async (tx) => {
    // Upsert the prize to the new amount (idempotent)
    await tx.sessionPrize.upsert({
      where: {
        prizeCategoryId_leagueMemberId: {
          prizeCategoryId: categoryId,
          leagueMemberId,
        },
      },
      update: { amount: newAmount },
      create: {
        prizeCategoryId: categoryId,
        leagueMemberId,
        amount: newAmount,
      },
    })

    // Apply delta to budget only when the prize was already credited
    if (shouldAdjustBudget) {
      await tx.leagueMember.update({
        where: { id: leagueMemberId },
        data: { currentBudget: { increment: delta } },
      })
    }
  })

  // Audit: who corrected what, with the delta and budget impact.
  // ANOMALY category = out-of-normal-flow admin correction (esp. post-finalize).
  logInfo('ANOMALY', 'Admin prize correction', {
    action: 'adminCorrectMemberPrize',
    leagueId,
    adminUserId,
    adminMemberId: adminMember.id,
    marketSessionId,
    categoryId,
    categoryName: category.name,
    isSystemPrize: category.isSystemPrize,
    leagueMemberId,
    targetTeamName: targetMember.teamName,
    oldAmount,
    newAmount,
    delta,
    isFinalized: config.isFinalized,
    budgetAdjusted: shouldAdjustBudget,
  })

  return {
    success: true,
    message: config.isFinalized
      ? `Premio corretto a ${newAmount}M (delta ${delta >= 0 ? '+' : ''}${delta}M${shouldAdjustBudget ? ', budget aggiornato' : ''})`
      : `Premio corretto a ${newAmount}M`,
    data: {
      categoryId,
      leagueMemberId,
      oldAmount,
      newAmount,
      delta,
      budgetAdjusted: shouldAdjustBudget,
    },
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

  // Sessioni inizializzate prima di questa feature non hanno ancora la categoria
  // "Re-incremento Base": la crea ora, seedata col valore storico di config.baseReincrement.
  await ensureBaseReincrementCategory(sessionId, session.leagueId, config.baseReincrement, config.createdAt)

  // Get all members
  const members = await prisma.leagueMember.findMany({
    where: {
      leagueId: session.leagueId,
      status: MemberStatus.ACTIVE,
    },
  })

  // Get all prizes (include category name/isSystemPrize per isCreditedCategory)
  const prizes = await prisma.sessionPrize.findMany({
    where: {
      prizeCategory: { marketSessionId: sessionId },
    },
    include: {
      prizeCategory: { select: { isSystemPrize: true, name: true } },
    },
  })

  // Calculate totals per member: re-incremento base (ora per-manager, vedi
  // ensureBaseReincrementCategory) + premi normali. Indennizzi esclusi — sono
  // potenziali, liquidati in Contratti solo se il manager sceglie RELEASE.
  const memberTotals: Record<string, number> = {}
  for (const m of members) {
    memberTotals[m.id] = 0
  }
  for (const prize of prizes) {
    if (memberTotals[prize.leagueMemberId] !== undefined && isCreditedCategory(prize.prizeCategory)) {
      memberTotals[prize.leagueMemberId] = (memberTotals[prize.leagueMemberId] ?? 0) + prize.amount
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

  // Niente lock su isFinalized/indemnityConsolidated: a differenza dei premi normali,
  // l'indennizzo NON viene accreditato qui — viene letto DAL VIVO da questa stessa
  // SessionPrize quando il manager decide KEEP/RELEASE in fase Contratti (vedi
  // contract.service.ts). Correggerlo prima di quel momento è sempre sicuro; un
  // giocatore già rilasciato sparisce comunque dalla lista (roster non più ACTIVE).

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

  // Niente lock su isFinalized: consolidare non tocca budget (solo crea le categorie
  // "Indennizzo - PlayerName" con l'importo di default) — sicuro anche a fase
  // finalizzata, utile se un nuovo giocatore ESTERO emerge più avanti nel mercato.
  if (config.indemnityConsolidated) {
    return { success: false, message: 'Gli indennizzi sono già stati consolidati' }
  }

  // Get all ESTERO players with active contracts in this league
  const esteroPlayers = await prisma.playerRoster.findMany({
    where: {
      leagueMember: {
        leagueId: session.leagueId,
        status: MemberStatus.ACTIVE,
      },
      status: 'ACTIVE',
      player: {
        listStatus: 'NOT_IN_LIST',
        exitReason: 'ESTERO',
      },
      contract: { isNot: null },
    },
    include: {
      player: { select: { id: true, name: true } },
      leagueMember: { select: { id: true } },
    },
  })

  // Get the base "Indennizzo Partenza Estero" category to read per-member default amounts
  const baseCategory = await prisma.prizeCategory.findFirst({
    where: { marketSessionId: sessionId, name: 'Indennizzo Partenza Estero', isSystemPrize: true },
    include: { managerPrizes: true },
  })
  const baseMemberAmounts: Record<string, number> = {}
  if (baseCategory) {
    for (const prize of baseCategory.managerPrizes) {
      baseMemberAmounts[prize.leagueMemberId] = prize.amount
    }
  }

  // Get existing custom indemnity categories (already created via manual edits)
  const existingCategories = await prisma.prizeCategory.findMany({
    where: { marketSessionId: sessionId, name: { startsWith: 'Indennizzo - ' } },
    include: { managerPrizes: true },
  })
  const existingByName: Record<string, { categoryId: string; amount: number | null }> = {}
  for (const cat of existingCategories) {
    const prize = cat.managerPrizes[0]
    existingByName[cat.name] = { categoryId: cat.id, amount: prize?.amount ?? null }
  }

  // Create individual "Indennizzo - PlayerName" categories for ESTERO players that don't have one yet
  let createdCount = 0
  for (const roster of esteroPlayers) {
    const categoryName = `Indennizzo - ${roster.player.name}`
    const indemnityAmount = baseMemberAmounts[roster.leagueMember.id] ?? 50

    if (existingByName[categoryName]) {
      // Already exists (admin customized it) — skip
      continue
    }

    // Create category + prize
    const category = await prisma.prizeCategory.create({
      data: {
        marketSessionId: sessionId,
        name: categoryName,
        isSystemPrize: true,
      },
    })

    await prisma.sessionPrize.create({
      data: {
        prizeCategoryId: category.id,
        leagueMemberId: roster.leagueMember.id,
        amount: indemnityAmount,
      },
    })
    createdCount++
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
    message: `Indennizzi consolidati con successo (${createdCount + Object.keys(existingByName).length} giocatori)`,
    data: {
      consolidatedAt: new Date(),
      playersProcessed: esteroPlayers.length,
      categoriesCreated: createdCount,
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
    // Sessioni finalizzate PRIMA di questa feature non hanno la categoria "Re-incremento
    // Base" (mai migrate: una sessione storica completata non passa più da
    // getPrizePhaseData/finalizePrizePhase) — fallback al valore flat storico per loro,
    // per-manager quando la categoria esiste.
    const flatBaseFallback = session.prizePhaseConfig?.baseReincrement ?? 0
    const baseCategory = session.prizeCategories.find(c => c.name === BASE_REINCREMENT_CATEGORY_NAME)

    const memberTotals: Record<string, {
      memberId: string
      teamName: string | null
      username: string
      baseReincrement: number
      categoryPrizes: Record<string, number>
      total: number
    }> = {}

    const ensureMember = (leagueMemberId: string, teamName: string | null, username: string) => {
      let entry = memberTotals[leagueMemberId]
      if (!entry) {
        const base = baseCategory
          ? baseCategory.managerPrizes.find(p => p.leagueMemberId === leagueMemberId)?.amount ?? flatBaseFallback
          : flatBaseFallback
        entry = {
          memberId: leagueMemberId,
          teamName,
          username,
          baseReincrement: base,
          categoryPrizes: {},
          total: base,
        }
        memberTotals[leagueMemberId] = entry
      }
      return entry
    }

    // Indennizzi mostrati come categoria informativa (colonna/legenda) ma esclusi dal
    // totale — mai accreditati al finalize, vedi isCreditedCategory. La categoria base
    // ha già il proprio campo dedicato (baseReincrement sopra), non va aggiunta di nuovo.
    for (const cat of session.prizeCategories) {
      for (const prize of cat.managerPrizes) {
        const entry = ensureMember(prize.leagueMemberId, prize.leagueMember.teamName, prize.leagueMember.user.username)
        if (cat.id === baseCategory?.id) continue
        entry.categoryPrizes[cat.name] = prize.amount
        if (isCreditedCategory(cat)) {
          entry.total += prize.amount
        }
      }
    }

    return {
      sessionId: session.id,
      type: session.type,
      season: session.season,
      semester: session.semester,
      finalizedAt: session.prizePhaseConfig?.finalizedAt,
      baseReincrement: flatBaseFallback,
      categories: session.prizeCategories
        .filter(cat => cat.id !== baseCategory?.id)
        .map(cat => ({
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
