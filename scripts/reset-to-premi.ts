import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const SESSION_ID = 'cmke6q6k700mg9dicehlaynwb'

async function main() {
  console.log('=== RESET TO PREMI PHASE ===')
  
  // Get current session
  const session = await prisma.marketSession.findUnique({
    where: { id: SESSION_ID },
    include: { 
      prizePhaseConfig: true,
      league: { select: { name: true, initialBudget: true } }
    }
  })
  
  if (!session) {
    console.error('Session not found!')
    return
  }
  
  console.log('League:', session.league.name)
  console.log('Current Phase:', session.currentPhase)
  console.log('Has Prize Config:', !!session.prizePhaseConfig)
  
  // Update phase to PREMI
  await prisma.marketSession.update({
    where: { id: SESSION_ID },
    data: { currentPhase: 'PREMI' }
  })
  console.log('\nPhase updated to PREMI')
  
  // Create prize config if not exists
  if (!session.prizePhaseConfig) {
    await prisma.prizePhaseConfig.create({
      data: {
        marketSessionId: SESSION_ID,
        baseReincrement: 100,
        isFinalized: false
      }
    })
    console.log('Created PrizePhaseConfig')
  } else {
    // Reset finalized if already exists
    await prisma.prizePhaseConfig.update({
      where: { marketSessionId: SESSION_ID },
      data: { isFinalized: false, finalizedAt: null }
    })
    console.log('Reset PrizePhaseConfig to not finalized')
  }
  
  // Verify
  const updated = await prisma.marketSession.findUnique({
    where: { id: SESSION_ID },
    include: { prizePhaseConfig: true }
  })
  
  console.log('\n=== VERIFICATION ===')
  console.log('Phase:', updated?.currentPhase)
  console.log('Prize Config Finalized:', updated?.prizePhaseConfig?.isFinalized)
}

main().finally(() => prisma.$disconnect())
