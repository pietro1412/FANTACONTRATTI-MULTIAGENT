import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const LEAGUE_ID = 'cmjyfpykm0005kaz9okuqmbxg';

async function main() {
  console.log('=== RESET COMPLETO LEGA ===\n');

  // 1. Trova la lega e il budget iniziale
  const league = await prisma.league.findUnique({
    where: { id: LEAGUE_ID },
    include: {
      members: {
        include: { user: { select: { username: true } } }
      }
    }
  });

  if (!league) {
    console.log('Lega non trovata!');
    return;
  }

  console.log('Lega:', league.name);
  console.log('Budget iniziale:', league.initialBudget);
  console.log('Membri:', league.members.length);

  // 2. Chiudi tutte le sessioni di mercato
  const closedSessions = await prisma.marketSession.updateMany({
    where: { leagueId: LEAGUE_ID },
    data: { status: 'COMPLETED' }
  });
  console.log('\n✓ Sessioni chiuse:', closedSessions.count);

  // 3. Elimina tutti i TradeOffer
  const deletedTrades = await prisma.tradeOffer.deleteMany({
    where: {
      marketSession: { leagueId: LEAGUE_ID }
    }
  });
  console.log('✓ Trade offers eliminati:', deletedTrades.count);

  // 4. Elimina tutti i PlayerMovement
  const deletedMovements = await prisma.playerMovement.deleteMany({
    where: { leagueId: LEAGUE_ID }
  });
  console.log('✓ Player movements eliminati:', deletedMovements.count);

  // 5. Elimina tutti i contratti
  const deletedContracts = await prisma.playerContract.deleteMany({
    where: {
      leagueMember: { leagueId: LEAGUE_ID }
    }
  });
  console.log('✓ Contratti eliminati:', deletedContracts.count);

  // 6. Elimina tutti i roster entries
  const deletedRosters = await prisma.playerRoster.deleteMany({
    where: {
      leagueMember: { leagueId: LEAGUE_ID }
    }
  });
  console.log('✓ Roster entries eliminati:', deletedRosters.count);

  // 7. Elimina tutti i bid delle aste
  const deletedBids = await prisma.auctionBid.deleteMany({
    where: {
      auction: {
        marketSession: { leagueId: LEAGUE_ID }
      }
    }
  });
  console.log('✓ Bid eliminati:', deletedBids.count);

  // 7b. Elimina tutti gli acknowledgment delle aste
  const deletedAcks = await prisma.auctionAcknowledgment.deleteMany({
    where: {
      auction: {
        marketSession: { leagueId: LEAGUE_ID }
      }
    }
  });
  console.log('✓ Acknowledgments eliminati:', deletedAcks.count);

  // 8. Elimina tutte le aste
  const deletedAuctions = await prisma.auction.deleteMany({
    where: {
      marketSession: { leagueId: LEAGUE_ID }
    }
  });
  console.log('✓ Aste eliminate:', deletedAuctions.count);

  // 9. Elimina consolidamenti contratti
  const deletedConsolidations = await prisma.contractConsolidation.deleteMany({
    where: {
      session: { leagueId: LEAGUE_ID }
    }
  });
  console.log('✓ Consolidamenti eliminati:', deletedConsolidations.count);

  // 9. Elimina tutte le sessioni di mercato
  const deletedSessions = await prisma.marketSession.deleteMany({
    where: { leagueId: LEAGUE_ID }
  });
  console.log('✓ Sessioni eliminate:', deletedSessions.count);

  // 10. Reset budget di tutti i membri al valore iniziale
  const updatedMembers = await prisma.leagueMember.updateMany({
    where: { leagueId: LEAGUE_ID },
    data: { currentBudget: league.initialBudget }
  });
  console.log('✓ Budget resettati:', updatedMembers.count, 'membri a', league.initialBudget);

  // Verifica finale
  console.log('\n=== STATO FINALE ===\n');

  const membersAfter = await prisma.leagueMember.findMany({
    where: { leagueId: LEAGUE_ID, status: 'ACTIVE' },
    include: {
      user: { select: { username: true } },
      roster: true
    }
  });

  for (const m of membersAfter) {
    console.log(`${m.user.username}: Budget ${m.currentBudget}, Rosa ${m.roster.length} giocatori`);
  }

  const sessionsAfter = await prisma.marketSession.count({
    where: { leagueId: LEAGUE_ID }
  });
  console.log('\nSessioni attive:', sessionsAfter);

  console.log('\n✅ Reset completato! La lega è pronta per iniziare il Primo Mercato.');
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
