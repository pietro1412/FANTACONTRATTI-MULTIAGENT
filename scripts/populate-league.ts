import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const managers = [
  { username: 'luca', email: 'luca@test.com', teamName: 'Luca FC' },
  { username: 'giulia', email: 'giulia@test.com', teamName: 'Giulia United' },
  { username: 'andrea', email: 'andrea@test.com', teamName: 'Andrea City' },
  { username: 'sara', email: 'sara@test.com', teamName: 'Sara Rovers' },
  { username: 'marco', email: 'marco@test.com', teamName: 'Marco Athletic' },
  { username: 'elena', email: 'elena@test.com', teamName: 'Elena Stars' },
  { username: 'davide', email: 'davide@test.com', teamName: 'Davide FC' },
];

const PASSWORD = 'Password1';
const LEAGUE_ID = 'cmkc9hjn30001zwpfpe67zpbd';

async function main() {
  // Get league info for initial budget
  const league = await prisma.league.findUnique({
    where: { id: LEAGUE_ID }
  });
  
  if (!league) {
    console.log('Lega non trovata');
    return;
  }

  const hashedPassword = await bcrypt.hash(PASSWORD, 10);
  
  console.log('Creazione utenti e aggiunta alla lega...\n');
  
  for (const manager of managers) {
    // Check if user already exists
    let user = await prisma.user.findFirst({
      where: { OR: [{ email: manager.email }, { username: manager.username }] }
    });
    
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: manager.email,
          username: manager.username,
          passwordHash: hashedPassword,
        }
      });
      console.log(`Utente creato: ${manager.username}`);
    } else {
      console.log(`Utente già esistente: ${manager.username}`);
    }
    
    // Check if already member using findFirst
    const existingMember = await prisma.leagueMember.findFirst({
      where: {
        leagueId: LEAGUE_ID,
        userId: user.id
      }
    });
    
    if (!existingMember) {
      await prisma.leagueMember.create({
        data: {
          leagueId: LEAGUE_ID,
          userId: user.id,
          role: 'MANAGER',
          status: 'ACTIVE',
          joinType: 'INVITE',
          teamName: manager.teamName,
          currentBudget: league.initialBudget,
        }
      });
      console.log(`  -> Aggiunto alla lega come: ${manager.teamName}`);
    } else {
      console.log(`  -> Già membro della lega`);
    }
  }
  
  // Verify final count
  const finalCount = await prisma.leagueMember.count({
    where: { leagueId: LEAGUE_ID }
  });
  
  console.log('\n=== RIEPILOGO ===');
  console.log(`Membri totali nella lega: ${finalCount}`);
  console.log('\n=== CREDENZIALI ===');
  console.log('Password per tutti: ' + PASSWORD);
  console.log('\nUtenti:');
  for (const m of managers) {
    console.log(`  ${m.username} / ${PASSWORD}  (${m.teamName})`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
