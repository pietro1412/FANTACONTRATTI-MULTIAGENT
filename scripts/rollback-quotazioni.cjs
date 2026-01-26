/**
 * Script per rollback quotazioni alla versione precedente
 *
 * Utilizzo:
 *   node scripts/rollback-quotazioni.cjs                    # Mostra stato attuale e opzioni
 *   node scripts/rollback-quotazioni.cjs --dry-run          # Mostra cosa verrebbe fatto senza eseguire
 *   node scripts/rollback-quotazioni.cjs --execute          # Esegue il rollback
 *   node scripts/rollback-quotazioni.cjs --reset-unclassified  # Resetta solo i non classificati a IN_LIST
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const execute = args.includes('--execute');
  const resetUnclassified = args.includes('--reset-unclassified');

  console.log('='.repeat(60));
  console.log('ROLLBACK QUOTAZIONI - Script di ripristino');
  console.log('='.repeat(60));
  console.log('');

  // 1. Mostra cronologia upload
  console.log('📋 CRONOLOGIA UPLOAD:');
  console.log('-'.repeat(60));

  const uploads = await prisma.quotazioniUpload.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: {
      uploadedBy: { select: { username: true } }
    }
  });

  if (uploads.length === 0) {
    console.log('Nessun upload trovato nella cronologia.');
    await prisma.$disconnect();
    return;
  }

  for (let i = 0; i < uploads.length; i++) {
    const u = uploads[i];
    const marker = i === 0 ? ' ← ULTIMO (da annullare)' : '';
    console.log(`${i + 1}. ${u.createdAt.toISOString().split('T')[0]} - ${u.fileName}${marker}`);
    console.log(`   Sheet: ${u.sheetName} | By: ${u.uploadedBy.username}`);
    console.log(`   Creati: ${u.playersCreated} | Aggiornati: ${u.playersUpdated} | Fuori lista: ${u.playersNotInList}`);
    console.log('');
  }

  // 2. Analizza stato attuale giocatori
  console.log('📊 STATO ATTUALE GIOCATORI:');
  console.log('-'.repeat(60));

  const inListCount = await prisma.serieAPlayer.count({
    where: { listStatus: 'IN_LIST' }
  });

  const notInListCount = await prisma.serieAPlayer.count({
    where: { listStatus: 'NOT_IN_LIST' }
  });

  const notInListNoReason = await prisma.serieAPlayer.count({
    where: {
      listStatus: 'NOT_IN_LIST',
      exitReason: null
    }
  });

  const notInListWithReason = await prisma.serieAPlayer.count({
    where: {
      listStatus: 'NOT_IN_LIST',
      exitReason: { not: null }
    }
  });

  console.log(`IN_LIST:     ${inListCount} giocatori`);
  console.log(`NOT_IN_LIST: ${notInListCount} giocatori`);
  console.log(`  - Senza motivo (da classificare): ${notInListNoReason}`);
  console.log(`  - Con motivo (già classificati):  ${notInListWithReason}`);
  console.log('');

  // 3. Mostra giocatori NOT_IN_LIST senza motivo (quelli che verrebbero ripristinati)
  if (notInListNoReason > 0) {
    console.log('⚠️  GIOCATORI DA RIPRISTINARE (NOT_IN_LIST senza exitReason):');
    console.log('-'.repeat(60));

    const playersToRestore = await prisma.serieAPlayer.findMany({
      where: {
        listStatus: 'NOT_IN_LIST',
        exitReason: null
      },
      select: { id: true, name: true, team: true, position: true },
      orderBy: [{ position: 'asc' }, { name: 'asc' }]
    });

    // Raggruppa per ruolo
    const byPosition = {};
    for (const p of playersToRestore) {
      if (!byPosition[p.position]) byPosition[p.position] = [];
      byPosition[p.position].push(p);
    }

    for (const [pos, players] of Object.entries(byPosition)) {
      console.log(`\n${pos} (${players.length}):`);
      for (const p of players.slice(0, 10)) {
        console.log(`  - ${p.name} (${p.team})`);
      }
      if (players.length > 10) {
        console.log(`  ... e altri ${players.length - 10}`);
      }
    }
    console.log('');
  }

  // 4. Esecuzione rollback
  if (!execute && !resetUnclassified) {
    console.log('='.repeat(60));
    console.log('OPZIONI:');
    console.log('  --dry-run           Mostra cosa verrebbe fatto');
    console.log('  --execute           Esegue rollback completo (elimina ultimo upload + ripristina giocatori)');
    console.log('  --reset-unclassified Ripristina solo giocatori NOT_IN_LIST senza exitReason');
    console.log('='.repeat(60));
    await prisma.$disconnect();
    return;
  }

  if (resetUnclassified) {
    console.log('🔄 RIPRISTINO GIOCATORI NON CLASSIFICATI...');
    console.log('-'.repeat(60));

    if (dryRun) {
      console.log(`[DRY-RUN] Verrebbero ripristinati ${notInListNoReason} giocatori a IN_LIST`);
    } else {
      const result = await prisma.serieAPlayer.updateMany({
        where: {
          listStatus: 'NOT_IN_LIST',
          exitReason: null
        },
        data: {
          listStatus: 'IN_LIST',
          exitDate: null
        }
      });
      console.log(`✅ Ripristinati ${result.count} giocatori a IN_LIST`);
    }
  }

  if (execute) {
    console.log('🔄 ESECUZIONE ROLLBACK COMPLETO...');
    console.log('-'.repeat(60));

    const lastUpload = uploads[0];

    if (dryRun) {
      console.log(`[DRY-RUN] Verrebbe eliminato upload: ${lastUpload.fileName} (${lastUpload.id})`);
      console.log(`[DRY-RUN] Verrebbero ripristinati ${notInListNoReason} giocatori a IN_LIST`);
    } else {
      // Ripristina giocatori non classificati
      const restoreResult = await prisma.serieAPlayer.updateMany({
        where: {
          listStatus: 'NOT_IN_LIST',
          exitReason: null
        },
        data: {
          listStatus: 'IN_LIST',
          exitDate: null
        }
      });
      console.log(`✅ Ripristinati ${restoreResult.count} giocatori a IN_LIST`);

      // Elimina record ultimo upload dalla cronologia
      await prisma.quotazioniUpload.delete({
        where: { id: lastUpload.id }
      });
      console.log(`✅ Eliminato record upload: ${lastUpload.fileName}`);
    }
  }

  // 5. Verifica finale
  if ((execute || resetUnclassified) && !dryRun) {
    console.log('');
    console.log('📊 STATO DOPO ROLLBACK:');
    console.log('-'.repeat(60));

    const newInListCount = await prisma.serieAPlayer.count({
      where: { listStatus: 'IN_LIST' }
    });

    const newNotInListCount = await prisma.serieAPlayer.count({
      where: { listStatus: 'NOT_IN_LIST' }
    });

    console.log(`IN_LIST:     ${newInListCount} giocatori`);
    console.log(`NOT_IN_LIST: ${newNotInListCount} giocatori`);
  }

  await prisma.$disconnect();
  console.log('');
  console.log('✅ Operazione completata');
}

main().catch(e => {
  console.error('Errore:', e);
  process.exit(1);
});
