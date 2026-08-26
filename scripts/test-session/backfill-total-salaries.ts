/**
 * Backfill una tantum di LeagueMember.totalSalaries per tutti i membri ACTIVE esistenti,
 * necessario dopo aver aggiunto il campo (default 0) allo schema — senza questo, ogni lega
 * già esistente mostrerebbe un Bilancio gonfiato (Budget - 0) finché non arriva al prossimo
 * consolidamento Fase 3 Contratti.
 *
 * Calcola per ogni membro la somma live corrente dei contratti attivi (esattamente il valore
 * che il vecchio calcolo "live" mostrava fino a un istante prima) e la scrive in totalSalaries
 * — quindi non produce ALCUN cambiamento visibile nel Bilancio mostrato agli utenti.
 *
 * Idempotente: rieseguibile senza effetti collaterali (sovrascrive sempre col valore live
 * attuale). Opera su TUTTE le leghe del DB puntato da DATABASE_URL — non filtra per lega.
 *
 * Run locale:  bash scripts/with-env.sh .env.local npx tsx scripts/test-session/backfill-total-salaries.ts
 * Run su prod: DATABASE_URL=<prod> npx tsx scripts/test-session/backfill-total-salaries.ts
 */
import { PrismaClient, MemberStatus } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const members = await prisma.leagueMember.findMany({
    where: { status: MemberStatus.ACTIVE },
    select: { id: true, totalSalaries: true, league: { select: { name: true } }, user: { select: { username: true } } },
  })
  console.log(`Membri ACTIVE trovati: ${members.length}`)

  const salaryByMember = await prisma.playerContract.groupBy({
    by: ['leagueMemberId'],
    _sum: { salary: true },
  })
  const salaryMap = new Map(salaryByMember.map(r => [r.leagueMemberId, r._sum.salary || 0]))

  let updated = 0
  let unchanged = 0
  for (const m of members) {
    const liveSalary = salaryMap.get(m.id) || 0
    if (m.totalSalaries === liveSalary) {
      unchanged++
      continue
    }
    await prisma.leagueMember.update({
      where: { id: m.id },
      data: { totalSalaries: liveSalary },
    })
    console.log(`  ${m.league.name} / ${m.user.username}: totalSalaries ${m.totalSalaries} → ${liveSalary}`)
    updated++
  }

  console.log(`\nAggiornati: ${updated}. Già corretti (invariati): ${unchanged}.`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
