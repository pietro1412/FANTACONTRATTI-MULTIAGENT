import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('='.repeat(60))
  console.log('CONSOLIDAMENTO AUTOMATICO DI TUTTI I MANAGER')
  console.log('='.repeat(60))

  // Find active session in CONTRATTI phase
  const session = await prisma.marketSession.findFirst({
    where: {
      status: 'ACTIVE',
      currentPhase: 'CONTRATTI',
    },
    include: {
      league: true,
    },
  })

  if (!session) {
    // Check if there's an active session that we need to set to CONTRATTI
    const activeSession = await prisma.marketSession.findFirst({
      where: { status: 'ACTIVE' },
      include: { league: true },
    })

    if (activeSession) {
      console.log(`\nSessione attiva trovata in fase: ${activeSession.currentPhase}`)
      console.log('Imposto la fase a CONTRATTI...')

      await prisma.marketSession.update({
        where: { id: activeSession.id },
        data: { currentPhase: 'CONTRATTI' },
      })

      console.log('Fase impostata a CONTRATTI!')

      // Continue with this session
      await consolidateAll(activeSession.id, activeSession.leagueId)
    } else {
      console.log('\nNessuna sessione di mercato attiva trovata.')
      console.log('Crea una sessione di mercato dal pannello admin.')
      return
    }
  } else {
    console.log(`\nSessione trovata: ${session.league.name}`)
    console.log(`Fase corrente: ${session.currentPhase}`)
    await consolidateAll(session.id, session.leagueId)
  }
}

async function consolidateAll(sessionId: string, leagueId: string) {
  // Get all active members
  const members = await prisma.leagueMember.findMany({
    where: {
      leagueId,
      status: 'ACTIVE',
    },
    include: {
      user: true,
      contractConsolidations: {
        where: { sessionId },
      },
    },
  })

  console.log(`\nTrovati ${members.length} manager attivi\n`)

  let consolidated = 0
  let alreadyDone = 0

  for (const member of members) {
    if (member.contractConsolidations.length > 0) {
      console.log(`✓ ${member.teamName} (${member.user.username}) - già consolidato`)
      alreadyDone++
    } else {
      await prisma.contractConsolidation.create({
        data: {
          sessionId,
          memberId: member.id,
        },
      })
      console.log(`✅ ${member.teamName} (${member.user.username}) - CONSOLIDATO ora`)
      consolidated++
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('RIEPILOGO')
  console.log('='.repeat(60))
  console.log(`Già consolidati: ${alreadyDone}`)
  console.log(`Consolidati ora: ${consolidated}`)
  console.log(`Totale: ${members.length}`)
  console.log('\nOra puoi passare alla fase successiva dal pannello admin!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
