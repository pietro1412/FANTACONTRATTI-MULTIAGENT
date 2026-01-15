import { PrismaClient, AuctionType, AuctionStatus, MemberStatus, RosterStatus, TradeStatus, MovementType } from '@prisma/client'

const prisma = new PrismaClient()

const LEAGUE_ID = 'cmkc9hjn30001zwpfpe67zpbd'

async function main() {
  console.log('🧹 Resetting league data...')

  // Get league info
  const league = await prisma.league.findUnique({
    where: { id: LEAGUE_ID },
    include: {
      members: {
        where: { status: MemberStatus.ACTIVE },
        include: { user: true }
      }
    }
  })

  if (!league) {
    console.error('❌ League not found!')
    return
  }

  console.log(`📋 League: ${league.name} with ${league.members.length} members`)

  // Delete existing data in order (respecting foreign keys)
  console.log('  - Deleting prophecies...')
  await prisma.prophecy.deleteMany({ where: { leagueId: LEAGUE_ID } })

  console.log('  - Deleting player movements...')
  await prisma.playerMovement.deleteMany({ where: { leagueId: LEAGUE_ID } })

  console.log('  - Deleting auction acknowledgments...')
  await prisma.auctionAcknowledgment.deleteMany({
    where: { auction: { leagueId: LEAGUE_ID } }
  })

  console.log('  - Deleting auction bids...')
  await prisma.auctionBid.deleteMany({
    where: { auction: { leagueId: LEAGUE_ID } }
  })

  console.log('  - Deleting auction appeals...')
  await prisma.auctionAppeal.deleteMany({
    where: { auction: { leagueId: LEAGUE_ID } }
  })

  console.log('  - Deleting auctions...')
  await prisma.auction.deleteMany({ where: { leagueId: LEAGUE_ID } })

  console.log('  - Deleting trade offers...')
  await prisma.tradeOffer.deleteMany({
    where: { marketSession: { leagueId: LEAGUE_ID } }
  })

  console.log('  - Deleting session prizes...')
  await prisma.sessionPrize.deleteMany({
    where: { prizeCategory: { marketSession: { leagueId: LEAGUE_ID } } }
  })

  console.log('  - Deleting prize categories...')
  await prisma.prizeCategory.deleteMany({
    where: { marketSession: { leagueId: LEAGUE_ID } }
  })

  console.log('  - Deleting prize phase configs...')
  await prisma.prizePhaseConfig.deleteMany({
    where: { marketSession: { leagueId: LEAGUE_ID } }
  })

  console.log('  - Deleting contract consolidations...')
  await prisma.contractConsolidation.deleteMany({
    where: { session: { leagueId: LEAGUE_ID } }
  })

  console.log('  - Deleting draft contracts...')
  await prisma.draftContract.deleteMany({
    where: { session: { leagueId: LEAGUE_ID } }
  })

  console.log('  - Deleting player contracts...')
  await prisma.playerContract.deleteMany({
    where: { roster: { leagueMember: { leagueId: LEAGUE_ID } } }
  })

  console.log('  - Deleting player rosters...')
  await prisma.playerRoster.deleteMany({
    where: { leagueMember: { leagueId: LEAGUE_ID } }
  })

  console.log('  - Deleting chat messages...')
  await prisma.chatMessage.deleteMany({
    where: { marketSession: { leagueId: LEAGUE_ID } }
  })

  console.log('  - Deleting market sessions...')
  await prisma.marketSession.deleteMany({ where: { leagueId: LEAGUE_ID } })

  // Reset member budgets
  console.log('  - Resetting member budgets...')
  await prisma.leagueMember.updateMany({
    where: { leagueId: LEAGUE_ID },
    data: { currentBudget: league.initialBudget }
  })

  console.log('✅ League data reset complete!\n')

  // Get all players
  const allPlayers = await prisma.serieAPlayer.findMany({
    orderBy: { quotation: 'desc' }
  })

  if (allPlayers.length < 100) {
    console.error('❌ Not enough players in database!')
    return
  }

  // Group by position
  const playersByPosition = {
    P: allPlayers.filter(p => p.position === 'P').slice(0, 30),
    D: allPlayers.filter(p => p.position === 'D').slice(0, 80),
    C: allPlayers.filter(p => p.position === 'C').slice(0, 80),
    A: allPlayers.filter(p => p.position === 'A').slice(0, 60),
  }

  const members = league.members
  const memberCount = members.length

  console.log(`\n🏆 Creating PRIMO MERCATO session...`)

  // Create first market session
  const primoMercato = await prisma.marketSession.create({
    data: {
      leagueId: LEAGUE_ID,
      type: 'PRIMO_MERCATO',
      season: 1,
      semester: 1, // 1 = estivo
      status: 'COMPLETED',
      currentPhase: null,
      startsAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      endsAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000), // 25 days ago
    }
  })

  console.log(`  Session ID: ${primoMercato.id}`)

  // Simulate first market auctions
  console.log('  - Simulating auctions...')

  const slotsPerMember = {
    P: league.goalkeeperSlots,
    D: league.defenderSlots,
    C: league.midfielderSlots,
    A: league.forwardSlots,
  }

  let auctionCount = 0
  const memberBudgets: Record<string, number> = {}
  members.forEach(m => { memberBudgets[m.id] = league.initialBudget })

  // Assign players to members via auctions
  for (const position of ['P', 'D', 'C', 'A'] as const) {
    const players = playersByPosition[position]
    const slotsNeeded = slotsPerMember[position]

    for (let slot = 0; slot < slotsNeeded; slot++) {
      for (let memberIdx = 0; memberIdx < memberCount; memberIdx++) {
        const playerIdx = slot * memberCount + memberIdx
        if (playerIdx >= players.length) continue

        const player = players[playerIdx]
        const member = members[memberIdx]

        // Calculate price (base + random premium)
        const basePrice = Math.max(1, Math.floor(player.quotation / 2))
        const premium = Math.floor(Math.random() * 10)
        const finalPrice = Math.min(basePrice + premium, memberBudgets[member.id] - 10)

        if (finalPrice <= 0 || memberBudgets[member.id] < finalPrice) continue

        // Create auction
        const auction = await prisma.auction.create({
          data: {
            leagueId: LEAGUE_ID,
            marketSessionId: primoMercato.id,
            playerId: player.id,
            type: AuctionType.FREE_BID,
            status: AuctionStatus.COMPLETED,
            basePrice: basePrice,
            currentPrice: finalPrice,
            winnerId: member.id,
            nominatorId: members[(memberIdx + 1) % memberCount].id,
            timerSeconds: 30,
            startsAt: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000 + auctionCount * 60000),
            endsAt: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000 + auctionCount * 60000 + 120000),
          }
        })

        // Create some bids
        const bidderCount = Math.min(3, Math.floor(Math.random() * 4) + 1)
        const bidders = members.filter(m => m.id !== member.id).slice(0, bidderCount)

        let currentBidPrice = basePrice
        for (let b = 0; b < bidderCount; b++) {
          currentBidPrice += Math.floor(Math.random() * 3) + 1
          if (currentBidPrice >= finalPrice) break

          await prisma.auctionBid.create({
            data: {
              auctionId: auction.id,
              bidderId: bidders[b % bidders.length].id,
              userId: bidders[b % bidders.length].userId,
              amount: currentBidPrice,
              isWinning: false,
              placedAt: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000 + auctionCount * 60000 + b * 10000),
            }
          })
        }

        // Create winning bid
        await prisma.auctionBid.create({
          data: {
            auctionId: auction.id,
            bidderId: member.id,
            userId: member.userId,
            amount: finalPrice,
            isWinning: true,
            placedAt: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000 + auctionCount * 60000 + 60000),
          }
        })

        // Create roster entry
        const roster = await prisma.playerRoster.create({
          data: {
            leagueMemberId: member.id,
            playerId: player.id,
            status: RosterStatus.ACTIVE,
            acquisitionType: 'FIRST_MARKET',
            acquisitionPrice: finalPrice,
            acquiredAt: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000 + auctionCount * 60000),
          }
        })

        // Create contract
        const contractDuration = Math.floor(Math.random() * 3) + 1
        const contractSalary = Math.max(1, Math.floor(finalPrice / 3))
        const rescissionClause = contractSalary * 3 // Default multiplier

        await prisma.playerContract.create({
          data: {
            rosterId: roster.id,
            leagueMemberId: member.id,
            salary: contractSalary,
            duration: contractDuration,
            initialSalary: contractSalary,
            initialDuration: contractDuration,
            rescissionClause: rescissionClause,
            signedAt: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000),
            expiresAt: new Date(Date.now() + contractDuration * 365 * 24 * 60 * 60 * 1000),
          }
        })

        // Create movement
        await prisma.playerMovement.create({
          data: {
            leagueId: LEAGUE_ID,
            playerId: player.id,
            movementType: MovementType.FIRST_MARKET,
            toMemberId: member.id,
            price: finalPrice,
            newSalary: contractSalary,
            newDuration: contractDuration,
            auctionId: auction.id,
            marketSessionId: primoMercato.id,
          }
        })

        memberBudgets[member.id] -= finalPrice
        auctionCount++
      }
    }
  }

  // Update member budgets after first market
  for (const member of members) {
    await prisma.leagueMember.update({
      where: { id: member.id },
      data: { currentBudget: memberBudgets[member.id] }
    })
  }

  console.log(`  ✅ Created ${auctionCount} first market auctions\n`)

  // ========== MERCATO RICORRENTE ==========
  console.log('🔄 Creating MERCATO RICORRENTE session...')

  const mercatoRicorrente = await prisma.marketSession.create({
    data: {
      leagueId: LEAGUE_ID,
      type: 'MERCATO_RICORRENTE',
      season: 1,
      semester: 2, // 2 = invernale
      status: 'COMPLETED',
      currentPhase: null,
      startsAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      endsAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    }
  })

  console.log(`  Session ID: ${mercatoRicorrente.id}`)

  // Get current rosters
  const rosters = await prisma.playerRoster.findMany({
    where: {
      leagueMember: { leagueId: LEAGUE_ID },
      status: RosterStatus.ACTIVE
    },
    include: {
      player: true,
      contract: true,
      leagueMember: { include: { user: true } }
    }
  })

  // ===== PHASE 1: OFFERTE PRE-RINNOVO (Trades) =====
  console.log('  - Creating trade offers (pre-renewal)...')

  let tradeCount = 0
  const acceptedTrades: string[] = []

  // Create some trade offers between members
  for (let i = 0; i < members.length - 1; i++) {
    const sender = members[i]
    const receiver = members[(i + 1) % members.length]

    const senderRosters = rosters.filter(r => r.leagueMemberId === sender.id)
    const receiverRosters = rosters.filter(r => r.leagueMemberId === receiver.id)

    if (senderRosters.length < 2 || receiverRosters.length < 2) continue

    // Create an accepted trade
    const offeredPlayer = senderRosters[Math.floor(Math.random() * senderRosters.length)]
    const requestedPlayer = receiverRosters[Math.floor(Math.random() * receiverRosters.length)]

    const trade = await prisma.tradeOffer.create({
      data: {
        marketSessionId: mercatoRicorrente.id,
        senderId: sender.userId,
        receiverId: receiver.userId,
        offeredPlayers: [offeredPlayer.id],
        requestedPlayers: [requestedPlayer.id],
        involvedPlayers: [offeredPlayer.id, requestedPlayer.id],
        offeredBudget: Math.floor(Math.random() * 10),
        requestedBudget: 0,
        status: TradeStatus.ACCEPTED,
        message: `Propongo scambio: ${offeredPlayer.player.name} per ${requestedPlayer.player.name}`,
        expiresAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        respondedAt: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000),
      }
    })
    acceptedTrades.push(trade.id)
    tradeCount++

    // Execute the trade - swap rosters
    await prisma.playerRoster.update({
      where: { id: offeredPlayer.id },
      data: { leagueMemberId: receiver.id }
    })
    await prisma.playerRoster.update({
      where: { id: requestedPlayer.id },
      data: { leagueMemberId: sender.id }
    })

    // Create movements for trade
    await prisma.playerMovement.create({
      data: {
        leagueId: LEAGUE_ID,
        playerId: offeredPlayer.playerId,
        movementType: MovementType.TRADE,
        fromMemberId: sender.id,
        toMemberId: receiver.id,
        tradeId: trade.id,
        marketSessionId: mercatoRicorrente.id,
      }
    })
    await prisma.playerMovement.create({
      data: {
        leagueId: LEAGUE_ID,
        playerId: requestedPlayer.playerId,
        movementType: MovementType.TRADE,
        fromMemberId: receiver.id,
        toMemberId: sender.id,
        tradeId: trade.id,
        marketSessionId: mercatoRicorrente.id,
      }
    })

    // Create a rejected trade
    if (senderRosters.length > 2 && receiverRosters.length > 2) {
      const offeredPlayer2 = senderRosters.find(r => r.id !== offeredPlayer.id)
      const requestedPlayer2 = receiverRosters.find(r => r.id !== requestedPlayer.id)

      if (offeredPlayer2 && requestedPlayer2) {
        await prisma.tradeOffer.create({
          data: {
            marketSessionId: mercatoRicorrente.id,
            senderId: receiver.userId,
            receiverId: sender.userId,
            offeredPlayers: [requestedPlayer2.id],
            requestedPlayers: [offeredPlayer2.id],
            involvedPlayers: [requestedPlayer2.id, offeredPlayer2.id],
            offeredBudget: 0,
            requestedBudget: 5,
            status: TradeStatus.REJECTED,
            message: `Voglio ${offeredPlayer2.player.name}!`,
            expiresAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
            respondedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
          }
        })
        tradeCount++
      }
    }
  }

  console.log(`    Created ${tradeCount} trade offers`)

  // ===== PHASE 2: PREMI =====
  console.log('  - Creating prize phase...')

  const prizeConfig = await prisma.prizePhaseConfig.create({
    data: {
      marketSessionId: mercatoRicorrente.id,
      baseReincrement: 100,
      isFinalized: true,
      finalizedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
    }
  })

  // Create prize categories
  const indennizzoCategory = await prisma.prizeCategory.create({
    data: {
      marketSessionId: mercatoRicorrente.id,
      name: 'Indennizzo Partenza Estero',
      isSystemPrize: true,
    }
  })

  const bonusCategory = await prisma.prizeCategory.create({
    data: {
      marketSessionId: mercatoRicorrente.id,
      name: 'Bonus Classifica',
      isSystemPrize: false,
    }
  })

  // Assign prizes
  for (let i = 0; i < members.length; i++) {
    const member = members[i]

    // Indennizzo for all
    await prisma.sessionPrize.create({
      data: {
        prizeCategoryId: indennizzoCategory.id,
        leagueMemberId: member.id,
        amount: 50,
      }
    })

    // Bonus based on "position"
    const bonusAmount = (members.length - i) * 10
    await prisma.sessionPrize.create({
      data: {
        prizeCategoryId: bonusCategory.id,
        leagueMemberId: member.id,
        amount: bonusAmount,
      }
    })

    // Update member budget with prizes
    const totalPrize = 100 + 50 + bonusAmount
    await prisma.leagueMember.update({
      where: { id: member.id },
      data: { currentBudget: { increment: totalPrize } }
    })
  }

  console.log('    Created prize phase with 2 categories')

  // ===== PHASE 3: CONTRATTI (Renewals) =====
  console.log('  - Creating contract renewals...')

  // Refresh rosters after trades
  const currentRosters = await prisma.playerRoster.findMany({
    where: {
      leagueMember: { leagueId: LEAGUE_ID },
      status: RosterStatus.ACTIVE
    },
    include: {
      player: true,
      contract: true,
      leagueMember: true
    }
  })

  let renewalCount = 0
  for (const roster of currentRosters) {
    if (!roster.contract) continue

    // Renew some contracts
    if (Math.random() > 0.5) {
      const oldSalary = roster.contract.salary
      const oldDuration = roster.contract.duration
      const newSalary = oldSalary + Math.floor(Math.random() * 3)
      const newDuration = Math.min(5, oldDuration + 1)

      await prisma.playerContract.update({
        where: { id: roster.contract.id },
        data: {
          salary: newSalary,
          duration: newDuration,
        }
      })

      // Create renewal movement
      await prisma.playerMovement.create({
        data: {
          leagueId: LEAGUE_ID,
          playerId: roster.playerId,
          movementType: MovementType.CONTRACT_RENEW,
          toMemberId: roster.leagueMemberId,
          oldSalary: oldSalary,
          oldDuration: oldDuration,
          newSalary: newSalary,
          newDuration: newDuration,
          marketSessionId: mercatoRicorrente.id,
        }
      })

      renewalCount++
    }
  }

  console.log(`    Created ${renewalCount} contract renewals`)

  // ===== PHASE 4: RUBATA =====
  console.log('  - Creating rubata auctions...')

  let rubataCount = 0
  const rostersForRubata = currentRosters.slice(0, 10) // First 10 players go to rubata

  for (const roster of rostersForRubata) {
    const seller = members.find(m => m.id === roster.leagueMemberId)
    if (!seller) continue

    const basePrice = roster.contract ? roster.contract.salary * 2 : 10
    const wasStolen = Math.random() > 0.7 // 30% chance of being stolen

    const potentialBuyers = members.filter(m => m.id !== seller.id)
    const winner = wasStolen
      ? potentialBuyers[Math.floor(Math.random() * potentialBuyers.length)]
      : seller

    const finalPrice = wasStolen ? basePrice + Math.floor(Math.random() * 20) : basePrice

    const auction = await prisma.auction.create({
      data: {
        leagueId: LEAGUE_ID,
        marketSessionId: mercatoRicorrente.id,
        playerId: roster.playerId,
        type: AuctionType.RUBATA,
        status: AuctionStatus.COMPLETED,
        basePrice: basePrice,
        currentPrice: finalPrice,
        sellerId: seller.id,
        winnerId: winner.id,
        timerSeconds: 30,
        startsAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000 + rubataCount * 60000),
        endsAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000 + rubataCount * 60000 + 120000),
      }
    })

    // Create bids
    if (wasStolen) {
      await prisma.auctionBid.create({
        data: {
          auctionId: auction.id,
          bidderId: winner.id,
          userId: winner.userId,
          amount: finalPrice,
          isWinning: true,
          placedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000 + rubataCount * 60000 + 30000),
        }
      })

      // Transfer roster to new owner
      await prisma.playerRoster.update({
        where: { id: roster.id },
        data: { leagueMemberId: winner.id }
      })

      // Create movement
      await prisma.playerMovement.create({
        data: {
          leagueId: LEAGUE_ID,
          playerId: roster.playerId,
          movementType: MovementType.RUBATA,
          fromMemberId: seller.id,
          toMemberId: winner.id,
          price: finalPrice,
          auctionId: auction.id,
          marketSessionId: mercatoRicorrente.id,
        }
      })

      // Update budgets
      await prisma.leagueMember.update({
        where: { id: winner.id },
        data: { currentBudget: { decrement: finalPrice } }
      })
      await prisma.leagueMember.update({
        where: { id: seller.id },
        data: { currentBudget: { increment: finalPrice } }
      })
    }

    rubataCount++
  }

  console.log(`    Created ${rubataCount} rubata auctions`)

  // ===== PHASE 5: SVINCOLATI =====
  console.log('  - Creating svincolati auctions...')

  // Get some free players (not in any roster)
  const rosteredPlayerIds = currentRosters.map(r => r.playerId)
  const freePlayers = allPlayers.filter(p => !rosteredPlayerIds.includes(p.id)).slice(0, 15)

  let svincolatiCount = 0
  for (const player of freePlayers) {
    const nominator = members[svincolatiCount % members.length]
    const winner = members[(svincolatiCount + 1) % members.length]
    const basePrice = Math.max(1, Math.floor(player.quotation / 3))
    const finalPrice = basePrice + Math.floor(Math.random() * 10)

    const auction = await prisma.auction.create({
      data: {
        leagueId: LEAGUE_ID,
        marketSessionId: mercatoRicorrente.id,
        playerId: player.id,
        type: AuctionType.FREE_BID,
        status: AuctionStatus.COMPLETED,
        basePrice: basePrice,
        currentPrice: finalPrice,
        winnerId: winner.id,
        nominatorId: nominator.id,
        timerSeconds: 30,
        startsAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000 + svincolatiCount * 60000),
        endsAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000 + svincolatiCount * 60000 + 120000),
      }
    })

    // Create bid
    await prisma.auctionBid.create({
      data: {
        auctionId: auction.id,
        bidderId: winner.id,
        userId: winner.userId,
        amount: finalPrice,
        isWinning: true,
        placedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000 + svincolatiCount * 60000 + 30000),
      }
    })

    // Create roster
    const roster = await prisma.playerRoster.create({
      data: {
        leagueMemberId: winner.id,
        playerId: player.id,
        status: RosterStatus.ACTIVE,
        acquisitionType: 'SVINCOLATI',
        acquisitionPrice: finalPrice,
        acquiredAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      }
    })

    // Create contract
    const contractDuration = Math.floor(Math.random() * 2) + 1
    const contractSalary = Math.max(1, Math.floor(finalPrice / 3))
    const rescissionClause = contractSalary * 3

    await prisma.playerContract.create({
      data: {
        rosterId: roster.id,
        leagueMemberId: winner.id,
        salary: contractSalary,
        duration: contractDuration,
        initialSalary: contractSalary,
        initialDuration: contractDuration,
        rescissionClause: rescissionClause,
        signedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() + contractDuration * 365 * 24 * 60 * 60 * 1000),
      }
    })

    // Create movement
    await prisma.playerMovement.create({
      data: {
        leagueId: LEAGUE_ID,
        playerId: player.id,
        movementType: MovementType.SVINCOLATI,
        toMemberId: winner.id,
        price: finalPrice,
        newSalary: contractSalary,
        newDuration: contractDuration,
        auctionId: auction.id,
        marketSessionId: mercatoRicorrente.id,
      }
    })

    // Update budget
    await prisma.leagueMember.update({
      where: { id: winner.id },
      data: { currentBudget: { decrement: finalPrice } }
    })

    svincolatiCount++
  }

  console.log(`    Created ${svincolatiCount} svincolati auctions`)

  // ===== PHASE 6: OFFERTE POST-SVINCOLATI =====
  console.log('  - Creating post-svincolati trades...')

  // Create a couple more trades
  const finalRosters = await prisma.playerRoster.findMany({
    where: {
      leagueMember: { leagueId: LEAGUE_ID },
      status: RosterStatus.ACTIVE
    },
    include: { player: true }
  })

  for (let i = 0; i < 2; i++) {
    const sender = members[i * 2]
    const receiver = members[i * 2 + 1]
    if (!sender || !receiver) continue

    const senderRosters = finalRosters.filter(r => r.leagueMemberId === sender.id)
    const receiverRosters = finalRosters.filter(r => r.leagueMemberId === receiver.id)

    if (senderRosters.length > 0 && receiverRosters.length > 0) {
      const offeredPlayer = senderRosters[0]
      const requestedPlayer = receiverRosters[0]

      await prisma.tradeOffer.create({
        data: {
          marketSessionId: mercatoRicorrente.id,
          senderId: sender.userId,
          receiverId: receiver.userId,
          offeredPlayers: [offeredPlayer.id],
          requestedPlayers: [requestedPlayer.id],
          involvedPlayers: [offeredPlayer.id, requestedPlayer.id],
          offeredBudget: 15,
          requestedBudget: 0,
          status: i === 0 ? TradeStatus.ACCEPTED : TradeStatus.REJECTED,
          message: i === 0 ? 'Ultimo scambio della sessione!' : 'No grazie, mi tengo il giocatore',
          expiresAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          respondedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
        }
      })
    }
  }

  console.log('    Created post-svincolati trades')

  // Print summary
  console.log('\n✅ Population complete!')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`📊 Summary:`)
  console.log(`   - Members: ${members.length}`)
  console.log(`   - First Market Auctions: ${auctionCount}`)
  console.log(`   - Trade Offers: ${tradeCount + 2}`)
  console.log(`   - Contract Renewals: ${renewalCount}`)
  console.log(`   - Rubata Auctions: ${rubataCount}`)
  console.log(`   - Svincolati Auctions: ${svincolatiCount}`)
  console.log(`   - Prize Categories: 2`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('\n🎉 You can now test the History section!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
