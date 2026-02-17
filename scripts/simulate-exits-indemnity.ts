/**
 * Simulate player exits (ESTERO, RETROCESSO, RITIRATO) and indemnity processing
 *
 * Step 1: Super admin marks players as NOT_IN_LIST with exit reasons
 * Step 2: League admin consolidates indemnities into prize categories
 * Step 3: League admin finalizes prizes → budget updated
 *
 * Run with: npx tsx scripts/simulate-exits-indemnity.ts <leagueId>
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function simulateExitsAndIndemnity() {
  const leagueId = process.argv[2]
  if (!leagueId) {
    console.error('Usage: npx tsx scripts/simulate-exits-indemnity.ts <leagueId>')
    return
  }

  try {
    const league = await prisma.league.findUnique({ where: { id: leagueId } })
    if (!league) {
      console.error('League not found!')
      return
    }
    console.log(`League: ${league.name} (${league.id})`)

    // Find active market session
    const marketSession = await prisma.marketSession.findFirst({
      where: { leagueId: league.id, status: 'ACTIVE' }
    })

    if (!marketSession) {
      console.error('No active market session found!')
      return
    }
    console.log(`Market session: ${marketSession.id} (phase: ${marketSession.currentPhase})`)

    // Get all members with rosters and contracts
    const members = await prisma.leagueMember.findMany({
      where: { leagueId: league.id, status: 'ACTIVE' },
      include: {
        user: { select: { id: true, username: true } },
        roster: {
          where: { status: 'ACTIVE' },
          include: {
            player: true,
            contract: true
          }
        }
      }
    })

    console.log(`\nFound ${members.length} managers`)

    // Pick players to mark as exited (from different managers)
    // We need players that have active contracts
    const playersWithContracts = members.flatMap(m =>
      m.roster
        .filter(r => r.contract !== null)
        .map(r => ({
          rosterId: r.id,
          playerId: r.playerId,
          playerName: r.player.name,
          playerTeam: r.player.team,
          playerPosition: r.player.position,
          memberId: m.id,
          memberUsername: m.user.username,
          salary: r.contract!.salary,
          duration: r.contract!.duration,
          rescissionClause: r.contract!.rescissionClause,
        }))
    )

    console.log(`\nPlayers with active contracts: ${playersWithContracts.length}`)

    if (playersWithContracts.length < 4) {
      console.error('Need at least 4 players with contracts to simulate exits!')
      return
    }

    // Pick players from different managers for variety
    const usedManagers = new Set<string>()
    const candidates: typeof playersWithContracts = []

    // Try to pick from different managers
    for (const p of playersWithContracts) {
      if (candidates.length >= 5) break
      if (!usedManagers.has(p.memberId) || candidates.length >= members.length) {
        candidates.push(p)
        usedManagers.add(p.memberId)
      }
    }

    // Assign exit reasons
    const exits = [
      { ...candidates[0], exitReason: 'ESTERO' as const },
      { ...candidates[1], exitReason: 'ESTERO' as const },
      { ...candidates[2], exitReason: 'RETROCESSO' as const },
      { ...candidates[3], exitReason: 'RITIRATO' as const },
    ]

    if (candidates[4]) {
      exits.push({ ...candidates[4], exitReason: 'ESTERO' as const })
    }

    // =============================================
    // STEP 1: Super admin marks players as exited
    // =============================================
    console.log('\n' + '='.repeat(60))
    console.log('STEP 1: Super admin classifica giocatori usciti')
    console.log('='.repeat(60))

    for (const exit of exits) {
      await prisma.serieAPlayer.update({
        where: { id: exit.playerId },
        data: {
          listStatus: 'NOT_IN_LIST',
          exitReason: exit.exitReason,
          exitDate: new Date(),
        }
      })

      const emoji = { ESTERO: '✈️', RETROCESSO: '⬇️', RITIRATO: '🏁' }
      console.log(`  ${emoji[exit.exitReason]} ${exit.playerName} (${exit.playerTeam}) → ${exit.exitReason}`)
      console.log(`     Owner: @${exit.memberUsername} | Contratto: ${exit.salary}x${exit.duration} | Clausola: ${exit.rescissionClause}`)
    }

    // =============================================
    // STEP 2: Create/update PrizePhaseConfig + indemnity categories
    // =============================================
    console.log('\n' + '='.repeat(60))
    console.log('STEP 2: Admin lega consolida indennizzi')
    console.log('='.repeat(60))

    // Ensure PrizePhaseConfig exists
    let prizeConfig = await prisma.prizePhaseConfig.findUnique({
      where: { marketSessionId: marketSession.id }
    })

    if (!prizeConfig) {
      prizeConfig = await prisma.prizePhaseConfig.create({
        data: {
          marketSessionId: marketSession.id,
          baseReincrement: 100,
        }
      })
      console.log('  Created PrizePhaseConfig (baseReincrement: 100)')
    } else {
      console.log(`  PrizePhaseConfig exists (baseReincrement: ${prizeConfig.baseReincrement})`)
    }

    // Create base "Indennizzo Partenza Estero" category if missing
    let baseCategory = await prisma.prizeCategory.findUnique({
      where: {
        marketSessionId_name: {
          marketSessionId: marketSession.id,
          name: 'Indennizzo Partenza Estero',
        }
      }
    })

    if (!baseCategory) {
      baseCategory = await prisma.prizeCategory.create({
        data: {
          marketSessionId: marketSession.id,
          name: 'Indennizzo Partenza Estero',
          isSystemPrize: true,
        }
      })
      console.log('  Created base indemnity category')
    }

    // Create per-player indemnity categories for ESTERO players
    const esteroExits = exits.filter(e => e.exitReason === 'ESTERO')
    const indemnityDefault = 50 // Default indemnity amount

    for (const exit of esteroExits) {
      const categoryName = `Indennizzo - ${exit.playerName}`

      let category = await prisma.prizeCategory.findUnique({
        where: {
          marketSessionId_name: {
            marketSessionId: marketSession.id,
            name: categoryName,
          }
        }
      })

      if (!category) {
        category = await prisma.prizeCategory.create({
          data: {
            marketSessionId: marketSession.id,
            name: categoryName,
            isSystemPrize: true,
          }
        })
      }

      // Set indemnity amount for the owner
      // Indemnity = MIN(rescissionClause, indemnityDefault)
      const indemnityAmount = Math.min(exit.rescissionClause, indemnityDefault)

      await prisma.sessionPrize.upsert({
        where: {
          prizeCategoryId_leagueMemberId: {
            prizeCategoryId: category.id,
            leagueMemberId: exit.memberId,
          }
        },
        update: { amount: indemnityAmount },
        create: {
          prizeCategoryId: category.id,
          leagueMemberId: exit.memberId,
          amount: indemnityAmount,
        }
      })

      console.log(`  📋 ${categoryName}: ${indemnityAmount}M → @${exit.memberUsername}`)
      console.log(`     (clausola ${exit.rescissionClause} vs default ${indemnityDefault} → MIN = ${indemnityAmount})`)
    }

    // Mark indemnity as consolidated
    await prisma.prizePhaseConfig.update({
      where: { id: prizeConfig.id },
      data: {
        indemnityConsolidated: true,
        indemnityConsolidatedAt: new Date(),
      }
    })

    console.log('\n  ✅ Indennizzi consolidati!')

    // =============================================
    // STEP 3: Finalize prizes → update budgets
    // =============================================
    console.log('\n' + '='.repeat(60))
    console.log('STEP 3: Finalizzazione premi → aggiornamento budget')
    console.log('='.repeat(60))

    // Calculate totals per member
    const allPrizes = await prisma.sessionPrize.findMany({
      where: {
        prizeCategory: { marketSessionId: marketSession.id }
      },
      include: {
        prizeCategory: true,
      }
    })

    // Group by member
    const memberTotals = new Map<string, { base: number; prizes: number; indemnity: number }>()

    // Initialize all members with base reincrement
    for (const member of members) {
      memberTotals.set(member.id, {
        base: prizeConfig.baseReincrement,
        prizes: 0,
        indemnity: 0,
      })
    }

    // Add prizes
    for (const prize of allPrizes) {
      const current = memberTotals.get(prize.leagueMemberId)
      if (!current) continue

      if (prize.prizeCategory.isSystemPrize) {
        current.indemnity += prize.amount
      } else {
        current.prizes += prize.amount
      }
    }

    // Update budgets
    for (const member of members) {
      const totals = memberTotals.get(member.id)!
      const totalAmount = totals.base + totals.prizes + totals.indemnity

      await prisma.leagueMember.update({
        where: { id: member.id },
        data: {
          currentBudget: { increment: totalAmount }
        }
      })

      const budgetBefore = member.currentBudget
      const budgetAfter = budgetBefore + totalAmount

      console.log(`  @${member.user.username}: budget ${budgetBefore}M → ${budgetAfter}M (+${totalAmount}M)`)
      if (totals.indemnity > 0) {
        console.log(`     Base: +${totals.base} | Indennizzo: +${totals.indemnity}`)
      } else {
        console.log(`     Base: +${totals.base}`)
      }
    }

    // Mark finalized
    await prisma.prizePhaseConfig.update({
      where: { id: prizeConfig.id },
      data: {
        isFinalized: true,
        finalizedAt: new Date(),
      }
    })

    // =============================================
    // SUMMARY
    // =============================================
    console.log('\n' + '='.repeat(60))
    console.log('RIEPILOGO')
    console.log('='.repeat(60))
    console.log(`\nGiocatori usciti: ${exits.length}`)
    console.log(`  ESTERO: ${esteroExits.length} (con indennizzo)`)
    console.log(`  RETROCESSO: ${exits.filter(e => e.exitReason === 'RETROCESSO').length} (senza indennizzo)`)
    console.log(`  RITIRATO: ${exits.filter(e => e.exitReason === 'RITIRATO').length} (senza indennizzo)`)
    console.log(`\nIndennizzi totali erogati: ${[...memberTotals.values()].reduce((s, t) => s + t.indemnity, 0)}M`)
    console.log(`Base reincrement: ${prizeConfig.baseReincrement}M x ${members.length} manager`)
    console.log(`\n✅ Simulazione completata! I dati sono visibili nella pagina Finanze.`)

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

simulateExitsAndIndemnity()
