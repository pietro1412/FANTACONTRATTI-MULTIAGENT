import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🧹 RESET COMPLETO DATABASE - TUTTO A ZERO...\n')

  // Cancellazione in ordine per rispettare le FK
  console.log('1. Cancellazione profezie...')
  await prisma.prophecy.deleteMany()

  console.log('2. Cancellazione movimenti...')
  await prisma.playerMovement.deleteMany()

  console.log('3. Cancellazione acknowledgments aste...')
  await prisma.auctionAcknowledgment.deleteMany()

  console.log('4. Cancellazione offerte aste...')
  await prisma.auctionBid.deleteMany()

  console.log('5. Cancellazione aste...')
  await prisma.auction.deleteMany()

  console.log('6. Cancellazione contratti...')
  await prisma.playerContract.deleteMany()

  console.log('7. Cancellazione roster...')
  await prisma.playerRoster.deleteMany()

  console.log('8. Cancellazione scambi...')
  await prisma.tradeOffer.deleteMany()

  console.log('9. Cancellazione consolidamenti...')
  await prisma.contractConsolidation.deleteMany()

  console.log('10. Cancellazione premi...')
  await prisma.prize.deleteMany()

  console.log('11. Cancellazione session prizes...')
  await prisma.sessionPrize.deleteMany()

  console.log('12. Cancellazione prize categories...')
  await prisma.prizeCategory.deleteMany()

  console.log('13. Cancellazione prize phase configs...')
  await prisma.prizePhaseConfig.deleteMany()

  console.log('14. Cancellazione draft contracts...')
  await prisma.draftContract.deleteMany()

  console.log('15. Cancellazione chat messages...')
  await prisma.chatMessage.deleteMany()

  console.log('16. Cancellazione auction appeals...')
  await prisma.auctionAppeal.deleteMany()

  console.log('17. Cancellazione sessioni mercato...')
  await prisma.marketSession.deleteMany()

  console.log('18. Cancellazione inviti lega...')
  await prisma.leagueInvite.deleteMany()

  console.log('19. Cancellazione membri lega...')
  await prisma.leagueMember.deleteMany()

  console.log('20. Cancellazione leghe...')
  await prisma.league.deleteMany()

  console.log('21. Cancellazione audit log...')
  await prisma.auditLog.deleteMany()

  console.log('22. Cancellazione upload quotazioni...')
  await prisma.quotazioniUpload.deleteMany()

  console.log('23. Cancellazione TUTTI i giocatori...')
  await prisma.serieAPlayer.deleteMany()

  console.log('24. Cancellazione TUTTI gli utenti...')
  await prisma.user.deleteMany()

  console.log('\n')
  console.log('═══════════════════════════════════════════════════════════')
  console.log('              ✅ DATABASE COMPLETAMENTE VUOTO')
  console.log('═══════════════════════════════════════════════════════════')
  console.log('')
  console.log('La piattaforma è ora a zero.')
  console.log('- Nessun utente')
  console.log('- Nessuna lega')
  console.log('- Nessun giocatore')
  console.log('')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
