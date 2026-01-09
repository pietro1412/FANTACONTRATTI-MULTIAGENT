import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const leagues = await prisma.league.findMany({
    include: {
      members: {
        include: {
          user: { select: { id: true, username: true } },
          roster: {
            where: { status: 'ACTIVE' },
            include: {
              player: { select: { id: true, name: true, position: true } },
              contract: true
            }
          }
        }
      },
      marketSessions: true
    }
  });

  console.log('Leghe trovate:', leagues.length);
  for (const l of leagues) {
    console.log('\n=== ' + l.name + ' ===');
    console.log('ID:', l.id);
    console.log('Status:', l.status);
    console.log('Membri:', l.members.length);
    for (const m of l.members) {
      console.log('  -', m.user.username, '| Status:', m.status, '| Budget:', m.currentBudget, '| MemberID:', m.id);
      console.log('    Roster count:', m.roster.length);
      if (m.roster.length > 0) {
        console.log('    Primi 3 giocatori:');
        m.roster.slice(0, 3).forEach(r => {
          console.log('      *', r.player.name, '(' + r.player.position + ') RosterID:', r.id);
        });
      }
    }
    console.log('Sessioni:', l.marketSessions.length);
    l.marketSessions.forEach(s => {
      console.log('  - ID:', s.id, '| Type:', s.type, '| Phase:', s.currentPhase, '| Status:', s.status);
    });
  }
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
