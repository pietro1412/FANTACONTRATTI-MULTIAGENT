const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const LEAGUE_ID = process.argv[2]

if (!LEAGUE_ID) {
  console.error('Uso: node scripts/completa_primo_mercato.cjs <league_id>')
  console.error('  oppure: npm run completa_primo_mercato -- <league_id>')
  process.exit(1)
}

// ===== FORMULE (identiche a contract.service.ts) =====
const DURATION_MULTIPLIERS = { 4: 11, 3: 9, 2: 7, 1: 3 }

function calculateDefaultSalary(auctionPrice) {
  return Math.max(1, Math.round(auctionPrice / 10))
}

function calculateRescissionClause(salary, duration) {
  return salary * (DURATION_MULTIPLIERS[duration] || 3)
}

// ===== SIMULAZIONE REALISTICA =====

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// Simula un prezzo d'asta realistico basato sulla quotazione
function simulateAuctionPrice(quotation, bilancio, remainingSlots) {
  // Riserva conservativa: ogni slot futuro costa almeno 3 (prezzo 1 + ingaggio 1 + margine 1)
  // Piu' slot mancano, piu' si risparmia
  const reserve = Math.max(remainingSlots * 3, 0)
  const spendable = Math.max(2, bilancio - reserve)

  // Budget cap: non spendere piu' di una quota equa del bilancio disponibile
  // (bilancio / slot_rimanenti_incluso_questo) con un po' di varianza
  const fairShare = Math.max(2, Math.floor(spendable / Math.max(1, remainingSlots + 1)))
  // Limita l'overspend: massimo 2x la quota equa (era 2.5x)
  const maxForThisPlayer = Math.floor(fairShare * (1.2 + Math.random() * 0.8)) // fino a 2x la quota equa

  // Prezzo base: quotazione +/- varianza
  const variance = Math.random()
  let price
  if (variance < 0.15) {
    // 15% affare: sotto quotazione
    price = Math.max(1, Math.floor(quotation * (0.5 + Math.random() * 0.4)))
  } else if (variance < 0.85) {
    // 70% normale: intorno alla quotazione
    price = Math.max(1, Math.floor(quotation * (0.8 + Math.random() * 0.5)))
  } else {
    // 15% overpay: sopra quotazione (asta combattuta)
    price = Math.max(1, Math.floor(quotation * (1.2 + Math.random() * 0.5)))
  }

  // Cap al budget disponibile per questo giocatore
  price = Math.min(price, maxForThisPlayer)

  // Verifica finale: prezzo + ingaggio deve stare nel bilancio meno la riserva
  const salary = calculateDefaultSalary(price)
  if (price + salary > spendable) {
    price = Math.max(1, Math.floor(spendable * 0.8))
  }

  return Math.max(1, price)
}

// Simula eventuale modifica contratto post-acquisto (come farebbe un manager)
function simulateContractModification(defaultSalary, defaultDuration, auctionPrice, bilancio) {
  // 70% dei casi: contratto default
  if (Math.random() < 0.70) {
    return { salary: defaultSalary, duration: defaultDuration, modified: false }
  }

  // 30% dei casi: modifica contratto
  let newSalary = defaultSalary
  let newDuration = defaultDuration

  const modType = Math.random()
  if (modType < 0.4) {
    // Solo aumento ingaggio (+1 o +2)
    const increase = randomInt(1, Math.min(3, Math.floor(defaultSalary * 0.5) + 1))
    newSalary = defaultSalary + increase
  } else if (modType < 0.7) {
    // Aumento ingaggio + durata a 4
    const increase = randomInt(1, Math.min(2, Math.floor(defaultSalary * 0.3) + 1))
    newSalary = defaultSalary + increase
    newDuration = 4
  } else {
    // Durata a 4 con minimo aumento ingaggio
    newSalary = defaultSalary + 1
    newDuration = 4
  }

  // Verifica che il bilancio lo consenta (prezzo + nuovo ingaggio)
  if (auctionPrice + newSalary > bilancio) {
    return { salary: defaultSalary, duration: defaultDuration, modified: false }
  }

  return { salary: newSalary, duration: newDuration, modified: true }
}

// ===== MAIN =====
async function completa_primo_mercato(leagueId) {
  console.log('=== COMPLETAMENTO AUTOMATICO PRIMO MERCATO ===\n')
  console.log(`League ID: ${leagueId}\n`)

  // 1. Carica lega
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
  })
  if (!league) {
    console.error('ERRORE: Lega non trovata!')
    process.exit(1)
  }
  console.log(`Lega: ${league.name}`)

  const slotConfig = {
    P: league.goalkeeperSlots,
    D: league.defenderSlots,
    C: league.midfielderSlots,
    A: league.forwardSlots,
  }
  const totalSlots = slotConfig.P + slotConfig.D + slotConfig.C + slotConfig.A
  console.log(`Slot per manager: ${totalSlots} (${slotConfig.P}P ${slotConfig.D}D ${slotConfig.C}C ${slotConfig.A}A)`)

  // 2. Carica membri
  const members = await prisma.leagueMember.findMany({
    where: { leagueId, status: 'ACTIVE' },
    include: {
      user: { select: { username: true } },
      roster: {
        where: { status: 'ACTIVE' },
        include: { player: { select: { position: true } } },
      },
    },
  })
  console.log(`Membri attivi: ${members.length}\n`)

  // 3. Crea o trova MarketSession PRIMO_MERCATO
  let session = await prisma.marketSession.findFirst({
    where: { leagueId, type: 'PRIMO_MERCATO' },
  })
  if (!session) {
    session = await prisma.marketSession.create({
      data: {
        leagueId,
        type: 'PRIMO_MERCATO',
        season: 1,
        semester: 1,
        status: 'ACTIVE',
        currentPhase: 'ASTA_LIBERA',
        currentRole: 'P',
        auctionTimerSeconds: 30,
        turnOrder: JSON.stringify(members.map(m => m.id)),
        currentTurnIndex: 0,
        startsAt: new Date(),
      },
    })
    console.log(`Sessione PRIMO_MERCATO creata (ID: ${session.id})`)
  } else {
    console.log(`Sessione PRIMO_MERCATO esistente (ID: ${session.id})`)
  }

  // 4. Giocatori gia' assegnati nella lega
  const takenIds = new Set(
    (await prisma.playerRoster.findMany({
      where: { leagueMember: { leagueId }, status: 'ACTIVE' },
      select: { playerId: true },
    })).map(p => p.playerId)
  )

  // 5. Giocatori disponibili per posizione
  const allAvailable = await prisma.serieAPlayer.findMany({
    where: { isActive: true, id: { notIn: Array.from(takenIds) } },
    orderBy: { quotation: 'desc' },
  })
  const pool = {
    P: allAvailable.filter(p => p.position === 'P'),
    D: allAvailable.filter(p => p.position === 'D'),
    C: allAvailable.filter(p => p.position === 'C'),
    A: allAvailable.filter(p => p.position === 'A'),
  }
  console.log(`Giocatori disponibili: ${allAvailable.length} (${pool.P.length}P ${pool.D.length}D ${pool.C.length}C ${pool.A.length}A)\n`)

  // 6. Per ogni membro, riempi gli slot mancanti
  let totalAdded = 0
  let totalModified = 0
  let auctionOrder = 0

  for (const member of members) {
    const currentCount = { P: 0, D: 0, C: 0, A: 0 }
    for (const entry of member.roster) {
      currentCount[entry.player.position] = (currentCount[entry.player.position] || 0) + 1
    }

    let memberBudget = member.currentBudget
    let memberAdded = 0
    let memberModified = 0
    const memberAcquisitions = []

    // Calcola slot mancanti totali per questo membro
    let totalMissing = 0
    for (const pos of ['P', 'D', 'C', 'A']) {
      totalMissing += Math.max(0, slotConfig[pos] - (currentCount[pos] || 0))
    }

    for (const position of ['P', 'D', 'C', 'A']) {
      const needed = slotConfig[position] - (currentCount[position] || 0)
      if (needed <= 0) continue

      for (let i = 0; i < needed; i++) {
        const posPlayers = pool[position]
        if (!posPlayers || posPlayers.length === 0) continue

        // Scegli un giocatore (pesato: top player piu' probabile nelle prime pick)
        const pickIndex = Math.min(
          Math.floor(Math.random() * Math.min(posPlayers.length, 10 + Math.floor(Math.random() * 20))),
          posPlayers.length - 1
        )
        const player = posPlayers[pickIndex]
        posPlayers.splice(pickIndex, 1)

        // Slot rimanenti dopo questo acquisto (totalMissing è già decrementato ad ogni pick)
        const remainingAfter = totalMissing - 1

        // Simula prezzo asta
        // Monte ingaggi corrente per bilancio
        const monteIngaggi = await prisma.playerContract.aggregate({
          where: { leagueMemberId: member.id },
          _sum: { salary: true },
        })
        const currentMonteIngaggi = (monteIngaggi._sum.salary || 0) +
          memberAcquisitions.reduce((sum, a) => sum + a.salary, 0)
        const bilancio = memberBudget - currentMonteIngaggi

        const auctionPrice = simulateAuctionPrice(player.quotation, bilancio, remainingAfter)

        // Verifica che possa permetterselo, fallback a prezzo minimo
        let finalPrice = auctionPrice
        if (finalPrice + calculateDefaultSalary(finalPrice) > bilancio) {
          // Fallback: compra a 1 (costo totale = 1 prezzo + 1 ingaggio = 2)
          if (bilancio >= 2) {
            finalPrice = 1
          } else {
            continue // Davvero non puo' permettersi nulla
          }
        }
        // Ricalcola salary/duration con prezzo eventualmente corretto
        const salaryForFinal = calculateDefaultSalary(finalPrice)
        const durationForFinal = 3

        // Simula eventuale modifica contratto
        const modification = simulateContractModification(
          salaryForFinal, durationForFinal, finalPrice, bilancio
        )
        const finalSalary = modification.salary
        const finalDuration = modification.duration
        const rescissionClause = calculateRescissionClause(finalSalary, finalDuration)

        auctionOrder++

        // === CREA AUCTION (COMPLETED) ===
        const auction = await prisma.auction.create({
          data: {
            leagueId,
            marketSessionId: session.id,
            playerId: player.id,
            type: 'FREE_BID',
            basePrice: 1,
            currentPrice: finalPrice,
            winnerId: member.id,
            nominatorId: member.id,
            status: 'COMPLETED',
            timerSeconds: 30,
            startsAt: new Date(Date.now() - (totalSlots - auctionOrder) * 120000),
            endsAt: new Date(Date.now() - (totalSlots - auctionOrder) * 120000 + 60000),
          },
        })

        // === CREA BID VINCENTE ===
        await prisma.auctionBid.create({
          data: {
            auctionId: auction.id,
            bidderId: member.id,
            userId: member.userId,
            amount: finalPrice,
            isWinning: true,
          },
        })

        // === CREA ROSTER ===
        const rosterEntry = await prisma.playerRoster.create({
          data: {
            leagueMemberId: member.id,
            playerId: player.id,
            acquisitionPrice: finalPrice,
            acquisitionType: 'FIRST_MARKET',
            status: 'ACTIVE',
          },
        })

        // === CREA CONTRATTO ===
        await prisma.playerContract.create({
          data: {
            rosterId: rosterEntry.id,
            leagueMemberId: member.id,
            salary: finalSalary,
            duration: finalDuration,
            initialSalary: modification.modified ? salaryForFinal : finalSalary,
            initialDuration: durationForFinal,
            rescissionClause,
          },
        })

        // === REGISTRA MOVIMENTO ===
        await prisma.playerMovement.create({
          data: {
            leagueId,
            playerId: player.id,
            movementType: 'FIRST_MARKET',
            toMemberId: member.id,
            price: finalPrice,
            newSalary: finalSalary,
            newDuration: finalDuration,
            newClause: rescissionClause,
            auctionId: auction.id,
            marketSessionId: session.id,
          },
        })

        // === AGGIORNA BUDGET ===
        memberBudget -= finalPrice

        memberAdded++
        totalAdded++
        if (modification.modified) {
          memberModified++
          totalModified++
        }

        memberAcquisitions.push({
          name: player.name,
          position: player.position,
          price: finalPrice,
          salary: finalSalary,
          duration: finalDuration,
          modified: modification.modified,
        })

        currentCount[position] = (currentCount[position] || 0) + 1
        totalMissing--
      }
    }

    // Salva budget aggiornato
    await prisma.leagueMember.update({
      where: { id: member.id },
      data: { currentBudget: Math.max(0, memberBudget) },
    })

    // Riepilogo membro
    const monteIngaggiFinal = memberAcquisitions.reduce((sum, a) => sum + a.salary, 0) +
      ((await prisma.playerContract.aggregate({
        where: { leagueMemberId: member.id, roster: { acquisitionType: { not: 'FIRST_MARKET' } } },
        _sum: { salary: true },
      }))._sum.salary || 0)
    // Ricalcola monte ingaggi totale reale
    const realMonteIngaggi = (await prisma.playerContract.aggregate({
      where: { leagueMemberId: member.id },
      _sum: { salary: true },
    }))._sum.salary || 0

    console.log(`  ${member.user.username} (${member.teamName}):`)
    console.log(`    +${memberAdded} giocatori (${memberModified} con contratto modificato)`)
    console.log(`    Budget: ${league.initialBudget} -> ${memberBudget} | Ingaggi: ${realMonteIngaggi} | Bilancio: ${memberBudget - realMonteIngaggi}`)

    // Mostra top 3 acquisti piu' costosi
    const topAcq = memberAcquisitions.sort((a, b) => b.price - a.price).slice(0, 3)
    for (const a of topAcq) {
      const defSal = calculateDefaultSalary(a.price)
      const mod = a.modified ? ` [MOD ${a.salary}x${a.duration}]` : ''
      console.log(`    ${a.position} ${a.name}: ${a.price} (${defSal}x3 default)${mod}`)
    }
    console.log('')
  }

  // 7. Chiudi sessione
  await prisma.marketSession.update({
    where: { id: session.id },
    data: {
      status: 'COMPLETED',
      currentPhase: null,
      currentRole: null,
      endsAt: new Date(),
    },
  })

  // === RIEPILOGO FINALE ===
  console.log('=============================================')
  console.log('     PRIMO MERCATO COMPLETATO!')
  console.log('=============================================')
  console.log(`  Giocatori assegnati: ${totalAdded}`)
  console.log(`  Contratti modificati: ${totalModified} (${Math.round(totalModified/totalAdded*100)}%)`)
  console.log(`  Aste simulate: ${auctionOrder}`)
  console.log(`  Movimenti registrati: ${totalAdded}`)
  console.log('')

  // Tabella finale
  const finalMembers = await prisma.leagueMember.findMany({
    where: { leagueId, status: 'ACTIVE' },
    include: {
      user: { select: { username: true } },
      roster: { where: { status: 'ACTIVE' } },
      contracts: true,
    },
  })

  console.log('  Manager         | Rosa | Budget | Ingaggi | Bilancio')
  console.log('  ----------------|------|--------|---------|--------')
  for (const m of finalMembers) {
    const ingaggi = m.contracts.reduce((sum, c) => sum + c.salary, 0)
    const bilancio = m.currentBudget - ingaggi
    const name = (m.teamName || m.user.username).padEnd(16).substring(0, 16)
    console.log(`  ${name}| ${String(m.roster.length).padStart(4)} | ${String(m.currentBudget).padStart(6)} | ${String(ingaggi).padStart(7)} | ${String(bilancio).padStart(7)}`)
  }
  console.log('')
  console.log('  Sessione PRIMO_MERCATO: COMPLETED')
  console.log('  Pronto per i mercati ricorrenti.')
  console.log('=============================================\n')
}

completa_primo_mercato(LEAGUE_ID)
  .catch(console.error)
  .finally(() => prisma.$disconnect())
