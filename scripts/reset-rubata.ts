import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.marketSession.updateMany({
    where: { 
      leagueId: 'cmkc9hjn30001zwpfpe67zpbd',
      status: 'ACTIVE'
    },
    data: {
      rubataState: 'WAITING',
      rubataBoardIndex: 0,
      rubataTimerStartedAt: null,
      rubataReadyMembers: [],
      rubataPausedRemainingSeconds: null,
      rubataPausedFromState: null,
      rubataAuctionReadyInfo: null,
      rubataPendingAck: null
    }
  });
  
  console.log('Rubata resettata. Records aggiornati:', result.count);
}

main().finally(() => prisma.$disconnect());
