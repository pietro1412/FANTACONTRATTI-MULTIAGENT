/**
 * Backup Critical Data Script
 *
 * Esporta le tabelle critiche in file JSON prima di operazioni rischiose.
 * Da eseguire come pre-deploy hook o manualmente.
 *
 * Tabelle salvate:
 * - PlayerMatchRating (statistiche partita per partita)
 * - PlayerRoster (rose dei manager)
 * - PlayerContract (contratti attivi)
 * - LeagueMember (membri delle leghe)
 * - SerieAPlayer (giocatori Serie A)
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

  console.log('1. Esecuzione backup tabelle critiche...\n');

  // Backup PlayerMatchRating (statistiche - la più importante!)
  backupInfo.tables.push(
    await backupTable('PlayerMatchRating', () =>
      prisma.playerMatchRating.findMany()
    )
  );

  // Backup PlayerRoster (rose)
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

  // Backup PlayerContract (contratti)
  backupInfo.tables.push(
    await backupTable('PlayerContract', () =>
      prisma.playerContract.findMany()
    )
  );

  // Backup LeagueMember (membri leghe)
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

  // Backup SerieAPlayer (giocatori)
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
          apiFootballId: true
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
