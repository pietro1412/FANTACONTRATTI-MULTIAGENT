import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const sessions = await prisma.marketSession.findMany({
    where: { leagueId: 'cmkc9hjn30001zwpfpe67zpbd' },
    select: {
      id: true,
      type: true,
      status: true,
      currentPhase: true,
      rubataState: true,
      rubataBoardIndex: true,
      rubataBoard: true
    },
    orderBy: { createdAt: 'desc' }
  });

  console.log('Sessioni trovate:', sessions.length);

  for (const s of sessions) {
    console.log('---');
    console.log('Session:', s.id.slice(0, 8));
    console.log('  Type:', s.type);
    console.log('  Status:', s.status);
    console.log('  Phase:', s.currentPhase);
    console.log('  RubataState:', s.rubataState);
    console.log('  RubataBoardIndex:', s.rubataBoardIndex);
    const board = s.rubataBoard as any[] | null;
    if (board) {
      console.log('  RubataBoard length:', board.length);
    }
  }
}

main().finally(() => prisma.$disconnect());
