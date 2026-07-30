/**
 * SCRIPT TEMPORANEO — crea una lega di SIMULAZIONE in produzione.
 * - Admin: account reale pietro1412@gmail.com (deve gia' esistere).
 * - 7 allenatori simulati con password NOTA (per pilotarli via API/flussi reali).
 * - Stato iniziale: lega ACTIVE, membri ACTIVE, budget pieno, ordini 1..8.
 * NON cancella nulla. Si ferma se la lega con lo stesso nome esiste gia'.
 *
 * Uso: bash scripts/with-env.sh .env.vercel npx tsx scripts/_create-sim-league.ts
 */
import { PrismaClient, MemberRole, MemberStatus, JoinType, LeagueStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const ADMIN_EMAIL = 'pietro1412@gmail.com'
const LEAGUE_NAME = 'Simulazione Beta 2026-07'
const SIM_PASSWORD = 'SimBeta2026!' // password nota per pilotare i simulati

const SIM_USERS = Array.from({ length: 7 }, (_, i) => {
  const n = String(i + 1).padStart(2, '0')
  return {
    email: `sim${n}@sim.fantacontratti.it`,
    username: `Sim${n}`,
    teamName: `Simulato ${i + 1}`,
  }
})

const LEAGUE_CONFIG = {
  name: LEAGUE_NAME,
  description: 'Lega di simulazione beta — allenatori simulati pilotati per test end-to-end in produzione',
  initialBudget: 500,
  goalkeeperSlots: 3,
  defenderSlots: 8,
  midfielderSlots: 8,
  forwardSlots: 6,
  minParticipants: 6,
  maxParticipants: 20,
}

async function main() {
  console.log('🎬 Creazione lega di SIMULAZIONE in produzione...\n')

  // 0. Guardia: la lega non deve esistere gia'
  const existing = await prisma.league.findFirst({ where: { name: LEAGUE_NAME } })
  if (existing) {
    throw new Error(`Lega "${LEAGUE_NAME}" gia' esistente (id ${existing.id}). Stop: non creo doppioni, non cancello nulla.`)
  }

  // 1. Admin reale
  const admin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } })
  if (!admin) {
    throw new Error(`Utente admin ${ADMIN_EMAIL} non trovato in prod. Stop.`)
  }
  console.log(`👑 Admin: ${admin.username} (${admin.email})`)

  // 2. Utenti simulati (upsert by email: riusa se gia' presenti, imposta password nota)
  const simHash = await bcrypt.hash(SIM_PASSWORD, 10)
  const simUserIds: { id: string; username: string; teamName: string }[] = []
  for (const s of SIM_USERS) {
    const u = await prisma.user.upsert({
      where: { email: s.email },
      update: { passwordHash: simHash, emailVerified: true },
      create: { email: s.email, username: s.username, passwordHash: simHash, emailVerified: true, isSuperAdmin: false },
    })
    simUserIds.push({ id: u.id, username: u.username, teamName: s.teamName })
    console.log(`   🤖 ${u.username} - ${u.email}`)
  }

  // 3. Lega + membri in transazione
  const result = await prisma.$transaction(async (tx) => {
    const league = await tx.league.create({
      data: {
        name: LEAGUE_CONFIG.name,
        description: LEAGUE_CONFIG.description,
        initialBudget: LEAGUE_CONFIG.initialBudget,
        goalkeeperSlots: LEAGUE_CONFIG.goalkeeperSlots,
        defenderSlots: LEAGUE_CONFIG.defenderSlots,
        midfielderSlots: LEAGUE_CONFIG.midfielderSlots,
        forwardSlots: LEAGUE_CONFIG.forwardSlots,
        minParticipants: LEAGUE_CONFIG.minParticipants,
        maxParticipants: LEAGUE_CONFIG.maxParticipants,
        status: LeagueStatus.ACTIVE,
        currentSeason: 1,
      },
    })

    // Admin = ordine 1
    await tx.leagueMember.create({
      data: {
        userId: admin.id,
        leagueId: league.id,
        role: MemberRole.ADMIN,
        status: MemberStatus.ACTIVE,
        joinType: JoinType.CREATOR,
        currentBudget: LEAGUE_CONFIG.initialBudget,
        firstMarketOrder: 1,
        rubataOrder: 1,
        teamName: 'Pietro',
      },
    })

    // 7 simulati = ordini 2..8
    for (let i = 0; i < simUserIds.length; i++) {
      const s = simUserIds[i]!
      await tx.leagueMember.create({
        data: {
          userId: s.id,
          leagueId: league.id,
          role: MemberRole.MANAGER,
          status: MemberStatus.ACTIVE,
          joinType: JoinType.INVITE,
          currentBudget: LEAGUE_CONFIG.initialBudget,
          firstMarketOrder: i + 2,
          rubataOrder: i + 2,
          teamName: s.teamName,
        },
      })
    }

    return league
  })

  console.log('\n' + '='.repeat(56))
  console.log('✅ LEGA DI SIMULAZIONE CREATA')
  console.log('='.repeat(56))
  console.log(`   Nome:        ${result.name}`)
  console.log(`   ID:          ${result.id}`)
  console.log(`   Invite code: ${result.inviteCode}`)
  console.log(`   Stato:       ${result.status} | Stagione: ${result.currentSeason}`)
  console.log(`   Budget:      ${LEAGUE_CONFIG.initialBudget} | Slot: 3P/8D/8C/6A (25)`)
  console.log('\n👥 Membri (8):')
  console.log(`   1. [ADMIN]   ${admin.username} — ${admin.email}  (login: password tua reale)`)
  SIM_USERS.forEach((s, i) => console.log(`   ${i + 2}. [MANAGER] ${s.username} — ${s.email}  (pwd: ${SIM_PASSWORD})`))
}

main()
  .catch((e) => { console.error('❌', e.message); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
