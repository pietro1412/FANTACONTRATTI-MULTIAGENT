import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const league = await prisma.league.findUnique({
    where: { id: 'cmkc9hjn30001zwpfpe67zpbd' },
    include: {
      members: {
        include: { user: true }
      }
    }
  });
  
  if (!league) {
    console.log('Lega non trovata');
    return;
  }
  
  console.log('Lega:', league.name);
  console.log('Max partecipanti:', league.maxParticipants);
  console.log('Membri attuali:', league.members.length);
  console.log('Membri:');
  for (const m of league.members) {
    console.log(`- ${m.user.username} (${m.role}, ${m.status})`);
  }
}

main().finally(() => prisma.$disconnect());
