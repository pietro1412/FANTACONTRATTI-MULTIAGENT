import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const LEAGUE_ID = 'cmjyfpykm0005kaz9okuqmbxg';

async function main() {
  // Chiudi tutte le sessioni attive
  await prisma.marketSession.updateMany({
    where: { leagueId: LEAGUE_ID, status: 'ACTIVE' },
    data: { status: 'COMPLETED' }
  });
  console.log('Sessioni attive chiuse');

  // Trova una sessione esistente per copiare la season
  const existingSession = await prisma.marketSession.findFirst({
    where: { leagueId: LEAGUE_ID },
    orderBy: { createdAt: 'desc' }
  });

  const season = existingSession?.season || 1;
  const semester = existingSession?.semester || 1;

  // Crea nuova sessione PRIMO_MERCATO
  const newSession = await prisma.marketSession.create({
    data: {
      leagueId: LEAGUE_ID,
      type: 'PRIMO_MERCATO',
      status: 'ACTIVE',
      currentPhase: 'ASTA_LIBERA',
      season,
      semester
    }
  });

  console.log('\nNuova sessione PRIMO_MERCATO creata:');
  console.log('  ID:', newSession.id);
  console.log('  Tipo:', newSession.type);
  console.log('  Fase:', newSession.currentPhase);
  console.log('  Status:', newSession.status);
}

main().catch(console.error).finally(() => prisma.$disconnect());
