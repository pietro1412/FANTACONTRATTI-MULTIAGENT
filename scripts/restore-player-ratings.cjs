/**
 * Script per recuperare i dati PlayerMatchRating dal branch di backup
 * e inserirli nel database principale
 */

const { PrismaClient } = require('@prisma/client');

// Branch di recovery (con i dati storici)
const RECOVERY_DB_URL = 'postgresql://neondb_owner:npg_Ej8tFdAr4wnX@ep-flat-feather-ag5wcfhx-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require';

// Database principale (dalla .env)
const prismaMain = new PrismaClient();

// Client per il branch di recovery
const prismaRecovery = new PrismaClient({
  datasources: {
    db: {
      url: RECOVERY_DB_URL
    }
  }
});

async function main() {
  console.log('=== RECUPERO DATI PlayerMatchRating ===\n');

  try {
    // 1. Verifica connessione al branch di recovery
    console.log('1. Connessione al branch RecuperoStatistiche...');
    const recoveryCount = await prismaRecovery.playerMatchRating.count();
    console.log(`   Trovati ${recoveryCount} record nel branch di recovery`);

    if (recoveryCount === 0) {
      console.log('   ERRORE: Nessun dato trovato nel branch di recovery!');
      return;
    }

    // 2. Verifica stato del database principale
    console.log('\n2. Verifica database principale...');
    const mainCount = await prismaMain.playerMatchRating.count();
    console.log(`   Record attuali nel DB principale: ${mainCount}`);

    if (mainCount > 0) {
      console.log('   ATTENZIONE: Il DB principale ha già dei dati!');
      console.log('   Procedo comunque (i duplicati verranno ignorati)...');
    }

    // 3. Recupera tutti i dati dal branch di recovery
    console.log('\n3. Recupero dati dal branch di recovery...');
    const allRatings = await prismaRecovery.playerMatchRating.findMany();
    console.log(`   Recuperati ${allRatings.length} record`);

    // 4. Inserisci nel database principale
    console.log('\n4. Inserimento nel database principale...');
    let inserted = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 0; i < allRatings.length; i++) {
      const rating = allRatings[i];

      try {
        await prismaMain.playerMatchRating.create({
          data: {
            id: rating.id,
            playerId: rating.playerId,
            apiFixtureId: rating.apiFixtureId,
            matchDate: rating.matchDate,
            season: rating.season,
            round: rating.round,
            rating: rating.rating,
            minutesPlayed: rating.minutesPlayed,
            goals: rating.goals,
            assists: rating.assists,
            createdAt: rating.createdAt,
          }
        });
        inserted++;
      } catch (err) {
        if (err.code === 'P2002') {
          // Unique constraint - record già esiste
          skipped++;
        } else {
          errors++;
          if (errors <= 5) {
            console.log(`   Errore record ${i}: ${err.message}`);
          }
        }
      }

      // Progress ogni 1000 record
      if ((i + 1) % 1000 === 0) {
        console.log(`   Progresso: ${i + 1}/${allRatings.length} (inseriti: ${inserted}, saltati: ${skipped})`);
      }
    }

    // 5. Riepilogo finale
    console.log('\n=== RIEPILOGO ===');
    console.log(`Record totali nel recovery: ${allRatings.length}`);
    console.log(`Record inseriti: ${inserted}`);
    console.log(`Record saltati (duplicati): ${skipped}`);
    console.log(`Errori: ${errors}`);

    // 6. Verifica finale
    const finalCount = await prismaMain.playerMatchRating.count();
    console.log(`\nRecord finali nel DB principale: ${finalCount}`);

    console.log('\n=== RECUPERO COMPLETATO ===');

  } catch (error) {
    console.error('ERRORE CRITICO:', error.message);
  } finally {
    await prismaRecovery.$disconnect();
    await prismaMain.$disconnect();
  }
}

main();
