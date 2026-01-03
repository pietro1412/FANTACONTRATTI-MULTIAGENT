const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🏆 Creazione nuova lega di test...\n');

  const password = 'test123';
  const passwordHash = await bcrypt.hash(password, 10);

  // Admin della lega
  const admin = {
    email: 'admin.lega@test.com',
    username: 'AdminLega',
    teamName: 'FC Admin',
  };

  // Altri manager
  const managers = [
    { email: 'manager1@test.com', username: 'Manager1', teamName: 'Squadra Uno' },
    { email: 'manager2@test.com', username: 'Manager2', teamName: 'Team Due' },
    { email: 'manager3@test.com', username: 'Manager3', teamName: 'Terzo FC' },
    { email: 'manager4@test.com', username: 'Manager4', teamName: 'Quarto United' },
  ];

  // Crea o aggiorna admin
  let adminUser = await prisma.user.findUnique({ where: { email: admin.email } });
  if (!adminUser) {
    adminUser = await prisma.user.create({
      data: {
        email: admin.email,
        username: admin.username,
        passwordHash,
        emailVerified: true,
      },
    });
    console.log(`✅ Admin creato: ${admin.email}`);
  } else {
    console.log(`⚠️  Admin già esistente: ${admin.email}`);
  }

  // Crea manager
  const managerUsers = [];
  for (const m of managers) {
    let user = await prisma.user.findUnique({ where: { email: m.email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: m.email,
          username: m.username,
          passwordHash,
          emailVerified: true,
        },
      });
      console.log(`✅ Manager creato: ${m.email}`);
    } else {
      console.log(`⚠️  Manager già esistente: ${m.email}`);
    }
    managerUsers.push({ user, teamName: m.teamName });
  }

  // Crea lega
  const leagueName = 'Lega Test Pusher';
  let league = await prisma.league.findFirst({ where: { name: leagueName } });

  if (league) {
    console.log(`\n⚠️  Lega "${leagueName}" già esistente, la ricreo...`);
    // Elimina membri esistenti
    await prisma.leagueMember.deleteMany({ where: { leagueId: league.id } });
    await prisma.league.delete({ where: { id: league.id } });
  }

  league = await prisma.league.create({
    data: {
      name: leagueName,
      description: 'Lega di test per Pusher real-time',
      initialBudget: 500,
      goalkeeperSlots: 3,
      defenderSlots: 8,
      midfielderSlots: 8,
      forwardSlots: 6,
      minParticipants: 4,
      maxParticipants: 8,
      status: 'ACTIVE',
    },
  });
  console.log(`\n🏆 Lega creata: ${leagueName}`);

  // Aggiungi admin come membro
  await prisma.leagueMember.create({
    data: {
      userId: adminUser.id,
      leagueId: league.id,
      role: 'ADMIN',
      teamName: admin.teamName,
      status: 'ACTIVE',
      currentBudget: league.initialBudget,
      firstMarketOrder: 0,
    },
  });
  console.log(`   👑 Admin aggiunto: ${admin.username} (${admin.teamName})`);

  // Aggiungi manager
  for (let i = 0; i < managerUsers.length; i++) {
    const { user, teamName } = managerUsers[i];
    await prisma.leagueMember.create({
      data: {
        userId: user.id,
        leagueId: league.id,
        role: 'MANAGER',
        teamName,
        status: 'ACTIVE',
        currentBudget: league.initialBudget,
        firstMarketOrder: i + 1,
      },
    });
    console.log(`   👤 Manager aggiunto: ${user.username} (${teamName})`);
  }

  // Riepilogo
  console.log('\n' + '='.repeat(50));
  console.log('📋 RIEPILOGO');
  console.log('='.repeat(50));
  console.log(`\n🏆 Lega: ${leagueName}`);
  console.log(`💰 Budget iniziale: ${league.initialBudget} crediti`);
  console.log(`👥 Partecipanti: 5 (1 admin + 4 manager)`);

  console.log('\n🔑 CREDENZIALI LOGIN:');
  console.log('─'.repeat(50));
  console.log(`   Admin:    ${admin.email} / ${password}`);
  managers.forEach(m => {
    console.log(`   Manager:  ${m.email} / ${password}`);
  });
  console.log('─'.repeat(50));

  console.log('\n✅ Pronto! Accedi su http://localhost:5173\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
