/**
 * Verifica inconsistenze tra PlayerRoster.leagueMemberId e PlayerContract.leagueMemberId
 *
 * Problema: quando un giocatore viene spostato da un manager all'altro,
 * il roster viene aggiornato ma il contratto potrebbe mantenere il vecchio leagueMemberId
 */

const { PrismaClient } = require('../node_modules/.prisma/client');
const prisma = new PrismaClient();

async function checkMismatches() {
  console.log('🔍 Verifica inconsistenze Roster/Contract leagueMemberId...\n');

  // Trova tutti i contratti con le relative informazioni
  const contracts = await prisma.playerContract.findMany({
    include: {
      roster: {
        include: {
          player: { select: { name: true } },
          leagueMember: { include: { user: { select: { username: true } } } }
        }
      },
      leagueMember: { include: { user: { select: { username: true } } } }
    }
  });

  const mismatches = [];

  for (const contract of contracts) {
    const rosterMemberId = contract.roster.leagueMemberId;
    const contractMemberId = contract.leagueMemberId;

    if (rosterMemberId !== contractMemberId) {
      mismatches.push({
        contractId: contract.id,
        playerName: contract.roster.player.name,
        rosterMemberId,
        rosterOwner: contract.roster.leagueMember.user.username,
        contractMemberId,
        contractOwner: contract.leagueMember.user.username,
      });
    }
  }

  if (mismatches.length === 0) {
    console.log('✅ Nessuna inconsistenza trovata!');
  } else {
    console.log(`❌ Trovate ${mismatches.length} inconsistenze:\n`);
    console.log('='.repeat(100));
    console.log('| Giocatore'.padEnd(25) + '| Contract ID'.padEnd(30) + '| Roster Owner'.padEnd(20) + '| Contract Owner'.padEnd(20) + '|');
    console.log('='.repeat(100));

    for (const m of mismatches) {
      console.log(
        '| ' + m.playerName.padEnd(23) +
        '| ' + m.contractId.padEnd(28) +
        '| ' + m.rosterOwner.padEnd(18) +
        '| ' + m.contractOwner.padEnd(18) + '|'
      );
    }
    console.log('='.repeat(100));

    console.log('\n📋 Dettagli per correzione:');
    for (const m of mismatches) {
      console.log(`\n${m.playerName}:`);
      console.log(`  Contract ID: ${m.contractId}`);
      console.log(`  Roster appartiene a: ${m.rosterOwner} (${m.rosterMemberId})`);
      console.log(`  Contract dice: ${m.contractOwner} (${m.contractMemberId})`);
      console.log(`  → Il contract.leagueMemberId dovrebbe essere: ${m.rosterMemberId}`);
    }
  }

  return mismatches;
}

async function fixMismatches(dryRun = true) {
  const mismatches = await checkMismatches();

  if (mismatches.length === 0) {
    return;
  }

  console.log('\n' + '='.repeat(50));

  if (dryRun) {
    console.log('🔄 DRY RUN - Nessuna modifica applicata');
    console.log('Per applicare le correzioni, esegui con: node scripts/check-contract-mismatch.cjs --fix');
  } else {
    console.log('🔧 Applicazione correzioni...\n');

    for (const m of mismatches) {
      await prisma.playerContract.update({
        where: { id: m.contractId },
        data: { leagueMemberId: m.rosterMemberId }
      });
      console.log(`✅ Corretto ${m.playerName}: leagueMemberId → ${m.rosterMemberId}`);
    }

    console.log(`\n✅ Corrette ${mismatches.length} inconsistenze!`);
  }
}

const shouldFix = process.argv.includes('--fix');
fixMismatches(!shouldFix)
  .then(() => prisma.$disconnect())
  .catch(e => { console.error(e); process.exit(1); });
