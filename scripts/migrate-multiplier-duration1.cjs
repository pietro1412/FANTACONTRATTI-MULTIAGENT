/**
 * Migration: Change duration=1 multiplier from 4 to 3
 *
 * This script:
 * 1. Updates PlayerContract.rescissionClause for all duration=1 contracts
 * 2. Patches rubataBoard JSON in active MarketSessions
 *
 * Safe to run multiple times (idempotent).
 * Run with: node scripts/migrate-multiplier-duration1.cjs
 */

const { PrismaClient } = require('../node_modules/.prisma/client');
const prisma = new PrismaClient();

const OLD_MULTIPLIER = 4;
const NEW_MULTIPLIER = 3;

async function main() {
  console.log('=== MIGRATION: Change duration=1 multiplier from 4 to 3 ===\n');

  // ==================== STEP 1: DRY RUN - Show contracts ====================
  console.log('--- STEP 1: Contracts with duration=1 ---\n');

  const contracts = await prisma.playerContract.findMany({
    where: { duration: 1 },
    include: {
      roster: {
        include: {
          player: { select: { id: true, name: true, team: true, position: true } },
          leagueMember: {
            select: {
              id: true,
              teamName: true,
              leagueId: true,
              user: { select: { username: true } },
            },
          },
        },
      },
    },
  });

  console.log(`Found ${contracts.length} contracts with duration=1\n`);

  // Backup data
  const backup = [];
  let needsUpdate = 0;
  let alreadyCorrect = 0;

  for (const c of contracts) {
    const oldClause = c.rescissionClause;
    const expectedNew = c.salary * NEW_MULTIPLIER;
    const isAlreadyCorrect = oldClause === expectedNew;

    backup.push({
      id: c.id,
      salary: c.salary,
      duration: c.duration,
      rescissionClause: oldClause,
    });

    if (isAlreadyCorrect) {
      alreadyCorrect++;
    } else {
      needsUpdate++;
      console.log(`  ${c.roster.player.name} (${c.roster.player.team}) — ${c.roster.leagueMember.user.username}`);
      console.log(`    league: ${c.roster.leagueMember.leagueId}`);
      console.log(`    salary=${c.salary}, clause: ${oldClause} → ${expectedNew} (diff: ${expectedNew - oldClause})`);
    }
  }

  console.log(`\nSummary: ${needsUpdate} to update, ${alreadyCorrect} already correct\n`);

  if (needsUpdate === 0) {
    console.log('No contracts need updating.\n');
  }

  // ==================== STEP 2: Update PlayerContract.rescissionClause ====================
  console.log('--- STEP 2: Updating PlayerContract.rescissionClause ---\n');

  // Store backup
  console.log('BACKUP (save this for rollback):');
  console.log(JSON.stringify(backup.filter(b => b.rescissionClause !== b.salary * NEW_MULTIPLIER)));
  console.log('');

  const updateResult = await prisma.$executeRaw`
    UPDATE "PlayerContract"
    SET "rescissionClause" = salary * ${NEW_MULTIPLIER}
    WHERE duration = 1 AND "rescissionClause" != salary * ${NEW_MULTIPLIER}
  `;

  console.log(`Updated ${updateResult} contracts.\n`);

  // ==================== STEP 3: Patch rubataBoard JSON ====================
  console.log('--- STEP 3: Patching rubataBoard JSON in MarketSessions ---\n');

  const sessions = await prisma.marketSession.findMany({
    where: {
      rubataBoard: { not: null },
      status: 'ACTIVE',
    },
    select: {
      id: true,
      leagueId: true,
      rubataState: true,
      rubataBoardIndex: true,
      rubataBoard: true,
    },
  });

  console.log(`Found ${sessions.length} active sessions with rubataBoard\n`);

  for (const session of sessions) {
    const board = session.rubataBoard;
    if (!Array.isArray(board)) {
      console.log(`  Session ${session.id} (league ${session.leagueId}): board is not an array, skipping`);
      continue;
    }

    let patchCount = 0;
    const patchDetails = [];

    for (const entry of board) {
      if (entry.contractDuration === 1) {
        const oldClause = entry.contractClause;
        const oldRubata = entry.rubataPrice;
        const newClause = entry.contractSalary * NEW_MULTIPLIER;
        const newRubata = newClause + entry.contractSalary;

        if (oldClause !== newClause || oldRubata !== newRubata) {
          patchDetails.push({
            player: entry.playerName,
            salary: entry.contractSalary,
            clauseOld: oldClause,
            clauseNew: newClause,
            rubataOld: oldRubata,
            rubataNew: newRubata,
          });

          entry.contractClause = newClause;
          entry.rubataPrice = newRubata;
          patchCount++;
        }
      }
    }

    if (patchCount > 0) {
      console.log(`  Session ${session.id} (league ${session.leagueId}):`);
      console.log(`    state=${session.rubataState}, boardIndex=${session.rubataBoardIndex}`);
      console.log(`    Patching ${patchCount} entries:`);
      for (const d of patchDetails) {
        console.log(`      ${d.player}: clause ${d.clauseOld}→${d.clauseNew}, rubata ${d.rubataOld}→${d.rubataNew}`);
      }

      await prisma.marketSession.update({
        where: { id: session.id },
        data: { rubataBoard: board },
      });

      console.log(`    ✓ Board updated\n`);
    } else {
      console.log(`  Session ${session.id} (league ${session.leagueId}): no duration=1 entries to patch\n`);
    }
  }

  // ==================== STEP 4: Verification ====================
  console.log('--- STEP 4: Verification ---\n');

  const wrongContracts = await prisma.$queryRaw`
    SELECT pc.id, pc.salary, pc.duration, pc."rescissionClause",
      CASE
        WHEN pc.duration = 4 THEN pc.salary * 11
        WHEN pc.duration = 3 THEN pc.salary * 9
        WHEN pc.duration = 2 THEN pc.salary * 7
        WHEN pc.duration = 1 THEN pc.salary * 3
      END as expected
    FROM "PlayerContract" pc
    WHERE pc."rescissionClause" != CASE
        WHEN pc.duration = 4 THEN pc.salary * 11
        WHEN pc.duration = 3 THEN pc.salary * 9
        WHEN pc.duration = 2 THEN pc.salary * 7
        WHEN pc.duration = 1 THEN pc.salary * 3
      END
  `;

  if (wrongContracts.length === 0) {
    console.log('✓ All contracts have correct rescissionClause values!\n');
  } else {
    console.log(`✗ ${wrongContracts.length} contracts have incorrect clausola:\n`);
    for (const c of wrongContracts) {
      console.log(`  id=${c.id}, salary=${c.salary}, duration=${c.duration}, clause=${c.rescissionClause}, expected=${c.expected}`);
    }
  }

  // Count by duration
  const counts = await prisma.$queryRaw`
    SELECT duration, COUNT(*)::int as count,
      SUM(salary)::int as total_salary,
      SUM("rescissionClause")::int as total_clause
    FROM "PlayerContract"
    GROUP BY duration ORDER BY duration
  `;

  console.log('Contracts by duration:');
  for (const row of counts) {
    console.log(`  duration=${row.duration}: ${row.count} contracts, salary_total=${row.total_salary}, clause_total=${row.total_clause}`);
  }

  console.log('\n=== MIGRATION COMPLETE ===');
}

main()
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
