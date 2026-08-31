/**
 * Backup Critical Data Script
 *
 * Esporta le tabelle di dati di lega in file JSON, per disaster recovery.
 * Da eseguire come pre-deploy hook, manualmente, o su schedule (GitHub Actions).
 *
 * Copre tutte le tabelle di stato di gioco (lega, rose, contratti, mercato,
 * aste, scambi, premi, storico). Escluse di proposito: cache/log API-Football
 * (rigenerabili dalla sync), AppLog/AuditLog (log tecnici), ChatMessage e
 * UserFeedback* (non critici per il ripristino). Per User viene esclusa la
 * password hash e il token di reset — non finiscono mai nel backup.
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// Directory per i backup
const BACKUP_DIR = path.join(__dirname, 'backups', 'pre-deploy');

// Timestamp per il nome del backup
function getTimestamp() {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

async function backupTable(tableName, queryFn) {
  console.log(`  Backing up ${tableName}...`);
  const startTime = Date.now();

  try {
    const data = await queryFn();
    const count = Array.isArray(data) ? data.length : 0;

    if (count === 0) {
      console.log(`    ⚠️  ${tableName}: 0 records (tabella vuota)`);
      return { table: tableName, count: 0, status: 'empty' };
    }

    const fileName = `${tableName}.json`;
    const filePath = path.join(BACKUP_DIR, fileName);

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

    const duration = Date.now() - startTime;
    console.log(`    ✅ ${tableName}: ${count} records (${duration}ms)`);

    return { table: tableName, count, status: 'ok', file: fileName };
  } catch (error) {
    console.log(`    ❌ ${tableName}: ERRORE - ${error.message}`);
    return { table: tableName, count: 0, status: 'error', error: error.message };
  }
}

async function main() {
  const timestamp = getTimestamp();
  console.log(`\n${'='.repeat(60)}`);
  console.log(`BACKUP DATI CRITICI - ${timestamp}`);
  console.log(`${'='.repeat(60)}\n`);

  // Crea directory backup se non esiste
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  // Salva timestamp del backup
  const backupInfo = {
    timestamp: new Date().toISOString(),
    tables: []
  };

  console.log('1. Esecuzione backup tabelle dati di lega...\n');

  // --- Lega e membri ---
  backupInfo.tables.push(await backupTable('League', () => prisma.league.findMany()));
  backupInfo.tables.push(
    await backupTable('LeagueMember', () =>
      prisma.leagueMember.findMany({
        include: {
          user: { select: { id: true, username: true, email: true } },
          league: { select: { id: true, name: true } }
        }
      })
    )
  );
  backupInfo.tables.push(
    await backupTable('LeagueInvite', () =>
      prisma.leagueInvite.findMany({
        select: {
          id: true, leagueId: true, email: true, invitedBy: true,
          status: true, expiresAt: true, acceptedAt: true, createdAt: true
        }
      })
    )
  );

  // --- Rose e contratti ---
  backupInfo.tables.push(
    await backupTable('PlayerRoster', () =>
      prisma.playerRoster.findMany({
        include: {
          player: { select: { id: true, name: true, team: true } },
          leagueMember: { select: { id: true, teamName: true } }
        }
      })
    )
  );
  backupInfo.tables.push(await backupTable('PlayerContract', () => prisma.playerContract.findMany()));
  backupInfo.tables.push(await backupTable('DraftContract', () => prisma.draftContract.findMany()));

  // --- Giocatori Serie A e statistiche ---
  backupInfo.tables.push(
    await backupTable('SerieAPlayer', () =>
      prisma.serieAPlayer.findMany({
        select: {
          id: true,
          externalId: true,
          name: true,
          team: true,
          position: true,
          quotation: true,
          age: true,
          isActive: true,
          listStatus: true,
          exitReason: true,
          exitDate: true,
          apiFootballId: true
        }
      })
    )
  );
  backupInfo.tables.push(await backupTable('PlayerMatchRating', () => prisma.playerMatchRating.findMany()));

  // --- Mercato e sessioni ---
  backupInfo.tables.push(await backupTable('MarketSession', () => prisma.marketSession.findMany()));
  backupInfo.tables.push(await backupTable('ContractConsolidation', () => prisma.contractConsolidation.findMany()));
  backupInfo.tables.push(await backupTable('IndemnityDecision', () => prisma.indemnityDecision.findMany()));

  // --- Aste (primo mercato, rubata, svincolati) ---
  backupInfo.tables.push(await backupTable('Auction', () => prisma.auction.findMany()));
  backupInfo.tables.push(await backupTable('AuctionBid', () => prisma.auctionBid.findMany()));
  backupInfo.tables.push(await backupTable('AuctionObjective', () => prisma.auctionObjective.findMany()));
  backupInfo.tables.push(await backupTable('AuctionAppeal', () => prisma.auctionAppeal.findMany()));

  // --- Scambi e movimenti ---
  backupInfo.tables.push(await backupTable('TradeOffer', () => prisma.tradeOffer.findMany()));
  backupInfo.tables.push(await backupTable('PlayerMovement', () => prisma.playerMovement.findMany()));
  backupInfo.tables.push(await backupTable('Prophecy', () => prisma.prophecy.findMany()));

  // --- Premi ---
  backupInfo.tables.push(await backupTable('Prize', () => prisma.prize.findMany()));
  backupInfo.tables.push(await backupTable('PrizePhaseConfig', () => prisma.prizePhaseConfig.findMany()));
  backupInfo.tables.push(await backupTable('PrizeCategory', () => prisma.prizeCategory.findMany()));
  backupInfo.tables.push(await backupTable('SessionPrize', () => prisma.sessionPrize.findMany()));

  // --- Storico contratti ---
  backupInfo.tables.push(await backupTable('ContractHistory', () => prisma.contractHistory.findMany()));
  backupInfo.tables.push(await backupTable('ManagerSessionSnapshot', () => prisma.managerSessionSnapshot.findMany()));

  // --- Utenti (senza credenziali) ---
  backupInfo.tables.push(
    await backupTable('User', () =>
      prisma.user.findMany({
        select: {
          id: true, email: true, username: true, emailVerified: true,
          isSuperAdmin: true, createdAt: true, updatedAt: true
        }
      })
    )
  );

  // Salva info del backup
  const infoPath = path.join(BACKUP_DIR, 'backup-info.json');
  fs.writeFileSync(infoPath, JSON.stringify(backupInfo, null, 2));

  // Riepilogo
  console.log(`\n${'='.repeat(60)}`);
  console.log('RIEPILOGO BACKUP');
  console.log(`${'='.repeat(60)}\n`);

  let totalRecords = 0;
  let hasErrors = false;

  for (const table of backupInfo.tables) {
    const statusIcon = table.status === 'ok' ? '✅' : (table.status === 'empty' ? '⚠️' : '❌');
    console.log(`${statusIcon} ${table.table}: ${table.count} records`);
    totalRecords += table.count;
    if (table.status === 'error') hasErrors = true;
  }

  console.log(`\nTotale record salvati: ${totalRecords}`);
  console.log(`Directory backup: ${BACKUP_DIR}`);

  if (hasErrors) {
    console.log('\n⚠️  ATTENZIONE: Alcuni backup hanno avuto errori!');
    process.exit(1);
  }

  // Verifica critica: PlayerMatchRating deve avere dati
  const ratingBackup = backupInfo.tables.find(t => t.table === 'PlayerMatchRating');
  if (ratingBackup && ratingBackup.count === 0) {
    console.log('\n❌ ERRORE CRITICO: PlayerMatchRating è vuota!');
    console.log('   Il deploy viene bloccato per evitare perdita dati.');
    process.exit(1);
  }

  console.log('\n✅ Backup completato con successo!\n');

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Errore durante il backup:', e);
  await prisma.$disconnect();
  process.exit(1);
});
