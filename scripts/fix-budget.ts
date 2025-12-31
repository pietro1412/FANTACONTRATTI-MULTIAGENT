import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function fix() {
  const result = await p.leagueMember.updateMany({
    where: { currentBudget: { lt: 0 } },
    data: { currentBudget: 0 }
  });
  console.log('Fixed', result.count, 'members with negative budget');
  await p.$disconnect();
}
fix();
