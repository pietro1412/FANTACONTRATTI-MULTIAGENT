/**
 * Seed indennizzi ESTERO per Sim01 sulla lega "Playthrough Beta 2026-08-24" (produzione).
 *
 * Marca 3 giocatori GIÀ in rosa a Sim01 come usciti per l'estero (SerieAPlayer.listStatus
 * = NOT_IN_LIST, exitReason = ESTERO): è l'unico motivo di uscita che genera un indennizzo
 * configurabile in Fase Premi (RITIRATO/RETROCESSO sono gratuiti, vedi docs/bibbie/GIOCATORI.md).
 *
 * ⚠️ listStatus/exitReason sono globali sul catalogo SerieAPlayer (non per-lega): per il tempo
 * del test questi 3 giocatori risulteranno "fuori Serie A" in OGNI lega della piattaforma, non
 * solo in questa. Scelta esplicita di Pietro (2026-08-27), nessun controllo di isolamento extra.
 *
 * Idempotente: rieseguibile, non tocca giocatori già marcati come usciti da altrove.
 *
 * Run: bash scripts/with-env.sh .env.vercel npx tsx scripts/seed-indemnity-sim01.ts
 */
import { PrismaClient, RosterStatus } from '@prisma/client'
const prisma = new PrismaClient()

const LEAGUE_ID = 'cmt72bxuw0005sls2o232kz7x'
const MEMBER_EMAIL = 'sim01@sim.fantacontratti.it'
const COUNT = 3

async function main() {
  const member = await prisma.leagueMember.findFirst({
    where: { leagueId: LEAGUE_ID, user: { email: MEMBER_EMAIL } },
    include: { user: { select: { username: true } } },
  })

  if (!member) {
    console.log(`ERRORE: membro ${MEMBER_EMAIL} non trovato nella lega ${LEAGUE_ID}.`)
    return
  }

  console.log(`Membro trovato: ${member.teamName} (${member.user.username})`)

  const roster = await prisma.playerRoster.findMany({
    where: {
      leagueMemberId: member.id,
      status: RosterStatus.ACTIVE,
      contract: { isNot: null },
      player: { exitReason: null, listStatus: 'IN_LIST' },
    },
    include: { player: { select: { id: true, name: true } } },
    take: COUNT,
  })

  if (roster.length < COUNT) {
    console.log(`ERRORE: trovati solo ${roster.length}/${COUNT} giocatori idonei (in rosa, con contratto, non già usciti). STOP.`)
    return
  }

  const now = new Date()
  for (const r of roster) {
    await prisma.serieAPlayer.update({
      where: { id: r.player.id },
      data: { listStatus: 'NOT_IN_LIST', exitReason: 'ESTERO', exitDate: now },
    })
    console.log(`  ESTERO  ${r.player.name} (rosa di ${member.teamName})`)
  }

  console.log('\n=== VERIFICA ===')
  const check = await prisma.playerRoster.count({
    where: {
      leagueMemberId: member.id,
      status: RosterStatus.ACTIVE,
      player: { exitReason: 'ESTERO', listStatus: 'NOT_IN_LIST' },
    },
  })
  console.log(`Giocatori ESTERO in rosa di ${member.teamName}: ${check}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
